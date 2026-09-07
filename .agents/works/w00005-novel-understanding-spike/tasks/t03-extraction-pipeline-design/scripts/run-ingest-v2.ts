import {mkdir, readFile, rename, writeFile} from "node:fs/promises";
import {resolve} from "node:path";
import {resolveAgentRunRoot} from "../../../../../../packages/neuro-book-test-support/src/paths.ts";
import {findRepositoryRoot} from "../../../../../../scripts/utils/workspace-roots.ts";
import {validateGraphV6, type MemoryGraphV6, type RunLedger, type RunBudget, type StageRun, BOOK_ID} from "../../t02-novel-memory-model-design/schema-v6.ts";
import {
    MAX_ATTEMPTS,
    MAX_CHAPTERS,
    MAX_TOKENS,
    MODEL,
    PRICE,
    PROVIDER,
    RUN_ID,
    SOURCE_NORMALIZATION,
    USD_LIMIT,
    WORK,
    assembleChapter,
    buildPrompt,
    estimateKnownCost,
    loadChapters,
    parseAccepted,
    reserveUsd,
    sha256,
    type AcceptedStage,
    type LoadedChapter,
    type PromptBundle,
    type StageName,
    type Usage,
} from "./ingest-v2.ts";
import type {BeatDraft, ExtractionDraft} from "../../t02-novel-memory-model-design/schema-v6.ts";

const PURPOSE = "t03-v6-first20-official";
const RUN_SCHEMA = "nbook.v6-ingest-run/v1";
const EVIDENCE_RELATIVE = ".agents/works/w00005-novel-understanding-spike/tasks/t03-extraction-pipeline-design/evidences/v6/runs";

type Writable<T> = {-readonly [K in keyof T]: T[K]};
type LedgerState = Writable<Omit<RunLedger, "budget" | "stages">> & {budget: Writable<RunBudget>; stages: StageRun[]};
type PendingAttempt = {readonly chapter: number; readonly stage: StageName; readonly attempt: number; readonly reserveUsd: number};
type AttemptRecord = {
    readonly chapter: number;
    readonly stage: StageName;
    readonly attempt: number;
    readonly status: "pending" | "accepted" | "failed" | "interrupted";
    readonly promptFingerprint: string;
    readonly sourceSha256: string;
    readonly maxTokens: number;
    readonly startedAt: string;
    readonly finishedAt: string | null;
    readonly knownCostUsd: number;
    readonly unknownReserveUsd: number;
    readonly durationMs: number | null;
    readonly inputTokens: number | null;
    readonly outputTokens: number | null;
    readonly totalTokens: number | null;
    readonly outputSha256: string | null;
    readonly failureCategory: string | null;
    readonly parseIssues: readonly string[];
};
type AcceptedRecord = {
    readonly chapter: number;
    readonly stage: StageName;
    readonly attempt: number;
    readonly promptFingerprint: string;
    readonly parsedPath: string;
    readonly outputPath: string;
    readonly usage: Usage;
    readonly knownCostUsd: number;
};
type Manifest = {
    readonly schema: typeof RUN_SCHEMA;
    readonly runId: string;
    readonly bookId: string;
    readonly provider: string;
    readonly model: string;
    readonly sourceNormalization: string;
    readonly sourceChapters: readonly {readonly chapter: number; readonly member: string; readonly sha256: string; readonly paragraphs: number}[];
    readonly ledger: LedgerState;
    readonly attempts: readonly AttemptRecord[];
    readonly accepted: Readonly<Record<string, AcceptedRecord>>;
    readonly pending: PendingAttempt | null;
    readonly publishedChapters: readonly number[];
    readonly stopReason: string | null;
};
type Runtime = {
    readonly root: string;
    readonly runRoot: string;
    readonly evidenceRoot: string;
    manifest: Manifest;
};
type ProviderConfig = {
    models?: {providers?: Array<{
        id?: unknown;
        enabled?: unknown;
        options?: {apiKey?: unknown; baseURL?: unknown; timeoutMs?: unknown};
        models?: Array<{id?: unknown; enabled?: unknown}>;
    }>};
};
type Provider = {apiKey: string; baseUrl: string; timeoutMs: number};
type ResponseUsage = Usage & {readonly cacheHitTokens: number};

function check(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(message);
}

function arg(args: readonly string[], name: string): string | undefined {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
}

