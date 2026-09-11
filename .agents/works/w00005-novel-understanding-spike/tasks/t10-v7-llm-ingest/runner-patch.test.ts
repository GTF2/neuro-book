import {rm} from "node:fs/promises";
import {join} from "node:path";
import {afterEach, describe, expect, it} from "vitest";
import {createTestTmpRoot} from "@notnotype/neuro-book-test-support/tmp";
import {fixtureBook, fixtureChapter, fixtureSources} from "./fixture.ts";
import type {ModelProvider} from "./provider.ts";
import {reportIngest} from "./report.ts";
import {runIngest, SimulatedInterruption} from "./runner.ts";
import {readJson} from "./storage.ts";

const roots: string[] = [];
afterEach(async () => {for (const root of roots.splice(0)) await rm(root, {recursive: true, force: true});});
async function runRoot() {
    const root = await createTestTmpRoot("v7-ingest-patch", "record repair durable execution");
    roots.push(root); return root;
}
function response(value: unknown) {
    return {text: JSON.stringify(value), model: "deepseek-flash", finishReason: "stop", usage: {inputTokens: 100, outputTokens: 100, cacheHitTokens: 0, cacheMissTokens: 100}, responseId: "fixture", durationMs: 1};
}
function replace(collection: string, record: unknown) {return {replacements: [{collection, record}]};}

describe("durable record repairs", () => {
    it("retains the latest full candidate through partial and invalid patches, exhaustion, and saved-response recovery", async () => {
        const root = await runRoot(), fixture = fixtureChapter();
        let calls = 0, materials = 0;
        const provider: ModelProvider = async request => {
            calls++;
            const input = JSON.parse(request.user);
            if (!input.material) {
                materials++;
                if (materials === 1) {
                    expect(input.responseMode).toBe("complete");
                    return response({...fixture.material, disclosures: [{...fixture.material.disclosures[0], mode: "invalid"}], beats: [{...fixture.material.beats[0], mode: "invalid"}]});
                }
                expect(input.responseMode).toBe("record-patch");
                if (materials === 2) return response(replace("disclosures", fixture.material.disclosures[0]));
                expect(input.priorCandidate.disclosures).toEqual(fixture.material.disclosures);
                expect(input.priorCandidate.beats[0].mode).toBe("invalid");
                if (materials === 3) return response(fixture.material);
                return response(replace("beats", fixture.material.beats[0]));
            }
            expect(input.responseMode).toBe("complete");
            expect(input.material).toEqual(fixture.material);
            if (input.reviewUnits) expect(input.integration).toEqual(fixture.integration);
            return response(input.reviewUnits ? fixture.review : fixture.integration);
        };
        const options = {root, book: fixtureBook, sources: fixtureSources, through: 1, provider};
        await expect(runIngest(options)).rejects.toThrow("exceeded automatic attempts");
        expect(await readJson(join(root, "ch01/round-1/material/attempt-3/failed.json"))).toMatchObject({nextResponseMode: "record-patch"});
        await expect(runIngest({...options, afterResponse: async stage => {
            if (stage === "material") throw new SimulatedInterruption("Saved patch");
        }})).rejects.toThrow("Saved patch");
        expect((await runIngest(options)).manifest.head).toBe(1);
        expect([calls, materials]).toEqual([6, 4]);
        expect(await readJson(join(root, "ch01/round-1/material/attempt-4/repair.json"))).toEqual(replace("beats", fixture.material.beats[0]));
        expect(await readJson(join(root, "ch01/round-1/material/attempt-4/parsed.json"))).toEqual(fixture.material);
        const report = await reportIngest(root);
        expect(report.calls).toHaveLength(6);
        expect(report.calls.filter(call => call.classification === "production-accepted")).toHaveLength(3);
        expect(report.costs.projection?.byClassification["production-repair"]?.calls).toBe(3);
        await runIngest(options);
        expect(calls).toBe(6);
    });

    it("honors explicit regeneration and restores the complete request mode after interruption", async () => {
        const root = await runRoot(), fixture = fixtureChapter();
        let calls = 0, integrations = 0;
        const provider: ModelProvider = async request => {
            calls++;
            const input = JSON.parse(request.user);
            if (!input.material) return response(fixture.material);
            if (input.reviewUnits) return response(fixture.review);
            integrations++;
            if (integrations === 1) return response({...fixture.integration, facts: [{...fixture.integration.facts[0], identities: []}]});
            expect(input.priorCandidate.facts[0].identities).toEqual([]);
            if (integrations === 2) {
                expect(input.responseMode).toBe("record-patch");
                return response({regenerate: "Need to split a record and update its dependencies"});
            }
            expect(input.responseMode).toBe("complete");
            expect(input.priorAttemptProblems).toContain("split a record");
            return response(fixture.integration);
        };
        const options = {root, book: fixtureBook, sources: fixtureSources, through: 1, provider};
        await expect(runIngest({...options, afterResponse: async stage => {
            if (stage === "integration" && integrations === 3) throw new SimulatedInterruption("Saved full regeneration");
        }})).rejects.toThrow("Saved full regeneration");
        expect(await readJson(join(root, "ch01/round-1/integration/attempt-2/failed.json"))).toMatchObject({category: "regenerate", nextResponseMode: "complete"});
        expect((await runIngest(options)).manifest.head).toBe(1);
        expect(calls).toBe(5);
        expect((await reportIngest(root)).calls.filter(call => call.classification === "production-repair")).toHaveLength(2);
    });

    it.each(["duplicate-id", "missing-collection"])("requests complete data when the candidate has %s", async reason => {
        const root = await runRoot(), fixture = fixtureChapter();
        let materials = 0;
        const provider: ModelProvider = async request => {
            const input = JSON.parse(request.user);
            if (input.material) return response(input.reviewUnits ? fixture.review : fixture.integration);
            expect(input.responseMode).toBe("complete");
            if (++materials === 1) return response(reason === "duplicate-id"
                ? {...fixture.material, disclosures: [fixture.material.disclosures[0], fixture.material.disclosures[0]]}
                : {referents: fixture.material.referents, disclosures: fixture.material.disclosures});
            return response(fixture.material);
        };
        expect((await runIngest({root, book: fixtureBook, sources: fixtureSources, through: 1, provider})).manifest.head).toBe(1);
        expect(materials).toBe(2);
    });

    it("keeps an unknown patch request billable and preserves its base and mode on recovery", async () => {
        const root = await runRoot(), fixture = fixtureChapter();
        let materials = 0, calls = 0;
        const provider: ModelProvider = async request => {
            calls++;
            const input = JSON.parse(request.user);
            if (input.material) return response(input.reviewUnits ? fixture.review : fixture.integration);
            if (++materials === 1) return response({...fixture.material, disclosures: [{...fixture.material.disclosures[0], mode: "invalid"}]});
            expect(input.responseMode).toBe("record-patch");
            expect(input.priorCandidate.disclosures[0].mode).toBe("invalid");
            if (materials === 2) throw new SimulatedInterruption("Unknown patch outcome");
            return response(replace("disclosures", fixture.material.disclosures[0]));
        };
        const options = {root, book: fixtureBook, sources: fixtureSources, through: 1, provider};
        await expect(runIngest(options)).rejects.toThrow("Unknown patch outcome");
        expect((await runIngest(options)).manifest.head).toBe(1);
        expect(calls).toBe(5);
        const report = await reportIngest(root);
        expect(report.calls).toHaveLength(5);
        expect(report.calls.find(call => call.failure?.category === "unknown-provider-outcome")).toMatchObject({usage: null, classification: "production-repair"});
    });
});
