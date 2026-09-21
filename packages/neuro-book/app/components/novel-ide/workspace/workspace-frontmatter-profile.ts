import YAML from "yaml";

type RuntimeI18n = {
    t: (key: string) => string;
};

function translate(key: string, fallback: string): string {
    try {
        const nuxtApp = useNuxtApp() as {$i18n?: RuntimeI18n};
        return nuxtApp.$i18n?.t(key) ?? fallback;
    } catch {
        return fallback;
    }
}

export type FrontmatterRef = {
    relation: string;
    target: string;
    note: string | null;
};

export type RetrievalDraft = {
    enabled: boolean;
    trigger: string | null;
};

export type GovernanceDraft = {
    source: string;
    review: string;
};

export type ParsedMarkdownDocument = {
    frontmatter: Record<string, unknown>;
    body: string;
    error: string | null;
};

const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

/**
 * 解析 Markdown 文档的 YAML frontmatter，解析失败时保留正文切分结果。
 */
export function parseMarkdownDocument(content: string): ParsedMarkdownDocument {
    const match = content.match(FRONTMATTER_PATTERN);
    if (!match) {
        return {frontmatter: {}, body: content, error: null};
    }

    try {
        const parsed = YAML.parse(match[1] ?? "", {logLevel: "silent"}) as unknown;
        return {
            frontmatter: isPlainObject(parsed) ? parsed : {},
            body: content.slice(match[0].length),
            error: isPlainObject(parsed) || parsed === null ? null : translate("ide.workspace.common.frontmatterObjectError", "frontmatter 必须是对象"),
        };
    } catch (error) {
        return {
            frontmatter: {},
            body: content.slice(match[0].length),
            error: error instanceof Error ? error.message : translate("ide.workspace.common.frontmatterParseFailed", "frontmatter 解析失败"),
        };
    }
}

/**
 * 将 frontmatter 对象与正文重新渲染为 Markdown 文档。
 */
export function renderMarkdownDocument(frontmatter: Record<string, unknown>, body: string): string {
    return `---\n${YAML.stringify(frontmatter).trimEnd()}\n---\n\n${body}`;
}

/**
 * 读取字符串字段。
 */
export function readString(value: unknown, fallback: string): string {
    return typeof value === "string" ? value : fallback;
}

/**
 * 读取可空字符串字段。
 */
export function readNullableString(value: unknown): string | null {
    return typeof value === "string" && value.trim() ? value : null;
}

/**
 * 读取字符串数组字段。
 */
export function readStringArray(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

/**
 * 读取普通对象字段。
 */
export function readPlainObject(value: unknown): Record<string, unknown> {
    return isPlainObject(value) ? value : {};
}

/**
 * 读取结构化引用数组。
 */
export function readRefs(value: unknown): FrontmatterRef[] {
    if (!Array.isArray(value)) {
        return [];
    }
    return value.filter(isPlainObject).map((item) => ({
        relation: readString(item.relation, ""),
        target: readString(item.target, ""),
        note: readNullableString(item.note),
    }));
}

/**
 * 读取检索提示配置。
 */
export function readRetrieval(value: unknown): RetrievalDraft {
    const retrieval = readPlainObject(value);
    return {
        enabled: typeof retrieval.enabled === "boolean" ? retrieval.enabled : true,
        trigger: readNullableString(retrieval.trigger),
    };
}

/**
 * 读取治理状态配置。
 */
export function readGovernance(value: unknown): GovernanceDraft {
    const governance = readPlainObject(value);
    return {
        source: readString(governance.source, "manual"),
        review: readString(governance.review, "proposed"),
    };
}

/**
 * 返回路径末尾名称。
 */
export function basename(filePath: string): string {
    const normalizedPath = filePath.replace(/\/$/, "");
    return normalizedPath.includes("/") ? normalizedPath.slice(normalizedPath.lastIndexOf("/") + 1) : normalizedPath;
}

/**
 * 判断值是否为普通对象。
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * 按围栏切分 Markdown；frontmatter 保持原文文本不重排（区别于 parseMarkdownDocument 的对象版）。
 * 正文剥掉围栏后的前导空行，与 joinWorkspaceMarkdownDocument 的固定补回构成幂等规范化；
 * 详情面板的编辑态与磁盘态都必须走同一套切分/重组，dirty 比较才是格式无关的。
 */
export function splitWorkspaceMarkdownDocument(content: string): {frontmatterText: string; body: string; error: string | null} {
    const match = content.match(FRONTMATTER_PATTERN);
    if (!match) {
        return {frontmatterText: "", body: content, error: null};
    }
    const text = match[1] ?? "";
    return {
        frontmatterText: text.trimEnd(),
        body: content.slice(match[0].length).replace(/^(?:\r?\n)+/, ""),
        error: parseWorkspaceFrontmatterText(text).error,
    };
}

/**
 * 把 frontmatter 文本段拼回完整 Markdown；空段或非对象 frontmatter 时只返回正文。
 */
export function joinWorkspaceMarkdownDocument(frontmatterText: string, body: string): string {
    const parsed = parseWorkspaceFrontmatterText(frontmatterText);
    if (parsed.error || Object.keys(parsed.frontmatter).length === 0) {
        return body;
    }
    return `---\n${frontmatterText.trimEnd()}\n---\n\n${body}`;
}

/**
 * 解析 frontmatter 文本段为对象；空段视为空对象。
 */
export function parseWorkspaceFrontmatterText(text: string): {frontmatter: Record<string, unknown>; error: string | null} {
    if (!text.trim()) {
        return {frontmatter: {}, error: null};
    }
    try {
        const parsed = YAML.parse(text, {logLevel: "silent"}) as unknown;
        if (parsed === null) {
            return {frontmatter: {}, error: null};
        }
        if (!isPlainObject(parsed)) {
            return {frontmatter: {}, error: translate("ide.workspace.common.frontmatterObjectError", "frontmatter 必须是对象")};
        }
        return {frontmatter: parsed, error: null};
    } catch (error) {
        return {
            frontmatter: {},
            error: error instanceof Error ? error.message : translate("ide.workspace.common.frontmatterParseFailed", "frontmatter 解析失败"),
        };
    }
}

/**
 * 规范化管道：切分再重组。磁盘内容与编辑态内容比较前各过一遍，
 * 消除行尾风格、frontmatter 尾部空行、围栏后空行数等格式差异造成的假 dirty。
 */
export function normalizeWorkspaceMarkdownDocument(content: string): string {
    const sections = splitWorkspaceMarkdownDocument(content);
    return joinWorkspaceMarkdownDocument(sections.frontmatterText, sections.body);
}