function requiredArg(args: readonly string[], name: string): string {
    const value = arg(args, name);
    check(value && !value.startsWith("--"), `missing-${name.slice(2)}`);
    return value;
}

function parseThrough(args: readonly string[]): number {
    const value = Number(arg(args, "--through") ?? "20");
    check(Number.isInteger(value) && value >= 1 && value <= MAX_CHAPTERS, "through-invalid");
    return value;
}

function now(): string {
    return new Date().toISOString();
}

function roundUsd(value: number): number {
    return Math.round(value * 1_000_000) / 1_000_000;
}

function emptyLedger(): LedgerState {
    return {
        id: RUN_ID,
        provider: PROVIDER,
        model: MODEL,
        status: "running",
        startedAt: now(),
        completedAt: null,
        totalChapters: MAX_CHAPTERS,
        completedChapters: 0,
        requests: 0,
        failures: 0,
        retries: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        durationMs: 0,
        price: {...PRICE},
        budget: {usdLimit: USD_LIMIT, knownUsd: 0, unknownReserveUsd: 0, pendingReserveUsd: 0, remainingUsd: USD_LIMIT},
        stages: [],
        stopReason: null,
    };
}

function manifestFor(chapters: readonly LoadedChapter[]): Manifest {
    return {
        schema: RUN_SCHEMA,
        runId: RUN_ID,
        bookId: BOOK_ID,
        provider: PROVIDER,
        model: MODEL,
        sourceNormalization: SOURCE_NORMALIZATION,
        sourceChapters: chapters.map((chapter) => ({chapter: chapter.chapter, member: chapter.member, sha256: chapter.sourceSha256, paragraphs: chapter.paragraphs.length})),
        ledger: emptyLedger(),
        attempts: [],
        accepted: {},
        pending: null,
        publishedChapters: [],
        stopReason: null,
    };
}

async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
    const temporary = `${path}.tmp-${process.pid}`;
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await rename(temporary, path);
}

async function readJson<T>(path: string): Promise<T> {
    return JSON.parse(await readFile(path, "utf8")) as T;
}

function updateBudget(ledger: LedgerState): void {
    ledger.budget.remainingUsd = roundUsd(ledger.budget.usdLimit - ledger.budget.knownUsd - ledger.budget.unknownReserveUsd - ledger.budget.pendingReserveUsd);
}

function stageKey(chapter: number, stage: StageName): string {
    return `ch${String(chapter).padStart(3, "0")}-${stage}`;
}

function attemptPath(runtime: Runtime, chapter: number, stage: StageName, attempt: number): string {
    return resolve(runtime.evidenceRoot, `ch${String(chapter).padStart(3, "0")}`, stage, `attempt-${attempt}`);
}

async function persist(runtime: Runtime): Promise<void> {
    updateBudget(runtime.manifest.ledger);
    const manifestPath = resolve(runtime.evidenceRoot, "manifest.json");
    await mkdir(runtime.evidenceRoot, {recursive: true});
    await writeJsonAtomic(manifestPath, runtime.manifest);
    await mkdir(runtime.runRoot, {recursive: true});
    await writeJsonAtomic(resolve(runtime.runRoot, "manifest.json"), runtime.manifest);
}

async function loadRuntime(root: string, chapters: readonly LoadedChapter[]): Promise<Runtime> {
    const runRoot = resolveAgentRunRoot(WORK, RUN_ID);
    const evidenceRoot = resolve(root, EVIDENCE_RELATIVE, RUN_ID);
    const manifestPath = resolve(evidenceRoot, "manifest.json");
    let manifest: Manifest;
    try {
        manifest = await readJson<Manifest>(manifestPath);
        check(manifest.schema === RUN_SCHEMA && manifest.runId === RUN_ID, "run-manifest-contract-mismatch");
        check(manifest.sourceChapters.length === chapters.length, "run-source-through-mismatch");
        for (const chapter of chapters) {
            const saved = manifest.sourceChapters[chapter.chapter - 1];
            check(saved?.sha256 === chapter.sourceSha256 && saved.paragraphs === chapter.paragraphs.length, `run-source-changed-${chapter.chapter}`);
        }
    } catch (error) {
        if (error instanceof Error && !error.message.includes("ENOENT")) throw error;
        manifest = manifestFor(chapters);
    }
    const runtime = {root, runRoot, evidenceRoot, manifest};
    if (runtime.manifest.pending !== null) {
        const pending = runtime.manifest.pending;
        const attempts: AttemptRecord[] = runtime.manifest.attempts.map((item): AttemptRecord => item.chapter === pending.chapter && item.stage === pending.stage && item.attempt === pending.attempt && item.status === "pending" ? {...item, status: "interrupted", finishedAt: now(), unknownReserveUsd: pending.reserveUsd, failureCategory: "process-interrupted", parseIssues: ["previous attempt had no settlement"]} : item);
        runtime.manifest = {
            ...runtime.manifest,
            pending: null,
            attempts,
            ledger: {...runtime.manifest.ledger, failures: runtime.manifest.ledger.failures + 1, budget: {...runtime.manifest.ledger.budget, pendingReserveUsd: 0, unknownReserveUsd: runtime.manifest.ledger.budget.unknownReserveUsd + pending.reserveUsd}},
        };
        await persist(runtime);
    }
    await persist(runtime);
    return runtime;
}

