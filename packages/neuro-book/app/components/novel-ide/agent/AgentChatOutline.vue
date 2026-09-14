<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import type { ChatOutlineItem, ChatOutlineStatus } from "nbook/app/components/novel-ide/agent/chat-outline";
import {
    resolveOutlineLensTop,
    resolveOutlineRailPadTop,
    resolveOutlineScrubRatio,
    resolveOutlineWaveBoost,
} from "nbook/app/components/novel-ide/agent/chat-outline";
import { CHAT_WORK_BLOCK_META } from "nbook/app/components/novel-ide/agent/chat-work-blocks";

const props = defineProps<{
    items: ChatOutlineItem[];
    /** 当前高亮行的锚点 id；空串表示还没定位。 */
    activeAnchorId: string;
    /** 没有可定位内容时整体隐藏，连指示条也不占位。 */
    hidden?: boolean;
}>();

const emit = defineEmits<{
    (e: "jump", anchorId: string): void;
    /** 拖动刻度列：0 是对话开头，1 是结尾。 */
    (e: "scrub", ratio: number): void;
    /** 这一列自己没得滚时，把滚轮交给对话区。 */
    (e: "scrollBy", deltaY: number): void;
}>();

const { t } = useI18n();

/** 放大镜窗口的固定高度：刚好放三行摘要。高度恒定，跟手滑动时才不会上下抖。 */
const LENS_HEIGHT = 66;

/**
 * 每条刻度的固定高度。
 *
 * 刻意写成常量而不是「容器高度 ÷ 条数」：那个算法要依赖容器高度，
 * 量到的值一变、刻度就跟着抽动（一会儿挤成一坨、一会儿又填满整列）。
 * 现在间距恒定 —— 装得下就居中显示，装不下这一列自己滚，行为完全可预期。
 */
const RAIL_STEP = 16;

/** 鼠标当前压在指示条的第几条上；-1 表示不在指示条上。 */
const hoveredIndex = ref(-1);

/** 放大镜窗口相对指示条顶部的偏移，随鼠标上下滑动。 */
const lensTop = ref(0);

const railRef = ref<HTMLElement | null>(null);

/** 放大镜浮在整列上（不是框里），所以它的纵向定位要用整列的坐标系。 */
const asideRef = ref<HTMLElement | null>(null);

/** 刻度列显示全部锚点：不抽样，装不下就让这一列自己滚。 */
const railItems = computed(() => props.items);

/** 放大镜当前指向的条目；为空表示不该显示窗口。 */
const hoveredItem = computed<ChatOutlineItem | null>(() => railItems.value[hoveredIndex.value] ?? null);

const STATUS_TONE: Record<ChatOutlineStatus, string> = {
    success: "text-[var(--status-success)]",
    failed: "text-[var(--status-danger)]",
    running: "text-[var(--status-info)]",
};

/** 行首图标：提问、回答、操作各一类；操作行用状态色，省掉一行额外的状态标记。 */
const rowIcon = (item: ChatOutlineItem): string => {
    if (item.kind === "prompt") {
        return "i-lucide-message-square";
    }
    if (item.kind === "answer") {
        return "i-lucide-bot";
    }
    return CHAT_WORK_BLOCK_META[item.blockKind].icon;
};

const iconTone = (item: ChatOutlineItem): string => {
    if (item.kind === "prompt") {
        return "text-[var(--accent-main)]";
    }
    if (item.kind === "answer") {
        return item.running ? "text-[var(--status-info)]" : "text-[var(--text-muted)]";
    }
    return STATUS_TONE[item.status];
};

/** 行内文案：提问与回答取摘要，操作按工具元数据拼类别与计数。 */
const rowLabel = (item: ChatOutlineItem): string => {
    if (item.kind === "prompt") {
        return item.preview || t("agent.outline.emptyPrompt");
    }
    if (item.kind === "answer") {
        return item.preview || t("agent.outline.emptyAnswer");
    }
    const parts = [t(CHAT_WORK_BLOCK_META[item.blockKind].labelKey)];
    // 单步操作由类别本身就说清了「做了什么」，再报数量只会读出「编辑 · 1 个文件」这种废话。
    // 多步时才值得补一句规模：文件超过一个就报文件数，否则报步数
    // （同一个文件被连续改多次时文件数恒为 1，报步数才有信息量）。
    if (item.count > 1) {
        parts.push(item.fileCount > 1
            ? t("agent.workBlock.fileCount", {count: item.fileCount})
            : t("agent.workBlock.stepCount", {count: item.count}));
    }
    if (item.failedCount > 0) {
        parts.push(t("agent.workBlock.failedCount", {count: item.failedCount}));
    }
    return parts.join(" · ");
};

