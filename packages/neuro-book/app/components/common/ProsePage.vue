<script setup lang="ts">
import {computed} from "vue";
import DOMPurify from "dompurify";
import {proseBody, renderMarkdown} from "nbook/app/utils/markdown/render";

/**
 * 稿面排版正文：把 Markdown 渲染成可通读的 HTML（宋体、阅读字号、版心宽度、纸色）。
 *
 * 两个消费者共用同一套排版：编辑器里的「阅读」视图（`ReaderView`）与可停靠的阅读面板
 * （`ReaderPanelView`）。渲染走与 Agent 气泡同一套方言 + DOMPurify 净化；frontmatter 不进稿面
 * （元数据属于界面层，不属于要读的稿子）。
 */
const props = defineProps<{
    /** 完整 Markdown 原文（含 frontmatter）；本组件负责剥离与渲染。 */
    content: string;
}>();

const html = computed(() => renderMarkdown(proseBody(props.content), (raw) => DOMPurify.sanitize(raw, {ADD_ATTR: ["target", "rel"]})));
</script>

<template>
    <article v-if="html" class="prose-page" v-html="html"></article>
</template>

<style scoped>
/*
 * 稿面排版，不是界面排版：宋体、阅读字号、按版心宽度排，底色用稿面纸色。
 * 变量取 nbook 主题登记的稿面段（--page-surface / --page-ink / --reading-size / --reading-measure），
 * 其它主题不声明时按 fallback 回落，回落即是那些主题要的样子。
 */
.prose-page {
    max-width: var(--reading-measure, 34em);
    margin: 0 auto;
    padding: 2.5rem 1.5rem 5rem;
    color: var(--page-ink, var(--text-main));
    font-family: var(--font-display);
    font-size: var(--reading-size, 17px);
    line-height: var(--leading-reading);
    word-break: break-word;
}

.prose-page :deep(h1),
.prose-page :deep(h2),
.prose-page :deep(h3),
.prose-page :deep(h4) {
    font-weight: var(--weight-strong);
    line-height: 1.35;
    margin: 1.6em 0 0.7em;
}

.prose-page :deep(h1) { font-size: 1.6em; margin-top: 0.4em; }
.prose-page :deep(h2) { font-size: 1.32em; }
.prose-page :deep(h3) { font-size: 1.14em; }
.prose-page :deep(h4) { font-size: 1em; }

.prose-page :deep(p) { margin: 0 0 1em; }

.prose-page :deep(blockquote) {
    margin: 1.2em 0;
    padding-left: 1em;
    border-left: 2px solid var(--page-rule, var(--divider));
    color: var(--text-secondary);
}

.prose-page :deep(hr) {
    margin: 2em 0;
    border: 0;
    border-top: 1px solid var(--page-rule, var(--divider));
}

.prose-page :deep(code) {
    font-family: var(--font-mono, monospace);
    font-size: 0.88em;
    padding: 0.1em 0.32em;
    border-radius: 4px;
    background: var(--bg-input);
}

.prose-page :deep(pre) {
    margin: 1.2em 0;
    padding: 0.9em 1em;
    overflow-x: auto;
    border-radius: 8px;
    background: var(--bg-input);
}

.prose-page :deep(pre code) {
    padding: 0;
    background: none;
}

.prose-page :deep(table) {
    width: 100%;
    margin: 1.2em 0;
    border-collapse: collapse;
    font-size: 0.92em;
}

.prose-page :deep(th),
.prose-page :deep(td) {
    padding: 0.45em 0.7em;
    border: 1px solid var(--page-rule, var(--divider));
    text-align: left;
}

.prose-page :deep(img) {
    max-width: 100%;
    height: auto;
}

.prose-page :deep(a) {
    color: var(--accent-text);
    text-decoration: none;
}

.prose-page :deep(a:hover) {
    text-decoration: underline;
}

/* 窄屏 / 窄面板：版心让位给容器，页边距收紧。 */
@media (max-width: 640px) {
    .prose-page {
        padding: 1.5rem 1rem 4rem;
        font-size: calc(var(--reading-size, 17px) - 1px);
    }
}
</style>
