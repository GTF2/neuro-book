<script setup lang="ts">
export type AgentSessionScaleSegment = {
    /** 稳定 key，供 v-for 复用 */
    id: string;
    /** 该格覆盖范围的摘要文本，hover 预览卡显示 */
    summary: string;
    /** 该格锚定的 flowItem 序号，seek 直接定位 */
    anchorIndex: number;
    /** 体量权重（轮内节点数），驱动格高波浪与颜色深浅 */
    weight?: number;
};

const props = defineProps<{
    /** 挂载侧聚合后的格序列（规格封顶 50，聚合归挂载侧，本件只渲染收到的 segments） */
    segments: AgentSessionScaleSegment[];
    /** 当前锚点序号；命中「anchorIndex ≤ activeIndex 的最后一格」高亮 */
    activeIndex: number;
}>();

const emit = defineEmits<{
    (e: "seek", index: number): void;
    (e: "expand"): void;
}>();

const {t} = useI18n();

const trackRef = ref<HTMLElement | null>(null);
const hoverIndex = ref<number | null>(null);
/** R4 件3②：hover 预览卡 fixed 贴鼠标跟随（clientX/Y），近屏幕边缘自动翻面。 */
const hoverX = ref(0);
const hoverY = ref(0);
// 拖动时的 seek 节流间隔；点击路径不节流
const SEEK_THROTTLE_MS = 80;
let lastSeekAt = 0;

/** 当前应高亮的格下标：anchorIndex ≤ activeIndex 的最后一格；都大于则无高亮。 */
const activeGridIndex = computed(() => {
    let matched = -1;
    for (let index = 0; index < props.segments.length; index += 1) {
        if (props.segments[index] !== undefined && props.segments[index]!.anchorIndex <= props.activeIndex) {
            matched = index;
        }
    }
    return matched;
});

/** R5c（用户再澄清）：正常态所有条等宽；同一时刻只有一个满宽长条——hover 时
 *  跟着鼠标走（邻格按距离波浪衰减），移出后回到选中格；不并排渲染
 *  "灰色 hover 条+蓝色选中条"两条。 */
const BASE_RATIO = 0.55;
const ACTIVE_RATIO = 1;
const HOVER_WAVE_RADIUS = 4;
const BAR_HEIGHT_PX = 3;
/** 满宽条位置：hover 优先（跟鼠标跑），否则选中格；两者皆无则全基线。 */
const focusIndex = computed<number | null>(() => {
    if (hoverIndex.value !== null) {
        return hoverIndex.value;
    }
    return activeGridIndex.value >= 0 ? activeGridIndex.value : null;
});
const segmentBarRatio = (index: number): number => {
    const focus = focusIndex.value;
    if (focus === null) {
        return BASE_RATIO;
    }
    if (index === focus) {
        return ACTIVE_RATIO;
    }
    // R5c 无头断言逮住：静态（无 hover）时不得渲染选中格的衰减尾迹——正常态全等宽，
    // 波浪只在鼠标划过时出现（R5b 用户原话）。
    if (hoverIndex.value === null) {
        return BASE_RATIO;
    }
    const distance = Math.abs(index - focus);
    const falloff = Math.max(0, 1 - distance / HOVER_WAVE_RADIUS);
    return BASE_RATIO + (ACTIVE_RATIO - BASE_RATIO) * falloff;
};
/** 亮度同步波浪：focus 满亮、波浪内按衰减提亮、静态条基线。 */
const segmentBarOpacity = (index: number): number => {
    if (index === focusIndex.value) {
        return 1;
    }
    return 0.5 + 0.45 * segmentBarRatio(index);
};
/** 颜色只有两档：focus=accent、其余=border-strong（灰色满宽条已删）。 */
const segmentBarClass = (index: number): string => {
    return index === focusIndex.value ? "bg-[var(--accent-main)]" : "bg-[var(--border-strong)]";
};

/** R4 件3①回归修复：格少时 justify-center 集中中段，坐标换算不再可靠——
 *  直接按指针纵坐标遍历格元素命中（≤50 格，拖动节流 80ms 下成本可忽略），越界收敛两端。 */
function gridIndexFromPointer(event: PointerEvent): number | null {
    const track = trackRef.value;
    if (!track || props.segments.length === 0) {
        return null;
    }
    const children = track.children;
    const y = event.clientY;
    for (let index = 0; index < children.length; index += 1) {
        const rect = (children[index] as HTMLElement).getBoundingClientRect();
        if (y >= rect.top && y < rect.bottom) {
            return index;
        }
    }
    if (children.length > 0) {
        const firstTop = (children[0] as HTMLElement).getBoundingClientRect().top;
        if (y < firstTop) {
            return 0;
        }
        return children.length - 1;
    }
    return null;
}

function seekThrottled(gridIndex: number): void {
    const now = Date.now();
    if (now - lastSeekAt < SEEK_THROTTLE_MS) {
        return;
    }
    lastSeekAt = now;
    seekIndex(gridIndex);
}

function seekIndex(gridIndex: number): void {
    const segment = props.segments[gridIndex];
    if (segment) {
        emit("seek", segment.anchorIndex);
    }
}

function handleTrackPointerDown(event: PointerEvent): void {
    const gridIndex = gridIndexFromPointer(event);
    if (gridIndex === null) {
        return;
    }
    // R5c：capture 后格子的 pointerenter 不再触发（事件重定向到 track），
    // 拖动全程的 hover 波浪与预览卡改由 track 侧维护。
    updateHoverFromPointer(event, gridIndex);
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    seekIndex(gridIndex);
}

