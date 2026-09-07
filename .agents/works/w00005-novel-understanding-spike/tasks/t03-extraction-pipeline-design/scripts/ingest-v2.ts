import {createHash} from "node:crypto";
import {readFile} from "node:fs/promises";
import {isAbsolute, relative, resolve} from "node:path";
import {unzipSync} from "fflate";
import type {BeatDraft, Chapter, Concept, Disclosure, ExtractionDraft, MemoryGraphV6, Position, RunLedger, Source} from "../../t02-novel-memory-model-design/schema-v6.ts";
import {V6_SCHEMA, validateGraphV6, BOOK_ID} from "../../t02-novel-memory-model-design/schema-v6.ts";
import {parseStageOutput, type OutputParseResult} from "./v6-output.ts";

export const WORK = "w00005-novel-understanding-spike";
export const RUN_ID = "v6-first20-001";
export const MODEL = "deepseek-v4-flash";
export const PROVIDER = "deepseek";
export const SOURCE_MEMBER_PREFIX = "OEBPS/chapter_";
export const SOURCE_NORMALIZATION = "chapter-source-normalization/v1";
export const MAX_CHAPTERS = 20;
export const PRICE = {
    source: "https://api-docs.deepseek.com/quick_start/pricing",
    capturedAt: "2026-09-07",
    inputHitPerMillion: 0.014,
    inputMissPerMillion: 0.44,
    outputPerMillion: 1.32,
} as const;
export const USD_LIMIT = 2;
export const MAX_ATTEMPTS = 2;
export const MAX_TOKENS = {a: 4096, b: 16384} as const;
export const RESERVE_INPUT_TOKENS = 1_048_576;

export const CHAPTER_TITLES: readonly string[] = [
    "反派魔法少女",
    "反派的日常就是找茬",
    "蹲点是反派的必备技能",
    "魔法少女的天敌",
    "为生活奔波",
    "引诱",
    "上钩了",
    "青春应该有朋友才行",
    "顺眼了就A上去",
    "语言的艺术",
    "染上狐狸了",
    "反派的自我修养",
    "袭击",
    "真不凑巧",
    "你在偷看对吧",
    "冷雨夜",
    "狐狐的奥术魔刃",
    "猫猫尽在掌控中",
    "过去的你",
    "都到齐了。",
];

export type LoadedChapter = Chapter & {readonly htmlMember: string};
export type Candidate = {
    readonly id: string;
    readonly labels: readonly string[];
    readonly context: string;
    readonly at: Position;
};
export type StageName = "a" | "b";
export type PromptBundle = {
    readonly system: string;
    readonly user: string;
    readonly sourceSha256: string;
    readonly promptVersion: string;
    readonly candidateIds: readonly string[];
};
export type AcceptedStage = {
    readonly chapter: number;
    readonly stage: StageName;
    readonly attempt: number;
    readonly content: string;
    readonly parsed: readonly BeatDraft[] | ExtractionDraft;
    readonly usage: Usage;
    readonly durationMs: number;
    readonly knownCostUsd: number;
};
export type Usage = {
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly totalTokens: number;
};

function check(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(message);
}

export function sha256(value: string | Uint8Array): string {
    return createHash("sha256").update(value).digest("hex");
}

export function visibleLength(value: string): number {
    return value.replace(/[\s\p{Default_Ignorable_Code_Point}]/gu, "").length;
}

export function decodeEntities(value: string): string {
    const named: Record<string, string> = {amp: "&", apos: "'", gt: ">", lt: "<", nbsp: "\u00a0", quot: "\""};
    return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/giu, (entity, key: string) => {
        if (/^#x/iu.test(key)) return String.fromCodePoint(Number.parseInt(key.slice(2), 16));
        if (key.startsWith("#")) return String.fromCodePoint(Number.parseInt(key.slice(1), 10));
        return named[key.toLowerCase()] ?? entity;
    });
}

export function sourceText(html: string): string {
    return decodeEntities(html
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/giu, "")
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/giu, "")
        .replace(/<br\s*\/?\s*>/giu, "\n")
        .replace(/<\/(?:p|div|h[1-6])\s*>/giu, "\n")
        .replace(/<[^>]+>/gu, ""))
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .filter(Boolean)
        .join("\n");
}

