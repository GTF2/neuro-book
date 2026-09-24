import {computed, type ComputedRef, type Ref} from "vue";
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
    agentPending: Ref<readonly AgentPendingUserInputSession[]>;
    workflowWaiting: Ref<readonly WorkflowWaitingRef[]> | ComputedRef<readonly WorkflowWaitingRef[]>;
}): UnifiedTodoStore {
    const items = computed(() => aggregateTodoItems({
        agentPending: input.agentPending.value as AgentPendingUserInputSession[],
        workflowWaiting: input.workflowWaiting.value as WorkflowWaitingRef[],
    }));
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
