/**
 * V6 reader-facing memory data contract.
 * This module is pure data logic so the CLI and the offline viewer share one boundary.
 */

export const V6_SCHEMA = "nbook.novel-memory/v6-spike" as const;
export const BOOK_ID = "zhuansheng-fanpai-luoli" as const;
export const ID_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,47}$/u;

type UnknownObject = {[key: string]: unknown};

type SourceChannel = "narrator" | "author" | "system" | "speech" | "thought";
type RunStatus = "running" | "completed" | "stopped";
type StageStatus = "accepted" | "failed" | "interrupted";

export type Span = readonly [number, number];
export type Position = {readonly chapter: number; readonly paragraph: number};

export type BeatDraft = {
    readonly id: string;
    readonly paragraphs: Span;
    readonly gist: string;
};

export type ConceptDraft = {
    readonly id: string;
    readonly label: string;
    readonly at: number;
};

export type NameDraft = {
    readonly concept: string;
    readonly label: string;
    readonly at: number;
};

export type Source =
    | {readonly channel: "narrator" | "author" | "system"; readonly holder: null}
    | {readonly channel: "speech" | "thought"; readonly holder: string | null};

export type DisclosureDraft = {
    readonly id: string;
    readonly evidence: Span;
    readonly about: readonly string[];
    readonly source: Source;
    readonly mode: "assertion" | "question" | "request" | "conjecture";
    readonly text: string;
    readonly timeText: string | null;
};

export type ExtractionDraft = {
    readonly concepts: readonly ConceptDraft[];
    readonly names: readonly NameDraft[];
    readonly disclosures: readonly DisclosureDraft[];
};

export type Chapter = {
    readonly chapter: number;
    readonly title: string;
    readonly member: string;
    readonly sourceSha256: string;
    readonly paragraphs: readonly string[];
};

export type ConceptName = {
    readonly label: string;
    readonly at: Position;
};

export type Concept = {
    readonly id: string;
    readonly label: string;
    readonly introducedAt: Position;
    readonly names: readonly ConceptName[];
};

export type Beat = {
    readonly id: string;
    readonly chapter: number;
    readonly paragraphs: Span;
    readonly gist: string;
    readonly visibleAt: Position;
};

export type Disclosure = {
    readonly id: string;
    readonly chapter: number;
    readonly evidence: Span;
    readonly about: readonly string[];
    readonly source: Source;
    readonly mode: DisclosureDraft["mode"];
    readonly text: string;
    readonly timeText: string | null;
    readonly visibleAt: Position;
};

export type PriceSnapshot = {
    readonly source: string;
    readonly capturedAt: string;
    readonly inputHitPerMillion: number;
    readonly inputMissPerMillion: number;
    readonly outputPerMillion: number;
};

export type StageRun = {
    readonly chapter: number;
    readonly stage: "a" | "b";
    readonly status: StageStatus;
    readonly attempts: number;
    readonly acceptedAttempt: number | null;
    readonly inputTokens: number | null;
    readonly outputTokens: number | null;
    readonly totalTokens: number | null;
    readonly durationMs: number | null;
    readonly knownCostUsd: number;
    readonly unknownReserveUsd: number;
    readonly failureCategory: string | null;
};

export type RunBudget = {
    readonly usdLimit: number;
    readonly knownUsd: number;
    readonly unknownReserveUsd: number;
    readonly pendingReserveUsd: number;
    readonly remainingUsd: number;
};

export type RunLedger = {
    readonly id: string;
    readonly provider: string;
    readonly model: string;
    readonly status: RunStatus;
    readonly startedAt: string;
    readonly completedAt: string | null;
    readonly totalChapters: number;
    readonly completedChapters: number;
    readonly requests: number;
    readonly failures: number;
    readonly retries: number;
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly totalTokens: number;
    readonly durationMs: number;
    readonly price: PriceSnapshot;
    readonly budget: RunBudget;
    readonly stages: readonly StageRun[];
    readonly stopReason: string | null;
};

export type MemoryGraphV6 = {
    readonly schema: typeof V6_SCHEMA;
    readonly book: {
        readonly id: string;
        readonly title: string;
        readonly sourceSha256: string;
        readonly sourceNormalization: string;
    };
    readonly chapters: readonly Chapter[];
    readonly concepts: readonly Concept[];
    readonly beats: readonly Beat[];
    readonly disclosures: readonly Disclosure[];
    readonly run: RunLedger;
};

