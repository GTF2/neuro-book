<script setup lang="ts">
import {CHAT_WORK_BLOCK_META, WORK_DETAIL_LIMIT, type ChatRoundItem} from "nbook/app/components/novel-ide/agent/chat-work-blocks";

/**
 * 轮块头（009C1R2 件3b）：「已工作 X 分 X 秒 ˅」灰小字行——整轮唯一身份标记，
 * 替代逐段 ASSISTANT 徽标；箭头行首（件3f 统一约定），收起态拼工作摘要（件6 计数形态）。
 * 行为图纸=旧库 44eeb913 按新库重写；轮体渲染归 AgentChatFlow。
 */
const props = defineProps<{
    round: ChatRoundItem;
    expanded: boolean;
}>();

const emit = defineEmits<{
    (e: "toggle"): void;
}>();

const {t} = useI18n();

const DURATION_MINUTE_MS = 60_000;

/** 块头时长：秒级轮「X 秒」，分钟级「X 分 X 秒」。 */
const durationLabel = computed(() => {
    if (props.round.isRunning) {
        const seconds = props.round.durationMs !== null ? Math.max(1, Math.round(props.round.durationMs / 1000)) : 0;
        return t("agent.workBlock.working", {seconds});
    }
    if (props.round.durationMs === null) {
        return t("agent.workBlock.worked", {duration: ""}).trim();
    }
    const totalSeconds = Math.max(1, Math.round(props.round.durationMs / 1000));
    if (totalSeconds < 60) {
        return t("agent.workBlock.workedSeconds", {seconds: totalSeconds});
    }
    const minutes = Math.floor(totalSeconds / 60);
    return t("agent.workBlock.worked", {duration: t("agent.workBlock.minutesSeconds", {minutes, seconds: totalSeconds % 60})});
});

/** 收起态工作摘要：「查阅 3 · 改稿 1 · 2 个文件」类别人话+计数（≤3 类）；细分与目标名入 title。 */
const summaryLabel = computed(() => {
    if (props.round.toolCount === 0) {
        return "";
    }
    const parts = props.round.workByKind.slice(0, WORK_DETAIL_LIMIT).map(({kind, count}) => `${t(CHAT_WORK_BLOCK_META[kind].labelKey)} ${count}`);
    const overflow = props.round.workByKind.length - parts.length;
    if (overflow > 0) {
        parts.push(t("agent.workBlock.moreKinds", {count: overflow}));
    }
    if (props.round.fileCount > 0) {
        parts.push(t("agent.workBlock.fileCount", {count: props.round.fileCount}));
    }
    return parts.join(" · ");
});

/** 悬停明细：按工具细分计数（≤3 项+等 N 次）与首个目标名。 */
const summaryTitle = computed(() => {
    const details = props.round.toolCounts.slice(0, WORK_DETAIL_LIMIT)
        .map(({toolName, count}) => `${t(`agent.workBlock.tool.${toolName}`)} ×${count}`)
        .join("，");
    const overflow = props.round.toolCount - Math.min(props.round.toolCounts.length, WORK_DETAIL_LIMIT);
    const tail = overflow > 0 ? `，${t("agent.workBlock.moreCalls", {count: props.round.toolCount})}` : "";
    const target = props.round.firstTarget ? `\n${t("agent.workBlock.target")}: ${props.round.firstTarget}` : "";
    return details + tail + target;
});
</script>

<template>
    <button
        type="button"
        class="flex w-fit max-w-full items-center gap-1.5 rounded px-0.5 py-0.5 text-left text-[11px] text-[var(--text-muted)] transition-colors hover:text-[var(--text-secondary)]"
        :title="props.round.toolCount > 0 ? summaryTitle : undefined"
        @click="emit('toggle')"
    >
        <span :class="props.expanded ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'" class="h-3 w-3 shrink-0"></span>
        <span class="shrink-0 font-medium">{{ durationLabel }}</span>
        <span v-if="props.round.modelLabel" class="shrink-0 rounded border border-[var(--border-color)] bg-[var(--bg-input)] px-1 text-[9px] text-[var(--text-muted)]/80">{{ props.round.modelLabel }}</span>
        <span v-if="!props.expanded && summaryLabel" class="min-w-0 truncate text-[var(--text-muted)]/75">{{ summaryLabel }}</span>
    </button>
</template>
