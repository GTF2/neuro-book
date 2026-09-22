<script setup lang="ts">
import {onBeforeUnmount, onMounted, ref} from "vue";
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

// R4 件1：运行中轮每秒重算「已工作」，不依赖新消息事件——纯思考轮（单条 AI 消息）也能跳动。
const nowTick = ref(Date.now());
let runningTimer: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
    if (props.round.isRunning) {
        runningTimer = setInterval(() => {
            nowTick.value = Date.now();
        }, 1_000);
    }
});
onBeforeUnmount(() => {
    if (runningTimer !== null) {
        clearInterval(runningTimer);
    }
});

/** 块头时长三态（R5 件2）：真无数据→「本轮」；有数据→真实跨度（<2 秒的轮归「本轮」，不显示假 1 秒）；
 *  异常大→陈旧钳制（R4 验证轮）。 */
const MIN_DISPLAYABLE_SECONDS = 2;
const durationLabel = computed(() => {
    if (props.round.isRunning) {
        // 真机实证（《新小说1》拆书会话）：interrupted 会话可残留 streaming 状态，动态计时会算出
        // 数日级天文数字——超过 1 小时视为陈旧残留，回退静态跨度兜底。
        const STALE_RUNNING_CAP_MS = 3_600_000;
        const liveMs = props.round.startedAtMs !== null ? nowTick.value - props.round.startedAtMs : props.round.durationMs;
        if ((liveMs ?? 0) > STALE_RUNNING_CAP_MS) {
            return props.round.durationMs === null ? t("agent.workBlock.workRound") : formatWorked(Math.round(props.round.durationMs / 1000));
        }
        const seconds = Math.max(1, Math.round((liveMs ?? 0) / 1000));
        return t("agent.workBlock.working", {seconds});
    }
    if (props.round.durationMs === null) {
        return t("agent.workBlock.workRound");
    }
    return formatWorked(Math.round(props.round.durationMs / 1000));
});

function formatWorked(totalSeconds: number): string {
    if (totalSeconds < MIN_DISPLAYABLE_SECONDS) {
        return t("agent.workBlock.workRound");
    }
    if (totalSeconds < 60) {
        return t("agent.workBlock.workedSeconds", {seconds: totalSeconds});
    }
    const minutes = Math.floor(totalSeconds / 60);
    return t("agent.workBlock.worked", {duration: t("agent.workBlock.minutesSeconds", {minutes, seconds: totalSeconds % 60})});
}

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
    <!-- R4 件1：整行同一垂直中线（箭头/时长/模型徽章/摘要统一 leading 与 items-center）。 -->
    <button
        type="button"
        class="flex w-fit max-w-full items-center gap-1.5 rounded px-0.5 py-0.5 text-left text-[11px] leading-4 text-[var(--text-muted)] transition-colors hover:text-[var(--text-secondary)]"
        :title="props.round.toolCount > 0 ? summaryTitle : undefined"
        @click="emit('toggle')"
    >
        <span :class="props.expanded ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'" class="h-3 w-3 shrink-0"></span>
        <span class="shrink-0 font-medium">{{ durationLabel }}</span>
        <span v-if="props.round.modelLabel" class="flex shrink-0 items-center rounded border border-[var(--border-color)] bg-[var(--bg-input)] px-1 text-[9px] leading-4 text-[var(--text-muted)]/80">{{ props.round.modelLabel }}</span>
        <span v-if="!props.expanded && summaryLabel" class="min-w-0 self-center text-left text-[11px] leading-4 text-[var(--text-muted)]/75">{{ summaryLabel }}</span>
    </button>
</template>
