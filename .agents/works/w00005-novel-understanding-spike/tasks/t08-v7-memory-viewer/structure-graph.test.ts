import {readFileSync} from "node:fs";
import {describe, expect, it} from "vitest";
import {createQueryIndex, parseDataset, querySnapshot} from "../t07-v7-schema-gold/index.ts";
import {identityChain} from "./structure-graph.ts";

const data = parseDataset(JSON.parse(readFileSync(new URL("../t07-v7-schema-gold/dataset-v7.json", import.meta.url), "utf8")));
const nodes = querySnapshot(createQueryIndex(data), {readAt: data.snapshot.readAt, world: "original", perspective: "reader"}).nodes;

describe("identity inspection", () => {
    it("shows the owning identity chain without assessment or argument clutter", () => {
        const graph = identityChain(nodes, "resolve:creator:c1");
        expect(graph?.nodes.map(node => node.kind).sort()).toEqual(["entity", "mention", "referent", "resolution"]);
        expect(graph?.edges.map(edge => edge.label)).toEqual(["身份判断", "归属主体", "原文指向"]);
    });
    it("keeps uncertain decisions and assessments visibly uncertain", () => {
        for (const decision of ["candidate", "unresolved", "same"] as const) {
            const changed = structuredClone(nodes);
            const resolution = changed.find(node => node.id === "resolve:creator:c1");
            const assessment = changed.find(node => node.kind === "assessment" && node.data.target.id === "resolve:creator:c1");
            if (resolution?.kind !== "resolution" || assessment?.kind !== "assessment") throw new Error("Missing creator identity fixture");
            resolution.data.decision = decision;
            assessment.data.epistemic = "tentative";
            expect(identityChain(changed, resolution.id)?.edges.some(edge => edge.label === "归属主体")).toBe(false);
        }
    });
    it("retains a standalone entity and mentions of an unresolved referent", () => {
        const entity = nodes.find(node => node.kind === "entity");
        if (!entity) throw new Error("Missing entity fixture");
        expect(identityChain([entity], entity.id)?.nodes).toEqual([entity]);
        const referent = nodes.find(node => node.kind === "referent");
        if (!referent) throw new Error("Missing referent fixture");
        const graph = identityChain(nodes.filter(node => node.kind !== "resolution"), referent.id);
        expect(graph?.nodes.some(node => node.kind === "mention")).toBe(true);
        expect(graph?.nodes.some(node => node.kind === "entity")).toBe(false);
    });
});
