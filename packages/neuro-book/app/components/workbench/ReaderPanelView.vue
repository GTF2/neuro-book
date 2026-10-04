<script setup lang="ts">
import {computed} from "vue";
import ProsePage from "nbook/app/components/common/ProsePage.vue";
import {proseBody} from "nbook/app/utils/markdown/render";
import {useNovelIdeStore} from "nbook/app/stores/novel-ide";

/**
 * 阅读面板：把**当前活动文档**的正文排成稿面，供与编辑器并排通读。
 *
 * 与编辑器内的「阅读」视图（`ReaderView`）分工不同：那个是"用阅读方式打开这个文件"，
 * 本面板是"常驻的排版预览"——文件切换、正文改动都跟着走，不需要重新打开。
 *
 * 数据直接读 store 的活动缓冲（`activeWorkspaceFile`）：它就是编辑器正在编辑的那份内容，
 * 因此面板里看到的排版与编辑器实时同步（含未保存的改动）。面板只读，不回写。
 */
const store = useNovelIdeStore();
const {t} = useI18n();

const activeFile = computed(() => store.activeWorkspaceFile);
/** 只有 Markdown 才有稿面语义；其它类型（图片、JSON 等）给出说明而不是空排版。 */
const isMarkdown = computed(() => (activeFile.value?.node.path ?? "").toLowerCase().endsWith(".md"));
/** 空态判据与渲染同一把尺子：剥离 frontmatter 后的正文为空就是"没有正文"。 */
const hasContent = computed(() => proseBody(activeFile.value?.content ?? "").trim().length > 0);
const fileName = computed(() => activeFile.value?.node.title?.trim() || activeFile.value?.node.path || "");
</script>

<template>
    <div class="reader-panel">
        <header v-if="activeFile" class="reader-panel__head">
            <span class="reader-panel__title" :title="activeFile.node.path">{{ fileName }}</span>
            <span class="reader-panel__hint">{{ t("ide.workbench.readerPanel.hint") }}</span>
        </header>

        <div class="reader-panel__body">
            <ProsePage v-if="activeFile && isMarkdown && hasContent" :content="activeFile.content" />
            <div v-else class="reader-panel__empty">
                <span class="i-lucide-book-open reader-panel__empty-icon"></span>
                <span>{{ !activeFile
                    ? t("ide.workbench.readerPanel.noDocument")
                    : !isMarkdown
                        ? t("ide.workbench.readerPanel.notMarkdown")
                        : t("ide.workbench.readerPanel.emptyBody") }}</span>
            </div>
        </div>
    </div>
</template>

<style scoped>
.reader-panel {
    display: flex;
    height: 100%;
    min-height: 0;
    flex-direction: column;
    background: var(--page-surface, var(--bg-main));
}

/* 面板头：稿面之上的一条界面层信息，说明这是"预览"而非可编辑正文。 */
.reader-panel__head {
    display: flex;
    flex-shrink: 0;
    align-items: baseline;
    gap: var(--space-2);
    border-bottom: 1px solid var(--divider);
    padding: var(--space-2) var(--space-3);
}

.reader-panel__title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--text-main);
    font-size: var(--text-xs);
    font-weight: var(--weight-medium);
}

.reader-panel__hint {
    flex-shrink: 0;
    color: var(--text-muted);
    font-size: var(--text-2xs);
}

.reader-panel__body {
    min-height: 0;
    flex: 1;
    overflow-y: auto;
}

.reader-panel__empty {
    display: flex;
    height: 100%;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    padding: var(--space-6) var(--space-4);
    text-align: center;
    color: var(--text-muted);
    font-size: var(--text-sm);
}

.reader-panel__empty-icon {
    opacity: 0.5;
    font-size: 2rem;
}
</style>
