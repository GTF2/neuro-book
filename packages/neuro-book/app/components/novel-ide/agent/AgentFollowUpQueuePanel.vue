<script setup lang="ts">
import {computed, ref} from "vue";
import type {AgentFollowUpQueueStateDto, AgentQueuedMessageDto} from "nbook/shared/dto/agent-session.dto";

const props = defineProps<{
    /** 当前会话的待投递队列；会话没有队列时为 null。 */
    queue: AgentFollowUpQueueStateDto | null;
    /** 会话是否正在运行；运行中提交送达只是置顶排队，本轮结束后第一个送出，不打断当前运行。 */
    running: boolean;
    /** 会话当前是否允许操作队列；不可交互时只展示状态。 */
    canOperate: boolean;
    /** 是否有一次队列操作正在提交。 */
    busy: boolean;
}>();

const emit = defineEmits<{
    /** 送达某一条。 */
    (e: "deliver", itemId: string): void;
    /** 忽略某一条。 */
    (e: "dismiss", itemId: string): void;
    /** 解除暂停并全部送达。 */
    (e: "resume"): void;
    /** 请求宿主体执行「全部忽略」的二次确认。 */
    (e: "request-dismiss-all"): void;
}>();

const {t} = useI18n();
/** 默认只占一行；需要看来源与原因时再展开。 */
const expanded = ref(false);
/** 已提交过送达的队列项；提交后按钮置灰，避免对同一条重复操作。 */
const submitted = ref<Set<string>>(new Set());

/** 提交一次送达；同一项只提交一次。 */
function submitDeliver(itemId: string): void {
    if (submitted.value.has(itemId)) {
        return;
    }
    submitted.value = new Set(submitted.value).add(itemId);
    emit("deliver", itemId);
}

/** 送达按钮的悬停说明：提交后区分「已经送达」与「等本轮结束后送达」。 */
function deliverTitle(item: AgentQueuedMessageDto): string {
    if (!submitted.value.has(item.id)) {
        return t("agent.followUpQueue.deliverTitle");
    }
    return props.running
        ? t("agent.followUpQueue.submittedPendingTitle")
        : t("agent.followUpQueue.submittedTitle");
}

/** 送达按钮文案与悬停说明同源：运行中提交只是置顶排队，不能显示「已送达」。 */
function deliverLabel(item: AgentQueuedMessageDto): string {
    if (!submitted.value.has(item.id)) {
        return t("agent.followUpQueue.deliver");
    }
    return props.running
        ? t("agent.followUpQueue.submittedPending")
        : t("agent.followUpQueue.submitted");
}

const items = computed(() => props.queue?.items ?? []);
const count = computed(() => items.value.length);
const paused = computed(() => props.queue?.status === "paused");
const retry = computed(() => props.queue?.autoRetry ?? null);

/** 暂停原因用人话表达；准入失败带上有界说明。 */
const pausedReason = computed<string>(() => {
    const pausedBy = props.queue?.pausedBy;
    if (pausedBy === undefined) {
        return "";
    }
    if (pausedBy.reason === "admission_error") {
        return t("agent.followUpQueue.reason.admissionError", {
            message: pausedBy.message ?? t("agent.followUpQueue.reason.unknown"),
        });
    }
    return t(`agent.followUpQueue.reason.${pausedBy.reason}`);
});

const barTitle = computed(() => {
    if (paused.value) {
        return t("agent.followUpQueue.pausedTitle", {count: count.value});
    }
    return props.running
        ? t("agent.followUpQueue.runningTitle", {count: count.value})
        : t("agent.followUpQueue.readyTitle", {count: count.value});
});

const barDetail = computed(() => {
    const current = retry.value;
    if (current?.exhausted === true) {
        return t("agent.followUpQueue.retryExhausted", {limit: current.limit});
    }
    if (current !== null) {
        return t("agent.followUpQueue.retrying", {attempt: current.attempt, limit: current.limit});
    }
    if (paused.value) {
        return pausedReason.value;
    }
    return props.running ? t("agent.followUpQueue.runningHint") : t("agent.followUpQueue.readyHint");
});

/** 队列项来源；缺失内部 caller 的旧项显示为未知来源。 */
function sourceLabel(item: AgentQueuedMessageDto): string {
    switch (item.source) {
        case "user":
            return t("agent.followUpQueue.source.user");
        case "system":
            return t("agent.followUpQueue.source.system");
        default:
            return t("agent.followUpQueue.source.unknown");
    }
}

/** 队列项正文；没有文本时回落到图片数量说明。 */
function itemText(item: AgentQueuedMessageDto): string {
    const text = item.text?.preview.trim();
    if (text) {
        return text;
    }
    const images = item.images.length + item.omittedImages;
    return images > 0
        ? t("agent.followUpQueue.imageOnly", {count: images})
        : t("agent.followUpQueue.unknownContent");
}
</script>