function readAcceptedPath(runtime: Runtime, record: AcceptedRecord): string {
    return resolve(runtime.evidenceRoot, record.parsedPath);
}

async function loadAccepted(runtime: Runtime, record: AcceptedRecord): Promise<AcceptedStage> {
    const parsed = await readJson<readonly BeatDraft[] | ExtractionDraft>(readAcceptedPath(runtime, record));
    const content = await readFile(resolve(runtime.evidenceRoot, record.outputPath), "utf8");
    return {chapter: record.chapter, stage: record.stage, attempt: record.attempt, content: content.trimEnd(), parsed, usage: record.usage, durationMs: 0, knownCostUsd: record.knownCostUsd};
}

function validUsage(value: unknown): value is ResponseUsage {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
    const item = value as Record<string, unknown>;
    return ["prompt_tokens", "completion_tokens", "total_tokens"].every((key) => typeof item[key] === "number" && Number.isFinite(item[key]) && item[key] >= 0)
        && (item.prompt_cache_hit_tokens === undefined || typeof item.prompt_cache_hit_tokens === "number" && Number.isFinite(item.prompt_cache_hit_tokens) && item.prompt_cache_hit_tokens >= 0);
}

function responseUsage(value: unknown): ResponseUsage | null {
    if (!validUsage(value)) return null;
    const item = value as Record<string, unknown>;
    return {inputTokens: item.prompt_tokens as number, outputTokens: item.completion_tokens as number, totalTokens: item.total_tokens as number, cacheHitTokens: typeof item.prompt_cache_hit_tokens === "number" ? item.prompt_cache_hit_tokens : 0};
}

function providerFromConfig(raw: unknown): Provider {
    const config = raw as ProviderConfig;
    const provider = config.models?.providers?.find((item) => item.id === PROVIDER);
    check(provider?.enabled === true, "provider-disabled");
    check(provider.models?.some((item) => item.id === MODEL && item.enabled === true), "model-disabled");
    check(typeof provider.options?.apiKey === "string" && provider.options.apiKey.length > 0, "provider-api-key-missing");
    check(typeof provider.options.baseURL === "string" && provider.options.baseURL.length > 0, "provider-base-url-missing");
    const url = new URL(provider.options.baseURL);
    check(url.protocol === "https:" && url.hostname === "api.deepseek.com" && (url.pathname === "" || url.pathname === "/") && url.username === "" && url.password === "" && url.search === "" && url.hash === "", "provider-host-mismatch");
    return {apiKey: provider.options.apiKey, baseUrl: url.origin, timeoutMs: typeof provider.options.timeoutMs === "number" && provider.options.timeoutMs > 0 ? Math.min(provider.options.timeoutMs, 180_000) : 180_000};
}

function promptFingerprint(prompt: PromptBundle, stage: StageName, maxTokens: number): string {
    return sha256(`${stage}\0${maxTokens}\0${prompt.system}\0${prompt.user}\0${prompt.sourceSha256}\0${prompt.promptVersion}`);
}

function currentStageRecord(ledger: LedgerState, chapter: number, stage: StageName): StageRun | undefined {
    return ledger.stages.find((item) => item.chapter === chapter && item.stage === stage);
}

function setStageRecord(ledger: LedgerState, stageRecord: StageRun): void {
    const index = ledger.stages.findIndex((item) => item.chapter === stageRecord.chapter && item.stage === stageRecord.stage);
    if (index < 0) ledger.stages.push(stageRecord);
    else ledger.stages[index] = stageRecord;
}