export type ValidationIssue = {
    readonly path: string;
    readonly message: string;
};

export type ValidationResult =
    | {readonly ok: true; readonly value: MemoryGraphV6}
    | {readonly ok: false; readonly issues: readonly ValidationIssue[]};

export type VisibleConcept = Concept & {readonly names: readonly ConceptName[]};
export type VisibleSlice = {
    readonly readAt: Position;
    readonly chapters: readonly Chapter[];
    readonly concepts: readonly VisibleConcept[];
    readonly beats: readonly Beat[];
    readonly disclosures: readonly Disclosure[];
};

export type SearchHit = {
    readonly kind: "concept" | "disclosure" | "beat" | "paragraph";
    readonly id: string;
    readonly chapter: number;
    readonly paragraph: number;
    readonly label: string;
};

const CHANNELS: Record<SourceChannel, true> = {
    narrator: true,
    author: true,
    system: true,
    speech: true,
    thought: true,
};
const MODES: Record<Disclosure["mode"], true> = {
    assertion: true,
    question: true,
    request: true,
    conjecture: true,
};
const RUN_STATUSES: Record<RunStatus, true> = {running: true, completed: true, stopped: true};
const STAGE_STATUSES: Record<StageStatus, true> = {accepted: true, failed: true, interrupted: true};
const HEX_64 = /^[0-9a-f]{64}$/u;
const FINAL_ID = /^(?:c\d{3}:concept:|c\d{3}:beat:|c\d{3}:disclosure:)[A-Za-z][A-Za-z0-9_-]{0,47}$/u;

function isNonEmptyString(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value);
}

function isNonNegativeNumber(value: unknown): value is number {
    return isFiniteNumber(value) && value >= 0;
}

