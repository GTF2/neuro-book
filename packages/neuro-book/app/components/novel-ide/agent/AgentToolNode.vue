<script setup lang="ts">
import type { AgentToolCall } from "nbook/app/components/novel-ide/agent/agent-message";
import { resolveToolRenderConfig } from "nbook/app/components/novel-ide/agent/tool-render-registry";
import { toolStatusClass, toolStatusIcon } from "nbook/app/components/novel-ide/agent/agent-message";
import JsonViewer from "nbook/app/components/common/JsonViewer.vue";

const props = defineProps<{
    toolCall: AgentToolCall;
    expanded: boolean;
}>();

const emit = defineEmits<{
    (e: "toggle"): void;
    (e: "copy"): void;
}>();

const renderConfig = computed(() => resolveToolRenderConfig(props.toolCall));
const {t} = useI18n();

const isRunning = computed(() => props.toolCall.status === "running" || props.toolCall.status === "streaming");
const isFailed = computed(() => props.toolCall.status === "error" || props.toolCall.status === "invalid");
const collapsedPreview = computed(() => renderConfig.value.collapsedPreviewKey ? t(renderConfig.value.collapsedPreviewKey) : renderConfig.value.collapsedPreview);
/** 收起态过程行的一行摘要：优先参数预览，其次注册表预览文案。 */
const rowSummary = computed(() => {
    if (renderConfig.value.mode === "inline") {
        return props.toolCall.argsJson ?? props.toolCall.argsText;
    }
    return collapsedPreview.value;
});
/** 收起态图标颜色沿用状态语义：失败红、运行信息色、其余弱化。 */
const rowIconClass = computed(() => {
    if (isFailed.value) {
        return "text-[var(--status-danger)]";
    }
    if (isRunning.value) {
        return "text-[var(--status-info)]";
    }
    return "";
});
/** 后台 workflow 的 tool success 只表示 job 已登记，头部不得显示成 workflow 完成。 */
const isStartedWorkflowJob = computed(() => {
    const details = props.toolCall.resultData;
    if (props.toolCall.name !== "run_workflow" || !details || typeof details !== "object" || Array.isArray(details)) {
        return false;
    }
    return details.status === "started";
});
const displayedStatusClass = computed(() => isStartedWorkflowJob.value
    ? "bg-[var(--status-info-bg)] text-[var(--status-info)]"
    : toolStatusClass(props.toolCall));
const displayedStatusIcon = computed(() => isStartedWorkflowJob.value
    ? "i-lucide-briefcase-business"
    : toolStatusIcon(props.toolCall));

/** 尝试将 args 解析为 JSON 对象，失败返回 null。 */
const parsedArgs = computed<unknown | null>(() => {
    try {
        const raw = props.toolCall.argsJson ?? props.toolCall.argsText;
        if (!raw) return null;
        return JSON.parse(raw);
    } catch {
        return null;
    }
});

/** 尝试将 result 解析为 JSON 对象，失败返回 null。 */
const parsedResult = computed<unknown | null>(() => {
    try {
        if (!props.toolCall.result) return null;
        return JSON.parse(props.toolCall.result);
    } catch {
        return null;
    }
});
</script>

<template>
    <!-- 009C1R 必修A：收起态降为过程行（灰色小字+图标+一行摘要），展开才成卡片细节 -->
    <div v-if="renderConfig.mode !== 'hidden'" class="w-full">
        <!-- 过程行：点击切换展开 -->
        <button
            v-if="!props.expanded"
            class="flex w-full items-center gap-1.5 rounded px-0.5 py-0.5 text-left text-[11px] text-[var(--text-muted)] transition-colors hover:text-[var(--text-secondary)]"
            @click="emit('toggle')"
        >
            <span class="i-lucide-chevron-right h-3 w-3 shrink-0"></span>
            <span :class="[displayedStatusIcon, rowIconClass, isRunning ? 'animate-pulse' : '']" class="h-3 w-3 shrink-0"></span>
            <span class="shrink-0 font-mono">{{ props.toolCall.name }}</span>
            <span v-if="rowSummary" class="min-w-0 flex-1 truncate opacity-75">{{ rowSummary }}</span>
        </button>
        <!-- 展开态头部：卡片头部（点击收起） -->
        <button v-else class="flex w-full items-center gap-1.5 rounded px-0.5 py-0.5 text-left text-[11px] text-[var(--text-muted)] transition-colors hover:text-[var(--text-secondary)]" @click="emit('toggle')">
            <span class="i-lucide-chevron-down h-3 w-3 shrink-0"></span>
            <span :class="[displayedStatusIcon, rowIconClass, isRunning ? 'animate-pulse' : '']" class="h-3 w-3 shrink-0"></span>
            <span class="shrink-0 font-mono">{{ props.toolCall.name }}</span>
            <span v-if="collapsedPreview" class="min-w-0 flex-1 truncate opacity-75">{{ collapsedPreview }}</span>
        </button>

        <!-- 展开内容区域 -->
        <div v-if="props.expanded" class="mt-0.5 ml-3 border-l-2 border-[var(--border-color)]/50 pl-3 pb-1">
            <!-- block 模式：使用注册表声明的专用组件 -->
            <component :is="renderConfig.component" v-if="renderConfig.mode === 'block' && renderConfig.component" :tool-call="props.toolCall" />

            <!-- 默认 Tool 渲染 -->
            <template v-else>
                <div class="mt-2 space-y-2 overflow-y-auto max-h-[500px] pr-1">
                    <!-- Arguments：优先用 JsonViewer，fallback 到纯文本 -->
                    <div>
                        <div class="mb-1 text-[9px] uppercase tracking-[0.24em] text-[var(--text-muted)]">Arguments</div>
                        <JsonViewer v-if="parsedArgs !== null" :value="parsedArgs" :max-height="300" />
                        <div v-else class="break-all whitespace-pre-wrap rounded border border-[var(--border-color)] bg-[var(--bg-main)] p-2 font-mono text-xs text-[var(--text-secondary)]">
                            {{ props.toolCall.argsJson ?? props.toolCall.argsText }}
                        </div>
                    </div>
                    <!-- Result：优先用 JsonViewer，fallback 到纯文本 -->
                    <div v-if="props.toolCall.result">
                        <div class="mb-1 text-[9px] uppercase tracking-[0.24em] text-[var(--text-muted)]">Result</div>
                        <JsonViewer v-if="parsedResult !== null" :value="parsedResult" :max-height="300" />
                        <div v-else class="break-all whitespace-pre-wrap rounded border border-[var(--border-color)] bg-[var(--bg-main)] p-2 font-mono text-xs text-[var(--text-secondary)]">
                            {{ props.toolCall.result }}
                        </div>
                    </div>
                    <div v-if="props.toolCall.error">
                        <div class="mb-1 text-[9px] uppercase tracking-[0.24em] text-[var(--text-muted)]">Error</div>
                        <div class="break-all whitespace-pre-wrap rounded border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] p-2 font-mono text-xs text-[var(--status-danger)]">
                            {{ props.toolCall.error }}
                        </div>
                    </div>
                </div>
                <div class="mt-2 flex items-center justify-start gap-1 text-[var(--text-muted)]">
                    <button class="rounded p-1 transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-main)]" :title="t('agent.textBubble.copy')" @click="emit('copy')">
                        <span class="i-lucide-copy h-3.5 w-3.5"></span>
                    </button>
                </div>
            </template>
        </div>
    </div>
</template>