async function requestStage(provider: Provider, prompt: PromptBundle, maxTokens: number): Promise<{readonly output: string; readonly usage: ResponseUsage | null; readonly status: number; readonly finishReason: string | null; readonly durationMs: number}> {
    const started = performance.now();
    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {"Content-Type": "application/json", Authorization: `Bearer ${provider.apiKey}`},
        body: JSON.stringify({model: MODEL, messages: [{role: "system", content: prompt.system}, {role: "user", content: prompt.user}], thinking: {type: "disabled"}, stream: false, temperature: 0, response_format: {type: "text"}, max_tokens: maxTokens}),
        redirect: "error",
        signal: AbortSignal.timeout(provider.timeoutMs),
    });
    let payload: unknown = null;
    try {
        payload = await response.json();
    } catch {
        payload = null;
    }
    const object = typeof payload === "object" && payload !== null && !Array.isArray(payload) ? payload as Record<string, unknown> : {};
    const choices = Array.isArray(object.choices) ? object.choices : [];
    const choice = choices.length === 1 && typeof choices[0] === "object" && choices[0] !== null ? choices[0] as Record<string, unknown> : null;
    const message = choice?.message;
    const content = typeof message === "object" && message !== null && !Array.isArray(message) && typeof (message as Record<string, unknown>).content === "string" ? (message as Record<string, string>).content : "";
    const finishReason = typeof choice?.finish_reason === "string" ? choice.finish_reason : null;
    return {output: content, usage: responseUsage(object.usage), status: response.status, finishReason, durationMs: Math.round(performance.now() - started)};
}

