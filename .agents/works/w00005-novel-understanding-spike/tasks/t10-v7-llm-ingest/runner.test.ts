import {rm} from "node:fs/promises";
import {spawn} from "node:child_process";
import {once} from "node:events";
import {join} from "node:path";
import {afterEach, describe, expect, it} from "vitest";
import {createTestTmpRoot} from "@notnotype/neuro-book-test-support/tmp";
import {fixtureBook, fixtureChapter, fixtureSources} from "./fixture.ts";
import type {ModelProvider} from "./provider.ts";
import {runIngest, SimulatedInterruption} from "./runner.ts";
import {readJson, withRunLock, writeJson} from "./storage.ts";
import {materialOrigin} from "./material-reuse.ts";
import {reportIngest} from "./report.ts";

const roots: string[] = [];
afterEach(async () => {for (const root of roots.splice(0)) await rm(root, {recursive: true, force: true});});
async function root() {const path = await createTestTmpRoot("v7-ingest", "fake ingest and recovery"); roots.push(path); return path;}
function fakeProvider() {
    let calls = 0;
    const provider: ModelProvider = async request => {
        calls++;
        const input = JSON.parse(request.user) as {chapter: number; reviewUnits?: string[]; material?: unknown};
        const fixture = fixtureChapter(input.chapter);
        const value = input.reviewUnits ? fixture.review : input.material ? fixture.integration : fixture.material;
        return {text: JSON.stringify(value), model: "deepseek-flash", finishReason: "stop", usage: {inputTokens: 100, outputTokens: 100, cacheHitTokens: 0, cacheMissTokens: 100}, responseId: `fake-${calls}`, durationMs: 1};
    };
    return {provider, calls: () => calls};
}