<template>
    <div v-if="count > 0" class="px-1 pb-1.5">
        <!-- 折叠条：默认只占一行，批量操作与展开都在右上角 -->
        <div
            class="flex min-w-0 items-center gap-2 rounded-lg border px-2.5 py-1.5"
            :class="paused
                ? 'border-[var(--status-warning-border)] bg-[var(--status-warning-bg)]'
                : 'border-[var(--border-color)] bg-[var(--bg-input)]'"
        >
            <span
                :class="paused ? 'i-lucide-pause' : 'i-lucide-clock'"
                class="h-3.5 w-3.5 shrink-0"
                :style="{color: paused ? 'var(--status-warning)' : 'var(--text-muted)'}"
            ></span>
            <div class="min-w-0">
                <div
                    class="truncate text-xs font-medium"
                    :style="{color: paused ? 'var(--status-warning)' : 'var(--text-main)'}"
                >{{ barTitle }}</div>
                <div v-if="barDetail" class="truncate text-[11px] text-[var(--text-muted)]">{{ barDetail }}</div>
            </div>
            <span class="min-w-0 flex-1"></span>
            <button
                v-if="count > 1 && canOperate"
                type="button"
                class="shrink-0 rounded border border-[var(--border-color)] bg-[var(--bg-panel)] px-2 py-0.5 text-[11px] text-[var(--text-secondary)] transition-colors hover:text-[var(--status-danger)] disabled:opacity-50"
                :disabled="busy"
                :title="t('agent.followUpQueue.dismissAllTitle')"
                @click="emit('request-dismiss-all')"
            >{{ t("agent.followUpQueue.dismissAll") }}</button>
            <button
                v-if="count > 1 && canOperate"
                type="button"
                class="shrink-0 rounded bg-[var(--accent-main)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-inverse)] transition-opacity hover:opacity-80 disabled:opacity-50"
                :disabled="busy"
                @click="emit('resume')"
            >{{ t("agent.followUpQueue.deliverAll") }}</button>
            <button
                type="button"
                class="shrink-0 rounded border border-[var(--border-color)] bg-[var(--bg-panel)] px-2 py-0.5 text-[11px] text-[var(--text-secondary)]"
                :aria-expanded="expanded"
                @click="expanded = !expanded"
            >{{ expanded ? t("agent.followUpQueue.collapse") : t("agent.followUpQueue.detail") }}</button>
        </div>

        <!-- 展开面板：限高滚动，不挤占对话区 -->
        <div v-if="expanded" class="mt-1.5 overflow-hidden rounded-lg border border-[var(--border-color)]">
            <div class="flex max-h-60 flex-col gap-1.5 overflow-y-auto overscroll-contain p-2">
                <div
                    v-for="item in items"
                    :key="item.id"
                    class="flex min-w-0 items-center gap-2 rounded-md border border-[var(--border-color)] bg-[var(--bg-panel)] px-2 py-1.5"
                >
                    <span
                        class="shrink-0 rounded border px-1.5 text-[10px] leading-4"
                        :class="item.source === 'user'
                            ? 'border-[var(--accent-main)]/40 bg-[var(--accent-bg)] text-[var(--accent-text)]'
                            : 'border-[var(--border-color)] bg-[var(--bg-input)] text-[var(--text-secondary)]'"
                    >{{ sourceLabel(item) }}</span>
                    <span class="min-w-0 flex-1 truncate text-xs text-[var(--text-main)]" :title="itemText(item)">{{ itemText(item) }}</span>
                    <button
                        v-if="canOperate"
                        type="button"
                        class="shrink-0 rounded px-2 py-0.5 text-[11px] font-medium transition-colors disabled:cursor-not-allowed"
                        :class="submitted.has(item.id)
                            ? 'bg-[var(--bg-input)] text-[var(--text-muted)]'
                            : 'bg-[var(--accent-main)] text-[var(--text-inverse)] hover:opacity-80 disabled:opacity-50'"
                        :disabled="busy || submitted.has(item.id)"
                        :title="deliverTitle(item)"
                        @click="submitDeliver(item.id)"
                    >{{ deliverLabel(item) }}</button>
                    <button
                        v-if="canOperate"
                        type="button"
                        class="shrink-0 rounded border border-[var(--border-color)] bg-[var(--bg-panel)] px-2 py-0.5 text-[11px] text-[var(--text-muted)] transition-colors hover:text-[var(--status-danger)] disabled:opacity-50"
                        :disabled="busy"
                        :title="t('agent.followUpQueue.dismissTitle')"
                        @click="emit('dismiss', item.id)"
                    >{{ t("agent.followUpQueue.dismiss") }}</button>
                </div>
            </div>
        </div>
    </div>
</template>
