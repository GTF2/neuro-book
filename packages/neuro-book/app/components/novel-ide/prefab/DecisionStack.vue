<script setup lang="ts">
/**
 * DecisionStack 待办堆叠卡（单D 蓝图 T-2/T-6 骨架）。
 * 处理舞台唯一：AI 面板输入框上方的内联堆叠卡（书堆视觉）；右划=通过、左划=拒绝，
 * 划掉消失后下一张浮上来；非模态、无遮罩、不居中弹窗（出现在居中弹窗/模态遮罩即打回）。
 * 骨架不接业务：不 import store/API/运行时服务；items 为空时用内置占位数据演示。
 * 快批路由（1-2 条聊天快批 / 3+ 去处）是 U4 未决项，归挂载侧，本件不发明。
 */

/** 单件待拍板事项；文案由挂载侧解析为可读字符串（本件纯渲染，聚合归挂载侧，参照 AgentSessionScaleBar 契约）。 */
interface DecisionStackItem {
    /** 稳定 id；approve/reject 原样回传，挂载侧据此定位并让驾驶舱计数减一。 */
    id: string;
    /** 人话意图行（T-6）：如「AI 想把巡山令牌写入设定档案」；首屏禁原始 JSON。 */
    intent: string;
    /** 影响说明（T-6）：如「影响：第 5 章会引用」；缺影响说明属打回项。 */
    impact: string;
    /** 原始数据文本（T-6）：仅在「展开原始数据」后内滚显示。 */
    raw?: string;
}

const props = withDefaults(defineProps<{
    /** 待拍板队列（T-2：点驾驶舱行 → 该类待办全部弹出）；空=用内置占位演示数据。 */
    items?: DecisionStackItem[];
    /** 回读验证回执文案（蓝图:66）：入档核对后由挂载侧喂入，非空即显回执条。 */
    receipt?: string | null;
}>(), {
    items: () => [],
    receipt: null,
});

const emit = defineEmits<{
    (e: "approve", id: string): void;
    (e: "reject", id: string, opts: {retry: boolean}): void;
    /** 队列清空（场景 5 极端态收尾）；挂载侧可据此收起堆叠卡。 */
    (e: "exhausted"): void;
}>();

const {t} = useI18n();

/** 释放判决策的位移阈值 / 飞出离场位移与时长（flyOut 与 leaving 共用同一值）。 */
const SWIPE_COMMIT_PX = 96;
const SWIPE_FLYOUT_PX = 520;
const FLYOUT_MS = 240;

/** 占位演示数据：文案一律走 i18n 键（本件不落任何硬编码文案）；真机接入后由挂载侧传 items 覆盖。 */
const placeholderItems = computed<DecisionStackItem[]>(() => [
    {
        id: "demo-approval",
        intent: t("decisionStack.demo.first.intent"),
        impact: t("decisionStack.demo.first.impact"),
        raw: "{\"kind\":\"memory\",\"key\":\"patrol_token\",\"referencedBy\":[5]}",
    },
    {
        id: "demo-foreshadow",
        intent: t("decisionStack.demo.second.intent"),
        impact: t("decisionStack.demo.second.impact"),
        raw: "{\"kind\":\"foreshadow\",\"plant\":\"ch2\",\"payoff\":\"ch9\"}",
    },
    {
        id: "demo-workflow",
        intent: t("decisionStack.demo.third.intent"),
        impact: t("decisionStack.demo.third.impact"),
        raw: "{\"kind\":\"workflow\",\"run\":\"book-pipeline\",\"stage\":\"polish\"}",
    },
]);

const resolvedItems = computed(() => props.items.length > 0 ? props.items : placeholderItems.value);

const queue = ref<DecisionStackItem[]>([]);
const dragging = ref(false);
const dragX = ref(0);
/** 拒绝二级路径（T-6「让 AI 重来」）展开态；切卡即收。 */
const rejectPanel = ref(false);
const rawExpanded = ref(false);
let startX = 0;

watch(resolvedItems, (next) => {
    queue.value = [...next];
    resetCardState();
}, {immediate: true});

const active = computed(() => queue.value[0] ?? null);
/** 书堆视觉层数：当前卡之外最多露两张卡缘。 */
const stackLayers = computed(() => Math.min(queue.value.length - 1, 2));

function resetCardState(): void {
    dragging.value = false;
    dragX.value = 0;
    rejectPanel.value = false;
    rawExpanded.value = false;
}

/** 统一收尾：弹掉队首、清态；清空后报 exhausted（场景 5：清空回空态）。 */
function advance(): void {
    queue.value = queue.value.slice(1);
    resetCardState();
    if (queue.value.length === 0) emit("exhausted");
}

