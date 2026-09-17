import {existsSync} from "node:fs";
import {mkdir, mkdtemp, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {afterEach, describe, expect, it} from "vitest";
import {runtimePathsFromEnv} from "nbook/server/runtime/paths/runtime-paths";
import {
    describeRuleAction,
    enrichIssues,
    llmlintSkillRootCandidates,
    parseLlmlintCheckOutput,
    parseLlmlintScanOutput,
    resolveBunBinary,
    resolveLlmlintSkillRoot,
    runLlmlintCheck,
    runLlmlintScan,
} from "nbook/server/workspace-files/llmlint-check";

/**
 * 测试里直接定位 monorepo 里的 llmlint skill 源码副本。
 * 用向上查找而不是写死层级，避免改目录深度就失效。
 */
function findRepoRoot(startDir: string): string {
    let dir = startDir;
    for (let depth = 0; depth < 12; depth += 1) {
        if (existsSync(join(dir, "packages", "llmlint", "skill", "bin", "llmlint.ts"))) {
            return dir;
        }
        const parent = dirname(dir);
        if (parent === dir) {
            break;
        }
        dir = parent;
    }
    return startDir;
}

const REPO_ROOT = findRepoRoot(dirname(fileURLToPath(import.meta.url)));
const LLMLINT_SKILL_ROOT = resolve(REPO_ROOT, "packages", "llmlint", "skill");
const LLMLINT_AVAILABLE = existsSync(join(LLMLINT_SKILL_ROOT, "bin", "llmlint.ts"));

const COMPACT_REPORT = JSON.stringify({
    kind: "check",
    filePath: "manuscript/chapter.md",
    summary: {total: 1, high: 0, medium: 1, low: 0, visibleChars: 12},
    filter: {review: "agent", hiddenByReview: 78, minLevel: "low", hiddenByLevel: 0},
    registry: {rulesets: ["builtin/default"], totalRules: 360, activeRules: 266, disabledRules: 94},
    diagnostics: [],
    rules: {
        "filler-word-actually": {
            namespace: "filler",
            title: "删填充词",
            level: "medium",
            review: "agent",
            fixability: "candidate",
            action: {type: "replace", replacements: [""]},
            note: "建议删除。",
        },
    },
    issues: [{
        ruleId: "filler-word-actually",
        line: 1,
        column: 9,
        endLine: 1,
        endColumn: 10,
        match: "其实",
        context: {before: "…", current: "其实", after: "…"},
    }],
});

describe("llmlint check 报告解析", () => {
    it("把 rules 元数据 join 进逐处命中并归一化为稳定 DTO", () => {
        const result = parseLlmlintCheckOutput(COMPACT_REPORT, "fallback.md");

        expect(result.kind).toBe("check");
        expect(result.filePath).toBe("manuscript/chapter.md");
        expect(result.summary).toEqual({total: 1, high: 0, medium: 1, low: 0, visibleChars: 12});
        expect(result.filter).toEqual({review: "agent", hiddenByReview: 78, minLevel: "low", hiddenByLevel: 0});
        expect(result.registry.rulesets).toEqual(["builtin/default"]);
        expect(result.issues).toHaveLength(1);
        expect(result.issues[0]).toMatchObject({
            ruleId: "filler-word-actually",
            ruleTitle: "删填充词",
            namespace: "filler",
            level: "medium",
            review: "agent",
            fixability: "candidate",
            line: 1,
            column: 9,
            match: "其实",
            suggestion: "建议删除。",
        });
    });

    it("stdout 混入前后缀噪声时仍能截取 JSON 对象", () => {
        const noisy = `runtime warning: something\n${COMPACT_REPORT}\n`;
        const result = parseLlmlintCheckOutput(noisy, "fallback.md");
        expect(result.issues[0]?.ruleId).toBe("filler-word-actually");
    });

    it("kind 不是 check（例如 check-multi）时明确报错", () => {
        expect(() => parseLlmlintCheckOutput(JSON.stringify({kind: "check-multi"}), "x.md"))
            .toThrow("不是单文件 check 形态");
    });

    it("规则字典缺该 ruleId 时给安全兜底", () => {
        const issues = enrichIssues({
            issues: [{ruleId: "unknown", line: 2, column: 1, endLine: 2, endColumn: 2, match: "词"}],
            rules: {},
        });
        expect(issues[0]).toMatchObject({ruleId: "unknown", ruleTitle: "unknown", level: "medium", suggestion: null});
    });
});

const MULTI_REPORT = JSON.stringify({
    kind: "check-multi",
    configPath: null,
    filter: {review: "all", hiddenByReview: 0, minLevel: "low", hiddenByLevel: 0},
    registry: {rulesets: ["builtin/default"], totalRules: 360, activeRules: 266, disabledRules: 94},
    diagnostics: [],
    rules: {
        "firstly-secondly": {
            namespace: "transition",
            title: "机械过渡",
            level: "high",
            review: "agent",
            fixability: "manual",
        },
        "filler-word-actually": {
            namespace: "filler",
            title: "删填充词",
            level: "medium",
            review: "agent",
            fixability: "candidate",
            note: "建议删除。",
        },
    },
    files: [
        {
            filePath: "C:/book/manuscript/chapter-001.md",
            summary: {total: 2, high: 1, medium: 1, low: 0, visibleChars: 100},
            issues: [
                {ruleId: "firstly-secondly", line: 3, column: 1, endLine: 3, endColumn: 3, match: "首先", context: {before: "", current: "首先", after: ""}},
                {ruleId: "filler-word-actually", line: 5, column: 9, endLine: 5, endColumn: 11, match: "其实"},
            ],
        },
        {
            filePath: "C:/book/manuscript/chapter-002.md",
            summary: {total: 1, high: 1, medium: 0, low: 0, visibleChars: 200},
            issues: [
                {ruleId: "firstly-secondly", line: 2, column: 1, endLine: 2, endColumn: 3, match: "首先", context: {before: "，", current: "首先", after: "我们"}},
            ],
        },
        {
            filePath: "C:/book/manuscript/chapter-003.md",
            summary: {total: 0, high: 0, medium: 0, low: 0, visibleChars: 50},
            issues: [],
        },
    ],
    summary: {total: 3, high: 2, medium: 1, low: 0, visibleChars: 350},
});

describe("llmlint scan 报告解析（目录模式聚合）", () => {
    it("check-multi 归一化为三维聚合 DTO：按文件 / 按级别 / 按规则 + top 命中 + 总字数", () => {
        const result = parseLlmlintScanOutput(MULTI_REPORT, "C:/book/manuscript");

        expect(result.kind).toBe("check-scan");
        expect(result.rootPath).toBe("C:/book/manuscript");
        // 级别维度 + 总字数。
        expect(result.summary).toEqual({total: 3, high: 2, medium: 1, low: 0, visibleChars: 350});
        expect(result.fileCount).toBe(3);
        expect(result.filesWithIssues).toBe(2);
        // 文件维度：命中数降序、同分路径升序；含相对路径。
        expect(result.files.map((file) => file.relativePath)).toEqual(["chapter-001.md", "chapter-002.md", "chapter-003.md"]);
        expect(result.files[0]).toMatchObject({total: 2, high: 1, medium: 1, low: 0, visibleChars: 100});
        // 规则维度：count / fileCount 聚合正确，次数降序。
        expect(result.rules).toEqual([
            {ruleId: "firstly-secondly", ruleTitle: "机械过渡", namespace: "transition", level: "high", review: "agent", count: 2, fileCount: 2},
            {ruleId: "filler-word-actually", ruleTitle: "删填充词", namespace: "filler", level: "medium", review: "agent", count: 1, fileCount: 1},
        ]);
        // top 命中：级别降序在前、带归属文件与建议文案；默认有界 20。
        expect(result.topIssues).toHaveLength(3);
        expect(result.topIssues[0]).toMatchObject({ruleId: "firstly-secondly", level: "high", filePath: "C:/book/manuscript/chapter-001.md", line: 3, suggestion: null});
        expect(result.topIssues[1]).toMatchObject({ruleId: "firstly-secondly", filePath: "C:/book/manuscript/chapter-002.md", line: 2});
        expect(result.topIssues[2]).toMatchObject({ruleId: "filler-word-actually", level: "medium", suggestion: "建议删除。"});
        expect(result.durationMs).toBe(0);
    });

    it("topIssuesLimit 有界且 0 表示不要 top 命中", () => {
        const limited = parseLlmlintScanOutput(MULTI_REPORT, "C:/book/manuscript", {topIssuesLimit: 1});
        expect(limited.topIssues).toHaveLength(1);
        const none = parseLlmlintScanOutput(MULTI_REPORT, "C:/book/manuscript", {topIssuesLimit: 0});
        expect(none.topIssues).toEqual([]);
        const overflow = parseLlmlintScanOutput(MULTI_REPORT, "C:/book/manuscript", {topIssuesLimit: 9999});
        expect(overflow.topIssues).toHaveLength(3);
    });

    it("目录里只有一个文件时 CLI 退化为单文件 check 形态，同样归一化", () => {
        const single = JSON.stringify({
            kind: "check",
            filePath: "C:/book/manuscript/only.md",
            summary: {total: 1, high: 0, medium: 1, low: 0, visibleChars: 42},
            filter: {review: "all", hiddenByReview: 0, minLevel: "low", hiddenByLevel: 0},
            registry: {rulesets: ["builtin/default"], totalRules: 10, activeRules: 8, disabledRules: 2},
            diagnostics: [],
            rules: {"filler-word-actually": {namespace: "filler", title: "删填充词", level: "medium", review: "agent", fixability: "candidate"}},
            issues: [{ruleId: "filler-word-actually", line: 1, column: 1, endLine: 1, endColumn: 3, match: "其实"}],
        });
        const result = parseLlmlintScanOutput(single, "C:/book/manuscript", {durationMs: 7});
        expect(result.kind).toBe("check-scan");
        expect(result.fileCount).toBe(1);
        expect(result.filesWithIssues).toBe(1);
        expect(result.summary).toEqual({total: 1, high: 0, medium: 1, low: 0, visibleChars: 42});
        expect(result.durationMs).toBe(7);
        expect(result.topIssues[0]).toMatchObject({ruleId: "filler-word-actually", filePath: "C:/book/manuscript/only.md"});
    });

    it("kind 既不是 check 也不是 check-multi 时明确报错", () => {
        expect(() => parseLlmlintScanOutput(JSON.stringify({kind: "fix"}), "dir"))
            .toThrow("不是扫描形态");
    });

    it("stdout 混入前后缀噪声时仍能截取 JSON 对象", () => {
        const noisy = `runtime warning: something\n${MULTI_REPORT}\n`;
        const result = parseLlmlintScanOutput(noisy, "C:/book/manuscript");
        expect(result.fileCount).toBe(3);
    });
});

describe("describeRuleAction", () => {
    it("note 优先于 action", () => {
        expect(describeRuleAction({
            note: "默认收窄说明",
            action: {type: "replace", replacements: ["甲"]},
        })).toBe("默认收窄说明");
    });

    it("replace 有替换词时给出替换建议", () => {
        expect(describeRuleAction({action: {type: "replace", replacements: ["头", "脑袋"]}}))
            .toBe("建议改为：头 / 脑袋");
    });

    it("replace 无替换词时建议删除", () => {
        expect(describeRuleAction({action: {type: "replace", replacements: []}})).toBe("建议删除");
    });

    it("suggest 用 message", () => {
        expect(describeRuleAction({action: {type: "suggest", message: "读取上下文再改"}}))
            .toBe("读取上下文再改");
    });

    it("无 action 时返回 null", () => {
        expect(describeRuleAction({})).toBeNull();
    });
});

describe("llmlint skill root 解析", () => {
    const runtimePaths = runtimePathsFromEnv(REPO_ROOT);

    it("候选顺序是「monorepo 源码副本」在前、运行态投影副本在后", () => {
        const candidates = llmlintSkillRootCandidates(runtimePaths);
        expect(candidates[0]).toBe(resolve(REPO_ROOT, "packages", "llmlint", "skill"));
        expect(candidates[1]).toContain(join("agent", "skills", "llmlint"));
    });

    it("返回第一个存在的候选", async () => {
        const picked = await resolveLlmlintSkillRoot(runtimePaths, {
            existsImpl: async (candidate) => candidate === llmlintSkillRootCandidates(runtimePaths)[1],
        });
        expect(picked).toBe(llmlintSkillRootCandidates(runtimePaths)[1]);
    });

    it("全部候选都不存在时抛明确错误", async () => {
        await expect(resolveLlmlintSkillRoot(runtimePaths, {existsImpl: async () => false}))
            .rejects.toThrow("找不到 llmlint skill");
    });
});

describe("resolveBunBinary", () => {
    it("Bun 运行时用 process.execPath，否则回落 PATH 上的 bun", () => {
        const binary = resolveBunBinary();
        expect(typeof binary).toBe("string");
        expect(binary.length).toBeGreaterThan(0);
    });
});

describe("runLlmlintCheck 真实调用 CLI", () => {
    const tempRoots: string[] = [];

    afterEach(async () => {
        await Promise.all(tempRoots.map((root) => rm(root, {recursive: true, force: true})));
        tempRoots.length = 0;
    });

    it.skipIf(!LLMLINT_AVAILABLE)("对真实文件跑 check，返回结构化命中", async () => {
        const root = await mkdtemp(join(tmpdir(), "llmlint-check-endpoint-"));
        tempRoots.push(root);
        const filePath = join(root, "chapter.md");
        // 「首先…其次…最后」默认命中 firstly-secondly（builtin/default，high）。
        await writeFile(filePath, "首先我们要分析问题，其次要制定方案，最后执行。\n", "utf-8");

        const result = await runLlmlintCheck({
            skillRoot: LLMLINT_SKILL_ROOT,
            absoluteFilePath: filePath,
            review: "all",
            timeoutMs: 60_000,
        });

        expect(result.kind).toBe("check");
        expect(result.issues.some((issue) => issue.ruleId === "firstly-secondly")).toBe(true);
        expect(result.summary.total).toBeGreaterThanOrEqual(1);
    }, 120_000);

    it.skipIf(!LLMLINT_AVAILABLE)("被扫描文件不会被写回（只读保证）", async () => {
        const root = await mkdtemp(join(tmpdir(), "llmlint-check-readonly-"));
        tempRoots.push(root);
        const filePath = join(root, "chapter.md");
        const original = "其实这个问题，首先值得说明。\n";
        await writeFile(filePath, original, "utf-8");

        await runLlmlintCheck({skillRoot: LLMLINT_SKILL_ROOT, absoluteFilePath: filePath, review: "all", timeoutMs: 60_000});

        const {readFile} = await import("node:fs/promises");
        expect(await readFile(filePath, "utf-8")).toBe(original);
    }, 120_000);

    it.skipIf(!LLMLINT_AVAILABLE)("对目录跑扫描，返回三维聚合结果且不写回任何文件", async () => {
        const root = await mkdtemp(join(tmpdir(), "llmlint-scan-endpoint-"));
        tempRoots.push(root);
        const manuscriptDir = join(root, "manuscript");
        await mkdir(join(manuscriptDir, "vol1"), {recursive: true});
        await writeFile(join(manuscriptDir, "vol1", "chapter-001.md"), "首先我们要分析问题，其次要制定方案，最后执行。\n", "utf-8");
        await writeFile(join(manuscriptDir, "vol1", "chapter-002.md"), "夜色渐深，他合上书。\n", "utf-8");
        await writeFile(join(manuscriptDir, "notes.txt"), "其实只是随手记。\n", "utf-8");

        const before = await (await import("node:fs/promises")).readFile(join(manuscriptDir, "vol1", "chapter-001.md"), "utf-8");
        const result = await runLlmlintScan({
            skillRoot: LLMLINT_SKILL_ROOT,
            absoluteDirPath: manuscriptDir,
            review: "all",
            timeoutMs: 120_000,
        });

        expect(result.kind).toBe("check-scan");
        expect(result.fileCount).toBe(3);
        expect(result.fileCount).toBe(result.files.length);
        // 三维聚合自洽：文件级合计 = 总 summary。
        const fileTotals = result.files.reduce((sum, file) => sum + file.total, 0);
        expect(fileTotals).toBe(result.summary.total);
        const ruleTotals = result.rules.reduce((sum, rule) => sum + rule.count, 0);
        expect(ruleTotals).toBe(result.summary.total);
        expect(result.files.some((file) => file.relativePath === "vol1/chapter-001.md")).toBe(true);
        expect(result.rules.some((rule) => rule.ruleId === "firstly-secondly")).toBe(true);
        expect(result.summary.visibleChars).toBeGreaterThan(0);
        expect(result.durationMs).toBeGreaterThanOrEqual(0);
        // 只读保证：目录内容不变。
        const after = await (await import("node:fs/promises")).readFile(join(manuscriptDir, "vol1", "chapter-001.md"), "utf-8");
        expect(after).toBe(before);
    }, 180_000);
});
