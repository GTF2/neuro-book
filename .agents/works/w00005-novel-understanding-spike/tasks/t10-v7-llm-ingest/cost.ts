import type { ModelResponse } from "./provider.ts";

export type CallClassification = "production-accepted" | "production-repair" | "development";
export interface CostCall {
    chapter: number;
    stage: string;
    classification: CallClassification;
    startedAt: string;
    response: ModelResponse | null;
}
export interface ChapterSize { chapter: number; characters: number }

const priceSource = "https://api-docs.deepseek.com/quick_start/pricing";
const priceDate = "2026-09-10";
const prices = {
    peak: { hit: 0.006, miss: 0.3, output: 1.2 },
    offpeak: { hit: 0.003, miss: 0.15, output: 0.6 },
};
type Rates = typeof prices.peak;

function pricePeriod(startedAt: string): keyof typeof prices {
    const time = new Date(startedAt);
    if (!Number.isFinite(time.getTime())) throw new Error("Cost estimate requires a valid request start time");
    const weekday = time.getUTCDay(), hour = time.getUTCHours();
    return weekday >= 1 && weekday <= 5 && ((hour >= 1 && hour < 4) || (hour >= 6 && hour < 10)) ? "peak" : "offpeak";
}

function inputRange(usage: NonNullable<ModelResponse["usage"]>, rates: Rates) {
    const { inputTokens, outputTokens, cacheHitTokens, cacheMissTokens } = usage;
    if (![inputTokens, outputTokens].every(tokens => Number.isSafeInteger(tokens) && tokens >= 0)
        || [cacheHitTokens, cacheMissTokens].some(tokens => tokens !== null && (!Number.isSafeInteger(tokens) || tokens < 0 || tokens > inputTokens))) {
        throw new Error("Cost estimate received invalid token usage");
    }
    const splitValid = (cacheHitTokens ?? 0) + (cacheMissTokens ?? 0) <= inputTokens;
    const knownHit = splitValid ? cacheHitTokens ?? 0 : 0;
    const knownMiss = splitValid ? cacheMissTokens ?? 0 : 0;
    const unknown = inputTokens - knownHit - knownMiss;
    const known = knownHit * rates.hit + knownMiss * rates.miss + outputTokens * rates.output;
    const exact = splitValid && cacheHitTokens !== null && cacheMissTokens !== null && unknown === 0;
    return { minimumUsd: (known + unknown * rates.hit) / 1_000_000, maximumUsd: (known + unknown * rates.miss) / 1_000_000, exact, splitValid };
}

/** Estimates select request-start UTC rates; a request spanning a price boundary is still approximate. */
export function estimateCost(response: ModelResponse | null, startedAt: string) {
    const period = pricePeriod(startedAt);
    const supportedModel = response?.model === "deepseek-flash";
    const usage = supportedModel ? response.usage : null;
    const range = usage ? inputRange(usage, prices[period]) : null;
    return {
        estimatedUsd: range?.exact ? range.minimumUsd : null,
        minimumUsd: range?.minimumUsd ?? 0,
        maximumUsd: range?.maximumUsd ?? null,
        unknownOutcome: response === null,
        unknownUsage: response?.usage == null,
        supportedModel: response === null ? null : supportedModel,
        cacheSplitKnown: range?.exact ?? false,
        cacheSplitValid: range?.splitValid ?? null,
        pricePeriod: period, ratesPerMillion: prices[period],
        priceSource, priceDate, billingExact: false,
    };
}

export function summarizeCallCosts(calls: readonly CostCall[]) {
    let inputTokens = 0, outputTokens = 0, cacheHitTokens = 0, cacheMissTokens = 0;
    let knownEstimatedUsd = 0, minimumUsd = 0, maximumUsd: number | null = 0;
    let unknownUsageCalls = 0, unknownOutcomeCalls = 0, unknownCacheSplitCalls = 0, unsupportedModelCalls = 0;
    for (const call of calls) {
        const estimate = estimateCost(call.response, call.startedAt);
        const usage = call.response?.usage;
        if (usage) {
            inputTokens += usage.inputTokens;
            outputTokens += usage.outputTokens;
            cacheHitTokens += usage.cacheHitTokens ?? 0;
            cacheMissTokens += usage.cacheMissTokens ?? 0;
        } else unknownUsageCalls++;
        if (estimate.unknownOutcome) unknownOutcomeCalls++;
        if (!estimate.cacheSplitKnown) unknownCacheSplitCalls++;
        if (estimate.supportedModel === false) unsupportedModelCalls++;
        knownEstimatedUsd += estimate.estimatedUsd ?? 0;
        minimumUsd += estimate.minimumUsd;
        maximumUsd = maximumUsd !== null && estimate.maximumUsd !== null ? maximumUsd + estimate.maximumUsd : null;
    }
    return {
        calls: calls.length, inputTokens, outputTokens, cacheHitTokens, cacheMissTokens,
        unknownUsageCalls, unknownOutcomeCalls, unknownCacheSplitCalls, unsupportedModelCalls,
        knownEstimatedUsd, minimumUsd, maximumUsd,
        estimatedUsd: unknownCacheSplitCalls === 0 ? knownEstimatedUsd : null,
    };
}

