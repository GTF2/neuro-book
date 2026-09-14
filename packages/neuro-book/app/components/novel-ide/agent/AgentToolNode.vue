<script setup lang="ts">
import type { AgentToolCall } from "nbook/app/components/novel-ide/agent/agent-message";
import { resolveToolRenderConfig } from "nbook/app/components/novel-ide/agent/tool-render-registry";
import { FILE_EDIT_TOOL_NAMES, toolStatusClass, toolStatusIcon } from "nbook/app/components/novel-ide/agent/agent-message";
import JsonViewer from "nbook/app/components/common/JsonViewer.vue";
import { resolveApiErrorMessage } from "nbook/app/utils/api-error";

const props = defineProps<{
    toolCall: AgentToolCall;
    expanded: boolean;
    /** 旁路解释需要它定位 session 的模型配置；缺失时不显示解释入口。 */
    sessionId?: number | null;
    /** 会话正在跑或正在写入时禁用重跑类动作。 */
    actionDisabled?: boolean;
    runActionDisabled?: boolean;
}>();

const emit = defineEmits<{
    (e: "toggle"): void;
    (e: "copy"): void;
    /** 重跑这条消息：由上层 moveTree 到该消息之前再 continue。 */
    (e: "retry"): void;
    /** 把「跳过此次编辑」填进输入框，由用户确认后再发送。 */
    (e: "skip-edit"): void;
}>();

const renderConfig = computed(() => resolveToolRenderConfig(props.toolCall));
const {t, locale} = useI18n();
const agentApi = useAgentSessionApi();

/**
 * 按需解释：默认一个 token 都不花，点一次才发一次旁路调用。
 * 结果只留在本组件的局部状态里，不写会话历史、也不会回流进主对话。
 */
const explanation = ref("");
const explaining = ref(false);
const explainError = ref("");

/** 解释要有一个 session 作为模型配置来源；没有 session 就不显示入口，避免点了必然失败。 */
const canExplain = computed(() => Boolean(props.sessionId));

const requestExplanation = async (): Promise<void> => {
    const sessionId = props.sessionId;
    if (!sessionId || explaining.value) {
        return;
    }
    explaining.value = true;
    explainError.value = "";
    try {
        const result = await agentApi.explainToolCall(sessionId, {
            toolName: props.toolCall.name,
            argsText: props.toolCall.argsJson ?? props.toolCall.argsText ?? null,
            resultText: props.toolCall.result ?? null,
            errorText: props.toolCall.error ?? null,
            locale: locale.value === "en-US" ? "en-US" : "zh-CN",
        });
        explanation.value = result.explanation;
    } catch (error) {
        explainError.value = resolveApiErrorMessage(error, t("agent.tool.explainFailed"));
    } finally {
        explaining.value = false;
    }
};

const isRunning = computed(() => props.toolCall.status === "running" || props.toolCall.status === "streaming");
const collapsedPreview = computed(() => renderConfig.value.collapsedPreviewKey ? t(renderConfig.value.collapsedPreviewKey) : renderConfig.value.collapsedPreview);
/** 后台 workflow 的 tool success 只表示 job 已登记，头部不得显示成 workflow 完成。 */
const isStartedWorkflowJob = computed(() => {
    const details = props.toolCall.resultData;
    if (props.toolCall.name !== "run_workflow" || !details || typeof details !== "object" || Array.isArray(details)) {
        return false;
    }
    return details.status === "started";
});
/** 统一换成「未写入」语义：file-warning 图标 + 琥珀色，与卡片内的琥珀警告条一致。 */
const isFileEditFailure = computed(() => (props.toolCall.status === "error" || props.toolCall.status === "invalid")
    && FILE_EDIT_TOOL_NAMES.has(props.toolCall.name));