/** 飞出动效：dir>0 右出=通过（划掉消失），dir<0 左出=拒绝。 */
function flyOut(dir: 1 | -1): void {
    dragging.value = false;
    dragX.value = dir * SWIPE_FLYOUT_PX;
    setTimeout(advance, FLYOUT_MS);
}

function acceptActive(): void {
    const item = active.value;
    if (!item || leaving()) return;
    emit("approve", item.id);
    flyOut(1);
}

function commitReject(retry: boolean): void {
    const item = active.value;
    if (!item || leaving()) return;
    emit("reject", item.id, {retry});
    flyOut(-1);
}

/** 飞出进行中拒绝重复决策（滑动与按钮双入口共用）。 */
function leaving(): boolean {
    return Math.abs(dragX.value) >= SWIPE_FLYOUT_PX;
}

// T-2 滑动决策：按住拖卡跟手，释放时越过阈值按方向判定，否则弹回。

function onCardPointerDown(e: PointerEvent): void {
    if (leaving() || e.button !== 0) return;
    dragging.value = true;
    startX = e.clientX;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
}

function onCardPointerMove(e: PointerEvent): void {
    if (!dragging.value) return;
    dragX.value = e.clientX - startX;
}

function onCardPointerUp(): void {
    if (!dragging.value) return;
    dragging.value = false;
    if (Math.abs(dragX.value) >= SWIPE_COMMIT_PX) {
        // 左划=仅拒绝；「让 AI 重来」走拒绝按钮的二级路径（T-6）。
        if (dragX.value > 0) acceptActive();
        else commitReject(false);
    } else {
        dragX.value = 0;
    }
}

function onCardPointerCancel(): void {
    dragging.value = false;
    dragX.value = 0;
}
</script>

