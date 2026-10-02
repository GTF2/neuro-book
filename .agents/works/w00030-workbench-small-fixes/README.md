---
schema: nbook.work/v1
workId: w00030-workbench-small-fixes
issueId: null
---

# 工作台小项：角色详情关闭语义与视图刷新文案

收尾 w00028 同族缺陷与一处缺失文案：角色详情关闭不再清空编辑器活动文件；补齐 `ide.workbench.view.refreshFiles` 中英文案。

## 来源与授权

2026-10-02 开发者授权执行计划（`.local/PLAN.md` 待办 4）中的低优先小项：① 核查 `clearActiveFile` 其他调用路径是否留下永久「加载中」；② 补缺失的 `ide.workbench.view.refreshFiles` i18n 键。本 Work 只做这两项，均为最小附加式改动。

## 范围与非目标

- 只改 `app/components/novel-ide/workspace/WorkspaceCharacterPanel.vue` 的明细关闭接线（与 w00028 t01 的 `WorkspaceFilePanel` 修复同构）与 `app/i18n/locales/{zh-CN,en-US}.ts` 一处键。
- 不改 `app/stores/novel-ide.ts` 的 `clearActiveFile` 语义；不动其内部调用点（项目切换等属正常状态转移）。
- 不重写面板与工作台布局。

## 当前 Task

| Task | 当前范围 |
|---|---|
| [t01](tasks/t01-workbench-small-fixes/README.md) | 已交付并验证：角色详情关闭不再清空活动文件 + `refreshFiles` 文案 |

已收尾：6e70dcb8；待清理：无（2026-10-02 清理完成：worktree 与分支均已删除）。
