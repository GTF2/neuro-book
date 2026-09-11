import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createTestTmpRoot } from "@notnotype/neuro-book-test-support/tmp";
import { hash } from "./compiler.ts";
import { fixtureBook, fixtureChapter, fixtureSources } from "./fixture.ts";
import type { ModelProvider, ModelResponse } from "./provider.ts";
import { reportIngest } from "./report.ts";
import { runIngest } from "./runner.ts";
import { readJson, writeJson } from "./storage.ts";

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });
const response: ModelResponse = { text: "{}", model: "deepseek-flash", finishReason: "stop", responseId: "response", durationMs: 1, startedAt: "2026-09-10T00:00:00Z", usage: { inputTokens: 100, outputTokens: 50, cacheHitTokens: 0, cacheMissTokens: 100 } };

async function runFixture(through = 2) {
    const root = await createTestTmpRoot("v7-report", "read-only ingest accounting");
    roots.push(root);
    let calls = 0;
    const provider: ModelProvider = async request => {
        calls++;
        const input = JSON.parse(request.user) as { chapter: number; reviewUnits?: string[]; material?: unknown };
        const fixture = fixtureChapter(input.chapter);
        const value = input.reviewUnits ? fixture.review : input.material ? fixture.integration : fixture.material;
        return { ...response, responseId: `fake-${calls}`, text: JSON.stringify(value) };
    };
    await runIngest({ root, book: fixtureBook, sources: fixtureSources, through, provider });
    return { root, calls: () => calls };
}

async function addAttempt(root: string, chapter: number, attempt: number, withResponse: boolean) {
    const path = join(root, `ch${String(chapter).padStart(2, "0")}`, "round-1", "material", `attempt-${attempt}`);
    const request = { model: "deepseek-flash", user: "{}" };
    await writeJson(join(path, "request.json"), { stage: "material", chapter, attempt, startedAt: response.startedAt, requestHash: hash(JSON.stringify(request)), request });
    if (withResponse) {
        await writeJson(join(path, "response.json"), response);
        await writeJson(join(path, "failed.json"), { category: "validation", status: null, message: "Rejected attempt" });
    }
}

