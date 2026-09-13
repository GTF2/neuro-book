<script setup lang="ts">
import { computed, ref } from "vue";
import {formatByteCount, type AgentToolCall} from "nbook/app/components/novel-ide/agent/agent-message";
import {
    extractStreamingStringField,
    parseToolArgsObject,
} from "nbook/app/components/novel-ide/agent/tool-args-stream";

const props = defineProps<{
    toolCall: AgentToolCall;
}>();
const {t} = useI18n();

interface EditFileArgs {
    path?: string;
    edits?: Array<{
        oldText?: string;
        newText?: string;
    }>;
}

/** edit_file 参数在流式阶段可能是半截 JSON，需要按字段兜底展示。 */
const parsedArgs = computed<EditFileArgs>(() => {
    const parsed = parseToolArgsObject<EditFileArgs>(props.toolCall.argsJson ?? props.toolCall.argsText);
    return parsed ?? {};
});

const publicArgs = computed(() => props.toolCall.publicArgs?.kind === "edit" ? props.toolCall.publicArgs : null);
const firstEdit = computed(() => parsedArgs.value.edits?.[0] ?? {});
const publicFirstEdit = computed(() => publicArgs.value?.edits[0]);
const filePathText = computed(() => publicArgs.value?.path ?? parsedArgs.value.path ?? extractStreamingStringField(props.toolCall.argsText, "path"));
const oldStringText = computed(() => publicFirstEdit.value?.oldTextPreview ?? firstEdit.value.oldText ?? extractStreamingStringField(props.toolCall.argsText, "oldText"));
const newStringText = computed(() => publicFirstEdit.value?.newTextPreview ?? firstEdit.value.newText ?? extractStreamingStringField(props.toolCall.argsText, "newText"));
const previewNotice = computed(() => {
    const edit = publicFirstEdit.value;
    if (!edit || (!edit.oldTextOmitted && !edit.newTextOmitted && (publicArgs.value?.omittedEdits ?? 0) === 0)) {
        return "";
    }
    return `仅显示预览 · old ${formatByteCount(edit.oldTextBytes)} / new ${formatByteCount(edit.newTextBytes)}`;
});
const diffDetails = computed(() => props.toolCall.publicResult?.details?.kind === "file_change"
    ? props.toolCall.publicResult.details
    : null);

const resultText = computed(() => props.toolCall.result?.trim() ?? "");

type EditFailureDetails = Extract<NonNullable<AgentToolCall["publicResult"]>["details"], {kind: "edit_failure"}>;
type EditFailureItem = EditFailureDetails["failures"][number];

/** 批量编辑预检失败后整体回滚的结构化详情；缺失时回落到原始报错展示。 */
const editFailure = computed<EditFailureDetails | null>(() => {
    const details = props.toolCall.publicResult?.details;
    return details?.kind === "edit_failure" ? details : null;
});

/**
 * 结构化详情缺失时（多为本次改造之前的记录）也要按失败处理：
 * 失败态的 old/new 预览只是「尝试写入的内容」，不声明未写入就会被读成已经改完了。
 */
const editFailed = computed(() => props.toolCall.status === "error" || props.toolCall.status === "invalid");
/** 中断导致的 error 不能断言「未写入」：结果其实未知。 */
const editFailureBannerHead = computed(() => props.toolCall.interrupted
    ? t("agent.tool.outcomeUnknownTitle")
    : t("agent.tool.fileNotWrittenBanner"));
const editFailureBannerBody = computed(() => props.toolCall.interrupted
    ? t("agent.tool.outcomeUnknownBannerBody")
    : t("agent.tool.editFailureBannerLegacy"));
const failureDiffVisible = ref(false);

const reasonTextOf = (failure: EditFailureItem): string => {
    switch (failure.reasonCode) {
        case "empty_old_text":
            return t("agent.tool.editReasonEmptyOldText");
        case "not_found":
            return t("agent.tool.editReasonNotFound");
        case "ambiguous":
            return t("agent.tool.editReasonAmbiguous", {
                lines: (failure.matchedLines ?? []).map((line) => t("agent.tool.editItemLine", {line})).join("、"),
            });
        case "overlap":
            return t("agent.tool.editReasonOverlap", {index: (failure.conflictIndex ?? 0) + 1});
        default:
            return "";
    }
};

