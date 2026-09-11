import {mkdir, readFile, writeFile} from "node:fs/promises";
import {join} from "node:path";
import {fileURLToPath} from "node:url";
import {z} from "zod";
import {parseDataset} from "../../../t07-v7-schema-gold/index.ts";
import {compileSnapshot, hash} from "../../compiler.ts";
import {estimateCost} from "../../cost.ts";
import {integrationSchema, materialSchema, reviewSchema, validateMaterial, validateReviewCoverage} from "../../draft.ts";
import {validateKnownReferences, type Stage} from "../../prompts.ts";
import {createDeepSeekProvider, loadProviderConfig, ProviderError, type ModelRequest, type ModelResponse} from "../../provider.ts";
import {modelResponseSchema, parseAccepted} from "../../runner.ts";

const taskRoot = fileURLToPath(new URL("../../", import.meta.url));
const runRoot = join(taskRoot, "evidences/formal-002");
const outputRoot = join(taskRoot, "evidences/thinking-cost-001");
const cases: {id: string; chapter: number; stage: Stage; source: string}[] = [
    {id: "ch01-material-final", chapter: 1, stage: "material", source: "ch01/round-4/material/attempt-1"},
    {id: "ch01-integration-final", chapter: 1, stage: "integration", source: "ch01/round-4/integration/attempt-2"},
    {id: "ch01-review-final", chapter: 1, stage: "review", source: "ch01/round-4/review/attempt-1"},
    {id: "ch02-material-final", chapter: 2, stage: "material", source: "ch02/round-1/material/attempt-1"},
    {id: "ch02-integration-final", chapter: 2, stage: "integration", source: "ch02/round-1/integration/attempt-2"},
    {id: "ch02-review-final", chapter: 2, stage: "review", source: "ch02/round-1/review/attempt-1"},
    {id: "ch01-review-rejected", chapter: 1, stage: "review", source: "ch01/round-2/review/attempt-1"},
    {id: "ch01-review-rejected-attribution", chapter: 1, stage: "review", source: "ch01/round-1/review/attempt-1"},
    {id: "ch01-review-rejected-summary", chapter: 1, stage: "review", source: "ch01/round-3/review/attempt-1"},
];
const requestSchema = z.object({startedAt: z.string(), request: z.strictObject({
    model: z.literal("deepseek-flash"), system: z.string(), user: z.string(), maxTokens: z.number(), timeoutMs: z.number(), thinking: z.enum(["enabled", "disabled"]).optional(),
})});
const userSchema = z.object({chapter: z.number(), material: z.unknown().optional(), integration: z.unknown().optional(), context: z.object({
    records: z.array(z.unknown()), allowedIds: z.array(z.string()), candidates: z.number(), omitted: z.number(), characters: z.number(),
}).passthrough().optional(), priorCandidate: z.unknown().optional(), priorAttemptProblems: z.string().optional(), reviewUnits: z.array(z.string()).optional()});
const rawUsageSchema = z.object({usage: z.object({completion_tokens_details: z.object({reasoning_tokens: z.number().nonnegative()})})});

async function readOptional(path: string): Promise<unknown | null> {
    try {return JSON.parse(await readFile(path, "utf8"));}
    catch (error) {if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return null; throw error;}
}

async function writeOnce(path: string, data: unknown): Promise<void> {
    await writeFile(path, `${JSON.stringify(data, null, 2)}\n`, {encoding: "utf8", flag: "wx"});
}

function metrics(response: ModelResponse, startedAt: string) {
    const raw = rawUsageSchema.safeParse(response.raw);
    return {model: response.model, finishReason: response.finishReason, usage: response.usage, durationMs: response.durationMs,
        reasoningTokens: raw.success ? raw.data.usage.completion_tokens_details.reasoning_tokens : null,
        estimated: estimateCost(response, startedAt), offpeak: estimateCost(response, "2026-09-12T00:00:00Z"), peak: estimateCost(response, "2026-09-11T02:00:00Z")};
}

async function analyze(item: (typeof cases)[number], request: ModelRequest, response: ModelResponse, baseline: ModelResponse) {
    const user = userSchema.parse(JSON.parse(request.user));
    const dataset = parseDataset(await readOptional(join(runRoot, `ch${String(item.chapter).padStart(2, "0")}/dataset-v7.json`)));
    const source = dataset.sources.find(source => source.chapterOrder === item.chapter)!;
    let schemaPassed = false, validationPassed = false;
    let errors: unknown = null, counts: unknown = null, reviewComparison: unknown = null;
    try {
        const parsed: unknown = JSON.parse(response.text);
        if (item.stage === "material") {
            const material = materialSchema.parse(parsed);
            schemaPassed = true;
            counts = {referents: material.referents.length, disclosures: material.disclosures.length, beats: material.beats.length, mentions: material.referents.reduce((sum, item) => sum + item.mentions.length, 0)};
            validateMaterial(material, source);
        } else if (item.stage === "integration") {
            const integration = integrationSchema.parse(parsed);
            schemaPassed = true;
            counts = Object.fromEntries(Object.entries(integration).map(([key, value]) => [key, value.length]));
            validateKnownReferences(integration, {records: [], allowedIds: user.context?.allowedIds ?? [], candidates: user.context?.candidates ?? 0, omitted: user.context?.omitted ?? 0, characters: user.context?.characters ?? 0});
            const previous = [];
            for (let chapter = 1; chapter < item.chapter; chapter++) previous.push(parseAccepted(await readOptional(join(runRoot, `ch${String(chapter).padStart(2, "0")}/accepted.json`))));
            const compiled = compileSnapshot(dataset.book, dataset.sources, [...previous, {chapter: item.chapter, material: materialSchema.parse(user.material), integration, review: {judgments: [], missing: []}}], "candidate-validation");
            counts = {draft: counts, compiledNodes: compiled.nodes.length};
        } else {
            const review = reviewSchema.parse(parsed), original = reviewSchema.parse(JSON.parse(baseline.text));
            schemaPassed = true;
            counts = {judgments: review.judgments.length, rejected: review.judgments.filter(item => item.verdict === "rejected").length, missing: review.missing.length};
            const originalById = new Map(original.judgments.map(judgment => [judgment.id, judgment]));
            reviewComparison = {
                changedVerdicts: review.judgments.filter(judgment => originalById.get(judgment.id)?.verdict !== judgment.verdict).map(judgment => ({...judgment, original: originalById.get(judgment.id) ?? null})),
                rejected: review.judgments.filter(judgment => judgment.verdict === "rejected"), missing: review.missing,
                originalRejected: original.judgments.filter(judgment => judgment.verdict === "rejected"), originalMissing: original.missing,
            };
            validateReviewCoverage(materialSchema.parse(user.material), integrationSchema.parse(user.integration), review);
        }
        validationPassed = true;
    } catch (error) {errors = error instanceof z.ZodError ? error.issues : error instanceof Error ? error.message : String(error);}
    return {schemaPassed, validationPassed, validationMeaning: item.stage === "review" ? "Complete judgment coverage; rejected judgments are retained, not treated as validation errors" : "Deterministic candidate validation only; semantic quality is not established", counts, errors, reviewComparison};
}