async function executeStage(runtime: Runtime, provider: Provider, chapter: LoadedChapter, stage: StageName, beats: readonly BeatDraft[] | null, graph: MemoryGraphV6 | null): Promise<AcceptedStage> {
    const previous = runtime.manifest.accepted[stageKey(chapter.chapter, stage)];
    const previousValue = previous ? await loadAccepted(runtime, previous) : null;
    const repair: string[] = [];
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
        const maxTokens = attempt === 1 ? MAX_TOKENS[stage] : MAX_TOKENS[stage] * 2;
        const prompt = buildPrompt(chapter, stage, beats, graph, repair);
        const fingerprint = promptFingerprint(prompt, stage, maxTokens);
        if (previous && previous.promptFingerprint === fingerprint && previousValue) return previousValue;
        const reserve = reserveUsd(stage) + (attempt === 1 ? 0 : MAX_TOKENS[stage] * PRICE.outputPerMillion / 1_000_000);
        updateBudget(runtime.manifest.ledger);
        check(runtime.manifest.ledger.budget.knownUsd + runtime.manifest.ledger.budget.unknownReserveUsd + reserve <= USD_LIMIT, "budget-reserve-would-exceed-limit");
        const directory = attemptPath(runtime, chapter.chapter, stage, attempt);
        await mkdir(directory, {recursive: true});
        await writeFile(resolve(directory, "system.txt"), prompt.system, "utf8");
        await writeFile(resolve(directory, "user.txt"), prompt.user, "utf8");
        const startedAt = now();
        const attemptRecord: AttemptRecord = {chapter: chapter.chapter, stage, attempt, status: "pending", promptFingerprint: fingerprint, sourceSha256: chapter.sourceSha256, maxTokens, startedAt, finishedAt: null, knownCostUsd: 0, unknownReserveUsd: 0, durationMs: null, inputTokens: null, outputTokens: null, totalTokens: null, outputSha256: null, failureCategory: null, parseIssues: []};
        runtime.manifest = {...runtime.manifest, pending: {chapter: chapter.chapter, stage, attempt, reserveUsd: reserve}, attempts: [...runtime.manifest.attempts.filter((item) => !(item.chapter === chapter.chapter && item.stage === stage && item.attempt === attempt)), attemptRecord], ledger: {...runtime.manifest.ledger, budget: {...runtime.manifest.ledger.budget, pendingReserveUsd: reserve}}};
        await persist(runtime);
        let response: Awaited<ReturnType<typeof requestStage>> | null = null;
        let failure = "";
        try {
            response = await requestStage(provider, prompt, maxTokens);
            if (response.status === 401 || response.status === 403) failure = `http-status-${response.status}`;
            else if (!response.status.toString().startsWith("2")) failure = `http-status-${response.status}`;
            else if (response.finishReason === "length") failure = "length";
            else if (!response.output.trim()) failure = "response-content-invalid";
            else if (response.finishReason !== "stop") failure = `finish-reason-${response.finishReason ?? "missing"}`;
            if (response.output) await writeFile(resolve(directory, "output.txt"), `${response.output.trim()}\n`, "utf8");
        } catch {
            failure = "network-error";
        }
        const knownCostUsd = response?.usage ? estimateKnownCost(response.usage) : 0;
        const unknownReserveUsd = response?.usage ? 0 : reserve;
        let parsed: AcceptedStage["parsed"] | null = null;
        if (!failure && response) {
            const parsedResult = parseAccepted(response.output, {stage, paragraphCount: chapter.paragraphs.length, paragraphs: chapter.paragraphs, knownConceptIds: graph?.concepts.map((concept) => concept.id)});
            if (!parsedResult.ok) {
                repair.push(...parsedResult.issues.map((item) => `${item.path}: ${item.message}`));
                failure = "structure-invalid";
                await writeJsonAtomic(resolve(directory, "parse-issues.json"), parsedResult.issues);
            } else parsed = parsedResult.value;
        }
        const finishedAt = now();
        const settled: AttemptRecord = {...attemptRecord, status: parsed ? "accepted" : "failed", finishedAt, knownCostUsd: roundUsd(knownCostUsd), unknownReserveUsd: roundUsd(unknownReserveUsd), durationMs: response?.durationMs ?? null, inputTokens: response?.usage?.inputTokens ?? null, outputTokens: response?.usage?.outputTokens ?? null, totalTokens: response?.usage?.totalTokens ?? null, outputSha256: response?.output ? sha256(response.output.trim()) : null, failureCategory: failure || null, parseIssues: repair};
        const stages = runtime.manifest.attempts.filter((item) => !(item.chapter === chapter.chapter && item.stage === stage && item.attempt === attempt));
        const ledger = runtime.manifest.ledger;
        ledger.budget.pendingReserveUsd = 0;
        ledger.budget.knownUsd = roundUsd(ledger.budget.knownUsd + knownCostUsd);
        ledger.budget.unknownReserveUsd = roundUsd(ledger.budget.unknownReserveUsd + unknownReserveUsd);
        ledger.requests += 1;
        ledger.inputTokens += response?.usage?.inputTokens ?? 0;
        ledger.outputTokens += response?.usage?.outputTokens ?? 0;
        ledger.totalTokens += response?.usage?.totalTokens ?? 0;
        ledger.durationMs += response?.durationMs ?? 0;
        if (failure) ledger.failures += 1;
        if (attempt > 1) ledger.retries += 1;
        setStageRecord(ledger, {chapter: chapter.chapter, stage, status: parsed ? "accepted" : "failed", attempts: attempt, acceptedAttempt: parsed ? attempt : null, inputTokens: response?.usage?.inputTokens ?? null, outputTokens: response?.usage?.outputTokens ?? null, totalTokens: response?.usage?.totalTokens ?? null, durationMs: response?.durationMs ?? null, knownCostUsd: roundUsd(knownCostUsd), unknownReserveUsd: roundUsd(unknownReserveUsd), failureCategory: failure || null});
        runtime.manifest = {...runtime.manifest, pending: null, attempts: [...stages, settled]};
        if (parsed) {
            await writeJsonAtomic(resolve(directory, "accepted.json"), parsed);
            const outputPath = `${`ch${String(chapter.chapter).padStart(3, "0")}`}/${stage}/attempt-${attempt}/output.txt`;
            const parsedPath = `${`ch${String(chapter.chapter).padStart(3, "0")}`}/${stage}/attempt-${attempt}/accepted.json`;
            runtime.manifest = {...runtime.manifest, accepted: {...runtime.manifest.accepted, [stageKey(chapter.chapter, stage)]: {chapter: chapter.chapter, stage, attempt, promptFingerprint: fingerprint, parsedPath, outputPath, usage: response!.usage!, knownCostUsd: roundUsd(knownCostUsd)}}};
            await writeJsonAtomic(resolve(directory, "stats.json"), {schema: "nbook.v6-stage-attempt/v1", chapter: chapter.chapter, stage, attempt, sourceSha256: chapter.sourceSha256, promptFingerprint: fingerprint, status: "accepted", httpStatus: response?.status ?? null, finishReason: response?.finishReason ?? null, usage: response?.usage ?? null, knownCostUsd: roundUsd(knownCostUsd), unknownReserveUsd: roundUsd(unknownReserveUsd), durationMs: response?.durationMs ?? null});
            await persist(runtime);
            return {chapter: chapter.chapter, stage, attempt, content: response!.output.trim(), parsed, usage: response!.usage!, durationMs: response!.durationMs, knownCostUsd: roundUsd(knownCostUsd)};
        }
        await writeJsonAtomic(resolve(directory, "stats.json"), {schema: "nbook.v6-stage-attempt/v1", chapter: chapter.chapter, stage, attempt, sourceSha256: chapter.sourceSha256, promptFingerprint: fingerprint, status: "failed", httpStatus: response?.status ?? null, finishReason: response?.finishReason ?? null, usage: response?.usage ?? null, knownCostUsd: roundUsd(knownCostUsd), unknownReserveUsd: roundUsd(unknownReserveUsd), durationMs: response?.durationMs ?? null, failureCategory: failure || "unknown"});
        await persist(runtime);
        if (failure === "http-status-401" || failure === "http-status-403" || failure.startsWith("http-status-4") && failure !== "http-status-429" || runtime.manifest.ledger.budget.knownUsd + runtime.manifest.ledger.budget.unknownReserveUsd >= USD_LIMIT || attempt >= MAX_ATTEMPTS) throw new Error(`stage-${chapter.chapter}-${stage}-${failure || "failed"}`);
    }
    throw new Error(`stage-${chapter.chapter}-${stage}-unreachable`);
}

