<script setup lang="ts">
// 关键帧(StoryKeyframe)编辑对话框:新建 / 编辑共用。
// 字段语义来自 docs/specs/plot/keyframe.md:instant 是 World Engine 时刻锚点,irreversibleChanges 是
// 「不可逆地改变了什么」的声明式事实列表(补间回撞校验的标的,不是写作指令)。
// 不变式由 plot-keyframe.logic 校验后组装请求体:创建恒 pending、状态不可回退到 pending、
// overthrown 必须挂 decisionRefId(宪法第六条推翻留痕)。
import {computed, reactive, ref, watch} from "vue";
import Dialog from "nbook/app/components/common/Dialog.vue";
import FormField from "nbook/app/components/common/form/FormField.vue";
import FormInput from "nbook/app/components/common/form/FormInput.vue";
import FormSelect from "nbook/app/components/common/form/FormSelect.vue";
import type {SelectOption} from "nbook/app/components/common/form/FormSelect.vue";
import FormTextarea from "nbook/app/components/common/form/FormTextarea.vue";
import {
    formatKeyframeInstant,
    joinIrreversibleChanges,
    validateKeyframeDraft,
    type KeyframeDraftErrorCode,
} from "nbook/app/components/novel-ide/plot/keyframe/plot-keyframe.logic";
import type {
    CreateStoryKeyframeRequestDto,
    StoryDecisionDto,
    StoryKeyframeDto,
    StoryKeyframeStatusDto,
    UpdateStoryKeyframeRequestDto,
} from "nbook/shared/dto/plot.dto";

/** 提交载荷:mode 与目标帧 id 由对话框一并带回,宿主不再重复判断模式。 */
export type PlotKeyframeEditorSave =
    | {mode: "create"; body: CreateStoryKeyframeRequestDto}
    | {mode: "edit"; keyframeId: string; body: UpdateStoryKeyframeRequestDto};

const props = defineProps<{
    visible: boolean;
    mode: "create" | "edit";
    // 编辑对象;mode=create 时为空。
    keyframe: StoryKeyframeDto | null;
    // 同 Story 已有帧的 name(含自身),用于同名前置校验。
    existingNames: string[];
    // 裁决留痕候选(创作决策记录);推翻帧时选择。
    decisions: StoryDecisionDto[];
    saving?: boolean;
    // 为空表示宿主侧无保存错误。
    error?: string;
}>();

const emit = defineEmits<{
    (e: "update:visible", value: boolean): void;
    (e: "save", payload: PlotKeyframeEditorSave): void;
}>();

const {t} = useI18n();

// 表单草稿:不可逆变化用多行文本承载,一行一条。
const draft = reactive({
    name: "",
    title: "",
    instant: "",
    irreversibleChangesText: "",
    note: "",
    status: "pending" as StoryKeyframeStatusDto,
    decisionRefId: "",
});
// 本地字段级校验错误;为空表示当前无校验问题。
const validationError = ref<{field: string; message: string} | null>(null);

const dialogTitle = computed(() => props.mode === "create" ? t("plotKeyframe.editor.createTitle") : t("plotKeyframe.editor.editTitle"));

// 状态选项:回撞流转单向,已离开 pending 的帧不再给出 pending(服务层同样拒绝)。
const statusOptions = computed<SelectOption[]>(() => {
    const statuses: StoryKeyframeStatusDto[] = ["pending", "confirmed", "violated", "overthrown"];
    const selectable = props.mode === "edit" && props.keyframe && props.keyframe.status !== "pending"
        ? statuses.filter((status) => status !== "pending")
        : statuses;
    return selectable.map((status) => ({value: status, label: t(`plotKeyframe.status.${status}`)}));
});

// 裁决留痕选项;帧上原有留痕若已不在决策列表(决策被删)则补一条只读占位项,避免静默丢失引用。
const decisionOptions = computed<SelectOption[]>(() => {
    const options: SelectOption[] = props.decisions.map((decision) => ({value: decision.id, label: decision.title}));
    const currentRefId = props.keyframe?.decisionRefId ?? null;
    if (currentRefId && !options.some((option) => option.value === currentRefId)) {
        options.unshift({value: currentRefId, label: t("plotKeyframe.editor.decisionRefMissing", {id: currentRefId})});
    }
    return options;
});

