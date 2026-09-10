import type {MemoryNode} from "../t07-v7-schema-gold/index.ts";
import {kindLabels} from "./view-model.ts";

type Shape = "circle" | "square" | "diamond" | "flag";
interface Appearance {key: string; label: string; color: string; shape: Shape}
const categories: Record<string, {label: string; color: string}> = {
    person: {label: "人物", color: "#bf536c"}, character: {label: "人物", color: "#bf536c"},
    body: {label: "身体", color: "#9368a8"},
    object: {label: "物品", color: "#b18430"}, artifact: {label: "物品", color: "#b18430"},
    place: {label: "地点", color: "#3e9081"}, location: {label: "地点", color: "#3e9081"},
    organization: {label: "组织", color: "#607bb0"},
};
const otherLabels: Record<string, string> = {world: "世界", agreement: "契约", role: "身份", kind: "类别", species: "物种", unresolved: "身份未明", concept: "概念", task: "任务", "resource-kind": "资源类别"};
const recordColors: Record<string, string> = {fact: "#377fbc", episode: "#428459", mention: "#71808b", referent: "#92619f", resolution: "#2d8585", assessment: "#b56d44", argument: "#ad7856", disclosure: "#557cb0", beat: "#4a8867", knowledgeAccess: "#b35375", entitySummary: "#7a8350", synthesis: "#7a8350"};

export function nodeAppearance(node: MemoryNode): Appearance {
    if (node.kind === "entity") {
        const category = node.data.category;
        const appearance = categories[category] ?? {label: otherLabels[category] ?? category, color: "#77818e"};
        return {key: `entity:${category}`, ...appearance, shape: "circle"};
    }
    const shape = ["referent", "resolution", "assessment"].includes(node.kind) ? "diamond" : ["episode", "beat"].includes(node.kind) ? "flag" : "square";
    return {key: node.kind, label: kindLabels[node.kind] ?? node.kind, color: recordColors[node.kind] ?? "#71808b", shape};
}
