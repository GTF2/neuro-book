<script setup lang="ts">
/**
 * 收件箱左栏面板（单D prefab 骨架）。
 * 规格：轻内容=左栏面板展开呈现，不开工作区页（总集 L-1／蓝图:81）；
 * 空态文案「没有等你拍板的事」，徽标计数与驾驶舱待拍板行同源同数（总集③场景 5 空态）。
 * 骨架阶段不接 store/API：items 由挂载侧传入，未传时渲染组件内占位常量；
 * ⚠ U4 未决（3+ 条待办去处=收件箱还是堆叠模式，总集⑦）：点行后的去向由宿主决策，本件只发 open，不就地发明路由。
 */
export type InboxPanelItem = {
    /** 稳定 key，供 v-for 复用 */
    id: string;
    /** 人话标题：先说意图（T-6 审批人话卡语言：先意图后影响） */
    title: string;
    /** 影响说明（T-6：卡首屏无影响说明即打回） */
    detail: string;
};

const {t} = useI18n();

/** 占位待拍板项（骨架形态演示；接真机数据后整段删除）。文案一律走 i18n，不硬编码。 */
function makeDemoItems(): InboxPanelItem[] {
    return [
        {id: "demo-approval-1", title: t("prefab.inbox.demoTitle1"), detail: t("prefab.inbox.demoDetail1")},
        {id: "demo-approval-2", title: t("prefab.inbox.demoTitle2"), detail: t("prefab.inbox.demoDetail2")},
        {id: "demo-foreshadow-1", title: t("prefab.inbox.demoTitle3"), detail: t("prefab.inbox.demoDetail3")},
    ];
}

const props = withDefaults(defineProps<{
    /** 待拍板项；数据源与驾驶舱待拍板行同源（场景 5 判据：徽标与驾驶舱行双双归零）。传 [] 即空态。 */
    items?: InboxPanelItem[];
    /** 当前选中项 id；选中态=左 2px 均匀线+文字强调色（宪法 C-3），不靠粗细变化。 */
    activeItemId?: string | null;
}>(), {
    items: () => makeDemoItems(),
    activeItemId: null,
});

const emit = defineEmits<{
    /** 点某条待办行；去向（就地处理/引导进堆叠模式）待 U4 定稿，由宿主接线。 */
    (e: "open", itemId: string): void;
    /** 收起面板（轻内容回到左栏收拢形态，本件不自行卸载）。 */
    (e: "close"): void;
}>();
</script>

<template>
    <section
        class="flex min-h-0 flex-col rounded-md border border-[var(--border-color)] bg-[var(--bg-panel)]"
        :aria-label="t('prefab.inbox.title')">
        <header class="flex shrink-0 items-center gap-2 border-b border-[var(--border-color)] px-3 py-2">
            <span class="i-lucide-inbox h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]"></span>
            <h3 class="text-xs font-medium text-[var(--text-secondary)]">{{ t("prefab.inbox.title") }}</h3>
            <span
                v-if="items.length > 0"
                class="rounded-full bg-[var(--bg-input)] px-1.5 text-[10px] leading-4 text-[var(--text-secondary)]">{{ items.length }}</span>
            <button
                type="button"
                class="ml-auto flex h-5 w-5 cursor-pointer items-center justify-center rounded-md text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-main)]"
                :aria-label="t('prefab.inbox.collapse')"
                @click="emit('close')">
                <span class="i-lucide-x h-3 w-3"></span>
            </button>
        </header>
        <p
            v-if="items.length === 0"
            class="flex flex-1 flex-col items-center justify-center gap-1.5 px-3 py-6 text-center text-xs text-[var(--text-muted)]">
            <span class="i-lucide-inbox h-5 w-5 opacity-70"></span>
            <span>{{ t("prefab.inbox.empty") }}</span>
        </p>
        <ul v-else class="custom-scrollbar min-h-0 flex-1 overflow-y-auto py-1">
            <li v-for="item in items" :key="item.id">
                <button
                    type="button"
                    class="block w-full cursor-pointer border-l-2 px-3 py-1.5 text-left transition-colors hover:bg-[var(--bg-hover)]"
                    :class="item.id === activeItemId ? 'border-[var(--accent-main)]' : 'border-transparent'"
                    @click="emit('open', item.id)">
                    <span
                        class="block text-xs leading-5"
                        :class="item.id === activeItemId ? 'text-[var(--accent-main)]' : 'text-[var(--text-main)]'">{{ item.title }}</span>
                    <span class="block text-[11px] leading-4 text-[var(--text-secondary)]">{{ item.detail }}</span>
                </button>
            </li>
        </ul>
    </section>
</template>
