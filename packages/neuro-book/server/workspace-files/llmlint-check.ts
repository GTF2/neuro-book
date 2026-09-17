import {execFile} from "node:child_process";
import {access} from "node:fs/promises";
import path from "node:path";
import type {RuntimePaths} from "nbook/server/runtime/paths/runtime-paths";

/**
 * llmlint 编辑器入口的服务端 runner。
 *
 * 设计取舍（重要）：llmlint 是一个**独立 CLI**（skill/package.json 没有 exports 字段，`private: true`），
 * 它的公开契约是「命令行 + 结构化 JSON」，不是可被 import 的库。因此这里**只 spawn CLI**，
 * 绝不 import 它的内部模块：
 *   - 命令：`bun <skill-root>/bin/llmlint.ts check <绝对文件路径> --format json`
 *   - 输入方式是**文件路径（positional argument）**，不是 stdin（已核对 references/cli-usage.md
 *     与 src/cli.ts 的 `.argument("<files...>")`）。
 *   - 退出码语义是 eslint 式门禁：有可见 high 命中时 exit 1，**不代表执行失败**。所以这里
 *     绝不用退出码判定成功与否，只看 stdout 能否解析出 JSON。
 */

export type LlmlintLevel = "high" | "medium" | "low";
export type LlmlintReview = "agent" | "human" | "none";
export type LlmlintReviewScope = LlmlintReview | "all";

/** llmlint check JSON 里 rules 字典中的单条规则元数据（可能字段缺失，故全部可选）。 */
export type LlmlintRawRule = {
    namespace?: string;
    title?: string;
    level?: LlmlintLevel;
    review?: LlmlintReview;
    fixability?: string;
    scope?: unknown;
    action?: {type?: string; replacements?: string[]; message?: string};
    note?: string;
};

/** llmlint check JSON 里的逐处命中。 */
export type LlmlintRawIssue = {
    ruleId: string;
    line: number;
    column: number;
    endLine: number;
    endColumn: number;
    match: string;
    context?: {before?: string; current?: string; after?: string};
};

/** llmlint check JSON 顶层结构（紧凑形态：规则元数据去重到 rules，命中只引用 ruleId）。 */
export type LlmlintRawReport = {
    kind?: string;
    filePath?: string;
    summary?: {total?: number; high?: number; medium?: number; low?: number; visibleChars?: number};
    filter?: {review?: string; hiddenByReview?: number; minLevel?: string; hiddenByLevel?: number};
    registry?: {rulesets?: string[]; totalRules?: number; activeRules?: number; disabledRules?: number};
    diagnostics?: unknown[];
    rules?: Record<string, LlmlintRawRule>;
    issues?: LlmlintRawIssue[];
};

/** 面向前端的一条命中：把 rules 元数据 join 进逐处命中，并给出人话建议。 */
export type ProseLintIssue = {
    ruleId: string;
    ruleTitle: string;
    namespace: string;
    level: LlmlintLevel;
    review: LlmlintReview;
    fixability: string;
    line: number;
    column: number;
    endLine: number;
    endColumn: number;
    match: string;
    context: {before: string; current: string; after: string};
    suggestion: string | null;
};

/** 面向前端的 check 报告（稳定 DTO，屏蔽 llmlint 内部字段变化）。 */
export type ProseLintCheckResult = {
    kind: "check";
    filePath: string;
    summary: {total: number; high: number; medium: number; low: number; visibleChars: number};
    filter: {review: string; hiddenByReview: number; minLevel: string; hiddenByLevel: number};
    registry: {rulesets: string[]; totalRules: number; activeRules: number; disabledRules: number};
    diagnostics: string[];
    issues: ProseLintIssue[];
};

const LLMLINT_BIN_RELATIVE = path.join("bin", "llmlint.ts");
const LLMLINT_CHECK_TIMEOUT_MS = 60_000;
const LLMLINT_MAX_BUFFER = 64 * 1024 * 1024;

