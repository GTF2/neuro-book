<script setup lang="ts">
import { computed, ref, watch } from "vue";
import AgentToolBubble from "nbook/app/components/novel-ide/agent/AgentToolBubble.vue";
import type {AgentToolCall} from "nbook/app/components/novel-ide/agent/agent-message";
import {
    CHAT_WORK_BLOCK_META,
    isFailedToolCall,
    type ChatFlowItem,
} from "nbook/app/components/novel-ide/agent/chat-work-blocks";

/**
 * 工作块：连续同类工具调用收拢成一行过程行（灰色小字+摘要），点击展开细节。
 * 009单C批次1「工作块折叠人化」最终形态（行为规格源自旧库 44eeb913 按新库重写）。
 */
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
        <!-- 过程行：灰色小字（图标+一行摘要），可点击展开 -->
        <button
            type="button"
            class="flex w-full items-center gap-1.5 rounded px-0.5 py-0.5 text-left text-[11px] text-[var(--text-muted)] transition-colors hover:text-[var(--text-secondary)]"
            @click="toggle"
        >
            <span :class="[meta.icon, props.block.isRunning ? 'animate-pulse' : '']" class="h-3 w-3 shrink-0"></span>
            <span class="shrink-0">{{ t(meta.labelKey) }}</span>
            <span class="min-w-0 flex-1 truncate text-[var(--text-muted)]/75">{{ summary }}</span>
            <span :class="expanded ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'" class="h-3 w-3 shrink-0"></span>
        </button>
        <div v-if="expanded" class="mt-1 space-y-1 pl-4">
            <AgentToolBubble
                v-for="node in props.block.nodes"
                :key="node.toolCall.id"
                :tool-call="node.toolCall"
                :session-id="props.sessionId"
                @copy="emit('copy', $event)"
            />
        </div>
    </div>
</template>
