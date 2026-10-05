---
schema: nbook.task/v2
taskId: t01-reader-panel
---

# 可停靠阅读面板

行为合同见 [`docs/specs/ui/workbench-shell.md`](../../../../../docs/specs/ui/workbench-shell.md)：本 Task 按该 Spec 的 descriptor / 容器 / 视图分层新增一个视图（`nbook.reader`），沿用其呈现求值与落位记录，不改变容器与 Part 的既有合同。

## 目标与范围

把 w00035 的「阅读」从编辑器内的打开方式升级为**可停靠的工作台视图**：默认停右栏，打开章节即显示当前文档的稿面排版，可与编辑器并排——一边改稿一边看效果。

范围：

- 新增 `nbook.reader` 视图 descriptor（`product-catalog.ts`）与 factory 注册（`view-factories.ts` → `nbook.view.reader`）。
- 稿面排版抽成共享组件 `ProsePage`，编辑器内 `ReaderView` 与面板 `ReaderPanelView` 共用一份。
- 新增 `ReaderPanelView`：只读，直读 store 的活动缓冲（含未保存改动、不回写）。
- store 导出 `activeWorkspaceFile`（原本是内部计算属性）供只读消费者使用。

非目标：不改编辑器与右栏 Agent 抽屉的既有语义；不做批注、导出、朗读。

## 当前状态

实现完成，测试、门禁与浏览器实测通过，未提交。

## 关键决策

- **不声明 `requiredAuthority`**：面板读的是 store 里的活动缓冲，能不能打开文件已由打开动作求值；再要一份 authority 会把「只读预览」变成第二个权限口径。
- **空态判据与渲染同一把尺子**：`proseBody()`（剥离 frontmatter 后的 body）是唯一判据来源。初版按原文 trim 判「有正文」，导致只有 frontmatter 的文档渲染成空白而不是空态——`ReaderView.test.ts` 的空态用例暴露了它。
- **空态文案归宿主视图，排版归 `ProsePage`**：两者对「空」的说法不同（编辑器说「这篇文档还没有正文」，面板说「打开一个章节」）。
- `canToggleVisibility: false` 按当前真实能力声明（视图可见性开关还没有落账通道，与 `SHELL_FILES_VIEW` 同口径）；`canMoveView: true` 让用户能挪去左栏或底部。

## 验证

- `bun run test product-catalog view-placements view-factories`：34 通过。
- `bun run test app/components/workbench app/components/editor-workbench app/components/common app/utils/workbench`：852 通过 / 9 失败，其中 6 条为**既有基线失败**（`DesktopTitleBar`、`DesktopTitleBarChrome`、`WorkbenchPartHost`，已在未改动的基线提交上复现），3 条为本次 ReaderView 空态缺陷，已修复后 6/6 通过。
- `ReaderPanelView.test.ts` 新增 6 条：四态判定（Markdown / 无文档 / 非 Markdown / 只有 frontmatter）+ 内容跟随 + 只读无 emit。
- `bun run typecheck`：30 条错误，与主工作区基线**逐文件一致**（worktree 初跑 37 条，差额为 prisma client 未生成，`bun run generate` 后对齐）。
- `bun run governance:check`：failures/warnings 均空。
- `bun run docs:check`：0 failures / 85 warnings，与主工作区基线**条数相同**，w00039 零命中。
- **浏览器实测**（无头 chromium + 独立 State Root，端口 3010）：
  - 面板停靠右栏：`[data-leaf="right"]` 内 `.reader-panel` 实测 x=1036 / w=388 / h=798，容器 `nbook.agent` 标签在。
  - 稿面排版：`.prose-page` 计算样式 `font-family: "Source Han Serif SC"`、`font-size: 17px`、`max-width: 578px`（= 34em × 17px，与 `--reading-measure` / `--reading-size` 一致）。
  - frontmatter 未泄漏：稿面文本不含 `type: chapter`。
  - 并排语义：编辑器叶与面板同时显示同一文档。
  - 跟随切换：打开「正文」→ 面板标题「正文」；切到「手册」→ 面板标题与内容同步变为「手册」。
  - 空态：无活动文档时显示「打开一个章节即可在这里看排版。」。
  - 递归警告 8 条与 master 基线**同数同源**（`WorkbenchShellLayout`，本次改动零新增）。
- **移动能力实测**（2026-10-05，独立实例端口 3011）：
  - 面板标题的「更多 → 移动到」菜单列出「工具 / 面板」两个落点；选中「工具」后 `view:nbook.reader` 叶从右栏移到左栏，`data-container-mode` 从 `single` 变 `multiple`——**移动本身生效**。
  - 但移动后面板内容空白（section 内只剩标题）。**对照实验证明这不是本组件的问题**：把既有的 `nbook.files` 移到右栏，它以完全相同的方式丢失内容（`textLen` 194 → 2，20 秒内多次采样不恢复），而同容器里本面板正常。已另开 **w00041** 登记该外壳缺陷。
- **Lab 场景登记**（2026-10-05 补）：组件规范要求「注册进 Component Lab（fixture + 同名 `.md` + 场景）」；本 Task 新增的 `ProsePage`、`ReaderView` 初版漏了这一步，全量门禁因此报错。已补两个 `.scenes.ts` + 两个 `*Fixture.vue` 并在索引登记。

## 执行位置

已合入 master（`5fe7da69`），worktree 与分支已清理。

## 待办

无。相关的外壳缺陷（视图移动后实例丢失）见 w00041；`WorkbenchShellLayout` 的递归更新警告是既有问题，不属本 Task 范围。
