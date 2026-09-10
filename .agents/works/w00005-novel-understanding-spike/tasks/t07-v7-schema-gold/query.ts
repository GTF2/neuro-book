import type { Epistemic, MemoryDataset, MemoryNode, NodeOf, Position, RecordRef } from "./schema.ts";
import { collectReferences, comparePosition, effectiveDependencies, parseDataset } from "./validate.ts";

export interface QueryScope { readAt: Position; perspective: string; world: string }
export interface GraphEdge { id: string; source: string; target: string; kind: "dependency" | "reference" | "semantic"; label: string; factId?: string }
export interface QueryIndex {
    dataset: MemoryDataset;
    byId: Map<string, MemoryNode>;
    byKind: Map<MemoryNode["kind"], MemoryNode[]>;
    dependencies: Map<string, RecordRef[]>;
    dependents: Map<string, Set<string>>;
    assessments: Map<string, NodeOf<"assessment">[]>;
    summariesByEntity: Map<string, NodeOf<"entitySummary">[]>;
}

export function createQueryIndex(input: MemoryDataset): QueryIndex {
    const dataset = parseDataset(input);
    const index: QueryIndex = { dataset, byId: new Map(), byKind: new Map(), dependencies: new Map(), dependents: new Map(), assessments: new Map(), summariesByEntity: new Map() };
    for (const node of dataset.nodes) {
        index.byId.set(node.id, node);
        const group = index.byKind.get(node.kind) ?? []; group.push(node); index.byKind.set(node.kind, group);
        const dependencies = effectiveDependencies(node); index.dependencies.set(node.id, dependencies);
        const invalidationDependencies = dependencies.concat(node.kind === "assessment" ? node.data.arguments : []);
        for (const dependency of invalidationDependencies) {
            const dependents = index.dependents.get(dependency.id) ?? new Set(); dependents.add(node.id); index.dependents.set(dependency.id, dependents);
        }
        if (node.kind === "assessment") { const group = index.assessments.get(node.data.target.id) ?? []; group.push(node); index.assessments.set(node.data.target.id, group); }
        if (node.kind === "entitySummary") { const group = index.summariesByEntity.get(node.data.subject.id) ?? []; group.push(node); index.summariesByEntity.set(node.data.subject.id, group); }
    }
    return index;
}

type ArgumentState = Pick<NodeOf<"argument">["data"], "polarity" | "status">;
export function aggregateAssessment(arguments_: ArgumentState[]): Epistemic {
    const positive = arguments_.filter(arg => arg.polarity === "supports");
    const usable = positive.some(arg => arg.status === "usable");
    const conditional = positive.some(arg => arg.status === "conditional" || arg.status === "challenged");
    const opposed = arguments_.some(arg => arg.polarity === "opposes" && (arg.status === "usable" || arg.status === "conditional"));
    if ((usable || conditional) && opposed) return "disputed";
    if (usable) return "accepted";
    return conditional ? "tentative" : "unsupported";
}