/**
 * 候选 skill root，按优先级排列（第一个含 `bin/llmlint.ts` 的被选中）：
 *  1. Monorepo 源码副本 `packages/llmlint/skill`——与 `system-assets-preflight` 的投影 source 同一路径公式
 *     （`<applicationRoot>/../llmlint/skill`）。源码开发与 CI 用这份，依赖由 workspace 根 node_modules 解析。
 *  2. 运行态投影副本 `<userNbookRoot>/agent/skills/llmlint`——打包产物用这份（投影会排除 node_modules，
 *     由运行态安装补齐）。源码副本不存在时回落到它。
 */
export function llmlintSkillRootCandidates(runtimePaths: RuntimePaths): string[] {
    return [
        path.resolve(runtimePaths.applicationRoot, "..", "llmlint", "skill"),
        path.join(runtimePaths.userNbookRoot, "agent", "skills", "llmlint"),
    ];
}

/**
 * 解析可用的 llmlint skill root；全部候选都不可用时抛出明确错误。
 */
export async function resolveLlmlintSkillRoot(
    runtimePaths: RuntimePaths,
    options: {existsImpl?: (candidate: string) => Promise<boolean>} = {},
): Promise<string> {
    const exists = options.existsImpl ?? defaultExists;
    const candidates = llmlintSkillRootCandidates(runtimePaths);
    for (const candidate of candidates) {
        if (await exists(candidate)) {
            return candidate;
        }
    }
    throw new Error(`找不到 llmlint skill（已尝试：${candidates.join("，")}）`);
}

async function defaultExists(candidate: string): Promise<boolean> {
    try {
        await access(path.join(candidate, LLMLINT_BIN_RELATIVE));
        return true;
    } catch {
        return false;
    }
}

/**
 * 运行 `llmlint check <文件> --format json` 并返回结构化结果。
 *
 * 只做确定性候选定位，不写回任何内容——本函数永不修改被扫描文件。
 */
export async function runLlmlintCheck(input: {
    skillRoot: string;
    absoluteFilePath: string;
    review?: LlmlintReviewScope;
    minLevel?: LlmlintLevel;
    scanAll?: boolean;
    timeoutMs?: number;
    bunBinary?: string;
    execFileImpl?: typeof execFile;
}): Promise<ProseLintCheckResult> {
    const binPath = path.join(input.skillRoot, LLMLINT_BIN_RELATIVE);
    const args = [
        binPath,
        "check",
        input.absoluteFilePath,
        "--format",
        "json",
        "--review",
        input.review ?? "agent",
        "--min-level",
        input.minLevel ?? "low",
    ];
    if (input.scanAll) {
        args.push("--scan-all");
    }

    const execFileImpl = input.execFileImpl ?? execFile;
    const result = await new Promise<{stdout: string; stderr: string; code: number | null; spawnError: Error | null}>((resolve, reject) => {
        execFileImpl(
            input.bunBinary ?? resolveBunBinary(),
            args,
            {
                cwd: input.skillRoot,
                env: {...process.env, NO_COLOR: "1"},
                timeout: input.timeoutMs ?? LLMLINT_CHECK_TIMEOUT_MS,
                maxBuffer: LLMLINT_MAX_BUFFER,
                windowsHide: true,
                killSignal: "SIGKILL",
            },
            (error, stdout, stderr) => {
                const stdoutText = String(stdout ?? "");
                const stderrText = String(stderr ?? "");
                // ENOENT / EACCES 这类「根本没跑起来」的错误没有退出码，直接上抛。
                if (error && typeof (error as {code?: unknown}).code !== "number") {
                    reject(error);
                    return;
                }
                resolve({
                    stdout: stdoutText,
                    stderr: stderrText,
                    code: error ? Number((error as {code?: unknown}).code) : 0,
                    spawnError: error ?? null,
                });
            },
        );
    });

    // 退出码 1 = 发现可见 high 命中，不是失败；只有解析不出 JSON 才算失败。
    try {
        return parseLlmlintCheckOutput(result.stdout, input.absoluteFilePath);
    } catch (error) {
        const detail = result.stderr.trim() || result.stdout.trim() || (error instanceof Error ? error.message : String(error));
        throw new Error(`llmlint check 未返回可解析的 JSON（exit=${result.code}）：${detail.slice(0, 800)}`);
    }
}

