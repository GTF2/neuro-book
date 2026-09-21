<script setup lang="ts">
import NovelIdeModelSelect from "nbook/app/components/novel-ide/settings/NovelIdeModelSelect.vue";
import type {EnabledModelOptionDto} from "nbook/shared/dto/app-settings.dto";

/**
 * Agent Session 模型选择（009C1R 微调6精简）：只保留外层模型下拉，即选即生效；
 * 原「当前Session模型参数」滑杆按钮与弹层（草稿/应用/重置）整体删除，
 * 推理档位由外置思考档下拉（AgentThinkingLevelSelect）走立即通道承担。
 */
const props = withDefaults(defineProps<{
    sessionModelSelectionValue: string | null;
    selectableModels: EnabledModelOptionDto[];
    readonly?: boolean;
    running?: boolean;
    loadingSession?: boolean;
    dropdownDirection?: "auto" | "down" | "up";
    rootClass?: string;
}>(), {
    readonly: false,
    running: false,
    loadingSession: false,
    dropdownDirection: "up",
    rootClass: "w-[200px] min-w-[140px] max-w-[260px]",
});

const emit = defineEmits<{
    (e: "update-session-model-selection", value: string | null): void;
}>();

const {t} = useI18n();

const actionDisabled = computed(() => props.readonly || props.running || props.loadingSession);
</script>

<template>
    <div class="relative flex min-w-0 items-center gap-1.5" :class="props.rootClass">
        <div class="min-w-0 w-full">
            <NovelIdeModelSelect
                :model-value="props.sessionModelSelectionValue"
                :models="props.selectableModels"
                :placeholder="t('agent.composer.selectSessionModel')"
                :disabled="actionDisabled"
                :dropdown-direction="props.dropdownDirection"
                @update:model-value="emit('update-session-model-selection', $event)"
            />
        </div>
    </div>
</template>
