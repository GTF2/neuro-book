<script setup lang="ts">
import { computed } from "vue";
import { parseToolArgsObject } from "nbook/app/components/novel-ide/agent/tool-args-stream";
import type { AgentToolCall } from "nbook/app/components/novel-ide/agent/agent-message";

const props = defineProps<{
    toolCall: AgentToolCall;
}>();
const { t } = useI18n();

interface BashArgs {
    command?: string;
}

/** bash 结果：前台为 exitCode/output，后台为 jobId/status。 */
interface BashResult {
    exitCode?: number;
    output?: string;
    jobId?: string;
    status?: string;
    background?: boolean;
}

/** 输出默认只露末尾 N 行，完整输出收进折叠区。 */
const TAIL_LINE_COUNT = 20;

const commandText = computed(() => {
    const parsed = parseToolArgsObject<BashArgs>(props.toolCall.argsJson ?? props.toolCall.argsText);
    return parsed?.command?.trim() ?? "";
});

const result = computed<BashResult | null>(() => {
    const raw = props.toolCall.result?.trim();
    if (!raw) {
        return null;
    }
    try {
        const parsed = JSON.parse(raw) as unknown;
        return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as BashResult : null;
    } catch {
        return null;
    }
});

const isBackground = computed(() => Boolean(result.value?.jobId) || result.value?.background === true);
const exitCode = computed(() => result.value?.exitCode);
const hasFailed = computed(() => typeof exitCode.value === "number" && exitCode.value !== 0);

const outputText = computed(() => result.value?.output ?? "");
const outputLines = computed(() => outputText.value.length === 0 ? [] : outputText.value.split("\n"));
const isTailTruncated = computed(() => outputLines.value.length > TAIL_LINE_COUNT);
const tailText = computed(() => isTailTruncated.value
    ? outputLines.value.slice(-TAIL_LINE_COUNT).join("\n")
    : outputText.value);
</script>

<template>
    <div class="mt-2 space-y-2">
        <div v-if="commandText" class="overflow-hidden rounded-lg border border-[var(--border-color)] bg-[var(--bg-main)]">
            <div class="border-b border-[var(--border-color)]/50 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">COMMAND</div>
            <pre class="max-h-32 overflow-auto whitespace-pre-wrap break-all p-2 font-mono text-[11.5px] leading-5 text-[var(--text-main)]">{{ commandText }}</pre>
        </div>

        <div class="flex flex-wrap items-center gap-1.5">
            <span
                v-if="isBackground"
                class="inline-flex items-center gap-1 rounded border border-[var(--status-info-border)] bg-[var(--status-info-bg)] px-2 py-0.5 text-[11px] text-[var(--status-info)]"
            >
                <span class="i-lucide-loader-circle h-3 w-3"></span>{{ t("agent.tool.commandBackgroundStarted") }}
            </span>
            <span
                v-else-if="typeof exitCode === 'number'"
                class="inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px]"
                :class="hasFailed
                    ? 'border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger)]'
                    : 'border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success)]'"
            >
                <span :class="hasFailed ? 'i-lucide-x' : 'i-lucide-check'" class="h-3 w-3"></span>
                {{ t("agent.tool.commandExitCode", { code: exitCode }) }}
            </span>
        </div>

        <div v-if="tailText" class="overflow-hidden rounded-lg border border-[var(--border-color)] bg-[var(--bg-panel)]">
            <div class="flex items-center justify-between border-b border-[var(--border-color)]/50 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                <span>{{ isTailTruncated ? t("agent.tool.commandOutputTail", { count: TAIL_LINE_COUNT }) : "OUTPUT" }}</span>
            </div>
            <pre class="max-h-48 overflow-auto whitespace-pre-wrap break-all p-2 font-mono text-[11.5px] leading-5 text-[var(--text-secondary)]">{{ tailText }}</pre>
        </div>

        <details v-if="isTailTruncated" class="rounded-lg border border-[var(--border-color)] bg-[var(--bg-panel)]">
            <summary class="cursor-pointer px-3 py-2 text-xs text-[var(--text-secondary)]">{{ t("agent.tool.commandOutputFull") }}</summary>
            <pre class="max-h-64 overflow-auto whitespace-pre-wrap break-all border-t border-[var(--border-color)]/60 p-2.5 font-mono text-[11.5px] text-[var(--text-secondary)]">{{ outputText }}</pre>
        </details>

        <details v-if="props.toolCall.result" class="rounded-lg border border-[var(--border-color)] bg-[var(--bg-panel)]">
            <summary class="cursor-pointer px-3 py-2 text-xs text-[var(--text-secondary)]">{{ t("agent.tool.rawResult") }}</summary>
            <pre class="max-h-64 overflow-auto whitespace-pre-wrap break-all border-t border-[var(--border-color)]/60 p-2.5 font-mono text-[11.5px] text-[var(--text-secondary)]">{{ props.toolCall.result }}</pre>
        </details>
    </div>
</template>