/** 结论先行：取索引最小的失败项作为警告条与失败 diff 的主语。 */
const primaryFailure = computed<EditFailureItem | null>(() => {
    const failures = editFailure.value?.failures ?? [];
    return failures.length > 0
        ? failures.reduce((min, item) => item.index < min.index ? item : min)
        : null;
});

const bannerReason = computed(() => primaryFailure.value
    ? t("agent.tool.editFailureBannerReason", {
        index: primaryFailure.value.index + 1,
        reason: reasonTextOf(primaryFailure.value),
    })
    : "");

/** 按 edits 原始顺序（索引 1 起）铺开改动清单，失败项高亮、命中项标注行号。 */
const editList = computed(() => {
    const failure = editFailure.value;
    if (!failure) {
        return [];
    }
    const matchedByIndex = new Map(failure.matches.map((match) => [match.index, match]));
    const failedByIndex = new Map(failure.failures.map((item) => [item.index, item]));
    return Array.from({length: Math.max(0, failure.totalEdits)}, (_, index) => {
        const failed = failedByIndex.get(index);
        const matched = matchedByIndex.get(index);
        return {
            index,
            failed: Boolean(failed),
            reasonText: failed ? reasonTextOf(failed) : "",
            lineText: matched
                ? matched.startLine === matched.endLine
                    ? t("agent.tool.editItemLine", {line: matched.startLine})
                    : t("agent.tool.editItemRange", {start: matched.startLine, end: matched.endLine})
                : "",
        };
    });
});

/** 失败项的 old/new 文本优先取公开参数预览，历史数据缺失时回落到原始参数。 */
const failedChange = computed(() => {
    const failure = primaryFailure.value;
    if (!failure) {
        return null;
    }
    const publicEdit = publicArgs.value?.edits[failure.index];
    if (publicEdit) {
        return {
            oldText: publicEdit.oldTextPreview ?? "",
            newText: publicEdit.newTextPreview ?? "",
        };
    }
    const rawEdit = parsedArgs.value.edits?.[failure.index];
    return rawEdit
        ? {oldText: rawEdit.oldText ?? "", newText: rawEdit.newText ?? ""}
        : null;
});

/** 期望文本中最长的一行，用于与文件实际内容做差异比较。 */
const longestExpectedLine = (text: string): string => text
    .split("\n")
    .reduce((best, line) => line.trim().length > best.trim().length ? line : best, "")
    .trim();

const hint = computed(() => {
    const nearest = primaryFailure.value?.nearest;
    if (!nearest || nearest.text === undefined) {
        return null;
    }
    return {line: nearest.line, text: nearest.text};
});

/** 把文件实际行按「与期望文本的公共前后缀」切成三段，中间段落高亮。 */
const hintParts = computed(() => {
    const current = hint.value;
    if (!current) {
        return null;
    }
    const expected = longestExpectedLine(failedChange.value?.oldText ?? "");
    const actual = current.text;
    const trimmedActual = actual.trim();
    if (!expected || !trimmedActual) {
        return {before: actual, marked: "", after: ""};
    }
    let start = 0;
    const maxStart = Math.min(expected.length, trimmedActual.length);
    while (start < maxStart && expected[start] === trimmedActual[start]) {
        start++;
    }
    let end = 0;
    const maxEnd = Math.min(expected.length, trimmedActual.length) - start;
    while (end < maxEnd
        && expected[expected.length - 1 - end] === trimmedActual[trimmedActual.length - 1 - end]) {
        end++;
    }
    const markedEnd = trimmedActual.length - end;
    const offset = Math.max(0, actual.indexOf(trimmedActual));
    if (markedEnd <= start) {
        return {before: actual, marked: "", after: ""};
    }
    return {
        before: actual.slice(0, offset + start),
        marked: actual.slice(offset + start, offset + markedEnd),
        after: actual.slice(offset + markedEnd),
    };
});

