---
schema: nbook.task/v2
taskId: t09-foundation-integration-review
---

# 首片集成复核

## 目标与范围

对照 [runtime.lifecycle](../../../../../docs/specs/runtime/lifecycle.md)、[runtime.services](../../../../../docs/specs/runtime/services.md)、[runtime.plugins](../../../../../docs/specs/runtime/plugins.md)、[runtime.application](../../../../../docs/specs/runtime/application.md) 四份 Spec 全文，逐条核对 [t05](../t05-runtime-lifecycle/README.md)–[t08](../t08-runtime-application/README.md) 的实现、合同测试与双宿主 smoke；修复复核中发现的缺口与公开面问题；证据覆盖全部合同后把四份 Spec 从 `planned` 原地晋升为 `implemented`，并同步 Spec 注册表、总体提案能力地图与 Work 实施路径。

非目标：产品装配接线（`server/runtime/product-startup.ts`、`product-shutdown.ts`、Nuxt 插件仍走旧入口）、第二片（诊断、平台文件、SQLite）、Desktop/Worker、跨位置协议、dirty 协商参与者、push/PR/合并。

## 当前状态

已完成。四份 Spec 晋升为 `implemented`；代码缺口已修复并提交（`4d0b3c84`、`728acd40`、`b53753b9`），文档与本快照在随后的文档提交中。产品行为未切换：分支对 `packages/neuro-book` 只新增运行时机制、两个适配器、smoke 与配置（`411449ec..HEAD`：31 files changed, 8067 insertions(+), 0 deletions，另有 `package.json` 三条脚本），产品代码不导入这些模块。

执行位置：`.worktree/w00017-application-runtime-architecture` / `refactor/w00017-runtime-foundation`，基线 `2a17e85f`（t08 快照）。

## 授权与限制

- 开发者原话「可以，继续下一步。（……边做边设计边审查。如果发现架构有错误，或者灵活性不够，或者有更好的设计可以随时提出来并调整架构）」：本 Task 按此收紧公开面并修复缺口，改动都在尚无消费者的新模块内。
- 本地提交自主进行；push、PR、合并各自需要明确授权，本 Task 未执行。
- 不需要产品数据库、真实 Provider 或人工浏览器验收；smoke 的 Chromium 由 playwright-core 自动驱动，临时产物在系统 Temp 并在 finally 删除。

## 逐 Spec 复核结论

| Spec | 结论 | 覆盖 | 已知限制（写入 Spec「证据」） |
|---|---|---|---|
| `runtime.lifecycle` | 晋升 | 28 例合同测试覆盖创建中失败回滚、owner/借用、接纳与取消/终止、关闭尝试与显式恢复、截止；双宿主 smoke 经 application 走真实停止路径 | 强制终止后的「未知」由外部观察者判断 |
| `runtime.services` | 晋升 | 20 例覆盖唯一 provider、缺依赖/环、寿命与越域捕获、并发初始化共享、失败稳定、键自身原因优先；smoke 的 clock/presence 能力走真实解析与释放 | — |
| `runtime.plugins` | 晋升 | 24 例覆盖描述先登记、激活一次、贡献事务、迟到发布拒绝、局部失败、代次与普通关闭；smoke 的 greeter/flaky 插件在两宿主激活与撤回 | 不含热卸载（Spec 非目标） |
| `runtime.application` | 晋升 | 14 + 5 + 6 例（内核 / server / browser 适配器）；server smoke 25 项、browser smoke 23 项覆盖 Spec 五组验收（双宿主贯通、门禁故障、启动与关闭竞态、真实宿主事件、隔离与伸缩）与有界停止 | 产品启动链未迁入；POSIX 信号路径未在本机实测；dirty 协商由调用方在 `stop()` 前完成；Desktop/Worker 无实测 |

## 复核中的架构调整

每项都针对第二片或产品接线的真实需要，并在无消费者时收紧公开面：

1. **清单透传机制观察者**（`ApplicationManifest.observers`，`4d0b3c84`）：诊断插件须在任何插件激活前记录启动初期事件（diagnostics Spec「记录能力先于订阅」）。
2. **删除内核 `createApplicationRegistry`**（`4d0b3c84`）：实例表与监听由同一适配器持有，内核不再维护第二份表。
3. **`Application.stopped` 与 `recover()`**（`4d0b3c84`）：适配器据首次停止结算移除监听（删掉两份各自的结算复制）；恢复与 lifecycle 的显式恢复对齐。
4. **check 门禁可声明依赖**（`4d0b3c84`）：`GateCheckContext.services` 只能解析该门禁声明的键，第二片的只读检查门禁需要读服务。
5. **宿主有界停止**（`728acd40`）：此前信号触发的停止没有截止，释放挂起时 `stopped` 永不结算，进程无法有界退出，违反 Spec「程序退出信号不能被无限否决、有界终止由拥有进程的宿主执行」。新增 `HostContext.stopDeadline?: () => AbortSignal`（首次停止开始时调用一次；与调用方截止同时约束；恢复不复用），适配器 `stopTimeoutMs` 经内核 `stopTimeout(ms)` 转换。
6. **接纳拒绝原因**（`728acd40`）：启动前被宿主停止的实例此前报 `startup-failed`，现按根作用域阶段报 `stopping | closed`。
7. **紧急输出去重**（`728acd40`）：恢复加入在途关闭尝试时不再重复报告同一结果。
8. **实例身份退役**（`728acd40`、`b53753b9`）：规则收进内核 `createInstanceTable`。关闭后 id 退役，再次启动抛 TypeError（lifecycle 要求重启换新身份，诊断按实例身份归属）；`Application.closed`（首次停止或之后恢复结算为 closed）是唯一退役路径，表不再持有已关闭实例。
9. **`stopTimeout` 定时器范围**（`b53753b9`）：大于 2^31-1 的毫秒数会被运行时缩成 1ms 立即触发，现拒绝。

