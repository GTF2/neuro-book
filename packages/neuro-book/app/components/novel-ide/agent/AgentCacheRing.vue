<script setup lang="ts">
/**
 * 缓存绿环（009C1R2 件1）：环=当前上下文估算 tokens ÷ 模型最大上下文窗口（与底部 context gauge 同源同值）；
 * hover 自制小面板首行=上下文占用，其余行=缓存明细（与底部统计条同源）；点击复用 open-context-inspector。
 */
const props = defineProps<{
    /** 环比例：contextUsage.usedTokens / limitTokens，0..1；null=无数据整体隐藏 */
    ringRatio: number | null;
    /** 上下文占用紧凑文本（如 "90K / 1.0M"）；空串=整体隐藏 */
    contextUsageLabel: string;
    /** 上下文占用百分比（如 "9%"） */
    contextPercentLabel?: string;
    /** 已缓存 token 数（紧凑文本），面板缓存明细行 */
    cachedLabel: string;
    /** 上下文总容量（紧凑文本），面板「最大缓存」行 */
    limitLabel: string;
    /** 累计输入 token（面板「上传」行） */
    inputLabel: string;
    /** 累计输出 token（面板「下载」行） */
    outputLabel: string;
    /** 缓存命中率文本（如 "42%"），空串=面板不显示该行 */
    hitRateLabel: string;
}>();

const emit = defineEmits<{
    (e: "open-context-inspector"): void;
}>();

const {t} = useI18n();

const panelVisible = ref(false);

const ratio = computed(() => {
    if (props.ringRatio === null || !Number.isFinite(props.ringRatio)) {
        return 0;
    }
    return Math.min(Math.max(props.ringRatio, 0), 1);
});

const contextLine = computed(() => {
    const percent = props.contextPercentLabel ? `（${props.contextPercentLabel}）` : "";
    return `${t("agent.composer.cacheRingContext")} ${props.contextUsageLabel}${percent}`;
});

const panelRows = computed(() => [
    {icon: "i-lucide-database-zap", label: t("agent.composer.cacheRingCached"), value: props.cachedLabel},
    {icon: "i-lucide-database", label: t("agent.composer.cacheRingLimit"), value: props.limitLabel},
    {icon: "i-lucide-arrow-up", label: t("agent.composer.cacheRingUpload"), value: props.inputLabel},
    {icon: "i-lucide-arrow-down", label: t("agent.composer.cacheRingDownload"), value: props.outputLabel},
    ...(props.hitRateLabel ? [{icon: "i-lucide-percent", label: t("agent.composer.cacheRingHitRate"), value: props.hitRateLabel}] : []),
]);
</script>

<template>
    <div v-if="props.contextUsageLabel" class="relative flex shrink-0 items-center">
        <button
            type="button"
            class="inline-flex h-5 w-5 items-center justify-center rounded-full transition-[filter] hover:brightness-125"
            :aria-label="t('agent.composer.cacheRingTitle')"
            @click="emit('open-context-inspector')"
            @pointerenter="panelVisible = true"
            @pointerleave="panelVisible = false"
        >
            <svg viewBox="0 0 16 16" class="h-3.5 w-3.5 -rotate-90" aria-hidden="true">
                <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" class="text-[var(--status-success)] opacity-25" stroke-width="2.5"></circle>
                <circle
                    cx="8" cy="8" r="6"
                    fill="none"
                    stroke="currentColor"
                    class="text-[var(--status-success)]"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    :stroke-dasharray="`${ratio * 2 * Math.PI * 6} ${2 * Math.PI * 6}`"
                ></circle>
            </svg>
        </button>
        <!-- 009C1R2 件1c：面板左缘对齐绿环向右展开（原居中定位在绿环近面板左缘时溢出切字） -->
        <div
            v-if="panelVisible"
            class="pointer-events-none absolute bottom-full left-0 z-40 mb-2 w-52 rounded-lg border border-[var(--border-color)] bg-[var(--bg-panel)] p-2 shadow-xl"
            @pointerenter="panelVisible = true"
        >
            <div class="mb-1.5 border-b border-[var(--border-color)]/50 pb-1 text-[11px] font-medium text-[var(--text-main)]">{{ contextLine }}</div>
            <div v-for="row in panelRows" :key="row.label" class="flex items-center justify-between gap-2 py-0.5 text-[11px] text-[var(--text-secondary)]">
                <span class="flex min-w-0 items-center gap-1.5">
                    <span :class="row.icon" class="h-3 w-3 shrink-0 text-[var(--text-muted)]"></span>
                    <span class="truncate">{{ row.label }}</span>
                </span>
                <span class="shrink-0 font-medium">{{ row.value }}</span>
            </div>
        </div>
    </div>
</template>
