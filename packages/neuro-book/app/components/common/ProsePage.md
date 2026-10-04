---
标签: [state:inject]
---

# ProsePage

**稿面排版正文**：把一段 Markdown 原文渲染成适合通读的 HTML——宋体、按阅读字号与版心宽度排、纸色底、无编辑控件。

它存在的理由是**让排版只有一份**：编辑器里的「阅读」视图（`ReaderView`）与可停靠的阅读面板（`ReaderPanelView`）都要把正文排成稿面，两处各写一套样式必然漂移。渲染走 `app/utils/markdown/render.ts` 的 `renderMarkdown()`（与 Agent 气泡同一套方言：行内评论、表格等），HTML 由 `DOMPurify` 净化后注入。

**frontmatter 不进稿面**：`splitMarkdownFrontmatter()` 先剥掉顶部 YAML 头，只渲染正文——元数据属于界面层，不属于要读的稿子。

排版取 nbook 主题登记的稿面变量（`--page-ink` / `--page-rule` / `--reading-size` / `--reading-measure`）；主题不声明时按 fallback 回落（`--text-main` / `--divider` / 17px / 34em），回落即是那些主题要的样子。容器窄于 640px 时收紧页边距并把字号降一档。底色由**宿主**负责（本组件只排正文，不画纸），因为阅读视图与面板的纸色来源不同。

## 契约

```ts
type Props = {
    /** 完整 Markdown 原文（含 frontmatter）；本组件负责剥离与渲染。 */
    content: string;
};
```

无 emits、无 slots、无 expose。`attrs` 透传到根元素。

## 状态

无状态：渲染完全由 `content` 推导，内容变化即重渲染。正文为空（或剥掉 frontmatter 后为空）时不渲染任何元素——空态文案归宿主（两者对「空」的说法不同：编辑器说「这篇文档还没有正文」，面板说「打开一个章节」）。

## 已知偏差

无。