<template>
    <!-- T-2：内联堆叠卡非模态（无遮罩、不居中弹窗），位置由挂载侧摆在 AI 面板输入框上方 -->
    <div class="relative w-full pb-2">
        <!-- 回读验证回执（蓝图:66）：入档核对后显示，治「批完黑箱」 -->
        <div v-if="props.receipt" class="mb-2 flex items-center gap-1.5 rounded-md border border-[var(--status-success-border)] bg-[var(--status-success-bg)] px-2.5 py-1.5 text-xs">
            <span class="i-lucide-badge-check h-3.5 w-3.5 shrink-0 text-[var(--status-success)]"></span>
            <span class="shrink-0 font-medium text-[var(--status-success)]">{{ t("decisionStack.receiptTag") }}</span>
            <span class="min-w-0 truncate text-[var(--text-secondary)]">{{ props.receipt }}</span>
        </div>

        <!-- 空态：队列清空后呈现；挂载侧可据 exhausted 收起本卡 -->
        <div v-if="queue.length === 0" class="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-[var(--border-color)] bg-[var(--bg-subtle)] px-4 py-5 text-sm text-[var(--text-muted)]">
            <span class="i-lucide-check-check h-4 w-4 shrink-0"></span>
            <span>{{ t("decisionStack.empty") }}</span>
        </div>

        <div v-else class="relative">
            <!-- 书堆视觉：当前卡底下最多露两张卡缘，不响应事件 -->
            <div v-for="layer in stackLayers" :key="layer" aria-hidden="true" class="pointer-events-none absolute inset-x-0 h-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-subtle)]" :class="layer === 1 ? 'top-1.5 scale-[0.985] opacity-70' : 'top-3 scale-[0.97] opacity-45'"></div>

            <Transition name="stack-rise" mode="out-in">
                <div :key="active?.id" class="stack-drag relative z-10 select-none touch-none rounded-xl border border-[var(--border-color)] bg-[var(--bg-panel)] p-4 shadow-[0_4px_12px_color-mix(in_srgb,var(--shadow-color)_12%,transparent)]" :class="{'stack-drag--dragging': dragging}" :style="{'--drag-x': `${dragX}px`}" @pointerdown="onCardPointerDown" @pointermove="onCardPointerMove" @pointerup="onCardPointerUp" @pointercancel="onCardPointerCancel">
                    <!-- T-6 人话规格：先说意图与影响，首屏禁原始 JSON -->
                    <div class="flex items-start gap-2">
                        <span class="i-lucide-stamp mt-0.5 h-4 w-4 shrink-0 text-[var(--accent-text)]"></span>
                        <div class="min-w-0">
                            <p class="text-sm font-medium leading-5 text-[var(--text-main)]">{{ active?.intent }}</p>
                            <p class="mt-1 text-xs leading-4 text-[var(--text-secondary)]">{{ active?.impact }}</p>
                        </div>
                    </div>

                    <!-- 原始数据默认收起；展开体走 C-5：左缩进 12px + 左竖线、无卡片框，内滚（场景 5 极端态） -->
                    <div class="mt-2.5">
                        <button type="button" class="inline-flex items-center gap-1 rounded-md border border-[var(--border-color)] bg-[var(--bg-input)] px-2 py-1 text-xs text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-main)]" @click="rawExpanded = !rawExpanded">
                            <span class="h-3 w-3" :class="rawExpanded ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"></span>
                            <span>{{ rawExpanded ? t("decisionStack.collapseRaw") : t("decisionStack.expandRaw") }}</span>
                        </button>
                        <div v-if="rawExpanded" class="ml-3 mt-1.5 border-l-2 border-[var(--border-color)] pl-3">
                            <pre class="max-h-40 overflow-y-auto whitespace-pre-wrap break-all font-mono text-xs leading-4 text-[var(--text-muted)]">{{ active?.raw ?? "" }}</pre>
                        </div>
                    </div>

                    <!-- 操作条（C-2：可按操作一律带容器；hover 灰底块提示可按性） -->
                    <div v-if="!rejectPanel" class="mt-3 flex items-center gap-2">
                        <button type="button" class="inline-flex items-center gap-1 rounded-md border border-[var(--status-success-border)] bg-[var(--status-success-bg)] px-2.5 py-1 text-xs font-medium text-[var(--status-success)] transition-colors hover:bg-[var(--bg-hover)]" @click="acceptActive()">
                            <span class="i-lucide-check h-3.5 w-3.5"></span>
                            <span>{{ t("decisionStack.accept") }}</span>
                        </button>
                        <button type="button" class="inline-flex items-center gap-1 rounded-md border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-2.5 py-1 text-xs font-medium text-[var(--status-danger)] transition-colors hover:bg-[var(--bg-hover)]" @click="rejectPanel = true">
                            <span class="i-lucide-x h-3.5 w-3.5"></span>
                            <span>{{ t("decisionStack.reject") }}</span>
                        </button>
                        <span class="ml-auto inline-flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
                            <span class="i-lucide-move-horizontal h-3 w-3"></span>
                            <span>{{ t("decisionStack.swipeHint") }}</span>
                        </span>
                    </div>
                    <!-- 拒绝二级路径（T-6）：让 AI 重来 / 仅拒绝 -->
                    <div v-else class="mt-3 flex items-center gap-2">
                        <span class="text-xs text-[var(--text-secondary)]">{{ t("decisionStack.rejectAsk") }}</span>
                        <button type="button" class="inline-flex items-center gap-1 rounded-md border border-[var(--border-accent)] bg-[var(--accent-bg)] px-2.5 py-1 text-xs font-medium text-[var(--accent-text)] transition-colors hover:bg-[var(--bg-hover)]" @click="commitReject(true)">
                            <span class="i-lucide-refresh-ccw h-3.5 w-3.5"></span>
                            <span>{{ t("decisionStack.retry") }}</span>
                        </button>
                        <button type="button" class="inline-flex items-center gap-1 rounded-md border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-2.5 py-1 text-xs font-medium text-[var(--status-danger)] transition-colors hover:bg-[var(--bg-hover)]" @click="commitReject(false)">
                            <span class="i-lucide-x h-3.5 w-3.5"></span>
                            <span>{{ t("decisionStack.rejectOnly") }}</span>
                        </button>
                        <button type="button" class="inline-flex items-center gap-1 rounded-md border border-[var(--border-color)] px-2.5 py-1 text-xs text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-main)]" @click="rejectPanel = false">
                            <span class="i-lucide-undo-2 h-3.5 w-3.5"></span>
                            <span>{{ t("decisionStack.cancel") }}</span>
                        </button>
                    </div>
                </div>
            </Transition>
        </div>
    </div>
</template>

<style scoped>
/* T-2 滑动决策：拖拽中跟手无过渡；释放后弹回/飞出走过渡 */
.stack-drag {
    transform: translateX(var(--drag-x, 0px));
    transition: transform 200ms ease, opacity 150ms ease;
}
.stack-drag--dragging {
    transition: none;
}

/* 下一张浮上来（T-2 验收：处理后下一张未浮上即打回）；后写覆盖 .stack-drag 的 transform 起点 */
.stack-rise-enter-active {
    transition: opacity 200ms ease-out, transform 200ms ease-out;
}
.stack-rise-enter-from {
    opacity: 0;
    transform: translateY(12px) scale(0.98);
}
.stack-rise-leave-active {
    transition: opacity 120ms ease;
}
.stack-rise-leave-to {
    opacity: 0;
}
</style>
