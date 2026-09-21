<script setup lang="ts">
export type AgentSessionScaleSegment = {
    /** 稳定 key，供 v-for 复用 */
    id: string;
    /** 该格覆盖范围的摘要文本，hover 预览卡显示 */
    summary: string;
    /** 该格锚定的 flowItem 序号，seek 直接定位 */
    anchorIndex: number;
    /** 体量权重（轮内节点数），决定刻度线长短分级 */
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
/** hover 预览卡跟格移动。 */
const hoverTopPx = ref(0);
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

/** 体量分级（009C1R2 件2a）：线长三档，与底色融合无底轨。 */
const segmentWidthClass = (index: number): string => {
    const weight = props.segments[index]?.weight ?? 1;
    if (index === activeGridIndex.value) {
        return "w-full bg-[var(--text-main)]";
    }
    if (index === hoverIndex.value) {
        return "w-2/3 bg-[var(--text-secondary)]";
    }
    if (weight >= 6) {
        return "w-full bg-[var(--border-strong)]/70";
    }
    if (weight >= 3) {
        return "w-2/3 bg-[var(--border-strong)]/70";
    }
    return "w-1/2 bg-[var(--border-strong)]/70";
};

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
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    seekIndex(gridIndex);
}

function handleTrackPointerMove(event: PointerEvent): void {
    if (!(event.buttons & 1)) {
        return;
    }
    const gridIndex = gridIndexFromPointer(event);
    if (gridIndex !== null) {
        seekThrottled(gridIndex);
    }
}

function handleSegmentClick(gridIndex: number): void {
    seekIndex(gridIndex);
}

/** hover 预览卡纵向跟手：以格中心对齐，越界收敛。 */
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
    <!-- 会话刻度条（009C1R2 件2 照旧库 0f92cc9a 重做）：右缘 24px；2px 细横线长短分级、无底轨无边框；
         点击格=直接 seek 滚动定位（无中间层）；hover=小预览框；底部入口开完整会话树 -->
    <div class="relative flex h-full w-6 shrink-0 flex-col items-stretch py-1">
        <div
            ref="trackRef"
            class="flex min-h-0 flex-1 touch-none flex-col"
            @pointerdown="handleTrackPointerDown"
            @pointermove="handleTrackPointerMove"
        >
            <button
                v-for="(segment, index) in props.segments"
                :key="segment.id"
                type="button"
                class="flex min-h-[10px] flex-1 items-center justify-center"
                :aria-label="segment.summary"
                @pointerenter="(event) => handleSegmentHover(event, index)"
                @pointerleave="hoverIndex = null"
                @click="handleSegmentClick(index)"
            >
                <span class="h-[2px] rounded-full transition-all duration-150" :class="segmentWidthClass(index)"></span>
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
        <div
            v-if="hoverIndex !== null && props.segments[hoverIndex]"
            class="pointer-events-none absolute right-full top-0 z-30 mr-2 max-h-40 w-56 overflow-y-auto rounded-md border border-[var(--border-color)] bg-[var(--bg-panel)] p-2 text-[11px] leading-5 text-[var(--text-secondary)] shadow-xl"
            :style="{transform: `translateY(${Math.max(0, hoverTopPx - 40)}px)`}"
        >
            {{ props.segments[hoverIndex]?.summary }}
        </div>
    </div>
</template>
