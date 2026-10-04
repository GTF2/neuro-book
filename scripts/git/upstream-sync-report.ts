#!/usr/bin/env bun
/**
 * 上游同步试算：不落盘地算出「上游改动 ∩ fork 改动」的冲突面。
 *
 * fork 的生态位是「增量层玩家」（见 docs/standards/repository-workflow.md 的「上游同步（fork）」）：
 * 新增文件优于改共享文件，改共享文件只动叶子注册点。这个脚本把该纪律变成可执行判断——
 * 它只读，不做合并；给分级、给依据、给下一步命令，合并决策仍由人做。
 *
 * 输出三块：
 * 1. 同步窗口：落后/领先提交数、上游最近活跃。
 * 2. 试合并（git merge-tree，不落盘）：真实冲突文件清单。
 * 3. 风险面：fork 改过的共享文件里，哪些同时被上游改了（即使没冲突，也是语义冲突候选）。
 *
 * 用法：bun run sync:upstream [--repo-root <dir>] [--no-fetch] [--json]
 */
import {execFileSync} from "node:child_process";
import {resolve} from "node:path";

const UPSTREAM = "upstream/master";
const LOCAL = "master";

type Args = {repoRoot?: string; noFetch: boolean; json: boolean};

/** fork 独有路径前缀：新建为主、上游没有，天然零冲突。 */
const FORK_ONLY_PREFIXES = [".agents/", ".local/", ".worktree/"] as const;
/** 增量层白名单：改这些共享文件属既定纪律允许的形态（叶子注册点）。 */
const LEAF_REGISTRATION_FILES = [
    "packages/nb-ui/src/components/index.ts",
    "packages/neuro-book/shared/theme/theme-axes.ts",
    "packages/nb-ui/playground/app/installed-themes.ts",
    "packages/neuro-book/app/utils/workbench/product-catalog.ts",
    "packages/neuro-book/app/utils/workbench/view-factories.ts",
    "package.json",
] as const;

function parseArgs(argv: readonly string[]): {ok: true; value: Args} | {ok: false; reason: string} {
    const args: Args = {noFetch: false, json: false};
    let index = 0;
    while (index < argv.length) {
        const flag = argv[index];
        if (flag === "--no-fetch") {
            args.noFetch = true;
        } else if (flag === "--json") {
            args.json = true;
        } else if (flag === "--repo-root") {
            const value = argv[index + 1];
            if (value === undefined || value.startsWith("-")) return {ok: false, reason: "参数 --repo-root 缺少值"};
            args.repoRoot = value;
            index += 1;
        } else {
            return {ok: false, reason: `未知参数：${flag}`};
        }
        index += 1;
    }
    return {ok: true, value: args};
}

