---
schema: nbook.task/v2
taskId: t13-services-integration-review
---

# 第二片集成复核

## 目标与范围

在 [t10](../t10-runtime-diagnostics/README.md)–[t12](../t12-platform-sqlite/README.md) 之上加组合 smoke（`--services`），对照 [runtime.diagnostics](../../../../../docs/specs/runtime/diagnostics.md)、[platform.files](../../../../../docs/specs/platform/files.md)、[platform.sqlite](../../../../../docs/specs/platform/sqlite.md) 全文逐条核对验收场景；修复复核发现的缺口，证据覆盖后三项 Spec 原地晋升 `implemented`，同步 Spec 注册表、总体提案能力地图与 Work 实施路径。

非目标：产品装配接线（产品启动链、`AppFileLogger`、既有数据库仍走旧入口）、Desktop/Worker、push/PR/合并。

## 当前状态

已完成。三项 Spec 晋升 `implemented`，第二片通过条件满足；产品行为未切换：产品代码中只有 `server/app-logs/logger.ts` 与两处脱敏调用方改用新的共用实现，其余新模块无产品导入。

执行位置：`.worktree/w00017-application-runtime-architecture` / `refactor/w00017-runtime-foundation`，基线 `eeeec16b`。

## 逐 Spec 复核结论

| Spec | 结论 | 覆盖 | 已知限制（写入 Spec「证据」） |
|---|---|---|---|
| `runtime.diagnostics` | 晋升 | 场景 1–8：机制 14 例、JSONL 出口 8 例（真实临时目录）、console 出口 2 例；组合 smoke 覆盖日志读回、来源身份、脱敏、`location-conflict` 降级、缺失提供者时紧急输出、门禁失败入日志 | 产品 `AppFileLogger` 不参与位置授予锁；无遥测是静态导入守卫 |
| `platform.files` | 晋升 | 场景 1–8：17 例（真实临时根，junction/symlink 链接）；组合 smoke 覆盖跨进程读回、缺失提供者无副作用、句柄未释放时 `incomplete` 与显式恢复 | 无 openat 原子保证；watch 尽力投递；锁 stale 窗口 |
| `platform.sqlite` | 晋升 | 场景 1–11：9 例（真实库文件，提交应答丢失与驱动失效用包装真实驱动注入）；组合 smoke 覆盖跨进程读回、同作用域共享与两 owner 作用域隔离、同一文件拒绝第二 owner | `node:sqlite` 实验性警告；owner 唯一性不跨进程 |

**第二片通过条件**（[实施路径](../../implementation-plan.md#切片二实施单元与验收)）：移除任一必需提供者均明确失败（smoke 三组各 6 项）；审计消费者作为独立受信插件加入未改内核；全部资源有 owner；同 scope 共享与两 scope 隔离都被测；文件与 SQLite 真实 I/O 跨进程完整运行并读回。

## 实现与复核中发现并修复的缺口

1. **`runtime.plugins` 提供项释放失败被当作已释放**（`runtime/plugins/host.ts`）：释放抛错后仍标记 released，显式恢复不再重试，资源泄漏且报告 closed。现只在释放成功后标记；回归测试（`plugins.test.ts`，第 25 例）在去掉修复时失败。
2. **platform-files 多键共享服务提前关闭**：见 [t11](../t11-platform-files/README.md)。
3. **诊断启动失败记录顺序**：必需门禁失败会在启动结果结算前触发收口，store 已关闭导致失败不入记录。新增 `recordingEmergency()` 包装宿主紧急输出，先记录再转交。
4. **JSONL 位置授予释放会删接管者的锁**：proper-lockfile 按路径释放；现取得时记录锁目录身份，释放前核对，不属于自己则只报失守。
5. 测试补强：诊断经 `createApplication` 的出口关闭失败→`incomplete`→`recover()` 只重试一次后 closed；SQLite 目录链接别名；platform-files 进行中取消的断言收紧到合同（只有 `cancelled` 证明无副作用）。

## 验证命令与结果

cwd `packages/neuro-book`，HEAD `eeeec16b` + 本 Task 未提交改动：

| 命令 | 结果 | 证据 |
|---|---|---|
| `bun run test:runtime-foundation` | 11 files / **148 passed**（lifecycle 28、services 20、plugins 25、application 14、server-host 5、browser-host 6、diagnostics 14、jsonl 8、console 2、platform-files 17、sqlite 9） | [test-runtime-foundation.txt](evidences/test-runtime-foundation.txt) |
| `bun run typecheck:runtime-foundation` | exit 0 | [typecheck-runtime-foundation.txt](evidences/typecheck-runtime-foundation.txt) |
| `bun run smoke:runtime-foundation -- --services` | 39 项 PASS，`failures=0`；scratch 在系统 Temp 并已删除 | [smoke-services.txt](evidences/smoke-services.txt) |
| `bun run smoke:runtime-foundation -- --host server` | 25 项 PASS，`failures=0`（首片回归） | [smoke-server.txt](evidences/smoke-server.txt) |
| `bun run smoke:runtime-foundation -- --host browser` | 23 项 PASS，`failures=0`（首片回归，bundle 92.3 KiB 不含服务端模块） | [smoke-browser.txt](evidences/smoke-browser.txt) |
| `bunx vitest run server/app-logs server/agent/observability server/backup` | 18 files / 114 passed（日志器与脱敏消费方回归） | [logger-regression.txt](evidences/logger-regression.txt) |
| `bun run typecheck`（nuxt typecheck） | exit 0 | [nuxt-typecheck.txt](evidences/nuxt-typecheck.txt) |

仓库根：`bun run docs:check` → [docs-check.txt](evidences/docs-check.txt)；`bun run governance:context -- --work w00017-application-runtime-architecture --task t13-services-integration-review` → [governance-context.txt](evidences/governance-context.txt)。

## 未运行项

包级全量 `bun run test`（本片只改日志器与两处脱敏导入，已跑其直接测试目录；t09 全量基线见 [t09](../t09-foundation-integration-review/README.md)）；全仓 `governance:check`；产品装配接线；人工浏览器验收；Desktop/Worker；POSIX 真实信号路径。

## 授权与限制

- 开发者 2026-09-23 决定第一片与第二片「等第二片完成后一起合」；本 Task 在实现分支本地推进，本地提交自主进行，push、PR、合并各自需要明确授权，本 Task 未执行。
- 只用系统 Temp 下的隔离临时根与真实文件/SQLite；未触碰产品数据、真实 Provider、迁移或人工浏览器验收。

## 下一步

1. 请求 push、PR 与合并授权（开发者决定两片一起合）。
2. 产品装配接线随首条真实链（Files）迁移旧启动/关闭入口：诊断出口接管产品日志位置，workspace-files 消费 platform.files，旧 owner 同时退出。
