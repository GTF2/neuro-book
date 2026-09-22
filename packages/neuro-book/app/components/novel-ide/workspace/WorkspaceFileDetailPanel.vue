<script setup lang="ts">
import {storeToRefs} from "pinia";
import SideDetailPanel from "nbook/app/components/common/SideDetailPanel.vue";
import LucideIconPickerDialog from "nbook/app/components/common/LucideIconPickerDialog.vue";
import TagInput from "nbook/app/components/common/form/TagInput.vue";
import FormSelect, {type SelectOption} from "nbook/app/components/common/form/FormSelect.vue";
import {useNovelIdeStore, type WorkspaceFileIssue, type WorkspaceFileNode} from "nbook/app/stores/novel-ide";
import {isWorkspaceContentScopePath} from "nbook/app/components/novel-ide/workspace/workspace-file-tree";
import {
    basename,
    parseMarkdownDocument,
    renderMarkdownDocument,
} from "nbook/app/components/novel-ide/workspace/workspace-frontmatter-profile";
import {normalizeLucideIconName, readLucideIconClass} from "nbook/app/utils/lucide-icons";

type FileDetailDraft = {
    title: string;
    status: string;
    aliases: string[];
    tags: string[];
    summary: string;
    icon: string | null;
    /** 正文；本面板不编辑正文，仅随对称 dirty 管道 round-trip */
    content: string;
    /** 表单未覆盖的 frontmatter 字段原样保留（功能一件不丢） */
    rest: Record<string, unknown>;
};

type ManuscriptStatsSnapshot = {
    currentWords: number;
    totalWords: number;
    totalSize: number;
    chapters: number;
    files: number;
    updatedAt: string;
};

const props = defineProps<{
    node: WorkspaceFileNode | null;
    issues: WorkspaceFileIssue[];
    height: number;
}>();

const emit = defineEmits<{
    (e: "update:height", value: number): void;
    (e: "close"): void;
    (e: "create-index"): void;
    (e: "convert-file-to-directory"): void;
    (e: "refresh"): void;
}>();

const store = useNovelIdeStore();
const {t, locale} = useI18n();
const {selectedFileContent, savingFile, workspaceTree} = storeToRefs(store);
const draft = ref<FileDetailDraft | null>(null);
const lastLoadedContent = ref("");
const diagnostics = ref("");
const iconPickerVisible = ref(false);
const manuscriptStats = ref<ManuscriptStatsSnapshot>({
    currentWords: 0,
    totalWords: 0,
    totalSize: 0,
    chapters: 0,
    files: 0,
    updatedAt: "",
});

const statusOptions = computed<SelectOption[]>(() => [
    {value: "draft", label: t("ide.workspace.fileDetail.draft"), description: t("ide.workspace.common.statusDraftDescription")},
    {value: "pending", label: t("ide.workspace.fileDetail.pending"), description: t("ide.workspace.common.statusPendingDescription")},
    {value: "active", label: t("ide.workspace.fileDetail.active"), description: t("ide.workspace.fileDetail.activeDescription")},
    {value: "archived", label: t("ide.workspace.fileDetail.archived"), description: t("ide.workspace.common.statusArchivedDescription")},
]);

