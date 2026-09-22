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

/** R4 件3③：格高两轨合一——非选中格=平滑波浪（3 格滑动平均，禁孤立突起，6-14px），
 *  选中/当前视口格=20px 强调格+高亮色（显著高于任何非选中格）；密度另以颜色深浅辅助。 */
const ACTIVE_BAR_PX = 20;
const WAVE_MIN_PX = 6;
const WAVE_MAX_PX = 14;
const smoothWeight = (index: number): number => {
    const at = (i: number): number => (i >= 0 && i < props.segments.length ? props.segments[i]?.weight ?? 1 : 1);
    return (at(index - 1) + at(index) + at(index + 1)) / 3;
};
const segmentBarHeightPx = (index: number): number => {
    if (index === activeGridIndex.value) {
        return ACTIVE_BAR_PX;
    }
    const maxWeight = Math.max(1, ...props.segments.map((segment) => segment.weight ?? 1));
    const ratio = Math.min(1, smoothWeight(index) / maxWeight);
    return Math.round(WAVE_MIN_PX + ratio * (WAVE_MAX_PX - WAVE_MIN_PX));
};
/** 非选中格颜色深浅随平滑密度（0.45-0.85），波浪为主颜色为辅。 */
const segmentBarOpacity = (index: number): number => {
    if (index === activeGridIndex.value) {
        return 1;
    }
    const maxWeight = Math.max(1, ...props.segments.map((segment) => segment.weight ?? 1));
    const ratio = Math.min(1, smoothWeight(index) / maxWeight);
    return 0.45 + ratio * 0.4;
};
const segmentBarClass = (index: number): string => {
    if (index === activeGridIndex.value) {
        return "bg-[var(--accent-main)]";
    }
    if (index === hoverIndex.value) {
        return "bg-[var(--text-secondary)]";
    }
    return "bg-[var(--border-strong)]";
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

/** hover 预览卡 fixed 贴鼠标：偏移 12,12，近屏幕右/下缘自动翻面防出界（R4 件3②）。 */
const PREVIEW_W_PX = 224;
const PREVIEW_H_ESTIMATE_PX = 176;
function handleSegmentHover(event: PointerEvent, index: number): void {
    hoverIndex.value = index;
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
</script>

<template>
    <!-- 会话刻度条（R4 件3）：右缘 36px；格条 8px 宽、高度=波浪渐变（密度）+选中强调格；
         密度映射=格固定行高、少时集中中段、多时向两端扩展（框高 2/3 居中，装不下隐藏滚动条内滚）；
         点击格=直接 seek 定位；hover=fixed 预览卡贴鼠标跟随；底部入口开完整会话树 -->
    <div class="relative flex h-full w-9 shrink-0 flex-col items-stretch py-1">
        <div
            ref="trackRef"
            class="rail-scroll my-auto flex h-2/3 touch-none flex-col justify-center overflow-y-auto"
            @pointerdown="handleTrackPointerDown"
            @pointermove="handleTrackPointerMove"
        >
            <button
                v-for="(segment, index) in props.segments"
                :key="segment.id"
                type="button"
                class="flex h-4 shrink-0 items-center px-1"
                :aria-label="segment.summary"
                @pointerenter="(event) => handleSegmentHover(event, index)"
                @pointermove="(event) => handleSegmentHover(event, index)"
                @pointerleave="hoverIndex = null"
                @click="handleSegmentClick(index)"
            >
                <span
                    class="w-2 rounded-full transition-all duration-150"
                    :class="segmentBarClass(index)"
                    :style="{height: `${segmentBarHeightPx(index)}px`, opacity: segmentBarOpacity(index)}"
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
        <div
            v-if="hoverIndex !== null && props.segments[hoverIndex]"
            class="pointer-events-none fixed z-30 max-h-40 w-56 overflow-y-auto rounded-md border border-[var(--border-color)] bg-[var(--bg-panel)] p-2 text-[11px] leading-5 text-[var(--text-secondary)] shadow-xl"
            :style="{left: `${hoverX}px`, top: `${hoverY}px`}"
        >
            {{ props.segments[hoverIndex]?.summary }}
        </div>
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
