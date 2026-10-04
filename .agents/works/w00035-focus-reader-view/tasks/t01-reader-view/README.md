---
schema: nbook.task/v2
taskId: t01-reader-view
---

# 阅读视图：正文的只读稿面形态

行为合同未变：本 Task 只新增一条编辑器贡献与视图组件，不改既有编辑器 / 工作台的行为合同；新组件的行为以同名文档 [`ReaderView.md`](../../../../../packages/neuro-book/app/components/editor-workbench/ReaderView.md) 为准，渲染与净化复用 [`AgentMarkdownContent`](../../../../../packages/neuro-book/app/components/novel-ide/agent/bubbles/base/AgentMarkdownContent.vue) 同一套 `renderMarkdown()`。

## 目标与范围

给正文加「读」的形态：在编辑器工具栏「更多操作 → 打开方式」里新增「阅读」一项，切换后正文按稿面排版只读呈现——宋体、稿面字号与版心宽度、暖纸底、无任何编辑控件。

实现取最小路径：新增第三条 `EditorContribution`（`id: "read"`），不动 view registry（视图化按 w00025 遗留的正路留待后续 Work）。

## 非目标

- 不改 TipTap 编辑器与 Markdown Studio 的任何行为。
- 不做批注、朗读、导出、翻页动画。
- 不新增工作台视图（不碰 `product-catalog.ts` / `view-factories.ts`）。

## 证据

- 新增：`ReaderView.vue` + `ReaderView.md`（同名文档）+ `ReaderView.test.ts`（6 例）。
- 改动：`builtin-editors.ts`（注册 `read` 贡献）、`i18n/locales/{zh-CN,en-US}.ts`（`read` / `readerEmpty`）。
- 渲染复用 `renderMarkdown()` + DOMPurify（与 Agent 气泡同一套方言与净化）；frontmatter 由 `splitMarkdownFrontmatter()` 剥离，不进稿面。
- 排版消费 nbook 主题既有稿面变量（`--page-surface` / `--page-ink` / `--page-rule` / `--reading-size` / `--reading-measure`），这些变量此前产品零消费。

## 验证

- 聚焦测试：`app/components/editor-workbench` + `app/utils/editor-workbench` → 16 files / **143 tests 通过**（含 ReaderView 6 例：frontmatter 剥离、句柄恒 settled、外部变化重渲染、空态、XSS 净化、卸载撤销）。
- 浏览器探针（`.local/w00035-probe5.mjs`，notion 主题走 fallback）：菜单出现「阅读」；切换后 `.reader-view` 渲染 417 字符、无 `contenteditable` / `textarea`、版心 544px（34em）、字号 16px。
- 浏览器探针（同脚本，nbook 主题）：稿面变量生效——**17px 字号、578px 版心、暖纸底 `rgb(255,252,245)`、思源宋体**；无编辑元素。测试后配置已按备份逐字节还原（sha256 `dc9a40a3…`）。
- 既有告警（非本次引入）：加载期 `Maximum recursive updates exceeded in <WorkbenchShellLayout>` 为 w00028 t02 记录的既有现象；本次探针每次仅 1 条，与改动无关。

## 执行位置

`.worktree/w00035-focus-reader-view`，分支 `feat/w00035-focus-reader-view`。