export function resolveSourceArchive(sourceRoot: string): string {
    check(isAbsolute(sourceRoot), "source-root-must-be-absolute");
    const root = resolve(sourceRoot);
    const archivePath = resolve(root, ".local/novels/转生反派萝莉，找茬魔法少女.epub");
    const remainder = relative(root, archivePath);
    check(remainder !== ".." && !remainder.startsWith("..\\") && !remainder.startsWith("../") && !isAbsolute(remainder), "source-archive-outside-root");
    return archivePath;
}

export function chapterMember(chapter: number): string {
    return `${SOURCE_MEMBER_PREFIX}${String(chapter).padStart(5, "0")}.xhtml`;
}

export async function loadChapters(sourceRoot: string, through = MAX_CHAPTERS): Promise<readonly LoadedChapter[]> {
    check(Number.isInteger(through) && through >= 1 && through <= MAX_CHAPTERS, "through-invalid");
    const archive = unzipSync(new Uint8Array(await readFile(resolveSourceArchive(sourceRoot))));
    const chapters: LoadedChapter[] = [];
    for (let chapter = 1; chapter <= through; chapter += 1) {
        const member = chapterMember(chapter);
        const bytes = archive[member];
        check(bytes, `source-member-missing-${chapter}`);
        const text = sourceText(new TextDecoder().decode(bytes));
        const paragraphs = text.split("\n");
        check(paragraphs.length > 0 && paragraphs.every((paragraph) => paragraph.length > 0), `source-paragraphs-invalid-${chapter}`);
        chapters.push({chapter, title: CHAPTER_TITLES[chapter - 1] ?? `第${chapter}章`, member, htmlMember: member, sourceSha256: sha256(text), paragraphs});
    }
    check(chapters[0]?.paragraphs.length === 77, `chapter-001-paragraph-count-${chapters[0]?.paragraphs.length ?? 0}`);
    check(chapters[0]?.sourceSha256 === "22c9b12d0305da4b64ea39751e809ed47cf9254d574caf875fbff91ef82552ee", "chapter-001-source-hash-mismatch");
    if (through === MAX_CHAPTERS) check(chapters.reduce((sum, chapter) => sum + chapter.paragraphs.length, 0) === 1942, "first-20-paragraph-count-mismatch");
    return chapters;
}

const CONTRACT_A = `type Span = readonly [number, number];
type BeatDraft = { id: string; paragraphs: Span; gist: string };
const beats = [...] satisfies BeatDraft[];`;
const CONTRACT_B = `type Span = readonly [number, number];
type Source =
  | { channel: "narrator" | "author" | "system"; holder: null }
  | { channel: "speech" | "thought"; holder: string | null };
type ConceptDraft = { id: string; label: string; at: number };
type NameDraft = { concept: string; label: string; at: number };
type DisclosureDraft = { id: string; evidence: Span; about: readonly string[]; source: Source; mode: "assertion" | "question" | "request" | "conjecture"; text: string; timeText: string | null };
type ExtractionDraft = { concepts: readonly ConceptDraft[]; names: readonly NameDraft[]; disclosures: readonly DisclosureDraft[] };
const extraction = {...} satisfies ExtractionDraft;`;

export function numberedParagraphs(paragraphs: readonly string[]): string {
    return paragraphs.map((paragraph, index) => `${index + 1}|${paragraph}`).join("\n");
}

