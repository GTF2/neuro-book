<script setup lang="ts">
import { computed } from "vue";
import { parseToolArgsObject } from "nbook/app/components/novel-ide/agent/tool-args-stream";
import type { AgentToolCall } from "nbook/app/components/novel-ide/agent/agent-message";

const props = defineProps<{
    toolCall: AgentToolCall;
}>();
const { t } = useI18n();

interface SqlArgs {
    sql?: string;
}

/** execute_sql 明细：mode/rowCount/effects 是内部字段，展示时全部翻译成人话。 */
interface SqlResult {
    mode?: "read" | "write";
    command?: string;
    rowCount?: number;
    rows?: unknown[];
    effects?: { refreshChapterTree?: boolean };
}

const sqlText = computed(() => {
    const parsed = parseToolArgsObject<SqlArgs>(props.toolCall.argsJson ?? props.toolCall.argsText);
    return parsed?.sql?.trim() ?? "";
});

const result = computed<SqlResult | null>(() => {
    const raw = props.toolCall.result?.trim();
    if (!raw) {
        return null;
    }
    try {
        const parsed = JSON.parse(raw) as unknown;
        return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as SqlResult : null;
    } catch {
        return null;
    }
});

/** 结论先行：写入看影响行数，读取看返回行数。 */
const headline = computed(() => {
    const data = result.value;
    if (!data) {
        return "";
    }
    const count = data.rowCount ?? 0;
    return data.mode === "write"
        ? `${t("agent.tool.sqlModeWrite")} · ${t("agent.tool.sqlRowsAffected", { count })}`
        : `${t("agent.tool.sqlModeRead")} · ${t("agent.tool.sqlRowsReturned", { count })}`;
});

const facts = computed(() => {
    const data = result.value;
    if (!data) {
        return [];
    }
    return [
        { label: t("agent.tool.sqlStatement"), value: (data.command ?? "").toUpperCase() },
        {
            label: t("agent.tool.sqlRefreshTree"),
            value: data.effects?.refreshChapterTree
                ? t("agent.tool.sqlRefreshTreeNeeded")
                : t("agent.tool.sqlRefreshTreeNotNeeded"),
            hint: t("agent.tool.sqlRefreshTreeHint"),
        },
    ].filter((item) => item.value);
});
</script>

<template>
    <div class="mt-2 space-y-2">
        <div v-if="headline" class="flex items-center gap-1.5 text-[11.5px] font-medium text-[var(--status-success)]">
            <span class="i-lucide-database h-3.5 w-3.5"></span>
            {{ headline }}
        </div>

        <div v-if="sqlText" class="overflow-hidden rounded-lg border border-[var(--border-color)] bg-[var(--bg-main)]">
            <div class="border-b border-[var(--border-color)]/50 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">SQL</div>
            <pre class="max-h-48 overflow-auto whitespace-pre-wrap break-all p-2 font-mono text-[11.5px] leading-5 text-[var(--text-main)]">{{ sqlText }}</pre>
        </div>

        <div v-if="facts.length > 0" class="flex flex-wrap items-center gap-1.5">
            <span
                v-for="fact in facts"
                :key="fact.label"
                class="inline-flex items-center gap-1 rounded border border-[var(--border-color)] bg-[var(--bg-panel)] px-2 py-0.5 text-[11px] text-[var(--text-secondary)]"
            >
                <span class="text-[var(--text-muted)]">{{ fact.label }}</span>
                <span class="font-medium text-[var(--text-main)]">{{ fact.value }}</span>
                <span v-if="fact.hint" class="i-lucide-info h-3 w-3 text-[var(--text-muted)]" :title="fact.hint"></span>
            </span>
        </div>

        <details v-if="props.toolCall.result" class="rounded-lg border border-[var(--border-color)] bg-[var(--bg-panel)]">
            <summary class="cursor-pointer px-3 py-2 text-xs text-[var(--text-secondary)]">{{ t("agent.tool.rawResult") }}</summary>
            <pre class="max-h-64 overflow-auto whitespace-pre-wrap break-all border-t border-[var(--border-color)]/60 p-2.5 font-mono text-[11.5px] text-[var(--text-secondary)]">{{ props.toolCall.result }}</pre>
        </details>
    </div>
</template>
