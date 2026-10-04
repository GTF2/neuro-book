// @vitest-environment jsdom
import {mount, flushPromises} from "@vue/test-utils";
import {describe, expect, it, vi} from "vitest";
import ReaderView from "./ReaderView.vue";
import type {EditorDocumentSnapshot} from "./editor-view.types";

const target = {workspaceKey: "novel:a", generation: 1, documentId: "1", path: "a.md"};
const snapshot = (content: string): EditorDocumentSnapshot => ({target, content, contentRevision: 1, languageId: "markdown", readonly: false});

Object.assign(globalThis, {useI18n: () => ({t: (key: string) => key})});

describe("ReaderView", () => {
    it("剥掉 frontmatter 只渲染正文，且不提供编辑能力", async () => {
        const wrapper = mount(ReaderView, {props: {document: snapshot("---\ntitle: 标题\n---\n# 正文标题\n\n第一段。"), visible: true, viewInstanceId: "i1"}});
        await flushPromises();
        const html = wrapper.find(".prose-page").html();
        expect(html).toContain("正文标题");
        expect(html).toContain("第一段");
        expect(html).not.toContain("title: 标题");
        expect(wrapper.find("textarea").exists()).toBe(false);
        expect(wrapper.find("[contenteditable]").exists()).toBe(false);
    });

    it("句柄恒为 settled 且不声明冲突裁决", async () => {
        const wrapper = mount(ReaderView, {props: {document: snapshot("正文"), visible: true, viewInstanceId: "i1"}});
        await flushPromises();
        const handle = wrapper.emitted("ready")!.at(-1)![0] as {flushPendingChange: () => string; resolveConflict?: unknown};
        expect(handle.flushPendingChange()).toBe("settled");
        expect(handle.resolveConflict).toBeUndefined();
    });

    it("外部内容变化即重渲染（无持久状态）", async () => {
        const wrapper = mount(ReaderView, {props: {document: snapshot("旧正文"), visible: true, viewInstanceId: "i1"}});
        await flushPromises();
        expect(wrapper.text()).toContain("旧正文");
        await wrapper.setProps({document: snapshot("新正文")});
        await flushPromises();
        expect(wrapper.text()).toContain("新正文");
        expect(wrapper.text()).not.toContain("旧正文");
    });

    it("正文为空时显示空态且不发动作", async () => {
        const wrapper = mount(ReaderView, {props: {document: snapshot("---\ntitle: 只有元数据\n---\n"), visible: true, viewInstanceId: "i1"}});
        await flushPromises();
        expect(wrapper.find(".reader-view__empty").exists()).toBe(true);
        expect(wrapper.find(".prose-page").exists()).toBe(false);
        expect(wrapper.emitted("actions")![0]![1]).toEqual([]);
    });

    it("脚本注入被净化", async () => {
        const wrapper = mount(ReaderView, {props: {document: snapshot("<script>window.__pwned = true</script>\n\n安全正文"), visible: true, viewInstanceId: "i1"}});
        await flushPromises();
        expect(wrapper.find(".prose-page").html()).not.toContain("<script");
        expect((globalThis as {__pwned?: boolean}).__pwned).toBeUndefined();
    });

    it("卸载时撤销句柄", async () => {
        const wrapper = mount(ReaderView, {props: {document: snapshot("正文"), visible: true, viewInstanceId: "i1"}});
        await flushPromises();
        wrapper.unmount();
        expect(wrapper.emitted("ready")!.at(-1)![0]).toBeNull();
    });
});
