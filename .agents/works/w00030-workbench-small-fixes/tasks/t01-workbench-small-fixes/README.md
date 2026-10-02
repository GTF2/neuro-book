---
schema: nbook.task/v2
taskId: t01-workbench-small-fixes
---

# 角色详情关闭语义 + refreshFiles 文案

## 目标与范围

- `app/components/novel-ide/workspace/WorkspaceCharacterPanel.vue`（工具面板「角色」页签）：`WorkspaceCharacterDetailPanel` 的 `@close` 现在接 `store.clearActiveFile()`，会清空活动组的 `activePath`，编辑区随即停在「有标签、无正文」的加载态——与 w00028 t01 修的 `WorkspaceFilePanel` 同类缺陷。改为局部 `detailDismissed`（只收面板），选择/打开节点与活动文件变化时复位；补回归测试。
- `app/i18n/locales/{zh-CN,en-US}.ts` 的 `ide.workbench.view` 段补 `refreshFiles`（`SHELL_FILES_REFRESH_COMMAND.titleKey`；此前每次页面加载报 5 条 intlify 缺失警告）。

## 证据

- 修复提交：`61951fae`。
- 单测（worktree）：`bun run --cwd packages/neuro-book test app/components/novel-ide/workspace` → 2 文件 / 15 测试全通过，含新增 `WorkspaceCharacterPanel.test.ts`「关闭详情只收起明细面板，不清空编辑器活动文件；重新选择节点后面板回来」。
- 无头探针（worktree dev server，`bun .local/i18n-probe.mjs`）：加载 `/?project=xin-xiao-shuo` 后 `warningCount=0`、`refreshFilesWarnings=0`、`errorCount=0`（修复前同路径每次加载 5 条 `[intlify] Not found 'ide.workbench.view.refreshFiles'`）。
- 顺带把该组件的 Nuxt 自动导入改为显式导入（`ref`/`computed`/`watch`/`onMounted`/`useI18n`），与已可测的 `WorkspaceFilePanel` 一致；运行时行为不变（同函数同调用）。

## 未验证

- 未在真实 UI 里点开工具面板「角色」页签做端到端关闭验证（组件测试覆盖接线；关闭语义与 w00028 t01 已验证过的 `WorkspaceFilePanel` 同构）。
- 未跑全量测试套件；仅跑受影响目录。

## 执行位置

`.worktree/w00030-workbench-small-fixes`，分支 `fix/w00030-workbench-small-fixes`。