export function buildCandidateTable(graph: MemoryGraphV6 | null, chapter: LoadedChapter): {text: string; ids: readonly string[]} {
    if (!graph) return {text: "（空：这是第一章，没有前章候选。）", ids: []};
    const candidates: Candidate[] = [];
    for (const concept of graph.concepts) {
        const labels = [concept.label, ...concept.names.map((name) => name.label)];
        const matched = labels.filter((label) => chapter.paragraphs.some((paragraph) => paragraph.includes(label)));
        if (matched.length === 0) continue;
        const disclosure = graph.disclosures.filter((item) => item.about.includes(concept.id)).sort((a, b) => b.visibleAt.chapter - a.visibleAt.chapter || b.visibleAt.paragraph - a.visibleAt.paragraph)[0];
        candidates.push({id: concept.id, labels: matched.slice(0, 5), context: disclosure?.text.slice(0, 160) ?? "", at: disclosure?.visibleAt ?? concept.introducedAt});
    }
    candidates.sort((a, b) => Math.max(...b.labels.map((label) => label.length)) - Math.max(...a.labels.map((label) => label.length)) || b.at.chapter - a.at.chapter || b.at.paragraph - a.at.paragraph || a.id.localeCompare(b.id));
    const selected = candidates.slice(0, 50);
    return {
        text: selected.length === 0 ? "（空：没有在本章正文中匹配到前章概念称呼。）" : selected.map((candidate) => `- known:${candidate.id}\t称呼：${candidate.labels.join("、")}\t最近披露：${candidate.context || "（无）"}\t位置：${candidate.at.chapter}:${candidate.at.paragraph}`).join("\n"),
        ids: selected.map((candidate) => candidate.id),
    };
}

export function buildPrompt(chapter: LoadedChapter, stage: StageName, beats: readonly BeatDraft[] | null, graph: MemoryGraphV6 | null, repair?: readonly string[]): PromptBundle {
    const candidate = buildCandidateTable(graph, chapter);
    const numbered = numberedParagraphs(chapter.paragraphs);
    if (stage === "a") {
        const system = `你是小说阅读记录器。只把本章正文切成连续 Beat，不排序故事时间，不抽概念，不抽披露。${CONTRACT_A}\n只输出这一条 const 声明，不要 Markdown 围栏、解释、import、函数或其他语句。Beat 必须覆盖第 1 段到第 ${chapter.paragraphs.length} 段，区间连续无重叠，gist 是简短中文概括。`;
        const user = `章节：${chapter.chapter}《${chapter.title}》\n段数：${chapter.paragraphs.length}\n正文：\n${numbered}${repair?.length ? `\n\n上次结构错误（只修结构，不改正文含义）：\n${repair.join("\n")}` : ""}`;
        return {system, user, sourceSha256: chapter.sourceSha256, promptVersion: "v6-a-1", candidateIds: []};
    }
    const beatsText = beats?.map((beat) => `- ${beat.id}: [${beat.paragraphs[0]}, ${beat.paragraphs[1]}] ${beat.gist}`).join("\n") ?? "";
    const system = `你是小说阅读记录器。只记录本章可由正文支持的 Concept、名称和 Disclosure。${CONTRACT_B}\n不分类概念，不发明关系；保留来源通道、疑问/请求/推测语气；不要把后文知道的身份提前写进前文。新概念和名称必须使用其登记段落中出现的称呼。新概念引用本批局部 id；前章概念只能使用候选表中的 known:<canonicalId>。只输出这一条 const 声明，不要 Markdown 围栏、解释、import、函数或其他语句。${repair?.length ? `\n上次结构错误（只修结构）：\n${repair.join("\n")}` : ""}`;
    const user = `章节：${chapter.chapter}《${chapter.title}》\n段数：${chapter.paragraphs.length}\nBeat：\n${beatsText}\n前章候选（只读，不代表本章正文已证明）：\n${candidate.text}\n编号正文：\n${numbered}`;
    return {system, user, sourceSha256: chapter.sourceSha256, promptVersion: "v6-b-1", candidateIds: candidate.ids};
}

function canonicalRef(reference: string, chapter: number, kind: "concept" | "beat" | "disclosure", known: Set<string>): string {
    if (reference.startsWith("known:")) {
        const id = reference.slice("known:".length);
        check(known.has(id), `known-reference-not-in-candidates-${reference}`);
        return id;
    }
    check(/^[A-Za-z][A-Za-z0-9_-]{0,47}$/u.test(reference), `local-id-invalid-${reference}`);
    return `c${String(chapter).padStart(3, "0")}:${kind}:${reference}`;
}

function position(chapter: number, paragraph: number): Position {
    return {chapter, paragraph};
}