function projectSnapshot(index: QueryIndex, scope: QueryScope, candidates: MemoryNode[]) {
    if (comparePosition(scope.readAt, index.dataset.snapshot.readAt) > 0) throw new Error("Query beyond snapshot coverage");
    const invalid = new Set(index.dataset.invalidationRoots.map(ref => ref.id));
    for (const node of index.byKind.get("watch") ?? []) {
        if (node.kind === "watch" && node.data.partitions.some(partition => (node.data.checkedWatermarks[partition] ?? -1) < (index.dataset.partitionWatermarks[partition] ?? 0))) {
            for (const ref of node.data.targets) invalid.add(ref.id);
        }
    }
    const memo = new Map<string, boolean>(), walking = new Set<string>();
    const projectedAssessments = new Map<string, NodeOf<"assessment">>();
    const projectedArguments = new Map<string, NodeOf<"argument">>();
    function basic(node: MemoryNode): boolean {
        return node.scope.world === scope.world && node.scope.perspective === "reader"
            && comparePosition(node.availableAt, scope.readAt) <= 0 && node.readiness === "ready" && !invalid.has(node.id);
    }
    function assessmentOf(id: string): NodeOf<"assessment"> | undefined {
        return (index.assessments.get(id) ?? []).filter(item => visible(item.id))
            .sort((a, b) => comparePosition(b.data.evaluatedAt, a.data.evaluatedAt))
            .map(item => projectedAssessments.get(item.id))[0];
    }
    function usableIdentity(ref: RecordRef): boolean {
        const node = index.byId.get(ref.id);
        return visible(ref.id) && (node?.kind !== "resolution" || (node.data.decision === "same" && assessmentOf(node.id)?.data.epistemic === "accepted"));
    }
    function visible(id: string): boolean {
        const known = memo.get(id); if (known !== undefined) return known;
        const node = index.byId.get(id);
        if (!node || walking.has(id)) return false;
        walking.add(id);
        let result = basic(node) && (index.dependencies.get(id) ?? []).every(ref => visible(ref.id));
        if (result && node.kind === "argument") {
            let status = node.data.status;
            if (node.data.review.verdict === "rejected" || node.data.applicability === "impossible") status = "blocked";
            else if (node.data.review.verdict === "pending" || node.data.applicability === "unknown") status = "conditional";
            for (const premise of node.data.premises.filter(premise => premise.required)) {
                const assessment = assessmentOf(premise.ref.id);
                if (assessment?.data.epistemic === "unsupported") status = "blocked";
                else if (assessment && assessment.data.epistemic !== "accepted" && status === "usable") status = "conditional";
            }
            projectedArguments.set(id, { ...node, data: { ...node.data, status } });
        }
        if (result && node.kind === "assessment") {
            result = comparePosition(node.data.evaluatedAt, scope.readAt) <= 0;
            const arguments_: NodeOf<"argument">[] = [];
            for (const ref of node.data.arguments) {
                const argument = index.byId.get(ref.id);
                if (argument?.kind !== "argument" || comparePosition(argument.availableAt, scope.readAt) > 0) continue;
                if (visible(argument.id)) arguments_.push(projectedArguments.get(argument.id)!);
                // A dirty opposing path cannot silently disappear and turn a disputed claim into accepted.
                else if (argument.data.polarity !== "supports") result = false;
            }
            if (arguments_.length === 0) result = false;
            if (result) projectedAssessments.set(id, { ...node, data: { ...node.data, arguments: arguments_.map(item => ({ id: item.id, revision: item.revision })), epistemic: aggregateAssessment(arguments_.map(item => item.data)) } });
        }
        if (result && (node.kind === "fact" || node.kind === "resolution" || node.kind === "episode")) result = assessmentOf(id) !== undefined;
        if (result && node.kind === "fact") result = node.data.interpretationDependencies.every(usableIdentity);
        if (result && (node.kind === "entitySummary" || node.kind === "synthesis")) result = node.data.items.every(item => item.readiness === "ready");
        if (result && (node.kind === "entitySummary" || node.kind === "synthesis")) result = node.data.items.every(item => item.assessmentBasis.every(basis => {
            const assessment = assessmentOf(basis.target.id);
            return assessment?.data.epistemic === basis.epistemic;
        }));
        if (result && node.kind === "entitySummary") {
            result = comparePosition(node.data.readAt, scope.readAt) <= 0
                && node.data.builtFrom.sourceManifest === index.dataset.snapshot.sourceManifest
                && node.data.builtFrom.knowledgeRevision === index.dataset.snapshot.knowledgeRevision
                && Object.entries(node.data.builtFrom.partitionWatermarks).every(([key, value]) => value === index.dataset.partitionWatermarks[key]);
        }
        walking.delete(id); memo.set(id, result); return result;
    }

    // Access is an explicit assertion about a character, never the transitive reader evidence closure.
    const characterAllowed = new Set<string>();
    const knowledge: Array<{ target: string; holder: string; mode: NodeOf<"knowledgeAccess">["data"]["mode"]; accessId: string }> = [];
    if (scope.perspective !== "reader") {
        for (const access of index.byKind.get("knowledgeAccess") ?? []) {
            if (access.kind !== "knowledgeAccess" || access.data.holder.id !== scope.perspective || !visible(access.id)) continue;
            knowledge.push({ target: access.data.target.id, holder: access.data.holder.id, mode: access.data.mode, accessId: access.id });
            characterAllowed.add(access.id); characterAllowed.add(access.data.holder.id);
            if (access.data.mode === "unaware" || !visible(access.data.target.id)) continue;
            characterAllowed.add(access.data.target.id);
            const target = index.byId.get(access.data.target.id);
            if (target?.kind === "fact") for (const argument of target.data.arguments) {
                if (argument.value.type === "ref" && index.byId.get(argument.value.ref.id)?.kind === "entity") characterAllowed.add(argument.value.ref.id);
            }
        }
    }
    function permitted(node: MemoryNode): boolean { return scope.perspective === "reader" || characterAllowed.has(node.id); }
    const nodes: MemoryNode[] = [];
    for (const node of candidates) {
        if (!permitted(node) || !visible(node.id)) continue;
        if (node.kind === "entity") {
            const names = scope.perspective === "reader" ? node.data.names.filter(name => comparePosition(name.availableAt, scope.readAt) <= 0 && name.dependencies.every(usableIdentity)).sort((a, b) => comparePosition(a.availableAt, b.availableAt)) : [];
            // Name evidence is field-local: losing an alias must not erase the persistent entity.
            nodes.push({ ...node, label: names.at(-1)?.text ?? node.id, data: { ...node.data, names } });
        } else if (node.kind === "referent") {
            const mentions = node.data.mentions.filter(ref => visible(ref.id)).sort((a, b) => comparePosition(index.byId.get(a.id)!.availableAt, index.byId.get(b.id)!.availableAt));
            const label = mentions.length ? index.byId.get(mentions[0]!.id)!.label : node.data.mentions.length ? node.id : node.label;
            nodes.push({ ...node, label, data: { ...node.data, localName: label, mentions } });
        } else nodes.push(projectedAssessments.get(node.id) ?? projectedArguments.get(node.id) ?? node);
    }
    const ids = new Set(nodes.map(node => node.id)), edges: GraphEdge[] = [];
    for (const node of nodes) {
        const dependencyIds = new Set((index.dependencies.get(node.id) ?? []).map(ref => ref.id));
        const refs = new Map(collectReferences(node.data).concat(node.dependencies).map(ref => [ref.id, ref]));
        for (const ref of refs.values()) if (ids.has(ref.id) && ref.id !== node.id) {
            edges.push({ id: `${node.id}->${ref.id}`, source: node.id, target: ref.id, kind: dependencyIds.has(ref.id) ? "dependency" : "reference", label: dependencyIds.has(ref.id) ? "依据" : "引用" });
        }
        if (node.kind === "fact" && scope.perspective === "reader" && assessmentOf(node.id)?.data.epistemic === "accepted") {
            for (const participant of node.data.arguments) if (participant.value.type === "ref" && ids.has(participant.value.ref.id)) edges.push({ id: `semantic:${node.id}:${participant.role}`, source: node.id, target: participant.value.ref.id, kind: "semantic", label: `${node.data.assertion.kind} · ${participant.role}`, factId: node.id });
        }
    }
    return {
        nodes, edges, knowledge, excluded: candidates.length - nodes.length,
        unavailable: candidates.filter(node => !ids.has(node.id) && basic({ ...node, readiness: "ready" }) && permitted(node)).map(node => ({ id: node.id, kind: node.kind, label: node.kind === "entity" || node.kind === "referent" ? node.id : node.label, reason: node.readiness !== "ready" ? node.readiness : "dependency-or-scope-not-ready" })),
        coverage: { ...index.dataset.coverage, through: scope.readAt, chapters: index.dataset.coverage.chapters.filter(chapter => chapter <= scope.readAt.chapter), recordsExhausted: false, corpusClosed: false },
        sourceManifest: index.dataset.snapshot.sourceManifest, knowledgeRevision: index.dataset.snapshot.knowledgeRevision,
        diagnostics: { candidates: candidates.length, visitedDependencies: memo.size },
    };
}

export function querySnapshot(index: QueryIndex, scope: QueryScope) { return projectSnapshot(index, scope, index.dataset.nodes); }

export function queryEntitySummaries(index: QueryIndex, entityId: string, scope: QueryScope) {
    const snapshot = projectSnapshot(index, scope, index.summariesByEntity.get(entityId) ?? []);
    const newest = new Map<string, NodeOf<"entitySummary">>();
    for (const node of snapshot.nodes) {
        if (node.kind !== "entitySummary" || node.data.subject.id !== entityId) continue;
        const previous = newest.get(node.data.facet);
        if (!previous || comparePosition(node.data.readAt, previous.data.readAt) > 0) newest.set(node.data.facet, node);
    }
    return { items: [...newest.values()], coverage: snapshot.coverage, status: newest.size ? "ready" as const : "missing-or-stale" as const, diagnostics: snapshot.diagnostics };
}
