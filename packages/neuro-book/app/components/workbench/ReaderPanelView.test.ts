// @vitest-environment jsdom
import {mount, flushPromises} from "@vue/test-utils";
import {describe, expect, it, vi} from "vitest";
import ReaderPanelView from "./ReaderPanelView.vue";

/**
 * 面板的数据来源是 store 的活动缓冲（`activeWorkspaceFile`），因此把它换成可写的替身：
 * 面板本身只读、无 emit、无状态，断言的是"四态怎么判"与"改动是否跟着走"。
 *
 * 替身必须是**真 ref**：computed 只追踪响应式来源，普通对象换值不会触发重渲染。
 */
const store = vi.hoisted(() => ({set: (_value: unknown) => {}}));

vi.mock("nbook/app/stores/novel-ide", async () => {
    const {ref} = await import("vue");
    const active = ref<unknown>(null);
    store.set = (value) => { active.value = value; };
    return {useNovelIdeStore: () => ({get activeWorkspaceFile() { return active.value; }})};
});

Object.assign(globalThis, {useI18n: () => ({t: (key: string) => key})});

function openFile(path: string, content: string, title = ""): void {
    store.set({node: {path, title}, content});
}

async function mountPanel() {
    const wrapper = mount(ReaderPanelView);
    await flushPromises();
    return wrapper;
}

describe("ReaderPanelView", () => {
    it("活动文档是 Markdown 时渲染稿面，标题栏显示文件名", async () => {
        openFile("manuscript/ch01.md", "---\ntitle: 元数据\n---\n# 第一章\n\n正文。", "第一章");
        const wrapper = await mountPanel();

        expect(wrapper.find(".prose-page").html()).toContain("第一章");
        expect(wrapper.find(".prose-page").html()).not.toContain("title: 元数据");
        expect(wrapper.find(".reader-panel__title").text()).toBe("第一章");
        expect(wrapper.find(".reader-panel__empty").exists()).toBe(false);
    });

    it("没有活动文档时给「打开章节」的说法，不渲染稿面", async () => {
        store.set(null);
        const wrapper = await mountPanel();

        expect(wrapper.find(".reader-panel__empty").text()).toContain("ide.workbench.readerPanel.noDocument");
        expect(wrapper.find(".prose-page").exists()).toBe(false);
        expect(wrapper.find(".reader-panel__head").exists()).toBe(false);
    });

    it("非 Markdown 文件说「没有稿面」，而不是排一片空版", async () => {
        openFile("assets/cover.png", "binary", "封面");
        const wrapper = await mountPanel();

        expect(wrapper.find(".reader-panel__empty").text()).toContain("ide.workbench.readerPanel.notMarkdown");
        expect(wrapper.find(".prose-page").exists()).toBe(false);
    });

    it("只有 frontmatter 的文档算「没有正文」——判据与渲染同一把尺子", async () => {
        openFile("manuscript/ch02.md", "---\ntitle: 只有元数据\n---\n", "第二章");
        const wrapper = await mountPanel();

        expect(wrapper.find(".reader-panel__empty").text()).toContain("ide.workbench.readerPanel.emptyBody");
        expect(wrapper.find(".prose-page").exists()).toBe(false);
    });

    it("内容变化跟着走：面板读的是活动缓冲，含未保存改动", async () => {
        openFile("manuscript/ch03.md", "旧正文。");
        const wrapper = await mountPanel();
        expect(wrapper.text()).toContain("旧正文。");

        openFile("manuscript/ch03.md", "新正文。");
        await flushPromises();

        expect(wrapper.text()).toContain("新正文。");
        expect(wrapper.text()).not.toContain("旧正文。");
        // 没有标题时回落到路径，标题栏不留空。
        expect(wrapper.find(".reader-panel__title").text()).toBe("manuscript/ch03.md");
    });

    it("只读：不提供编辑控件，也不回写缓冲", async () => {
        openFile("manuscript/ch04.md", "正文。");
        const wrapper = await mountPanel();

        expect(wrapper.find("textarea").exists()).toBe(false);
        expect(wrapper.find("[contenteditable]").exists()).toBe(false);
        expect(wrapper.emitted()).toEqual({});
    });
});