async function runCase(item: (typeof cases)[number], configPath: string | undefined) {
    const output = join(outputRoot, item.id);
    await mkdir(output, {recursive: true});
    const original = requestSchema.parse(await readOptional(join(runRoot, item.source, "request.json")));
    const baseline = modelResponseSchema.parse(await readOptional(join(runRoot, item.source, "response.json")));
    const request: ModelRequest = {...original.request, thinking: "disabled"};
    const sourceRequestHash = hash(JSON.stringify(original.request));
    const prior = await readOptional(join(output, "request.json"));
    if (prior !== null && z.object({sourceRequestHash: z.string(), request: requestSchema.shape.request}).parse(prior).sourceRequestHash !== sourceRequestHash) throw new Error(`Source request changed for ${item.id}`);
    let responseValue = await readOptional(join(output, "response.json"));
    if (responseValue === null) {
        if (prior !== null) throw new Error(`Prior request has no saved response for ${item.id}; outcome is unknown, use a separately identified retry`);
        if (!configPath) throw new Error("New model requests require --config-path");
        const provider = createDeepSeekProvider(await loadProviderConfig({configPath}));
        await writeOnce(join(output, "request.json"), {schema: "neurobook.thinking-cost.request.v1", id: item.id, source: `formal-002/${item.source}`, sourceRequestHash, baselineResponseHash: hash(JSON.stringify(baseline)), classification: "development", onlyChangedParameter: "thinking", originalRequest: original.request, request, startedAt: new Date().toISOString()});
        console.log(JSON.stringify({id: item.id, event: "request-started"}));
        try {
            responseValue = await provider(request);
            await writeOnce(join(output, "response.json"), responseValue);
        } catch (error) {
            if (error instanceof ProviderError) {
                if (error.response) await writeOnce(join(output, "response.json"), error.response);
                await writeOnce(join(output, "failure.json"), {category: error.category, status: error.status, retryable: error.retryable, message: error.message, startedAt: error.startedAt, durationMs: error.durationMs, raw: error.raw});
            }
            throw error;
        }
    }
    const response = modelResponseSchema.parse(responseValue);
    const audit = z.object({startedAt: z.string()}).parse(await readOptional(join(output, "request.json")));
    const user = userSchema.parse(JSON.parse(request.user));
    const result = {id: item.id, source: item.source, stage: item.stage, chapter: item.chapter, sourceRequestHash,
        inputCaveats: {priorCandidate: user.priorCandidate !== undefined, priorAttemptProblems: user.priorAttemptProblems !== undefined},
        baseline: metrics(baseline, original.startedAt), disabled: metrics(response, response.startedAt ?? audit.startedAt),
        validation: await analyze(item, request, response, baseline)};
    const old = await readOptional(join(output, "analysis.json"));
    if (old === null) await writeOnce(join(output, "analysis.json"), result);
    console.log(JSON.stringify({id: item.id, event: "analyzed", outputTokens: response.usage?.outputTokens, ...result.validation}));
    return result;
}

const args = process.argv.slice(2);
if (args.length !== 0 && (args.length !== 2 || args[0] !== "--config-path" || !args[1])) throw new Error("Usage: node --import tsx experiments/thinking-cost/run.ts [--config-path PATH]");
const results = await Promise.allSettled(cases.map(item => runCase(item, args[1])));
for (let index = 0; index < results.length; index++) {
    const result = results[index]!;
    if (result.status === "rejected") {console.error(JSON.stringify({id: cases[index]!.id, error: result.reason instanceof Error ? result.reason.message : String(result.reason)})); process.exitCode = 1;}
}
await mkdir(outputRoot, {recursive: true});
const summaryPath = join(outputRoot, `comparison-${cases.length}.json`);
if (await readOptional(summaryPath) === null) await writeOnce(summaryPath, {schema: "neurobook.thinking-cost.comparison.v1", classification: "development", cases: results.flatMap(result => result.status === "fulfilled" ? [result.value] : []), limitations: ["Same-input stage comparison, not an end-to-end pipeline run", "Some successful source requests contain enabled-thinking prior candidates and repair feedback", "A/B deterministic validity does not establish semantic correctness", "Review differences require independent source inspection; the baseline is not ground truth"]});
