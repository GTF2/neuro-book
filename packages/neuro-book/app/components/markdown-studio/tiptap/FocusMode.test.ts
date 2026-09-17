import {Schema, type Node as ProseMirrorNode} from "@tiptap/pm/model";
import {EditorState, NodeSelection, TextSelection} from "@tiptap/pm/state";
import type {Decoration} from "@tiptap/pm/view";
import {describe, expect, it} from "vitest";
import {buildFocusDecoration} from "nbook/app/components/markdown-studio/tiptap/FocusMode";
import {FOCUS_CURRENT_BLOCK_CLASS} from "nbook/app/utils/focus-mode";

/**
 * 专注模式装饰的用例。
 *
 * 这一份测的是**「当前块是谁」这个判断**，不是外观。外观在 CSS 里（`app/styles/focus-mode.css`），
 * 它唯一的实现约束是「只挑叶子块，避免 opacity 嵌套相乘」，那条在 CSS 注释里说明。
 *
 * 最要紧的一条是**列表项**：光标停在列表里的段落时，标注目标必须是那个段落而不是整个列表。
 * 标成列表的话，用户看到的「当前段」会是一大片，专注模式的引导作用当场消失——
 * 而这个错误在视觉上很自然，不做断言基本发现不了。
 *
 * 第二要紧的是**标题不作数**（顺延到后面第一个正文段）：这条是真实浏览器里跑出来才发现的，
 * 静态看代码完全合理，实际效果却是「一开专注模式整篇正文就变灰」。
 *
 * 用 `EditorState` + 手写 schema 构造，不起 tiptap 的 `Editor`：后者需要 DOM，
 * 而本仓的 vitest 环境是 `node`。ProseMirror 的 model / state 本身与 DOM 无关，够用了。
 */

const schema = new Schema({
    nodes: {
        doc: {content: "block+"},
        paragraph: {content: "text*", group: "block"},
        heading: {content: "text*", group: "block", attrs: {level: {default: 1}}},
        blockquote: {content: "block+", group: "block"},
        bulletList: {content: "listItem+", group: "block"},
        listItem: {content: "paragraph block*"},
        horizontalRule: {group: "block"},
        text: {group: "inline"},
    },
});

function text(text: string): ProseMirrorNode {
    return schema.text(text);
}

function paragraph(content: string): ProseMirrorNode {
    return schema.node("paragraph", null, content ? [text(content)] : []);
}

/** 收集文档里所有块级节点的位置，供测试直接取用而不必手算 offset */
function collectBlocks(doc: ProseMirrorNode): {node: ProseMirrorNode; pos: number}[] {
    const blocks: {node: ProseMirrorNode; pos: number}[] = [];
    doc.descendants((node, pos) => {
        if (node.isBlock) {
            blocks.push({node, pos});
        }
        return true;
    });
    return blocks;
}

/** 把光标放在第 index 个块的第一字符处，返回该块装饰应有的 [from, to] */
function stateWithCaretIn(doc: ProseMirrorNode, index: number): {state: EditorState; from: number; to: number} {
    const target = collectBlocks(doc)[index];
    if (!target) {
        throw new Error(`文档里没有第 ${index} 个块`);
    }
    const from = target.pos;
    const to = target.pos + target.node.nodeSize;
    return {state: EditorState.create({doc, selection: TextSelection.create(doc, from + 1)}), from, to};
}

/*
 * Decoration 的运行时形状带 `type.attrs`（装饰就是靠它携带类名），
 * 但 prosemirror-view 的类型定义没有把这个字段暴露出来。
 * 所以按结构断言读取——比 `as any` 少一点盲目，也把形状写在了明处。
 */
type DecorationWithAttrs = {type?: {attrs?: Record<string, unknown>}};

function readClassName(decoration: Decoration): string {
    const attrs = (decoration as unknown as DecorationWithAttrs).type?.attrs;
    return String(attrs?.class ?? "");
}

function readDecoration(state: EditorState): {from: number; to: number; className: string}[] {
    return buildFocusDecoration(state).find().map((decoration) => ({
        from: decoration.from,
        to: decoration.to,
        className: readClassName(decoration),
    }));
}