/** 放大镜窗口要显示的文案：条目的行内文案，提问与回答即正文摘要。 */
const lensLabel = computed(() => (hoveredItem.value ? rowLabel(hoveredItem.value) : ""));

/** 放大镜的第二行：操作类条目才有，说明这一步动了哪个文件、跑了什么命令。 */
const lensDetail = computed(() => (hoveredItem.value?.kind === "block" ? hoveredItem.value.detail : ""));

/** 放大镜窗口里的状态图标：与指示条同一套类型/状态配色，运行中额外转圈。 */
const lensIconClass = computed(() => {
    const item = hoveredItem.value;
    if (!item) {
        return "";
    }
    return [
        rowIcon(item),
        iconTone(item),
        item.kind === "answer" && item.running ? "animate-spin" : "",
    ].join(" ");
});

/** 正在按住刻度列拖动：拖动期间不显示放大镜，整列只负责按比例滚对话。 */
const dragging = ref(false);
let dragPointerId: number | null = null;
let dragStartY = 0;
/** 刚拖过就吃掉紧随其后的 click，免得拖完又跳一次。 */
let suppressClick = false;

const handleRailPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) {
        return;
    }
    dragPointerId = event.pointerId;
    dragStartY = event.clientY;
    suppressClick = false;
};

/**
 * 拖动期间在 window 上跟随，而不是用 setPointerCapture。
 * 捕获会把随后的 click 也改派到这一列上，按钮的「点一下跳过去」就失灵了。
 */
const handleWindowPointerMove = (event: PointerEvent): void => {
    if (dragPointerId !== event.pointerId) {
        return;
    }
    // 先留几像素容差，否则「点一下跳过去」会被误判成拖动。
    if (!dragging.value) {
        if (Math.abs(event.clientY - dragStartY) < 3) {
            return;
        }
        dragging.value = true;
        hoveredIndex.value = -1;
    }
    const rect = railRef.value?.getBoundingClientRect();
    if (!rect) {
        return;
    }
    emit("scrub", resolveOutlineScrubRatio(event.clientY, rect.top, rect.height));
};

const handleWindowPointerUp = (event: PointerEvent): void => {
    if (dragPointerId !== event.pointerId) {
        return;
    }
    dragPointerId = null;
    suppressClick = dragging.value;
    dragging.value = false;
};

onMounted(() => {
    window.addEventListener("pointermove", handleWindowPointerMove);
    window.addEventListener("pointerup", handleWindowPointerUp);
    window.addEventListener("pointercancel", handleWindowPointerUp);
});

onBeforeUnmount(() => {
    window.removeEventListener("pointermove", handleWindowPointerMove);
    window.removeEventListener("pointerup", handleWindowPointerUp);
    window.removeEventListener("pointercancel", handleWindowPointerUp);
});

/** 点一下跳到那一条；刚拖过的那次不算点击。 */
const handleBarClick = (anchorId: string): void => {
    if (suppressClick) {
        suppressClick = false;
        return;
    }
    emit("jump", anchorId);
};

/** 鼠标最后落在这一列的哪个高度：滚动时鼠标没动，得靠它重算指向哪一条。 */
let lastPointerY = 0;

/**
 * 按鼠标纵向位置反推指向的条目。
 *
 * 按「第几格」算而不是逐条挂监听：一屏四十多条时，逐条监听既慢、格子之间也容易漏。
 * 留白按实际高度实时算（渲染侧交给 CSS 居中），再叠加这一列自己的滚动量。
 */
const pointAt = (clientY: number): void => {
    const rail = railRef.value;
    if (!rail) {
        return;
    }
    const rect = rail.getBoundingClientRect();
    // 容器高度只在这里实时读一次、不缓存：留白算法与 CSS 的居中保持一致。
    const padTop = resolveOutlineRailPadTop(rect.height, railItems.value.length, RAIL_STEP);
    const index = Math.floor((clientY - rect.top + rail.scrollTop - padTop) / RAIL_STEP);
    if (index < 0 || index >= railItems.value.length) {
        hoveredIndex.value = -1;
        return;
    }
    hoveredIndex.value = index;
    // 放大镜的意义就是「跟着手走」：纵向跟手，但不许越出整列范围。
    // 基准必须是整列（放大镜的定位父级），不是带留白的框，否则上下会差出 1/6 的高度。
    const aside = asideRef.value?.getBoundingClientRect();
    if (aside) {
        lensTop.value = resolveOutlineLensTop(clientY - aside.top, aside.height, LENS_HEIGHT);
    }
};

