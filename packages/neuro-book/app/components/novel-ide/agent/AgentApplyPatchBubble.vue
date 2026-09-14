<script setup lang="ts">
import { computed } from "vue";
import {formatByteCount, type AgentToolCall} from "nbook/app/components/novel-ide/agent/agent-message";
import {parseToolArgsObject} from "nbook/app/components/novel-ide/agent/tool-args-stream";

const props = defineProps<{
    toolCall: AgentToolCall;
}>();
const {t} = useI18n();

interface ApplyPatchArgs {
    path?: string;
    patch?: string;
}

/** apply_patch 的 patch 文本通常较长，需要优先展示已解析出的 patch 内容。 */
const parsedArgs = computed<ApplyPatchArgs>(() => {
    const parsed = parseToolArgsObject<ApplyPatchArgs>(props.toolCall.argsJson ?? props.toolCall.argsText);
    return parsed ?? {};
});

const publicArgs = computed(() => props.toolCall.publicArgs?.kind === "apply_patch" ? props.toolCall.publicArgs : null);
const patchText = computed(() => publicArgs.value?.patchPreview ?? parsedArgs.value.patch ?? props.toolCall.argsText ?? "");
const touchedFiles = computed(() => {
    if (publicArgs.value?.touchedFiles.length) {
        return publicArgs.value.touchedFiles;
    }
    const files: string[] = [];
    for (const line of patchText.value.split(/\r?\n/)) {
        if (line.startsWith("*** Add File: ")) {
            files.push(line.slice("*** Add File: ".length).trim());
        }
        if (line.startsWith("*** Update File: ")) {
            files.push(line.slice("*** Update File: ".length).trim());
        }
        if (line.startsWith("*** Delete File: ")) {
            files.push(line.slice("*** Delete File: ".length).trim());
        }
    }
    if (files.length === 0 && parsedArgs.value.path) {
        files.push(parsedArgs.value.path);
    }
    return files;
});
const previewNotice = computed(() => publicArgs.value?.patchOmitted
    ? `仅显示预览 · 原 patch ${formatByteCount(publicArgs.value.patchBytes)}`
    : "");
const diffDetails = computed(() => props.toolCall.publicResult?.details?.kind === "file_change"
    ? props.toolCall.publicResult.details
    : null);

/** 补丁失败：下面的 patch 只是「打算打的内容」，必须先声明没有应用。 */
const patchFailed = computed(() => props.toolCall.status === "error" || props.toolCall.status === "invalid");
/** 中断导致的 error 不能断言「未应用」：结果其实未知。 */
const patchFailureBannerHead = computed(() => props.toolCall.interrupted
    ? t("agent.tool.outcomeUnknownTitle")
    : t("agent.tool.fileNotWrittenBanner"));
const patchFailureBannerBody = computed(() => props.toolCall.interrupted
    ? t("agent.tool.outcomeUnknownBannerBody")
    : t("agent.tool.patchFailureBanner"));
</script>

<template>
    <div class="mt-2 space-y-3">
        <!-- Tool 目标路径 -->
        <div class="flex flex-wrap items-center gap-2">
            <span v-for="filePath in touchedFiles" :key="filePath" class="rounded border border-[var(--accent-main)]/30 bg-[var(--bg-main)] px-2 py-1 font-mono text-[11px] text-[var(--accent-main)]">
                <span class="mr-1 inline-block h-3 w-3 align-text-bottom i-lucide-file-diff"></span>
                {{ filePath }}
            </span>
            <span v-if="touchedFiles.length === 0" class="rounded border border-[var(--accent-main)]/30 bg-[var(--bg-main)] px-2 py-1 font-mono text-[11px] text-[var(--accent-main)]">{{ t("agent.tool.resolvingPath") }}</span>
        </div>

        <!-- 补丁失败：先声明未应用，避免下面的 patch 预览被读成已经打进去了 -->
        <div v-if="patchFailed" class="rounded-lg border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-3 py-2 text-[12.5px] text-[var(--status-warning)]">
            <span class="i-lucide-triangle-alert mr-1 inline-block h-3.5 w-3.5 align-text-bottom"></span>
            <b class="font-semibold">{{ patchFailureBannerHead }}</b>：{{ patchFailureBannerBody }}
        </div>

        <!-- Patch Preview -->
        <div class="rounded border border-[var(--border-color)] bg-[var(--bg-main)]/60">
            <div class="border-b border-[var(--border-color)]/50 px-2 py-1 text-[10px] uppercase tracking-[0.24em] text-[var(--text-muted)]">Patch</div>
            <pre class="max-h-64 overflow-y-auto whitespace-pre-wrap break-all p-3 font-mono text-xs text-[var(--text-secondary)]">{{ patchText || "..." }}</pre>
            <div v-if="previewNotice" class="px-3 pb-3 text-[11px] text-[var(--status-info)]">{{ previewNotice }}</div>
        </div>

        <div v-if="diffDetails?.diffPreview" class="rounded border border-[var(--border-color)] bg-[var(--bg-panel)]">
            <div class="border-b border-[var(--border-color)]/50 px-2 py-1 text-[10px] uppercase text-[var(--text-muted)]">Applied Diff</div>
            <pre class="max-h-48 overflow-y-auto whitespace-pre-wrap break-all p-2 font-mono text-xs text-[var(--text-secondary)]">{{ diffDetails.diffPreview }}</pre>
            <div v-if="diffDetails.diffOmitted" class="px-2 pb-2 text-[11px] text-[var(--status-info)]">{{ t("agent.tool.diffOmitted", {size: formatByteCount(diffDetails.diffBytes)}) }}</div>
        </div>

        <!-- 失败态把原始报错降级为技术详情，避免与琥珀警告条重复 -->
        <details v-if="patchFailed && props.toolCall.error" class="rounded-lg border border-[var(--border-color)] bg-[var(--bg-panel)]">
            <summary class="cursor-pointer px-3 py-2 text-xs text-[var(--text-secondary)]">{{ t("agent.tool.editTechDetails") }}</summary>
            <pre class="overflow-x-auto whitespace-pre-wrap break-all border-t border-[var(--border-color)]/60 p-2.5 font-mono text-[11.5px] text-[var(--text-secondary)]">{{ props.toolCall.error }}</pre>
        </details>
        <div v-else-if="props.toolCall.error" class="mt-2 break-all whitespace-pre-wrap rounded border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] p-2 font-mono text-xs text-[var(--status-danger)]">
            {{ props.toolCall.error }}
        </div>

        <div v-if="props.toolCall.status === 'success'" class="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-[var(--status-success)]">
            <span class="i-lucide-check-circle h-3.5 w-3.5"></span>
            {{ t("agent.tool.patchApplied") }}
        </div>
    </div>
</template>
