<script setup lang="ts">
import {useNovelIdeStore} from "nbook/app/stores/novel-ide";
import {IDE_THEME_HOST_CLASS} from "nbook/app/utils/theme/theme-tokens";

/**
 * llmlint「扫 AI 味」面板。
 *
 * 只读入口：调用 `/api/workspace-files/llmlint-check` 拿到结构化命中并展示，
 * **绝不自动改写用户正文**（llmlint 的 check 本身也永不改写；fix 是另一个命令，本面板不触发）。
 *
 * 呈现形态选「非模态右侧抽屉」而不是居中弹窗：审稿时用户通常要边看命中边读原文，
 * 用遮罩把编辑器挡住反而是打断。抽屉不拦截编辑器交互。
 */

type ProseLintLevel = "high" | "medium" | "low";
type ProseLintReviewScope = "agent" | "human" | "none" | "all";

type ProseLintIssue = {
    ruleId: string;
    ruleTitle: string;
    namespace: string;
    level: ProseLintLevel;
    review: string;
    fixability: string;
    line: number;
    column: number;
    endLine: number;
    endColumn: number;
    match: string;
    context: {before: string; current: string; after: string};
    suggestion: string | null;
};

type ProseLintCheckResponse = {
    kind: "check";
    filePath: string;
    summary: {total: number; high: number; medium: number; low: number; visibleChars: number};
    filter: {review: string; hiddenByReview: number; minLevel: string; hiddenByLevel: number};
    registry: {rulesets: string[]; totalRules: number; activeRules: number; disabledRules: number};
    diagnostics: string[];
    issues: ProseLintIssue[];
};

const props = withDefaults(defineProps<{
    modelValue: boolean;
    filePath: string;
}>(), {
    filePath: "",
});

const emit = defineEmits<{
    (e: "update:modelValue", value: boolean): void;
}>();

const {t} = useI18n();
const novelIdeStore = useNovelIdeStore();

const isMounted = ref(false);
const loading = ref(false);
const errorMessage = ref("");
const report = ref<ProseLintCheckResponse | null>(null);
const reviewScope = ref<ProseLintReviewScope>("agent");
const minLevel = ref<ProseLintLevel>("low");

const reviewOptions = computed<Array<{value: ProseLintReviewScope; label: string}>>(() => [
    {value: "agent", label: t("markdownStudio.proseLint.reviewAgent")},
    {value: "human", label: t("markdownStudio.proseLint.reviewHuman")},
    {value: "none", label: t("markdownStudio.proseLint.reviewNone")},
    {value: "all", label: t("markdownStudio.proseLint.reviewAll")},
]);

const levelOptions = computed<Array<{value: ProseLintLevel; label: string}>>(() => [
    {value: "low", label: t("markdownStudio.proseLint.levelLow")},
    {value: "medium", label: t("markdownStudio.proseLint.levelMedium")},
    {value: "high", label: t("markdownStudio.proseLint.levelHigh")},
]);

const levelBadgeClass: Record<ProseLintLevel, string> = {
    high: "bg-[var(--status-danger)] text-[var(--text-inverse)]",
    medium: "bg-[var(--status-warning)] text-[var(--text-inverse)]",
    low: "bg-[var(--bg-hover)] text-[var(--text-muted)]",
};

const issues = computed(() => report.value?.issues ?? []);

/**
 * 构造工作区查询参数：用户资产工作区用 workspaceKind，其余用当前 Project root。
 */
function buildTargetQuery(): {projectRoot: string} | {workspaceKind: "user-assets"} {
    if (novelIdeStore.isUserAssetsWorkspace) {
        return {workspaceKind: "user-assets"};
    }
    return {projectRoot: novelIdeStore.currentProjectRoot};
}

/**
 * 运行一次扫描（只读）。
 */
