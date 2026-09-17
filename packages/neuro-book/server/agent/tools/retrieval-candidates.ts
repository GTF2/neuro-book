import {readFile} from "node:fs/promises";
import {Type} from "typebox";
import type {Static} from "typebox";
import {
    authorizeFileOperation,
} from "nbook/server/workspace-files/authorized-file-operation";
import {scanWorkspaceTree} from "nbook/server/workspace-files/workspace-files";
import type {AbsoluteFsPath} from "nbook/server/runtime/paths/file-path";
import type {NeuroAgentTool} from "nbook/server/agent/tools/types";
import {normalizeToolResultDetails} from "nbook/server/agent/messages/message-utils";

/**
 * T0.3 设定检索自动候选（拍板 10C 的后端半）。
 *
 * retrieval 环节的确定性候选清单生成器：leader 编译 brief 前调用，产出
 * 「lorebook 条目 + 相关正文片段」的结构化候选（path / 摘要 / 来源 / 相关性），
 * 呈给用户一键确认（前端确认卡是 T1.x，本模块只定义数据与协议）。
 * 确认后的清单仍按现行 handoff 协议进 writer 的 `context.lorebookEntries`
 * （纯 path 字符串数组），不把相关性、摘要、风险等判断字段带给 writer。
 */

export const RETRIEVAL_CANDIDATE_LIST_VERSION = "retrieval-candidates-v1";

export const DEFAULT_CANDIDATE_LIMIT = 12;
export const MAX_CANDIDATE_LIMIT = 30;
export const MAX_QUERY_TERMS = 16;
export const MAX_SUMMARY_CHARS = 200;
export const MAX_EXCERPT_CHARS = 240;
const MAX_MANUSCRIPT_FILE_BYTES = 2_000_000;
const LOREBOOK_ROOT = "lorebook";
const MANUSCRIPT_ROOT = "manuscript";

export type RetrievalCandidateSource = "lorebook-entry" | "manuscript-fragment";

/**
 * 单条检索候选。结构是确认卡（T1.x）与 leader 消息共同消费的稳定 DTO。
 */
export type RetrievalCandidate = {
    /** 候选清单内唯一 ID，形如 `lb-1` / `ms-1`；确认协议按它回选。 */
    candidateId: string;
    source: RetrievalCandidateSource;
    /** Project 相对路径；lorebook 条目是目录路径（结尾 `/`），正文片段是 `.md` 文件路径。 */
    path: string;
    title: string | null;
    /** 单行有界摘要；lorebook 取 frontmatter summary，正文片段取节选。 */
    summary: string;
    /** 词元命中率 0 < relevance <= 1，按（相关性降序, path 升序）稳定排序。 */
    relevance: number;
    matchedTerms: string[];
    /** 需要用户注意的风险说明（状态非 active、frontmatter 解析失败等）；无风险为 null。 */
    risk: string | null;
    /** 正文片段节选；lorebook 条目为 null。 */
    excerpt: string | null;
    /** 正文片段节选所在行号（1-based）；lorebook 条目为 null。 */
    excerptLine: number | null;
};

export type RetrievalCandidateList = {
    version: string;
    query: string;
    candidates: RetrievalCandidate[];
    lorebookScanned: number;
    manuscriptScanned: number;
    note: string | null;
};

export type RetrievalCandidateSelection = {
    /** 从候选清单回选的 candidateId（一键确认的主通道）。 */
    candidateIds?: string[];
    /** 用户手填 / 修改后追加的 Project 相对路径。 */
    paths?: string[];
};

export type ConfirmedLorebookEntries = {
    /** 与现行 writer handoff `context.lorebookEntries` 完全同形：path 字符串数组。 */
    lorebookEntries: string[];
    /** 未通过校验的输入（带原因），调用方应反馈给用户而不是静默丢弃。 */
    rejected: Array<{value: string; reason: string}>;
};

export type RetrievalCandidateListInput = {
    root: AbsoluteFsPath;
    query: string;
    includeManuscript?: boolean;
    limit?: number;
};

