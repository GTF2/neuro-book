import {testHostPath} from "@notnotype/neuro-book-test-support/test-path";
import {cp, rm} from "node:fs/promises";
import {resolve} from "node:path";
import {afterAll, beforeAll, describe, expect, test} from "vitest";
import {WorkflowCatalog} from "nbook/server/agent/workflow/workflow-catalog";
import {
    MemorySessionStore,
    MockAgentPort,
    WorkflowRunner,
    createMemoryWorkspace,
    type AgentWorkflowDefinition,
    type JsonValue,
} from "@notnotype/nb-workflow";

/**
 * contrast-write-review 的无模型运行级回归（实验专用 workflow）。
 *
 * 本 workflow 存在的唯一理由是给对照实验一条「调用方显式给定 writer 提示」的受控通道，
 * 所以最关键的不变量是：**writer 的 message 与调用方传入的 writerBrief 相同（仅首尾空白被 trim）**；
 * 核对单只注入一致性评审，不进 writer。
 */
describe("contrast-write-review workflow", () => {
    const installRoot = testHostPath("tmp", "contrast-write-review-install");
    let catalog: WorkflowCatalog;
    beforeAll(async () => {
        await rm(installRoot, {recursive: true, force: true});
        await cp(resolve("assets", "workspace", ".nbook", "agent", "workflows"), installRoot, {recursive: true});
        catalog = new WorkflowCatalog(installRoot);
    });
    afterAll(async () => {
        await rm(installRoot, {recursive: true, force: true});
    });
    const chapterPath = "manuscript/001-volume/001-chapter/index.md";
    const chapterBody = "# 第一章 星陨遗迹\n薇洛丝在遗迹深处解开了封印。";
    const infoControl = "必须隐藏：项链是前作遗物";
    /** 从 catalog 取定义；缺失时让测试以明确错误失败。 */
    async function workflow(key: string): Promise<AgentWorkflowDefinition> {
        const item = await catalog.get(key);
        if (!item) throw new Error(`测试所需 workflow 不存在：${key}`);
        return item.def;
    }

    test("实验通道：writer 提示逐字下发，核对单只进一致性评审", async () => {
        const sessions = new MemorySessionStore();
        const agents = new MockAgentPort(sessions);
        const writerMessages: string[] = [];
        const reviewerMessages: string[] = [];
        // A 组形态：事实切片 + 意图清单；实验通道必须原样下发（含意义指令）。
        const writerBrief = `# Chapter Writer Brief\n\nStatus: ready\n\n## 信息控制（事后核对）\n- ${infoControl}\n`;
        agents.register("writer", (turn): {message: string; data: JsonValue} => {
            writerMessages.push(turn.message ?? "");
            return {message: "章节写作完成", data: {summary: "样本完成", outputPath: chapterPath}};
        });
        agents.register("adhoc", (turn): {message: string; data: JsonValue} => {
            reviewerMessages.push(turn.message ?? "");
            return {message: "评审完成", data: {overall: "本轮无 major 问题", issues: []}};
        });
        const runner = new WorkflowRunner({sessions, agents}, {
            workspace: createMemoryWorkspace({[chapterPath]: chapterBody}),
        });

        const view = await runner.start(await workflow("contrast-write-review"), {
            chapterPath,
            writerBrief,
            reviewChecklist: infoControl,
            lorebookEntries: "lorebook/character/weiluosi/",
        });

        expect(view.status).toBe("completed");
        // 实验通道契约：message 就是调用方给定的提示，只有首尾空白被 trim，其余一字不改。
        expect(writerMessages).toEqual([writerBrief.trim()]);
        expect(view.result).toMatchObject({
            chapterPath,
            writerBriefLength: writerBrief.trim().length,
            reviewChecklistLength: infoControl.length,
            finalSummary: "样本完成",
            finalLength: chapterBody.length,
        });
        const reviews = (view.result as {reviews: {dimension: string}[]}).reviews;
        expect(reviews.map((review) => review.dimension)).toEqual(["consistency", "pacing", "style"]);
        // 三维评审各一次；核对单只出现在一致性评审里。
        expect(reviewerMessages).toHaveLength(3);
        const consistency = reviewerMessages.find((message) => message.startsWith("你是章节评审（一致性）。"));
        expect(consistency).toContain("【信息控制事后核对】");
        expect(consistency).toContain(infoControl);
        for (const message of reviewerMessages.filter((item) => !item.startsWith("你是章节评审（一致性）。"))) {
            expect(message).not.toContain("信息控制事后核对");
        }
        // 实验不修订：writer 只被调一次。
        expect(writerMessages).toHaveLength(1);
    });

    test("缺 writerBrief：在创建任何 agent 前失败", async () => {
        const sessions = new MemorySessionStore();
        const agents = new MockAgentPort(sessions);
        let invokes = 0;
        agents.register("writer", () => {
            invokes++;
            return {message: "不应调用"};
        });
        const runner = new WorkflowRunner({sessions, agents}, {
            workspace: createMemoryWorkspace({[chapterPath]: chapterBody}),
        });

        const view = await runner.start(await workflow("contrast-write-review"), {chapterPath});

        expect(view.status).toBe("failed");
        expect(view.error).toContain("缺少 writerBrief");
        expect(invokes).toBe(0);
        expect(view.journal.some((record) => record.kind === "agents.create")).toBe(false);
    });

    test("缺 chapterPath：在创建任何 agent 前失败", async () => {
        const sessions = new MemorySessionStore();
        const agents = new MockAgentPort(sessions);
        let invokes = 0;
        agents.register("writer", () => {
            invokes++;
            return {message: "不应调用"};
        });
        const runner = new WorkflowRunner({sessions, agents}, {
            workspace: createMemoryWorkspace({[chapterPath]: chapterBody}),
        });

        const view = await runner.start(await workflow("contrast-write-review"), {
            writerBrief: "只有提示没有路径",
        });

        expect(view.status).toBe("failed");
        expect(view.error).toContain("缺少 chapterPath");
        expect(invokes).toBe(0);
        expect(view.journal.some((record) => record.kind === "agents.create")).toBe(false);
    });
});
