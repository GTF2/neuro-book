import { datasetSchema, type MemoryDataset, type MemoryNode, type RecordRef, type Span, type Position } from "./schema.ts";

export function comparePosition(a: Position, b: Position): number {
    return a.chapter - b.chapter || a.paragraph - b.paragraph;
}

export function effectiveDependencies(node: MemoryNode): RecordRef[] {
    const refs = [...node.dependencies];
    switch (node.kind) {
        case "fact": refs.push(node.data.predicate, ...node.data.interpretationDependencies, ...collectReferences(node.data.time), ...collectReferences(node.data.qualifiers)); break;
        case "argument": refs.push(...node.data.premises.filter(p => p.required).map(p => p.ref)); break;
        case "assessment": break;
        case "entitySummary":
        case "synthesis": refs.push(...node.data.items.flatMap(item => item.dependencies)); break;
        case "episode": refs.push(...node.data.materials, ...node.data.children, ...node.data.components.flatMap(item => item.dependencies), ...node.data.relations.flatMap(item => item.dependencies)); break;
        case "knowledgeAccess": refs.push(...node.data.evidence, node.data.target); break;
        case "resolution": refs.push(node.data.referent, node.data.entity); break;
        case "time": refs.push(...node.data.constraints.flatMap(constraint => constraint.dependencies)); break;
        default: break;
    }
    return [...new Map(refs.map(ref => [`${ref.id}@${ref.revision}`, ref])).values()];
}

/** Strict payload schemas make every {id,revision} object a typed record reference. */
export function collectReferences(value: unknown): RecordRef[] {
    if (Array.isArray(value)) return value.flatMap(collectReferences);
    if (!value || typeof value !== "object") return [];
    if ("id" in value && "revision" in value && typeof value.id === "string" && typeof value.revision === "number" && Object.keys(value).length === 2) {
        return [{ id: value.id, revision: value.revision }];
    }
    return Object.values(value).flatMap(collectReferences);
}

function boundaryIsValid(text: string, at: number): boolean {
    if (at === 0 || at === text.length) return true;
    const left = text.charCodeAt(at - 1), right = text.charCodeAt(at);
    return !(left >= 0xd800 && left <= 0xdbff && right >= 0xdc00 && right <= 0xdfff);
}

export function spanText(dataset: MemoryDataset, span: Span): string {
    const source = dataset.sources.find(source => source.id === span.sourceId && source.revision === span.sourceRevision);
    const paragraph = source?.paragraphs[span.paragraph - 1];
    if (paragraph === undefined || span.start >= span.end || span.end > paragraph.length || !boundaryIsValid(paragraph, span.start) || !boundaryIsValid(paragraph, span.end)) {
        throw new Error(`Invalid UTF-16 span ${span.sourceId}@${span.sourceRevision}:${span.paragraph}[${span.start},${span.end})`);
    }
    return paragraph.slice(span.start, span.end);
}