async function runScan(): Promise<void> {
    if (!props.filePath) {
        errorMessage.value = t("markdownStudio.proseLint.noFile");
        report.value = null;
        return;
    }
    const query = buildTargetQuery();
    if ("projectRoot" in query && !query.projectRoot) {
        errorMessage.value = t("markdownStudio.proseLint.noProject");
        report.value = null;
        return;
    }

    loading.value = true;
    errorMessage.value = "";
    try {
        report.value = await $fetch<ProseLintCheckResponse>("/api/workspace-files/llmlint-check", {
            method: "POST",
            body: {
                ...query,
                path: props.filePath,
                review: reviewScope.value,
                minLevel: minLevel.value,
            },
        });
    } catch (error) {
        report.value = null;
        errorMessage.value = resolveErrorMessage(error);
    } finally {
        loading.value = false;
    }
}

/**
 * 从 $fetch 抛出的错误里取可读信息。
 */
function resolveErrorMessage(error: unknown): string {
    if (typeof error === "object" && error !== null && "data" in error) {
        const data = (error as {data?: {message?: string}}).data;
        if (data && typeof data.message === "string" && data.message) {
            return data.message;
        }
    }
    return error instanceof Error ? error.message : String(error);
}

function close(): void {
    emit("update:modelValue", false);
}

onMounted(() => {
    isMounted.value = true;
});

// 打开时自动扫描；关闭时清空，避免下次打开看到旧结果。
watch(() => props.modelValue, (visible) => {
    if (visible) {
        void runScan();
    } else {
        report.value = null;
        errorMessage.value = "";
    }
});

// 切换文件时若面板打开，自动重扫。
watch(() => props.filePath, () => {
    if (props.modelValue) {
        void runScan();
    }
});
</script>

