<script setup lang="ts">
import { computed } from "vue";
import type { ChatOutlineItem, ChatOutlineStatus } from "nbook/app/components/novel-ide/agent/chat-outline";
import { CHAT_WORK_BLOCK_META } from "nbook/app/components/novel-ide/agent/chat-work-blocks";

const props = defineProps<{
    items: ChatOutlineItem[];
    /** 当前高亮行的锚点 id；空串表示还没定位。 */
    activeAnchorId: string;
    /** 主时间线是否处于「全部展开」，只用于决定按钮的方向与文案。 */
    allExpanded: boolean;
    /** 窄容器下可以整体隐藏，交给外层控制。 */
    hidden?: boolean;
}>();

const emit = defineEmits<{
    (e: "jump", anchorId: string): void;
    (e: "toggle-all"): void;
}>();

const { t } = useI18n();

/** 状态标记：绿勾 / 红叉 / 蓝色转圈，与主时间线的语义保持一致。 */
const STATUS_MARK: Record<ChatOutlineStatus, {icon: string; className: string; spin: boolean}> = {
    success: {icon: "i-lucide-check", className: "text-[var(--status-success)]", spin: false},
    failed: {icon: "i-lucide-x", className: "text-[var(--status-danger)]", spin: false},
    running: {icon: "i-lucide-loader-circle", className: "text-[var(--status-info)]", spin: true},
};

/** 工作块一行的文案：类别 + 计数，全部来自工具元数据。 */
const blockLabel = (item: Extract<ChatOutlineItem, {kind: "block"}>): string => {
    const parts = [t(CHAT_WORK_BLOCK_META[item.blockKind].labelKey)];
    parts.push(item.fileCount > 0
        ? t("agent.workBlock.fileCount", {count: item.fileCount})
        : t("agent.workBlock.stepCount", {count: item.count}));
    if (item.failedCount > 0) {
        parts.push(t("agent.workBlock.failedCount", {count: item.failedCount}));
    }
    return parts.join(" · ");
};

const isEmpty = computed(() => props.items.length === 0);
</script>

<template>
    <aside
        v-if="!props.hidden"
        class="flex h-full w-[228px] shrink-0 flex-col border-l border-[var(--border-color)] bg-[var(--bg-panel)]"
    >
        <div class="flex items-center justify-between gap-2 border-b border-[var(--border-color)] px-3 py-2">
            <span class="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">{{ t("agent.outline.title") }}</span>
            <button
                type="button"
                class="inline-flex h-6 w-6 items-center justify-center rounded text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-main)]"
                :title="props.allExpanded ? t('agent.outline.collapseAll') : t('agent.outline.expandAll')"
                @click="emit('toggle-all')"
            >
                <span :class="props.allExpanded ? 'i-lucide-fold-vertical' : 'i-lucide-unfold-vertical'" class="h-3.5 w-3.5"></span>
            </button>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto px-1.5 py-2 custom-scrollbar">
            <div v-if="isEmpty" class="px-2 py-3 text-[11px] text-[var(--text-muted)]">{{ t("agent.outline.empty") }}</div>

            <button
                v-for="item in props.items"
                :key="item.anchorId"
                type="button"
                class="flex w-full items-start gap-2 rounded px-2 py-1.5 text-left transition-colors"
                :class="item.anchorId === props.activeAnchorId
                    ? 'bg-[var(--accent-bg)]'
                    : 'hover:bg-[var(--bg-hover)]'"
                @click="emit('jump', item.anchorId)"
            >
                <!-- 用户提问：粗体锚点 + 时间 -->
                <template v-if="item.kind === 'prompt'">
                    <span class="i-lucide-message-square h-3 w-3 shrink-0 translate-y-0.5 text-[var(--accent-main)]"></span>
                    <span class="min-w-0 flex-1">
                        <span class="line-clamp-2 text-[11.5px] font-semibold text-[var(--text-main)]">
                            {{ item.preview || t("agent.outline.emptyPrompt") }}
                        </span>
                        <span v-if="item.timestamp" class="mt-0.5 block text-[10px] text-[var(--text-muted)]">{{ item.timestamp }}</span>
                    </span>
                </template>

                <!-- 工作块：图标 + 一句话 + 状态标记 -->
                <template v-else>
                    <span :class="CHAT_WORK_BLOCK_META[item.blockKind].icon" class="h-3 w-3 shrink-0 translate-y-0.5 text-[var(--text-muted)]"></span>
                    <span class="min-w-0 flex-1 truncate text-[11.5px] text-[var(--text-secondary)]">{{ blockLabel(item) }}</span>
                    <span
                        :class="[STATUS_MARK[item.status].icon, STATUS_MARK[item.status].className, STATUS_MARK[item.status].spin ? 'animate-spin' : '']"
                        class="h-3 w-3 shrink-0 translate-y-0.5"
                    ></span>
                </template>
            </button>
        </div>
    </aside>
</template>
