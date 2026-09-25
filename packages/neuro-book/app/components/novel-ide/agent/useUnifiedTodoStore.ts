import {computed, type ComputedRef} from "vue";
import type {AgentPendingUserInputSession} from "nbook/app/components/novel-ide/agent/agent-message";
import {
    aggregateTodoItems,
    type UnifiedTodoItem,
    type UnifiedTodoKind,
    type WorkflowWaitingRef,
} from "nbook/app/components/novel-ide/agent/unified-todo";

/**
 * G1 统一待办库的 Vue 组合式工厂（任务031 C 段）。
 *
 * 两根源线在此汇聚：
 * - 主会话源：useAgentSession 的 pendingUserInputSessions（harness 投影下游，032 已修投影门）；
 * - Workflow 源：useAgentJobsFeed singleton 的 jobs 经 toWorkflowWaitingRefs 过滤。
 * 驾驶舱/徽标/堆叠卡的计数全部以 items 派生（A8 计数唯一真源）。
 */
export type UnifiedTodoStore = {
    items: ComputedRef<UnifiedTodoItem[]>;
    totalCount: ComputedRef<number>;
    countByKind: ComputedRef<Record<UnifiedTodoKind, number>>;
};

export function createUnifiedTodoStore(input: {
    /** 最小结构接口（鸭子类型）：绕开 Vue Ref 泛型在深 zod 类型上的递归推导（TS2589 实测）。 */
    agentPending: {readonly value: readonly AgentPendingUserInputSession[]};
    workflowWaiting: {readonly value: readonly WorkflowWaitingRef[]};
    /** 当前会话 ID：agent_resolution 回传通道的组成部分（null=无活跃会话，主会话件不填通道）。 */
    sessionId: {readonly value: number | null};
}): UnifiedTodoStore {
    const items = computed<UnifiedTodoItem[]>(() => {
        const sessionId = input.sessionId.value;
        return aggregateTodoItems({
            agentPending: input.agentPending.value as AgentPendingUserInputSession[],
            workflowWaiting: input.workflowWaiting.value as WorkflowWaitingRef[],
        }).map((item) => {
            if (item.source === "agent_pending" && sessionId !== null) {
                const raw = item.raw as {session: AgentPendingUserInputSession; questionIndex: number};
                const question = raw.session.questions[raw.questionIndex];
                if (question?.toolCallId) {
                    return {...item, replyChannel: {kind: "agent_resolution", sessionId, toolCallId: question.toolCallId}};
                }
                return item;
            }
            if (item.source === "workflow_waiting") {
                const waiting = item.raw as WorkflowWaitingRef;
                return {...item, replyChannel: {kind: "workflow_ask", runId: waiting.runId}};
            }
            return item;
        });
    });
    const countByKind = computed(() => {
        const counts = {} as Record<UnifiedTodoKind, number>;
        for (const item of items.value) {
            counts[item.kind] = (counts[item.kind] ?? 0) + 1;
        }
        return counts;
    });
    return {
        items,
        totalCount: computed(() => items.value.length),
        countByKind,
    };
}
