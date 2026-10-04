---
标签: [state:inject, state:local]
---

# ReaderView

正文的**只读阅读形态**：把 Markdown 渲染成稿面排版的 HTML 供通读与校对，不提供任何编辑入口。它是编辑器工作台里 `read` 这条 `EditorContribution` 的视图实现——在「打开方式」菜单里选中「阅读」即切到这里。

它和「富文本编辑器」的区别只有一条：**读与写分离**。它不接收输入、不产生 `change`，因此句柄的 `flushPendingChange()` 恒为 `settled`、没有 `resolveConflict`；切到阅读视图再切回编辑，编辑器的确认快照不受影响（阅读期间没有任何提交发生）。

渲染走 `app/utils/markdown/render.ts` 的 `renderMarkdown()`（与 Agent 气泡同一套方言：行内评论、表格等），HTML 由 `DOMPurify` 净化后注入。**frontmatter 不进入稿面**：`splitMarkdownFrontmatter()` 先剥掉 YAML 头，只渲染正文——元数据属于界面层，不属于要读的稿子。

排版取 nbook 主题登记的稿面变量（`--page-surface` / `--page-ink` / `--page-rule` / `--reading-size` / `--reading-measure`），字号与版心宽度随主题走；主题不声明时按 fallback 回落（`--bg-main` / `--text-main` / `--divider`），回落即是那些主题要的样子。窄屏（≤640px）收紧页边距并把字号降一档。

## 契约

```ts
type Props = {
    document: EditorDocumentSnapshot;   // 只读 content；languageId 为 markdown
    visible: boolean;
    viewInstanceId: string;
};

type Emits = {
    save: [target: EditorDocumentTarget];
    focus: [target: EditorDocumentTarget, focused: boolean];
    ready: [handle: EditorViewHandle | null];
    actions: [target: EditorDocumentTarget, actions: readonly EditorAction[]];
};
```

句柄（`EditorViewHandle`）：`flushPendingChange()` 恒返回 `"settled"`；`focus()` 聚焦阅读容器。不实现 `undo` / `redo` / `runAction` / `resolveConflict` / `navigation`。

## 状态

- 无持久状态：渲染完全由 `document.content` 推导，内容变化（外部修订）即重渲染。
- `actions` 恒为空数组（阅读视图没有视图操作）。
- 正文为空（或剥掉 frontmatter 后为空）时显示空态文案，不渲染空白页。

## 已知偏差

无。