const RetrievalCandidatesSchema = Type.Object({
    query: Type.String({minLength: 1, description: "本轮写作目标的自然语言描述：要找什么设定、给哪一章用、关注哪些人物或概念。"}),
    includeManuscript: Type.Optional(Type.Boolean({description: "是否同时检索 manuscript 正文片段。默认 true。"})),
    limit: Type.Optional(Type.Integer({minimum: 1, maximum: MAX_CANDIDATE_LIMIT, description: "候选清单上限（lorebook 条目数；正文片段约为一半）。默认 12。"})),
}, {additionalProperties: false});

type RetrievalCandidatesInput = Static<typeof RetrievalCandidatesSchema>;

/**
 * 构造 retrieval 候选工具。只读、无 workspace 变更。
 */
export function createRetrievalCandidatesTools(): NeuroAgentTool[] {
    return [createRetrievalCandidatesTool()];
}

function createRetrievalCandidatesTool(): NeuroAgentTool {
    return {
        key: "retrieval_candidates",
        name: "retrieval_candidates",
        label: "Retrieval Candidates",
        executionMode: "parallel",
        description: "Generate a structured retrieval candidate list (lorebook entries + related manuscript fragments with path/summary/source/relevance) for the current Project Workspace. Present the list to the user for confirmation; confirmed paths go into the writer handoff context.lorebookEntries.",
        parameters: RetrievalCandidatesSchema,
        async executeWithContext(context, _toolCallId, params: unknown) {
            const input = params as RetrievalCandidatesInput;
            const project = context.currentProject;
            if (!project) {
                throw new Error("retrieval_candidates 只允许在当前 Project Workspace 中运行。");
            }
            const includeManuscript = input.includeManuscript ?? true;
            // admission 与 file tool 同边界：授权读取 lorebook（及可选 manuscript）根目录。
            await authorizeFileOperation(context, LOREBOOK_ROOT, "read");
            if (includeManuscript) {
                await authorizeFileOperation(context, MANUSCRIPT_ROOT, "read");
            }
            const list = await buildRetrievalCandidateList({
                root: project.workspace.root,
                query: input.query,
                includeManuscript,
                limit: input.limit ?? DEFAULT_CANDIDATE_LIMIT,
            });
            return {
                content: [{type: "text", text: renderRetrievalCandidateList(list)}],
                details: normalizeToolResultDetails({
                    version: list.version,
                    query: list.query,
                    lorebookScanned: list.lorebookScanned,
                    manuscriptScanned: list.manuscriptScanned,
                    candidateCount: list.candidates.length,
                    candidates: list.candidates.map((candidate) => ({
                        candidateId: candidate.candidateId,
                        source: candidate.source,
                        path: candidate.path,
                        title: candidate.title,
                        relevance: candidate.relevance,
                    })),
                    note: list.note,
                }),
            };
        },
        async execute() {
            throw new Error("retrieval_candidates 必须在 agent session workspace 内执行。");
        },
    };
}

/**
 * 生成候选清单：lorebook 内容节点元数据匹配 + manuscript 正文片段词元命中。
 * 纯词元匹配（无 embedding 依赖），结果确定、可单测。
 */
