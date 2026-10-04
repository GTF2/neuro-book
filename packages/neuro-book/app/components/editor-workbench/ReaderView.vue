<script setup lang="ts">
import {computed, onBeforeUnmount, onMounted, ref, watch} from "vue";
import DOMPurify from "dompurify";
import {renderMarkdown} from "nbook/app/utils/markdown/render";
import {splitMarkdownFrontmatter} from "nbook/shared/editor-workbench";
import type {EditorAction, EditorDocumentSnapshot, EditorDocumentTarget, EditorFlushResult, EditorViewHandle} from "./editor-view.types";

const props = defineProps<{
    document: EditorDocumentSnapshot;
    visible: boolean;
    viewInstanceId: string;
}>();
const emit = defineEmits<{
    save: [target: EditorDocumentTarget];
    focus: [target: EditorDocumentTarget, focused: boolean];
    ready: [handle: EditorViewHandle | null];
    actions: [target: EditorDocumentTarget, actions: readonly EditorAction[]];
}>();
const {t} = useI18n();

const root = ref<HTMLElement | null>(null);

/** 阅读视图只呈现正文：frontmatter 是元数据，不在稿面上读。 */
const body = computed(() => splitMarkdownFrontmatter(props.document.content).body);
const html = computed(() => renderMarkdown(body.value, (raw) => DOMPurify.sanitize(raw, {ADD_ATTR: ["target", "rel"]})));

/** 纯读句柄：没有待结算输入，也没有冲突裁决。 */
const handle: EditorViewHandle = {
    flushPendingChange: (): EditorFlushResult => "settled",
    focus: () => root.value?.focus(),
};

onMounted(() => {
    emit("ready", handle);
    emit("actions", props.document.target, []);
});
onBeforeUnmount(() => emit("ready", null));
watch(() => props.visible, (visible) => {
    if (visible) emit("ready", handle);
});

function onPointerDown(): void {
    emit("focus", props.document.target, true);
}
function onBlur(): void {
    emit("focus", props.document.target, false);
}
</script>

<template>
    <div
        ref="root"
        class="reader-view"
        tabindex="-1"
        :data-reader-view-id="props.viewInstanceId"
        @pointerdown="onPointerDown"
        @blur="onBlur"
    >
        <!-- 正文由 renderMarkdown + DOMPurify 净化后渲染；阅读视图不落任何编辑入口。 -->
        <article v-if="html" class="reader-view__page" v-html="html"></article>
        <div v-else class="reader-view__empty">{{ t("editorWorkbench.readerEmpty") }}</div>
    </div>
</template>

<style scoped>
/*
 * 稿面排版，不是界面排版：宋体、阅读字号、按版心宽度排，底色用稿面纸色。
 * 变量取 nbook 主题登记的稿面段（--page-surface / --reading-size / --reading-measure），
 * 其它主题不声明时按 fallback 回落，回落即是那些主题要的样子。
 */
.reader-view {
    height: 100%;
    overflow-y: auto;
    background: var(--page-surface, var(--bg-main));
    color: var(--page-ink, var(--text-main));
}

.reader-view__page {
    max-width: var(--reading-measure, 34em);
    margin: 0 auto;
    padding: 3rem 1.5rem 6rem;
    font-family: var(--font-display);
    font-size: var(--reading-size, 17px);
    line-height: var(--leading-reading);
    word-break: break-word;
}

.reader-view__empty {
    padding: 3rem 1.5rem;
    color: var(--text-muted);
    font-size: var(--text-sm);
}

.reader-view__page :deep(h1),
.reader-view__page :deep(h2),
.reader-view__page :deep(h3),
.reader-view__page :deep(h4) {
    font-weight: var(--weight-strong);
    line-height: 1.35;
    margin: 1.6em 0 0.7em;
}

.reader-view__page :deep(h1) { font-size: 1.6em; margin-top: 0.4em; }
.reader-view__page :deep(h2) { font-size: 1.32em; }
.reader-view__page :deep(h3) { font-size: 1.14em; }
.reader-view__page :deep(h4) { font-size: 1em; }

.reader-view__page :deep(p) { margin: 0 0 1em; }

.reader-view__page :deep(blockquote) {
    margin: 1.2em 0;
    padding-left: 1em;
    border-left: 2px solid var(--page-rule, var(--divider));
    color: var(--text-secondary);
}

.reader-view__page :deep(hr) {
    margin: 2em 0;
    border: 0;
    border-top: 1px solid var(--page-rule, var(--divider));
}

.reader-view__page :deep(code) {
    font-family: var(--font-mono, monospace);
    font-size: 0.88em;
    padding: 0.1em 0.32em;
    border-radius: 4px;
    background: var(--bg-input);
}

.reader-view__page :deep(pre) {
    margin: 1.2em 0;
    padding: 0.9em 1em;
    overflow-x: auto;
    border-radius: 8px;
    background: var(--bg-input);
}

.reader-view__page :deep(pre code) {
    padding: 0;
    background: none;
}

.reader-view__page :deep(table) {
    width: 100%;
    margin: 1.2em 0;
    border-collapse: collapse;
    font-size: 0.92em;
}

.reader-view__page :deep(th),
.reader-view__page :deep(td) {
    padding: 0.45em 0.7em;
    border: 1px solid var(--page-rule, var(--divider));
    text-align: left;
}

.reader-view__page :deep(img) {
    max-width: 100%;
    height: auto;
}

.reader-view__page :deep(a) {
    color: var(--accent-text);
    text-decoration: none;
}

.reader-view__page :deep(a:hover) {
    text-decoration: underline;
}

/* 窄屏：版心让位给视口，页边距收紧。 */
@media (max-width: 640px) {
    .reader-view__page {
        padding: 1.5rem 1rem 4rem;
        font-size: calc(var(--reading-size, 17px) - 1px);
    }
}
</style>