// 编辑态改名警示:name 供文档/章节简报/Agent 指令按名引用,改名后不会自动更新。
const nameChanged = computed(() => props.mode === "edit" && props.keyframe !== null && draft.name.trim() !== props.keyframe.name);

/** 把当前帧(或空)同步到本地草稿。 */
function syncDraft(): void {
    const keyframe = props.keyframe;
    draft.name = keyframe?.name ?? "";
    draft.title = keyframe?.title ?? "";
    draft.instant = keyframe ? formatKeyframeInstant(keyframe.instant) : "";
    draft.irreversibleChangesText = joinIrreversibleChanges(keyframe?.irreversibleChanges ?? []);
    draft.note = keyframe?.note ?? "";
    draft.status = keyframe?.status ?? "pending";
    draft.decisionRefId = keyframe?.decisionRefId ?? "";
    validationError.value = null;
}

watch(() => [props.visible, props.keyframe] as const, ([visible]) => {
    if (visible) {
        syncDraft();
    }
}, {immediate: true});

/** 关闭对话框(不提交)。 */
function closeDialog(): void {
    emit("update:visible", false);
}

/** 校验失败文案:按错误码取 i18n 文案。 */
function errorMessage(code: KeyframeDraftErrorCode): string {
    return t(`plotKeyframe.editor.errors.${code}`);
}

/** 客户端校验并提交;校验失败写字段级错误,不发请求(服务端仍是最终裁决者)。 */
function submit(): void {
    const result = validateKeyframeDraft({
        mode: props.mode,
        draft: {
            name: draft.name,
            title: draft.title,
            instant: draft.instant,
            irreversibleChangesText: draft.irreversibleChangesText,
            note: draft.note,
        },
        existingNames: props.existingNames,
        current: props.keyframe,
        nextStatus: draft.status,
        decisionRefId: draft.decisionRefId,
    });
    if (!result.ok) {
        validationError.value = {field: result.field, message: errorMessage(result.code)};
        return;
    }
    validationError.value = null;
    if (props.mode === "create") {
        emit("save", {mode: "create", body: result.body as CreateStoryKeyframeRequestDto});
        return;
    }
    const keyframeId = props.keyframe?.id ?? "";
    emit("save", {mode: "edit", keyframeId, body: result.body as UpdateStoryKeyframeRequestDto});
}
</script>

