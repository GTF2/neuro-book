<script setup lang="ts">
import {computed, onBeforeUnmount, onMounted, ref, watch} from "vue";
import ProsePage from "nbook/app/components/common/ProsePage.vue";
import {proseBody} from "nbook/app/utils/markdown/render";
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

/**
 * 空态判据：**稿面正文**为空时给本视图的说法。
 *
 * 与渲染同一把尺子（`ProsePage` 也只看 `proseBody`）：只有 frontmatter 的文档渲染结果是空串，
 * 若按原文判"有正文"就会得到一片空白而不是空态。
 */
const hasBody = computed(() => proseBody(props.document.content).trim().length > 0);

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
        <!-- 稿面纸色归本视图（面板的纸色来源不同）；正文排版归 ProsePage，两处共用一份。 -->
        <ProsePage v-if="hasBody" :content="props.document.content" />
        <div v-else class="reader-view__empty">{{ t("editorWorkbench.readerEmpty") }}</div>
    </div>
</template>

<style scoped>
.reader-view {
    height: 100%;
    overflow-y: auto;
    background: var(--page-surface, var(--bg-main));
}

.reader-view__empty {
    padding: 3rem 1.5rem;
    color: var(--text-muted);
    font-size: var(--text-sm);
}
</style>