const isMarkdownFile = computed(() => Boolean(props.node?.editable && props.node.path.toLowerCase().endsWith(".md")));
const isContentIndexFile = computed(() => Boolean(isMarkdownFile.value && props.node?.contentNode && props.node.path.toLowerCase().endsWith("/index.md")));
const isManuscriptIndexFile = computed(() => Boolean(isContentIndexFile.value && props.node?.path.startsWith("manuscript/")));
// 万字以下精确数字已可读，不追加单位标注。
const readableTotalWords = computed(() => {
    const words = manuscriptStats.value.totalWords;
    if (words >= 100_000_000) {
        return t("ide.workspace.fileDetail.readableYi", {count: (words / 100_000_000).toFixed(1)});
    }
    if (words >= 10_000) {
        return t("ide.workspace.fileDetail.readableWan", {count: Math.round(words / 10_000)});
    }
    return "";
});
const currentWordsLabel = computed(() => t("ide.workspace.fileDetail.unitWords", {count: manuscriptStats.value.currentWords.toLocaleString(locale.value)}));
const totalWordsLabel = computed(() => t("ide.workspace.fileDetail.unitWords", {count: manuscriptStats.value.totalWords.toLocaleString(locale.value)}));
const totalSizeLabel = computed(() => t("ide.workspace.fileDetail.unitKb", {count: (manuscriptStats.value.totalSize / 1024).toFixed(1)}));
const chaptersLabel = computed(() => t("ide.workspace.fileDetail.unitCount", {count: manuscriptStats.value.chapters.toLocaleString(locale.value)}));
const filesLabel = computed(() => t("ide.workspace.fileDetail.unitCount", {count: manuscriptStats.value.files.toLocaleString(locale.value)}));
const isDirectoryWithoutIndex = computed(() => Boolean(props.node?.isDirectory && !props.node.hasIndex));
const isContentDirectoryWithoutIndex = computed(() => Boolean(props.node?.isDirectory && !props.node.hasIndex && isWorkspaceContentScopePath(props.node.path)));
const canCreateIndex = computed(() => Boolean(isContentDirectoryWithoutIndex.value));
const canConvertFileToDirectory = computed(() => Boolean(
    props.node
    && !props.node.isDirectory
    && props.node.editable
    && isWorkspaceContentScopePath(props.node.path)
    && !props.node.path.toLowerCase().endsWith("/index.md"),
));
const currentIconName = computed(() => normalizeLucideIconName(draft.value?.icon) ?? normalizeLucideIconName(props.node?.icon));
const currentIconClass = computed(() => readLucideIconClass(currentIconName.value) ?? "i-lucide-notebook-tabs");
const slugLabel = computed(() => {
    const path = props.node?.path ?? "";
    const stemPath = path.toLowerCase().endsWith("/index.md") ? manuscriptBasePath.value : path.replace(/\.md$/i, "");
    return basename(stemPath);
});
const typeLabel = computed(() => {
    if (props.node?.isDirectory) {
        return t("ide.workspace.fileDetail.blockDirectory");
    }
    if (props.node?.path.toLowerCase().startsWith("manuscript/")) {
        return t("ide.workspace.filePanel.treeTypeChapter");
    }
    return t("ide.workspace.fileDetail.blockFile");
});
// dirty 用对称管道判定：磁盘内容也走 parse→createDraft→renderDraft 再比较，
// CRLF、YAML 键序、围栏后空行数等格式差异被同一管道吸收，只剩真语义差异（026 同族修法）。
const isDirty = computed(() => {
    if (!draft.value || !props.node) {
        return false;
    }
    const stored = parseMarkdownDocument(selectedFileContent.value);
    const storedDraft = createDraft(props.node, stored.frontmatter, stored.body);
    return renderDraft(draft.value) !== renderDraft(storedDraft);
});
// R4 件8：正文编辑不经过本面板 draft（watch 会随正文重建 draft 吸收差异），
// 须把 store 的正文未保存态并联进按钮与圆点——用户验收链=正文输入→按钮点亮+圆点→保存→熄灭。
const hasUnsavedBody = computed(() => store.hasUnsavedFileChanges);
const saveDisabled = computed(() => (!isDirty.value && !hasUnsavedBody.value) || savingFile.value);
// R5 件5：保存成功行内轻提示（1.5s 后淡出），替代大 toast。
const savedFlash = ref(false);
const savedFlashFading = ref(false);
let savedFlashTimer: ReturnType<typeof setTimeout> | null = null;
function flashSaved(): void {
    if (savedFlashTimer !== null) {
        clearTimeout(savedFlashTimer);
    }
    savedFlash.value = true;
    savedFlashFading.value = false;
    savedFlashTimer = setTimeout(() => {
        savedFlashFading.value = true;
        savedFlashTimer = setTimeout(() => {
            savedFlash.value = false;
            savedFlashFading.value = false;
            savedFlashTimer = null;
        }, 500);
    }, 1_500);
}
const manuscriptBasePath = computed(() => {
    if (!props.node) {
        return "";
    }
    if (props.node.path.toLowerCase().endsWith("/index.md")) {
        return props.node.path.slice(0, -"/index.md".length);
    }
    return props.node.path.replace(/\/$/, "");
});
const relatedIssues = computed(() => {
    if (!props.node) {
        return [];
    }

    const currentPath = props.node.path.replace(/\/$/, "");
    return props.issues.filter((issue) => issue.path === props.node?.path || issue.path.startsWith(currentPath));
});
const hasRelatedIssues = computed(() => relatedIssues.value.length > 0);