export async function buildRetrievalCandidateList(input: RetrievalCandidateListInput): Promise<RetrievalCandidateList> {
    const limit = Math.min(Math.max(Math.floor(input.limit ?? DEFAULT_CANDIDATE_LIMIT), 1), MAX_CANDIDATE_LIMIT);
    const query = input.query.trim();
    const terms = tokenizeRetrievalQuery(query);
    if (terms.length === 0) {
        return {
            version: RETRIEVAL_CANDIDATE_LIST_VERSION,
            query,
            candidates: [],
            lorebookScanned: 0,
            manuscriptScanned: 0,
            note: "查询里没有可匹配的词元（仅标点或单字符）。请用更具体的自然语言描述写作目标。",
        };
    }

    const lorebookNodes = await scanWorkspaceTree({
        root: input.root,
        targets: [LOREBOOK_ROOT],
    });
    const lorebookCandidates: Array<Omit<RetrievalCandidate, "candidateId">> = [];
    for (const node of lorebookNodes) {
        if (!node.isDirectory || !node.contentNode || !node.path.startsWith(`${LOREBOOK_ROOT}/`)) {
            continue;
        }
        const retrievalConfig = readRetrievalConfig(node.frontmatter);
        if (!retrievalConfig.enabled) {
            continue;
        }
        const haystack = [
            node.title,
            node.summary,
            retrievalConfig.trigger ?? "",
            node.entryType ?? "",
            node.status ?? "",
            node.path.slice(0, -1).split("/").at(-1) ?? "",
        ].join(" ");
        const matchedTerms = matchTerms(terms, haystack);
        if (matchedTerms.length === 0) {
            continue;
        }
        const risks: string[] = [];
        if (node.frontmatterError) {
            risks.push(`frontmatter 解析失败：${node.frontmatterError}`);
        }
        if (node.status && node.status !== "active") {
            risks.push(`状态 ${node.status}，确认后再交给 writer。`);
        }
        lorebookCandidates.push({
            source: "lorebook-entry",
            path: node.path,
            title: node.title || null,
            summary: boundText(node.summary, MAX_SUMMARY_CHARS),
            relevance: computeRelevance(matchedTerms.length, terms.length),
            matchedTerms,
            risk: risks.length > 0 ? risks.join(" ") : null,
            excerpt: null,
            excerptLine: null,
        });
    }

    let manuscriptScanned = 0;
    const manuscriptCandidates: Array<Omit<RetrievalCandidate, "candidateId">> = [];
    if (input.includeManuscript ?? true) {
        const manuscriptNodes = await scanWorkspaceTree({
            root: input.root,
            targets: [MANUSCRIPT_ROOT],
        });
        const fileNodes = manuscriptNodes
            .filter((node) => !node.isDirectory && node.path.endsWith(".md") && node.path.startsWith(`${MANUSCRIPT_ROOT}/`))
            .sort((left, right) => left.path.localeCompare(right.path, "zh-Hans-CN"));
        for (const node of fileNodes) {
            if (node.size > MAX_MANUSCRIPT_FILE_BYTES) {
                continue;
            }
            manuscriptScanned += 1;
            const fragment = await extractManuscriptFragment(node.absolutePath, terms);
            if (!fragment) {
                continue;
            }
            manuscriptCandidates.push({
                source: "manuscript-fragment",
                path: node.path,
                title: node.title || null,
                summary: fragment.excerpt,
                relevance: computeRelevance(fragment.matchedTerms.length, terms.length),
                matchedTerms: fragment.matchedTerms,
                risk: null,
                excerpt: fragment.excerpt,
                excerptLine: fragment.line,
            });
        }
    }

    const sortedLorebook = sortCandidates(lorebookCandidates).slice(0, limit);
    const manuscriptLimit = Math.max(1, Math.floor(limit / 2));
    const sortedManuscript = sortCandidates(manuscriptCandidates).slice(0, manuscriptLimit);

    const candidates: RetrievalCandidate[] = [
        ...sortedLorebook.map((candidate, index) => ({...candidate, candidateId: `lb-${String(index + 1)}`})),
        ...sortedManuscript.map((candidate, index) => ({...candidate, candidateId: `ms-${String(index + 1)}`})),
    ];

    const notes: string[] = [];
    if (lorebookCandidates.length === 0) {
        notes.push("lorebook 没有命中候选；可换更具体的关键词，或确认相关设定已建立。");
    } else if (lorebookCandidates.length > limit) {
        notes.push(`lorebook 命中 ${String(lorebookCandidates.length)} 条，仅保留相关性最高的 ${String(limit)} 条。`);
    }
    if ((input.includeManuscript ?? true) && manuscriptCandidates.length === 0) {
        notes.push("manuscript 正文没有命中片段。");
    }

    return {
        version: RETRIEVAL_CANDIDATE_LIST_VERSION,
        query,
        candidates,
        lorebookScanned: lorebookNodes.filter((node) => node.isDirectory && node.contentNode && node.path.startsWith(`${LOREBOOK_ROOT}/`)).length,
        manuscriptScanned,
        note: notes.length > 0 ? notes.join(" ") : null,
    };
}

