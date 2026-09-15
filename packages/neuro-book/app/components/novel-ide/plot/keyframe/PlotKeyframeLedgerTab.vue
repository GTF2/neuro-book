<script setup lang="ts">
// 关键帧 tab(写作宪法第三条):帧列表 + 新建/编辑。
// 数据自加载:组件内部经 plot-keyframe-api 拉列表,不从工作台宿主传帧数据;watch plotRefreshVersion 跟进
// Agent 侧改动。补间区间可视化、批量操作、拖拽排序不在本轮范围。
import {computed, onMounted, ref, watch} from "vue";
import {storeToRefs} from "pinia";
import PlotKeyframeEditorDialog from "nbook/app/components/novel-ide/plot/keyframe/PlotKeyframeEditorDialog.vue";
import type {PlotKeyframeEditorSave} from "nbook/app/components/novel-ide/plot/keyframe/PlotKeyframeEditorDialog.vue";
import {
    createStoryKeyframe,
    listStoryKeyframes,
    updateStoryKeyframe,
} from "nbook/app/components/novel-ide/plot/keyframe/plot-keyframe-api";
import {
    formatKeyframeInstant,
    KEYFRAME_SOURCE_META,
    KEYFRAME_STATUS_META,
    KEYFRAME_TONE_CLASSES,
    sortKeyframesByInstant,
} from "nbook/app/components/novel-ide/plot/keyframe/plot-keyframe.logic";
import {listStoryDecisions} from "nbook/app/components/novel-ide/plot/planning/plot-planning-api";
import {useNovelIdeStore} from "nbook/app/stores/novel-ide";
import {resolveApiErrorMessage} from "nbook/app/utils/api-error";
import type {StoryDecisionDto, StoryKeyframeDto} from "nbook/shared/dto/plot.dto";

const props = defineProps<{
    projectRoot: string;
}>();

const {t} = useI18n();
const novelIdeStore = useNovelIdeStore();
const {plotRefreshVersion} = storeToRefs(novelIdeStore);

const keyframes = ref<StoryKeyframeDto[]>([]);
const listLoading = ref(false);
// 为空表示列表加载正常;非空为可重试的加载错误。
const listError = ref("");
// 裁决留痕候选(创作决策记录);加载失败只影响推翻留痕的选择,不阻塞帧列表。
const decisions = ref<StoryDecisionDto[]>([]);

const editorVisible = ref(false);
const editorMode = ref<"create" | "edit">("create");
// 编辑目标快照(打开编辑时捕获):避免后台刷新替换列表后提交到错误对象。
const editingKeyframe = ref<StoryKeyframeDto | null>(null);
const savingEditor = ref(false);
// 为空表示编辑对话框无保存错误(错误留在对话框内,可改后重试)。
const editorError = ref("");

// 竞态守卫(仿账本 tab):只接受最新一次列表请求的结果。
let listRequestVersion = 0;

// 按故事时间升序;服务已排序,这里再排一次使界面顺序不依赖返回字段顺序。
const orderedKeyframes = computed(() => sortKeyframesByInstant(keyframes.value));

// 同名前置校验的数据源(含编辑对象自身,校验层按当前帧名豁免)。
const existingNames = computed(() => keyframes.value.map((keyframe) => keyframe.name));

/** 拉取帧列表;竞态守卫,只接受最新请求。 */
async function loadKeyframes(): Promise<void> {
    if (!props.projectRoot) {
        return;
    }
    const requestVersion = ++listRequestVersion;
    listLoading.value = true;
    listError.value = "";
    try {
        const response = await listStoryKeyframes(props.projectRoot);
        if (requestVersion !== listRequestVersion) {
            return;
        }
        keyframes.value = response;
    } catch (error) {
        if (requestVersion !== listRequestVersion) {
            return;
        }
        listError.value = resolveApiErrorMessage(error, t("plotKeyframe.loadFailed"));
    } finally {
        if (requestVersion === listRequestVersion) {
            listLoading.value = false;
        }
    }
}

/** 拉取裁决留痕候选;失败降级为空列表(推翻留痕届时退化为手填 id),不影响帧列表可用性。 */
async function loadDecisions(): Promise<void> {
    if (!props.projectRoot) {
        return;
    }
    try {
        decisions.value = await listStoryDecisions(props.projectRoot);
    } catch {
        decisions.value = [];
    }
}

