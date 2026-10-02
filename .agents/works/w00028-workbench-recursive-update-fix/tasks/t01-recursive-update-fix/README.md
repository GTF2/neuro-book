---
schema: nbook.task/v2
taskId: t01-recursive-update-fix
---

# 定位关闭详情卡住并修复

## 目标与范围

- 复现路径：`/?project=xin-xiao-shuo` → 打开文件（详情面板出现）→ 关闭详情 → 编辑区应继续显示文档，不再停在加载态、标签不残留。
- 根因（已定位）：`WorkspaceFilePanel.vue` 三个明细面板的 `@close` 接到 `store.clearActiveFile()`（上游 2026-07-09 起的接线）。它把活动组的 `activePath` 清空——标签还在、正文没了，`useEditorWorkbench` 的 `busy = !document` 恒真，编辑区停在「加载中」。与递归更新风暴是两个独立缺陷：本次复现里点击关闭详情只产生 1 条无关 i18n 警告。
- 修复：明细面板关闭改为局部 `detailDismissed`（只收面板、不清活动文件），选择/打开节点与活动文件变化时复位。

## 证据

- 修复提交：`6568a8ef`。
- 单测：`WorkspaceFilePanel.test.ts` 14/14 通过，含新增回归「关闭详情只收起明细面板，不清空编辑器活动文件；重新选择节点后面板回来」。聚焦套件（`app/components/novel-ide/workspace` + `app/components/editor-workbench` + `app/components/workbench`）215 测试：214 通过；唯一失败 `WorkbenchPartHost.test.ts`「容器移动菜单」在未改动 master 上同样失败（1 failed / 20 passed），属既有基线。
- 浏览器实测（worktree dev server）：关闭详情前 `aria-busy=null`、正文在、面板在；点击后 `aria-busy=null`、无「加载中」、正文仍在、面板消失、0 报错。修复前同一路径：`aria-busy=true`、显示「加载中」、正文消失、标签残留。
- 修复后文件树点击不再爆发递归更新（3 秒内新增报错 0 条）。

## 未验证

- 页面加载期的 `Maximum recursive updates exceeded in component <WorkbenchShellLayout>` 风暴仍在（每次加载约 203 条，约 2 万次无效渲染迭代）：与关闭详情卡住无关（独立缺陷）；改视口不触发（与 `ResizeObserver → measure → rebuild` 环无关）；几何稳定、暂无用户可见损害；触发点在工作面 bootstrap 附近，根因未定位，需要带日志的插桩继续。
- 未跑全量测试套件；`[intlify] Not found 'ide.workbench.view.refreshFiles'`（每次加载 6 条）是既有 i18n 缺口，未处理。

## 执行位置

`.worktree/w00028-workbench-recursive-update-fix`，分支 `fix/w00028-workbench-recursive-update-fix`。
