<script setup lang="ts">
import FormSelect, {type SelectOption} from "nbook/app/components/common/form/FormSelect.vue";
import type {ThinkingLevelDto} from "nbook/shared/dto/app-settings.dto";

/**
 * 外置思考档下拉（009C1R 微调4/5）：全量八项=跟随Profile+七档 DTO，
 * 样式走项目统一 FormSelect；跟随 Profile 时以 description 标注解析后的生效档。
 * 选项值用字符串（""=跟随 Profile），emit 还原回 DTO|null。
 */
const props = withDefaults(defineProps<{
    /** 会话当前请求档；null=跟随 Profile（009C1R 微调4：读真实当前值，不再是未应用草稿） */
    modelValue: ThinkingLevelDto | null;
    /** Profile 解析后的实际生效档，跟随 Profile 时标注用 */
    effectiveLevel?: ThinkingLevelDto | null;
    disabled?: boolean;
}>(), {
    effectiveLevel: null,
    disabled: false,
});

const emit = defineEmits<{
    (e: "update:modelValue", value: ThinkingLevelDto | null): void;
}>();

const {t} = useI18n();

const LEVEL_LABEL_KEYS: Record<ThinkingLevelDto, string> = {
    off: "agent.composer.off",
    minimal: "agent.composer.minimal",
    low: "agent.composer.low",
    medium: "agent.composer.medium",
    high: "agent.composer.high",
    xhigh: "agent.composer.xhigh",
    max: "agent.composer.max",
};

const levelLabel = (level: ThinkingLevelDto | null): string => {
    if (level === null) {
        return t("agent.composer.followProfile");
    }
    return t(LEVEL_LABEL_KEYS[level]);
};

const options = computed<SelectOption[]>(() => [
    {
        value: "",
        label: t("agent.composer.followProfile"),
        description: props.effectiveLevel
            ? t("agent.composer.current", {value: levelLabel(props.effectiveLevel)})
            : "",
    },
    ...(Object.keys(LEVEL_LABEL_KEYS) as ThinkingLevelDto[]).map((level) => ({
        value: level,
        label: levelLabel(level),
    })),
]);

const currentValue = computed(() => props.modelValue ?? "");
</script>

<template>
    <div class="shrink-0" :title="t('agent.composer.thinkingEffort')">
        <FormSelect
            :model-value="currentValue"
            :options="options"
            size="sm"
            dropdown-direction="up"
            :disabled="props.disabled"
            @update:model-value="emit('update:modelValue', ($event || null) as ThinkingLevelDto | null)"
        />
    </div>
</template>