export function parseDataset(input: unknown): MemoryDataset {
    const dataset = datasetSchema.parse(input);
    const byId = new Map<string, MemoryNode>();
    const sourceIds = new Set<string>();
    const chapterIds = new Set<string>();
    const chapterOrders = new Set<number>();
    for (const source of dataset.sources) {
        if (sourceIds.has(source.id) || chapterIds.has(source.chapterId) || chapterOrders.has(source.chapterOrder)) throw new Error(`Duplicate source/chapter ${source.id}`);
        sourceIds.add(source.id); chapterIds.add(source.chapterId); chapterOrders.add(source.chapterOrder);
    }
    for (const node of dataset.nodes) {
        if (byId.has(node.id)) throw new Error(`Duplicate effective record ${node.id}`);
        byId.set(node.id, node);
    }
    for (const node of dataset.nodes) {
        if (comparePosition(node.availableAt, dataset.snapshot.readAt) > 0) throw new Error(`Record beyond snapshot ${node.id}`);
        for (const ref of collectReferences(node)) {
            if (byId.get(ref.id)?.revision !== ref.revision) throw new Error(`Dangling revision ${node.id} -> ${ref.id}@${ref.revision}`);
        }
        if (node.kind === "time" && node.data.constraints.some(constraint => constraint.dependencies.length === 0) && node.spans.length === 0) throw new Error(`Time constraint lacks evidence ${node.id}`);
        for (const span of node.spans) {
            spanText(dataset, span);
            const source = dataset.sources.find(source => source.id === span.sourceId)!;
            if (comparePosition({ chapter: source.chapterOrder, paragraph: span.paragraph }, node.availableAt) > 0) throw new Error(`Future evidence ${node.id}`);
        }
        for (const ref of effectiveDependencies(node)) {
            if (comparePosition(byId.get(ref.id)!.availableAt, node.availableAt) > 0) throw new Error(`Future dependency ${node.id} -> ${ref.id}`);
        }
        if (node.kind === "entity") for (const name of node.data.names) {
            if (comparePosition(name.availableAt, node.availableAt) < 0 || comparePosition(name.availableAt, dataset.snapshot.readAt) > 0) throw new Error(`Name outside entity lifetime ${node.id}:${name.text}`);
            const evidence = name.dependencies.map(ref => byId.get(ref.id)!);
            if (evidence.some(item => comparePosition(item.availableAt, name.availableAt) > 0 || item.scope.world !== node.scope.world || item.scope.perspective !== node.scope.perspective)) throw new Error(`Name evidence outside scope ${node.id}:${name.text}`);
            const identities = evidence.filter(item => item.kind === "resolution");
            if (!identities.length || identities.some(item => item.data.entity.id !== node.id)) throw new Error(`Name lacks matching identity ${node.id}:${name.text}`);
            const anchored = evidence.some(item => item.kind === "mention" && identities.some(identity => identity.data.referent.id === item.data.referent.id));
            if (!anchored) throw new Error(`Name lacks material mention ${node.id}:${name.text}`);
        }
        if (node.kind === "mention" && spanText(dataset, node.data.span) !== node.data.text) throw new Error(`Mention text mismatch ${node.id}`);
        if (node.kind === "fact") {
            const predicate = byId.get(node.data.predicate.id);
            if (predicate?.kind !== "predicate") throw new Error(`Fact predicate kind ${node.id}`);
            const roles = predicate.data.roles.map(role => role.name);
            if (new Set(node.data.arguments.map(arg => arg.role)).size !== node.data.arguments.length || node.data.arguments.some(arg => !roles.includes(arg.role)) || roles.some(role => !node.data.arguments.some(argument => argument.role === role))) throw new Error(`Invalid argument role ${node.id}`);
            if ((node.data.assertion.kind === "belief" || node.data.assertion.kind === "speech") && (!node.data.assertion.holder || !node.data.assertion.opaque)) throw new Error(`Opaque attribution required ${node.id}`);
            for (const argument of node.data.arguments) if (argument.anchor) spanText(dataset, argument.anchor);
            for (const argument of node.data.arguments) {
                const kind = argument.value.type === "ref" ? byId.get(argument.value.ref.id)!.kind : argument.value.type;
                const rule = predicate.data.roles.find(role => role.name === argument.role)!;
                if (!rule.valueKinds.some(allowed => allowed === kind)) throw new Error(`Invalid argument kind ${node.id}:${argument.role}:${kind}`);
            }
            if (effectiveDependencies(node).some(ref => byId.get(ref.id)?.kind === "entitySummary")) throw new Error(`Summary cannot ground a fact ${node.id}`);
        }
        if (node.kind === "argument") {
            for (const span of node.data.sourceRoots) spanText(dataset, span);
            if (effectiveDependencies(node).some(ref => byId.get(ref.id)?.kind === "entitySummary")) throw new Error(`Summary cannot be an evidence root ${node.id}`);
            if (node.data.polarity === "challenges" && byId.get(node.data.conclusion.id)?.kind !== "argument") throw new Error(`Challenge must target an argument ${node.id}`);
        }
        if (node.kind === "assessment" && node.data.arguments.some(ref => {
            const argument = byId.get(ref.id);
            return argument?.kind !== "argument" || argument.data.conclusion.id !== node.data.target.id;
        })) throw new Error(`Assessment argument target mismatch ${node.id}`);
        if (node.kind === "resolution" && (byId.get(node.data.entity.id)?.kind !== "entity" || byId.get(node.data.referent.id)?.kind !== "referent")) throw new Error(`Resolution target kind ${node.id}`);
        if (node.kind === "entitySummary") {
            if (byId.get(node.data.subject.id)?.kind !== "entity") throw new Error(`Summary subject kind ${node.id}`);
            if (comparePosition(node.data.readAt, node.availableAt) > 0 || node.data.items.some(item => item.dependencies.some(ref => comparePosition(byId.get(ref.id)!.availableAt, node.data.readAt) > 0))) throw new Error(`Summary scope leakage ${node.id}`);
        }
        if (node.kind === "entitySummary" || node.kind === "synthesis") {
            for (const item of node.data.items) {
                const assessmentTargets = item.dependencies.filter(ref => dataset.nodes.some(other => other.kind === "assessment" && other.data.target.id === ref.id));
                if (assessmentTargets.some(ref => !item.assessmentBasis.some(basis => basis.target.id === ref.id && basis.target.revision === ref.revision))) throw new Error(`Summary missing assessment basis ${node.id}:${item.id}`);
                if (item.assessmentBasis.some(basis => !item.dependencies.some(ref => ref.id === basis.target.id && ref.revision === basis.target.revision))) throw new Error(`Summary unrelated assessment basis ${node.id}:${item.id}`);
            }
        }
        if (node.kind === "knowledgeAccess" && byId.get(node.data.holder.id)?.kind !== "entity") throw new Error(`Knowledge holder kind ${node.id}`);
        if (node.kind === "time" && node.data.constraints.some(constraint => byId.get(constraint.other.id)?.kind !== "time")) throw new Error(`Time constraint kind ${node.id}`);
    }
    const visiting = new Set<string>(), visited = new Set<string>();
    function visit(id: string): void {
        if (visiting.has(id)) throw new Error(`Dependency cycle ${id}`);
        if (visited.has(id)) return;
        visiting.add(id);
        for (const ref of effectiveDependencies(byId.get(id)!)) visit(ref.id);
        visiting.delete(id); visited.add(id);
    }
    for (const id of byId.keys()) visit(id);
    // A conclusion cannot acquire support through its own assessment or an older logical path.
    for (const argument of dataset.nodes.filter(node => node.kind === "argument")) {
        const pending = argument.data.premises.map(p => p.ref.id), seen = new Set<string>();
        while (pending.length) {
            const id = pending.pop()!;
            if (id === argument.data.conclusion.id) throw new Error(`Self-support ${argument.id}`);
            if (seen.has(id)) continue;
            seen.add(id);
            const premise = byId.get(id)!;
            pending.push(...effectiveDependencies(premise).map(ref => ref.id));
            for (const assessment of dataset.nodes) if (assessment.kind === "assessment" && assessment.data.target.id === id) pending.push(...assessment.data.arguments.map(ref => ref.id));
        }
    }
    if (dataset.coverage.material === "complete") {
        for (const source of dataset.sources) {
            const beats = dataset.nodes.filter(node => node.kind === "beat").filter(node => node.data.chapterId === source.chapterId).sort((a, b) => a.data.fromParagraph - b.data.fromParagraph);
            let next = 1;
            for (const beat of beats) {
                if (beat.data.fromParagraph !== next || beat.data.toParagraph < next) throw new Error(`Beat gap/overlap ${source.chapterId}:${next}`);
                next = beat.data.toParagraph + 1;
            }
            if (next !== source.paragraphs.length + 1) throw new Error(`Incomplete Beat coverage ${source.chapterId}`);
        }
    }
    return dataset;
}
