import {collectReferences, comparePosition, effectiveDependencies, spanText, type MemoryDataset, type MemoryNode, type NodeOf, type QueryScope, type RecordRef, type Span} from "../t07-v7-schema-gold/index.ts";
import type {EvidenceLink, Handle, RecordItem} from "./contract.ts";

/** Search only projected content fields, never identifiers or reference metadata. */
export function searchableText(node: MemoryNode): string[] {
    switch (node.kind) {
        case "entity": return node.data.names.map(name => name.text);
        case "referent": return node.label === node.id ? [] : [node.label, node.data.localName];
        case "mention": return [node.data.text];
        case "resolution": return [];
        case "predicate": return [node.data.name, node.data.definition, node.data.family];
        case "disclosure": return [node.data.text];
        case "beat": return [node.data.gist];
        case "fact": return [node.data.proposition, ...node.data.arguments.flatMap(argument => argument.value.type === "text" ? [argument.value.text] : []), ...node.data.qualifiers.textualConditions];
        case "episode": return [node.data.summary, ...node.data.components.map(component => component.text)];
        case "synthesis": return [node.data.topic, ...node.data.items.map(item => item.text)];
        case "entitySummary": return node.data.items.map(item => item.text);
        case "argument": return [node.data.rationale, ...node.data.assumptions];
        case "assessment": return [node.data.note, ...node.data.unresolved];
        case "time": return [node.data.description];
        case "watch": return [node.data.reason];
        case "knowledgeAccess": return [];
    }
}

export function matchesText(values: string[], query: string | undefined): boolean {
    return query === undefined || values.some(value => value.toLocaleLowerCase("und").includes(query.toLocaleLowerCase("und")));
}

export function entityNameMatches(node: NodeOf<"entity">, query: string | undefined): NonNullable<RecordItem["nameMatches"]> {
    if (query === undefined) return [];
    const needle = query.toLocaleLowerCase("und");
    return node.data.names.flatMap(name => {
        const value = name.text.toLocaleLowerCase("und");
        if (!value.includes(needle)) return [];
        const match = value === needle ? "exact" : value.startsWith(needle) ? "prefix" : "substring";
        return [{text: name.text, match}];
    });
}

export function entityMatchRank(matches: NonNullable<RecordItem["nameMatches"]>): number {
    return Math.min(3, ...matches.map(match => match.match === "exact" ? 0 : match.match === "prefix" ? 1 : 2));
}

export function participates(node: NodeOf<"fact">, id: string): boolean {
    return node.data.arguments.some(argument => argument.value.type === "ref" && argument.value.ref.id === id);
}

export function recordOrder(a: MemoryNode, b: MemoryNode): number {
    return comparePosition(a.availableAt, b.availableAt) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

export function createRecordPresenter(dataset: MemoryDataset, scope: QueryScope, nodes: MemoryNode[]) {
    const visible = new Map(nodes.map(node => [node.id, node]));
    const assessments = new Map<string, NodeOf<"assessment">>();
    const argumentsByConclusion = new Map<string, NodeOf<"argument">[]>();
    for (const node of nodes) {
        if (node.kind === "assessment") {
            const prior = assessments.get(node.data.target.id);
            if (!prior || comparePosition(node.data.evaluatedAt, prior.data.evaluatedAt) > 0 || (comparePosition(node.data.evaluatedAt, prior.data.evaluatedAt) === 0 && node.id > prior.id)) assessments.set(node.data.target.id, node);
        }
        if (node.kind === "argument") {
            const group = argumentsByConclusion.get(node.data.conclusion.id) ?? [];
            group.push(node);
            argumentsByConclusion.set(node.data.conclusion.id, group);
        }
    }
    function handle(ref: RecordRef): Handle {
        return {id: ref.id, revision: ref.revision, status: visible.get(ref.id)?.revision === ref.revision ? "visible" : "unavailable"};
    }
    function excerpts(spans: Span[]) {
        const unique = new Map(spans.map(span => [JSON.stringify(span), span]));
        return [...unique.values()].flatMap(span => {
            const source = dataset.sources.find(source => source.id === span.sourceId && source.revision === span.sourceRevision);
            if (!source || comparePosition({chapter: source.chapterOrder, paragraph: span.paragraph}, scope.readAt) > 0) return [];
            return [{span, chapter: source.chapterOrder, text: spanText(dataset, span)}];
        });
    }
    function present(node: MemoryNode): RecordItem {
        const assessment = assessments.get(node.id) ?? null;
        const spans = [...node.spans];
        if (node.kind === "argument") spans.push(...node.data.sourceRoots);
        if (node.kind === "mention") spans.push(node.data.span);
        if (node.kind === "fact") spans.push(...node.data.arguments.flatMap(argument => argument.anchor ? [argument.anchor] : []));
        return {
            type: "record", record: node, assessment,
            assessmentStatus: assessment ? "visible" : "not-in-scope-or-not-applicable",
            provenance: {
                references: [...new Map(collectReferences(node.data).map(ref => [ref.id, ref])).values()].map(handle),
                dependencies: effectiveDependencies(node).map(handle),
                arguments: (argumentsByConclusion.get(node.id) ?? []).sort(recordOrder).map(handle),
                excerpts: excerpts(spans),
            },
        };
    }
    function links(node: MemoryNode): EvidenceLink[] {
        const result = new Map<string, EvidenceLink>();
        for (const ref of collectReferences(node.data)) result.set(ref.id, {source: node.id, target: handle(ref), relation: "reference"});
        for (const ref of effectiveDependencies(node)) result.set(ref.id, {source: node.id, target: handle(ref), relation: "dependency"});
        for (const argument of argumentsByConclusion.get(node.id) ?? []) result.set(argument.id, {source: node.id, target: handle(argument), relation: "argument"});
        const assessment = assessments.get(node.id);
        if (assessment) result.set(assessment.id, {source: node.id, target: handle(assessment), relation: "assessment"});
        return [...result.values()].sort((a, b) => a.target.id < b.target.id ? -1 : a.target.id > b.target.id ? 1 : 0);
    }
    return {visible, assessments, handle, present, links};
}