function handleTrackPointerMove(event: PointerEvent): void {
    const gridIndex = gridIndexFromPointer(event);
    if (gridIndex === null) {
        return;
    }
    updateHoverFromPointer(event, gridIndex);
    if (event.buttons & 1) {
        seekThrottled(gridIndex);
    }
}

function handleSegmentClick(gridIndex: number): void {
    seekIndex(gridIndex);
}

/** hover 预览卡 fixed 贴鼠标：偏移 12,12，近屏幕右/下缘自动翻面防出界（R4 件3②）。 */
const PREVIEW_W_PX = 224;
const PREVIEW_H_ESTIMATE_PX = 176;
function positionPreview(event: PointerEvent): void {
    let x = event.clientX + 12;
    let y = event.clientY + 12;
    if (x + PREVIEW_W_PX > window.innerWidth - 8) {
        x = event.clientX - PREVIEW_W_PX - 12;
    }
    if (y + PREVIEW_H_ESTIMATE_PX > window.innerHeight - 8) {
        y = event.clientY - PREVIEW_H_ESTIMATE_PX - 12;
    }
    hoverX.value = Math.max(8, x);
    hoverY.value = Math.max(8, y);
}

/** hover 状态唯一写入口：格子事件（未按下）与 track 事件（拖动 capture）都走这里。 */
function updateHoverFromPointer(event: PointerEvent, gridIndex: number): void {
    hoverIndex.value = gridIndex;
    positionPreview(event);
}

// R5c-d：预览卡 Teleport 目标=最近的 .novel-ide-theme 宿主——挂 body 会脱离主题变量作用域
// （CSS 变量回落 :root 的 sepia 黄色系），挂宿主既保变量又在 contain:paint 容器外
// （ReferencePlainTextEditor 的 popoverTeleportTarget 同款先例）。
const rootRef = ref<HTMLElement | null>(null);
const previewTeleportTarget = computed<Element | string>(() => rootRef.value?.closest(".novel-ide-theme") ?? "body");
</script>

<template>
    <!-- 会话刻度条（R5c）：右缘 20px 窄轨；竖排横向短条右对齐——正常态等宽、唯一的
         满宽长条跟随鼠标（移出回选中格）、邻格按距离波浪衰减；点击格=直接 seek；
         hover=fixed 预览卡贴鼠标（拖动 capture 时由 track 侧维护） -->
    <div ref="rootRef" class="relative flex h-full w-5 shrink-0 flex-col items-stretch py-1">
        <div
            ref="trackRef"
            class="rail-scroll my-auto flex h-2/3 touch-none flex-col justify-center overflow-y-auto"
            @pointerdown="handleTrackPointerDown"
            @pointermove="handleTrackPointerMove"
            @pointerleave="hoverIndex = null"
        >
            <button
                v-for="(segment, index) in props.segments"
                :key="segment.id"
                type="button"
                class="flex h-3 shrink-0 items-center justify-end px-0.5"
                :aria-label="segment.summary"
                @pointerenter="(event) => updateHoverFromPointer(event, index)"
                @pointermove="(event) => updateHoverFromPointer(event, index)"
                @pointerleave="hoverIndex = null"
                @click="handleSegmentClick(index)"
            >
                <!-- R5 件1：横向短条从消息流一侧（右缘）伸出，长度=ratio、贴轨道右对齐 -->
                <span
                    class="rounded-full transition-all duration-150"
                    :class="segmentBarClass(index)"
                    :style="{width: `${Math.round(segmentBarRatio(index) * 100)}%`, height: `${BAR_HEIGHT_PX}px`, opacity: segmentBarOpacity(index)}"
                ></span>
            </button>
        </div>
        <button
            type="button"
            class="inline-flex h-5 shrink-0 items-center justify-center rounded-sm text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-main)]"
            :title="t('agent.composer.scaleBarViewAll')"
            @click.stop="emit('expand')"
        >
            <span class="i-lucide-list-tree h-3.5 w-3.5"></span>
        </button>
        <!-- R5c 修复：面板祖先 contain:paint 创建包含块使 fixed 退化为相对面板定位（实测卡被顶出视口 1200px），
             Teleport 到 .novel-ide-theme 宿主（contain 外+主题变量作用域内）；z-50 高于面板层、低于通知(9800) -->
        <Teleport :to="previewTeleportTarget">
            <div
                v-if="hoverIndex !== null && props.segments[hoverIndex]"
                class="pointer-events-none fixed z-50 max-h-40 w-56 overflow-y-auto rounded-md border border-[var(--border-color)] bg-[var(--bg-panel)] p-2 text-[11px] leading-5 text-[var(--text-secondary)] shadow-xl"
                :style="{left: `${hoverX}px`, top: `${hoverY}px`}"
            >
                {{ props.segments[hoverIndex]?.summary }}
            </div>
        </Teleport>
    </div>

</template>

<style scoped>
/* 刻度条自滚（格多到超框）不显示滚动条：右侧已有真正的会话滚动区。 */
.rail-scroll {
    scrollbar-width: none;
    -ms-overflow-style: none;
}
.rail-scroll::-webkit-scrollbar {
    display: none;
    width: 0;
    height: 0;
}
</style>
