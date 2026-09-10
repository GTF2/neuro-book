import type {MemoryNode} from "../t07-v7-schema-gold/index.ts";
import type {KnowledgeEdge} from "./knowledge-graph.ts";

interface Coordinate {x: number; y: number}

/** Reserve label-sized rows before drawing; fitting a force layout afterwards loses that spacing. */
export function expandedLayout(nodes: readonly MemoryNode[], edges: readonly KnowledgeEdge[], focusId: string | null, viewportWidth: number, viewportHeight: number): {width: number; height: number; positions: Map<string, Coordinate>} {
    const focus = nodes.find(node => node.id === focusId && node.kind === "entity");
    const claims = nodes.filter(node => node.kind === "fact");
    const targets = nodes.filter(node => node.kind !== "fact" && node.id !== focus?.id);
    const rank = new Map(claims.map((node, index) => [node.id, index]));
    const targetRank = (id: string): number => {
        const related = edges.filter(edge => edge.target === id && rank.has(edge.source)).map(edge => rank.get(edge.source) ?? 0);
        return related.length ? related.reduce((a, b) => a + b, 0) / related.length : claims.length;
    };
    targets.sort((a, b) => targetRank(a.id) - targetRank(b.id) || a.id.localeCompare(b.id));
    const narrow = viewportWidth < 600;
    const width = Math.max(narrow ? 560 : 720, viewportWidth);
    const top = narrow && focus ? 150 : 40;
    const height = Math.max(viewportHeight, top + 40 + claims.length * 106, top + 40 + targets.length * 86);
    const positions = new Map<string, Coordinate>();
    const column = (items: readonly MemoryNode[], x: number): void => {
        items.forEach((node, index) => positions.set(node.id, {x, y: top + (index + .5) * (height - top - 60) / Math.max(1, items.length)}));
    };
    if (focus) positions.set(focus.id, {x: narrow ? 140 : 95, y: narrow ? 45 : height / 2 - 20});
    column(claims, narrow ? 140 : focus ? width / 2 : width * .28);
    column(targets, width - 100);
    return {width, height, positions};
}

export function graphLabelLines(label: string, expanded: boolean): string[] {
    const chars = [...label];
    const limit = expanded ? 28 : 14;
    const clipped = chars.slice(0, limit).join("") + (chars.length > limit ? "…" : "");
    return expanded && chars.length > 14 ? [[...clipped].slice(0, 14).join(""), [...clipped].slice(14).join("")] : [clipped];
}
