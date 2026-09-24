import {describe, expect, it} from "vitest";
import {shallowRef} from "vue";
import {
    aggregateTodoItems,
    computePlanRevisionDiff,
    confidenceToRoute,
    parseWriterConfidence,
    rejectProposalGroup,
    resolvePlanRevisionReply,
    CONFIDENCE_CHOICE_THRESHOLD,
    type PlanRevision,
    type TodoSources,
} from "nbook/app/components/novel-ide/agent/unified-todo";
import {createUnifiedTodoStore, type UnifiedTodoStore} from "nbook/app/components/novel-ide/agent/useUnifiedTodoStore";
import {createInspirationLibrary, type InspirationMemoryStorage} from "nbook/app/components/novel-ide/agent/unified-todo-inspiration";
import type {AgentPendingUserInputSession} from "nbook/app/components/novel-ide/agent/agent-message";

/** 合成主会话源 fixture：一件工具审批 + 一件阻塞提问（形状照 AgentPendingUserInputSession）。 */
function agentPendingFixture(): AgentPendingUserInputSession[] {
    return [
        {
            assistantMessageId: "msg-1",
            status: "pending",
            questions: [{
                question: "允许写入文件？",
                options: [],
                toolNodeId: "node-1",
                questionIndex: 0,
                toolCallId: "call-1",
                toolName: "write_file",
                kind: "tool_approval",
            }],
        },
        {
            assistantMessageId: "msg-2",
            status: "pending",
            questions: [{
                question: "主角名字用哪个？",
                options: [{label: "林澈"}, {label: "沈砚"}],
                toolNodeId: "node-2",
                questionIndex: 0,
                toolCallId: "call-2",
                toolName: "request_user_input",
                kind: "question",
            }],
        },
    ];
}

/** 合成 Workflow 源 fixture：两个等待应答的后台 Run。 */
function workflowWaitingFixture(): NonNullable<TodoSources["workflowWaiting"]> {
    return [
        {runId: "run-1", workflowKey: "chapter-draft"},
        {runId: "run-2", workflowKey: "recap-refresh"},
    ];
}

/** 合成设定拍板源 fixture：一个提案带两个绑定影响项（K4）。 */
function settingProposalFixture(): NonNullable<TodoSources["settingProposals"]> {
    return [{
        proposalId: "proposal-1",
        title: "把主角户籍改成临江城",
        impacts: [
            {id: "impact-1", label: "第 2 章出场描述"},
            {id: "impact-2", label: "世界书·临江城条目"},
        ],
    }];
}

function memoryStorage(): InspirationMemoryStorage {
    const map = new Map<string, string>();
    return {
        getItem: (key) => map.get(key) ?? null,
        setItem: (key, value) => void map.set(key, value),
        removeItem: (key) => void map.delete(key),
    };
}