function isObject(value: unknown): value is UnknownObject {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parsePosition(value: unknown, path: string, issues: ValidationIssue[]): Position | null {
    if (!isObject(value) || typeof value.chapter !== "number" || !Number.isInteger(value.chapter) || value.chapter < 1
        || typeof value.paragraph !== "number" || !Number.isInteger(value.paragraph) || value.paragraph < 1) {
        issue(issues, path, "位置必须包含正整数 chapter 和 paragraph");
        return null;
    }
    return {chapter: value.chapter, paragraph: value.paragraph};
}

function parseSpan(value: unknown, path: string, issues: ValidationIssue[]): Span | null {
    if (!Array.isArray(value) || value.length !== 2
        || typeof value[0] !== "number" || typeof value[1] !== "number"
        || !Number.isInteger(value[0]) || !Number.isInteger(value[1])
        || value[0] < 1 || value[1] < value[0]) {
        issue(issues, path, "区间必须是正整数闭区间 [from, to]");
        return null;
    }
    return [value[0], value[1]];
}

function parseRequiredString(object: UnknownObject, key: string, path: string, issues: ValidationIssue[]): string | null {
    if (!isNonEmptyString(object[key])) {
        issue(issues, `${path}.${key}`, "必须是非空字符串");
        return null;
    }
    return object[key] as string;
}

function parseNullableString(object: UnknownObject, key: string, path: string, issues: ValidationIssue[]): string | null {
    if (!(key in object) || (object[key] !== null && typeof object[key] !== "string")) {
        issue(issues, `${path}.${key}`, "必须是字符串或 null");
        return null;
    }
    return object[key] as string | null;
}

function issue(issues: ValidationIssue[], path: string, message: string): void {
    issues.push({path, message});
}

function chapterByNumber(chapters: readonly Chapter[], chapter: number): Chapter | undefined {
    return chapters.find((item) => item.chapter === chapter);
}

function comparePosition(a: Position, b: Position): number {
    return a.chapter - b.chapter || a.paragraph - b.paragraph;
}

function positionInChapter(position: Position, chapters: readonly Chapter[], path: string, issues: ValidationIssue[]): boolean {
    const chapter = chapterByNumber(chapters, position.chapter);
    if (!chapter) {
        issue(issues, path, "chapter 不存在");
        return false;
    }
    if (position.paragraph > chapter.paragraphs.length) {
        issue(issues, path, "paragraph 超出正文范围");
        return false;
    }
    return true;
}

function textAt(chapters: readonly Chapter[], position: Position): string {
    return chapterByNumber(chapters, position.chapter)?.paragraphs[position.paragraph - 1] ?? "";
}

function parseSource(value: unknown, path: string, issues: ValidationIssue[]): Source | null {
    if (!isObject(value) || typeof value.channel !== "string" || !CHANNELS[value.channel as SourceChannel] || !("holder" in value)) {
        issue(issues, path, "source 必须包含合法 channel 和 holder");
        return null;
    }
    const channel = value.channel as SourceChannel;
    const holderless = channel === "narrator" || channel === "author" || channel === "system";
    if (holderless) {
        if (value.holder !== null) issue(issues, `${path}.holder`, "该来源通道必须没有持有者");
        return {channel, holder: null};
    }
    if (value.holder !== null && !isNonEmptyString(value.holder)) {
        issue(issues, `${path}.holder`, "持有者必须是非空字符串或 null");
        return null;
    }
    return {channel, holder: value.holder as string | null};
}

function parseBook(value: unknown, issues: ValidationIssue[]): MemoryGraphV6["book"] | null {
    const path = "book";
    if (!isObject(value)) {
        issue(issues, path, "book 必须是对象");
        return null;
    }
    const id = parseRequiredString(value, "id", path, issues);
    const title = parseRequiredString(value, "title", path, issues);
    const sourceSha256 = parseRequiredString(value, "sourceSha256", path, issues);
    const sourceNormalization = parseRequiredString(value, "sourceNormalization", path, issues);
    if (id !== BOOK_ID) issue(issues, `${path}.id`, `必须是 ${BOOK_ID}`);
    if (sourceSha256 !== null && !HEX_64.test(sourceSha256)) issue(issues, `${path}.sourceSha256`, "必须是 SHA-256");
    if (id === null || title === null || sourceSha256 === null || sourceNormalization === null) return null;
    return {id, title, sourceSha256, sourceNormalization};
}

function parseChapter(value: unknown, path: string, issues: ValidationIssue[]): Chapter | null {
    if (!isObject(value)) {
        issue(issues, path, "章节必须是对象");
        return null;
    }
    const chapter = value.chapter;
    const title = parseRequiredString(value, "title", path, issues);
    const member = parseRequiredString(value, "member", path, issues);
    const sourceSha256 = parseRequiredString(value, "sourceSha256", path, issues);
    if (typeof chapter !== "number" || !Number.isInteger(chapter) || chapter < 1) issue(issues, `${path}.chapter`, "章号必须是正整数");
    if (sourceSha256 !== null && !HEX_64.test(sourceSha256)) issue(issues, `${path}.sourceSha256`, "必须是 SHA-256");
    if (!Array.isArray(value.paragraphs) || value.paragraphs.length === 0 || value.paragraphs.some((paragraph) => !isNonEmptyString(paragraph))) {
        issue(issues, `${path}.paragraphs`, "必须是非空字符串数组");
    }
    if (typeof chapter !== "number" || !Number.isInteger(chapter) || chapter < 1 || title === null || member === null || sourceSha256 === null || !Array.isArray(value.paragraphs) || value.paragraphs.some((paragraph) => !isNonEmptyString(paragraph))) return null;
    return {chapter, title, member, sourceSha256, paragraphs: value.paragraphs as string[]};
}

function parseConcept(value: unknown, path: string, issues: ValidationIssue[]): Concept | null {
    if (!isObject(value)) {
        issue(issues, path, "概念必须是对象");
        return null;
    }
    const id = parseRequiredString(value, "id", path, issues);
    const label = parseRequiredString(value, "label", path, issues);
    const introducedAt = parsePosition(value.introducedAt, `${path}.introducedAt`, issues);
    const names: ConceptName[] = [];
    if (!Array.isArray(value.names)) issue(issues, `${path}.names`, "names 必须是数组");
    else value.names.forEach((name, index) => {
        const namePath = `${path}.names[${index}]`;
        if (!isObject(name)) {
            issue(issues, namePath, "称呼必须是对象");
            return;
        }
        const nameLabel = parseRequiredString(name, "label", namePath, issues);
        const nameAt = parsePosition(name.at, `${namePath}.at`, issues);
        if (nameLabel !== null && nameAt !== null) names.push({label: nameLabel, at: nameAt});
    });
    if (id === null || label === null || introducedAt === null || !FINAL_ID.test(id) || !id.includes(":concept:")) {
        if (id !== null && (!FINAL_ID.test(id) || !id.includes(":concept:"))) issue(issues, `${path}.id`, "概念正式 ID 无效");
        return null;
    }
    return {id, label, introducedAt, names};
}

function parseBeat(value: unknown, path: string, issues: ValidationIssue[]): Beat | null {
    if (!isObject(value)) {
        issue(issues, path, "Beat 必须是对象");
        return null;
    }
    const id = parseRequiredString(value, "id", path, issues);
    const chapter = typeof value.chapter === "number" && Number.isInteger(value.chapter) && value.chapter >= 1 ? value.chapter : null;
    const paragraphs = parseSpan(value.paragraphs, `${path}.paragraphs`, issues);
    const gist = parseRequiredString(value, "gist", path, issues);
    const visibleAt = parsePosition(value.visibleAt, `${path}.visibleAt`, issues);
    if (chapter === null) issue(issues, `${path}.chapter`, "chapter 必须是正整数");
    if (id !== null && (!FINAL_ID.test(id) || !id.includes(":beat:"))) issue(issues, `${path}.id`, "Beat 正式 ID 无效");
    if (id === null || chapter === null || paragraphs === null || gist === null || visibleAt === null || (id !== null && (!FINAL_ID.test(id) || !id.includes(":beat:")))) return null;
    return {id, chapter, paragraphs, gist, visibleAt};
}

function parseDisclosure(value: unknown, path: string, issues: ValidationIssue[]): Disclosure | null {
    if (!isObject(value)) {
        issue(issues, path, "披露必须是对象");
        return null;
    }
    const id = parseRequiredString(value, "id", path, issues);
    const chapter = typeof value.chapter === "number" && Number.isInteger(value.chapter) && value.chapter >= 1 ? value.chapter : null;
    const evidence = parseSpan(value.evidence, `${path}.evidence`, issues);
    const text = parseRequiredString(value, "text", path, issues);
    const visibleAt = parsePosition(value.visibleAt, `${path}.visibleAt`, issues);
    const source = parseSource(value.source, `${path}.source`, issues);
    const timeText = parseNullableString(value, "timeText", path, issues);
    const about: string[] = [];
    if (!Array.isArray(value.about) || value.about.length === 0 || value.about.some((item) => !isNonEmptyString(item))) issue(issues, `${path}.about`, "about 必须是非空字符串数组");
    else about.push(...value.about as string[]);
    if (chapter === null) issue(issues, `${path}.chapter`, "chapter 必须是正整数");
    if (id !== null && (!FINAL_ID.test(id) || !id.includes(":disclosure:"))) issue(issues, `${path}.id`, "披露正式 ID 无效");
    if (typeof value.mode !== "string" || !MODES[value.mode as Disclosure["mode"]]) issue(issues, `${path}.mode`, "披露模式无效");
    if (id === null || chapter === null || evidence === null || text === null || visibleAt === null || source === null || (timeText === null && value.timeText !== null) || about.length === 0 || typeof value.mode !== "string" || !MODES[value.mode as Disclosure["mode"]] || !FINAL_ID.test(id ?? "") || !id?.includes(":disclosure:")) return null;
    return {id, chapter, evidence, about, source, mode: value.mode as Disclosure["mode"], text, timeText, visibleAt};
}

function parseStage(value: unknown, path: string, issues: ValidationIssue[]): StageRun | null {
    if (!isObject(value)) {
        issue(issues, path, "阶段账目必须是对象");
        return null;
    }
    const chapter = value.chapter;
    const attempts = value.attempts;
    const acceptedAttempt = value.acceptedAttempt;
    const inputTokens = value.inputTokens;
    const outputTokens = value.outputTokens;
    const totalTokens = value.totalTokens;
    const durationMs = value.durationMs;
    const knownCostUsd = value.knownCostUsd;
    const unknownReserveUsd = value.unknownReserveUsd;
    const failureCategory = value.failureCategory;
    if (typeof chapter !== "number" || !Number.isInteger(chapter) || chapter < 1) issue(issues, `${path}.chapter`, "必须是正整数");
    if (value.stage !== "a" && value.stage !== "b") issue(issues, `${path}.stage`, "阶段必须是 a 或 b");
    if (typeof value.status !== "string" || !STAGE_STATUSES[value.status as StageStatus]) issue(issues, `${path}.status`, "阶段状态无效");
    if (typeof attempts !== "number" || !Number.isInteger(attempts) || attempts < 0) issue(issues, `${path}.attempts`, "必须是非负整数");
    if (acceptedAttempt !== null && (typeof acceptedAttempt !== "number" || !Number.isInteger(acceptedAttempt) || acceptedAttempt < 1)) issue(issues, `${path}.acceptedAttempt`, "必须是正整数或 null");
    for (const key of ["inputTokens", "outputTokens", "totalTokens", "durationMs"] as const) if (value[key] !== null && !isNonNegativeNumber(value[key])) issue(issues, `${path}.${key}`, "必须是非负数字或 null");
    for (const key of ["knownCostUsd", "unknownReserveUsd"] as const) if (!isNonNegativeNumber(value[key])) issue(issues, `${path}.${key}`, "必须是非负数字");
    if (failureCategory !== null && !isNonEmptyString(failureCategory)) issue(issues, `${path}.failureCategory`, "必须是字符串或 null");
    if (typeof chapter !== "number" || !Number.isInteger(chapter) || chapter < 1 || (value.stage !== "a" && value.stage !== "b") || typeof value.status !== "string" || !STAGE_STATUSES[value.status as StageStatus] || typeof attempts !== "number" || !Number.isInteger(attempts) || attempts < 0 || (acceptedAttempt !== null && (typeof acceptedAttempt !== "number" || !Number.isInteger(acceptedAttempt) || acceptedAttempt < 1)) || [inputTokens, outputTokens, totalTokens, durationMs].some((item) => item !== null && !isNonNegativeNumber(item)) || !isNonNegativeNumber(knownCostUsd) || !isNonNegativeNumber(unknownReserveUsd) || (failureCategory !== null && !isNonEmptyString(failureCategory))) return null;
    return {chapter, stage: value.stage, status: value.status as StageStatus, attempts, acceptedAttempt, inputTokens: inputTokens as number | null, outputTokens: outputTokens as number | null, totalTokens: totalTokens as number | null, durationMs: durationMs as number | null, knownCostUsd, unknownReserveUsd, failureCategory: failureCategory as string | null};
}

function parseRun(value: unknown, issues: ValidationIssue[]): RunLedger | null {
    const path = "run";
    if (!isObject(value)) {
        issue(issues, path, "run 必须是对象");
        return null;
    }
    const id = parseRequiredString(value, "id", path, issues);
    const provider = parseRequiredString(value, "provider", path, issues);
    const model = parseRequiredString(value, "model", path, issues);
    const startedAt = parseRequiredString(value, "startedAt", path, issues);
    const completedAt = parseNullableString(value, "completedAt", path, issues);
    const numberKeys = ["totalChapters", "completedChapters", "requests", "failures", "retries", "inputTokens", "outputTokens", "totalTokens", "durationMs"] as const;
    for (const key of numberKeys) if (!isNonNegativeNumber(value[key])) issue(issues, `${path}.${key}`, "必须是非负数字");
    if (typeof value.status !== "string" || !RUN_STATUSES[value.status as RunStatus]) issue(issues, `${path}.status`, "运行状态无效");
    if (!isObject(value.price)) issue(issues, `${path}.price`, "价格快照必须是对象");
    if (!isObject(value.budget)) issue(issues, `${path}.budget`, "预算必须是对象");
    if (!Array.isArray(value.stages)) issue(issues, `${path}.stages`, "阶段账目必须是数组");
    const stages: StageRun[] = [];
    if (Array.isArray(value.stages)) value.stages.forEach((stage, index) => {
        const parsed = parseStage(stage, `${path}.stages[${index}]`, issues);
        if (parsed !== null) stages.push(parsed);
    });
    const priceObject = isObject(value.price) ? value.price : null;
    const price = priceObject === null ? null : {
        source: parseRequiredString(priceObject, "source", `${path}.price`, issues),
        capturedAt: parseRequiredString(priceObject, "capturedAt", `${path}.price`, issues),
        inputHitPerMillion: priceObject.inputHitPerMillion,
        inputMissPerMillion: priceObject.inputMissPerMillion,
        outputPerMillion: priceObject.outputPerMillion,
    };
    if (price !== null) for (const key of ["inputHitPerMillion", "inputMissPerMillion", "outputPerMillion"] as const) if (!isNonNegativeNumber(price[key])) issue(issues, `${path}.price.${key}`, "必须是非负数字");
    const budgetObject = isObject(value.budget) ? value.budget : null;
    const budget = budgetObject === null ? null : {
        usdLimit: budgetObject.usdLimit,
        knownUsd: budgetObject.knownUsd,
        unknownReserveUsd: budgetObject.unknownReserveUsd,
        pendingReserveUsd: budgetObject.pendingReserveUsd,
        remainingUsd: budgetObject.remainingUsd,
    };
    if (budget !== null) for (const key of ["usdLimit", "knownUsd", "unknownReserveUsd", "pendingReserveUsd", "remainingUsd"] as const) if (!isNonNegativeNumber(budget[key])) issue(issues, `${path}.budget.${key}`, "必须是非负数字");
    const stopReason = parseNullableString(value, "stopReason", path, issues);
    const requiredNumbersValid = numberKeys.every((key) => isNonNegativeNumber(value[key]));
    if (id === null || provider === null || model === null || startedAt === null || completedAt === null && value.completedAt !== null || typeof value.status !== "string" || !RUN_STATUSES[value.status as RunStatus] || !requiredNumbersValid || price === null || price.source === null || price.capturedAt === null || !isNonNegativeNumber(price.inputHitPerMillion) || !isNonNegativeNumber(price.inputMissPerMillion) || !isNonNegativeNumber(price.outputPerMillion) || budget === null || !isNonNegativeNumber(budget.usdLimit) || !isNonNegativeNumber(budget.knownUsd) || !isNonNegativeNumber(budget.unknownReserveUsd) || !isNonNegativeNumber(budget.pendingReserveUsd) || !isNonNegativeNumber(budget.remainingUsd) || !Array.isArray(value.stages) || stopReason === null && value.stopReason !== null) return null;
    return {id, provider, model, status: value.status as RunStatus, startedAt, completedAt, totalChapters: value.totalChapters as number, completedChapters: value.completedChapters as number, requests: value.requests as number, failures: value.failures as number, retries: value.retries as number, inputTokens: value.inputTokens as number, outputTokens: value.outputTokens as number, totalTokens: value.totalTokens as number, durationMs: value.durationMs as number, price: price as PriceSnapshot, budget: budget as RunBudget, stages, stopReason};
}

export function validateGraphV6(value: unknown): ValidationResult {
    const issues: ValidationIssue[] = [];
    if (!isObject(value)) return {ok: false, issues: [{path: "$", message: "图必须是对象"}]};
    if (value.schema !== V6_SCHEMA) issue(issues, "schema", `必须是 ${V6_SCHEMA}`);
    const book = parseBook(value.book, issues);
    if (!Array.isArray(value.chapters) || value.chapters.length === 0) issue(issues, "chapters", "必须是非空数组");
    if (!Array.isArray(value.concepts)) issue(issues, "concepts", "必须是数组");
    if (!Array.isArray(value.beats)) issue(issues, "beats", "必须是数组");
    if (!Array.isArray(value.disclosures)) issue(issues, "disclosures", "必须是数组");
    const chapters: Chapter[] = [];
    const concepts: Concept[] = [];
    const beats: Beat[] = [];
    const disclosures: Disclosure[] = [];
    if (Array.isArray(value.chapters)) value.chapters.forEach((item, index) => {
        const parsed = parseChapter(item, `chapters[${index}]`, issues);
        if (parsed !== null) chapters.push(parsed);
    });
    if (Array.isArray(value.concepts)) value.concepts.forEach((item, index) => {
        const parsed = parseConcept(item, `concepts[${index}]`, issues);
        if (parsed !== null) concepts.push(parsed);
    });
    if (Array.isArray(value.beats)) value.beats.forEach((item, index) => {
        const parsed = parseBeat(item, `beats[${index}]`, issues);
        if (parsed !== null) beats.push(parsed);
    });
    if (Array.isArray(value.disclosures)) value.disclosures.forEach((item, index) => {
        const parsed = parseDisclosure(item, `disclosures[${index}]`, issues);
        if (parsed !== null) disclosures.push(parsed);
    });
    const run = parseRun(value.run, issues);
    if (issues.length > 0 || book === null || run === null) return {ok: false, issues};

    const chapterNumbers = new Set<number>();
    chapters.forEach((chapter, index) => {
        if (chapterNumbers.has(chapter.chapter)) issue(issues, `chapters[${index}].chapter`, "章号重复");
        chapterNumbers.add(chapter.chapter);
        if (chapter.chapter !== index + 1) issue(issues, `chapters[${index}].chapter`, "章节必须按 1 开始连续排列");
    });
    const conceptById = new Map<string, Concept>();
    const recordIds = new Set<string>();
    concepts.forEach((concept, index) => {
        const path = `concepts[${index}]`;
        if (conceptById.has(concept.id) || recordIds.has(concept.id)) issue(issues, `${path}.id`, "记录 ID 重复");
        conceptById.set(concept.id, concept);
        recordIds.add(concept.id);
        if (!positionInChapter(concept.introducedAt, chapters, `${path}.introducedAt`, issues)) return;
        if (!textAt(chapters, concept.introducedAt).includes(concept.label)) issue(issues, `${path}.label`, "label 必须出现在登记段落");
        concept.names.forEach((name, nameIndex) => {
            const namePath = `${path}.names[${nameIndex}]`;
            if (comparePosition(name.at, concept.introducedAt) < 0) issue(issues, `${namePath}.at`, "称呼不能早于概念登记");
            if (positionInChapter(name.at, chapters, `${namePath}.at`, issues) && !textAt(chapters, name.at).includes(name.label)) issue(issues, `${namePath}.label`, "称呼必须出现在登记段落");
        });
    });
    beats.forEach((beat, index) => {
        const path = `beats[${index}]`;
        if (recordIds.has(beat.id)) issue(issues, `${path}.id`, "记录 ID 重复");
        recordIds.add(beat.id);
        if (beat.visibleAt.chapter !== beat.chapter || beat.visibleAt.paragraph !== beat.paragraphs[1]) issue(issues, `${path}.visibleAt`, "Beat visibleAt 必须是区间末段");
        if (!positionInChapter({chapter: beat.chapter, paragraph: beat.paragraphs[1]}, chapters, `${path}.paragraphs`, issues)) return;
        const chapter = chapterByNumber(chapters, beat.chapter);
        if (beat.paragraphs[1] > (chapter?.paragraphs.length ?? 0)) issue(issues, `${path}.paragraphs`, "Beat 区间越界");
    });
    for (const chapter of chapters) {
        const chapterBeats = beats.filter((beat) => beat.chapter === chapter.chapter).sort((a, b) => a.paragraphs[0] - b.paragraphs[0]);
        let next = 1;
        for (const beat of chapterBeats) {
            if (beat.paragraphs[0] !== next) issue(issues, `beats.${chapter.chapter}`, "Beat 必须连续覆盖全章");
            next = beat.paragraphs[1] + 1;
        }
        if (next !== chapter.paragraphs.length + 1) issue(issues, `beats.${chapter.chapter}`, "Beat 未覆盖全章");
    }
    disclosures.forEach((disclosure, index) => {
        const path = `disclosures[${index}]`;
        if (recordIds.has(disclosure.id)) issue(issues, `${path}.id`, "记录 ID 重复");
        recordIds.add(disclosure.id);
        if (disclosure.visibleAt.chapter !== disclosure.chapter || disclosure.visibleAt.paragraph !== disclosure.evidence[1]) issue(issues, `${path}.visibleAt`, "披露 visibleAt 必须是证据末段");
        const evidenceEnd = {chapter: disclosure.chapter, paragraph: disclosure.evidence[1]};
        if (!positionInChapter(evidenceEnd, chapters, `${path}.evidence`, issues)) return;
        const chapter = chapterByNumber(chapters, disclosure.chapter);
        if (disclosure.evidence[1] > (chapter?.paragraphs.length ?? 0)) issue(issues, `${path}.evidence`, "证据区间越界");
        disclosure.about.forEach((id, aboutIndex) => {
            const concept = conceptById.get(id);
            if (!concept) issue(issues, `${path}.about[${aboutIndex}]`, "引用了不存在的概念");
            else if (comparePosition(concept.introducedAt, evidenceEnd) > 0) issue(issues, `${path}.about[${aboutIndex}]`, "概念在证据末段尚不可见");
        });
        if (disclosure.source.holder !== null) {
            const holder = conceptById.get(disclosure.source.holder);
            if (!holder) issue(issues, `${path}.source.holder`, "来源持有者不存在");
            else if (comparePosition(holder.introducedAt, evidenceEnd) > 0) issue(issues, `${path}.source.holder`, "来源持有者在证据末段尚不可见");
        }
    });
    return issues.length === 0 ? {ok: true, value: {schema: V6_SCHEMA, book, chapters, concepts, beats, disclosures, run}} : {ok: false, issues};
}

export function sliceAt(graph: MemoryGraphV6, readAt: Position): VisibleSlice {
    const chapter = chapterByNumber(graph.chapters, readAt.chapter);
    if (!chapter || readAt.paragraph < 1 || readAt.paragraph > chapter.paragraphs.length) throw new Error("readAt 超出正文范围");
    const chapters = graph.chapters.filter((item) => item.chapter <= readAt.chapter).map((item) => item.chapter === readAt.chapter ? {...item, paragraphs: item.paragraphs.slice(0, readAt.paragraph)} : item);
    const concepts = graph.concepts.filter((concept) => comparePosition(concept.introducedAt, readAt) <= 0).map((concept) => ({...concept, names: concept.names.filter((name) => comparePosition(name.at, readAt) <= 0)}));
    const beats = graph.beats.filter((beat) => comparePosition(beat.visibleAt, readAt) <= 0);
    const disclosures = graph.disclosures.filter((disclosure) => comparePosition(disclosure.visibleAt, readAt) <= 0);
    return {readAt, chapters, concepts, beats, disclosures};
}

export function searchVisible(slice: VisibleSlice, query: string): readonly SearchHit[] {
    const terms = query.trim().toLocaleLowerCase().split(/\s+/u).filter(Boolean);
    if (terms.length === 0) return [];
    const matches = (value: string): boolean => {
        const normalized = value.toLocaleLowerCase();
        return terms.every((term) => normalized.includes(term));
    };
    const hits: SearchHit[] = [];
    for (const concept of slice.concepts) {
        const text = [concept.label, ...concept.names.map((name) => name.label)].join(" ");
        if (matches(text)) hits.push({kind: "concept", id: concept.id, chapter: concept.introducedAt.chapter, paragraph: concept.introducedAt.paragraph, label: concept.label});
    }
    for (const disclosure of slice.disclosures) if (matches(disclosure.text)) hits.push({kind: "disclosure", id: disclosure.id, chapter: disclosure.chapter, paragraph: disclosure.visibleAt.paragraph, label: disclosure.text});
    for (const beat of slice.beats) if (matches(beat.gist)) hits.push({kind: "beat", id: beat.id, chapter: beat.chapter, paragraph: beat.visibleAt.paragraph, label: beat.gist});
    for (const chapter of slice.chapters) for (let index = 0; index < chapter.paragraphs.length; index += 1) if (matches(chapter.paragraphs[index] ?? "")) hits.push({kind: "paragraph", id: `${chapter.chapter}:${index + 1}`, chapter: chapter.chapter, paragraph: index + 1, label: chapter.paragraphs[index] ?? ""});
    const order: Record<SearchHit["kind"], number> = {concept: 0, disclosure: 1, beat: 2, paragraph: 3};
    return hits.sort((a, b) => a.chapter - b.chapter || a.paragraph - b.paragraph || order[a.kind] - order[b.kind] || a.id.localeCompare(b.id));
}