async function acceptedGraph(runtime: Runtime): Promise<MemoryGraphV6 | null> {
    const publishedPath = resolve(runtime.evidenceRoot, "published.json");
    try {
        return await readJson<MemoryGraphV6>(publishedPath);
    } catch {
        return null;
    }
}

async function callRun(root: string, sourceRoot: string, configPath: string, through: number, budgetUsd: number): Promise<void> {
    check(budgetUsd > 0 && budgetUsd <= USD_LIMIT, "budget-invalid");
    check(process.env.NBOOK_AUTHORIZED_MODEL_CALL === PURPOSE, "model-call-not-authorized");
    const chapters = await loadChapters(sourceRoot, through);
    const runtime = await loadRuntime(root, chapters);
    check(runtime.manifest.ledger.budget.usdLimit <= budgetUsd, "budget-cannot-increase-on-resume");
    const provider = providerFromConfig(JSON.parse(await readFile(resolve(configPath), "utf8")));
    let graph = await acceptedGraph(runtime);
    for (const chapter of chapters) {
        if (runtime.manifest.publishedChapters.includes(chapter.chapter)) continue;
        const prior = graph;
        const acceptedA = runtime.manifest.accepted[stageKey(chapter.chapter, "a")] ? await loadAccepted(runtime, runtime.manifest.accepted[stageKey(chapter.chapter, "a")]!) : await executeStage(runtime, provider, chapter, "a", null, prior);
        const beats = acceptedA.parsed as readonly BeatDraft[];
        const acceptedB = runtime.manifest.accepted[stageKey(chapter.chapter, "b")] ? await loadAccepted(runtime, runtime.manifest.accepted[stageKey(chapter.chapter, "b")]!) : await executeStage(runtime, provider, chapter, "b", beats, prior);
        const run = {...runtime.manifest.ledger, completedChapters: chapter.chapter, status: chapter.chapter === MAX_CHAPTERS ? "completed" : "running"} as RunLedger;
        graph = assembleChapter(chapter, beats, acceptedB.parsed as ExtractionDraft, prior, run);
        await writeJsonAtomic(resolve(runtime.evidenceRoot, "published.json"), graph);
        runtime.manifest = {...runtime.manifest, publishedChapters: [...runtime.manifest.publishedChapters, chapter.chapter], ledger: {...runtime.manifest.ledger, completedChapters: chapter.chapter}};
        await persist(runtime);
    }
    runtime.manifest = {...runtime.manifest, ledger: {...runtime.manifest.ledger, status: runtime.manifest.publishedChapters.length === MAX_CHAPTERS ? "completed" : "running", completedAt: runtime.manifest.publishedChapters.length === MAX_CHAPTERS ? now() : null}};
    await persist(runtime);
    console.log(JSON.stringify({schema: "nbook.v6-ingest-result/v1", ok: true, mode: "call", completedChapters: runtime.manifest.publishedChapters.length, requests: runtime.manifest.ledger.requests, budget: runtime.manifest.ledger.budget}, null, 2));
}

