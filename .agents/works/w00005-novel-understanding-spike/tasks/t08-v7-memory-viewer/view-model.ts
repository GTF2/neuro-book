/** Presentation helpers consume the already scope-filtered canonical query result. */
export interface DisplayItem {id: string; kind: string; label: string; data?: unknown}
export interface DisplayEdge {source: string; target: string}

export const kindLabels: Record<string, string> = {
    entity: "主体", entitySummary: "主体摘要", fact: "命题", episode: "情节", synthesis: "综合记忆",
    disclosure: "披露", beat: "叙事片段", argument: "论证", assessment: "评估", referent: "局部指称",
    mention: "原文词语", resolution: "身份判断", predicate: "谓词", time: "故事时间", watch: "维护订阅", knowledgeAccess: "角色知情",
};
export const knowledgeKinds = new Set(["entity", "entitySummary", "fact", "episode", "synthesis"]);

export function filterItems<T extends DisplayItem>(items: readonly T[], search: string, kind: string): T[] {
    const needle = search.trim().toLocaleLowerCase();
    return items.filter((item) => (kind === "all" || (kind === "knowledge" ? knowledgeKinds.has(item.kind) : item.kind === kind))
        && (!needle || `${item.label} ${item.id} ${JSON.stringify(item.data ?? "")}`.toLocaleLowerCase().includes(needle)));
}

export function localNodeIds(center: string, edges: readonly DisplayEdge[], hops: number): Set<string> {
    const adjacency = new Map<string, Set<string>>();
    for (const edge of edges) {
        for (const [from, to] of [[edge.source, edge.target], [edge.target, edge.source]]) {
            if (!from || !to) continue;
            const neighbors = adjacency.get(from) ?? new Set<string>();
            neighbors.add(to);
            adjacency.set(from, neighbors);
        }
    }
    const found = new Set([center]);
    let frontier = [center];
    for (let hop = 0; hop < hops; hop++) {
        const next: string[] = [];
        for (const id of frontier) for (const neighbor of adjacency.get(id) ?? []) {
            if (!found.has(neighbor)) {found.add(neighbor); next.push(neighbor);}
        }
        frontier = next;
    }
    return found;
}

export function escapeHtml(text: string): string {
    return text.replace(/[&<>"']/gu, (character) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"})[character] ?? character);
}