describe("read-only ingest report", () => {
    it("counts reused material at its original paid attempt with no synthetic or duplicate calls", async () => {
        const root = await createTestTmpRoot("v7-report", "semantic repair with reused material"); roots.push(root);
        let reviews = 0;
        const provider: ModelProvider = async request => {
            const input = JSON.parse(request.user), fixture = fixtureChapter();
            const value = input.reviewUnits ? fixture.review : input.material ? fixture.integration : fixture.material;
            if (input.reviewUnits && ++reviews <= 2) Object.assign(fixture.review.judgments.find(item => item.id === "semantic:summary")!, {verdict: "rejected", note: "Repair summary attribution"});
            return {...response, text: JSON.stringify(value)};
        };
        await runIngest({root, book: fixtureBook, sources: fixtureSources, through: 1, provider});
        const report = await reportIngest(root);
        expect(report.calls).toHaveLength(5);
        expect(report.calls.filter(call => call.stage === "material")).toEqual([expect.objectContaining({round: 1, classification: "production-accepted"})]);
        expect(report.calls.filter(call => call.classification === "production-accepted")).toHaveLength(3);
        expect(report.costs.projection?.production.calls).toBe(5);
        expect(report.costs.projection?.byClassification["production-repair"]?.calls).toBe(2);
        const receiptPath = join(root, "ch01/round-2/material/reuse.json");
        const receipt = await readJson(receiptPath) as Record<string, unknown>;
        await writeJson(receiptPath, {...receipt, sourceRound: 2});
        await expect(reportIngest(root)).rejects.toThrow("origin or hash");
    });

    it("verifies the published prefix and reports accepted calls without writing or calling a model", async () => {
        const run = await runFixture();
        const before = await readFile(join(run.root, "manifest.json"), "utf8");
        const report = await reportIngest(run.root);
        expect(report.publishedChapters).toBe(2);
        expect(report.publicationVerified).toBe(true);
        expect(report.calls).toHaveLength(6);
        expect(report.calls.every(call => call.classification === "production-accepted")).toBe(true);
        expect(report.models).toEqual(["deepseek-flash"]);
        expect(report.sources.paragraphs).toBe(4);
        expect(report.sources.chapters.reduce((sum, chapter) => sum + chapter.characters, 0)).toBe(fixtureSources.reduce((sum, source) => sum + source.paragraphs.reduce((total, paragraph) => total + [...paragraph].length, 0), 0));
        expect(report.records.entity).toBe(1);
        expect(report.context.find(chapter => chapter.chapter === 1)).toMatchObject({selection: null, missingReferences: null});
        expect(report.context.find(chapter => chapter.chapter === 2)?.selection?.selectedSemanticRecords).toBeGreaterThan(0);
        expect(report.context.find(chapter => chapter.chapter === 2)?.selection).toMatchObject({skippedBundles: expect.any(Number), matchedIdentityBundles: expect.any(Number), partialSupportRecords: expect.any(Number)});
        expect(report.context.find(chapter => chapter.chapter === 2)?.missingReferences).toMatchObject({count: expect.any(Number), ids: expect.any(Array), idsTruncated: expect.any(Boolean)});
        expect(report.costs.projection?.production.calls).toBe(6);
        expect(report.costs.projection?.projected.peakNoCache).not.toBeNull();
        expect(report.calls.every(call => call.response === undefined)).toBe(true);
        expect(run.calls()).toBe(6);
        expect(await readFile(join(run.root, "manifest.json"), "utf8")).toBe(before);
    });

    it("includes published repairs but keeps unpublished unknown calls out of the projection denominator", async () => {
        const run = await runFixture(1);
        await addAttempt(run.root, 1, 2, true);
        await addAttempt(run.root, 2, 1, false);
        const report = await reportIngest(run.root);
        expect(report.calls).toHaveLength(5);
        expect(report.costs.published.calls).toBe(4);
        expect(report.costs.unpublished.calls).toBe(1);
        expect(report.costs.unpublished.unknownOutcomeCalls).toBe(1);
        expect(report.costs.all.estimatedUsd).toBeNull();
        expect(report.costs.projection?.production.calls).toBe(4);
        expect(report.costs.projection?.production.estimatedUsd).not.toBeNull();
        expect(report.costs.projection?.byClassification["production-repair"]?.calls).toBe(1);
        expect(report.sources.chapters.map(chapter => chapter.chapter)).toEqual([1]);
        expect(report.failureCounts).toEqual({ validation: 1, "unknown-provider-outcome": 1 });
    });

    it("labels smoke runs as development without a production extrapolation", async () => {
        const run = await runFixture(1);
        const report = await reportIngest(run.root, "development");
        expect(report.calls.every(call => call.classification === "development")).toBe(true);
        expect(report.costs.projection).toBeNull();
        expect(report.costs.all.estimatedUsd).not.toBeNull();
    });

    it("separates provider reasoning from non-reasoning output in each call and stage", async () => {
        const run = await runFixture(1);
        for (const [stage, reasoning] of [["material", 0], ["integration", 10], ["review", 40]] as const) {
            const path = join(run.root, "ch01", "round-1", stage, "attempt-1", "response.json");
            const saved = await readJson(path) as ModelResponse;
            await writeJson(path, { ...saved, raw: { usage: { completion_tokens: 50, completion_tokens_details: { reasoning_tokens: reasoning } } } });
        }
        const report = await reportIngest(run.root);
        expect(report.calls.find(call => call.stage === "review")).toMatchObject({ reasoningTokens: 40, contentOutputTokens: 10 });
        expect(report.tokensByStage.review).toMatchObject({ outputTokens: 50, reasoningTokens: 40, contentOutputTokens: 10, unknownSplitCalls: 0 });
        expect(report.tokensByStage.material).toMatchObject({ reasoningTokens: 0, contentOutputTokens: 50, unknownSplitCalls: 0 });
    });

    it("keeps missing and inconsistent reasoning details unknown, including incomplete stage totals", async () => {
        const run = await runFixture(2);
        for (const [stage, total, reasoning] of [["material", 50, 20], ["integration", 50, 60], ["review", 55, 10]] as const) {
            const path = join(run.root, "ch01", "round-1", stage, "attempt-1", "response.json");
            const saved = await readJson(path) as ModelResponse;
            await writeJson(path, { ...saved, raw: { usage: { completion_tokens: total, completion_tokens_details: { reasoning_tokens: reasoning } } } });
        }
        const report = await reportIngest(run.root);
        expect(report.calls.find(call => call.stage === "integration" && call.chapter === 1)).toMatchObject({ reasoningTokens: null, contentOutputTokens: null });
        expect(report.calls.find(call => call.stage === "review" && call.chapter === 1)).toMatchObject({ reasoningTokens: null, contentOutputTokens: null });
        expect(report.tokensByStage.material).toMatchObject({ calls: 2, knownOutputTokens: 100, knownReasoningTokens: 20, knownContentOutputTokens: 30, reasoningTokens: null, contentOutputTokens: null, unknownSplitCalls: 1 });
        expect(report.tokensByStage.review).toMatchObject({ reasoningTokens: null, contentOutputTokens: null, unknownSplitCalls: 2 });
    });

    it("rejects changed publication data instead of reporting unverifiable totals", async () => {
        const run = await runFixture(1);
        const path = join(run.root, "ch01", "dataset-v7.json");
        const snapshot = await readJson(path) as { book: { title: string } };
        snapshot.book.title = "Changed after publication";
        await writeJson(path, snapshot);
        await expect(reportIngest(run.root)).rejects.toThrow("hash mismatch");
    });
});