/**
 * 保存当前条目的表单字段，保留表单未覆盖的 frontmatter 字段与正文。
 * notify=true 给成功提示（009C1R 微调10：手动保存反馈；blur/表单联动自动保存静默）。
 */
async function saveDraft(options?: {notify?: boolean}): Promise<void> {
    if (!draft.value || !isContentIndexFile.value || diagnostics.value || props.node?.frontmatterError || savingFile.value) {
        return;
    }

    const nextContent = renderDraft(draft.value);
    // R4 件8：表单无差异但正文 buffer 未保存时不得提前返回（否则按钮点亮却保存空转）。
    if (nextContent === selectedFileContent.value && !store.hasUnsavedFileChanges) {
        return;
    }

    selectedFileContent.value = nextContent;
    await store.saveCurrentFile();
    lastLoadedContent.value = selectedFileContent.value;
    if (options?.notify) {
        flashSaved();
    }
}

/**
 * 手动刷新 manuscript 当前节点与子树统计快照。
 */
function refreshManuscriptStats(): void {
    if (!props.node || !isManuscriptIndexFile.value) {
        manuscriptStats.value = {
            currentWords: props.node?.words ?? 0,
            totalWords: props.node?.words ?? 0,
            totalSize: props.node?.size ?? 0,
            chapters: 0,
            files: 0,
            updatedAt: "",
        };
        return;
    }

    const prefix = `${manuscriptBasePath.value}/`;
    const descendants = workspaceTree.value.filter((node) => node.path.startsWith(prefix));
    manuscriptStats.value = {
        currentWords: props.node.words,
        totalWords: descendants.reduce((total, node) => total + node.words, props.node?.words ?? 0),
        totalSize: descendants.reduce((total, node) => total + node.size, props.node?.size ?? 0),
        chapters: descendants.filter((node) => node.contentNode && !node.isDirectory && node.path.toLowerCase().endsWith("/index.md")).length,
        files: descendants.filter((node) => !node.isDirectory).length,
        updatedAt: new Date().toLocaleTimeString(locale.value, {hour: "2-digit", minute: "2-digit"}),
    };
}

/**
 * 将选择器里的图标名写入草稿并保存。
 */
function applySelectedIcon(iconName: string): void {
    if (!draft.value) {
        return;
    }
    draft.value.icon = normalizeLucideIconName(iconName);
    void saveDraft();
}

/** R4 件9③：project.yaml 表单化（C 类极简→最低表单）。title 必填（BUG030 前端拦截联动）。 */
const isProjectYamlFile = computed(() => (props.node?.path ?? "").toLowerCase() === "project.yaml");
type ProjectYamlDraft = {title: string; summary: string};
const projectYamlDraft = ref<ProjectYamlDraft | null>(null);
const projectYamlBaseline = ref("");
const projectTitleInvalid = computed(() => Boolean(projectYamlDraft.value) && projectYamlDraft.value!.title.trim().length === 0);
const projectYamlDirty = computed(() => {
    if (!projectYamlDraft.value) {
        return false;
    }
    return renderProjectYaml(projectYamlDraft.value, projectYamlBaseline.value) !== projectYamlBaseline.value;
});

