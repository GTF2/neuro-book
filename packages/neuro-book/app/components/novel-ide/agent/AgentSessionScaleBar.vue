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
    (e: "expand"): void;
}>();

const {t} = useI18n();

const trackRef = ref<HTMLElement | null>(null);
const hoverIndex = ref<number | null>(null);
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
    const gridIndex = gridIndexFromPointer(event);
    if (gridIndex === null) {
        return;
    }
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    const segment = props.segments[gridIndex];
    if (segment) {
        emit("seek", segment.anchorIndex);
    }
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
    const segment = props.segments[gridIndex];
    if (segment) {
        emit("seek", segment.anchorIndex);
    }
}
</script>

<template>
    <!-- 会话树内嵌刻度条：规格包 009 单C 批次1 §3/§4.3；右缘 24px、格高下限可点击、hover 预览、拖动节流 -->
    <div class="relative flex h-full w-6 shrink-0 flex-col items-stretch gap-px py-1">
        <div
            ref="trackRef"
            class="flex min-h-0 flex-1 touch-none flex-col gap-px"
            @pointerdown="handleTrackPointerDown"
            @pointermove="handleTrackPointerMove"
        >
            <button
                v-for="(segment, index) in props.segments"
                :key="segment.id"
                type="button"
                class="min-h-[4px] flex-1 rounded-sm transition-colors"
                :class="index === activeGridIndex ? 'bg-[var(--accent-main)]' : index === hoverIndex ? 'bg-[var(--text-muted)]' : 'bg-[var(--border-color)] hover:bg-[var(--text-muted)]'"
                :aria-label="segment.summary"
                @pointerenter="hoverIndex = index"
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
        >
            {{ props.segments[hoverIndex]?.summary }}
        </div>
    </div>
</template>