/**
 * 确认协议：把用户确认结果解析成 writer handoff 的 `context.lorebookEntries`。
 *
 * - candidateIds 只接受清单内 ID（未知 ID 视为调用方协议错误，直接抛错，不静默丢弃）。
 * - paths 允许用户手填 / 修改后追加，做格式校验（Project 相对、无 `..`、非绝对、
 *   非 `workspace/` 跨项目语法）；lorebook 目录路径规范成结尾 `/`。
 * - 输出与 `context.lorebookEntries` 完全同形（string[]），顺序保持用户确认顺序，去重。
 */
export function resolveConfirmedLorebookEntries(
    list: RetrievalCandidateList,
    selection: RetrievalCandidateSelection,
): ConfirmedLorebookEntries {
    const byId = new Map(list.candidates.map((candidate) => [candidate.candidateId, candidate]));
    const entries: string[] = [];
    const rejected: Array<{value: string; reason: string}> = [];

    for (const candidateId of selection.candidateIds ?? []) {
        const candidate = byId.get(candidateId);
        if (!candidate) {
            throw new Error(`未知的候选 ID：${candidateId}。只能使用本次候选清单里的 candidateId。`);
        }
        if (!entries.includes(candidate.path)) {
            entries.push(candidate.path);
        }
    }

    for (const rawPath of selection.paths ?? []) {
        const normalized = normalizeHandoffPath(rawPath);
        if (typeof normalized !== "string") {
            rejected.push({value: rawPath, reason: normalized.reason});
            continue;
        }
        // normalizeHandoffPath 已把 lorebook 目录规范成结尾 `/`，与清单 canonical path 一致。
        if (!entries.includes(normalized)) {
            entries.push(normalized);
        }
    }

    return {lorebookEntries: entries, rejected};
}

/**
 * leader 消息用的候选清单文本渲染：紧凑、稳定、带确认指引。
 */
export function renderRetrievalCandidateList(list: RetrievalCandidateList): string {
    if (list.candidates.length === 0) {
        return [
            `retrieval_candidates 没有命中候选（query=${JSON.stringify(list.query)}）。`,
            list.note ?? "",
        ].filter(Boolean).join("\n");
    }
    const lines: string[] = [
        `retrieval_candidates 命中 ${String(list.candidates.length)} 条（lorebook ${String(list.candidates.filter((candidate) => candidate.source === "lorebook-entry").length)} / 正文片段 ${String(list.candidates.filter((candidate) => candidate.source === "manuscript-fragment").length)}）`,
    ];
    for (const candidate of list.candidates) {
        const location = candidate.source === "manuscript-fragment" && candidate.excerptLine !== null
            ? `${candidate.path}:${String(candidate.excerptLine)}`
            : candidate.path;
        lines.push(`[${candidate.candidateId}] ${location}（${candidate.source === "lorebook-entry" ? "设定条目" : "正文片段"} | 相关性 ${candidate.relevance.toFixed(2)}${candidate.title ? ` | ${candidate.title}` : ""}）`);
        lines.push(`  摘要：${candidate.summary}`);
        lines.push(`  命中：${candidate.matchedTerms.join(", ")}`);
        if (candidate.risk) {
            lines.push(`  风险：${candidate.risk}`);
        }
    }
    if (list.note) {
        lines.push(list.note);
    }
    lines.push("确认指引：把候选逐项呈给用户确认（✓/✗/改）；确认后的 path 才放入 writer 的 context.lorebookEntries——只传 path，不传相关性、摘要、风险等判断字段。");
    return lines.join("\n");
}

/** 查询分词：CJK 连续段出 bigram（2 字名直接成词），拉丁/数字词保留原词。 */
export function tokenizeRetrievalQuery(query: string): string[] {
    const normalized = query.toLowerCase();
    const segments = normalized.split(/[\s\p{P}\p{S}]+/u).filter(Boolean);
    const terms: string[] = [];
    for (const segment of segments) {
        const cjkRuns = segment.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]+/gu) ?? [];
        let consumed = false;
        for (const run of cjkRuns) {
            consumed = true;
            if (run.length === 1) {
                terms.push(run);
                continue;
            }
            for (let index = 0; index + 1 < run.length; index += 1) {
                terms.push(run.slice(index, index + 2));
            }
        }
        if (!consumed && segment.length >= 2) {
            terms.push(segment);
        }
    }
    const deduped: string[] = [];
    for (const term of terms) {
        if (!deduped.includes(term)) {
            deduped.push(term);
        }
    }
    return deduped.slice(0, MAX_QUERY_TERMS);
}

