<script setup lang="ts">
/** 单D prefab · HistoryPanel：历史对话左栏形态（L-1：轻内容=左栏面板展开，不开工作区页，蓝图:81）。
 *  骨架件：契约与宪法合规基底就位；不接 store/API/运行时服务，数据为组件内占位样例（t() 取文案）。 */
export type HistoryPanelSession = {
    /** 稳定 key，供 v-for 复用 */
    id: string;
    /** 会话标题 */
    title: string;
    /** 最近一条预览文本 */
    preview: string;
    /** 最近更新时间戳（ms） */
    updatedAt: number;
};

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

const {t, locale} = useI18n();

/** 占位样例：标题/预览走 i18n 键（组件内不硬编码文案），时间用相对 now 推出。
 *  作为 sessions 的默认值工厂在 setup 期执行，t() 随语言生效。 */
function buildPlaceholderSessions(): HistoryPanelSession[] {
    const now = Date.now();
    return [
        {
            id: "placeholder-1",
            title: t("prefab.historyPanel.sampleTitle1"),
            preview: t("prefab.historyPanel.samplePreview1"),
            updatedAt: now - 2 * HOUR_MS,
        },
        {
            id: "placeholder-2",
            title: t("prefab.historyPanel.sampleTitle2"),
            preview: t("prefab.historyPanel.samplePreview2"),
            updatedAt: now - DAY_MS - 2 * HOUR_MS,
        },
        {
            id: "placeholder-3",
            title: t("prefab.historyPanel.sampleTitle3"),
            preview: t("prefab.historyPanel.samplePreview3"),
            updatedAt: now - 5 * DAY_MS,
        },
    ];
}

const props = withDefaults(
    defineProps<{
        /** 当前选中会话 id；null=无选中 */
        activeId?: string | null;
        /** 会话列表；缺省渲染组件内占位样例（接真机后由宿主传入） */
        sessions?: HistoryPanelSession[];
    }>(),
    {
        activeId: null,
        sessions: buildPlaceholderSessions,
    },
);

const emit = defineEmits<{
    /** 点选一条历史会话 */
    (e: "select", id: string): void;
    /** 点「新会话」 */
    (e: "new"): void;
}>();

/** 24h 内显时刻、更早显月日；跟随当前 locale，不硬编码时间文案。 */
function formatTime(ts: number): string {
    const date = new Date(ts);
    if (Date.now() - ts < DAY_MS) {
        return new Intl.DateTimeFormat(locale.value, {hour: "2-digit", minute: "2-digit"}).format(date);
    }
    return new Intl.DateTimeFormat(locale.value, {month: "numeric", day: "numeric"}).format(date);
}
</script>

<template>
    <!-- 历史对话左栏面板（L-1：轻内容=左栏展开）。组件宪法自查：
         C-1 本件无下拉（无原生 select）；C-2 「新会话」按钮带边框+底色，会话行整行可按+hover 灰底；
         C-3 选中=左 2px 均匀线（行恒有 2px 左线位，选中仅换线色与标题文字强调色，不改粗细）；
         C-4 本件无底部栏，不适用；C-5 本件无可展开过程行，不适用。
         全部颜色走主题变量（R4 无写死色值）。 -->
    <section class="flex h-full min-h-0 flex-col bg-[var(--bg-panel)]" :aria-label="t('prefab.historyPanel.title')">
        <header class="flex shrink-0 items-center justify-between gap-2 px-3 py-2">
            <h2 class="text-[12px] text-[var(--text-secondary)]">{{ t("prefab.historyPanel.title") }}</h2>
            <button
                type="button"
                class="inline-flex shrink-0 items-center gap-1 rounded-md border border-[var(--border-strong)] bg-[var(--bg-input)] px-2 py-1 text-[11px] text-[var(--text-main)] transition-colors hover:bg-[var(--bg-hover)]"
                @click="emit('new')"
            >
                <span class="i-lucide-plus h-3 w-3"></span>
                {{ t("prefab.historyPanel.newChat") }}
            </button>
        </header>
        <div class="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
            <p
                v-if="props.sessions.length === 0"
                class="px-2 py-6 text-center text-[12px] text-[var(--text-muted)]"
            >
                {{ t("prefab.historyPanel.empty") }}
            </p>
            <ul v-else class="flex flex-col gap-0.5">
                <li v-for="session in props.sessions" :key="session.id">
                    <button
                        type="button"
                        class="w-full rounded-md border-l-2 px-2.5 py-2 text-left transition-colors"
                        :class="session.id === props.activeId
                            ? 'border-[var(--accent-main)] bg-[var(--bg-hover)]'
                            : 'border-transparent hover:bg-[var(--bg-hover)]'"
                        @click="emit('select', session.id)"
                    >
                        <span
                            class="block truncate text-[13px]"
                            :class="session.id === props.activeId ? 'text-[var(--accent-text)]' : 'text-[var(--text-main)]'"
                        >{{ session.title }}</span>
                        <span class="mt-0.5 block truncate text-[11px] text-[var(--text-secondary)]">{{ session.preview }}</span>
                        <time
                            class="mt-0.5 block text-[10px] text-[var(--text-muted)]"
                            :datetime="new Date(session.updatedAt).toISOString()"
                        >{{ formatTime(session.updatedAt) }}</time>
                    </button>
                </li>
            </ul>
        </div>
    </section>
</template>
