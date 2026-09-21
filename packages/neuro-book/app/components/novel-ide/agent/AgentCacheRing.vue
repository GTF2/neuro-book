<script setup lang="ts">
const props = defineProps<{
    /** 现有 cumulativeCacheHitRateLabel 文本（如 "42%"）；空串=整体隐藏 */
    hitRateLabel: string;
    /** 现有 cumulativeCacheCompactLabel 全文，hover title 主体 */
    compactLabel: string;
}>();

const emit = defineEmits<{
    (e: "open-context-inspector"): void;
}>();

const {t} = useI18n();

// hitRateLabel 形如 "42%"；解析失败按 0 处理，只影响环填充比例，不造数据
const hitRatio = computed(() => {
    const percent = Number.parseFloat(props.hitRateLabel);
    if (!Number.isFinite(percent)) {
        return 0;
    }
    return Math.min(Math.max(percent, 0), 100) / 100;
});

const ringTitle = computed(() => [t("agent.composer.cacheRingTitle"), props.compactLabel].filter(Boolean).join(" · "));
</script>

<template>
    <!-- 缓存命中环形指示器：规格包 009 单C 批次1 §4.1，零新后端零造数，数据全来自 props 链 -->
    <button
        v-if="props.hitRateLabel"
        type="button"
        class="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-[filter] hover:brightness-125"
        :title="ringTitle"
        :aria-label="ringTitle"
        @click="emit('open-context-inspector')"
    >
        <svg viewBox="0 0 16 16" class="h-3.5 w-3.5 -rotate-90" aria-hidden="true">
            <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" class="text-[var(--status-success)] opacity-25" stroke-width="2.5"></circle>
            <circle
                cx="8"
                cy="8"
                r="6"
                fill="none"
                stroke="currentColor"
                class="text-[var(--status-success)]"
                stroke-width="2.5"
                stroke-linecap="round"
                :stroke-dasharray="`${hitRatio * 2 * Math.PI * 6} ${2 * Math.PI * 6}`"
            ></circle>
        </svg>
    </button>
</template>
