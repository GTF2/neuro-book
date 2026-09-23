---
schema: nbook.task/v2
taskId: t07-runtime-plugins
---

# 插件描述、激活与贡献事务

## 目标与范围

实现第一切片的第三个机制单元 [runtime.plugins](../../../../../docs/specs/runtime/plugins.md)：插件定义登记与目录、按入口 single-flight 的激活、受控贡献事务（prepare → commit → 发布，失败逆序撤回）、贡献接收者五态、与 [runtime.services](../../../../../docs/specs/runtime/services.md) 的提供项协作、失败隔离、迟到阻断、显式恢复与脱敏诊断。消费 [t05](../t05-runtime-lifecycle/README.md)、[t06](../t06-runtime-services/README.md) 的公开入口，复用同一 `test:runtime-foundation` / `typecheck:runtime-foundation` 验证入口。

非目标：`runtime.application`（清单、启动门禁、跨位置协议）、后端／浏览器环境适配、真实产品插件、`smoke:runtime-foundation` CLI、热卸载；不内置命令／View／设置的领域语义；不改 `package.json`；不把任何 Spec 晋升为 `implemented`。

## 当前状态

机制、合同测试与临时 smoke 全部通过，已在实现分支提交（本快照所在提交）。`docs/specs/runtime/plugins.md` 与注册表保持 `planned`：Spec 场景 8、9 的浏览器半边只在 Node 宿主用 `location: "browser"` 跑过，没有真实浏览器证据。

执行位置：`.worktree/w00017-application-runtime-architecture` / `refactor/w00017-runtime-foundation`，基线 `e457375d`。

## 授权与限制

- 开发者原话「进入 plugins Task」：按整体实施路径与 Spec 实现，不重开架构。
- push、PR、合并各自需要明确授权；本 Task 只在实现分支工作，不动主工作区。
- 不需要产品数据库、真实 Provider 或浏览器；只操作测试支持包分配的系统 Temp。

## 对 t06 的追加改动

`ServiceAssembly` 追加纯查询 `hasKey(key): boolean`（`contracts.ts`、`composition.ts`）：插件登记要整体判定「全部接受或全部不登记」，必须在向 services 声明前预检服务键。纯新增，20 条 services 测试未改动仍通过。

## 公开接口摘要

调用方只从 `packages/neuro-book/runtime/plugins/plugins.ts` 进入：`createPluginHost(instance, assembly, {receivers, observer?})`、`provide(key, instance, release?)`、`PluginStateError`、`export type *`。

- **定义**：`PluginDefinition {id, entries[]}`；`PluginEntryDefinition {id, location, dependencies?, provides?, contributions?, activate(context)}`。贡献只是 `{capability, id, declaration}`，实现由 `activate` 的产出按 `contributions[capability][id]` 给出；提供项按 `services: ProvidedService[]` 给出。
- **接收者** `ContributionReceiver {capability, validate?, prepare?, commit?, revoke?}`：`validate` 在登记阶段纯校验；`prepare`/`commit` 在激活事务内，抛出即事务失败；`revoke(handle, prepared, reason)` 逆序调用，异常只记诊断。
- **句柄** `ContributionHandle.implementation()`：只在事务提交并发布后、且本代次仍可用时返回实现；发布前、撤回后、关闭后抛 `PluginStateError`。接收者不得缓存实现绕过门禁。
- **登记** `register(definition, {scope})` → `accepted {entries}` / `rejected {rejections[]}`；拒绝原因 `empty-id | no-entries | duplicate-plugin | duplicate-entry | unknown-receiver | duplicate-contribution | invalid-declaration | unknown-service-key | self-dependency | foreign-scope | scope-not-alive`。任一拒绝即整个定义不登记。本位置入口向 services 声明一个消费者 `plugin:<id>/<entry>@<n>` 与每个提供键一个提供者 `…:<key>`；其它位置的入口只进目录（`foreign-location`）。
- **查询**（纯）：`catalog()`、`entryState(ref)`、`contribution(capability, id)`。`EntryStatus = foreign-location | registered | activating | available | failed | stopping | closed`；`ContributionState.status = declared(not-activated | scope-closed) | activating | available | activation-failed | revoked(activation-stopped | scope-closed)`。
- **激活** `activate(ref, {signal?})` → `activated {generation, scopeId}` / `failed {stage, reason, capability, contribution, key, error, path}` / `stopped` / `cancelled` / `rejected(unknown-entry | location-mismatch | scope-closed)`。`signal` 只结束本等待方。阶段 `dependencies | activate | output | prepare | commit`；原因 `dependency-unavailable | activation-threw | missing-implementation | missing-service | undeclared-service | receiver-prepare-failed | receiver-commit-failed`。
- **恢复** `recover(ref)` → `reset | not-failed | closeout-incomplete | rejected`：等待上次激活作用域收口，未完成重试一次；同时 `recover` 本入口的 services 提供者；不自动重新激活。
- **诊断** `diagnostics()`：`{sequence, instanceId, location, plugin, entry, generation, stage, reason, capability, contribution, error{name,message}}`；observer 抛错被吞掉。

## Module 合同

