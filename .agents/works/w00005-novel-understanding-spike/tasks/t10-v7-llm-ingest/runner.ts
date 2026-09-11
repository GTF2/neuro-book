import {join} from "node:path";
import {readFile} from "node:fs/promises";
import {setTimeout as delay} from "node:timers/promises";
import {z} from "zod";
import {parseDataset, type MemoryDataset, type Source} from "../t07-v7-schema-gold/index.ts";
import {compileSnapshot, hash} from "./compiler.ts";
import {estimateCost} from "./cost.ts";
import {materialOrigin, reuseMaterial, type MaterialOrigin} from "./material-reuse.ts";
import {integrationSchema, materialSchema, reviewSchema, validateMaterial, validateReview, validateReviewCoverage, type AcceptedChapter, type IntegrationDraft, type MaterialDraft} from "./draft.ts";
import {makeRequest, policy, priorContext, validateKnownReferences, type PriorContext, type Stage} from "./prompts.ts";
import {ProviderError, type ModelProvider, type ModelResponse} from "./provider.ts";
import {optionalJson, readJson, withRunLock, writeJson} from "./storage.ts";

export const manifestSchema = z.strictObject({schema: z.literal("neurobook.memory.ingest.run.v1"), inputHash: z.string(), policyHash: z.string(), head: z.number().int().nonnegative(), publications: z.array(z.strictObject({chapter: z.number().int().positive(), dataset: z.string(), sha256: z.string(), accepted: z.string(), acceptedHash: z.string()}))});
export const modelResponseSchema = z.object({text: z.string(), model: z.string(), finishReason: z.string(), usage: z.object({inputTokens: z.number().int().nonnegative(), outputTokens: z.number().int().nonnegative(), cacheHitTokens: z.number().int().nonnegative().nullable(), cacheMissTokens: z.number().int().nonnegative().nullable()}).nullable(), responseId: z.string(), durationMs: z.number().nonnegative(), startedAt: z.string().optional(), raw: z.unknown().optional()});
type Manifest = z.infer<typeof manifestSchema>;
export interface RunOptions {
    root: string; book: MemoryDataset["book"]; sources: Source[]; through: number; provider: ModelProvider;
    sourceIdentity?: {archiveSha256: string; normalization: string};
    afterResponse?: (stage: Stage) => Promise<void>;
    afterSnapshot?: (chapter: number) => Promise<void>;
    progress?: (event: Record<string, unknown>) => void;
}

function errorText(error: unknown): string { return error instanceof Error ? error.message.slice(0, 16000) : "Unknown validation error"; }
export function parseAccepted(input: unknown): AcceptedChapter {
    return z.strictObject({chapter: z.number().int().positive(), material: materialSchema, integration: integrationSchema, review: reviewSchema}).parse(input);
}

