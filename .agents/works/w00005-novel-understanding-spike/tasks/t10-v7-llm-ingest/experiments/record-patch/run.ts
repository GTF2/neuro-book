import assert from "node:assert/strict";
import {mkdir, readFile, writeFile} from "node:fs/promises";
import {join} from "node:path";
import {fileURLToPath} from "node:url";
import {parseArgs} from "node:util";
import {z} from "zod";
import {parseDataset, sourceSchema} from "../../../t07-v7-schema-gold/index.ts";
import {compileSnapshot, hash} from "../../compiler.ts";
import {estimateCost} from "../../cost.ts";
import {integrationSchema, materialSchema, validateMaterial} from "../../draft.ts";
import {priorContext, validateKnownReferences} from "../../prompts.ts";
import {createDeepSeekProvider, loadProviderConfig, ProviderError, type ModelRequest, type ModelResponse} from "../../provider.ts";
import {modelResponseSchema, parseAccepted} from "../../runner.ts";
import {applyRecordPatch, patchSchema, type RepairStage} from "../../record-patch.ts";

const taskRoot = fileURLToPath(new URL("../../", import.meta.url));
const runRoot = join(taskRoot, "evidences/formal-003");
const outputRoot = join(taskRoot, "evidences/record-patch-001");
const args = parseArgs({options: {"config-path": {type: "string"}}});
const read = async (path: string): Promise<unknown> => JSON.parse(await readFile(path, "utf8"));
async function optional(path: string): Promise<unknown | null> {
    try {return await read(path);}
    catch (error) {if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return null; throw error;}
}
async function save(path: string, value: unknown) {
    await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, {flag: "wx"});
}
const requestSchema = z.object({startedAt: z.string(), request: z.strictObject({
    model: z.literal("deepseek-flash"), system: z.string(), user: z.string(), maxTokens: z.number(), timeoutMs: z.number(), thinking: z.enum(["enabled", "disabled"]).optional(),
})});
const userSchema = z.object({priorCandidate: z.unknown(), priorAttemptProblems: z.string(), material: z.unknown().optional(), paragraphs: z.unknown(), context: z.unknown().optional()}).passthrough();
const prefix = parseDataset(await read(join(runRoot, "ch03/dataset-v7.json")));
const input = z.object({source: sourceSchema, context: z.unknown()}).parse(await read(join(runRoot, "ch04/input.json")));
const context = priorContext(prefix, input.source);
assert.deepEqual(context, input.context);
const accepted = await Promise.all([1, 2, 3].map(async chapter => parseAccepted(await read(join(runRoot, `ch0${chapter}/accepted.json`)))));
const provider = args.values["config-path"] ? createDeepSeekProvider(await loadProviderConfig({configPath: args.values["config-path"]})) : null;
const cases: {id: string; stage: RepairStage; source: string}[] = [
    {id: "material-enum", stage: "material", source: "ch04/round-1/material/attempt-2"},
    {id: "integration-identity-id", stage: "integration", source: "ch04/round-2/integration/attempt-4"},
    {id: "integration-role-names", stage: "integration", source: "ch04/round-5/integration/attempt-4"},
    {id: "integration-availability", stage: "integration", source: "ch04/round-1/integration/attempt-2"},
];

function validate(stage: RepairStage, candidate: unknown, material: unknown) {
    try {
        if (stage === "material") validateMaterial(materialSchema.parse(candidate), input.source);
        else {
            const integration = integrationSchema.parse(candidate);
            validateKnownReferences(integration, context);
            compileSnapshot(prefix.book, [...prefix.sources, input.source], [...accepted, {chapter: 4, material: materialSchema.parse(material), integration, review: {judgments: [], missing: []}}], "candidate-validation");
        }
        return {passed: true, error: null};
    } catch (error) {return {passed: false, error: error instanceof Error ? error.message : String(error)};}
}

function metrics(response: ModelResponse, startedAt: string) {
    const split = z.object({usage: z.object({completion_tokens_details: z.object({reasoning_tokens: z.number().nonnegative()})})}).safeParse(response.raw);
    return {usage: response.usage, durationMs: response.durationMs,
        reasoningTokens: split.success ? split.data.usage.completion_tokens_details.reasoning_tokens : null,
        cost: estimateCost(response, response.startedAt ?? startedAt),
        offpeakAllMissUsd: response.model === "deepseek-flash" && response.usage ? (response.usage.inputTokens * 0.15 + response.usage.outputTokens * 0.6) / 1_000_000 : null};
}

