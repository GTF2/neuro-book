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
    resolveBunBinary,
    resolveLlmlintSkillRoot,
    runLlmlintCheck,
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
});
