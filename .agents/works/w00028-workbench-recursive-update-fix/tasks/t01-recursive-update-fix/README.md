---
schema: nbook.task/v2
taskId: t01-recursive-update-fix
---

# 定位自激循环并修复

## 目标与范围

- 复现路径：`/?project=xin-xiao-shuo` → 点击文件树节点 → 关闭文件详情面板 → 编辑区应正常显示文档，不再停在加载态、标签不残留。
- 现场证据（2026-10-02，master 未改动）：点击文件树后 4 秒内约 458 条报错，类型为 `Maximum recursive updates exceeded in component <WorkbenchShellLayout>`、`ResizeObserver loop completed with undelivered notifications`、`[Vue warn]: Unhandled error during execution of app errorHandler`；爆发后仍有约 10 条/秒的持续滴流。几何采样稳定（1270x720，left 340，editor 869），说明循环不改变几何、是渲染/副作用层的自激。
- 机制候选：`WorkbenchShellLayout` 的 rebuild 链（watcher → rebuild → emitFacts → 宿主 facts → 宿主重渲染 → props → watcher）与 `ResizeObserver → measure → rebuild` 两个自激环；handle 绑定链（`useEditorWorkbench` 的 `bindViewHandle` token 校验）在关闭详情后未重新绑上，busy 永久为真。

## 证据

（待填）

## 未验证

（待填）

## 执行位置

`.worktree/w00028-workbench-recursive-update-fix`，分支 `fix/w00028-workbench-recursive-update-fix`。