async function preflight(root: string, sourceRoot: string, through: number): Promise<void> {
    const chapters = await loadChapters(sourceRoot, through);
    const runtime = await loadRuntime(root, chapters);
    const totalParagraphs = chapters.reduce((sum, chapter) => sum + chapter.paragraphs.length, 0);
    const totalUtf16CodeUnits = chapters.reduce((sum, chapter) => sum + chapter.paragraphs.join("\n").length, 0);
    const sourceManifest = {schema: "nbook.v6-source-manifest/v1", sourceNormalization: SOURCE_NORMALIZATION, chapters: runtime.manifest.sourceChapters, totalParagraphs, totalUtf16CodeUnits, archiveMembers: chapters.map((chapter) => chapter.member), networkRequests: 0, configRead: false};
    await writeJsonAtomic(resolve(runtime.evidenceRoot, "source-manifest.json"), sourceManifest);
    console.log(JSON.stringify({schema: "nbook.v6-ingest-result/v1", ok: true, mode: "preflight", networkRequests: 0, configRead: false, chapters: chapters.length, totalParagraphs, totalUtf16CodeUnits, archiveMembers: chapters.map((chapter) => chapter.member), chapter1Sha256: chapters[0]?.sourceSha256}, null, 2));
}

async function selfTest(): Promise<void> {
    const malicious = ["const beats = [makeBeat()] satisfies BeatDraft[];", "const beats = [{...x}] satisfies BeatDraft[];", "const beats = [{id: `x`, paragraphs: [1, 1], gist: \"x\"}] satisfies BeatDraft[];", "const beats: BeatDraft[] = [] satisfies BeatDraft[];", "const beats = [] satisfies BeatDraft[]; const other = 1;"];
    check(malicious.every((raw) => !parseAccepted(raw, {stage: "a", paragraphCount: 0}).ok), "parser-self-test-failed");
    check(reserveUsd("a") < USD_LIMIT && reserveUsd("b") < USD_LIMIT, "reserve-self-test-failed");
    console.log(JSON.stringify({schema: "nbook.v6-ingest-result/v1", ok: true, mode: "self-test", networkRequests: 0, configRead: false, parserRejected: malicious.length}, null, 2));
}
async function exportDataset(root: string, through: number): Promise<void> {
    const evidenceRoot = resolve(root, EVIDENCE_RELATIVE, RUN_ID);
    const graph = await readJson<MemoryGraphV6>(resolve(evidenceRoot, "published.json"));
    const result = validateGraphV6(graph);
    if (!result.ok) throw new Error(`dataset-invalid-${result.issues.map((item) => item.path).join(",")}`);
    check(result.value.chapters.length <= through, "dataset-exceeds-through");
    const output = resolve(root, ".agents/works/w00005-novel-understanding-spike/tasks/t02-novel-memory-model-design/dataset-v6.json");
    await writeJsonAtomic(output, result.value);
    console.log(JSON.stringify({schema: "nbook.v6-ingest-result/v1", ok: true, mode: "export", output, chapters: result.value.chapters.length, paragraphs: result.value.chapters.reduce((sum, chapter) => sum + chapter.paragraphs.length, 0)}, null, 2));
}

async function main(): Promise<void> {
    const args = process.argv.slice(2);
    const command = args[0];
    const root = findRepositoryRoot(import.meta.dirname);
    if (command === "self-test") return selfTest();
    const sourceRoot = resolve(requiredArg(args, "--source-root"));
    if (command === "preflight") return preflight(root, sourceRoot, parseThrough(args));
    if (command === "export") return exportDataset(root, parseThrough(args));
    if (command === "call") return callRun(root, sourceRoot, resolve(requiredArg(args, "--config")), parseThrough(args), Number(arg(args, "--budget-usd") ?? USD_LIMIT));
    throw new Error("command-required");
}

try {
    await main();
} catch (error) {
    console.error(JSON.stringify({schema: "nbook.v6-ingest-result/v1", ok: false, error: error instanceof Error ? error.message : "unknown-error"}, null, 2));
    process.exitCode = 1;
}
