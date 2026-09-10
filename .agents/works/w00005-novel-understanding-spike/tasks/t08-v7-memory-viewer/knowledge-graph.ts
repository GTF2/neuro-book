import type {GraphEdge, MemoryNode, NodeOf} from "../t07-v7-schema-gold/index.ts";

export interface KnowledgeAccessItem {
    accessId: string;
    factId: string;
    mode: Exclude<NodeOf<"knowledgeAccess">["data"]["mode"], "unaware">;
}
export interface KnowledgeEdge extends GraphEdge {factIds?: string[]; accesses?: KnowledgeAccessItem[]}
interface KnowledgeAccessEdge extends KnowledgeEdge {accesses: KnowledgeAccessItem[]}

const accessLabels: Record<KnowledgeAccessItem["mode"], string> = {
    heard: "听闻相关说法", read: "读到相关记载", believed: "相信相关说法", known: "知晓相关信息",
};

/** A proposition is a node even when its arguments contain no entity references. */
export function propositionGraph(nodes: readonly MemoryNode[], selected: string | null, factIds: ReadonlySet<string>, page = 0): {nodes: MemoryNode[]; edges: KnowledgeEdge[]; total: number; page: number; pages: number} {
    const byId = new Map(nodes.map(node => [node.id, node]));
    const focus = byId.get(selected ?? "");
    const eligible = nodes.filter(node => node.kind === "fact" && factIds.has(node.id));
    const matching = focus?.kind === "fact" ? eligible.filter(node => node.id === focus.id)
        : focus?.kind === "entity" ? eligible.filter(node => node.kind === "fact" && node.data.arguments.some(argument => argument.value.type === "ref" && argument.value.ref.id === focus.id))
        : eligible;
    const pages = Math.max(1, Math.ceil(matching.length / 6));
    const current = Math.max(0, Math.min(page, pages - 1));
    const claims = matching.slice(current * 6, current * 6 + 6);
    const visible = new Map<string, MemoryNode>();
    const edges: KnowledgeEdge[] = [];
    if (focus?.kind === "entity") visible.set(focus.id, focus);
    for (const claim of claims) {
        if (claim.kind !== "fact") continue;
        visible.set(claim.id, claim);
        for (const [i, argument] of claim.data.arguments.entries()) {
            if (argument.value.type !== "ref") continue;
            const target = byId.get(argument.value.ref.id);
            if (!target) continue;
            visible.set(target.id, target);
            edges.push({id: `argument:${claim.id}:${i}`, source: claim.id, target: target.id, kind: "semantic", label: argument.role, factId: claim.id});
        }
    }
    return {nodes: [...visible.values()], edges, total: matching.length, page: current, pages};
}

export function entityArguments(node: MemoryNode, entities: ReadonlySet<string>): string[] {
    if (node.kind !== "fact") return [];
    return [...new Set(node.data.arguments.flatMap(argument => argument.value.type === "ref" && entities.has(argument.value.ref.id) ? [argument.value.ref.id] : []))];
}

export function expandedKnowledgeGraph(nodes: readonly MemoryNode[], selected: string | null, factIds: ReadonlySet<string>, page = 0): ReturnType<typeof propositionGraph> {
    const graph = propositionGraph(nodes, selected, factIds, page);
    const currentFacts = new Set(graph.nodes.filter(node => node.kind === "fact").map(node => node.id));
    const currentNodes = nodes.filter(node => node.kind !== "fact" || currentFacts.has(node.id));
    const accesses = knowledgeAccessEdges(currentNodes);
    const visible = new Map(graph.nodes.map(node => [node.id, node]));
    for (const edge of accesses) {
        for (const id of [edge.source, edge.target]) {
            const node = nodes.find(item => item.id === id);
            if (node) visible.set(id, node);
        }
    }
    return {...graph, nodes: [...visible.values()], edges: [...graph.edges, ...accesses]};
}