const fileEditFailureLabel = computed(() => {
    if (props.toolCall.interrupted) {
        return t("agent.tool.outcomeUnknownTitle");
    }
    switch (props.toolCall.name) {
        case "edit":
            return t("agent.tool.editFailedTitle");
        case "write":
            return t("agent.tool.writeFailedTitle");
        case "apply_patch":
            return t("agent.tool.patchFailedTitle");
        default:
            return "";
    }
});

const displayedStatusClass = computed(() => {
    if (isStartedWorkflowJob.value) {
        return "bg-[var(--status-info-bg)] text-[var(--status-info)]";
    }
    return isFileEditFailure.value
        ? "bg-[var(--status-warning-bg)] text-[var(--status-warning)]"
        : toolStatusClass(props.toolCall);
});
const displayedStatusIcon = computed(() => {
    if (isStartedWorkflowJob.value) {
        return "i-lucide-briefcase-business";
    }
    return isFileEditFailure.value ? "i-lucide-file-warning" : toolStatusIcon(props.toolCall);
});

/** edit 预检失败汇总 pill：常驻头部，保证失败零点击可见（不依赖展开态）。 */
const editFailurePill = computed(() => {
    const details = props.toolCall.publicResult?.details;
    if (props.toolCall.name !== "edit" || details?.kind !== "edit_failure") {
        return "";
    }
    return t("agent.tool.editFailedPill", {failed: details.failures.length, total: details.totalEdits});
});
/**
 * 结构化详情缺失（多为本次改造之前的记录）或结果因中断而丢失时，仍要在头部给出结论：
 * 前者是「未写入」，后者只能是「结果未知」。
 */
const fileEditFailurePill = computed(() => {
    if (editFailurePill.value) {
        return editFailurePill.value;
    }
    if (!isFileEditFailure.value) {
        return "";
    }
    return props.toolCall.interrupted
        ? t("agent.tool.outcomeUnknownPill")
        : t("agent.tool.fileNotAppliedPill");
});
/** 标题人化：优先用 i18n 的「这步在干什么」，工具名本身降为灰色小标签。 */
const humanTypeLabel = computed(() => renderConfig.value.typeLabelKey
    ? t(renderConfig.value.typeLabelKey)
    : renderConfig.value.typeLabel);
/** 失败态用「未写入」结论替换 tool 类型标签，先给结论再给细节。 */
const displayedTypeLabel = computed(() => isFileEditFailure.value
    ? fileEditFailureLabel.value
    : humanTypeLabel.value);

/** 兜底卡片的关键字段摘要：只取顶层的标量字段，避免把整包 JSON 怼到用户脸上。 */
const MAX_SUMMARY_FACTS = 4;
const argFacts = computed<Array<{label: string; value: string}>>(() => {
    const parsed = parsedArgs.value;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return [];
    }
    return Object.entries(parsed as Record<string, unknown>)
        .filter(([, value]) => typeof value === "string" || typeof value === "number" || typeof value === "boolean")
        .slice(0, MAX_SUMMARY_FACTS)
        .map(([label, value]) => ({label, value: String(value)}));
});

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

