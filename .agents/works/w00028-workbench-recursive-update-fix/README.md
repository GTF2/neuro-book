---
schema: nbook.work/v1
workId: w00028-workbench-recursive-update-fix
issueId: null
---

# 工作台自激更新与关闭详情卡住修复

修掉打开文件后 `WorkbenchShellLayout` 的递归更新爆发，以及关闭文件详情面板后编辑区永久停在加载态、标签残留的缺陷。

## 来源与授权

2026-10-02 开发者报告「点开文档后点叉关闭详情，编辑区一直加载且标签还在」，并要求修复（「这个还是要修的」）。此前调查已确认：每次点击文件树都会爆发 `Maximum recursive updates exceeded in component <WorkbenchShellLayout>` 与 `ResizeObserver loop completed with undelivered notifications`，且该缺陷在未改动的 master 上同样复现（既有缺陷，非近期改动引入）。上游无对应 issue；相邻工作是 #192（Workbench / View Host 重构）。

## 范围与非目标

- 最小、附加式修复：只处理自激更新的触发链与 handle 绑定链，不重写工作台布局与视图注册。
- 不碰 `server/agent/*`；不在上游热区（component-lab / novel-ide/agent）做重构。
- 上游 #192 落地时本修复应可整体丢弃：改动保持局部、可替换。

## 当前 Task

| Task | 当前范围 |
|---|---|
| [t01](tasks/t01-recursive-update-fix/README.md) | 定位自激循环 → 最小修复 → 浏览器实测 |
