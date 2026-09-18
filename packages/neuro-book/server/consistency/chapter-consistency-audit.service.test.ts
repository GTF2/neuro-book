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
    beats: [],
    createdAt: "2026-09-18T00:00:00.000Z",
    updatedAt: "2026-09-18T00:00:00.000Z",
};

type PortsOptions = {
    promises?: typeof basePromise[];
    existingSliceIds?: string[];
    lintIssues?: Array<{level: "high" | "medium" | "low"; line: number; column: number; match: string; ruleTitle: string; ruleId: string}>;
    listPromisesError?: Error;
    lintError?: Error;
    worldError?: Error;
};

function createPorts(options: PortsOptions = {}) {
    return {
        getChapter: vi.fn(async () => ({id: "3", title: "第三章", sortOrder: 2})),
        listPromises: vi.fn(async () => {
            if (options.listPromisesError) throw options.listPromisesError;
            return options.promises ?? [basePromise];
        }),
        readWorldSliceIds: vi.fn(async () => {
            if (options.worldError) throw options.worldError;
            return new Set(options.existingSliceIds ?? []);
        }),
        runLint: vi.fn(async () => {
            if (options.lintError) throw options.lintError;
            return {issues: (options.lintIssues ?? []).map((issue) => ({
                ...issue,
                namespace: "test",
                review: "all" as const,
                fixability: "none",
                endLine: issue.line,
                endColumn: issue.column,
                context: {before: "", current: issue.match, after: ""},
                suggestion: null,
            }))};
        }),
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

const noFactsSettlement = ["## 本章结算", "### 新增事实", "- 无"].join("\n");

function input(settlementText = settlement) {
    return {chapterId: 3, settlementText, prosePath: "manuscript/001/index.md", finalizedWorldSliceIds: []};
}

describe("auditChapterConsistency", () => {
    it("检出期限正好落在本章且当前章没有 factual payoff 的 open Promise，但不阻止定稿", async () => {
        const report = await auditChapterConsistency(createPorts(), input());

        expect(report.promise).toMatchObject({availability: "ok", ok: false, issues: ["《旧债》到了该兑现的时候，这章没兑现。"]});
        expect(report.advice).toBe("问题不大，改不改你定：改完再定，或者先定、下次一起收拾。");
    });

    it("早期 factual plant 不能掩盖当前章没有 factual payoff", async () => {
        const promise = {...basePromise, beats: [{
            id: "beat-1", promiseId: "7", sceneId: "20", kind: "plant" as const, note: null, state: "factual" as const,
            scene: {id: "20", threadId: "2", title: "第一章场景", status: "written" as const, chapterId: "1", chapterSortOrder: 0},
            createdAt: basePromise.createdAt, updatedAt: basePromise.updatedAt,
        }]};
        const report = await auditChapterConsistency(createPorts({promises: [promise]}), input(noFactsSettlement));

        expect(report.promise.issues).toEqual(["《旧债》到了该兑现的时候，这章没兑现。"]);
    });

    it("别章 factual payoff 不能掩盖当前章没有 factual payoff", async () => {
        const promise = {...basePromise, beats: [{
            id: "beat-1", promiseId: "7", sceneId: "20", kind: "payoff" as const, note: null, state: "factual" as const,
            scene: {id: "20", threadId: "2", title: "第一章场景", status: "written" as const, chapterId: "1", chapterSortOrder: 0},
            createdAt: basePromise.createdAt, updatedAt: basePromise.updatedAt,
        }]};
        const report = await auditChapterConsistency(createPorts({promises: [promise]}), input(noFactsSettlement));

        expect(report.promise.issues).toEqual(["《旧债》到了该兑现的时候，这章没兑现。"]);
    });

    it("当前章 factual payoff 不报到期未兑现", async () => {
        const promise = {...basePromise, beats: [{
            id: "beat-1", promiseId: "7", sceneId: "20", kind: "payoff" as const, note: null, state: "factual" as const,
            scene: {id: "20", threadId: "2", title: "本章场景", status: "written" as const, chapterId: "3", chapterSortOrder: 2},
            createdAt: basePromise.createdAt, updatedAt: basePromise.updatedAt,
        }]};
        const report = await auditChapterConsistency(createPorts({promises: [promise]}), input(noFactsSettlement));

        expect(report.promise).toMatchObject({ok: true, issues: []});
    });

    it("unknown 的 World 对照不触发“问题不大”", async () => {
        const report = await auditChapterConsistency(createPorts({promises: []}), input());

        expect(report.world).toMatchObject({availability: "unknown", ok: false});
        expect(report.advice).toBe("还有无法核对的项，确认后再决定要不要定稿。");
    });

    it("结算自由文本没有 patch 映射时只报告不可核对，不伪称事实未写入世界", async () => {
        const report = await auditChapterConsistency(createPorts({promises: [], existingSliceIds: ["slice-1"]}), {
            ...input(), finalizedWorldSliceIds: ["slice-1"],
        });

        expect(report.world).toEqual({
            title: "状态对照", availability: "unknown", ok: false,
            issues: ["已找到本次 World 切面凭据；结算是自由文本，缺少事实到 patch 的结构化映射，无法逐条核对。"], pendingItems: [],
        });
    });

    it("结算 conflicts 进入 world issues 且触发 warning", async () => {
        const conflictSettlement = ["## 本章结算", "### 新增事实", "- 无", "### 与既有设定的冲突点", "- 林晚从未受伤却留下伤疤"].join("\n");
        const report = await auditChapterConsistency(createPorts({promises: []}), input(conflictSettlement));

        expect(report.world).toMatchObject({availability: "ok", ok: false, issues: ["结算自述与既有设定冲突：林晚从未受伤却留下伤疤"]});
        expect(report.advice).toBe("问题不大，改不改你定：改完再定，或者先定、下次一起收拾。");
    });

    it("结算 unresolved 作为显式待确认项，不当作错误", async () => {
        const unresolvedSettlement = ["## 本章结算", "### 新增事实", "- 无", "### 未确定项", "- 林晚是否知道真相"].join("\n");
        const report = await auditChapterConsistency(createPorts({promises: []}), input(unresolvedSettlement));

        expect(report.world).toMatchObject({availability: "ok", ok: true, issues: [], pendingItems: ["林晚是否知道真相"]});
        expect(report.advice).toBe("三样都过关。就差你一句话——定，还是再看看？");
    });

    it("listPromises、lint 与 World 读取失败各自降级，不让整份报告失败", async () => {
        const promiseReport = await auditChapterConsistency(createPorts({listPromisesError: new Error("账本断开")}), input(noFactsSettlement));
        const lintReport = await auditChapterConsistency(createPorts({promises: [], lintError: new Error("规则载入失败")}), input(noFactsSettlement));
        const worldReport = await auditChapterConsistency(createPorts({promises: [], worldError: new Error("World 服务不可用")}), {
            ...input(),
            finalizedWorldSliceIds: ["slice-1"],
        });

        expect(promiseReport.promise).toMatchObject({availability: "unavailable", ok: false});
        expect(promiseReport.promise.issues[0]).toContain("账本断开");
        expect(lintReport.text).toMatchObject({availability: "unavailable", ok: false});
        expect(lintReport.text.summary).toContain("规则载入失败");
        expect(worldReport.world).toMatchObject({availability: "unavailable", ok: false});
        expect(worldReport.world.issues.at(-1)).toContain("World 服务不可用");
    });

    it("缺少结算块时明确报告输入不可用", async () => {
        const report = await auditChapterConsistency(createPorts({promises: []}), input("没有结构化结算。"));
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
        }), input(noFactsSettlement));

        expect(report.text).toMatchObject({ok: false, summary: "扫出 2 处比较扎眼的，都列在下面。"});
        expect(report.text.issues).toEqual([
            {line: 5, excerpt: "这是一段超过二十个字符的测试摘录用于截断", ruleName: "规则一"},
            {line: 20, excerpt: "第二处", ruleName: "规则二"},
        ]);
    });
});