第 8 项的恢复关闭路径与第 9 项由独立 Reviewer 指出。Reviewer 另提出的「pagehide smoke 用合成事件」经其本人复核撤回：smoke 在真实 Chromium 的 `window` 上派发，走同一已登记监听，Spec 未要求原生导航触发。

## 验证命令与结果

cwd `packages/neuro-book`，HEAD `b53753b9`（未提交内容仅文档）：

| 命令 | 结果 | 证据 |
|---|---|---|
| `bun run test:runtime-foundation` | 6 files / **97 passed**（lifecycle 28 + services 20 + plugins 24 + application 14 + server-host 5 + browser-host 6） | [test-runtime-foundation.txt](evidences/test-runtime-foundation.txt) |
| `bun run typecheck:runtime-foundation` | exit 0 | [typecheck-runtime-foundation.txt](evidences/typecheck-runtime-foundation.txt) |
| `bun run smoke:runtime-foundation -- --host server` | 25 项 PASS，`failures=0`；三个真实子进程：正常路径 exit 0、注入必需失败 exit 2、释放挂起 + `--stop-timeout-ms=300` 结算 `incomplete(deadline)` 并 exit 3，停止请求到退出约 320 ms | [smoke-server.txt](evidences/smoke-server.txt) |
| `bun run smoke:runtime-foundation -- --host browser` | 23 项 PASS，`failures=0`；chromium 151.0.7922.34，bundle 92.2 KiB 不含服务端模块；新增有界销毁（200 ms 截止，约 206 ms 结算） | [smoke-browser.txt](evidences/smoke-browser.txt) |
| `bunx vitest run server/runtime/foundation/server-host.test.ts`（包级默认配置） | 5 passed | [server-host-default-config.txt](evidences/server-host-default-config.txt) |
| `bun run typecheck`（nuxt typecheck） | exit 0；worktree 需先 `bunx prisma generate` | [nuxt-typecheck.txt](evidences/nuxt-typecheck.txt) |
| `bun run test`（包级全量，`728acd40`） | 两次运行：11 failed / 4834 passed / 3 skipped；7 failed / 4838 passed / 3 skipped。失败全部在 master `24758741` 复现或同样间歇出现，见下节 | [full-suite.txt](evidences/full-suite.txt) |

仓库根：`bun run docs:check` → [docs-check.txt](evidences/docs-check.txt)；`bun run governance:context -- --work w00017-application-runtime-architecture --task t09-foundation-integration-review` → [governance-context.txt](evidences/governance-context.txt)。

## 既有失败（与本分支无关）

- `server/agent/profiles/{profile-compile-worker-preview,rp-profiles,simulation-director-profiles,world-engine-profile}.test.ts`：`Error: Import.path 缺少显式 NEURO_BOOK_REPOSITORY_ROOT。Product Runtime 不允许从 checkout 或 import.meta.dirname 推断仓库根。`
- `app/utils/novel-ide-settings-current-project.contract.test.ts`：master 同样失败。
- `server/agent/harness/neuro-agent-harness.test.ts`：间歇失败；master/分支交替各跑 3 次，唯一一次失败出现在 master。
- 同一组 6 个文件定向运行：master 7 failed / 207 passed，分支 8 failed / 206 passed，差值为上述 harness 抖动。

## 未运行项

全仓 `governance:check`；POSIX 真实信号路径（本机 Windows，外部进程无法合作发送信号，smoke 走 stdin `stop`，信号翻译由合同测试的进程替身覆盖）；产品装配接线；人工浏览器验收；Desktop/Worker。

## 下一步

1. 合并时机由开发者决定：本分支不改产品行为，可单独合入 master；或等第二片一起合入。
2. 第二片：`runtime.diagnostics`、`platform.files`、`platform.sqlite`，消费本片预留的清单观察者、check 门禁服务访问、`Application.recover` 与 `root.createChild`。
3. 产品装配接线随首条真实链（Files）迁移旧启动/关闭入口，旧 owner 同时退出。