function readProjectYamlField(content: string, key: "title" | "summary"): string {
    const match = content.match(new RegExp(`^${key}:\\s*(.*)$`, "mu"));
    return match ? match[1]!.trim().replace(/^["']|["']$/gu, "") : "";
}

/** 行级替换写回：保序并原样保留 cover 等未知字段，不整文件重排。 */
function renderProjectYaml(draftValue: ProjectYamlDraft, baseline: string): string {
    const quote = (value: string): string => (value === "" || /[:#\-?"']/u.test(value) ? JSON.stringify(value) : value);
    const lines = baseline.split("\n");
    let titleDone = false;
    let summaryDone = false;
    const out: string[] = [];
    for (const line of lines) {
        if (/^title:/u.test(line)) {
            out.push(`title: ${quote(draftValue.title.trim())}`);
            titleDone = true;
        } else if (/^summary:/u.test(line)) {
            out.push(`summary: ${quote(draftValue.summary)}`);
            summaryDone = true;
        } else {
            out.push(line);
        }
    }
    if (!titleDone) {
        out.unshift(`title: ${quote(draftValue.title.trim())}`);
    }
    if (!summaryDone) {
        out.push(`summary: ${quote(draftValue.summary)}`);
    }
    return out.join("\n");
}

function rebuildProjectYamlDraft(): void {
    if (!isProjectYamlFile.value) {
        projectYamlDraft.value = null;
        projectYamlBaseline.value = "";
        return;
    }
    projectYamlBaseline.value = selectedFileContent.value;
    projectYamlDraft.value = {
        title: readProjectYamlField(selectedFileContent.value, "title"),
        summary: readProjectYamlField(selectedFileContent.value, "summary"),
    };
}

/** 保存 project.yaml 表单：走统一 store 保存链；空 title 由 UI 校验拦在前端+服务端 400 双保险兜底。 */
async function saveProjectYaml(): Promise<void> {
    if (!projectYamlDraft.value || projectTitleInvalid.value || savingFile.value) {
        return;
    }
    const next = renderProjectYaml(projectYamlDraft.value, projectYamlBaseline.value);
    if (next === projectYamlBaseline.value && !store.hasUnsavedFileChanges) {
        return;
    }
    selectedFileContent.value = next;
    await store.saveCurrentFile();
    projectYamlBaseline.value = next;
    flashSaved();
}

watch(() => [props.node?.path, selectedFileContent.value], () => {
    if (!isContentIndexFile.value || !props.node) {
        draft.value = null;
        diagnostics.value = "";
        lastLoadedContent.value = selectedFileContent.value;
        refreshManuscriptStats();
        rebuildProjectYamlDraft();
        return;
    }
    if (selectedFileContent.value === lastLoadedContent.value) {
        return;
    }

    const parsed = parseMarkdownDocument(selectedFileContent.value);
    draft.value = createDraft(props.node, parsed.frontmatter, parsed.body);
    diagnostics.value = parsed.error ?? "";
    refreshManuscriptStats();
    lastLoadedContent.value = selectedFileContent.value;
}, {immediate: true});



/**
 * 从 frontmatter 与文件节点生成表单草稿；表单未覆盖的字段收进 rest 原样保留。
 */
function createDraft(node: WorkspaceFileNode, frontmatter: Record<string, unknown>, body: string): FileDetailDraft {
    const rest = {...frontmatter};
    delete rest.title;
    delete rest.status;
    delete rest.aliases;
    delete rest.tags;
    delete rest.summary;
    delete rest.icon;
    return {
        title: readString(frontmatter.title, node.title || basename(node.path)),
        status: readString(frontmatter.status, ""),
        aliases: readStringArray(frontmatter.aliases),
        tags: readStringArray(frontmatter.tags),
        summary: readString(frontmatter.summary, node.summary),
        icon: normalizeLucideIconName(frontmatter.icon),
        content: body,
        rest,
    };
}

function renderDraft(draft: FileDetailDraft): string {
    const frontmatter = {
        ...draft.rest,
        title: draft.title,
        status: draft.status || null,
        aliases: draft.aliases,
        tags: draft.tags,
        summary: draft.summary,
        icon: draft.icon,
    };
    return renderMarkdownDocument(frontmatter, draft.content);
}

function readString(value: unknown, fallback: string): string {
    return typeof value === "string" ? value : fallback;
}

function readStringArray(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
</script>

<template>
    <SideDetailPanel
        :visible="Boolean(props.node)"
        :height="props.height"
        body-class="overflow-x-hidden p-2"
        @update:height="emit('update:height', $event)"
        @close="emit('close')"
    >
        <template #header>
            <!-- R4 件9②：对齐世界书面板头部形态——图标徽章+font-serif 标题（A 基准） -->
            <div class="flex min-w-0 items-center gap-2 overflow-hidden">
                <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-[var(--border-color)] bg-[var(--bg-input)] text-[11px] text-[var(--accent-text)]">
                    <span :class="currentIconClass" class="h-3.5 w-3.5"></span>
                </span>
                <!-- R5 件6②：头部去掉路径行（名字干净），路径移到标题悬停 -->
                <div class="min-w-0 overflow-hidden" :title="props.node?.path">
                    <div class="truncate font-serif text-sm font-bold tracking-wide text-[var(--text-main)]">{{ props.node?.title || props.node?.path || t("ide.workspace.fileDetail.title") }}</div>
                </div>
            </div>
        </template>

        <template #actions>
            <button class="rounded-md px-2 py-1 text-[10px] text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-main)]" type="button" @click="emit('refresh')">{{ t("ide.workspace.common.refresh") }}</button>
            <button v-if="canCreateIndex" class="rounded-md px-2 py-1 text-[10px] text-[var(--accent-text)] hover:bg-[var(--bg-hover)]" type="button" @click="emit('create-index')">{{ t("ide.workspace.fileDetail.convert") }}</button>
            <button v-if="canConvertFileToDirectory" class="rounded-md px-2 py-1 text-[10px] text-[var(--accent-text)] hover:bg-[var(--bg-hover)]" type="button" @click="emit('convert-file-to-directory')">{{ t("ide.workspace.fileDetail.convertToDirectory") }}</button>
            <!-- R5 件4：未保存圆点挪到保存按钮右上角；件5：保存中轻禁用+行内 spinner+1.5s「已保存」淡出 -->
            <span v-if="savedFlash" class="inline-flex items-center gap-1 text-[10px] text-[var(--status-success)] transition-opacity duration-500" :class="savedFlashFading ? 'opacity-0' : 'opacity-100'"><span class="i-lucide-check h-3 w-3"></span>{{ t("ide.workspace.common.saved") }}</span>
            <button v-if="projectYamlDraft" class="relative inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-[var(--accent-text)] transition-opacity hover:bg-[var(--bg-hover)] disabled:cursor-not-allowed" :class="savingFile ? 'opacity-70' : ''" type="button" :disabled="(!projectYamlDirty && !hasUnsavedBody) || projectTitleInvalid || savingFile" @click="void saveProjectYaml()">
                <span v-if="(projectYamlDirty || hasUnsavedBody) && !savingFile && !projectTitleInvalid" class="absolute -right-1 -top-1 inline-block h-1.5 w-1.5 rounded-full bg-[var(--status-warning)]" :title="t('ide.workspace.common.unsaved')"></span>
                <span v-if="savingFile" class="i-lucide-loader-circle h-3 w-3 animate-spin"></span>{{ t("ide.workspace.common.save") }}
            </button>
            <button v-if="draft" class="relative inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-[var(--accent-text)] transition-opacity hover:bg-[var(--bg-hover)] disabled:cursor-not-allowed" :class="savingFile ? 'opacity-70' : ''" type="button" :disabled="saveDisabled" @click="void saveDraft({notify: true})">
                <span v-if="(isDirty || hasUnsavedBody) && !savingFile" class="absolute -right-1 -top-1 inline-block h-1.5 w-1.5 rounded-full bg-[var(--status-warning)]" :title="t('ide.workspace.common.unsaved')"></span>
                <span v-if="savingFile" class="i-lucide-loader-circle h-3 w-3 animate-spin"></span>{{ t("ide.workspace.common.save") }}
            </button>
        </template>

        <div v-if="props.node" class="grid min-w-0 gap-2 text-xs text-[var(--text-secondary)]">
            <div v-if="diagnostics || props.node.frontmatterError" class="rounded-md border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] p-2 text-[var(--status-danger)]">
                {{ diagnostics || props.node.frontmatterError }}
            </div>

            <div v-if="isContentDirectoryWithoutIndex" class="rounded-md border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] p-2 text-[var(--status-warning)]">
                {{ t("ide.workspace.fileDetail.contentDirectoryWithoutIndex") }}
            </div>
            <div v-else-if="isDirectoryWithoutIndex" class="rounded-md border border-[var(--border-color)] bg-[var(--bg-input)] p-2 text-[var(--text-muted)]">
                {{ t("ide.workspace.fileDetail.directoryWithoutIndex") }}
            </div>

            <!-- 表单化条目面板：对齐世界书面板形态（028 统一+R4 件9② 视觉基准） -->
            <div v-if="draft" class="min-w-0 space-y-2">
                <!-- manuscript 卷/章统计卡片（026 单位版；R4 件9② 移顶部打开即见） -->
                <div v-if="isManuscriptIndexFile" class="space-y-2 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-input)]/20 p-2">
                    <div class="flex items-center justify-between gap-2">
                        <div class="text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)]">{{ t("ide.workspace.fileDetail.blockManuscript") }}</div>
                        <div class="flex shrink-0 items-center gap-2">
                            <span v-if="manuscriptStats.updatedAt" class="text-[10px] text-[var(--text-muted)]">{{ manuscriptStats.updatedAt }}</span>
                            <button type="button" class="rounded-md border border-[var(--border-color)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-main)]" :title="t('ide.workspace.fileDetail.hintUpdateStats')" @click="refreshManuscriptStats">{{ t("ide.workspace.fileDetail.updateStats") }}</button>
                        </div>
                    </div>
                    <div class="grid grid-cols-5 gap-1.5">
                        <div class="rounded-md border border-[var(--border-color)] bg-[var(--bg-panel)] px-2 py-1.5">
                            <div class="text-[8px] uppercase tracking-[0.12em] text-[var(--text-muted)]">{{ t("ide.workspace.fileDetail.current") }}</div>
                            <div class="mt-0.5 text-[var(--text-main)]">{{ currentWordsLabel }}</div>
                        </div>
                        <div class="rounded-md border border-[var(--border-color)] bg-[var(--bg-panel)] px-2 py-1.5">
                            <div class="text-[8px] uppercase tracking-[0.12em] text-[var(--text-muted)]">{{ t("ide.workspace.fileDetail.total") }}</div>
                            <div class="mt-0.5 text-[var(--text-main)]">{{ totalWordsLabel }}</div>
                            <div v-if="readableTotalWords" class="text-[11px] text-[var(--text-muted)]">{{ readableTotalWords }}</div>
                        </div>
                        <div class="rounded-md border border-[var(--border-color)] bg-[var(--bg-panel)] px-2 py-1.5">
                            <div class="text-[8px] uppercase tracking-[0.12em] text-[var(--text-muted)]">{{ t("ide.workspace.fileDetail.size") }}</div>
                            <div class="mt-0.5 text-[var(--text-main)]">{{ totalSizeLabel }}</div>
                        </div>
                        <div class="rounded-md border border-[var(--border-color)] bg-[var(--bg-panel)] px-2 py-1.5">
                            <div class="text-[8px] uppercase tracking-[0.12em] text-[var(--text-muted)]">{{ t("ide.workspace.fileDetail.chapters") }}</div>
                            <div class="mt-0.5 text-[var(--text-main)]">{{ chaptersLabel }}</div>
                        </div>
                        <div class="rounded-md border border-[var(--border-color)] bg-[var(--bg-panel)] px-2 py-1.5">
                            <div class="text-[8px] uppercase tracking-[0.12em] text-[var(--text-muted)]">{{ t("ide.workspace.fileDetail.files") }}</div>
                            <div class="mt-0.5 text-[var(--text-main)]">{{ filesLabel }}</div>
                        </div>
                    </div>
                </div>

                <!-- 路径与标题信息卡（A 基准分组口径：rounded-2xl） -->
                <div class="space-y-2 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-input)]/20 p-2">
                    <div class="grid grid-cols-2 gap-2">
                        <div class="space-y-1">
                            <label class="text-[11px] font-medium text-[var(--text-secondary)]" :title="t('ide.workspace.fileDetail.hintTitle')">{{ t("ide.workspace.lorebookDetail.displayTitle") }}</label>
                            <input v-model="draft.title" class="h-7 w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-panel)] px-2 text-xs text-[var(--text-main)] outline-none focus:border-[var(--accent-main)]" type="text" @blur="void saveDraft()">
                        </div>
                        <div class="space-y-1">
                            <label class="text-[11px] font-medium text-[var(--text-secondary)]">{{ t("ide.workspace.lorebookDetail.slugName") }}</label>
                            <input :value="slugLabel" type="text" disabled class="h-7 w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-panel)] px-2 font-mono text-xs text-[var(--text-muted)] outline-none">
                        </div>
                    </div>
                    <div class="space-y-1">
                        <label class="text-[11px] font-medium text-[var(--text-secondary)]">{{ t("ide.workspace.lorebookDetail.path") }}</label>
                        <div class="truncate rounded-md border border-[var(--border-color)]/70 bg-[var(--bg-panel)] px-2 py-1.5 font-mono text-[10px] text-[var(--text-muted)]" :title="props.node.path">{{ props.node.path }}</div>
                    </div>
                    <div class="grid grid-cols-2 gap-2">
                        <div class="space-y-1">
                            <label class="text-[11px] font-medium text-[var(--text-secondary)]">{{ t("ide.workspace.fileDetail.typeLabel") }}</label>
                            <input :value="typeLabel" type="text" disabled class="h-7 w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-panel)] px-2 text-xs text-[var(--text-muted)] outline-none">
                        </div>
                        <div class="space-y-1">
                            <label class="text-[11px] font-medium text-[var(--text-secondary)]" :title="t('ide.workspace.fileDetail.hintStatus')">{{ t("ide.workspace.common.status") }}</label>
                            <FormSelect :model-value="draft.status || 'draft'" :options="statusOptions" @update:model-value="draft.status = $event; void saveDraft()" />
                        </div>
                    </div>
                    <div v-if="isContentIndexFile" class="flex items-center justify-between gap-2 rounded-md border border-[var(--border-color)] bg-[var(--bg-panel)] px-2 py-1.5">
                        <div class="flex min-w-0 items-center gap-2">
                            <span :class="currentIconClass" class="h-4 w-4 shrink-0 text-[var(--accent-text)]"></span>
                            <span class="truncate text-[11px] text-[var(--text-secondary)]">{{ currentIconName || t("ide.workspace.fileDetail.noIcon") }}</span>
                        </div>
                        <button type="button" class="rounded-md border border-[var(--border-color)] px-2 py-1 text-[10px] text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-main)]" @click="iconPickerVisible = true">{{ t("ide.workspace.fileDetail.chooseIcon") }}</button>
                    </div>
                </div>

                <div class="space-y-2">
                    <div class="space-y-1">
                        <label class="text-[11px] font-medium text-[var(--text-secondary)]">{{ t("ide.workspace.common.aliases") }}</label>
                        <TagInput :model-value="draft.aliases" :placeholder="t('ide.workspace.common.addThenEnter')" @update:model-value="draft.aliases = $event; void saveDraft()" />
                    </div>
                    <div class="space-y-1">
                        <label class="text-[11px] font-medium text-[var(--text-secondary)]" :title="t('ide.workspace.fileDetail.hintTags')">{{ t("ide.workspace.common.tags") }}</label>
                        <TagInput :model-value="draft.tags" :placeholder="t('ide.workspace.common.addThenEnter')" accentStyle @update:model-value="draft.tags = $event; void saveDraft()" />
                    </div>
                    <div class="space-y-1">
                        <label class="text-[11px] font-medium text-[var(--text-secondary)]" :title="t('ide.workspace.fileDetail.hintSummary')">{{ t("ide.workspace.common.summary") }}</label>
                        <textarea v-model="draft.summary" rows="3" class="w-full resize-y rounded-md border border-[var(--border-color)] bg-[var(--bg-panel)] px-2 py-1.5 text-xs leading-5 text-[var(--text-main)] outline-none focus:border-[var(--accent-main)]" @blur="void saveDraft()"></textarea>
                    </div>
                </div>
            </div>

            <!-- R4 件9③：project.yaml 表单化——显示标题必填（BUG030 前端拦截），其余保持简洁 -->
            <div v-if="projectYamlDraft" class="space-y-2">
                <div class="space-y-2 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-input)]/20 p-2">
                    <div class="space-y-1">
                        <label class="text-[11px] font-medium text-[var(--text-secondary)]">{{ t("ide.workspace.lorebookDetail.displayTitle") }} *</label>
                        <input v-model="projectYamlDraft.title" class="h-7 w-full rounded-md border px-2 text-xs outline-none focus:border-[var(--accent-main)]" :class="projectTitleInvalid ? 'border-[var(--status-danger-border)] bg-[var(--status-danger-bg)]' : 'border-[var(--border-color)] bg-[var(--bg-panel)] text-[var(--text-main)]'" type="text">
                        <div v-if="projectTitleInvalid" class="text-[10px] text-[var(--status-danger)]">{{ t("ide.workspace.fileDetail.projectTitleRequired") }}</div>
                    </div>
                    <div class="space-y-1">
                        <label class="text-[11px] font-medium text-[var(--text-secondary)]">{{ t("ide.workspace.lorebookDetail.slugName") }}</label>
                        <input :value="basename(props.node?.path ?? '')" type="text" disabled class="h-7 w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-panel)] px-2 font-mono text-xs text-[var(--text-muted)] outline-none">
                    </div>
                    <div class="space-y-1">
                        <label class="text-[11px] font-medium text-[var(--text-secondary)]">{{ t("ide.workspace.common.summary") }}</label>
                        <textarea v-model="projectYamlDraft.summary" rows="2" class="w-full resize-y rounded-md border border-[var(--border-color)] bg-[var(--bg-panel)] px-2 py-1.5 text-xs leading-5 text-[var(--text-main)] outline-none focus:border-[var(--accent-main)]"></textarea>
                    </div>
                </div>
            </div>

            <!-- 非索引杂项文件：只读信息卡（最低统一=路径+可编辑状态；保存链与全局一致=编辑器编辑失焦保存） -->
            <div v-else-if="!draft" class="space-y-2">
                <div class="rounded-md border border-[var(--border-color)] bg-[var(--bg-input)] px-2 py-1.5">
                    <div class="flex items-center justify-between gap-2">
                        <div class="text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)]">{{ typeLabel }}</div>
                        <div class="shrink-0 text-[10px] text-[var(--text-muted)]" :title="props.node.editable ? t('ide.workspace.fileDetail.hintEditable') : t('ide.workspace.fileDetail.hintReadonly')">{{ props.node.editable ? t("ide.workspace.fileDetail.editable") : t("ide.workspace.fileDetail.readonly") }}</div>
                    </div>
                    <div class="mt-1 max-w-full truncate font-mono text-[11px] text-[var(--text-main)]" :title="props.node.path">{{ props.node.path }}</div>
                </div>
                <div v-if="props.node.summary" class="rounded-md border border-[var(--border-color)] bg-[var(--bg-input)] p-2 leading-5">
                    {{ props.node.summary }}
                </div>
            </div>

            <div v-if="hasRelatedIssues" class="space-y-2">
                <div class="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">{{ t("ide.workspace.fileDetail.validate") }}</div>
                <div v-for="issue in relatedIssues" :key="`${issue.code}:${issue.path}:${issue.message}`" class="rounded-md border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] p-2 text-[var(--status-warning)]">
                    <div class="font-medium">[{{ issue.level }}] {{ issue.code }}</div>
                    <div class="mt-1 leading-5">{{ issue.message }}</div>
                </div>
            </div>
        </div>

        <LucideIconPickerDialog
            v-model="iconPickerVisible"
            :selected-icon="currentIconName"
            @select="applySelectedIcon"
        />
    </SideDetailPanel>
</template>
