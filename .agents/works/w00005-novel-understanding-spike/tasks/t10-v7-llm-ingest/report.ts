import { readFile, readdir } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import { z } from "zod";
import { parseDataset, type MemoryDataset } from "../t07-v7-schema-gold/index.ts";
import { hash } from "./compiler.ts";
import { estimateCost, summarizeCallCosts, summarizeCosts, type CostCall } from "./cost.ts";
import { integrationSchema, materialSchema, reviewSchema, type AcceptedChapter } from "./draft.ts";
import { manifestSchema, modelResponseSchema, parseAccepted } from "./runner.ts";
import { materialOrigin } from "./material-reuse.ts";

const stages = ["material", "integration", "review"] as const;
const stageSchemas = { material: materialSchema, integration: integrationSchema, review: reviewSchema };
const requestSchema = z.object({ stage: z.enum(stages), chapter: z.number().int().positive(), attempt: z.number().int().positive(), startedAt: z.string(), requestHash: z.string(), request: z.unknown() });
const failureSchema = z.object({ category: z.string().optional(), message: z.string().optional(), error: z.string().optional(), status: z.number().nullable().optional() });
const statsSchema = z.object({ status: z.literal("accepted") });
const outputUsageSchema = z.object({ usage: z.object({
    completion_tokens: z.number().int().nonnegative(),
    completion_tokens_details: z.object({ reasoning_tokens: z.number().int().nonnegative() }),
}) });
const contextAuditSchema = z.object({
    characters: z.number().optional(), records: z.array(z.unknown()).optional(), omitted: z.number().optional(),
    selection: z.object({matchedEntities: z.number().int().nonnegative(), selectedEntities: z.number().int().nonnegative(), semanticCandidates: z.number().int().nonnegative(), selectedSemanticRecords: z.number().int().nonnegative(), recordLimit: z.number().int().positive(), recordLimitReached: z.boolean(), characterLimitReached: z.boolean(), trimmedFields: z.number().int().nonnegative(), skippedBundles: z.number().int().nonnegative().optional(), matchedIdentityBundles: z.number().int().nonnegative().optional(), partialSupportRecords: z.number().int().nonnegative().optional()}).optional(),
    missingReferences: z.object({count: z.number().int().nonnegative(), ids: z.array(z.string()), idsTruncated: z.boolean()}).optional(),
});

async function readOptional(path: string): Promise<unknown | null> {
    try { return JSON.parse(await readFile(path, "utf8")); }
    catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return null;
        throw error;
    }
}

async function directories(root: string, pattern: RegExp): Promise<string[]> {
    try {
        return (await readdir(root, { withFileTypes: true })).filter(entry => entry.isDirectory() && pattern.test(entry.name)).map(entry => entry.name).sort((left, right) => left.localeCompare(right, "en", { numeric: true }));
    } catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return [];
        throw error;
    }
}

function artifactPath(root: string, path: string): string {
    const absolute = resolve(root, path);
    const within = relative(root, absolute);
    if (isAbsolute(path) || within === ".." || within.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) || isAbsolute(within)) throw new Error("Publication artifact escapes run directory");
    return absolute;
}

function sameValue(left: unknown, right: unknown): boolean { return JSON.stringify(left) === JSON.stringify(right); }

interface RecordedCall extends CostCall {
    round: number;
    attempt: number;
    artifact: string;
    status: "accepted" | "failed" | "response-saved" | "unknown-provider-outcome";
    failure: { category: string; status: number | null } | null;
}

function outputSplit(call: RecordedCall): { reasoningTokens: number | null; contentOutputTokens: number | null } {
    const usage = call.response?.usage;
    const parsed = outputUsageSchema.safeParse(call.response?.raw);
    if (!usage || !parsed.success || parsed.data.usage.completion_tokens !== usage.outputTokens
        || parsed.data.usage.completion_tokens_details.reasoning_tokens > usage.outputTokens) {
        return { reasoningTokens: null, contentOutputTokens: null };
    }
    const reasoningTokens = parsed.data.usage.completion_tokens_details.reasoning_tokens;
    // This is the provider's non-reasoning output remainder, not a separate tokenization of the JSON text.
    return { reasoningTokens, contentOutputTokens: usage.outputTokens - reasoningTokens };
}