1. **Owner**：runtime；实现 `runtime/plugins/{plugins,contracts,registration,host}.ts`，合同测试 `plugins.test.ts`。
2. **Interface**：上节公开面；`registration.ts`（登记纯校验）与 `host.ts` 是内部实现。
3. **依赖方向**：只允许同目录相对导入、`../lifecycle/lifecycle`、`../services/services`，测试守卫锁定；无顶层 I/O、单例、计时器、扫描或动态加载。
4. **数据边界**：目录与激活状态只在内存；激活资源归激活作用域由 lifecycle 收口；持久记录归领域，本机制不删除。
5. **入口**：产品尚未接线；测试经 t05 建立的 `vitest.runtime-foundation.config.ts` 与 `tsconfig.runtime-foundation.json`。
6. **验证**：下节命令；真实浏览器与后端进程门禁归环境适配 Task。
7. **迁移撤销点**：全部新增文件加 services 一处纯新增方法；撤销即删除 `runtime/plugins/` 并回退 `hasKey`。

## 验证命令与结果

cwd `packages/neuro-book`，HEAD `e457375d`，实现未提交时运行：

| 命令 | 结果 | 证据 |
|---|---|---|
| `bun run test:runtime-foundation` | Vitest 4.1.10，3 files / **72 passed**（lifecycle 28 + services 20 + plugins 24），exit 0 | [test-runtime-foundation.txt](evidences/test-runtime-foundation.txt) |
| `bun run typecheck:runtime-foundation` | exit 0，无诊断 | [typecheck-runtime-foundation.txt](evidences/typecheck-runtime-foundation.txt) |
| 临时 smoke（`bun run` 系统 Temp 脚本，已删除） | 27 项检查全部 PASS，exit 0，进程自然退出 | [smoke-plugins.txt](evidences/smoke-plugins.txt) |

仓库根：`bun run docs:check` → [docs-check.txt](evidences/docs-check.txt)；`bun run governance:context -- --work w00017-application-runtime-architecture --task t07-runtime-plugins` → [governance-context.txt](evidences/governance-context.txt)。

smoke 用公开入口装配一个真实命令接收者（自维护命令表、经句柄取实现）和三个插件：clock（提供 `clock` 服务，真实 `setInterval`）、logger（依赖 clock、提供 `logger`、命令向 scratch 文件追加写）、broken（激活抛错）。覆盖登记不激活、重复登记拒绝、激活前命令不可调用、logger 并发触发合并且 clock 经依赖解析只激活一次、两次命令独立执行、broken 失败不影响 logger、诊断只含 name/message、失败稳定、root 关闭时 logger 先于 clock 撤回、关闭后命令不可调用而描述保留、重复关闭同一结果、已关闭作用域拒绝再触发、日志文件不被删除。

测试 24 个用例覆盖：导入边界、宿主与接收者约束、登记 12 种拒绝整体生效且不向 services 留部分声明、目录描述与其它位置入口、Spec 验收 1（解析触发激活、三个等待方共享一次）、2（激活一次执行两次、等待方取消）、3/8（server/browser 分别激活、同位置两入口独立）、4/7（A 失败不撤 B、失败诊断脱敏、失败稳定；操作级作用域关闭撤回并释放、重复关闭、根必需插件不受影响、关闭后拒绝再触发）、5（等待期间作用域关闭时迟到成功不发布且资源收口、新作用域重登记得新代次、未激活入口关闭后拒绝）、6（五态、缺实现即失败）、9（server/browser × root/operation）、10（收口完成前 recover 不结算、之后新代次成功；经服务解析触发的失败与 recover 同步重置提供者）、11（第二接收者 prepare 失败时第一接收者撤回不可调用、commit 时刻仍未发布、成功路径顺序）、必需依赖不可用与 `require`、提供项交付 services 后只释放一次与旧绑定 stale、产出未声明键即失败、observer/revoke 异常隔离。

## 相对 Spec 与计划的取舍

- 代次 = 每次激活新建的 lifecycle 子作用域 `plugin:<id>/<entry>#<n>`：依赖借用、入口登记资源、发布记录都挂在上面；失败整体收口，正常关闭由 lifecycle 级联推进，发布记录资源的释放即撤回贡献（逆序、幂等）。代次号跨登记单调递增，新作用域重登记得到新代次。
- 提供项协作：登记阶段向 services 声明提供者，其 `create` 触发或加入入口激活并等待结果，成功后把实例交给服务作用域，并在激活作用域上登记一条"关闭服务作用域"的租约资源，使本代次关闭级联到服务代次；实例只释放一次（交付后由服务作用域释放，未交付由激活产出释放）。入口自身不等待自己的提供项。
- 事务分 `prepare`（按声明顺序）与 `commit`（全部准备成功后按序）两阶段，失败逆序 `revoke` 全部已准备项；发布在同步段内核对作用域仍为 `creating` 后完成，之后 `open()`。这满足 Spec 5/11 而不要求跨接收者原子快照。
- 已结算且实例已离开可用的代次（停止、关闭、失败后 owner 已关闭）再触发一律 `rejected: scope-closed`，不返回旧结果、不复活。
- 缺失实现或提供项、产出未声明的键都是 `output` 阶段失败：不接受空 handler 或占位。

## 未运行项

全量 `bun run test`、`nuxt typecheck`、全仓 `governance:check`、真实浏览器宿主与 Spec 场景 8/9 的浏览器半边、后端真实进程 smoke、启动必需能力失败的宿主门禁（归 `runtime.application`）。

## 下一步

环境适配已由 [t08](../t08-runtime-application/README.md) 完成（`runtime.application` 内核、后端与浏览器适配模块、同一 smoke 入口在真实子进程与真实 Chromium 各跑一次）。三项机制 Spec 晋升仍需首片集成复核对照 Spec 全文核对证据。