export async function runIngest(options: RunOptions): Promise<{manifest: Manifest; datasetPath: string}> {
    if (!Number.isInteger(options.through) || options.through < 1 || options.through > options.sources.length) throw new Error("Invalid through chapter");
    return withRunLock(options.root, async () => {
        const inputHash = hash(JSON.stringify({book: options.book, sources: options.sources, sourceIdentity: options.sourceIdentity}));
        const policySources = await Promise.all(["draft.ts", "compiler.ts", "prompts.ts", "runner.ts", "provider.ts", "material-reuse.ts"].map(path => readFile(new URL(path, import.meta.url), "utf8")));
        const policyHash = hash(JSON.stringify({policy, sources: policySources, schemas: [materialSchema, integrationSchema, reviewSchema].map(schema => z.toJSONSchema(schema))}));
        const manifestPath = join(options.root, "manifest.json");
        const stored = await optionalJson(manifestPath);
        let manifest: Manifest = stored === null ? {schema: "neurobook.memory.ingest.run.v1", inputHash, policyHash, head: 0, publications: []} : manifestSchema.parse(stored);
        if (manifest.inputHash !== inputHash || manifest.policyHash !== policyHash) throw new Error("Run input or policy changed; select a new run directory");
        const chapters: AcceptedChapter[] = [];
        let dataset: MemoryDataset | null = null;
        for (const publication of manifest.publications) {
            if (publication.chapter !== chapters.length + 1) throw new Error("Published prefix is not consecutive");
            dataset = parseDataset(await readJson(join(options.root, publication.dataset)));
            if (hash(JSON.stringify(dataset)) !== publication.sha256) throw new Error("Published snapshot hash mismatch");
            const accepted = parseAccepted(await readJson(join(options.root, publication.accepted)));
            if (hash(JSON.stringify(accepted)) !== publication.acceptedHash) throw new Error("Published accepted candidate hash mismatch");
            chapters.push(accepted);
        }
        if (chapters.length !== manifest.head) throw new Error("Manifest head does not match publications");
        await writeJson(manifestPath, manifest);
        for (let chapter = manifest.head + 1; chapter <= options.through; chapter++) {
            const source = options.sources.find(source => source.chapterOrder === chapter);
            if (!source) throw new Error(`Missing chapter ${chapter}`);
            const context = priorContext(dataset, source);
            const chapterRoot = join(options.root, `ch${String(chapter).padStart(2, "0")}`);
            await writeJson(join(chapterRoot, "input.json"), {inputHash, policyHash, baseHead: manifest.head, source, sourceIdentity: options.sourceIdentity, context}, true);
            options.progress?.({chapter, status: "started", contextCharacters: context.characters, contextRecords: context.records.length, contextOmitted: context.omitted});
            let accepted: AcceptedChapter | null = null;
            const savedAccepted = await optionalJson(join(chapterRoot, "accepted.json"));
            if (savedAccepted !== null) accepted = parseAccepted(savedAccepted);
            let feedback: string | undefined;
            let repair: RepairSeed | undefined;
            let rounds = 0;
            for (let round = 1; accepted === null; round++) {
                const roundRoot = join(chapterRoot, `round-${round}`);
                const failed = await optionalJson(join(roundRoot, "failed.json"));
                if (failed !== null) {
                    feedback = z.object({error: z.string()}).parse(failed).error;
                    repair = await repairSeed(chapterRoot, round);
                    continue;
                }
                if (++rounds > policy.roundsPerInvocation) throw new Error(`Chapter ${chapter} exceeded automatic semantic repair rounds; inspect failures and resume`);
                try {
                    const material = repair?.origin
                        ? await reuseMaterial(chapterRoot, round, repair.origin)
                        : await stageValue("material", roundRoot, source, context, options, materialSchema, undefined, undefined, feedback, value => validateMaterial(value, source), repair?.material);
                    if (repair?.origin) options.progress?.({chapter, round, stage: "material", status: "reused", sourceRound: repair.origin.sourceRound});
                    const integration = await stageValue("integration", roundRoot, source, context, options, integrationSchema, material, undefined, feedback, value => {
                        compileSnapshot(options.book, options.sources, [...chapters, {chapter, material, integration: value, review: {judgments: [], missing: []}}], "candidate-validation");
                    }, repair?.origin ? repair.integration : undefined);
                    const review = await stageValue("review", roundRoot, source, context, options, reviewSchema, material, integration, undefined, value => validateReviewCoverage(material, integration, value));
                    validateReview(material, integration, review);
                    const candidate = {chapter, material, integration, review};
                    compileSnapshot(options.book, options.sources, [...chapters, candidate]);
                    accepted = candidate;
                    await writeJson(join(chapterRoot, "accepted.json"), accepted, true);
                } catch (error) {
                    if (error instanceof ProviderError && !error.retryable) throw error;
                    if (error instanceof SimulatedInterruption) throw error;
                    if (error instanceof StageAttemptsExhausted) throw error;
                    feedback = errorText(error);
                    await writeJson(join(roundRoot, "failed.json"), {error: feedback}, true);
                    repair = await repairSeed(chapterRoot, round);
                    options.progress?.({chapter, round, status: "repair", error: feedback});
                }
            }
            if (accepted.chapter !== chapter) throw new Error("Accepted chapter mismatch");
            validateKnownReferences(accepted.integration, context);
            dataset = compileSnapshot(options.book, options.sources, [...chapters, accepted]);
            const relativeDataset = `ch${String(chapter).padStart(2, "0")}/dataset-v7.json`;
            await writeJson(join(options.root, relativeDataset), dataset, true);
            await options.afterSnapshot?.(chapter);
            const publication = {chapter, dataset: relativeDataset, sha256: hash(JSON.stringify(dataset)), accepted: `ch${String(chapter).padStart(2, "0")}/accepted.json`, acceptedHash: hash(JSON.stringify(accepted))};
            manifest = {...manifest, head: chapter, publications: [...manifest.publications, publication]};
            await writeJson(manifestPath, manifest);
            chapters.push(accepted);
            await writeJson(join(options.root, "dataset-v7.json"), dataset);
            options.progress?.({chapter, status: "published", records: dataset.nodes.length});
        }
        if (dataset) await writeJson(join(options.root, "dataset-v7.json"), dataset);
        return {manifest, datasetPath: join(options.root, "dataset-v7.json")};
    });
}

