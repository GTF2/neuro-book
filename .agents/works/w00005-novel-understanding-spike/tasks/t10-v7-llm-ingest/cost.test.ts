import { describe, expect, it } from "vitest";
import { estimateCost, summarizeCosts, type CostCall } from "./cost.ts";
import type { ModelResponse } from "./provider.ts";

const response: ModelResponse = {
    text: "{}", model: "deepseek-flash", finishReason: "stop", responseId: "price-test", durationMs: 1,
    usage: { inputTokens: 1_000_000, outputTokens: 1_000_000, cacheHitTokens: 200_000, cacheMissTokens: 800_000 },
};
const offpeak = "2026-09-10T00:59:59Z";

describe("published DeepSeek Flash cost estimates", () => {
    it("applies weekday UTC peak boundaries and weekend offpeak rates", () => {
        expect(estimateCost(response, offpeak).estimatedUsd).toBeCloseTo(0.7206);
        for (const timestamp of ["2026-09-10T01:00:00Z", "2026-09-10T03:59:59Z", "2026-09-10T06:00:00Z", "2026-09-10T09:59:59Z"]) {
            expect(estimateCost(response, timestamp).estimatedUsd).toBeCloseTo(1.4412);
        }
        for (const timestamp of ["2026-09-10T04:00:00Z", "2026-09-10T10:00:00Z", "2026-09-12T01:00:00Z", "2026-09-13T06:00:00Z"]) {
            expect(estimateCost(response, timestamp).pricePeriod).toBe("offpeak");
        }
        expect(() => estimateCost(response, "not-a-date")).toThrow("valid request start time");
    });

    it("reports a range for unknown cache split and unbounded uncertainty for missing usage", () => {
        const unknownCache = { ...response, usage: { inputTokens: 1_000_000, outputTokens: 1_000_000, cacheHitTokens: null, cacheMissTokens: null } };
        expect(estimateCost(unknownCache, offpeak)).toMatchObject({ estimatedUsd: null, minimumUsd: 0.603, maximumUsd: 0.75, cacheSplitKnown: false, unknownUsage: false });
        expect(estimateCost(null, offpeak)).toMatchObject({ estimatedUsd: null, maximumUsd: null, unknownOutcome: true, cacheSplitKnown: false });
        expect(estimateCost({ ...response, usage: null }, offpeak)).toMatchObject({ estimatedUsd: null, maximumUsd: null, unknownOutcome: false, unknownUsage: true });
        expect(estimateCost({ ...response, model: "different-model" }, offpeak)).toMatchObject({ estimatedUsd: null, maximumUsd: null, supportedModel: false });
        expect(estimateCost({ ...response, usage: { ...unknownCache.usage, cacheHitTokens: 200_000 } }, offpeak)).toMatchObject({ estimatedUsd: null, minimumUsd: 0.603, maximumUsd: 0.7206 });
    });

    it("does not double-charge inconsistent cache fields", () => {
        const wrong = { ...response, usage: { inputTokens: 100, outputTokens: 10, cacheHitTokens: 80, cacheMissTokens: 80 } };
        expect(estimateCost(wrong, offpeak)).toMatchObject({ estimatedUsd: null, cacheSplitKnown: false, cacheSplitValid: false });
        expect(estimateCost(wrong, offpeak).maximumUsd).toBeCloseTo(0.000021);
    });

    it("separates production repair and development and projects conservative scenarios", () => {
        const calls: CostCall[] = [
            { chapter: 1, stage: "materials", classification: "production-accepted", startedAt: offpeak, response },
            { chapter: 2, stage: "integrate", classification: "production-repair", startedAt: offpeak, response },
            { chapter: 1, stage: "review", classification: "development", startedAt: offpeak, response },
        ];
        const result = summarizeCosts({ calls, chapters: [{ chapter: 1, characters: 500_000 }, { chapter: 2, characters: 500_000 }] });
        expect(result.production.calls).toBe(2);
        expect(result.byClassification.development?.calls).toBe(1);
        expect(result.production.estimatedUsd).toBeCloseTo(1.4412);
        expect(result.perMillionCharacters).toEqual({ inputTokens: 2_000_000, outputTokens: 2_000_000 });
        expect(result.projected.offpeakMeasuredCache?.minimumUsd).toBeCloseTo(14.412);
        expect(result.projected.offpeakNoCache?.maximumUsd).toBeCloseTo(15);
        expect(result.projected.peakNoCache?.maximumUsd).toBeCloseTo(30);
        expect(result.projected.peakNoCacheDoubleOutput?.maximumUsd).toBeCloseTo(54);
        expect(result.projected.peakNoCacheDoubleWork?.maximumUsd).toBeCloseTo(60);
        expect(result.contextGrowth.ratio).toBe(1);
    });

    it("does not extrapolate missing response usage as free work", () => {
        const result = summarizeCosts({ calls: [{ chapter: 1, stage: "materials", classification: "production-repair", startedAt: offpeak, response: null }], chapters: [{ chapter: 1, characters: 100 }] });
        expect(result.production.estimatedUsd).toBeNull();
        expect(result.production.unknownOutcomeCalls).toBe(1);
        expect(result.projected.offpeakNoCache).toBeNull();
        expect(result.projected.observedPeriods.maximumUsd).toBeNull();
        expect(result.perMillionCharacters.inputTokens).toBeNull();
    });
});
