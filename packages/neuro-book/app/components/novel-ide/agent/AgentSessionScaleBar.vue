<script setup lang="ts">
export type AgentSessionScaleSegment = {
    /** 稳定 key，供 v-for 复用 */
    id: string;
    /** 该格覆盖范围的摘要文本，hover 预览卡显示 */
    summary: string;
    /** 该格锚定的消息序号，seek 发此值供挂载侧直接定位 */
    anchorIndex: number;
};

const props = defineProps<{
    /** 挂载侧聚合后的格序列（规格封顶 50，聚合归挂载侧，本件只渲染收到的 segments） */
    segments: AgentSessionScaleSegment[];
    /** 当前锚点消息序号；命中「anchorIndex ≤ activeIndex 的最后一格」高亮 */
    activeIndex: number;
}>();

const emit = defineEmits<{
    (e: "seek", index: number): void;
    /** 单击格：打开该格的中面板（009C1R 必修B 三形态之二）。 */
    (e: "open-outline", gridIndex: number): void;
    (e: "expand"): void;
}>();

const {t} = useI18n();

const trackRef = ref<HTMLElement | null>(null);
const hoverIndex = ref<number | null>(null);
/** hover 预览卡跟格移动（009C1R 顺手修遗留：不再固定在顶部）。 */
const hoverTopPx = ref(0);
// 拖动时的 seek 节流间隔；点击路径不节流
const SEEK_THROTTLE_MS = 80;
let lastSeekAt = 0;
// 区分点击与拖动：按下后位移超过阈值算拖动，松开不再当点击弹面板
const DRAG_THRESHOLD_PX = 4;
let dragStartY = 0;
let dragMoved = false;
let suppressClickAt = 0;

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

/** 指针纵坐标换算格下标；条内均分，越界收敛到首末格。 */
function gridIndexFromPointer(event: PointerEvent): number | null {
    const track = trackRef.value;
    if (!track || props.segments.length === 0) {
        return null;
    }
    const rect = track.getBoundingClientRect();
    if (rect.height <= 0) {
        return null;
    }
    const ratio = (event.clientY - rect.top) / rect.height;
    const index = Math.floor(ratio * props.segments.length);
    return Math.min(Math.max(index, 0), props.segments.length - 1);
}

function seekThrottled(gridIndex: number): void {
    const now = Date.now();
    if (now - lastSeekAt < SEEK_THROTTLE_MS) {
        return;
    }
    lastSeekAt = now;
    const segment = props.segments[gridIndex];
    if (segment) {
        emit("seek", segment.anchorIndex);
    }
}

function handleTrackPointerDown(event: PointerEvent): void {
    if (gridIndexFromPointer(event) === null) {
        return;
    }
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    dragStartY = event.clientY;
    dragMoved = false;
}

function handleTrackPointerMove(event: PointerEvent): void {
    if (!(event.buttons & 1)) {
        return;
    }
    if (!dragMoved && Math.abs(event.clientY - dragStartY) > DRAG_THRESHOLD_PX) {
        dragMoved = true;
    }
    if (!dragMoved) {
        return;
    }
    const gridIndex = gridIndexFromPointer(event);
    if (gridIndex !== null) {
        seekThrottled(gridIndex);
    }
}

function handleTrackPointerUp(event: PointerEvent): void {
    if (dragMoved) {
        // 拖动结束后的 pointerup 会派发 click；标记时间窗抑制，避免松手误开面板。
        suppressClickAt = Date.now();
        return;
    }
    const gridIndex = gridIndexFromPointer(event);
    if (gridIndex !== null) {
        emit("open-outline", gridIndex);
    }
}

function handleSegmentClick(gridIndex: number): void {
    // pointerup 已处理点击；这里只兜底键盘 Enter 与拖动后的误触抑制。
    if (Date.now() - suppressClickAt < 200) {
        return;
    }
    emit("open-outline", gridIndex);
}

/** hover 预览卡纵向跟手：以格中心在条内的位置对齐卡片中点，越界收敛。 */
function handleSegmentHover(event: PointerEvent, index: number): void {
    hoverIndex.value = index;
    const track = trackRef.value;
    const target = event.currentTarget as HTMLElement;
    if (!track) {
        return;
    }
    const trackRect = track.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const center = targetRect.top + targetRect.height / 2 - trackRect.top;
    hoverTopPx.value = Math.max(0, Math.min(center, trackRect.height));
}
</script>

<template>
    <!-- 会话树内嵌刻度条（009C1R 必修B）：右缘 24px 固定列；hover 预览、单击中面板、拖动按比例滚 -->
    <div class="relative flex h-full w-6 shrink-0 flex-col items-stretch gap-px py-1">
        <div
            ref="trackRef"
            class="flex min-h-0 flex-1 touch-none flex-col gap-px"
            @pointerdown="handleTrackPointerDown"
            @pointermove="handleTrackPointerMove"
            @pointerup="handleTrackPointerUp"
        >
            <button
                v-for="(segment, index) in props.segments"
                :key="segment.id"
                type="button"
                class="min-h-[4px] flex-1 rounded-sm transition-colors"
                :class="index === activeGridIndex ? 'bg-[var(--accent-main)]' : index === hoverIndex ? 'bg-[var(--text-muted)]' : 'bg-[var(--border-color)] hover:bg-[var(--text-muted)]'"
                :aria-label="segment.summary"
                @pointerenter="(event) => handleSegmentHover(event, index)"
                @pointerleave="hoverIndex = null"
                @click="handleSegmentClick(index)"
            ></button>
        </div>
        <button
            type="button"
            class="inline-flex h-5 shrink-0 items-center justify-center rounded-sm text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-main)]"
            :title="t('agent.composer.scaleBarViewAll')"
            @click.stop="emit('expand')"
        >
            <span class="i-lucide-list-tree h-3.5 w-3.5"></span>
        </button>
        <div
            v-if="hoverIndex !== null && props.segments[hoverIndex]"
            class="pointer-events-none absolute right-full top-0 z-30 mr-2 max-h-40 w-56 overflow-y-auto rounded-md border border-[var(--border-color)] bg-[var(--bg-panel)] p-2 text-[11px] leading-5 text-[var(--text-secondary)] shadow-xl"
            :style="{transform: `translateY(${Math.max(0, hoverTopPx - 40)}px)`}"
        >
            {{ props.segments[hoverIndex]?.summary }}
        </div>
    </div>
</template>