describe("durable chapter execution", () => {
    it.each(["rejection", "integration-gap"])("retains independently approved material for %s and replays the saved B response", async reason => {
        const path = await root(), fake = fakeProvider();
        let materialCalls = 0, integrationCalls = 0, reviews = 0;
        const provider: ModelProvider = async request => {
            const input = JSON.parse(request.user), response = await fake.provider(request);
            if (input.reviewUnits) {
                reviews++;
                if (reviews === 2) expect(input.priorAttemptProblems).toBeUndefined();
                if (reviews === 1) {
                    const review = JSON.parse(response.text);
                    if (reason === "integration-gap") review.missing = [{stage: "integration", note: "Summary needs an attribution repair"}];
                    else Object.assign(review.judgments.find((item: {id: string}) => item.id === "semantic:summary"), {verdict: "rejected", note: "Summary needs an attribution repair"});
                    return {...response, text: JSON.stringify(review)};
                }
            } else if (input.material) {
                integrationCalls++;
                if (integrationCalls === 2) {
                    expect(input.priorCandidate).toEqual(fixtureChapter().integration);
                    expect(input.priorAttemptProblems).toContain("Summary needs an attribution repair");
                }
            } else materialCalls++;
            return response;
        };
        const options = {root: path, book: fixtureBook, sources: fixtureSources, through: 1, provider};
        await expect(runIngest({...options, afterResponse: async stage => {if (stage === "integration" && integrationCalls === 2) throw new SimulatedInterruption("Semantic repair response saved");}})).rejects.toThrow("Semantic repair response saved");
        expect((await runIngest(options)).manifest.head).toBe(1);
        expect([materialCalls, integrationCalls, reviews, fake.calls()]).toEqual([1, 2, 2, 5]);
        expect(await readJson(join(path, "ch01/round-2/material/reuse.json"))).toMatchObject({schema: "neurobook.memory.material-reuse.v1", sourceRound: 1});
        expect(await materialOrigin(join(path, "ch01"), 2)).toMatchObject({sourceRound: 1, material: fixtureChapter().material});
        const report = await reportIngest(path);
        expect(report.calls).toHaveLength(5);
        expect(report.calls.filter(call => call.stage === "material")).toEqual([expect.objectContaining({round: 1, classification: "production-accepted"})]);
        expect(report.costs.projection?.byClassification["production-repair"]?.calls).toBe(2);
    });

    it.each(["rejected", "missing"])("reruns A when review reports %s material", async reason => {
        const path = await root(), fake = fakeProvider();
        let reviews = 0, materials = 0;
        const provider: ModelProvider = async request => {
            const input = JSON.parse(request.user), response = await fake.provider(request);
            if (!input.material) {
                if (++materials === 2) expect(input.priorCandidate).toEqual(fixtureChapter().material);
            } else if (input.reviewUnits && ++reviews === 1) {
                const review = JSON.parse(response.text);
                if (reason === "missing") review.missing = [{stage: "material", note: "A key disclosure is missing"}];
                else Object.assign(review.judgments[0], {verdict: "rejected", note: "Incorrect material attribution"});
                return {...response, text: JSON.stringify(review)};
            } else if (!input.reviewUnits && materials === 2) expect(input.priorCandidate).toBeUndefined();
            return response;
        };
        expect((await runIngest({root: path, book: fixtureBook, sources: fixtureSources, through: 1, provider})).manifest.head).toBe(1);
        expect([materials, fake.calls()]).toEqual([2, 6]);
    });

    it("recovers a C coverage repair after a semantic repair without restoring old semantic feedback", async () => {
        const path = await root(), fake = fakeProvider();
        let reviews = 0, materials = 0;
        const provider: ModelProvider = async request => {
            const input = JSON.parse(request.user), response = await fake.provider(request);
            if (!input.material) materials++;
            if (input.reviewUnits) {
                reviews++;
                const review = JSON.parse(response.text);
                if (reviews === 1) review.missing = [{stage: "integration", note: "Old semantic omission"}];
                else if (reviews === 2) {
                    expect(input.priorAttemptProblems).toBeUndefined();
                    review.judgments.pop();
                } else {
                    expect(input.priorAttemptProblems).toContain("Review must cover exactly all requested units");
                    expect(input.priorAttemptProblems).not.toContain("Old semantic omission");
                    expect(input.priorCandidate.judgments).toHaveLength(review.judgments.length - 1);
                }
                return {...response, text: JSON.stringify(review)};
            }
            return response;
        };
        const options = {root: path, book: fixtureBook, sources: fixtureSources, through: 1, provider};
        await expect(runIngest({...options, afterResponse: async stage => {
            if (stage === "review" && reviews === 3) throw new SimulatedInterruption("C coverage repair response saved");
        }})).rejects.toThrow("C coverage repair response saved");
        expect((await runIngest(options)).manifest.head).toBe(1);
        expect([materials, reviews, fake.calls()]).toEqual([1, 3, 6]);
        const report = await reportIngest(path);
        expect(report.calls.filter(call => call.classification === "production-accepted")).toHaveLength(3);
        expect(report.costs.projection?.byClassification["production-repair"]?.calls).toBe(3);
    });

    it("retains A reuse under bounded publication and rejects changed or circular provenance", async () => {
        const path = await root(), fake = fakeProvider();
        let reviews = 0;
        const provider: ModelProvider = async request => {
            const input = JSON.parse(request.user), response = await fake.provider(request);
            if (input.reviewUnits && ++reviews <= 2) {
                const review = JSON.parse(response.text);
                Object.assign(review.judgments.find((item: {id: string}) => item.id === "semantic:summary"), {verdict: "rejected", note: "Repair summary"});
                return {...response, text: JSON.stringify(review)};
            }
            return response;
        };
        await runIngest({root: path, book: fixtureBook, sources: fixtureSources, through: 1, provider});
        expect(fake.calls()).toBe(5);
        const chapterRoot = join(path, "ch01"), receiptPath = join(chapterRoot, "round-2/material/reuse.json");
        expect(await materialOrigin(chapterRoot, 2)).toMatchObject({sourceRound: 1});
        const receipt = await readJson(receiptPath) as Record<string, unknown>;
        await writeJson(receiptPath, {...receipt, sourceRound: 2});
        await expect(materialOrigin(chapterRoot, 2)).rejects.toThrow("origin or hash");
        await writeJson(receiptPath, receipt);
        const changed = fixtureChapter().material; changed.beats[0]!.gist = "Changed source";
        await writeJson(join(chapterRoot, "round-1/material/accepted.json"), changed);
        await expect(materialOrigin(chapterRoot, 2)).rejects.toThrow("source hash mismatch");
    });

    it("publishes residual semantic rejection after one repair across restarts without a third round", async () => {
        const path = await root(), fake = fakeProvider();
        let reviews = 0;
        const provider: ModelProvider = async request => {
            const input = JSON.parse(request.user), response = await fake.provider(request);
            if (input.reviewUnits) {
                reviews++;
                const review = JSON.parse(response.text);
                Object.assign(review.judgments.find((item: {id: string}) => item.id === "semantic:event"), {verdict: "rejected", note: "事件概括不忠于原文"});
                review.missing = [{stage: "integration", note: "另有关键关系待补充"}];
                return {...response, text: JSON.stringify(review)};
            }
            return response;
        };
        const options = {root: path, book: fixtureBook, sources: fixtureSources, through: 1, provider};
        await expect(runIngest({...options, afterResponse: async stage => {
            if (stage === "review" && reviews === 2) throw new SimulatedInterruption("Final review saved");
        }})).rejects.toThrow("Final review saved");
        expect((await runIngest(options)).manifest.head).toBe(1);
        expect(fake.calls()).toBe(5);
        const snapshot = await readJson(join(path, "dataset-v7.json"));
        await runIngest(options);
        expect(fake.calls()).toBe(5);
        expect(await readJson(join(path, "dataset-v7.json"))).toEqual(snapshot);
        const report = await reportIngest(path);
        expect(report.quality.chapters).toEqual([{chapter: 1, reviewedUnits: fixtureChapter().review.judgments.length, rejectedUnits: 1, missingItems: 1}]);
        expect(report.quality.pendingRecords).toBe(3);
        expect(report.quality.unavailableRecords).toBeGreaterThan(3);
        expect(report.costs.projection?.production.calls).toBe(5);
    });

    it("publishes a consecutive two-chapter prefix and repeating it makes zero calls", async () => {
        const path = await root(), fake = fakeProvider();
        const options = {root: path, book: fixtureBook, sources: fixtureSources, through: 2, provider: fake.provider};
        const result = await runIngest(options);
        expect(result.manifest.head).toBe(2);
        expect(fake.calls()).toBe(6);
        await runIngest(options);
        expect(fake.calls()).toBe(6);
        expect(await readJson(join(path, "dataset-v7.json"))).toMatchObject({snapshot: {knowledgeRevision: 2}});
    });

    it("replays a saved response and completes a snapshot written before head advancement", async () => {
        const path = await root(), fake = fakeProvider();
        const options = {root: path, book: fixtureBook, sources: fixtureSources, through: 1, provider: fake.provider};
        await expect(runIngest({...options, afterResponse: async () => {throw new SimulatedInterruption("After response");}})).rejects.toThrow("After response");
        expect(fake.calls()).toBe(1);
        await expect(runIngest({...options, afterSnapshot: async () => {throw new SimulatedInterruption("After snapshot");}})).rejects.toThrow("After snapshot");
        expect(fake.calls()).toBe(3);
        expect((await runIngest(options)).manifest.head).toBe(1);
        expect(fake.calls()).toBe(3);
    });

    it("rejects changed input and a concurrent writer", async () => {
        const path = await root(), fake = fakeProvider();
        const options = {root: path, book: fixtureBook, sources: fixtureSources, through: 1, provider: fake.provider};
        await runIngest(options);
        await expect(runIngest({...options, book: {...fixtureBook, title: "changed"}})).rejects.toThrow("changed");
        await withRunLock(path, async () => {await expect(runIngest(options)).rejects.toThrow("active writer");});
    });

    it("marks a request without saved response unknown and resumes with a new attempt", async () => {
        const path = await root(), fake = fakeProvider();
        let interrupt = true;
        const provider: ModelProvider = async request => {
            if (interrupt) {interrupt = false; throw new SimulatedInterruption("No saved response");}
            return fake.provider(request);
        };
        const options = {root: path, book: fixtureBook, sources: fixtureSources, through: 1, provider};
        await expect(runIngest(options)).rejects.toThrow("No saved response");
        expect((await runIngest(options)).manifest.head).toBe(1);
        expect(await readJson(join(path, "ch01/round-1/material/attempt-1/failed.json"))).toMatchObject({category: "unknown-provider-outcome"});
        expect(fake.calls()).toBe(3);
    });

    it("reuses a saved repaired response with byte-identical feedback after interruption", async () => {
        const path = await root(), fake = fakeProvider();
        let calls = 0, interrupt = true;
        const provider: ModelProvider = async request => {
            calls++;
            const response = await fake.provider(request);
            return calls === 1 ? {...response, text: "{bad json"} : response;
        };
        const options = {root: path, book: fixtureBook, sources: fixtureSources, through: 1, provider};
        await expect(runIngest({...options, afterResponse: async () => {if (calls === 2 && interrupt) {interrupt = false; throw new SimulatedInterruption("Repaired response saved");}}})).rejects.toThrow("Repaired response saved");
        expect((await runIngest(options)).manifest.head).toBe(1);
        expect(calls).toBe(4);
    });

    it("releases the operating-system writer lock after an abrupt process exit", async () => {
        const path = await root();
        const code = `import {withRunLock} from ${JSON.stringify(new URL("storage.ts", import.meta.url).href)}; await withRunLock(${JSON.stringify(path)}, async () => { console.log("locked"); await new Promise(() => setInterval(() => {}, 1000)); });`;
        const child = spawn(process.execPath, ["--import", import.meta.resolve("tsx"), "--input-type=module", "-e", code], {stdio: ["ignore", "pipe", "pipe"]});
        try {
            await once(child.stdout!, "data");
            await expect(withRunLock(path, async () => undefined)).rejects.toThrow("active writer");
            const exited = once(child, "exit"); child.kill(); await exited;
            await expect(withRunLock(path, async () => "recovered")).resolves.toBe("recovered");
        } finally {
            if (child.exitCode === null && child.signalCode === null) {const exited = once(child, "exit"); child.kill(); await exited;}
        }
    });

    it("repairs integration locally and replays its corrected saved response", async () => {
        const path = await root(), fake = fakeProvider();
        let calls = 0, integrationCalls = 0;
        const provider: ModelProvider = async request => {
            calls++;
            const input = JSON.parse(request.user);
            const response = await fake.provider(request);
            if (input.material && !input.reviewUnits) {
                integrationCalls++;
                if (integrationCalls === 1) {
                    const invalid = JSON.parse(response.text);
                    invalid.facts[0].identities = [];
                    return {...response, text: JSON.stringify(invalid)};
                }
                expect(input.priorCandidate.facts[0].identities).toEqual([]);
                expect(input.priorAttemptProblems).toMatch(/identity/i);
                expect(input.responseMode).toBe("record-patch");
                return {...response, text: JSON.stringify({replacements: [{collection: "facts", record: fixtureChapter().integration.facts[0]}]})};
            }
            return response;
        };
        const options = {root: path, book: fixtureBook, sources: fixtureSources, through: 1, provider};
        await expect(runIngest({...options, afterResponse: async () => {if (calls === 3) throw new SimulatedInterruption("Integration repair saved");}})).rejects.toThrow("Integration repair saved");
        expect((await runIngest(options)).manifest.head).toBe(1);
        expect(calls).toBe(4);
        expect(integrationCalls).toBe(2);
    });

    it("raises output capacity after a truncated response", async () => {
        const path = await root(), fake = fakeProvider();
        const limits: number[] = [];
        const provider: ModelProvider = async request => {
            limits.push(request.maxTokens);
            const response = await fake.provider(request);
            return limits.length === 1 ? {...response, finishReason: "length"} : response;
        };
        expect((await runIngest({root: path, book: fixtureBook, sources: fixtureSources, through: 1, provider})).manifest.head).toBe(1);
        expect(limits[1]).toBe(limits[0]! * 2);
        expect(await readJson(join(path, "ch01/round-1/material/attempt-1/failed.json"))).toMatchObject({category: "capacity", nextMaxTokens: limits[1]});
    });

    it("resumes an exhausted integration stage while retaining material and precise feedback", async () => {
        const path = await root(), fake = fakeProvider();
        let integrationCalls = 0;
        const provider: ModelProvider = async request => {
            const input = JSON.parse(request.user);
            const response = await fake.provider(request);
            if (input.material && !input.reviewUnits) {
                const candidate = JSON.parse(response.text);
                if (++integrationCalls <= 3) candidate.facts[0].identities = [];
                const output = input.responseMode === "record-patch" ? {replacements: [{collection: "facts", record: candidate.facts[0]}]} : candidate;
                return {...response, text: JSON.stringify(output)};
            }
            return response;
        };
        const options = {root: path, book: fixtureBook, sources: fixtureSources, through: 1, provider};
        await expect(runIngest(options)).rejects.toThrow(/Last error:[\s\S]*identity/i);
        expect((await runIngest(options)).manifest.head).toBe(1);
        expect(fake.calls()).toBe(6);
    });

    it("repairs incomplete review coverage without rerunning the extraction stages", async () => {
        const path = await root(), fake = fakeProvider();
        let reviews = 0;
        const provider: ModelProvider = async request => {
            const input = JSON.parse(request.user), response = await fake.provider(request);
            if (input.reviewUnits && ++reviews === 1) {
                const value = JSON.parse(response.text); value.judgments.pop();
                return {...response, text: JSON.stringify(value)};
            }
            if (input.reviewUnits) expect(input.priorAttemptProblems).toMatch(/missing/);
            return response;
        };
        expect((await runIngest({root: path, book: fixtureBook, sources: fixtureSources, through: 1, provider})).manifest.head).toBe(1);
        expect(fake.calls()).toBe(4);
    });

    it("preserves a JSON candidate that fails schema validation across repaired-response interruption", async () => {
        const path = await root(), fake = fakeProvider();
        let calls = 0, integrations = 0;
        const provider: ModelProvider = async request => {
            calls++;
            const input = JSON.parse(request.user), response = await fake.provider(request);
            if (input.material && !input.reviewUnits) {
                integrations++;
                if (integrations === 1) {
                    const candidate = JSON.parse(response.text); candidate.episodes[0].scale = "invalid-scale";
                    return {...response, text: JSON.stringify(candidate)};
                }
                expect(input.priorCandidate.episodes[0].scale).toBe("invalid-scale");
                expect(input.priorAttemptProblems).toContain("scale");
                return {...response, text: JSON.stringify({replacements: [{collection: "episodes", record: fixtureChapter().integration.episodes[0]}]})};
            }
            return response;
        };
        const options = {root: path, book: fixtureBook, sources: fixtureSources, through: 1, provider};
        await expect(runIngest({...options, afterResponse: async () => {if (calls === 3) throw new SimulatedInterruption("Schema repair saved");}})).rejects.toThrow("Schema repair saved");
        expect((await runIngest(options)).manifest.head).toBe(1);
        expect(calls).toBe(4);
        expect(await readJson(join(path, "ch01/round-1/integration/attempt-1/candidate.json"))).toMatchObject({value: {episodes: [{scale: "invalid-scale"}]}});
    });
});