export function assembleChapter(chapter: LoadedChapter, beatsDraft: readonly BeatDraft[], extraction: ExtractionDraft, prior: MemoryGraphV6 | null, run: RunLedger): MemoryGraphV6 {
    const known = new Set(prior?.concepts.map((concept) => concept.id) ?? []);
    const concepts: Concept[] = prior?.concepts.slice() ?? [];
    const conceptIds = new Set(concepts.map((concept) => concept.id));
    for (const draft of extraction.concepts) {
        const id = canonicalRef(draft.id, chapter.chapter, "concept", known);
        check(!conceptIds.has(id), `concept-id-already-exists-${id}`);
        concepts.push({id, label: draft.label, introducedAt: position(chapter.chapter, draft.at), names: []});
        conceptIds.add(id);
    }
    const namesByConcept = new Map<string, Array<{readonly label: string; readonly at: Position}>>();
    for (const name of extraction.names) {
        const id = canonicalRef(name.concept, chapter.chapter, "concept", known);
        check(conceptIds.has(id), `name-concept-missing-${id}`);
        const names = namesByConcept.get(id) ?? [];
        names.push({label: name.label, at: position(chapter.chapter, name.at)});
        namesByConcept.set(id, names);
    }
    const conceptsWithNames = concepts.map((concept) => ({...concept, names: [...concept.names, ...(namesByConcept.get(concept.id) ?? [])]}));
    const formalBeats = [...(prior?.beats ?? []), ...beatsDraft.map((beat) => ({
        id: canonicalRef(beat.id, chapter.chapter, "beat", new Set<string>()),
        chapter: chapter.chapter,
        paragraphs: beat.paragraphs,
        gist: beat.gist,
        visibleAt: position(chapter.chapter, beat.paragraphs[1]),
    }))];
    const formalDisclosures: Disclosure[] = [...(prior?.disclosures ?? [])];
    const localIds = new Set(extraction.concepts.map((concept) => concept.id));
    const resolveConceptReference = (reference: string): string => {
        if (reference.startsWith("known:")) return canonicalRef(reference, chapter.chapter, "concept", known);
        check(localIds.has(reference), `disclosure-concept-not-in-batch-${reference}`);
        return canonicalRef(reference, chapter.chapter, "concept", known);
    };
    for (const disclosure of extraction.disclosures) {
        const about = disclosure.about.map(resolveConceptReference);
        const holder = disclosure.source.holder === null ? null : resolveConceptReference(disclosure.source.holder);
        const source: Source = disclosure.source.channel === "narrator" || disclosure.source.channel === "author" || disclosure.source.channel === "system"
            ? {channel: disclosure.source.channel, holder: null}
            : {channel: disclosure.source.channel, holder};
        formalDisclosures.push({id: canonicalRef(disclosure.id, chapter.chapter, "disclosure", new Set<string>()), chapter: chapter.chapter, evidence: disclosure.evidence, about, source, mode: disclosure.mode, text: disclosure.text, timeText: disclosure.timeText, visibleAt: position(chapter.chapter, disclosure.evidence[1])});
    }
    const graph: MemoryGraphV6 = {
        schema: V6_SCHEMA,
        book: {id: BOOK_ID, title: "转生反派萝莉，找茬魔法少女", sourceSha256: "355e1feb04b01eeeaa6ffc4be07619470bc2e6507338c22b90933a68318af081", sourceNormalization: SOURCE_NORMALIZATION},
        chapters: [...(prior?.chapters ?? []), chapter],
        concepts: conceptsWithNames,
        beats: formalBeats,
        disclosures: formalDisclosures,
        run,
    };
    const validated = validateGraphV6(graph);
    if (!validated.ok) throw new Error(`assembled-graph-invalid-${validated.issues.map((item) => `${item.path}:${item.message}`).join(";")}`);
    return validated.value;
}

export function estimateKnownCost(usage: Usage): number {
    return (usage.inputTokens * PRICE.inputMissPerMillion + usage.outputTokens * PRICE.outputPerMillion) / 1_000_000;
}

export function reserveUsd(stage: StageName): number {
    return (RESERVE_INPUT_TOKENS * PRICE.inputMissPerMillion + MAX_TOKENS[stage] * PRICE.outputPerMillion) / 1_000_000;
}

export function parseAccepted(raw: string, options: Parameters<typeof parseStageOutput>[1]): OutputParseResult {
    return parseStageOutput(raw, options);
}