function stageOutputTokens(calls: RecordedCall[]) {
    let knownOutputTokens = 0, knownReasoningTokens = 0, knownContentOutputTokens = 0;
    let unknownOutputCalls = 0, unknownSplitCalls = 0;
    for (const call of calls) {
        const outputTokens = call.response?.usage?.outputTokens;
        if (outputTokens === undefined) unknownOutputCalls++;
        else knownOutputTokens += outputTokens;
        const split = outputSplit(call);
        if (split.reasoningTokens === null || split.contentOutputTokens === null) unknownSplitCalls++;
        else {
            knownReasoningTokens += split.reasoningTokens;
            knownContentOutputTokens += split.contentOutputTokens;
        }
    }
    return {
        calls: calls.length, knownOutputTokens, knownReasoningTokens, knownContentOutputTokens,
        outputTokens: unknownOutputCalls === 0 ? knownOutputTokens : null,
        reasoningTokens: unknownSplitCalls === 0 ? knownReasoningTokens : null,
        contentOutputTokens: unknownSplitCalls === 0 ? knownContentOutputTokens : null,
        unknownOutputCalls, unknownSplitCalls,
    };
}

/** Read one published prefix and its attempts without advancing state or making provider calls. */
export async function reportIngest(runRoot: string, classification: "production" | "development" = "production") {
    const root = resolve(runRoot);
    const rawManifest = await readOptional(join(root, "manifest.json"));
    const manifest = manifestSchema.parse(rawManifest);
    const accepted = new Map<number, AcceptedChapter>();
    let dataset: MemoryDataset | null = null;
    for (const publication of manifest.publications) {
        if (publication.chapter !== accepted.size + 1) throw new Error("Published report prefix is not consecutive");
        const snapshot = parseDataset(await readOptional(artifactPath(root, publication.dataset)));
        const candidate = parseAccepted(await readOptional(artifactPath(root, publication.accepted)));
        if (hash(JSON.stringify(snapshot)) !== publication.sha256 || hash(JSON.stringify(candidate)) !== publication.acceptedHash) throw new Error("Publication hash mismatch while reporting");
        if (candidate.chapter !== publication.chapter || snapshot.snapshot.readAt.chapter !== publication.chapter) throw new Error("Publication chapter mismatch while reporting");
        accepted.set(publication.chapter, candidate);
        dataset = snapshot;
    }
    if (manifest.head !== accepted.size) throw new Error("Manifest head does not match report publications");
    const calls: RecordedCall[] = [];
    const materialOrigins = new Map<number, number>();
    const semanticFailures: { chapter: number; round: number }[] = [];
    const context: { chapter: number; characters: number | null; records: number | null; omitted: number | null; selection: z.infer<typeof contextAuditSchema>["selection"] | null; missingReferences: z.infer<typeof contextAuditSchema>["missingReferences"] | null }[] = [];
    for (const chapterDirectory of await directories(root, /^ch\d+$/)) {
        const chapter = Number(chapterDirectory.slice(2));
        const chapterRoot = join(root, chapterDirectory);
        const chapterInput = await readOptional(join(chapterRoot, "input.json"));
        if (chapterInput !== null) {
            const parsed = z.object({ context: contextAuditSchema }).parse(chapterInput);
            context.push({ chapter, characters: parsed.context.characters ?? null, records: parsed.context.records?.length ?? null, omitted: parsed.context.omitted ?? null, selection: parsed.context.selection ?? null, missingReferences: parsed.context.missingReferences ?? null });
        }
        for (const roundDirectory of await directories(chapterRoot, /^round-[1-9]\d*$/)) {
            const round = Number(roundDirectory.slice(6));
            const roundRoot = join(chapterRoot, roundDirectory);
            const roundFailed = await readOptional(join(roundRoot, "failed.json"));
            if (roundFailed !== null) semanticFailures.push({ chapter, round });
            const published = accepted.get(chapter);
            const stageAccepted = Object.fromEntries(await Promise.all(stages.map(async stage => [stage, await readOptional(join(roundRoot, stage, "accepted.json"))])));
            const isPublishedRound = published !== undefined && roundFailed === null && stages.every(stage => {
                const parsed = stageSchemas[stage].safeParse(stageAccepted[stage]);
                return parsed.success && sameValue(parsed.data, published[stage]);
            });
            if (isPublishedRound) {
                if (materialOrigins.has(chapter)) throw new Error("Published chapter has ambiguous accepted round");
                materialOrigins.set(chapter, (await materialOrigin(chapterRoot, round)).sourceRound);
            }
            for (const stage of stages) for (const attemptDirectory of await directories(join(roundRoot, stage), /^attempt-[1-9]\d*$/)) {
                const attempt = Number(attemptDirectory.slice(8));
                const attemptRoot = join(roundRoot, stage, attemptDirectory);
                const rawRequest = await readOptional(join(attemptRoot, "request.json"));
                if (rawRequest === null) throw new Error(`Attempt has no request audit: ${relative(root, attemptRoot)}`);
                const request = requestSchema.parse(rawRequest);
                if (request.chapter !== chapter || request.stage !== stage || request.attempt !== attempt || request.requestHash !== hash(JSON.stringify(request.request))) throw new Error("Attempt request identity mismatch while reporting");
                const rawResponse = await readOptional(join(attemptRoot, "response.json"));
                const response = rawResponse === null ? null : modelResponseSchema.parse(rawResponse);
                const rawFailure = await readOptional(join(attemptRoot, "failed.json"));
                const failure = rawFailure === null ? null : failureSchema.parse(rawFailure);
                const stats = await readOptional(join(attemptRoot, "stats.json"));
                const parsedValue = await readOptional(join(attemptRoot, "parsed.json"));
                const successful = stats !== null && statsSchema.safeParse(stats).success && rawFailure === null;
                const isPublishedCall = isPublishedRound && successful && sameValue(parsedValue, stageAccepted[stage]);
                const status = failure ? "failed" : successful ? "accepted" : response ? "response-saved" : "unknown-provider-outcome";
                calls.push({
                    chapter, round, stage, attempt, artifact: relative(root, attemptRoot).replaceAll("\\", "/"),
                    classification: classification === "development" ? "development" : isPublishedCall ? "production-accepted" : "production-repair",
                    startedAt: request.startedAt, response, status,
                    failure: failure ? { category: failure.category ?? "validation", status: failure.status ?? null } : null,
                });
            }
        }
    }
    if (classification === "production") for (const call of calls) {
        if (call.stage !== "material" || materialOrigins.get(call.chapter) !== call.round || call.status !== "accepted") continue;
        const parsed = await readOptional(join(root, call.artifact, "parsed.json"));
        if (sameValue(parsed, accepted.get(call.chapter)?.material)) call.classification = "production-accepted";
    }
    const publishedCalls = calls.filter(call => call.chapter <= manifest.head);
    if (classification === "production") for (let chapter = 1; chapter <= manifest.head; chapter++) for (const stage of stages) {
        if (publishedCalls.filter(call => call.chapter === chapter && call.stage === stage && call.classification === "production-accepted").length !== 1) throw new Error(`Published chapter ${chapter} has ambiguous or missing accepted ${stage} audit`);
    }
    if (!sameValue(rawManifest, await readOptional(join(root, "manifest.json")))) throw new Error("Run manifest advanced while reporting; retry for a consistent prefix");
    const chapters = dataset?.sources.map(source => ({ chapter: source.chapterOrder, characters: source.paragraphs.reduce((count, paragraph) => count + [...paragraph].length, 0) })) ?? [];
    const unpublishedCalls = calls.filter(call => call.chapter > manifest.head);
    const models = [...new Set(calls.flatMap(call => call.response ? [call.response.model] : []))].sort();
    return {
        schema: "neurobook.memory.ingest-report.v1", observedAt: new Date().toISOString(), runRoot: root, classification,
        inputHash: manifest.inputHash, policyHash: manifest.policyHash, publishedChapters: manifest.head,
        publicationVerified: true,
        sources: { chapters, paragraphs: dataset?.sources.reduce((sum, source) => sum + source.paragraphs.length, 0) ?? 0 },
        records: dataset ? Object.fromEntries([...new Set(dataset.nodes.map(node => node.kind))].sort().map(kind => [kind, dataset.nodes.filter(node => node.kind === kind).length])) : {},
        coverage: dataset?.coverage ?? null,
        models,
        calls: calls.map(call => ({ ...call, response: undefined, model: call.response?.model ?? null, responseId: call.response?.responseId ?? null, durationMs: call.response?.durationMs ?? null, usage: call.response?.usage ?? null, ...outputSplit(call), cost: estimateCost(call.response, call.startedAt) })),
        tokensByStage: Object.fromEntries(stages.map(stage => [stage, stageOutputTokens(calls.filter(call => call.stage === stage))])),
        costs: {
            all: summarizeCallCosts(calls),
            published: summarizeCallCosts(publishedCalls),
            unpublished: summarizeCallCosts(unpublishedCalls),
            projection: classification === "production" && chapters.length > 0 ? summarizeCosts({ calls: publishedCalls, chapters }) : null,
        },
        context, semanticFailures,
        failureCounts: Object.fromEntries([...new Set(calls.flatMap(call => call.failure ? [call.failure.category] : call.status === "unknown-provider-outcome" ? [call.status] : []))].map(category => [category, calls.filter(call => (call.failure?.category ?? call.status) === category).length])),
        limitations: ["Only published source characters form the extrapolation denominator; unpublished work is listed separately", "Output splits require provider reasoning token details; content tokens are the non-reasoning output remainder", "Structural validation and complete Beat coverage do not establish semantic extraction quality", "This read-only report does not query provider billing or make model requests"],
    };
}
