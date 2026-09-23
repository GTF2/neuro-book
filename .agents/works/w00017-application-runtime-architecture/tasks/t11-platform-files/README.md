---
schema: nbook.task/v2
taskId: t11-platform-files
---

# 第二片：平台文件插件

## 目标与范围

按 [platform.files](../../../../../docs/specs/platform/files.md) 实现受根约束的文件能力插件：根与授予签发、相对寻址与包含校验、读写/目录项操作、watch、协作锁与关闭门禁。

非目标：workspace-files 的作品路径、事件与索引；产品既有文件访问迁移。

## 当前状态

已完成，Spec 由 [t13](../t13-services-integration-review/README.md) 晋升 `implemented`。

- 实现：`packages/neuro-book/server/features/platform-files/`（`contracts.ts`、`grants.ts`、`paths.ts`、`service.ts`、`plugin.ts`，入口 `platform-files.ts`）；watch 用 `chokidar`，锁用 `proper-lockfile`。
- 复核中修复：多个服务键共享一个服务实例时，任一键先释放即关闭服务，会让其它键的消费者清理路径拿到已关闭服务。现按键计数，只有最后一次成功释放才 `close()`，失败的释放保留以便显式恢复重试；回归测试在旧行为下得到 `incomplete`、修复后通过。
- 合同测试：`server/features/platform-files/platform-files.test.ts`（17）。进行中取消的断言已收紧：只有 `cancelled` 断言无副作用，`outcome-unknown` 不对文件存在性作承诺。

## 授权与限制

- 开发者 2026-09-23 决定第一片与第二片「等第二片完成后一起合」；本 Task 在实现分支本地推进，本地提交自主进行，push、PR、合并各自需要明确授权，本 Task 未执行。
- 只用系统 Temp 下的隔离临时根与真实文件/SQLite；未触碰产品数据、真实 Provider、迁移或人工浏览器验收。

## 证据

合并运行见 t13：[测试](../t13-services-integration-review/evidences/test-runtime-foundation.txt)、[typecheck](../t13-services-integration-review/evidences/typecheck-runtime-foundation.txt)、[组合 smoke](../t13-services-integration-review/evidences/smoke-services.txt)。

## 已知限制

Node 可移植 API 无 openat/O_NOFOLLOW，恶意并发目录替换只被缩窄与检测；watch 尽力投递；锁探测有 stale 窗口。

## 下一步

Files 功能链迁入时由 workspace-files 消费本能力，旧路径/锁工具的对应调用随该链退出。