<template>
    <!-- 关键帧编辑对话框 -->
    <Dialog
        :model-value="props.visible"
        :title="dialogTitle"
        width="680px"
        show-cancel
        overlay-type="opaque"
        :busy="props.saving"
        @request-close="closeDialog"
        @update:model-value="emit('update:visible', $event)"
    >
        <template #header-extra>
            <div v-if="props.saving || props.error" class="ml-2 flex items-center text-xs">
                <span v-if="props.saving" class="flex items-center gap-1 text-[var(--text-muted)]">
                    <span class="i-lucide-loader-circle animate-spin"></span>
                    {{ t("common.saving") }}
                </span>
                <span v-else class="text-[var(--status-danger)]">{{ props.error }}</span>
            </div>
        </template>
        <template #footer>
            <button class="inline-flex items-center justify-center h-8 px-4 rounded-md text-[13px] font-medium cursor-pointer border border-[var(--border-color)] bg-[var(--bg-input)] text-[var(--text-main)] transition-colors duration-200 hover:bg-[var(--bg-hover)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50" :disabled="props.saving" @click="closeDialog">{{ t("common.cancel") }}</button>
            <button class="inline-flex items-center justify-center h-8 min-w-[92px] px-4 rounded-md text-[13px] font-medium cursor-pointer border border-transparent bg-[var(--accent-main)] text-[var(--text-inverse)] transition-all duration-200 hover:opacity-90 hover:shadow-md active:scale-95 disabled:cursor-not-allowed disabled:opacity-50" :disabled="props.saving" @click="submit">
                <span v-if="props.saving" class="flex items-center gap-1">
                    <span class="i-lucide-loader-circle h-4 w-4 animate-spin"></span>
                    {{ t("common.saving") }}
                </span>
                <span v-else>{{ t("common.confirm") }}</span>
            </button>
        </template>

        <div class="space-y-3 px-1 mt-1">
            <div v-if="validationError" class="rounded-md border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-2.5 py-1.5 text-[11px] text-[var(--status-danger)]">{{ validationError.message }}</div>

            <div class="grid grid-cols-[minmax(0,1fr)_160px] gap-2">
                <FormField :label="t('plotKeyframe.editor.title')">
                    <FormInput v-model="draft.title" :placeholder="t('plotKeyframe.editor.titlePlaceholder')" />
                </FormField>
                <FormField :label="t('plotKeyframe.editor.instant')">
                    <FormInput v-model="draft.instant" :placeholder="t('plotKeyframe.editor.instantPlaceholder')" />
                </FormField>
            </div>

            <FormField :label="t('plotKeyframe.editor.name')">
                <FormInput v-model="draft.name" :placeholder="t('plotKeyframe.editor.namePlaceholder')" />
                <div v-if="nameChanged" class="mt-1 flex items-start gap-1.5 rounded-md border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-2 py-1 text-[11px] text-[var(--status-warning)]">
                    <span class="i-lucide-triangle-alert mt-0.5 h-3 w-3 shrink-0"></span>
                    <span>{{ t("plotKeyframe.editor.nameRenameWarning") }}</span>
                </div>
            </FormField>

            <FormField :label="t('plotKeyframe.editor.irreversibleChanges')">
                <FormTextarea v-model="draft.irreversibleChangesText" :rows="4" :placeholder="t('plotKeyframe.editor.irreversibleChangesPlaceholder')" />
                <div class="mt-1 text-[11px] leading-relaxed text-[var(--text-muted)]">{{ t("plotKeyframe.editor.irreversibleChangesHint") }}</div>
            </FormField>

            <div v-if="props.mode === 'create'" class="flex items-start gap-1.5 rounded-md border border-[var(--border-color)] bg-[var(--bg-input)] px-2.5 py-1.5 text-[11px] text-[var(--text-muted)]">
                <span class="i-lucide-clock mt-0.5 h-3 w-3 shrink-0"></span>
                <span>{{ t("plotKeyframe.editor.createStatusHint") }}</span>
            </div>

            <template v-else>
                <div class="grid grid-cols-[160px_minmax(0,1fr)] gap-2">
                    <FormField :label="t('plotKeyframe.editor.status')">
                        <FormSelect v-model="draft.status" :options="statusOptions" />
                    </FormField>
                    <FormField v-if="draft.status === 'overthrown'" :label="t('plotKeyframe.editor.decisionRef')">
                        <!-- 决策候选可用时给下拉;候选拉取失败时退化为手填 id,避免推翻流程无路可走 -->
                        <FormSelect v-if="decisionOptions.length > 0" v-model="draft.decisionRefId" :options="decisionOptions" :placeholder="t('plotKeyframe.editor.decisionRefPlaceholder')" />
                        <FormInput v-else v-model="draft.decisionRefId" :placeholder="t('plotKeyframe.editor.decisionRefManualPlaceholder')" />
                    </FormField>
                </div>
                <div v-if="draft.status === 'overthrown'" class="flex items-start gap-1.5 rounded-md border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-2.5 py-1.5 text-[11px] text-[var(--status-warning)]">
                    <span class="i-lucide-gavel mt-0.5 h-3 w-3 shrink-0"></span>
                    <span>{{ t("plotKeyframe.editor.overthrownHint") }}</span>
                </div>
            </template>

            <FormField :label="t('plotKeyframe.editor.note')">
                <FormTextarea v-model="draft.note" :rows="2" :placeholder="t('plotKeyframe.editor.notePlaceholder')" />
                <div class="mt-1 text-[11px] leading-relaxed text-[var(--text-muted)]">{{ t("plotKeyframe.editor.noteHint") }}</div>
            </FormField>
        </div>
    </Dialog>
</template>
