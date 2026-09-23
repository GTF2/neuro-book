<script setup lang="ts">
/**
 * WorkspaceStage 工作区态容器（单D prefab 骨架；规格=总集 2.4 L-1…L-4、蓝图:81）。
 *
 * 主界面状态位恰三个：常态/审稿态/工作区态（B5）。本容器只承载工作区态：
 * 挂载即进入工作区态，emit('close')=一键返回常态（逃生口恒在，错误态也不消失）。
 * 重内容（剧情大纲/角色档案/世界书/世界引擎/设置）只能在此开页；弹窗/抽屉承载重内容即打回（L-2/L-3）。
 * 骨架不接 store/API/运行时服务，数据为组件内占位常量。
 */

export type WorkspaceStagePageId = "plot-outline" | "characters" | "worldbook" | "world-engine" | "settings";

type WorkspaceStagePage = {
    id: WorkspaceStagePageId;
    /** 页名 i18n 键（文案统一落 locales，组件内禁硬编码中文） */
    labelKey: string;
};

/** L-1 反向约束：只允许重内容页登记于此；历史对话/收件箱/待拍板队列走左栏面板，禁入本容器。 */
const WORKSPACE_STAGE_PAGES: WorkspaceStagePage[] = [
    { id: "plot-outline", labelKey: "ide.workspaceStage.page.plotOutline" },
    { id: "characters", labelKey: "ide.workspaceStage.page.characters" },
    { id: "worldbook", labelKey: "ide.workspaceStage.page.worldbook" },
    { id: "world-engine", labelKey: "ide.workspaceStage.page.worldEngine" },
    { id: "settings", labelKey: "ide.workspaceStage.page.settings" },
];

const props = withDefaults(
    defineProps<{
        /** 当前打开的重内容页 */
        page?: WorkspaceStagePageId;
        /** 内容区错误文案；非空时正文转错误面板，「返回常态」仍可点（工作区态同审稿态，永不困死用户） */
        error?: string | null;
    }>(),
    {
        page: "plot-outline",
        error: null,
    },
);

const emit = defineEmits<{
    (e: "close"): void;
    (e: "navigate", page: WorkspaceStagePageId): void;
}>();

const {t} = useI18n();

const activePage = computed(() => {
    const matched = WORKSPACE_STAGE_PAGES.find((item) => item.id === props.page);
    return matched ?? WORKSPACE_STAGE_PAGES[0]!;
});
</script>

<template>
    <!-- 场景 7 几何（本栏 minmax(680px,2.3fr) 接管、AI 收 0.66fr、左栏收 200px）属父级 grid 轨道，本组件只占满父级分配区域 -->
    <section class="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden border-l border-[var(--border-color)] bg-[var(--bg-panel)]">
        <header class="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-[var(--border-color)] px-3">
            <h2 class="min-w-0 truncate text-sm font-medium text-[var(--text-main)]">{{ t(activePage.labelKey) }}</h2>
            <!-- C-2 可按带容器：边框+底色按钮，禁下划线/纯文字操作态 -->
            <button
                type="button"
                class="flex h-7 shrink-0 items-center rounded-md border border-[var(--border-color)] bg-[var(--bg-input)] px-2.5 text-xs text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-main)]"
                @click="emit('close')"
            >
                {{ t("ide.workspaceStage.backToNormal") }}
            </button>
        </header>
        <div class="flex min-h-0 flex-1">
            <!-- L-4 VS Code 式左分区导航：非模态、无保存按钮；选中态走 C-3 左 2px 均匀线+文字强调色，不靠粗细 -->
            <nav class="flex w-40 shrink-0 flex-col gap-0.5 border-r border-[var(--border-color)] p-2" :aria-label="t('ide.workspaceStage.navLabel')">
                <button
                    v-for="stagePage in WORKSPACE_STAGE_PAGES"
                    :key="stagePage.id"
                    type="button"
                    class="border-l-2 px-2 py-1.5 text-left text-xs transition-colors"
                    :class="stagePage.id === props.page
                        ? 'border-[var(--accent-main)] text-[var(--accent-text)]'
                        : 'border-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-main)]'"
                    :aria-current="stagePage.id === props.page ? 'page' : undefined"
                    @click="emit('navigate', stagePage.id)"
                >
                    {{ t(stagePage.labelKey) }}
                </button>
            </nav>
            <div class="min-h-0 min-w-0 flex-1 overflow-y-auto p-4">
                <div v-if="props.error" class="rounded-md border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] p-3 text-xs text-[var(--status-danger)]">
                    {{ props.error }}
                </div>
                <!-- 占位正文：真机由各重内容页组件经默认插槽接管 -->
                <slot>
                    <div class="rounded-md border border-[var(--border-color)] bg-[var(--bg-input)] p-3 text-xs text-[var(--text-muted)]">
                        {{ t("ide.workspaceStage.placeholderBody") }}
                    </div>
                </slot>
            </div>
        </div>
    </section>
</template>