/** 用「引号不一致 / 仅空格差异 / 近似但不一致」三类可读结论解释为什么匹配不上。 */
const hintNote = computed(() => {
    const current = hint.value;
    if (!current) {
        return "";
    }
    const expected = longestExpectedLine(failedChange.value?.oldText ?? "");
    const actual = current.text.trim();
    if (!expected || !actual || expected === actual) {
        return "";
    }
    const hasStraightQuote = (text: string): boolean => text.includes("\"") || text.includes("'");
    const hasCurlyQuote = (text: string): boolean => ["\u2018", "\u2019", "\u201c", "\u201d"].some((char) => text.includes(char));
    if ((hasStraightQuote(expected) && hasCurlyQuote(actual)) || (hasCurlyQuote(expected) && hasStraightQuote(actual))) {
        return t("agent.tool.editHintQuoteMismatch");
    }
    if (expected.replace(/\s+/gu, " ").trim() === actual.replace(/\s+/gu, " ").trim()) {
        return t("agent.tool.editHintWhitespaceMismatch");
    }
    return t("agent.tool.editHintGeneric", {line: current.line});
});
</script>

<template>
    <div class="mt-2 space-y-3">
        <!-- Tool 目标路径 -->
        <div class="flex flex-wrap items-center gap-2">
            <span class="rounded bg-[var(--bg-main)] px-2 py-1 font-mono text-[11px] text-[var(--accent-main)] border border-[var(--accent-main)]/30">
                <span class="i-lucide-file-edit h-3 w-3 mr-1 inline-block align-text-bottom"></span>
                {{ filePathText || t("agent.tool.resolvingPath") }}
            </span>
            <span v-if="editFailure" class="rounded border border-[var(--border-color)] bg-[var(--bg-panel)] px-2 py-1 font-mono text-[10px] text-[var(--text-muted)]">
                {{ t("agent.tool.editsCount", {count: editFailure.totalEdits}) }}
            </span>
            <span v-else-if="(parsedArgs.edits?.length ?? 0) > 1" class="rounded border border-[var(--border-color)] bg-[var(--bg-panel)] px-2 py-1 font-mono text-[10px] text-[var(--text-muted)]">{{ parsedArgs.edits?.length }} 处编辑</span>
            <span v-if="editFailure && editFailure.omittedFailures > 0" class="text-[10px] text-[var(--text-muted)]">
                {{ t("agent.tool.editOmittedItems", {count: editFailure.omittedFailures}) }}
            </span>
        </div>

        <!-- ================= 批量编辑失败：结论先行 ================= -->
        <template v-if="editFailure">
            <div v-if="primaryFailure" class="rounded-lg border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-3 py-2 text-[12.5px] text-[var(--status-warning)]">
                <span class="i-lucide-triangle-alert mr-1 inline-block h-3.5 w-3.5 align-text-bottom"></span>
                <b class="font-semibold">{{ t("agent.tool.editFailureBannerHead", {total: editFailure.totalEdits}) }}</b>：{{ bannerReason }}。{{ t("agent.tool.editFailureBannerTail") }}
            </div>

            <div>
                <div class="mb-1.5 text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">{{ t("agent.tool.editChangeList") }}</div>
                <div class="overflow-hidden rounded-lg border border-[var(--border-color)] bg-[var(--bg-panel)]">
                    <div
                        v-for="item in editList"
                        :key="item.index"
                        class="flex items-center gap-2 border-b border-[var(--border-color)]/40 px-3 py-1.5 text-[12.5px] last:border-b-0"
                        :class="item.failed ? 'bg-[var(--status-danger-bg)]' : ''"
                    >
                        <span
                            class="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                            :class="item.failed ? 'bg-[var(--status-danger-bg)] text-[var(--status-danger)]' : 'bg-[var(--status-success-bg)] text-[var(--status-success)]'"
                        >{{ item.failed ? "✕" : "✓" }}</span>
                        <span class="text-[var(--text-main)]">{{ t("agent.tool.editItemIndex", {index: item.index + 1}) }}</span>
                        <span v-if="item.lineText" class="font-mono text-[11px] text-[var(--text-muted)]">{{ item.lineText }}</span>
                        <span v-if="item.reasonText" class="font-semibold text-[var(--status-danger)]">{{ item.reasonText }}</span>
                    </div>
                </div>
            </div>

            <!-- 失败 diff：二级折叠，避免失败详情撑爆屏幕 -->
            <div v-if="failedChange">
                <button
                    class="flex items-center gap-1 rounded text-[11px] text-[var(--text-muted)] transition-colors hover:text-[var(--text-main)]"
                    @click="failureDiffVisible = !failureDiffVisible"
                >
                    <span :class="failureDiffVisible ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" class="h-3.5 w-3.5"></span>
                    {{ t("agent.tool.editFailDiffTitle") }}
                </button>
                <div v-if="failureDiffVisible" class="mt-2 rounded-[10px] border-[1.5px] border-dashed border-[var(--status-danger)] p-2.5">
                    <div class="mb-2 flex items-center gap-1 text-[11px] font-semibold text-[var(--status-danger)]">
                        <span class="i-lucide-x h-3 w-3"></span>
                        {{ primaryFailure ? t("agent.tool.editFailTag", {index: primaryFailure.index + 1, reason: reasonTextOf(primaryFailure)}) : "" }}
                    </div>
                    <div class="grid grid-cols-2 gap-2">
                        <div class="overflow-hidden rounded-lg border border-[var(--status-danger-border)]">
                            <div class="bg-[var(--status-danger-bg)] px-2.5 py-1 text-[10px] font-bold tracking-wider text-[var(--status-danger)]">{{ t("agent.tool.editOldString") }}</div>
                            <div class="max-h-40 overflow-y-auto whitespace-pre-wrap break-all bg-[var(--status-danger-bg)] p-2 font-mono text-xs leading-6 text-[var(--status-danger)] line-through opacity-80">{{ failedChange.oldText || "..." }}</div>
                        </div>
                        <div class="overflow-hidden rounded-lg border border-[var(--status-success-border)]">
                            <div class="bg-[var(--status-success-bg)] px-2.5 py-1 text-[10px] font-bold tracking-wider text-[var(--status-success)]">{{ t("agent.tool.editNewString") }}</div>
                            <div class="max-h-40 overflow-y-auto whitespace-pre-wrap break-all bg-[var(--status-success-bg)] p-2 font-mono text-xs leading-6 text-[var(--status-success)]">{{ failedChange.newText || "..." }}</div>
                        </div>
                    </div>
                    <div v-if="hint" class="mt-2.5 rounded-lg border border-[var(--status-info-border)] bg-[var(--status-info-bg)] px-3 py-2 text-xs text-[var(--status-info)]">
                        <div class="mb-1 flex items-center gap-1 font-semibold">
                            <span class="i-lucide-lightbulb h-3 w-3"></span>{{ t("agent.tool.editHintLabel") }}
                        </div>
                        <div class="break-all rounded-md border border-[var(--border-color)] bg-[var(--bg-panel)] px-2 py-1.5 font-mono text-[11.5px] text-[var(--text-main)]">
                            <span>{{ hintParts?.before }}</span><mark v-if="hintParts?.marked" class="rounded bg-[var(--status-warning-bg)] px-0.5 text-[var(--status-warning)]">{{ hintParts.marked }}</mark><span>{{ hintParts?.after }}</span>
                        </div>
                        <div v-if="hintNote" class="mt-1 text-[11.5px] opacity-80">{{ hintNote }}</div>
                    </div>
                    <div v-else class="mt-2.5 text-[11.5px] text-[var(--text-muted)]">{{ t("agent.tool.editHintNoContent") }}</div>
                </div>
            </div>

            <!-- 原始报错降级为技术详情，避免与失败卡片重复渲染 -->
            <details v-if="props.toolCall.error" class="rounded-lg border border-[var(--border-color)] bg-[var(--bg-panel)]">
                <summary class="cursor-pointer px-3 py-2 text-xs text-[var(--text-secondary)]">{{ t("agent.tool.editTechDetails") }}</summary>
                <pre class="overflow-x-auto whitespace-pre-wrap break-all border-t border-[var(--border-color)]/60 p-2.5 font-mono text-[11.5px] text-[var(--text-secondary)]">{{ props.toolCall.error }}</pre>
            </details>
        </template>

        <!-- ================= 常规（含未结构化失败）展示 ================= -->
        <template v-else>
            <!-- 未结构化失败（多为较早的记录）：先声明未写入，再展示尝试的改动 -->
            <div v-if="editFailed" class="rounded-lg border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-3 py-2 text-[12.5px] text-[var(--status-warning)]">
                <span class="i-lucide-triangle-alert mr-1 inline-block h-3.5 w-3.5 align-text-bottom"></span>
                <b class="font-semibold">{{ editFailureBannerHead }}</b>：{{ editFailureBannerBody }}
            </div>

            <!-- Diff 预览：old/new 都允许在半截 JSON 阶段逐步增长 -->
            <div class="grid grid-cols-2 gap-2 mt-2">
                <div class="rounded border border-[var(--border-color)] bg-[var(--status-danger-bg)]">
                    <div class="border-b border-[var(--border-color)]/50 px-2 py-1 text-[10px] uppercase text-[var(--status-danger)]">旧文本</div>
                    <div class="max-h-40 overflow-y-auto whitespace-pre-wrap p-2 font-mono text-xs text-[var(--status-danger)] line-through opacity-80">
                        {{ oldStringText || "..." }}
                    </div>
                </div>

                <div class="rounded border border-[var(--border-color)] bg-[var(--status-success-bg)]">
                    <div class="border-b border-[var(--border-color)]/50 px-2 py-1 text-[10px] uppercase text-[var(--status-success)]">新文本</div>
                    <div class="max-h-40 overflow-y-auto whitespace-pre-wrap p-2 font-mono text-xs text-[var(--status-success)]">
                        {{ newStringText || "..." }}
                    </div>
                </div>
            </div>
            <div v-if="previewNotice" class="text-[11px] text-[var(--status-info)]">{{ previewNotice }}</div>

            <div v-if="diffDetails?.diffPreview" class="rounded border border-[var(--border-color)] bg-[var(--bg-panel)]">
                <div class="border-b border-[var(--border-color)]/50 px-2 py-1 text-[10px] uppercase text-[var(--text-muted)]">差异预览</div>
                <pre class="max-h-48 overflow-y-auto whitespace-pre-wrap break-all p-2 font-mono text-xs text-[var(--text-secondary)]">{{ diffDetails.diffPreview }}</pre>
                <div v-if="diffDetails.diffOmitted" class="px-2 pb-2 text-[11px] text-[var(--status-info)]">仅显示预览 · 原 diff {{ formatByteCount(diffDetails.diffBytes) }}</div>
            </div>

            <!-- 失败态把原始报错降级为技术详情，与结构化失败卡片保持一致，避免与琥珀警告条重复 -->
            <details v-if="editFailed && props.toolCall.error" class="rounded-lg border border-[var(--border-color)] bg-[var(--bg-panel)]">
                <summary class="cursor-pointer px-3 py-2 text-xs text-[var(--text-secondary)]">{{ t("agent.tool.editTechDetails") }}</summary>
                <pre class="overflow-x-auto whitespace-pre-wrap break-all border-t border-[var(--border-color)]/60 p-2.5 font-mono text-[11.5px] text-[var(--text-secondary)]">{{ props.toolCall.error }}</pre>
            </details>
            <div v-else-if="props.toolCall.error" class="break-all whitespace-pre-wrap rounded border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] p-2 font-mono text-xs text-[var(--status-danger)]">
                {{ props.toolCall.error }}
            </div>

            <!-- 错误态下 result 与 error 同值，避免同一段报错渲染两遍 -->
            <div v-if="resultText && resultText !== props.toolCall.error" class="whitespace-pre-wrap rounded border border-[var(--border-color)] bg-[var(--bg-panel)] p-2 font-mono text-xs leading-5 text-[var(--text-secondary)]">
                {{ resultText }}
            </div>

            <div v-if="props.toolCall.status === 'success'" class="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-[var(--status-success)]">
                <span class="i-lucide-check-circle h-3.5 w-3.5"></span>
                {{ t("agent.tool.fileEdited") }}
            </div>
        </template>
    </div>
</template>