const handleRailMove = (event: MouseEvent): void => {
    if (dragging.value) {
        return;
    }
    lastPointerY = event.clientY;
    pointAt(event.clientY);
};

/**
 * 这一列自己滚了：鼠标没动，但它现在指向的条目变了。
 * 不同步刷新的话，放大镜和高亮会停在上一次的位置。
 */
const handleRailScroll = (): void => {
    if (lastPointerY > 0) {
        pointAt(lastPointerY);
    }
};

/**
 * 滚轮落在刻度列上。
 *
 * 装不下时滚的是这一列自己（原生 overflow）；装得下时它没有可滚内容，
 * 必须把滚轮转给对话区——否则鼠标停在面板右边就滚不动对话了。
 */
const handleRailWheel = (event: WheelEvent): void => {
    const rail = railRef.value;
    if (!rail || rail.scrollHeight > rail.clientHeight + 1) {
        return;
    }
    event.preventDefault();
    emit("scrollBy", event.deltaY);
};

const isActive = (item: ChatOutlineItem): boolean => item.anchorId === props.activeAnchorId;

/**
 * 刻度颜色：一眼分得出「我说的话、它的回答、出问题的地方」。
 *
 * 我的提问用绿色，回答用灰色，出错用红色；蓝色只留给鼠标所指（鼠标离开后回到当前阅读位置），
 * 所以三类颜色不会被「当前项」的蓝色盖掉太多。
 */
const indicatorClass = (item: ChatOutlineItem, index: number): string => {
    if (index === hoveredIndex.value || (hoveredIndex.value < 0 && isActive(item))) {
        return "bg-[var(--accent-main)]";
    }
    if (item.kind === "block" && item.status === "failed") {
        return "bg-[var(--status-danger)]";
    }
    if (item.kind === "prompt") {
        return "bg-[var(--status-success)]";
    }
    return "bg-[var(--text-muted)]";
};

/**
 * 刻度线的最长像素值。
 *
 * 必须比「基准 + 最大波浪」略大，否则选中那条会被削平到和相邻几条一样长 ——
 * 之前卡在 14px，看起来就是「选中了也没变长」。
 * 框宽是这一列的 2/3（36px → 24px），留 2px 余量。
 */
const BAR_MAX_WIDTH = 22;

/** 按类型的基准长度：差异刻意做小，免得出现「某一条特别凸出」。 */
const baseBarWidth = (item: ChatOutlineItem): number => {
    if (item.kind === "block" && item.status === "failed") {
        return 9;
    }
    if (item.kind === "prompt") {
        return 8;
    }
    return 7;
};

/** 一条刻度的实际长度：基准 + 波浪加成；鼠标不在刻度上时，当前阅读位置加一点点。 */
const barWidth = (item: ChatOutlineItem, index: number): number => Math.min(
    BAR_MAX_WIDTH,
    baseBarWidth(item)
        + resolveOutlineWaveBoost(index, hoveredIndex.value)
        + (hoveredIndex.value < 0 && isActive(item) ? 3 : 0),
);
</script>

