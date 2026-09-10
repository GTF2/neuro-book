import {describe, expect, it} from "vitest";
import {filterItems, localNodeIds} from "./view-model.ts";

describe("visible graph presentation", () => {
    const nodes = [
        {id: "a", kind: "entity", label: "苏天晴"},
        {id: "f", kind: "fact", label: "苏天晴 认识 南佳雨"},
        {id: "b", kind: "entity", label: "南佳雨"},
        {id: "d", kind: "disclosure", label: "原文材料"},
        {id: "z", kind: "entity", label: "孤立对象"},
    ];
    const edges = [{source: "a", target: "f"}, {source: "f", target: "b"}, {source: "d", target: "f"}];
    it("keeps disconnected records in global filtered results", () => {
        expect(filterItems(nodes, "", "entity").map((node) => node.id)).toEqual(["a", "b", "z"]);
    });
    it("searches labels and IDs without adding non-matching neighbors", () => {
        expect(filterItems(nodes, " 苏天晴 ", "all").map((node) => node.id)).toEqual(["a", "f"]);
        expect(filterItems(nodes, "Z", "all").map((node) => node.id)).toEqual(["z"]);
    });
    it("limits local expansion to actual edges and bounded hops", () => {
        expect([...localNodeIds("a", edges, 1)].sort()).toEqual(["a", "f"]);
        expect([...localNodeIds("a", edges, 2)].sort()).toEqual(["a", "b", "d", "f"]);
        expect(localNodeIds("a", [...edges, {source: "f", target: "a"}], 4).has("z")).toBe(false);
    });
});
