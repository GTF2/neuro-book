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
    parseActivityParamsObject,
    type JsonValue,
    type AgentWorkflowDefinition,
} from "@notnotype/nb-workflow";

/**
 * keyframe-tween-review 的无模型运行级回归(写作宪法第三条):
 * catalog 真编译 Type 注入源码,MockAgentPort 按 profile/内容分流真实控制流。
 */
describe("keyframe-tween-review workflow", () => {
    const installRoot = testHostPath("tmp", "keyframe-tween-install");
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

    /** 从 catalog 取定义;缺失时让测试以明确错误失败。 */
    async function workflow(key: string): Promise<AgentWorkflowDefinition> {
        const item = await catalog.get(key);
        if (!item) throw new Error(`测试所需 workflow 不存在：${key}`);
        return item.def;
    }

    const fromKeyframe = "起点帧 k-start(100):薇洛丝持有项链;格里沙在场。";
    const toKeyframe = "终点帧 k-necklace-lost(500):irreversibleChanges: 薇洛丝失去项链。";
    const tweenBody = "薇洛丝在混乱中被撞倒,项链脱手滚入裂缝。她伸手只抓到一把雪。";

    test("正常路径:补间演化 → 回撞无冲突 → clean", async () => {
        const sessions = new MemorySessionStore();
        const agents = new MockAgentPort(sessions);
        const writerMessages: string[] = [];
        agents.register("writer", (turn): {message: string; data: JsonValue} => {
            writerMessages.push(turn.message ?? "");
            return {
                message: "补间演化完成",
                data: {summary: "项链在混乱中失去", text: tweenBody, outputPath: chapterPath},
            };
        });
        agents.register("adhoc", (turn): {message: string; data: JsonValue} => {
            if (!turn.message?.includes("回撞校验")) throw new Error(`意外的校验 message：${turn.message}`);
            return {
                message: "回撞完成",
                data: {overall: "正文兑现了终点帧声明,无冲突。", violations: []},
            };
        });
        const runner = new WorkflowRunner({sessions, agents}, {
            workspace: createMemoryWorkspace({[chapterPath]: ""}),
        });

        const view = await runner.start(await workflow("keyframe-tween-review"), {
            fromKeyframe,
            toKeyframe,
            chapterPath,
            worldFacts: "项链在薇洛丝身上。",
        });

        expect(view.status).toBe("completed");
        expect(view.result).toMatchObject({
            chapterPath,
            tweenSummary: "项链在混乱中失去",
            tweenLength: tweenBody.length,
            violations: [],
            verdict: "clean",
        });
        // writer 的动笔前输入只含事实切片,不含意义指令段(宪法第五条;指令词在否定句里出现不算)。
        for (const message of writerMessages) {
            expect(message).toContain("起点帧状态");
            expect(message).toContain("终点帧声明");
            expect(message).not.toContain("必须隐藏");
            expect(message).not.toContain("【禁写");
        }
        // 参与者:1 个非 ephemeral writer + 1 个 ephemeral 回撞校验员。
        const creates = view.journal
            .filter((record) => record.kind === "agents.create")
            .map((record) => parseActivityParamsObject(record) ?? {});
        expect(creates.filter((params) => params.profileKey === "writer")).toMatchObject([{ephemeral: false}]);
        expect(creates.filter((params) => params.profileKey === "adhoc")).toMatchObject([{ephemeral: true}]);
    });

    test("回撞发现冲突:violated 清单进入结果,由 leader 裁决", async () => {
        const sessions = new MemorySessionStore();
        const agents = new MockAgentPort(sessions);
        agents.register("writer", (): {message: string; data: JsonValue} => ({
            message: "补间演化完成",
            data: {summary: "项链还在她手里", text: "薇洛丝握紧项链,没有任何失去。"},
        }));
        agents.register("adhoc", (): {message: string; data: JsonValue} => ({
            message: "回撞完成",
            data: {
                overall: "正文与终点帧声明冲突。",
                violations: [{
                    keyframeName: "k-necklace-lost",
                    change: "薇洛丝失去项链",
                    problem: "正文写她握紧项链,失去未发生(「薇洛丝握紧项链」)。",
                    suggestion: "补一段项链脱手的动作。",
                }],
            },
        }));
        const runner = new WorkflowRunner({sessions, agents}, {
            workspace: createMemoryWorkspace({}),
        });

        const view = await runner.start(await workflow("keyframe-tween-review"), {
            fromKeyframe,
            toKeyframe,
        });

        expect(view.status).toBe("completed");
        expect(view.result).toMatchObject({
            chapterPath: null,
            verdict: "violated",
            violations: [{keyframeName: "k-necklace-lost", change: "薇洛丝失去项链"}],
        });
    });

    test("缺少帧声明:在创建任何 agent 前失败", async () => {
        const sessions = new MemorySessionStore();
        const agents = new MockAgentPort(sessions);
        let invokes = 0;
        agents.register("writer", () => {
            invokes++;
            return {message: "不应调用"};
        });
        agents.register("adhoc", () => {
            invokes++;
            return {message: "不应调用"};
        });
        const runner = new WorkflowRunner({sessions, agents}, {
            workspace: createMemoryWorkspace({}),
        });

        const view = await runner.start(await workflow("keyframe-tween-review"), {
            fromKeyframe,
        });

        expect(view.status).toBe("failed");
        expect(view.error).toContain("缺少关键帧声明");
        expect(invokes).toBe(0);
    });
});