<template>
    <!-- 入场从右侧滑进来：它贴右边缘浮着，从上往下展开不符合这个位置的观感。 -->
    <Transition
        appear
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="translate-x-2 opacity-0"
        leave-active-class="transition duration-150 ease-in"
        leave-to-class="translate-x-1 opacity-0"
    >
        <!--
            绝对定位由调用方那个 relative 容器兜住：这一列要浮在对话区的滚动条左侧
            （见 AgentChatSurface.vue），否则滚动条会被夹在正文和刻度中间。
            右移 6px 正好让开滚动条；正文侧的留白交给对话区自己的 padding-right。

            浮起来就必须自带底色：它压在正文之上，不铺底的话下面的字会从刻度缝里透出来。
        -->
        <aside
            v-if="!props.hidden && railItems.length > 0"
            ref="asideRef"
            class="absolute bottom-0 right-1.5 top-0 z-20 flex items-stretch border-l border-[var(--border-color)] bg-[var(--bg-panel)]"
        >
        <!--
            放大镜：鼠标压在哪条横线上，就在旁边浮出那一条的两三行摘要。
            窗口高度固定、位置跟着鼠标上下滑动，沿指示条扫过去时它是连贯的一扇窗，
            而不是东一处西一处地冒出来。
        -->
        <transition
            enter-active-class="transition duration-100 ease-out"
            enter-from-class="opacity-0"
            leave-active-class="transition duration-75 ease-in"
            leave-to-class="opacity-0"
        >
            <div
                v-if="hoveredItem"
                data-outline-lens
                class="pointer-events-none absolute right-full z-30 mr-2 flex w-[260px] items-start gap-2 overflow-hidden rounded-lg border border-[var(--border-color)] bg-[var(--bg-panel)] px-2.5 py-2 shadow-xl"
                :style="{top: `${lensTop}px`, height: `${LENS_HEIGHT}px`}"
            >
                <span :class="lensIconClass" class="mt-[3px] h-3.5 w-3.5 shrink-0"></span>
                <div class="min-w-0 flex-1">
                    <p
                        class="text-[11.5px] leading-4 text-[var(--text-secondary)]"
                        :class="lensDetail ? 'line-clamp-1' : 'line-clamp-3'"
                    >{{ lensLabel }}</p>
                    <p v-if="lensDetail" class="mt-0.5 line-clamp-2 text-[11.5px] leading-4 text-[var(--text-muted)]">{{ lensDetail }}</p>
                </div>
            </div>
        </transition>

        <!--
            刻度列：本身只负责把中间那个「框」摆正，不参与排刻度。
            宽度 36px 而不是更窄：框取 2/3 后还有 24px，才容得下选中那条的波浪长度。
        -->
        <div
            data-outline-rail
            class="flex w-9 shrink-0 justify-center"
        >
            <!--
                刻度框：横向纵向都只占这一列的 2/3，居中摆放。

                刻意不铺满整列 —— 铺满的观感是「刻度会一直长下去、没有尽头」；
                上下各留出 1/6 的空白，一眼就知道刻度区到哪儿为止。
                装不下时就在这个框里翻，而不是让整列继续变长。
                框本身不显示滚动条：右边已经有一根真正的滚动条，多一根只会让人分不清滚的是哪个。
            -->
            <div
                ref="railRef"
                class="rail-scroll my-auto flex h-2/3 w-2/3 flex-col items-center overflow-x-hidden overflow-y-auto opacity-65 transition-opacity duration-300 ease-out hover:opacity-100"
                @mousemove="handleRailMove"
                @mouseleave="hoveredIndex = -1"
                @pointerdown="handleRailPointerDown"
                @scroll="handleRailScroll"
                @wheel="handleRailWheel"
            >
                <button
                    v-for="(item, index) in railItems"
                    :key="item.anchorId"
                    type="button"
                    tabindex="-1"
                    :aria-label="rowLabel(item)"
                    class="flex w-full shrink-0 cursor-pointer items-center justify-center"
                    :style="{height: `${RAIL_STEP}px`}"
                    @click="handleBarClick(item.anchorId)"
                >
                    <span
                        class="h-[3px] rounded-full transition-all duration-200 ease-out"
                        :class="indicatorClass(item, index)"
                        :style="{width: `${barWidth(item, index)}px`}"
                    ></span>
                </button>
            </div>
        </div>
        </aside>
    </Transition>
</template>

<style scoped>
/*
 * 刻度条自己也能滚（条目极多、挤到下限仍装不下时用滚轮翻），
 * 但不显示滚动条：右边已经有一根真正的滚动条，多一根只会让人分不清滚的是哪个。
 */
.rail-scroll {
    scrollbar-width: none;
    -ms-overflow-style: none;
}

.rail-scroll::-webkit-scrollbar {
    display: none;
    width: 0;
    height: 0;
}

/*
 * flex 居中的经典坑：内容溢出时顶部会被裁掉、而且滚不回去。
 * 用两个 auto margin 的伪元素代替 justify-center：装得下就在框里居中，装不下自然从顶部排。
 */
.rail-scroll::before,
.rail-scroll::after {
    content: "";
    margin: auto;
}
</style>
