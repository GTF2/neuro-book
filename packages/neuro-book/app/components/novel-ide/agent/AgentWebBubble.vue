<script setup lang="ts">
import { computed } from "vue";
import { parseToolArgsObject } from "nbook/app/components/novel-ide/agent/tool-args-stream";
import type { AgentToolCall } from "nbook/app/components/novel-ide/agent/agent-message";

const props = defineProps<{
    toolCall: AgentToolCall;
}>();
const { t } = useI18n();

interface WebArgs {
    query?: string;
    url?: string;
}

interface WebResult {
    query?: string;
    url?: string;
    finalUrl?: string;
    title?: string;
    results?: unknown[];
    content?: string;
    contentType?: string;
    truncated?: boolean;
}

const isSearch = computed(() => props.toolCall.name === "web_search");

const args = computed(() => parseToolArgsObject<WebArgs>(props.toolCall.argsJson ?? props.toolCall.argsText) ?? {});

const result = computed<WebResult | null>(() => {
    const raw = props.toolCall.result?.trim();
    if (!raw) {
        return null;
    }
    try {
        const parsed = JSON.parse(raw) as unknown;
        return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as WebResult : null;
    } catch {
        return null;
    }
});

/** 结论先行：搜索给条数，抓取给标题。 */
const headline = computed(() => {
    const data = result.value;
    if (!data) {
        return "";
    }
    if (isSearch.value) {
        return t("agent.tool.webResultCount", { count: data.results?.length ?? 0 });
    }
    return data.title?.trim() ?? "";
});

const target = computed(() => {
    const data = result.value;
    return isSearch.value
        ? data?.query ?? args.value.query ?? ""
        : data?.finalUrl ?? data?.url ?? args.value.url ?? "";
});

const facts = computed(() => {
    const data = result.value;
    if (!data) {
        return [];
    }
    const items: Array<{ label: string; value: string }> = [];
    if (!isSearch.value && data.contentType) {
        items.push({ label: "Content-Type", value: data.contentType });
    }
    if (!isSearch.value && typeof data.content === "string") {
        items.push({ label: t("agent.tool.commandOutputFull"), value: `${String(data.content.length)} 字符` });
    }
    return items;
});
</script>

<template>
    <div class="mt-2 space-y-2">
        <div v-if="target" class="flex items-start gap-1.5 break-all text-[11.5px] text-[var(--text-secondary)]">
            <span class="shrink-0 text-[var(--text-muted)]">{{ isSearch ? t("agent.tool.webQuery") : t("agent.tool.webUrl") }}</span>
            <span class="font-mono text-[var(--text-main)]">{{ target }}</span>
        </div>

        <div v-if="headline" class="flex items-center gap-1.5 text-[11.5px] font-medium text-[var(--status-success)]">
            <span :class="isSearch ? 'i-lucide-search' : 'i-lucide-globe'" class="h-3.5 w-3.5"></span>
            {{ headline }}
        </div>

        <div v-if="facts.length > 0" class="flex flex-wrap items-center gap-1.5">
            <span
                v-for="fact in facts"
                :key="fact.label"
                class="inline-flex items-center gap-1 rounded border border-[var(--border-color)] bg-[var(--bg-panel)] px-2 py-0.5 text-[11px] text-[var(--text-secondary)]"
            >
                <span class="text-[var(--text-muted)]">{{ fact.label }}</span>
                <span class="font-medium text-[var(--text-main)]">{{ fact.value }}</span>
            </span>
        </div>

        <details v-if="props.toolCall.result" class="rounded-lg border border-[var(--border-color)] bg-[var(--bg-panel)]">
            <summary class="cursor-pointer px-3 py-2 text-xs text-[var(--text-secondary)]">{{ t("agent.tool.rawResult") }}</summary>
            <pre class="max-h-64 overflow-auto whitespace-pre-wrap break-all border-t border-[var(--border-color)]/60 p-2.5 font-mono text-[11.5px] text-[var(--text-secondary)]">{{ props.toolCall.result }}</pre>
        </details>
    </div>
</template>