function git(repoRoot: string, args: readonly string[]): string {
    return execFileSync("git", [...args], {cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"]}).trimEnd();
}

/** 允许失败的 git 调用：merge-tree 有冲突时以非零退出，这不是脚本错误。 */
function gitAllowFailure(repoRoot: string, args: readonly string[]): {stdout: string; status: number} {
    try {
        return {stdout: execFileSync("git", [...args], {cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"]}).trimEnd(), status: 0};
    } catch (error) {
        const failed = error as {stdout?: Buffer | string; status?: number};
        return {stdout: String(failed.stdout ?? "").trimEnd(), status: failed.status ?? 1};
    }
}

export type SyncWindow = {
    behind: number;
    ahead: number;
    upstreamHead: string;
    upstreamHeadDate: string;
    upstreamHeadSubject: string;
    mergeBase: string;
};

export type ConflictReport = {
    /** 试合并是否干净（无冲突）。 */
    clean: boolean;
    /** 真实冲突文件（merge-tree 报告）。 */
    conflictFiles: readonly string[];
};

export type RiskEntry = {
    path: string;
    /** 上游是否也改了这个文件。 */
    upstreamTouched: boolean;
    /** fork 是否改了。 */
    forkTouched: boolean;
    /** 分类：fork-only / shared-leaf / shared-hot / shared。 */
    kind: "fork-only" | "shared-leaf" | "shared";
    /** 是否属于上游近活跃热区（按提交数判定，见同步纪律）。 */
    upstreamHot: boolean;
    /** 建议动作。 */
    advice: string;
};

export type SyncReport = {
    window: SyncWindow;
    merge: ConflictReport;
    /** fork 改过、且上游也改过的文件（语义冲突候选，含无文本冲突者）。 */
    overlap: readonly RiskEntry[];
    /** fork 改过、上游没改的文件（安全区）。 */
    forkOnly: readonly RiskEntry[];
    /** 建议命令序列。 */
    nextSteps: readonly string[];
};

const HOT_UPSTREAM_THRESHOLD = 8;

/** 上游近活跃热区：按提交数判定（不用文件触碰次数，见同步纪律）。 */
export function upstreamHotPaths(repoRoot: string, upstreamRef: string, sinceDays = 60): ReadonlySet<string> {
    const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString();
    const {stdout, status} = gitAllowFailure(repoRoot, ["log", `--since=${since}`, "--name-only", "--pretty=format:", upstreamRef]);
    if (status !== 0 || !stdout) return new Set();
    const counts = new Map<string, number>();
    for (const line of stdout.split("\n")) {
        const path = line.trim();
        if (!path) continue;
        counts.set(path, (counts.get(path) ?? 0) + 1);
    }
    const hot = new Set<string>();
    for (const [path, count] of counts) {
        if (count >= HOT_UPSTREAM_THRESHOLD) hot.add(path);
    }
    return hot;
}

function classify(path: string): RiskEntry["kind"] {
    if (FORK_ONLY_PREFIXES.some((prefix) => path.startsWith(prefix))) return "fork-only";
    if ((LEAF_REGISTRATION_FILES as readonly string[]).includes(path)) return "shared-leaf";
    return "shared";
}

function adviceFor(kind: RiskEntry["kind"], upstreamTouched: boolean, upstreamHot: boolean): string {
    if (kind === "fork-only") return "天然零冲突，正常合并。";
    if (!upstreamTouched) return "上游未动，正常合并。";
    if (kind === "shared-leaf") return "叶子注册点：合并后核对登记行是否与上游新增并列，不覆盖。";
    if (upstreamHot) return "上游热区：逐行对照文本与语义，冲突时优先保留双方意图（不整段取舍）。";
    return "共享文件：合并后核对语义是否被上游改变。";
}

export function buildSyncReport(repoRoot: string, options: {upstreamRef?: string; localRef?: string; hotDays?: number} = {}): SyncReport {
    const upstreamRef = options.upstreamRef ?? UPSTREAM;
    const localRef = options.localRef ?? LOCAL;

    const mergeBase = git(repoRoot, ["merge-base", upstreamRef, localRef]);
    const counts = git(repoRoot, ["rev-list", "--left-right", "--count", `${upstreamRef}...${localRef}`]).split(/\s+/u);
    const behind = Number(counts[0] ?? 0);
    const ahead = Number(counts[1] ?? 0);

    const upstreamHeadInfo = git(repoRoot, ["log", "-1", "--format=%H%n%ci%n%s", upstreamRef]).split("\n");
    const window: SyncWindow = {
        behind,
        ahead,
        upstreamHead: upstreamHeadInfo[0] ?? "",
        upstreamHeadDate: upstreamHeadInfo[1] ?? "",
        upstreamHeadSubject: upstreamHeadInfo[2] ?? "",
        mergeBase,
    };

    // 试合并：不落盘（--write-tree 只写对象库）。有冲突时 exit 1，输出为
    // 首行 tree hash + 冲突文件列表 + 人类可读提示行；只取文件行，不把提示当路径。
    const merged = gitAllowFailure(repoRoot, ["merge-tree", "--write-tree", "--name-only", localRef, upstreamRef]);
    const mergeLines = merged.stdout.split("\n").map((line) => line.trim()).filter(Boolean);
    const conflictFiles = merged.status === 0
        ? []
        : mergeLines.slice(1).filter((line) => !/^(Auto-merging|CONFLICT|warning:)/u.test(line));
    const merge: ConflictReport = {clean: merged.status === 0, conflictFiles};

    const forkTouchedFiles = new Set(git(repoRoot, ["diff", "--name-only", mergeBase, localRef]).split("\n").map((l) => l.trim()).filter(Boolean));
    const upstreamTouchedFiles = new Set(git(repoRoot, ["diff", "--name-only", mergeBase, upstreamRef]).split("\n").map((l) => l.trim()).filter(Boolean));
    const hot = upstreamHotPaths(repoRoot, upstreamRef, options.hotDays ?? 60);

    const overlap: RiskEntry[] = [];
    const forkOnly: RiskEntry[] = [];
    for (const path of [...forkTouchedFiles].sort()) {
        const upstreamTouched = upstreamTouchedFiles.has(path);
        const kind = classify(path);
        const entry: RiskEntry = {path, upstreamTouched, forkTouched: true, kind, upstreamHot: hot.has(path), advice: adviceFor(kind, upstreamTouched, hot.has(path))};
        if (upstreamTouched) overlap.push(entry);
        else forkOnly.push(entry);
    }

    const nextSteps = behind === 0
        ? ["落后为 0，无需同步。保持「上游一动就 fetch」的习惯即可。"]
        : [
            merge.clean
                ? "试合并干净：可执行 `git merge upstream/master`（无文本冲突；仍需核对下列重叠文件的语义）。"
                : `试合并有 ${merge.conflictFiles.length} 个冲突文件：先逐项对照文本与语义再合并，不整段取舍。`,
            "合并后按包合同重跑生成物（如 `bun run generate:openapi`），不手工编辑生成物。",
            "合并后跑一次聚焦测试与 typecheck，确认 fork 改动未被上游语义改变。",
        ];

    return {window, merge, overlap, forkOnly, nextSteps};
}

function renderHuman(report: SyncReport): string {
    const lines: string[] = [];
    const {window: w, merge, overlap, forkOnly} = report;
    lines.push("# 上游同步试算");
    lines.push("");
    lines.push(`同步窗口：落后 ${w.behind} / 领先 ${w.ahead}（base ${w.mergeBase.slice(0, 8)}）`);
    if (w.behind > 0) {
        lines.push(`上游 HEAD：${w.upstreamHead.slice(0, 8)} ${w.upstreamHeadDate} ${w.upstreamHeadSubject}`);
    }
    lines.push("");
    lines.push("## 试合并（不落盘）");
    lines.push(merge.clean ? "干净：无文本冲突。" : `冲突 ${merge.conflictFiles.length} 个文件：`);
    for (const file of merge.conflictFiles) lines.push(`  - ${file}`);
    lines.push("");
    lines.push(`## 重叠面（fork 改过 ∩ 上游改过）：${overlap.length} 个文件`);
    if (overlap.length === 0) {
        lines.push("  无。fork 改动全部落在上游未触及的文件上。");
    } else {
        for (const entry of overlap) {
            const tag = entry.kind === "shared-leaf" ? "叶子注册点" : entry.upstreamHot ? "上游热区" : "共享文件";
            lines.push(`  - [${tag}] ${entry.path}`);
            lines.push(`      ${entry.advice}`);
        }
    }
    lines.push("");
    lines.push(`## 安全区（fork 改过、上游未动）：${forkOnly.length} 个文件`);
    const forkOnlyByPrefix = new Map<string, number>();
    for (const entry of forkOnly) {
        const prefix = entry.path.split("/").slice(0, 2).join("/");
        forkOnlyByPrefix.set(prefix, (forkOnlyByPrefix.get(prefix) ?? 0) + 1);
    }
    for (const [prefix, count] of [...forkOnlyByPrefix].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
        lines.push(`  - ${prefix}/ … ${count}`);
    }
    lines.push("");
    lines.push("## 下一步");
    for (const step of report.nextSteps) lines.push(`  - ${step}`);
    return lines.join("\n");
}

async function main(): Promise<void> {
    const parsed = parseArgs(process.argv.slice(2));
    if (!parsed.ok) {
        console.error(`sync:upstream：${parsed.reason}`);
        process.exitCode = 2;
        return;
    }
    const repoRoot = resolve(parsed.value.repoRoot ?? git(process.cwd(), ["rev-parse", "--show-toplevel"]));

    if (!parsed.value.noFetch) {
        try {
            git(repoRoot, ["fetch", "upstream"]);
        } catch (error) {
            console.error(`sync:upstream：fetch upstream 失败（用 --no-fetch 跳过）`);
            console.error(String(error).slice(0, 300));
            process.exitCode = 1;
            return;
        }
    }

    try {
        const report = buildSyncReport(repoRoot);
        console.log(parsed.value.json ? JSON.stringify(report, null, 2) : renderHuman(report));
    } catch (error) {
        console.error(`sync:upstream：分析失败——${String(error).slice(0, 300)}`);
        process.exitCode = 1;
    }
}

if (import.meta.main) await main();
