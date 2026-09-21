<script setup lang="ts">
import FormSelect, {type SelectOption} from "nbook/app/components/common/form/FormSelect.vue";
import type {ThinkingLevelDto} from "nbook/shared/dto/app-settings.dto";

/**
 * 外置思考档下拉（009C1R2 件4）：选项=当前选中模型 thinkingLevelMap 支持的实际档位
 * （map 空/null 回退全量七档）；不再提供「跟随Profile」——回退通道走 Profile 设置页。
 * 显示值=当前生效档（requested ?? effective）；选择即经宿主走 runCommand thinking 立即生效。
 */
const props = withDefaults(defineProps<{
    /** 会话当前请求档；null=跟随 Profile（此时显示解析后的生效档） */
    modelValue: ThinkingLevelDto | null;
    /** Profile 解析后的实际生效档，显示兜底与选中态来源 */
    effectiveLevel?: ThinkingLevelDto | null;
    /** 当前选中模型的档位映射；非空时选项=其 keys∩七档，空/null 回退全量七档 */
    thinkingLevelMap?: Record<string, string | null> | null;
    disabled?: boolean;
}>(), {
    effectiveLevel: null,
    thinkingLevelMap: null,
    disabled: false,
});

const emit = defineEmits<{
    (e: "update:modelValue", value: ThinkingLevelDto): void;
}>();

const {t} = useI18n();

const ALL_LEVELS: ThinkingLevelDto[] = ["off", "minimal", "low", "medium", "high", "xhigh", "max"];

const LEVEL_LABEL_KEYS: Record<ThinkingLevelDto, string> = {
    off: "agent.composer.off",
    minimal: "agent.composer.minimal",
    low: "agent.composer.low",
    medium: "agent.composer.medium",
    high: "agent.composer.high",
    xhigh: "agent.composer.xhigh",
    max: "agent.composer.max",
};

const levelLabel = (level: ThinkingLevelDto): string => t(LEVEL_LABEL_KEYS[level]);

/** 模型支持的档位：map keys∩七档；map 空/null 回退全量（件4a）。 */
const supportedLevels = computed<ThinkingLevelDto[]>(() => {
    const map = props.thinkingLevelMap;
    if (!map || typeof map !== "object") {
        return ALL_LEVELS;
    }
    const mapped = ALL_LEVELS.filter((level) => level in map);
    return mapped.length > 0 ? mapped : ALL_LEVELS;
});

const options = computed<SelectOption[]>(() => supportedLevels.value.map((level) => ({
    value: level,
    label: levelLabel(level),
})));

/** 显示与选中态=当前生效档（requested ?? effective，件4b）。 */
const currentValue = computed<ThinkingLevelDto>(() => props.modelValue ?? props.effectiveLevel ?? "off");
</script>

<template>
    <div class="shrink-0" :title="t('agent.composer.thinkingEffort')">
        <FormSelect
            :model-value="currentValue"
            :options="options"
            size="sm"
            bare
            dropdown-direction="up"
            :disabled="props.disabled"
            @update:model-value="emit('update:modelValue', $event as ThinkingLevelDto)"
        />
    </div>
</template>