/** Scope-filtered access records navigate to a fact's explicit entities without asserting familiarity or truth. */
export function knowledgeAccessEdges(nodes: readonly MemoryNode[]): KnowledgeAccessEdge[] {
    const byId = new Map(nodes.map(node => [node.id, node]));
    const entityIds = new Set(nodes.filter(node => node.kind === "entity").map(node => node.id));
    const pairs = new Map<string, KnowledgeAccessEdge>();
    for (const access of nodes) {
        if (access.kind !== "knowledgeAccess" || access.data.mode === "unaware") continue;
        const holder = byId.get(access.data.holder.id);
        const fact = byId.get(access.data.target.id);
        if (holder?.kind !== "entity" || fact?.kind !== "fact" || holder.revision !== access.data.holder.revision || fact.revision !== access.data.target.revision) continue;
        for (const target of entityArguments(fact, entityIds)) {
            if (target === holder.id) continue;
            const id = `knowledge:${JSON.stringify([holder.id, target])}`;
            const item: KnowledgeAccessItem = {accessId: access.id, factId: fact.id, mode: access.data.mode};
            const pair = pairs.get(id);
            if (pair) pair.accesses.push(item);
            else pairs.set(id, {id, source: holder.id, target, kind: "semantic", label: "", accesses: [item]});
        }
    }
    for (const edge of pairs.values()) {
        const accesses = edge.accesses;
        const first = accesses[0];
        if (!first) continue;
        const label = accesses.every(access => access.mode === first.mode) ? accessLabels[first.mode] : "相关认知";
        edge.label = accesses.length === 1 ? label : `${label} · ${accesses.length} 条`;
    }
    return [...pairs.values()];
}

/** Fact ownership stays on every edge; multi-party claims remain explicit claim nodes. */
export function knowledgeGraph(nodes: readonly MemoryNode[], selected: string | null, expand: boolean, local: boolean): {nodes: MemoryNode[]; edges: KnowledgeEdge[]} {
    if (expand) return expandedKnowledgeGraph(nodes, selected, new Set(nodes.filter(node => node.kind === "fact").map(node => node.id)));
    const entities = nodes.filter(node => node.kind === "entity");
    const entityIds = new Set(entities.map(node => node.id));
    const edges: KnowledgeEdge[] = [];
    const pairs = new Map<string, KnowledgeEdge>();
    const claims: MemoryNode[] = [];
    const visibleEntities = new Set<string>(selected && entityIds.has(selected) ? [selected] : []);
    for (const fact of nodes.filter(node => node.kind === "fact")) {
        const participants = entityArguments(fact, entityIds);
        const relevant = participants.includes(selected ?? "") || fact.id === selected;
        if (local && !relevant) continue;
        if (participants.length === 2) {
            const [source, target] = participants;
            if (source && target) {
                const key = JSON.stringify([source, target].sort());
                const pair = pairs.get(key);
                if (pair) {pair.factIds?.push(fact.id); pair.label = `${pair.factIds?.length} 条命题`;}
                else {const edge: KnowledgeEdge = {id: `pair:${key}`, source, target, kind: "semantic", label: fact.kind === "fact" ? fact.data.proposition : fact.label, factId: fact.id, factIds: [fact.id]}; pairs.set(key, edge); edges.push(edge);}
            }
            for (const id of participants) visibleEntities.add(id);
        } else if (fact.id === selected) {
            claims.push(fact);
            for (const id of participants) {
                visibleEntities.add(id);
                edges.push({id: `claim:${fact.id}:${id}`, source: fact.id, target: id, kind: "semantic", label: fact.label, factId: fact.id});
            }
        }
    }
    for (const edge of knowledgeAccessEdges(nodes)) {
        if (local && edge.source !== selected && edge.target !== selected && !edge.accesses?.some(access => access.factId === selected || access.accessId === selected)) continue;
        edges.push(edge);
        visibleEntities.add(edge.source);
        visibleEntities.add(edge.target);
    }
    return {nodes: [...(local ? entities.filter(node => visibleEntities.has(node.id)) : entities), ...claims], edges};
}

/** Query semantic edges repeat reference endpoints; retain one owned structural link per pair. */
export function structuralEdges(edges: readonly GraphEdge[]): GraphEdge[] {
    const unique = new Map<string, GraphEdge>();
    for (const edge of edges) {
        if (edge.kind === "semantic") continue;
        const key = JSON.stringify([edge.source, edge.target]);
        if (!unique.has(key) || edge.kind === "dependency") unique.set(key, edge);
    }
    return [...unique.values()];
}
