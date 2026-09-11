import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { collectReferences, createQueryIndex, parseDataset, querySnapshot, type MemoryDataset, type Source } from "../t07-v7-schema-gold/index.ts";
import { policy, priorContext, validateKnownReferences } from "./prompts.ts";
import { compileSnapshot } from "./compiler.ts";
import { fixtureBook, fixtureChapter, fixtureSources } from "./fixture.ts";

const gold = parseDataset(JSON.parse(await readFile(new URL("../t07-v7-schema-gold/dataset-v7.json", import.meta.url), "utf8")));
const nextSource: Source = { ...gold.sources[1]!, chapterOrder: 3, title: "Local retrieval probe", paragraphs: ["苏天晴知道造物主吗？古书与墨丘利秘典。"] };

function expanded(copies: number): MemoryDataset {
    const dataset = structuredClone(gold);
    // Share source/Beat coverage while duplicating independently valid identity and knowledge graphs.
    const cloned = gold.nodes.filter(node => node.kind !== "beat");
    const ids = new Set(cloned.map(node => node.id));
    for (let copy = 1; copy < copies; copy++) {
        function rename(value: unknown): unknown {
            if (Array.isArray(value)) return value.map(rename);
            if (value && typeof value === "object") {
                const next = Object.fromEntries(Object.entries(value).map(([key, child]) => [key, rename(child)]));
                if (typeof next.id === "string" && ids.has(next.id)) next.id = `clone${copy}:${next.id}`;
                return next;
            }
            return value;
        }
        dataset.nodes = parseDataset({ ...dataset, nodes: [...dataset.nodes, ...cloned.map(rename)] }).nodes;
    }
    return parseDataset(dataset);
}

describe("bounded prior knowledge selection", () => {
    it.each([1, 2, 4])("retains factual, episode, summary and access seeds with %i copies of the 24-entity graph", copies => {
        const dataset = expanded(copies);
        const context = priorContext(dataset, nextSource);
        for (const kind of ["entity", "fact", "episode", "entitySummary", "knowledgeAccess"]) expect(context.records.some(record => record.kind === kind)).toBe(true);
        expect(context.records.length).toBeLessThanOrEqual(policy.context.entities + policy.context.records);
        expect(context.characters).toBe(JSON.stringify(context).length);
        expect(context.characters).toBeLessThanOrEqual(policy.context.characters);
        expect(context.allowedIds).toEqual(context.records.map(record => record.id));
        expect(context.selection?.selectedSemanticRecords).toBeGreaterThan(0);
        expect(context.records.some(record => record.kind === "fact" && record.support?.state === "direct-complete")).toBe(true);
        expect(context.omitted).toBe(dataset.nodes.length - context.records.length);
    });

    it("reports omitted references without granting permission to cite missing records", () => {
        const context = priorContext(expanded(2), nextSource);
        const allowed = new Set(context.allowedIds);
        const missing = new Set(context.records.flatMap(record => collectReferences(record.data).filter(ref => !allowed.has(ref.id)).map(ref => ref.id)));
        expect(context.missingReferences?.count).toBe(missing.size);
        expect(context.missingReferences?.ids.every(id => missing.has(id))).toBe(true);
        expect(context.missingReferences?.idsTruncated).toBe(missing.size > 40);
        expect(() => validateKnownReferences({ reference: `known:${context.missingReferences!.ids[0]}` }, context)).toThrow("absent from supplied context");
    });

    it("prioritizes exact name matches and supplies identity evidence for the named subject", () => {
        const context = priorContext(gold, nextSource);
        expect(context.allowedIds).toContain("su");
        expect(context.allowedIds).toContain("resolve:su:c2");
        expect(context.allowedIds).toContain("assess:resolve:su:c2");
        expect(context.allowedIds).toContain("resolve:book:c2");
        expect(context.allowedIds).toContain("assess:resolve:book:c2");
        expect(context.records.find(record => record.id === "resolve:book:c2")?.support?.state).toBe("direct-complete");
        expect(context.selection?.matchedEntities).toBeGreaterThan(0);
        expect(context.selection?.matchedIdentityBundles).toBeGreaterThanOrEqual(3);
    });

    it("supplies usable fact packages and marks incomplete reverse assessment support explicitly", () => {
        const context = priorContext(gold, nextSource);
        const byId = new Map(context.records.map(record => [record.id, record]));
        const projected = querySnapshot(createQueryIndex(gold), { readAt: gold.snapshot.readAt, world: "original", perspective: "reader" }).nodes;
        const projections = new Map(projected.map(record => [record.id, record]));
        for (const record of context.records.filter(record => record.kind === "fact" && record.support?.state === "direct-complete")) {
            const fact = projections.get(record.id);
            if (fact?.kind !== "fact") throw new Error("Missing projected fact");
            expect(byId.has(fact.data.predicate.id)).toBe(true);
            expect(byId.has(record.support!.assessment!.id)).toBe(true);
            const assessment = projections.get(record.support!.assessment!.id);
            if (assessment?.kind !== "assessment") throw new Error("Missing projected assessment");
            expect(record.support!.assessment!.epistemic).toBe(assessment.data.epistemic);
            expect(assessment.data.arguments.every(argument => byId.has(argument.id))).toBe(true);
            for (const identity of fact.data.interpretationDependencies) {
                expect(byId.get(identity.id)?.support?.state).toBe("direct-complete");
            }
        }
        const partial = context.records.filter(record => record.support?.state === "partial");
        expect(partial.length).toBe(context.selection?.partialSupportRecords);
        expect(partial.every(record => record.support!.missingCount > 0 && record.support!.missingIds.every(id => !byId.has(id)))).toBe(true);
        expect(context.selection?.skippedBundles).toBeGreaterThan(0);
    });

    it("retains only the published prefix and preserves the no-history input", () => {
        const empty = priorContext(null, nextSource);
        expect(empty).toEqual({ records: [], allowedIds: [], candidates: 0, omitted: 0, characters: 0 });
        const earlier = compileSnapshot(fixtureBook, fixtureSources, [fixtureChapter(1)]);
        const context = priorContext(earlier, nextSource);
        expect(context.records.every(record => record.availableAt.chapter === 1)).toBe(true);
    });
});