function scenario(calls: readonly CostCall[], rates: Rates, inputPolicy: "measured" | "miss", outputMultiplier = 1) {
    if (calls.length === 0) return null;
    let minimumUsd = 0, maximumUsd = 0;
    for (const call of calls) {
        const usage = call.response?.usage;
        if (!usage || call.response?.model !== "deepseek-flash") return null;
        const adjusted = { ...usage, outputTokens: usage.outputTokens * outputMultiplier };
        if (inputPolicy === "miss") {
            const price = (usage.inputTokens * rates.miss + adjusted.outputTokens * rates.output) / 1_000_000;
            minimumUsd += price;
            maximumUsd += price;
        } else {
            const range = inputRange(adjusted, rates);
            minimumUsd += range.minimumUsd;
            maximumUsd += range.maximumUsd;
        }
    }
    return { minimumUsd, maximumUsd };
}

/** The caller classifies attempts explicitly; a successful response may still be a development experiment. */
export function summarizeCosts(input: { calls: readonly CostCall[]; chapters: readonly ChapterSize[]; targetCharacters?: number }) {
    const targetCharacters = input.targetCharacters ?? 10_000_000;
    if (!Number.isSafeInteger(targetCharacters) || targetCharacters <= 0 || input.chapters.length === 0
        || input.chapters.some(chapter => !Number.isSafeInteger(chapter.chapter) || chapter.chapter <= 0 || !Number.isSafeInteger(chapter.characters) || chapter.characters <= 0)
        || new Set(input.chapters.map(chapter => chapter.chapter)).size !== input.chapters.length) {
        throw new Error("Cost projection requires distinct chapters and positive character counts");
    }
    const chapterIds = new Set(input.chapters.map(chapter => chapter.chapter));
    const productionCalls = input.calls.filter(call => call.classification !== "development");
    if (productionCalls.some(call => !chapterIds.has(call.chapter))) throw new Error("Production call chapter has no measured character count");
    const production = summarizeCallCosts(productionCalls);
    const characters = input.chapters.reduce((sum, chapter) => sum + chapter.characters, 0);
    const multiplier = targetCharacters / characters;
    const scale = (range: { minimumUsd: number; maximumUsd: number } | null) => range
        ? { minimumUsd: range.minimumUsd * multiplier, maximumUsd: range.maximumUsd * multiplier } : null;
    const groups = (values: string[], key: "stage" | "classification") => Object.fromEntries(values.map(value => [value, summarizeCallCosts(input.calls.filter(call => call[key] === value))]));
    const orderedChapters = [...input.chapters].sort((left, right) => left.chapter - right.chapter);
    const width = Math.min(5, Math.floor(orderedChapters.length / 2));
    const window = (chapters: ChapterSize[]) => {
        const ids = new Set(chapters.map(chapter => chapter.chapter));
        const total = summarizeCallCosts(productionCalls.filter(call => ids.has(call.chapter)));
        const count = chapters.reduce((sum, chapter) => sum + chapter.characters, 0);
        return { chapters: chapters.map(chapter => chapter.chapter), inputTokensPerCharacter: total.unknownUsageCalls === 0 ? total.inputTokens / count : null };
    };
    const first = width > 0 ? window(orderedChapters.slice(0, width)) : null;
    const last = width > 0 ? window(orderedChapters.slice(-width)) : null;
    return {
        schema: "neurobook.memory.ingest-cost.v1", characters, targetCharacters,
        characterUnit: "Unicode code points in source paragraphs, without inserted separators",
        production,
        byClassification: groups(["production-accepted", "production-repair", "development"], "classification"),
        byStage: groups([...new Set(input.calls.map(call => call.stage))].sort(), "stage"),
        perMillionCharacters: {
            inputTokens: production.unknownUsageCalls === 0 ? production.inputTokens * 1_000_000 / characters : null,
            outputTokens: production.unknownUsageCalls === 0 ? production.outputTokens * 1_000_000 / characters : null,
        },
        projected: {
            observedPeriods: { minimumUsd: production.minimumUsd * multiplier, maximumUsd: production.maximumUsd === null ? null : production.maximumUsd * multiplier },
            offpeakMeasuredCache: scale(scenario(productionCalls, prices.offpeak, "measured")),
            offpeakNoCache: scale(scenario(productionCalls, prices.offpeak, "miss")),
            peakNoCache: scale(scenario(productionCalls, prices.peak, "miss")),
            peakNoCacheDoubleOutput: scale(scenario(productionCalls, prices.peak, "miss", 2)),
            peakNoCacheDoubleWork: scale(scenario(productionCalls, { hit: prices.peak.hit * 2, miss: prices.peak.miss * 2, output: prices.peak.output * 2 }, "miss")),
        },
        contextGrowth: {
            first, last,
            ratio: first?.inputTokensPerCharacter && last?.inputTokensPerCharacter !== null && last?.inputTokensPerCharacter !== undefined
                ? last.inputTokensPerCharacter / first.inputTokensPerCharacter : null,
        },
        assumptions: ["Linear extrapolation requires bounded retrieval context and local summary updates", "Twenty chapters do not establish long-book quality, retrieval recall or storage performance", "Unknown provider outcomes may have been billed and are excluded from exact totals"],
        priceSource, priceDate, billingExact: false,
    };
}
