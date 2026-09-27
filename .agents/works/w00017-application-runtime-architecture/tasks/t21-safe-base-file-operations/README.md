---
schema: nbook.task/v2
taskId: t21-safe-base-file-operations
---

# 安全基础文件操作

## 目标与范围

已完成本单元。既有创建、重命名/移动、删除链路继续复用安全边界；底层 `renameWorkspacePath` 显式拒绝自身后代、同路径返回真实节点而不写盘，tracked 包装对同路径不产生 History rename。复制、批量、多选、dirty 协调、回收恢复不属于本单元。

## 当前状态

已完成本单元。既有 HTTP 路由和产品 Store 已接入创建文件/目录、重命名/移动、删除；本单元补齐底层移动关系的显式判断：同路径无副作用返回实际节点，移动到自身后代在创建目标父目录前拒绝，既有目标继续排他拒绝。普通文件操作和 tracked 包装继续经过显式 `WorkspaceFileTarget`、Storage boundary 与 Project mutation guard。复制、批量、多选、dirty 协调、回收恢复不属于本单元。

## 验证证据

- `server/workspace-files/workspace-files.test.ts`：基础操作 2/2 通过；覆盖创建后读取、重命名后正文保持、同路径 no-op、同名目标拒绝、非递归目录删除、递归删除和自身后代拒绝。
- `server/workspace-files/workspace-storage-boundary.test.ts`：此前过滤运行实际为 2 passed、85 skipped，不是 85 个测试通过；该记录不作为完整 Storage 边界覆盖证据。完整合同覆盖由 [t25](../t25-files-contract-closure/README.md) 复核。
- `bun run typecheck`：Nuxt typecheck 0 diagnostics。

## 未验证边界

- HTTP 实际请求、Project stale/publicId、浏览器操作菜单与刷新后的真实页面尚未在本单元重新验收。
- 复制、多选/剪贴板、逐项批量结果、dirty/在途保存协调和跨访问方式留给后续任务。
- 两项 Files Spec 仍 `planned`，不得据此晋升。

## 边界

仅使用隔离测试临时目录与此前自建 loopback 服务；不触碰用户作品、既有服务、真实 Provider，不提交、push、部署或清理整个 Temp 根。第二版快速打开与删除恢复不纳入。
