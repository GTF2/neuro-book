import {Extension} from "@tiptap/core";
import type {Node as ProseMirrorNode, ResolvedPos} from "@tiptap/pm/model";
import {Plugin, PluginKey, type EditorState} from "@tiptap/pm/state";
import {Decoration, DecorationSet} from "@tiptap/pm/view";
import {FOCUS_CURRENT_BLOCK_CLASS} from "nbook/app/utils/focus-mode";

/**
 * 稿面专注模式的装饰承载扩展。
 *
 * 职责只有一件事：**把光标所在的那一块标出来**（加一个类名）。它不知道开关、不知道外观——
 * 开关是宿主上的 `data-focus-mode` 属性，外观在 `app/styles/focus-mode.css`。
 *
 * 三者分开是有意的：
 * - 装饰只在**光标移动或文档变化**时重算，那是它的自然节奏；
 * - 开关切换是零成本的（改一个属性），不必 dispatch 事务、也不必重算装饰；
 * - 外观全在 CSS 里，将来要调「其余段落降到多淡」不用碰任何 TypeScript。
 *
 * ── 「当前块是谁」的三条规则 ────────────────────────────────────────────
 *
 * ① **优先取最内层的文本块**，而不是顶层块。列表项、引用块里真正被写的是那个段落，
 *    标顶层会把整个列表一起点亮，用户看到的「当前段」变成一大片，引导作用当场消失。
 * ② **取不到文本块时退回光标所在的顶层块**。光标停在水平分割线、图片这类**原子块**上时
 *    （NodeSelection），路径上没有文本块可走。不退回的话整篇都会失去标注——
 *    专注模式会让**全文一起变灰**，比标错难看得多。
 * ③ **标题不作数，顺延到它后面第一个正文块**。标题是结构标记，不是「你在写的东西」；
 *    把标题当当前块的结果是**标题独立保持全色、正文 100% 变灰**——用户看到的是
 *    「文字被禁用了」，而不是「专注模式开着」。这一条是**真实浏览器实测出来的**：
 *    刚打开稿面时光标由 ProseMirror 默认落在文档起点（也就是章标题里），
 *    于是每次开启专注模式的默认观感都是「整篇变灰」。
 *
 * 第 ② 条不能用 `$from` 的 depth 判断来实现：NodeSelection 的 `$from` 会解析到 doc 层级
 * （depth 为 0），此时 `before(1)` / `node(1)` 都拿不到东西。所以退回这一步改用
 * **位置反查顶层块**，与选区类型无关。这一处是实测出来的，不是预防性写法。
 */

const PLUGIN_KEY = new PluginKey<DecorationSet>("focusMode");

/** 块在文档里的位置与节点本身 */
type BlockRef = {pos: number; node: ProseMirrorNode};

/**
 * 从光标位置向上找最近的文本块深度（段落、标题都算文本块；列表项、引用块不算）。
 * 返回 null 表示这条路径上没有文本块。
 */
function nearestTextblockDepth($from: ResolvedPos): number | null {
    for (let depth = $from.depth; depth >= 1; depth -= 1) {
        if ($from.node(depth).isTextblock) {
            return depth;
        }
    }
    return null;
}

/**
 * 按位置反查顶层块。区间取**左闭右开**：位置正好落在两个块的交界处时归**后一个**块，
 * 这与 ProseMirror 对边界位置的归属惯例一致（光标停在段落末尾之后，实际已经在下一块的开头）。
 * 用闭区间的话交界位置会命中前一个块——实测踩到过：点选水平分割线时标出来的是它前面的段落。
 *
 * 位置超出全部块（文档末尾）时取最后一个块，保证只要文档非空就一定返回一个块。
 */
function topLevelBlockAt(doc: ProseMirrorNode, position: number): BlockRef | null {
    let matched: BlockRef | null = null;
    let last: BlockRef | null = null;

    doc.forEach((node, offset) => {
        const candidate: BlockRef = {pos: offset, node};
        last = candidate;
        if (!matched && position >= offset && position < offset + node.nodeSize) {
            matched = candidate;
        }
    });

    return matched ?? last;
}

/**
 * 是否标题类块。TipTap 的标题节点名是 `heading`；这里把 `h1`–`h6` 也认下来，
 * 免得将来换个 schema 命名就静默失效（失效的表现是整篇变灰，很难联想到命名）。
 */
function isHeading(node: ProseMirrorNode): boolean {
    return node.type.name === "heading" || /^h[1-6]$/iu.test(node.type.name);
}

/**
 * 找某个顶层块之后的第一个**正文块**（非标题的文本块）。
 *
 * 只在顶层顺序扫描：被找的块若嵌在容器里（例如引用块里的标题），位置对不上，
 * 返回 null，调用方退回原标题块。这种文档在稿件里极罕见，为它引入容器遍历不划算。
 */
function nextProseBlockAfter(doc: ProseMirrorNode, position: number): BlockRef | null {
    let found: BlockRef | null = null;
    let passed = false;

    doc.forEach((node, offset) => {
        if (found) {
            return;
        }
        if (offset === position) {
            passed = true;
            return;
        }
        if (passed && node.isTextblock && !isHeading(node)) {
            found = {pos: offset, node};
        }
    });

    return found;
}

/**
 * 解析「当前块」：优先最内层文本块，取不到则退回光标所在的顶层块。
 */
function resolveCurrentBlock(state: EditorState): BlockRef | null {
    const {$from} = state.selection;
    const textblockDepth = nearestTextblockDepth($from);
    const block = textblockDepth !== null
        ? {pos: $from.before(textblockDepth), node: $from.node(textblockDepth)}
        : topLevelBlockAt(state.doc, state.selection.from);

    if (block && isHeading(block.node)) {
        return nextProseBlockAfter(state.doc, block.pos) ?? block;
    }

    return block;
}

/**
 * 为当前块建装饰。文档非空时必定返回恰好一个装饰。
 */
export function buildFocusDecoration(state: EditorState): DecorationSet {
    const block = resolveCurrentBlock(state);
    if (!block) {
        return DecorationSet.empty;
    }

    return DecorationSet.create(state.doc, [
        Decoration.node(block.pos, block.pos + block.node.nodeSize, {class: FOCUS_CURRENT_BLOCK_CLASS}),
    ]);
}

/**
 * 装饰承载扩展：只负责在光标或文档变化时重算，其余交给 CSS。
 */
export const FocusMode = Extension.create({
    name: "focusMode",
    addProseMirrorPlugins() {
        return [
            new Plugin<DecorationSet>({
                key: PLUGIN_KEY,
                state: {
                    init: (_config, state) => buildFocusDecoration(state),
                    apply(transaction, currentDecorationSet, _oldState, newState) {
                        /*
                         * 只在光标动了或文档改了的时候重算。
                         * 其它事务（例如应用一次注释列表更新）不会改变「当前块是谁」，
                         * 重算一遍纯属浪费——而每次光标移动都要走一次这个判断。
                         */
                        if (!transaction.selectionSet && !transaction.docChanged) {
                            return currentDecorationSet;
                        }
                        return buildFocusDecoration(newState);
                    },
                },
                props: {
                    decorations(state) {
                        return PLUGIN_KEY.getState(state) ?? DecorationSet.empty;
                    },
                },
            }),
        ];
    },
});
