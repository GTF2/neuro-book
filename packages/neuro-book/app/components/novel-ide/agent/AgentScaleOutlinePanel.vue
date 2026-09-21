<script setup lang="ts">
/**
 * 刻度条中面板（009C1R 必修B 三形态之二）：点击刻度格后从右缘滑入，
 * 列出该格覆盖范围的 prompt/answer/work 摘要行；行点击定位正文，
 * 「查看全部」交宿主打开完整会话树。行为参照旧库 0f92cc9a 大纲面板按新库重写。
 */
export type AgentScaleOutlineRow = {
    id: string;
    kind: "prompt" | "answer" | "work";
    label: string;
    /** 对应 flowItems 下标，seek 直接定位。 */
    flowIndex: number;
};

defineProps<{
    rows: AgentScaleOutlineRow[];
}>();

const emit = defineEmits<{
    (e: "seek", flowIndex: number): void;
    (e: "view-all"): void;
    (e: "close"): void;
}>();

const {t} = useI18n();

const ROW_META: Record<AgentScaleOutlineRow["kind"], {icon: string; class: string}> = {
    prompt: {icon: "i-lucide-message-circle", class: "text-[var(--accent-text)]"},
    answer: {icon: "i-lucide-corner-down-right", class: "text-[var(--text-muted)]"},
    work: {icon: "i-lucide-wrench", class: "text-[var(--text-muted)]"},
};
</script>

<template>
    <div class="absolute inset-y-2 right-7 z-40 flex w-[65%] min-w-0 flex-col overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--bg-panel)] shadow-2xl">
        <div class="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--border-color)] px-3 py-2">
            <span class="text-xs font-medium text-[var(--text-main)]">{{ t("agent.composer.scaleOutlineTitle") }}</span>
            <div class="flex items-center gap-1">
                <button
                    type="button"
                    class="inline-flex h-6 items-center gap-1 rounded-md px-2 text-[11px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-main)]"
                    @click="emit('view-all')"
                >
                    <span class="i-lucide-list-tree h-3 w-3"></span>
                    {{ t("agent.composer.scaleBarViewAll") }}
                </button>
                <button
                    type="button"
                    class="rounded p-1 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-main)]"
                    @click="emit('close')"
                >
                    <span class="i-lucide-x h-3.5 w-3.5"></span>
                </button>
            </div>
        </div>
        <div class="min-h-0 flex-1 overflow-y-auto p-1.5">
            <button
                v-for="row in rows"
                :key="row.id"
                type="button"
                class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11px] leading-5 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-main)]"
                @click="emit('seek', row.flowIndex)"
            >
                <span :class="[ROW_META[row.kind].icon, ROW_META[row.kind].class]" class="h-3 w-3 shrink-0"></span>
                <span class="min-w-0 flex-1 truncate">{{ row.label }}</span>
            </button>
        </div>
    </div>
</template>