/**
 * 解析 llmlint check 的 JSON stdout，join 规则元数据并归一化为稳定 DTO。
 *
 * 导出以便单元测试直接喂字符串，不需要真的启动子进程。
 */
export function parseLlmlintCheckOutput(stdout: string, filePathFallback: string): ProseLintCheckResult {
    const raw = JSON.parse(extractJson(stdout)) as LlmlintRawReport;
    if (raw.kind !== "check") {
        throw new Error(`llmlint 输出不是单文件 check 形态（kind=${String(raw.kind)}）`);
    }
    return {
        kind: "check",
        filePath: raw.filePath ?? filePathFallback,
        summary: {
            total: raw.summary?.total ?? 0,
            high: raw.summary?.high ?? 0,
            medium: raw.summary?.medium ?? 0,
            low: raw.summary?.low ?? 0,
            visibleChars: raw.summary?.visibleChars ?? 0,
        },
        filter: {
            review: raw.filter?.review ?? "agent",
            hiddenByReview: raw.filter?.hiddenByReview ?? 0,
            minLevel: raw.filter?.minLevel ?? "low",
            hiddenByLevel: raw.filter?.hiddenByLevel ?? 0,
        },
        registry: {
            rulesets: raw.registry?.rulesets ?? [],
            totalRules: raw.registry?.totalRules ?? 0,
            activeRules: raw.registry?.activeRules ?? 0,
            disabledRules: raw.registry?.disabledRules ?? 0,
        },
        diagnostics: (raw.diagnostics ?? []).map((diagnostic) => (
            typeof diagnostic === "string" ? diagnostic : JSON.stringify(diagnostic)
        )),
        issues: enrichIssues(raw),
    };
}

/**
 * 把顶层 rules 字典 join 进逐处命中，并生成面向人看的一行建议。
 */
export function enrichIssues(raw: LlmlintRawReport): ProseLintIssue[] {
    const rules = raw.rules ?? {};
    return (raw.issues ?? []).map((issue) => {
        const rule = rules[issue.ruleId] ?? {};
        return {
            ruleId: issue.ruleId,
            ruleTitle: rule.title ?? issue.ruleId,
            namespace: rule.namespace ?? "",
            level: rule.level ?? "medium",
            review: rule.review ?? "agent",
            fixability: rule.fixability ?? "manual",
            line: issue.line,
            column: issue.column,
            endLine: issue.endLine,
            endColumn: issue.endColumn,
            match: issue.match,
            context: {
                before: issue.context?.before ?? "",
                current: issue.context?.current ?? issue.match,
                after: issue.context?.after ?? "",
            },
            suggestion: describeRuleAction(rule),
        };
    });
}

/**
 * 由规则 action / note 生成建议文案。note 是规则作者写的默认收窄说明，优先展示。
 */
export function describeRuleAction(rule: LlmlintRawRule): string | null {
    if (rule.note) {
        return rule.note;
    }
    const action = rule.action;
    if (!action) {
        return null;
    }
    if (action.type === "replace") {
        const replacements = action.replacements ?? [];
        return replacements.length === 0 ? "建议删除" : `建议改为：${replacements.join(" / ")}`;
    }
    if (action.type === "suggest" && action.message) {
        return action.message;
    }
    return null;
}

/**
 * 在 Bun 下用 `process.execPath`（就是 bun 本体），否则回落到 PATH 上的 `bun`。
 * 避免依赖 PATH 里 bun 的位置。
 */
export function resolveBunBinary(): string {
    return (process.versions as Record<string, string | undefined>).bun ? process.execPath : "bun";
}

/**
 * stdout 里若混入前后缀噪声（例如运行时告警），截取第一个 `{` 到最后一个 `}` 再解析。
 */
function extractJson(stdout: string): string {
    const trimmed = stdout.trim();
    if (trimmed.startsWith("{")) {
        return trimmed;
    }
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
        throw new Error("stdout 中找不到 JSON 对象");
    }
    return trimmed.slice(start, end + 1);
}
