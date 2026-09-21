<script setup lang="ts">
import type {ThinkingLevelDto} from "nbook/shared/dto/app-settings.dto";

const props = withDefaults(defineProps<{
    /** 真实 ThinkingLevelDto 七档枚举或 null（跟随 profile）；外置快捷件只露常用三档 */
    modelValue: ThinkingLevelDto | null;
    disabled?: boolean;
}>(), {
    disabled: false,
});

const emit = defineEmits<{
    (e: "update:modelValue", value: ThinkingLevelDto): void;
}>();

const {t} = useI18n();

// 快捷件口径（规格包 §4.2 + 口径裁定 #5）：三常用档外置，off/minimal/xhigh/max 走模型弹层内全量下拉
type QuickLevel = Extract<ThinkingLevelDto, "low" | "medium" | "high">;
const quickLevels: Array<{value: QuickLevel; labelKey: string}> = [
    {value: "low", labelKey: "agent.composer.thinkingLevel.low"},
    {value: "medium", labelKey: "agent.composer.thinkingLevel.mid"},
    {value: "high", labelKey: "agent.composer.thinkingLevel.high"},
];

const currentLabel = computed(() => {
    const matched = quickLevels.find((level) => level.value === props.modelValue);
    // 当前档不在三档内（off/minimal/xhigh/max）时显示原值字标，null 显示占位
    return matched ? t(matched.labelKey) : props.modelValue ?? "—";
});
</script>

<template>
    <!-- 外置思考档快捷件：与 AgentSessionModelControls 弹层内 reasoningEffort 同一数据通道（5.3 接线 sessionModelDraft） -->
    <label
        class="relative inline-flex h-7 shrink-0 cursor-pointer items-center gap-0.5 rounded-md border border-[var(--border-color)] bg-[var(--bg-panel)] pl-2 pr-1.5 text-[11px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] disabled:cursor-not-allowed disabled:opacity-50"
        :class="props.disabled ? 'pointer-events-none opacity-50' : ''"
        :title="t('agent.composer.thinkingEffort')"
    >
        <span class="min-w-0 truncate font-medium">{{ currentLabel }}</span>
        <span class="i-lucide-chevrons-up-down h-3 w-3 shrink-0 text-[var(--text-muted)]"></span>
        <select
            class="absolute inset-0 h-full w-full cursor-pointer opacity-0 outline-none"
            :disabled="props.disabled"
            :value="props.modelValue ?? ''"
            @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value as ThinkingLevelDto)"
        >
            <option v-for="level in quickLevels" :key="level.value" :value="level.value">{{ t(level.labelKey) }}</option>
        </select>
    </label>
</template>
