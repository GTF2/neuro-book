import {describe, expect, it, vi} from "vitest";
import {auditChapterConsistency} from "nbook/server/consistency/chapter-consistency-audit.service";

const basePromise = {
    id: "7",
    storyId: "1",
    name: "old-debt",
    title: "旧债",
    status: "open" as const,
    derivedStage: "unplanted" as const,
    importance: "medium" as const,
    summary: "承诺",
    payoffExpectation: null,
    cadenceChapters: null,
    deadlineChapterId: "3",
    deadlineChapter: {id: "3", name: "chapter-3", title: "第三章"},
    tags: [],
    beatStats: {plant: 0, advance: 0, setback: 0, payoff: 0, planned: 0, factual: 0, archived: 0},
    createdAt: "2026-09-18T00:00:00.000Z",
    updatedAt: "2026-09-18T00:00:00.000Z",
};

function createPorts(options: {
    promises?: typeof basePromise[];
    existingSliceIds?: string[];
    lintIssues?: Array<{level: "high" | "medium" | "low"; line: number; column: number; match: string; ruleTitle: string; ruleId: string}>;
} = {}) {
    return {
        getChapter: vi.fn(async () => ({id: "3", title: "第三章", sortOrder: 2})),
        listPromises: vi.fn(async () => options.promises ?? [basePromise]),
        readWorldSliceIds: vi.fn(async () => new Set(options.existingSliceIds ?? [])),
        runLint: vi.fn(async () => ({issues: (options.lintIssues ?? []).map((issue) => ({
            ...issue,
            namespace: "test",
            review: "all" as const,
            fixability: "none",
            endLine: issue.line,
            endColumn: issue.column,
            context: {before: "", current: issue.match, after: ""},
            suggestion: null,
        }))})),
    };
}

const settlement = [
    "正文交付。",
    "## 本章结算",
    "### 新增事实",
    "- 人物：林晚受伤",
    "### 与既有设定的冲突点",
    "- 无",
    "### 未确定项",
    "- 无",
].join("\n");

describe("auditChapterConsistency", () => {
    it("检出期限正好落在本章且没有 factual beat 的 open Promise", async () => {
        const report = await auditChapterConsistency(createPorts(), {
            chapterId: 3,
            settlementText: settlement,
            prosePath: "manuscript/001/index.md",
            finalizedWorldSliceIds: [],
        });

        expect(report.promise).toMatchObject({
            availability: "ok",
            ok: false,
            issues: ["《旧债》到了该兑现的时候，这章没兑现。"],
        });
        expect(report.advice).toBe("这章先别定。把上面的硬伤处理了，我们再来一遍。");
    });

    it("结算自由文本没有 patch 映射时只报告不可核对，不伪称事实未写入世界", async () => {
        const report = await auditChapterConsistency(createPorts({existingSliceIds: ["slice-1"]}), {
            chapterId: 3,
            settlementText: settlement,
            prosePath: "manuscript/001/index.md",
            finalizedWorldSliceIds: ["slice-1"],
        });

        expect(report.world).toEqual({
            title: "状态对照",
            availability: "unknown",
            ok: false,
            issues: ["已找到本次 World 切面凭据；结算是自由文本，缺少事实到 patch 的结构化映射，无法逐条核对。"],
        });
    });

    it("缺少结算块时明确报告输入不可用", async () => {
        const report = await auditChapterConsistency(createPorts(), {
            chapterId: 3,
            settlementText: "没有结构化结算。",
            prosePath: "manuscript/001/index.md",
            finalizedWorldSliceIds: [],
        });

        expect(report.world).toMatchObject({availability: "unavailable", ok: false});
        expect(report.world.issues[0]).toContain("没有找到本章结算");
    });

    it("只投影 llmlint high 命中并按行排序、截断摘录", async () => {
        const report = await auditChapterConsistency(createPorts({
            promises: [],
            lintIssues: [
                {level: "medium", line: 1, column: 1, match: "忽略", ruleTitle: "中等", ruleId: "medium"},
                {level: "high", line: 20, column: 1, match: "第二处", ruleTitle: "规则二", ruleId: "second"},
                {level: "high", line: 5, column: 1, match: "这是一段超过二十个字符的测试摘录用于截断验证", ruleTitle: "规则一", ruleId: "first"},
            ],
        }), {
            chapterId: 3,
            settlementText: ["## 本章结算", "### 新增事实", "- 无"].join("\n"),
            prosePath: "manuscript/001/index.md",
            finalizedWorldSliceIds: [],
        });

        expect(report.text).toMatchObject({ok: false, summary: "扫出 2 处比较扎眼的，都列在下面。"});
        expect(report.text.issues).toEqual([
            {line: 5, excerpt: "这是一段超过二十个字符的测试摘录用于截断", ruleName: "规则一"},
            {line: 20, excerpt: "第二处", ruleName: "规则二"},
        ]);
    });
});