/** 打开新建帧对话框(人写帧:来源恒 author)。 */
function openCreateEditor(): void {
    editorMode.value = "create";
    editingKeyframe.value = null;
    editorError.value = "";
    editorVisible.value = true;
}

/** 打开编辑帧对话框(捕获当前行快照为编辑目标)。 */
function openEditEditor(keyframe: StoryKeyframeDto): void {
    editorMode.value = "edit";
    editingKeyframe.value = keyframe;
    editorError.value = "";
    editorVisible.value = true;
}

/**
 * 保存编辑对话框:create 走 POST(恒 pending),edit 走 PATCH。
 * 写操作返回最新帧:就地替换列表行(免整表重拉),并按 instant 重新排序。
 * 保存错误写 editorError(留在对话框内可改后重试)。
 */
async function saveEditor(payload: PlotKeyframeEditorSave): Promise<void> {
    if (savingEditor.value) {
        return;
    }
    if (payload.mode === "edit" && !payload.keyframeId) {
        return;
    }
    savingEditor.value = true;
    editorError.value = "";
    try {
        const saved = payload.mode === "create"
            ? await createStoryKeyframe(props.projectRoot, payload.body)
            : await updateStoryKeyframe(props.projectRoot, payload.keyframeId, payload.body);
        keyframes.value = keyframes.value.some((item) => item.id === saved.id)
            ? keyframes.value.map((item) => item.id === saved.id ? saved : item)
            : [...keyframes.value, saved];
        editorVisible.value = false;
    } catch (error) {
        editorError.value = resolveApiErrorMessage(error, t("plotKeyframe.saveFailed"));
    } finally {
        savingEditor.value = false;
    }
}

// 激活(挂载)时拉取帧与裁决留痕候选。
onMounted(() => {
    void loadKeyframes();
    void loadDecisions();
});

// Agent 改动帧时(SSE 推进 plotRefreshVersion),打开着的面板自动刷新。
watch(plotRefreshVersion, () => {
    void loadKeyframes();
});
</script>

