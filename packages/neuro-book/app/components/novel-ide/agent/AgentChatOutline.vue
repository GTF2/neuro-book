<script setup lang="ts">
import { ref } from "vue";
import type { ChatOutlineItem, ChatOutlineStatus } from "nbook/app/components/novel-ide/agent/chat-outline";
import { CHAT_WORK_BLOCK_META } from "nbook/app/components/novel-ide/agent/chat-work-blocks";

const props = defineProps<{
    items: ChatOutlineItem[];
    /** 当前高亮行的锚点 id；空串表示还没定位。 */
    activeAnchorId: string;
    /** 主时间线是否处于「全部展开」，只用于决定按钮的方向与文案。 */
    allExpanded: boolean;
    /** 没有可定位内容时整体隐藏，连指示条也不占位。 */
    hidden?: boolean;
}>();

const emit = defineEmits<{
    (e: "jump", anchorId: string): void;
    (e: "toggle-all"): void;
}>();

const { t } = useI18n();

/**
 * 三态里的第二态：只有鼠标进到这条极窄指示条上，才把完整目录浮出来。
 * 常驻宽度控制在 28px，正文宽度不该为一个「偶尔用一次」的导航让路。
 */
const expanded = ref(false);

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
    parts.push(item.fileCount > 0
        ? t("agent.workBlock.fileCount", {count: item.fileCount})
        : t("agent.workBlock.stepCount", {count: item.count}));
    if (item.failedCount > 0) {
        parts.push(t("agent.workBlock.failedCount", {count: item.failedCount}));
    }
    return parts.join(" · ");
};

/**
 * 三态里的第三态直接交给原生 title：
 * 它自带「停一会儿才出现」的延迟，正是要的效果，自己实现一套只会更卡更难对齐。
 */
const rowTooltip = (item: ChatOutlineItem): string => {
    const label = rowLabel(item);
    if (item.kind === "prompt" && item.timestamp) {
        return `${item.timestamp}\n${label}`;
    }
    return label;
};

const isActive = (item: ChatOutlineItem): boolean => item.anchorId === props.activeAnchorId;

/** 指示条上的一小段横线：当前项更长更实，其余按类型与状态压暗。 */
const indicatorClass = (item: ChatOutlineItem): string => {
    if (isActive(item)) {
        return "w-4 bg-[var(--accent-main)]";
    }
    if (item.kind === "prompt") {
        return "w-3 bg-[var(--text-muted)]/60";
    }
    if (item.kind === "block" && item.status === "failed") {
        return "w-3 bg-[var(--status-danger)]/70";
    }
    return "w-2.5 bg-[var(--text-muted)]/35";
};
</script>

<template>
    <aside
        v-if="!props.hidden && props.items.length > 0"
        class="relative flex h-full shrink-0 items-stretch"
        @mouseenter="expanded = true"
        @mouseleave="expanded = false"
    >
        <!-- 完整目录：悬停才浮出，压在正文之上而不是把正文挤窄 -->
        <transition
            enter-active-class="transition duration-150 ease-out"
            enter-from-class="opacity-0 translate-x-2"
            leave-active-class="transition duration-100 ease-in"
            leave-to-class="opacity-0 translate-x-1"
        >
            <div
                v-if="expanded"
                class="absolute right-full top-2 z-30 mr-2 max-h-[70%] w-[300px] overflow-y-auto rounded-xl border border-[var(--border-color)] bg-[var(--bg-panel)] py-1.5 shadow-2xl custom-scrollbar"
            >
                <button
                    v-for="item in props.items"
                    :key="item.anchorId"
                    type="button"
                    class="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left transition-colors"
                    :class="isActive(item) ? 'bg-[var(--accent-bg)]' : 'hover:bg-[var(--bg-hover)]'"
                    :title="rowTooltip(item)"
                    @click="emit('jump', item.anchorId)"
                >
                    <span
                        :class="[rowIcon(item), iconTone(item), item.kind === 'answer' && item.running ? 'animate-spin' : '']"
                        class="h-3 w-3 shrink-0"
                    ></span>
                    <span
                        class="min-w-0 flex-1 truncate text-[11.5px]"
                        :class="[
                            item.kind === 'prompt' ? 'font-semibold' : '',
                            isActive(item) ? 'text-[var(--accent-main)]' : 'text-[var(--text-secondary)]',
                        ]"
                    >{{ rowLabel(item) }}</span>
                    <span
                        class="h-[3px] shrink-0 rounded-full transition-all"
                        :class="isActive(item) ? 'w-4 bg-[var(--accent-main)]' : 'w-2.5 bg-[var(--border-color)]'"
                    ></span>
                </button>

                <div class="mt-1 border-t border-[var(--border-color)] px-2.5 pt-1.5">
                    <button
                        type="button"
                        class="inline-flex items-center gap-1.5 rounded px-1 py-1 text-[10.5px] text-[var(--text-muted)] transition-colors hover:text-[var(--text-main)]"
                        @click="emit('toggle-all')"
                    >
                        <span :class="props.allExpanded ? 'i-lucide-fold-vertical' : 'i-lucide-unfold-vertical'" class="h-3 w-3"></span>
                        {{ props.allExpanded ? t("agent.outline.collapseAll") : t("agent.outline.expandAll") }}
                    </button>
                </div>
            </div>
        </transition>

        <!-- 常驻指示条：默认只有这一列细线，不挤压正文 -->
        <div class="flex w-7 flex-col items-center justify-center gap-1.5 overflow-hidden border-l border-[var(--border-color)] bg-[var(--bg-panel)]">
            <span
                v-for="item in props.items"
                :key="item.anchorId"
                class="h-[3px] shrink-0 rounded-full transition-all duration-200"
                :class="indicatorClass(item)"
            ></span>
        </div>
    </aside>
</template>
