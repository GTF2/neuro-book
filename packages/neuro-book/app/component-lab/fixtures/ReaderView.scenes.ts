import type ReaderView from "nbook/app/components/editor-workbench/ReaderView.vue";
import type {EditorDocumentSnapshot} from "nbook/app/components/editor-workbench/editor-view.types";
import type {LabFixtureDefinition} from "./index";

const path = "manuscript/001-volume/001-chapter/index.md";
const snapshot = (content: string): EditorDocumentSnapshot => ({
    target: {workspaceKey: "lab:reader-view", generation: 1, documentId: `lab-doc:${path}`, path},
    content,
    contentRevision: 0,
    languageId: "markdown",
    readonly: false,
});

/**
 * 编辑器内「阅读」视图的四个形态：正常稿面、剥掉 frontmatter、只有元数据的空态、脚本净化。
 *
 * 它是**只读**贡献：不提供编辑控件、不发保存请求，句柄恒为 settled。
 */
export const readerViewScenes = [
    {
        id: "prose",
        label: "正常稿面",
        input: {props: {document: snapshot("---\ntitle: 示范章节\n---\n\n# 第一章 退潮\n\n潮水退到最低处时，码头只剩下一排湿漉漉的桩子。\n\n他把第十一封信折好，塞回大衣内袋。\n"), visible: true, viewInstanceId: "lab-reader-1"}},
    },
    {
        id: "frontmatter",
        label: "剥掉 frontmatter 只渲染正文",
        input: {props: {document: snapshot("---\ntitle: 标题\nstatus: draft\n---\n\n正文从 frontmatter 之后开始。"), visible: true, viewInstanceId: "lab-reader-2"}},
    },
    {
        id: "empty",
        label: "空正文（只有 frontmatter）",
        input: {props: {document: snapshot("---\ntitle: 只有元数据\n---\n"), visible: true, viewInstanceId: "lab-reader-3"}},
    },
    {
        id: "sanitized",
        label: "脚本注入被净化",
        input: {props: {document: snapshot("<script>window.__lab_pwned = true<\/script>\n\n安全正文：上面那行什么都不会发生。"), visible: true, viewInstanceId: "lab-reader-4"}},
    },
] satisfies LabFixtureDefinition<typeof ReaderView>["scenes"];