/** 重跑/跳过都会改写会话历史，运行中与写入中一律禁用。 */
const isActionDisabled = computed(() => Boolean(props.actionDisabled) || Boolean(props.runActionDisabled));

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
    <div v-if="renderConfig.mode !== 'hidden'" class="w-full overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--chat-ai-bg)] shadow-sm">
        <!-- 容器头部：点击切换展开 -->
        <button class="flex w-full items-center justify-between px-3 py-1.5 text-left transition-colors hover:bg-[var(--bg-hover)]" @click="emit('toggle')">
            <div class="flex min-w-0 items-center gap-2.5 overflow-hidden">
                <div class="flex h-5 w-5 shrink-0 items-center justify-center rounded" :class="displayedStatusClass">
                    <span :class="[displayedStatusIcon, isRunning ? 'animate-spin' : '']" class="h-3 w-3"></span>
                </div>
                <!-- 紧凑单行：人化标题在前，工具名降为灰色小标签 -->
                <div class="flex min-w-0 items-center gap-2">
                    <span class="shrink-0 text-xs font-medium text-[var(--text-main)]">{{ displayedTypeLabel }}</span>
                    <span class="truncate font-mono text-[10px] text-[var(--text-muted)] shrink-0">{{ props.toolCall.name }}</span>
                    <span v-if="!props.expanded && renderConfig.mode === 'inline'" class="truncate font-mono text-[11px] text-[var(--text-muted)] opacity-80 min-w-0">
                        {{ props.toolCall.argsJson ?? props.toolCall.argsText }}
                    </span>
                    <span v-else-if="!props.expanded && !fileEditFailurePill && collapsedPreview" class="truncate font-mono text-[11px] text-[var(--text-muted)] opacity-80 min-w-0">
                        {{ collapsedPreview }}
                    </span>
                </div>
            </div>
            <span class="ml-2 flex shrink-0 items-center gap-1.5">
                <span v-if="fileEditFailurePill" class="rounded border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-1.5 py-0.5 text-[10px] font-medium leading-none text-[var(--status-warning)]">{{ fileEditFailurePill }}</span>
                <span :class="props.expanded ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" class="h-4 w-4 text-[var(--text-muted)]"></span>
            </span>
        </button>

        <!-- 展开内容区域 -->
        <div v-if="props.expanded" class="border-t border-[var(--border-color)]/50 bg-[var(--bg-input)]/50 px-3 pb-3 pt-1">
            <!-- block 模式：使用注册表声明的专用组件 -->
            <component :is="renderConfig.component" v-if="renderConfig.mode === 'block' && renderConfig.component" :tool-call="props.toolCall" />

            <!-- 兜底 Tool 渲染：先给关键字段摘要，原始 JSON 全部收进折叠区 -->
            <template v-else>
                <div class="mt-2 space-y-2 overflow-y-auto max-h-[500px] pr-1">
                    <div v-if="argFacts.length > 0" class="flex flex-wrap items-center gap-1.5">
                        <span
                            v-for="fact in argFacts"
                            :key="fact.label"
                            class="inline-flex max-w-full items-center gap-1 rounded border border-[var(--border-color)] bg-[var(--bg-panel)] px-2 py-0.5 text-[11px]"
                        >
                            <span class="text-[var(--text-muted)]">{{ fact.label }}</span>
                            <span class="truncate font-medium text-[var(--text-main)]">{{ fact.value }}</span>
                        </span>
                    </div>

                    <details v-if="props.toolCall.argsJson ?? props.toolCall.argsText" class="rounded-lg border border-[var(--border-color)] bg-[var(--bg-panel)]">
                        <summary class="cursor-pointer px-3 py-2 text-xs text-[var(--text-secondary)]">{{ t("agent.tool.rawArgs") }}</summary>
                        <div class="border-t border-[var(--border-color)]/60 p-2">
                            <JsonViewer v-if="parsedArgs !== null" :value="parsedArgs" :max-height="300" />
                            <div v-else class="break-all whitespace-pre-wrap rounded border border-[var(--border-color)] bg-[var(--bg-main)] p-2 font-mono text-xs text-[var(--text-secondary)]">
                                {{ props.toolCall.argsJson ?? props.toolCall.argsText }}
                            </div>
                        </div>
                    </details>

                    <!-- 错误态下 result 与 error 同值，避免报错渲染两遍 -->
                    <details v-if="props.toolCall.result && props.toolCall.result !== props.toolCall.error" class="rounded-lg border border-[var(--border-color)] bg-[var(--bg-panel)]">
                        <summary class="cursor-pointer px-3 py-2 text-xs text-[var(--text-secondary)]">{{ t("agent.tool.rawResult") }}</summary>
                        <div class="border-t border-[var(--border-color)]/60 p-2">
                            <JsonViewer v-if="parsedResult !== null" :value="parsedResult" :max-height="300" />
                            <div v-else class="break-all whitespace-pre-wrap rounded border border-[var(--border-color)] bg-[var(--bg-main)] p-2 font-mono text-xs text-[var(--text-secondary)]">
                                {{ props.toolCall.result }}
                            </div>
                        </div>
                    </details>

                    <div v-if="props.toolCall.error">
                        <div class="mb-1 text-[9px] uppercase tracking-[0.24em] text-[var(--text-muted)]">{{ t("agent.tool.errorLabel") }}</div>
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

            <!-- 失败出口：只给写文件类失败卡片，成功态不该出现重跑按钮 -->
            <div v-if="isFileEditFailure" class="mt-3">
                <div class="flex flex-wrap items-center gap-2">
                    <button
                        class="inline-flex h-7 items-center gap-1 rounded-md bg-[var(--accent-bg)] px-2.5 text-[11.5px] text-[var(--accent-text)] transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
                        :disabled="isActionDisabled"
                        :title="t('agent.tool.editRetryHint')"
                        @click="emit('retry')"
                    >
                        <span class="i-lucide-rotate-cw h-3 w-3"></span>{{ t("agent.tool.editRetry") }}
                    </button>
                    <button
                        class="inline-flex h-7 items-center gap-1 rounded-md border border-[var(--border-color)] bg-[var(--bg-panel)] px-2.5 text-[11.5px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] disabled:cursor-not-allowed disabled:opacity-40"
                        :disabled="isActionDisabled"
                        :title="t('agent.tool.editSkipPrefill')"
                        @click="emit('skip-edit')"
                    >
                        <span class="i-lucide-step-forward h-3 w-3"></span>{{ t("agent.tool.editSkip") }}
                    </button>
                </div>
                <div class="mt-1 text-[10.5px] text-[var(--text-muted)]">{{ t("agent.tool.editRetryHint") }}</div>
            </div>

            <!-- 按需 AI 解释：默认不请求，点了才发一次旁路调用，结果就地渲染 -->
            <div v-if="canExplain" class="mt-3">
                <button
                    v-if="!explanation && !explaining"
                    type="button"
                    class="inline-flex h-7 items-center gap-1 rounded-md border border-dashed border-[var(--border-color)] px-2.5 text-[11.5px] text-[var(--text-muted)] transition-colors hover:border-[var(--accent-main)] hover:text-[var(--accent-main)]"
                    :disabled="isActionDisabled"
                    @click="requestExplanation"
                >
                    <span class="i-lucide-sparkles h-3 w-3"></span>{{ t("agent.tool.explainStep") }}
                </button>

                <div v-else-if="explaining" class="inline-flex h-7 items-center gap-1.5 rounded-md border border-dashed border-[var(--border-color)] px-2.5 text-[11.5px] text-[var(--text-muted)]">
                    <span class="i-lucide-loader-circle h-3 w-3 animate-spin"></span>{{ t("agent.tool.explaining") }}
                </div>

                <div v-else class="rounded-lg border border-[var(--status-info-border)] bg-[var(--status-info-bg)] px-3 py-2">
                    <div class="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-[var(--status-info)]">
                        <span class="i-lucide-sparkles h-3 w-3"></span>{{ t("agent.tool.explainTitle") }}
                        <button
                            type="button"
                            class="ml-auto rounded p-0.5 transition-colors hover:bg-[var(--bg-hover)]"
                            :title="t('agent.tool.explainAgain')"
                            @click="requestExplanation"
                        >
                            <span class="i-lucide-rotate-cw h-3 w-3"></span>
                        </button>
                    </div>
                    <p class="whitespace-pre-wrap text-[12px] leading-5 text-[var(--status-info)]">{{ explanation }}</p>
                </div>

                <div v-if="explainError" class="mt-1 text-[11px] text-[var(--status-danger)]">{{ explainError }}</div>
            </div>
        </div>
    </div>
</template>
