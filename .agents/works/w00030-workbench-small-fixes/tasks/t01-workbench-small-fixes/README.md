---
schema: nbook.task/v2
taskId: t01-workbench-small-fixes
---

# 角色详情关闭语义 + refreshFiles 文案

## 目标与范围

- `app/components/novel-ide/workspace/WorkspaceCharacterPanel.vue`（工具面板「角色」页签）：`WorkspaceCharacterDetailPanel` 的 `@close` 现在接 `store.clearActiveFile()`，会清空活动组的 `activePath`，编辑区随即停在「有标签、无正文」的加载态——与 w00028 t01 修的 `WorkspaceFilePanel` 同类缺陷。改为局部 `detailDismissed`（只收面板），选择/打开节点与活动文件变化时复位；补回归测试。
- `app/i18n/locales/{zh-CN,en-US}.ts` 的 `ide.workbench.view` 段补 `refreshFiles`（`SHELL_FILES_REFRESH_COMMAND.titleKey`；当前每次页面加载报 5 条 intlify 缺失警告）。

## 验证

- 新增 `WorkspaceCharacterPanel.test.ts`（关闭不清活动文件；重新选择后明细回来），跑 `app/components/novel-ide/workspace` 套件。
- 无头探针确认加载警告里不再出现 `ide.workbench.view.refreshFiles`。

## 证据

（待填）

## 未验证

（待填）

## 执行位置

`.worktree/w00030-workbench-small-fixes`，分支 `fix/w00030-workbench-small-fixes`。
