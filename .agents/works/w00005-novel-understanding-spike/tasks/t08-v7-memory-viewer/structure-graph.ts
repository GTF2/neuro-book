import type {MemoryNode} from "../t07-v7-schema-gold/index.ts";
import type {KnowledgeEdge} from "./knowledge-graph.ts";

/** Identity inspection follows the owning fields rather than all inverse references. */
export function identityChain(nodes: readonly MemoryNode[], selected: string | null): {nodes: MemoryNode[]; edges: KnowledgeEdge[]} | null {
    const byId = new Map(nodes.map(node => [node.id, node]));
    const focus = byId.get(selected ?? "");
    if (!focus || !["entity", "resolution", "referent", "mention"].includes(focus.kind)) return null;
    const referentId = focus.kind === "referent" ? focus.id : focus.kind === "mention" || focus.kind === "resolution" ? focus.data.referent.id : null;
    const resolutions = nodes.filter(node => node.kind === "resolution" && (focus.kind === "entity" ? node.data.entity.id === focus.id : focus.kind === "resolution" ? node.id === focus.id : node.data.referent.id === referentId));
    const visible = new Map<string, MemoryNode>([[focus.id, focus]]);
    const edges: KnowledgeEdge[] = [];
    const connect = (source: string, target: string, label: string): void => {
        const from = byId.get(source); const to = byId.get(target);
        if (!from || !to) return;
        visible.set(source, from); visible.set(target, to);
        const id = `identity:${source}:${target}`;
        if (!edges.some(edge => edge.id === id)) edges.push({id, source, target, label, kind: "reference"});
    };
    const referents = new Set<string>(referentId ? [referentId] : []);
    for (const resolution of resolutions) {
        if (resolution.kind !== "resolution") continue;
        referents.add(resolution.data.referent.id);
        connect(resolution.data.referent.id, resolution.id, "身份判断");
        const assessment = nodes.find(node => node.kind === "assessment" && node.data.target.id === resolution.id);
        const accepted = assessment?.kind === "assessment" && assessment.data.epistemic === "accepted";
        connect(resolution.id, resolution.data.entity.id, resolution.data.decision === "same" && accepted ? "归属主体" : resolution.data.decision === "unresolved" ? "身份未定" : "候选主体");
    }
    for (const node of nodes) if (node.kind === "mention" && referents.has(node.data.referent.id)) connect(node.id, node.data.referent.id, "原文指向");
    return {nodes: [...visible.values()], edges};
}