function matchTerms(terms: string[], haystack: string): string[] {
    const lower = haystack.toLowerCase();
    return terms.filter((term) => lower.includes(term));
}

function computeRelevance(matchedCount: number, totalTerms: number): number {
    if (totalTerms <= 0) {
        return 0;
    }
    return Math.min(1, matchedCount / totalTerms);
}

function sortCandidates<T extends {path: string; relevance: number}>(candidates: T[]): T[] {
    return [...candidates].sort((left, right) => {
        if (left.relevance !== right.relevance) {
            return right.relevance - left.relevance;
        }
        return left.path.localeCompare(right.path, "zh-Hans-CN");
    });
}

function readRetrievalConfig(frontmatter: Record<string, unknown>): {enabled: boolean; trigger: string | null} {
    const retrieval = frontmatter["retrieval"];
    if (!retrieval || typeof retrieval !== "object" || Array.isArray(retrieval)) {
        return {enabled: true, trigger: null};
    }
    const record = retrieval as Record<string, unknown>;
    const enabled = record["enabled"];
    const trigger = record["trigger"];
    return {
        enabled: typeof enabled === "boolean" ? enabled : true,
        trigger: typeof trigger === "string" && trigger.trim().length > 0 ? trigger.trim() : null,
    };
}

async function extractManuscriptFragment(
    absolutePath: string,
    terms: string[],
): Promise<{excerpt: string; line: number; matchedTerms: string[]} | null> {
    let content: string;
    try {
        content = await readFile(absolutePath, "utf-8");
    } catch {
        return null;
    }
    const lines = content.split(/\r?\n/);
    let best: {line: number; matched: string[]} | null = null;
    for (let index = 0; index < lines.length; index += 1) {
        const lower = (lines[index] ?? "").toLowerCase();
        const matched = terms.filter((term) => lower.includes(term));
        if (matched.length === 0) {
            continue;
        }
        if (!best || matched.length > best.matched.length) {
            best = {line: index, matched};
        }
    }
    if (!best) {
        return null;
    }
    const rawLine = (lines[best.line] ?? "").trim();
    return {
        excerpt: boundText(rawLine, MAX_EXCERPT_CHARS),
        line: best.line + 1,
        matchedTerms: best.matched,
    };
}

/** 单行 + 有界；超长截断并标记省略号。 */
function boundText(text: string, maxChars: number): string {
    const singleLine = text.replace(/[\t\r\n]+/g, " ").trim();
    if (singleLine.length <= maxChars) {
        return singleLine;
    }
    return `${singleLine.slice(0, maxChars)}…`;
}

type PathNormalizationResult = string | {reason: string};

function normalizeHandoffPath(rawPath: string): PathNormalizationResult {
    const trimmed = rawPath.trim();
    if (!trimmed) {
        return {reason: "路径为空。"};
    }
    const normalized = trimmed
        .replaceAll("\\", "/")
        .replace(/\/+/g, "/")
        .replace(/^\.\//, "")
        .replace(/\/$/, "");
    if (!normalized || normalized === ".") {
        return {reason: "路径为空。"};
    }
    if (/^[a-zA-Z]:/.test(normalized) || normalized.startsWith("/")) {
        return {reason: "writer handoff 只接受 Project 相对路径，不接受绝对路径。"};
    }
    if (normalized.startsWith("workspace/")) {
        return {reason: "writer handoff 不接受 workspace/<project>/ 跨项目语法；请用当前 Project 相对路径。"};
    }
    const segments = normalized.split("/");
    if (segments.includes("..") || segments.includes(".")) {
        return {reason: "路径不允许包含 `..` 或 `.` 段。"};
    }
    if (normalized.startsWith(`${LOREBOOK_ROOT}/`) && !normalized.endsWith(".md")) {
        // lorebook 内容节点按现行 handoff 约定使用目录路径（结尾 `/`）。
        return `${normalized}/`;
    }
    return normalized;
}
