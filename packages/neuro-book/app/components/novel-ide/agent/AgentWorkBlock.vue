<script setup lang="ts">
import { computed, ref, watch } from "vue";
import AgentToolBubble from "nbook/app/components/novel-ide/agent/AgentToolBubble.vue";
import type {AgentMessage, AgentToolCall} from "nbook/app/components/novel-ide/agent/agent-message";
import {
    CHAT_WORK_BLOCK_META,
    isFailedToolCall,
    type ChatFlowItem,
} from "nbook/app/components/novel-ide/agent/chat-work-blocks";

const props = defineProps<{
    block: Extract<ChatFlowItem, {kind: "block"}>;
    sessionId?: number | null;
    actionDisabled?: boolean;
    runActionDisabled?: boolean;
    /** 上层指定的强制展开（例如全对话最后一个失败块）。 */
    autoExpand?: boolean;
}>();

const emit = defineEmits<{
    (e: "copy", toolCall: AgentToolCall): void;
    /** 重跑的是「这条消息」，块内每个气泡各自带自己的 message，不代块统一处理。 */
    (e: "retry", message: AgentMessage): void;
    (e: "skip-edit", message: AgentMessage): void;
}>();

const { t } = useI18n();

const meta = computed(() => CHAT_WORK_BLOCK_META[props.block.blockKind]);
const fileCount = computed(() => props.block.filePaths.length);
const failedCount = computed(() => props.block.nodes.filter((node) => isFailedToolCall(node.toolCall)).length);

/** 摘要完全由工具元数据拼装：不调用 AI，因此零延迟、零成本、不会编造。 */
const summary = computed(() => {
    const parts: string[] = [];
    parts.push(fileCount.value > 0
        ? t("agent.workBlock.fileCount", {count: fileCount.value})
        : t("agent.workBlock.stepCount", {count: props.block.count}));
    if (failedCount.value > 0) {
        parts.push(t("agent.workBlock.failedCount", {count: failedCount.value}));
    }
    return parts.join(" · ");
});

/**
 * 默认收拢，但三种情况例外，否则会把用户必须看到的东西藏起来：
 * 块内有失败、块还在跑、上层指定展开。
 */
const startsExpanded = computed(() => props.block.hasFailure || props.block.isRunning || Boolean(props.autoExpand));
const expanded = ref(startsExpanded.value);
let userToggled = false;

watch(startsExpanded, (value) => {
    // 用户手动收起后不再自动干预；只在「需要展开」这一刻跃迁上补展开。
    if (value && !userToggled) {
        expanded.value = true;
    }
});

const toggle = (): void => {
    userToggled = true;
    expanded.value = !expanded.value;
};
</script>

<template>
    <div class="w-full">
        <button
            type="button"
            class="flex w-full items-center gap-2 rounded-lg border px-3 py-1.5 text-left transition-colors hover:bg-[var(--bg-hover)]"
            :class="props.block.hasFailure
                ? 'border-[var(--status-warning-border)] bg-[var(--status-warning-bg)]'
                : 'border-[var(--border-color)] bg-[var(--bg-panel)]'"
            @click="toggle"
        >
            <span
                :class="meta.icon"
                class="h-3.5 w-3.5 shrink-0"
                :style="{color: props.block.hasFailure ? 'var(--status-warning)' : 'var(--text-muted)'}"
            ></span>
            <span
                class="shrink-0 text-xs font-medium"
                :class="props.block.hasFailure ? 'text-[var(--status-warning)]' : 'text-[var(--text-main)]'"
            >{{ t(meta.labelKey) }}</span>
            <span class="truncate text-[11px] text-[var(--text-muted)]">{{ summary }}</span>
            <!-- 运行中的块必须能看出还在动，否则会被读成「卡住了」 -->
            <span v-if="props.block.isRunning" class="i-lucide-loader-circle h-3.5 w-3.5 shrink-0 animate-spin text-[var(--status-info)]"></span>
            <span
                :class="expanded ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
                class="ml-auto h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]"
            ></span>
        </button>

        <div v-if="expanded" class="mt-2 space-y-2">
            <!-- 块是用户主动展开的，块内失败卡片一律展开，不再二次折叠 -->
            <AgentToolBubble
                v-for="node in props.block.nodes"
                :key="node.toolCall.id"
                :tool-call="node.toolCall"
                :session-id="props.sessionId"
                :action-disabled="props.actionDisabled"
                :run-action-disabled="props.runActionDisabled"
                :auto-expand="isFailedToolCall(node.toolCall)"
                @copy="emit('copy', $event)"
                @retry="emit('retry', node.message)"
                @skip-edit="emit('skip-edit', node.message)"
            />
        </div>
    </div>
</template>
