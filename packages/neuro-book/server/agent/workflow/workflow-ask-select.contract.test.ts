import {describe, expect, test} from "vitest";
import {MemorySessionStore, MockAgentPort, WorkflowRunner} from "@notnotype/nb-workflow";
import type {AgentWorkflowDefinition, JsonValue} from "@notnotype/nb-workflow";

/**
 * 「多候选 + 人点选」契约验证（纲领「否决权显式化」/ P1-1 的前置门槛）。
 *
 * 关键帧补间（keyframe-expand）要成立，必须先在真实内核上确认四件事：
 * 1. 候选以 select ask 摆出后，Run 停在 waiting，且「以上都不行」是一个一等选项；
 * 2. 人不应答时 Run 不会自己往下走，也不会写正文（缺省 = 停住，不是选第一条）；
 * 3. 人选之后只写一次；
 * 4. 没有绕过人的通道（空应答被拒、rerun 被拒、完成后不能重复选择）。
 *
 * 这里用最小 workflow 复刻该形状，不依赖真实模型与真实 profile。
 * 该文件是 keyframe-expand 的契约兜底：一旦内核语义变化，先在这里失败。
 */
describe("workflow 候选选择契约（keyframe-expand 前置）", () => {
    /** 三条候选路径 + 一个「以上都不行」，模拟 beat 级补间候选。 */
    const CANDIDATE_OPTIONS = [
        {id: "c1", label: "候选一：主角直接逼问"},
        {id: "c2", label: "候选二：主角先按住不说"},
        {id: "c3", label: "候选三：第三方撞破"},
        {id: "none", label: "以上都不行"},
    ];

    function buildRunner(): {runner: WorkflowRunner} {
        const sessions = new MemorySessionStore();
        const agents = new MockAgentPort(sessions);
        // 「写手」只在人选之后才会被创建；用 journal 里的 agents.invoke 作为「写了正文」的证据。
        agents.register("workflow.demo.writer", () => ({message: "正文已写入", data: {wrote: true} as JsonValue}));
        return {runner: new WorkflowRunner({sessions, agents})};
    }

    /** 最小形状：出候选 → 等人点选 → 只写一次。 */
    function candidateWorkflow(): AgentWorkflowDefinition {
        return {
            key: "ask-select-candidates",
            phases: [
                {key: "propose", title: "出候选"},
                {key: "write", title: "写正文"},
            ],
            run: async (wf) => {
                wf.progress({phase: "propose"});
                const chosen = await wf.ask({
                    kind: "select",
                    title: "选一条补间路径（都不满意可选「以上都不行」）",
                    options: CANDIDATE_OPTIONS,
                });
                if (chosen === "none") {
                    return {chosen: null, wrote: false};
                }
                wf.progress({phase: "write"});
                const writer = await wf.agents.create("workflow.demo.writer", {});
                await writer.invoke({message: "按选中的候选写一次正文"});
                return {chosen, wrote: true};
            },
        };
    }

    /** 「写了正文」的证据：journal 中的 agent 调用记录数。 */
    function invokedCount(view: {journal: Array<{kind: string}>}): number {
        return view.journal.filter((record) => record.kind === "agents.invoke").length;
    }

    test("出候选后停在 waiting，候选与「以上都不行」一一可见，且尚未写正文", async () => {
        const {runner} = buildRunner();
        const view = await runner.start(candidateWorkflow(), null);

        expect(view.status).toBe("waiting");
        expect(view.pendingAsks).toHaveLength(1);
        const ask = view.pendingAsks[0]!;
        expect(ask.spec.kind).toBe("select");
        expect(ask.spec.options?.map((option) => option.id)).toEqual(["c1", "c2", "c3", "none"]);
        expect(ask.spec.options?.at(-1)?.label).toBe("以上都不行");
        // 人不选 = 不写：候选阶段不得出现任何正文写入活动
        expect(invokedCount(view)).toBe(0);
    });

    test("人选之后只写一次，并把所选候选回传进流程", async () => {
        const {runner} = buildRunner();
        const waiting = await runner.start(candidateWorkflow(), null);
        const completed = await runner.resume(waiting.runId, {[waiting.pendingAsks[0]!.key]: "c2"});

        expect(completed.status).toBe("completed");
        expect(completed.result).toEqual({chosen: "c2", wrote: true});
        expect(invokedCount(completed)).toBe(1);
    });

    test("人选「以上都不行」：流程正常结束，且不写正文", async () => {
        const {runner} = buildRunner();
        const waiting = await runner.start(candidateWorkflow(), null);
        const completed = await runner.resume(waiting.runId, {[waiting.pendingAsks[0]!.key]: "none"});

        expect(completed.status).toBe("completed");
        expect(completed.result).toEqual({chosen: null, wrote: false});
        expect(invokedCount(completed)).toBe(0);
    });

    test("缺省不可被绕过：未应答停在 waiting，空应答与 rerun 都被拒", async () => {
        const {runner} = buildRunner();
        const waiting = await runner.start(candidateWorkflow(), null);

        // 无人应答时状态仍是 waiting，也没有写入活动
        expect(waiting.status).toBe("waiting");
        expect(invokedCount(waiting)).toBe(0);

        // 必须逐项应答：空应答被内核拒绝，Run 不推进
        await expect(runner.resume(waiting.runId, {})).rejects.toThrow(/缺少 ask 应答/u);

        // 有待答 ask 时 rerun 也被拒：不存在「跳过人直接跑完」的通道
        await expect(runner.rerun(waiting.runId)).rejects.toThrow(/等待用户应答/u);
        expect(waiting.pendingAsks).toHaveLength(1);

        // 应答一次即完成；非 waiting 状态不能再被 resume（结构上不可能「自动选第一条」）
        const completed = await runner.resume(waiting.runId, {[waiting.pendingAsks[0]!.key]: "c1"});
        expect(completed.status).toBe("completed");
        await expect(runner.resume(waiting.runId, {[waiting.pendingAsks[0]!.key]: "c3"}))
            .rejects.toThrow(/非 waiting 状态/u);
    });
});
