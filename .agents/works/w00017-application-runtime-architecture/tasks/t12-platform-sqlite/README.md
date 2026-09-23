---
schema: nbook.task/v2
taskId: t12-platform-sqlite
---

# 第二片：SQLite 机制插件

## 目标与范围

按 [platform.sqlite](../../../../../docs/specs/platform/sqlite.md) 实现受管 SQLite 机制：具名资源 owner 登记、文件身份判等、借用与事务、提交结果区分、代次与关闭门禁。

非目标：领域 schema 与迁移、应用库/Project 库/历史库/RAG 库迁入、Prisma/libsql 适配器。

## 当前状态

已完成，Spec 由 [t13](../t13-services-integration-review/README.md) 晋升 `implemented`。

- 实现：`packages/neuro-book/server/features/sqlite/`（`contracts.ts`、`location.ts`、`driver.ts`、`service.ts`、`plugin.ts`，入口 `sqlite.ts`）；缺省驱动 Node 内置 `node:sqlite`，URL 定位复用 `server/runtime/app-sqlite-location.ts` 的形态与越界校验。
- 与实施计划的差异：计划写「使用现有 libsql/Prisma 资源工具」；实现改用 `node:sqlite` 作为缺省驱动，驱动差异收在 `SqliteDriver` 边界，Prisma/libsql 适配器随首个领域消费者接入。原因：机制验收需要逐连接控制事务与关闭，`node:sqlite` 无额外依赖。
- 合同测试：`server/features/sqlite/sqlite.test.ts`（9）；复核补了目录链接别名定位同一文件被拒绝为第二 owner 的用例（验收 10）。

## 授权与限制

- 开发者 2026-09-23 决定第一片与第二片「等第二片完成后一起合」；本 Task 在实现分支本地推进，本地提交自主进行，push、PR、合并各自需要明确授权，本 Task 未执行。
- 只用系统 Temp 下的隔离临时根与真实文件/SQLite；未触碰产品数据、真实 Provider、迁移或人工浏览器验收。

## 证据

合并运行见 t13：[测试](../t13-services-integration-review/evidences/test-runtime-foundation.txt)、[typecheck](../t13-services-integration-review/evidences/typecheck-runtime-foundation.txt)、[组合 smoke](../t13-services-integration-review/evidences/smoke-services.txt)。

## 已知限制

`node:sqlite` 在当前 Node 输出 ExperimentalWarning；文件 owner 唯一性只在单运行实例内协作登记。

## 下一步

首个领域数据库迁入时接 Prisma/libsql 适配器并按 owner 作用域登记。