describe("unified-todo 聚合层契约（任务031 阶段A）", () => {
    it("A8 计数唯一真源：聚合 items 驱动总数与分类计数，源移除一件三处同减", () => {
        const withBoth = aggregateTodoItems({
            agentPending: agentPendingFixture(),
            workflowWaiting: workflowWaitingFixture(),
        });
        expect(withBoth).toHaveLength(4);

        const totalBefore = withBoth.length;
        const workflowBefore = withBoth.filter((item) => item.kind === "workflow_answer").length;
        expect(workflowBefore).toBe(2);

        // 一件 Workflow 应答在源侧被应答（resolution 写回后源里消失），重聚合：
        const afterOneResolved = aggregateTodoItems({
            agentPending: agentPendingFixture(),
            workflowWaiting: workflowWaitingFixture().slice(1),
        });
        expect(afterOneResolved).toHaveLength(totalBefore - 1);
        expect(afterOneResolved.filter((item) => item.kind === "workflow_answer")).toHaveLength(workflowBefore - 1);
    });

    it("A9 持久化恢复：同一源数据重聚合=待办全在；已应答的不复活、未处理的不丢", () => {
        const before = aggregateTodoItems({
            agentPending: agentPendingFixture(),
            workflowWaiting: workflowWaitingFixture(),
            settingProposals: settingProposalFixture(),
        });
        // 中断→重进：聚合层从三源重灌（三源本身持久化），结果必须一致。
        const afterReload = aggregateTodoItems({
            agentPending: agentPendingFixture(),
            workflowWaiting: workflowWaitingFixture(),
            settingProposals: settingProposalFixture(),
        });
        expect(afterReload).toEqual(before);

        // 半处理：一件主会话审批已 resolve（源里消失），其余必须原样保留。
        const halfProcessed = aggregateTodoItems({
            agentPending: agentPendingFixture().slice(1),
            workflowWaiting: workflowWaitingFixture(),
            settingProposals: settingProposalFixture(),
        });
        expect(halfProcessed).toHaveLength(before.length - 1);
        expect(halfProcessed.map((item) => item.id).sort()).toEqual(
            before.filter((item) => item.id !== "agent_pending:call-1").map((item) => item.id).sort(),
        );
    });

    it("K4 影响项绑定提案：拒绝=整组销号不留幽灵", () => {
        const items = aggregateTodoItems({
            settingProposals: settingProposalFixture(),
            agentPending: agentPendingFixture(),
        });
        const kept = rejectProposalGroup(items, "proposal-1");
        // 提案件与两个绑定影响项全部销号，其余待办（agent_pending 两件）不受牵连。
        expect(kept.some((item) => item.proposalId === "proposal-1")).toBe(false);
        expect(kept.filter((item) => item.source === "agent_pending")).toHaveLength(2);
        expect(kept).toHaveLength(2);
    });

    it("K5 计划修订结构化 diff 回传：AI 认可或冲突一次即终态", () => {
        const before: PlanRevision = {
            proposalId: "plan-1",
            steps: [
                {id: "step-1", title: "确认本卷写法"},
                {id: "step-2", title: "改第 2 章暗号句"},
                {id: "step-3", title: "登记伏笔账"},
            ],
        };
        const after: PlanRevision = {
            proposalId: "plan-1",
            steps: [
                {id: "step-1", title: "确认本卷写法"},
                {id: "step-2", title: "改第 2 章开头铁锈味一稿"},
                {id: "step-4", title: "补铜镜令牌自查"},
            ],
        };
        const diff = computePlanRevisionDiff(before, after);
        expect(diff.proposalId).toBe("plan-1");
        expect(diff.addedSteps.map((step) => step.id)).toEqual(["step-4"]);
        expect(diff.removedStepIds).toEqual(["step-3"]);
        expect(diff.changedSteps).toEqual([{before: before.steps[1], after: after.steps[1]}]);

        // AI 侧一次应答即终态：认可或冲突，不产生第三种往返。
        expect(resolvePlanRevisionReply({decision: "accepted"})).toEqual({decision: "accepted"});
        expect(resolvePlanRevisionReply({decision: "conflict", conflicts: ["step-2"]})).toEqual({
            decision: "conflict",
            conflicts: ["step-2"],
        });
    });

    it("K1 灵感库：未选项自动入库可回捡", () => {
        const library = createInspirationLibrary(memoryStorage());
        const inspiration = {
            id: "insp-1",
            kind: "setting_decision" as const,
            title: "未选分支：沈砚（旧名设定）",
            source: "agent_pending" as const,
            archivedAt: 1_700_000_000_000,
            raw: {question: "主角名字用哪个？", rejectedOption: "沈砚"},
        };
        expect(library.list()).toEqual([]);
        library.archive(inspiration);
        expect(library.list()).toHaveLength(1);
        expect(library.list()[0]).toMatchObject({id: "insp-1", title: "未选分支：沈砚（旧名设定）"});
        // 回捡=取走后从库中移除（回捡入口=驾驶舱行）。
        expect(library.take("insp-1")).toMatchObject({id: "insp-1"});
        expect(library.list()).toEqual([]);
    });

    it("K2 置信度：writer 字段解析+缺省兼容+低置信转选择题路由", () => {
        expect(parseWriterConfidence({confidence: 0.4})).toBe(0.4);
        // 旧输出无字段：缺省 null，不报错。
        expect(parseWriterConfidence({})).toBeNull();
        expect(parseWriterConfidence({confidence: "high"})).toBeNull();
        expect(parseWriterConfidence({confidence: 1.4})).toBeNull();

        expect(CONFIDENCE_CHOICE_THRESHOLD).toBeGreaterThan(0);
        expect(confidenceToRoute(0.4)).toBe("choice");
        expect(confidenceToRoute(0.9)).toBe("direct");
        expect(confidenceToRoute(null)).toBe("direct");
    });

    it("E 段·应答回传通道：主会话件填 agent_resolution、Workflow 件填 workflow_ask（UI 舞台分工在协议层统一）", () => {
        const store: UnifiedTodoStore = createUnifiedTodoStore({
            agentPending: shallowRef(agentPendingFixture()),
            workflowWaiting: shallowRef(workflowWaitingFixture()),
            sessionId: shallowRef(42),
        });
        const items = store.items.value;
        const agentItem = items.find((item) => item.source === "agent_pending");
        const workflowItem = items.find((item) => item.source === "workflow_waiting");
        expect(agentItem?.replyChannel).toMatchObject({kind: "agent_resolution", sessionId: 42, toolCallId: "call-1"});
        expect(workflowItem?.replyChannel).toMatchObject({kind: "workflow_ask", runId: "run-1"});

        // 无活跃会话：主会话件不填通道（无可回传目标），Workflow 件照填（run 即通道）。
        const idleStore: UnifiedTodoStore = createUnifiedTodoStore({
            agentPending: shallowRef(agentPendingFixture()),
            workflowWaiting: shallowRef(workflowWaitingFixture()),
            sessionId: shallowRef(null),
        });
        const idleItems = idleStore.items.value;
        expect(idleItems.find((item) => item.source === "agent_pending")?.replyChannel).toBeUndefined();
        expect(idleItems.find((item) => item.source === "workflow_waiting")?.replyChannel).toMatchObject({
            kind: "workflow_ask",
            runId: "run-1",
        });
    });
});