export class SimulatedInterruption extends Error {}
class StageAttemptsExhausted extends Error {}

interface RepairSeed {material: MaterialDraft; integration?: IntegrationDraft; origin?: MaterialOrigin}
async function repairSeed(chapterRoot: string, round: number): Promise<RepairSeed | undefined> {
    const root = join(chapterRoot, `round-${round}`);
    const material = materialSchema.safeParse(await optionalJson(join(root, "material", "accepted.json")));
    if (!material.success) return undefined;
    const integration = integrationSchema.safeParse(await optionalJson(join(root, "integration", "accepted.json")));
    const review = reviewSchema.safeParse(await optionalJson(join(root, "review", "accepted.json")));
    if (!integration.success || !review.success) return {material: material.data};
    validateReviewCoverage(material.data, integration.data, review.data);
    const reusable = review.data.missing.every(item => item.stage === "integration")
        && review.data.judgments.every(item => !item.id.startsWith("material:") || item.verdict === "passed");
    return {material: material.data, ...(reusable ? {integration: integration.data, origin: await materialOrigin(chapterRoot, round)} : {})};
}

async function stageValue<T>(stage: Stage, roundRoot: string, source: Source, context: PriorContext, options: RunOptions, schema: z.ZodType<T>, material?: MaterialDraft, integration?: IntegrationDraft, feedback?: string, validate?: (value: T) => void, initialCandidate?: unknown): Promise<T> {
    const root = join(roundRoot, stage);
    const successful = await optionalJson(join(root, "accepted.json"));
    if (successful !== null) return schema.parse(successful);
    let localFeedback = feedback;
    let priorCandidate: unknown = initialCandidate;
    let maxTokens = policy.stages[stage].maxTokens;
    let attempts = 0;
    for (let attempt = 1; ; attempt++) {
        const attemptRoot = join(root, `attempt-${attempt}`);
        const failed = await optionalJson(join(attemptRoot, "failed.json"));
        if (failed !== null) {
            const failure = z.object({message: z.string(), nextMaxTokens: z.number().optional()}).parse(failed);
            localFeedback = failure.message;
            if (failure.nextMaxTokens !== undefined) maxTokens = failure.nextMaxTokens;
            const candidate = await optionalJson(join(attemptRoot, "candidate.json"));
            const parsed = candidate === null ? await optionalJson(join(attemptRoot, "parsed.json")) : null;
            if (candidate !== null) priorCandidate = z.object({value: z.unknown()}).parse(candidate).value;
            else if (parsed !== null) priorCandidate = schema.parse(parsed);
            continue;
        }
        if (++attempts > policy.attemptsPerStage) throw new StageAttemptsExhausted(`${stage} exceeded automatic attempts; resume to continue this stage. Last error: ${localFeedback ?? "unknown"}`);
        const request = {...makeRequest(stage, source, context, material, integration, localFeedback, priorCandidate), maxTokens, timeoutMs: Math.max(policy.timeoutMs, Math.ceil(maxTokens / policy.timeoutTokensPerSecond) * 1000 + 60000)};
        const pending = await optionalJson(join(attemptRoot, "request.json"));
        const storedResponse = await optionalJson(join(attemptRoot, "response.json"));
        const startedAt = new Date().toISOString();
        let response: ModelResponse | null = null;
        if (pending !== null && storedResponse === null) {
            localFeedback = "Request persisted but response absent on recovery";
            await writeJson(join(attemptRoot, "failed.json"), {stage, chapter: source.chapterOrder, attempt, startedAt, category: "unknown-provider-outcome", message: localFeedback, cost: estimateCost(null, startedAt)}, true);
            continue;
        }
        try {
            if (storedResponse !== null) {
                const requestRecord = z.object({requestHash: z.string()}).parse(pending);
                if (requestRecord.requestHash !== hash(JSON.stringify(request))) throw new Error("Saved response request differs from the current stage input");
                response = modelResponseSchema.parse(storedResponse);
            }
            else {
                await writeJson(join(attemptRoot, "request.json"), {stage, chapter: source.chapterOrder, attempt, startedAt, request, requestHash: hash(JSON.stringify(request))}, true);
                options.progress?.({chapter: source.chapterOrder, stage, attempt, status: "requested", maxTokens, timeoutMs: request.timeoutMs});
                response = await options.provider(request);
                await writeJson(join(attemptRoot, "response.json"), response, true);
                await options.afterResponse?.(stage);
            }
            if (response.finishReason !== "stop" || !response.text.trim()) throw new Error("Provider response incomplete");
            priorCandidate = JSON.parse(response.text);
            await writeJson(join(attemptRoot, "candidate.json"), {value: priorCandidate}, true);
            const value = schema.parse(priorCandidate);
            await writeJson(join(attemptRoot, "parsed.json"), value, true);
            if (stage !== "material") validateKnownReferences(value, context);
            validate?.(value);
            await writeJson(join(attemptRoot, "stats.json"), {stage, chapter: source.chapterOrder, attempt, status: "accepted", startedAt: response.startedAt ?? startedAt, model: response.model, durationMs: response.durationMs, usage: response.usage, cost: estimateCost(response, response.startedAt ?? startedAt)}, true);
            await writeJson(join(root, "accepted.json"), value, true);
            options.progress?.({chapter: source.chapterOrder, stage, attempt, status: "accepted", durationMs: response.durationMs, usage: response.usage});
            return value;
        } catch (error) {
            if (error instanceof SimulatedInterruption) throw error;
            if (error instanceof ProviderError && error.response) {
                response = error.response;
                await writeJson(join(attemptRoot, "response.json"), response, true);
            }
            const message = errorText(error);
            if (response?.finishReason === "length") maxTokens = Math.min(policy.maxRepairTokens, maxTokens * 2);
            await writeJson(join(attemptRoot, "failed.json"), {stage, chapter: source.chapterOrder, attempt, startedAt, category: error instanceof ProviderError ? error.category : response?.finishReason === "length" ? "capacity" : "validation", message, nextMaxTokens: maxTokens, cost: estimateCost(response, response?.startedAt ?? startedAt), ...(error instanceof ProviderError ? {status: error.status, retryable: error.retryable, raw: error.raw, durationMs: error.durationMs} : {})}, true);
            if (error instanceof ProviderError && !error.retryable) throw error;
            localFeedback = message;
            options.progress?.({chapter: source.chapterOrder, stage, attempt, status: "retry", error: message});
            if (error instanceof ProviderError && error.retryable) await delay(Math.min(4000, 500 * 2 ** Math.min(attempt - 1, 3)));
        }
    }
}