describe("buildFocusDecoration", () => {
    it("marks the paragraph the caret sits in", () => {
        const doc = schema.node("doc", null, [paragraph("第一段"), paragraph("第二段")]);
        const {state, from, to} = stateWithCaretIn(doc, 1);

        expect(readDecoration(state)).toEqual([{from, to, className: FOCUS_CURRENT_BLOCK_CLASS}]);
    });

    it("marks exactly one block — the whole point is a single spotlight", () => {
        const doc = schema.node("doc", null, [paragraph("一"), paragraph("二"), paragraph("三")]);
        const {state} = stateWithCaretIn(doc, 2);

        expect(readDecoration(state)).toHaveLength(1);
    });

    /*
     * 标题不作数：光标停在标题上时标它下面的第一个正文段，而不是标题本身。
     *
     * 这条不是「更优雅」，是实测出来的硬需求：刚打开稿面时光标由 ProseMirror 默认落在文档起点
     * （章标题里），标标题的结果是**标题独立保持全色、正文 100% 变灰**——用户看到的是
     * 「文字被禁用了」，而不是「专注模式开着」。
     */
    it("marks the following paragraph, not the heading, when the caret is in a heading", () => {
        const doc = schema.node("doc", null, [
            schema.node("heading", {level: 1}, [text("开篇：蓝梓与芥末")]),
            paragraph("“站住！不要跑……”"),
            paragraph("“抓住他，抓小偷……”"),
        ]);
        const blocks = collectBlocks(doc);
        const heading = blocks[0];
        const firstParagraph = blocks[1];
        expect(heading?.node.type.name).toBe("heading");
        expect(firstParagraph?.node.type.name).toBe("paragraph");

        // 光标落在标题的文字里——正是打开稿面时的默认位置
        const state = EditorState.create({
            doc,
            selection: TextSelection.create(doc, (heading?.pos ?? 0) + 1),
        });

        const [decoration] = readDecoration(state);
        expect(decoration?.from).toBe(firstParagraph?.pos);
        expect(decoration?.to).toBe((firstParagraph?.pos ?? 0) + (firstParagraph?.node.nodeSize ?? 0));
    });

    it("falls back to the heading itself when no prose block follows it", () => {
        // 顺延不能变成「什么都不标」——那样整篇还是会全灰，退回标标题比那好
        const doc = schema.node("doc", null, [paragraph("正文"), schema.node("heading", {level: 2}, [text("标题")])]);
        const {state, from, to} = stateWithCaretIn(doc, 1);

        expect(readDecoration(state)).toEqual([{from, to, className: FOCUS_CURRENT_BLOCK_CLASS}]);
    });

    it("skips consecutive headings to reach prose", () => {
        // 章标题下面紧跟小标题是常见排版，只跳一层还不够
        const doc = schema.node("doc", null, [
            schema.node("heading", {level: 1}, [text("第一章")]),
            schema.node("heading", {level: 2}, [text("一")]),
            paragraph("正文第一段"),
        ]);
        const blocks = collectBlocks(doc);
        const prose = blocks[2];

        const state = EditorState.create({
            doc,
            selection: TextSelection.create(doc, (blocks[0]?.pos ?? 0) + 1),
        });

        const [decoration] = readDecoration(state);
        expect(decoration?.from).toBe(prose?.pos);
    });

    /*
     * 核心断言：列表项里的段落要标**段落**，不是 bulletList，也不是 listItem。
     * 标错的话「当前段」会变成一整片，而视觉上看不出这是错的。
     */
    it("marks the paragraph inside a list item, not the list around it", () => {
        const listItem = schema.node("listItem", null, [paragraph("列第一项")]);
        const list = schema.node("bulletList", null, [listItem]);
        const doc = schema.node("doc", null, [paragraph("前言"), list]);

        const blocks = collectBlocks(doc);
        const listBlock = blocks.find((block) => block.node.type.name === "bulletList");
        const innerParagraph = blocks.find(
            (block) => block.node.type.name === "paragraph" && block.pos > (listBlock?.pos ?? 0),
        );
        expect(innerParagraph, "没找到列表内的段落").toBeDefined();
        expect(listBlock, "没找到列表本身").toBeDefined();

        const state = EditorState.create({
            doc,
            selection: TextSelection.create(doc, (innerParagraph?.pos ?? 0) + 1),
        });

        const [decoration] = readDecoration(state);
        expect(decoration?.from).toBe(innerParagraph?.pos);
        expect(decoration?.to).toBe((innerParagraph?.pos ?? 0) + (innerParagraph?.node.nodeSize ?? 0));
        // 被标的那一块必须比整个列表小——否则标的就是列表本身
        expect(decoration?.to).toBeLessThan((listBlock?.pos ?? 0) + list.nodeSize);
    });

    it("falls back to the top-level block when no text block holds the caret", () => {
        // 水平分割线没有文本块路径可走，退回标它自己——
        // 不退回的话整篇会全变灰，那比标错更糟
        const rule = schema.node("horizontalRule");
        const doc = schema.node("doc", null, [paragraph("上文"), rule, paragraph("下文")]);
        const ruleBlock = collectBlocks(doc).find((block) => block.node.type.name === "horizontalRule");
        expect(ruleBlock).toBeDefined();

        const state = EditorState.create({
            doc,
            selection: NodeSelection.create(doc, ruleBlock?.pos ?? 0),
        });

        const [decoration] = readDecoration(state);
        expect(decoration?.className).toBe(FOCUS_CURRENT_BLOCK_CLASS);
        expect(decoration?.from).toBe(ruleBlock?.pos);
    });

    it("returns nothing when the caret has no block to stand in", () => {
        // 只有一个空段落的文档仍应标出那一段（编辑器的常见初始状态）
        const doc = schema.node("doc", null, [paragraph("")]);
        const state = EditorState.create({doc});

        expect(readDecoration(state)).toHaveLength(1);
    });
});