<template>
    <Teleport v-if="isMounted" :to="`.${IDE_THEME_HOST_CLASS}`">
        <Transition name="nb-prose-lint">
            <aside
                v-if="props.modelValue"
                class="fixed right-0 top-0 z-[80] flex h-full w-[440px] max-w-[92vw] flex-col border-l border-[var(--border-color)] bg-[var(--bg-panel)] text-[var(--text-main)] shadow-2xl"
                data-role="prose-lint-panel"
                aria-label="llmlint 扫 AI 味"
            >
                <!-- 标题栏 -->
                <header class="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--border-color)] px-4 py-2.5">
                    <div class="flex min-w-0 items-center gap-2">
                        <span class="i-lucide-scan-text h-4 w-4 shrink-0 text-[var(--accent-main)]"></span>
                        <span class="truncate text-sm font-semibold">{{ t("markdownStudio.proseLint.title") }}</span>
                    </div>
                    <div class="flex shrink-0 items-center gap-1">
                        <button
                            type="button"
                            class="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-main)] disabled:opacity-50"
                            :title="t('markdownStudio.proseLint.rescan')"
                            :disabled="loading"
                            @click="runScan"
                        >
                            <span class="i-lucide-refresh-cw h-4 w-4" :class="loading ? 'animate-spin' : ''"></span>
                        </button>
                        <button
                            type="button"
                            class="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-main)]"
                            :title="t('markdownStudio.proseLint.close')"
                            @click="close"
                        >
                            <span class="i-lucide-x h-4 w-4"></span>
                        </button>
                    </div>
                </header>

                <!-- 过滤器 -->
                <div class="flex shrink-0 flex-wrap items-center gap-3 border-b border-[var(--border-color)] px-4 py-2 text-xs text-[var(--text-muted)]">
                    <label class="flex items-center gap-1.5">
                        <span>{{ t("markdownStudio.proseLint.reviewLabel") }}</span>
                        <select v-model="reviewScope" class="nb-prose-lint__select" @change="runScan">
                            <option v-for="option in reviewOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
                        </select>
                    </label>
                    <label class="flex items-center gap-1.5">
                        <span>{{ t("markdownStudio.proseLint.levelLabel") }}</span>
                        <select v-model="minLevel" class="nb-prose-lint__select" @change="runScan">
                            <option v-for="option in levelOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
                        </select>
                    </label>
                </div>

                <!-- 正文 -->
                <div class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-3 custom-scrollbar">
                    <div v-if="loading" class="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                        <span class="i-lucide-loader-2 h-4 w-4 animate-spin"></span>
                        <span>{{ t("markdownStudio.proseLint.loading") }}</span>
                    </div>

                    <div v-else-if="errorMessage" class="rounded-md border border-[var(--status-danger)] bg-[var(--bg-input)] px-3 py-2 text-xs text-[var(--status-danger)]">
                        {{ errorMessage }}
                    </div>

                    <template v-else-if="report">
                        <!-- 汇总 -->
                        <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-secondary)]">
                            <span class="font-medium text-[var(--text-main)]">{{ t("markdownStudio.proseLint.total", {count: report.summary.total}) }}</span>
                            <span>{{ t("markdownStudio.proseLint.levelHigh") }} {{ report.summary.high }}</span>
                            <span>{{ t("markdownStudio.proseLint.levelMedium") }} {{ report.summary.medium }}</span>
                            <span>{{ t("markdownStudio.proseLint.levelLow") }} {{ report.summary.low }}</span>
                        </div>
                        <div
                            v-if="report.filter.hiddenByReview || report.filter.hiddenByLevel"
                            class="text-[11px] text-[var(--text-muted)]"
                        >
                            {{ t("markdownStudio.proseLint.hidden", {review: report.filter.hiddenByReview, level: report.filter.hiddenByLevel}) }}
                        </div>

                        <!-- 命中列表 -->
                        <div v-if="issues.length === 0" class="rounded-md border border-dashed border-[var(--border-color)] px-3 py-6 text-center text-xs text-[var(--text-muted)]">
                            {{ t("markdownStudio.proseLint.empty") }}
                        </div>
                        <ul v-else class="flex flex-col gap-2">
                            <li
                                v-for="(issue, index) in issues"
                                :key="`${issue.ruleId}-${issue.line}-${issue.column}-${index}`"
                                class="rounded-md border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2"
                            >
                                <div class="flex min-w-0 items-center gap-2 text-xs">
                                    <span class="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none" :class="levelBadgeClass[issue.level]">
                                        {{ issue.level }}
                                    </span>
                                    <span class="shrink-0 font-mono text-[var(--text-muted)]">{{ issue.line }}:{{ issue.column }}</span>
                                    <span class="min-w-0 truncate font-mono text-[var(--text-main)]">{{ issue.match }}</span>
                                </div>
                                <div class="mt-1 truncate text-[11px] text-[var(--text-muted)]" :title="issue.ruleId">
                                    {{ issue.ruleId }} · {{ issue.ruleTitle }}
                                </div>
                                <div v-if="issue.suggestion" class="mt-1 text-[12px] leading-relaxed text-[var(--text-secondary)]">
                                    {{ issue.suggestion }}
                                </div>
                            </li>
                        </ul>

                        <div v-if="report.diagnostics.length" class="mt-1 border-t border-[var(--border-color)] pt-2 text-[11px] text-[var(--text-muted)]">
                            <div v-for="(diagnostic, index) in report.diagnostics" :key="index">{{ diagnostic }}</div>
                        </div>
                    </template>
                </div>

                <!-- 页脚：只读声明 -->
                <footer class="shrink-0 border-t border-[var(--border-color)] px-4 py-2 text-[11px] leading-relaxed text-[var(--text-muted)]">
                    {{ t("markdownStudio.proseLint.readonlyHint") }}
                </footer>
            </aside>
        </Transition>
    </Teleport>
</template>

<style scoped>
.nb-prose-lint__select {
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-input);
    color: var(--text-main);
    padding: 2px 6px;
    font-size: 12px;
    cursor: pointer;
}

.nb-prose-lint-enter-active,
.nb-prose-lint-leave-active {
    transition: transform 0.18s ease, opacity 0.18s ease;
}

.nb-prose-lint-enter-from,
.nb-prose-lint-leave-to {
    transform: translateX(16px);
    opacity: 0;
}
</style>