async function runCase(item: (typeof cases)[number]) {
    const root = join(outputRoot, item.id);
    await mkdir(root, {recursive: true});
    const original = requestSchema.parse(await read(join(runRoot, item.source, "request.json")));
    const baseline = modelResponseSchema.parse(await read(join(runRoot, item.source, "response.json")));
    const user = userSchema.parse(JSON.parse(original.request.user));
    assert.deepEqual(user.paragraphs, input.source.paragraphs.map((text, index) => ({paragraph: index + 1, text})));
    if (item.stage === "integration") assert.deepEqual(user.context, context);
    assert.notEqual(original.request.thinking, "disabled");
    const delimiter = "JSON Schema:\n";
    const parts = original.request.system.split(delimiter);
    assert.equal(parts.length, 2);
    const oldInstruction = "仍输出完整候选，不输出补丁或只输出变更项";
    assert.equal(parts[0]!.split(oldInstruction).length, 2);
    const body = parts[0]!.replace(oldInstruction, "仅输出相关记录的完整替换，未修改记录由程序原样保留");
    const schema = item.stage === "material" ? materialSchema : integrationSchema;
    const request: ModelRequest = {...original.request, thinking: "enabled",
        system: `${body}\n本实验只做结构修复。输出replacements，每项按collection与record.id替换priorCandidate中一条已有记录。不能新增、删除、改名；record必须包含该记录全部字段。只修改错误和受影响依赖，保留无关内容。candidateContract是完整候选的字段合同，补丁合成后仍按该合同及全部引用/时间规则校验。不要通过删除证据或伪造语义来通过。\n${delimiter}${JSON.stringify(z.toJSONSchema(patchSchema(item.stage)))}`,
        user: JSON.stringify({...user, candidateContract: z.toJSONSchema(schema)})};
    const requestHash = hash(JSON.stringify(request));
    const prior = await optional(join(root, "request.json"));
    if (prior !== null) assert.equal(z.object({requestHash: z.string()}).parse(prior).requestHash, requestHash, "Experiment request changed; choose a new run identity");
    let responseValue = await optional(join(root, "response.json"));
    if (responseValue === null) {
        assert.equal(prior, null, "Saved request has no response; outcome unknown, do not resend");
        assert(provider, "New calls require --config-path");
        await save(join(root, "request.json"), {schema: "neurobook.record-patch.request.v1", classification: "development", source: item.source,
            sourceRequestHash: hash(JSON.stringify(original.request)), baselineResponseHash: hash(JSON.stringify(baseline)), requestHash, startedAt: new Date().toISOString(), request});
        console.log(JSON.stringify({id: item.id, status: "requested"}));
        try {
            responseValue = await provider(request);
            await save(join(root, "response.json"), responseValue);
        } catch (error) {
            if (error instanceof ProviderError) {
                if (error.response) await save(join(root, "response.json"), error.response);
                await save(join(root, "failure.json"), {category: error.category, status: error.status, message: error.message, startedAt: error.startedAt, durationMs: error.durationMs});
            }
            throw error;
        }
    }
    const response = modelResponseSchema.parse(responseValue);
    const audit = z.object({startedAt: z.string()}).parse(await read(join(root, "request.json")));
    let changed: string[] = [], unchanged = 0;
    let validation: {passed: boolean; error: string | null};
    try {
        assert.equal(response.finishReason, "stop");
        const result = applyRecordPatch(item.stage, user.priorCandidate, JSON.parse(response.text));
        changed = result.changed;
        const base = z.record(z.string(), z.unknown()).parse(user.priorCandidate);
        for (const [collection, value] of Object.entries(base)) {
            if (collection === "gaps") {assert.deepEqual(result.candidate.gaps, value); continue;}
            const entries = z.array(z.object({id: z.string()}).passthrough()).parse(value);
            const after = z.array(z.object({id: z.string()}).passthrough()).parse(result.candidate[collection]);
            assert.equal(entries.length, after.length);
            for (const record of entries) if (!changed.includes(`${collection}/${record.id}`)) {
                assert.deepEqual(after.find(item => item.id === record.id), record);
                unchanged++;
            }
        }
        validation = validate(item.stage, result.candidate, user.material);
        if (await optional(join(root, "candidate.json")) === null) await save(join(root, "candidate.json"), result.candidate);
    } catch (error) {validation = {passed: false, error: error instanceof Error ? error.message : String(error)};}
    let baselineValidation;
    try {baselineValidation = validate(item.stage, JSON.parse(baseline.text), user.material);}
    catch (error) {baselineValidation = {passed: false, error: String(error)};}
    const result = {id: item.id, source: item.source, stage: item.stage, requestHash,
        baseline: {...metrics(baseline, original.startedAt), validation: baselineValidation},
        patch: {...metrics(response, audit.startedAt), validation, changed, unchangedRecordsVerified: unchanged},
        semanticReview: "not-performed"};
    if (await optional(join(root, "analysis.json")) === null) await save(join(root, "analysis.json"), result);
    console.log(JSON.stringify({id: item.id, status: "analyzed", passed: validation.passed, replacements: changed.length, outputTokens: response.usage?.outputTokens}));
    return result;
}

const results = await Promise.allSettled(cases.map(runCase));
const comparison = {schema: "neurobook.record-patch.comparison.v1", classification: "development",
    cases: results.flatMap(result => result.status === "fulfilled" ? [result.value] : []),
    errors: results.flatMap((result, index) => result.status === "rejected" ? [{id: cases[index]!.id, error: String(result.reason)}] : []),
    limitations: ["Single structural repair step, not end-to-end convergence or semantic quality", "No records may be deleted to game validation", "Original inputs and formal snapshots remain unchanged", "Actual-period cost and a normalized offpeak all-miss estimate are distinct"]};
if (await optional(join(outputRoot, "comparison-4.json")) === null) await save(join(outputRoot, "comparison-4.json"), comparison);
if (comparison.errors.length) process.exitCode = 1;