<template>
    <!-- 关键帧面板主体:帧列表 + 新建入口 -->
    <div class="flex min-h-0 min-w-0 flex-1 flex-col" data-testid="plot-keyframe-ledger">
        <div class="shrink-0 space-y-2 border-b border-[var(--border-color)] px-4 py-3">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-main)]">
                    <span class="i-lucide-milestone h-3.5 w-3.5 text-[var(--text-muted)]"></span>
                    <span>{{ t("plotKeyframe.title", {count: orderedKeyframes.length}) }}</span>
                    <span v-if="listLoading" class="i-lucide-loader-circle h-3 w-3 animate-spin text-[var(--text-muted)]"></span>
                </div>
                <button type="button" data-testid="plot-keyframe-create" class="inline-flex h-6 items-center gap-1 rounded-md border border-[var(--border-color)] bg-[var(--bg-input)] px-2 text-[11px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--accent-text)]" @click="openCreateEditor">
                    <span class="i-lucide-plus h-3 w-3"></span>
                    {{ t("plotKeyframe.create") }}
                </button>
            </div>
            <!-- instant 显示口径:不换算日历时间,直接呈现原始 World Engine 时刻 -->
            <div class="text-[11px] leading-relaxed text-[var(--text-muted)]">{{ t("plotKeyframe.instantDisplayHint") }}</div>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto px-4 py-3 custom-scrollbar">
            <div v-if="listError" class="space-y-2 rounded-md border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-3 py-2.5 text-[11px] text-[var(--status-danger)]">
                <div>{{ listError }}</div>
                <button type="button" class="rounded-md border border-[var(--status-danger-border)] px-2 py-1 text-[10px] font-semibold transition-colors hover:bg-[var(--status-danger-bg)]" @click="loadKeyframes()">{{ t("plotKeyframe.retry") }}</button>
            </div>

            <div v-else-if="listLoading && keyframes.length === 0" class="flex items-center justify-center gap-2 px-4 py-10 text-[11px] text-[var(--text-muted)]">
                <span class="i-lucide-loader-circle h-3.5 w-3.5 animate-spin"></span>
                {{ t("plotKeyframe.loading") }}
            </div>

            <!-- 空态:还没有任何帧 -->
            <div v-else-if="orderedKeyframes.length === 0" class="flex flex-col items-center gap-2 px-4 py-12 text-center">
                <span class="i-lucide-milestone h-7 w-7 text-[var(--text-muted)] opacity-50"></span>
                <div class="text-[12px] text-[var(--text-secondary)]">{{ t("plotKeyframe.empty.title") }}</div>
                <div class="max-w-[420px] text-[11px] leading-relaxed text-[var(--text-muted)]">{{ t("plotKeyframe.empty.description") }}</div>
                <button type="button" class="mt-1 inline-flex h-7 items-center gap-1 rounded-md border border-transparent bg-[var(--accent-main)] px-3 text-[11px] font-medium text-[var(--text-inverse)] transition-all hover:opacity-90" @click="openCreateEditor">
                    <span class="i-lucide-plus h-3 w-3"></span>
                    {{ t("plotKeyframe.createFirst") }}
                </button>
            </div>

            <div v-else class="space-y-2">
                <button
                    v-for="keyframe in orderedKeyframes"
                    :key="keyframe.id"
                    type="button"
                    class="block w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-panel)]/60 px-3 py-2.5 text-left transition-colors hover:border-[var(--border-accent)] hover:bg-[var(--bg-hover)]"
                    :data-testid="`plot-keyframe-row-${keyframe.id}`"
                    @click="openEditEditor(keyframe)"
                >
                    <!-- 行首:instant(原始时刻) + 标题 + 状态/来源 -->
                    <div class="flex min-w-0 items-center gap-2">
                        <span class="shrink-0 rounded border border-[var(--border-color)] bg-[var(--bg-input)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--text-secondary)]" :title="t('plotKeyframe.instantRawTitle')">{{ formatKeyframeInstant(keyframe.instant) }}</span>
                        <span class="min-w-0 flex-1 truncate text-[12px] font-semibold text-[var(--text-main)]">{{ keyframe.title }}</span>
                        <span class="shrink-0 rounded-full px-1.5 py-0.5 text-[10px]" :class="KEYFRAME_TONE_CLASSES[KEYFRAME_STATUS_META[keyframe.status].tone].chip">{{ t(`plotKeyframe.status.${keyframe.status}`) }}</span>
                        <span class="shrink-0 rounded-full px-1.5 py-0.5 text-[10px]" :class="KEYFRAME_TONE_CLASSES[KEYFRAME_SOURCE_META[keyframe.source].tone].chip">{{ t(`plotKeyframe.source.${keyframe.source}`) }}</span>
                        <span class="inline-flex shrink-0 items-center gap-0.5 text-[10px] text-[var(--text-muted)]">
                            <span class="i-lucide-pen-line h-3 w-3"></span>
                            {{ t("plotKeyframe.list.edit") }}
                        </span>
                    </div>
                    <div class="mt-0.5 font-mono text-[10px] text-[var(--text-muted)]">{{ keyframe.name }}</div>

                    <!-- 不可逆变化:声明式事实列表,即该帧「不可逆地改变了什么」 -->
                    <div class="mt-1.5 space-y-0.5">
                        <div v-for="(change, index) in keyframe.irreversibleChanges" :key="`${keyframe.id}-${index}`" class="flex items-start gap-1.5 text-[11px] leading-relaxed text-[var(--text-secondary)]">
                            <span class="i-lucide-minus mt-0.5 h-3 w-3 shrink-0 text-[var(--text-muted)]"></span>
                            <span class="min-w-0 flex-1">{{ change }}</span>
                        </div>
                    </div>

                    <div v-if="keyframe.note" class="mt-1.5 flex items-start gap-1.5 text-[10px] leading-relaxed text-[var(--text-muted)]">
                        <span class="i-lucide-sticky-note mt-0.5 h-3 w-3 shrink-0"></span>
                        <span class="min-w-0 flex-1 truncate">{{ keyframe.note }}</span>
                    </div>
                </button>
            </div>
        </div>

        <PlotKeyframeEditorDialog
            :visible="editorVisible"
            :mode="editorMode"
            :keyframe="editingKeyframe"
            :existing-names="existingNames"
            :decisions="decisions"
            :saving="savingEditor"
            :error="editorError"
            @update:visible="editorVisible = $event"
            @save="saveEditor"
        />
    </div>
</template>
