---
schema: nbook.task/v2
taskId: t06-runtime-services
---

# 服务装配与依赖解析

## 目标与范围

实现第一切片的第二个单元 [runtime.services](../../../../../docs/specs/runtime/services.md)：类型化服务键、提供／消费声明、静态依赖检查、按提供者作用域 single-flight 的初始化、借用式解析、稳定失败与显式恢复、脱敏诊断。消费 [t05](../t05-runtime-lifecycle/README.md) 已交付的 `runtime.lifecycle` 公开入口，复用同一 `test:runtime-foundation` / `typecheck:runtime-foundation` 验证入口。

非目标：`runtime.plugins`（描述目录、激活合并、贡献事务）、后端／浏览器环境适配、产品服务接线、`smoke:runtime-foundation` CLI；不改 `package.json` 版本、exports、依赖；不把任何 Spec 晋升为 `implemented`。

## 当前状态

机制、合同测试与临时 smoke 全部通过，已在实现分支提交：`c8d7000e`（lifecycle 追加 `parent`/`summarizeFailure` 导出）与本快照所在的 services 提交。`docs/specs/runtime/services.md` 与注册表保持 `planned`：Spec 场景 9（两个 host 复用）只在 Node 宿主用 `location: "browser"` 跑过同装配对照，没有真实浏览器证据。

执行位置：`.worktree/w00017-application-runtime-architecture` / `refactor/w00017-runtime-foundation`，基线 `3defd3dc`（t05 第二个提交）。

## 授权与限制

- 开发者原话「开始 services Task」：按整体实施路径与 Spec 实现，不重开架构。
- push、PR、合并各自需要明确授权；本 Task 只在实现分支工作，不动主工作区。
- 不需要产品数据库、真实 Provider 或浏览器；只操作测试支持包分配的系统 Temp。

## 对 t05 的追加改动

`runtime.lifecycle` 追加一个只读字段 `Scope.parent: Scope | null`（`contracts.ts`、`scope.ts`），并从 `lifecycle.ts` 导出既有的 `summarizeFailure(error): FailureError`。都是纯新增：寿命合法性与祖先链检查需要沿父引用遍历，诊断脱敏复用同一摘要规则。28 条 lifecycle 测试未改动且仍通过。

## 公开接口摘要

调用方只从 `packages/neuro-book/runtime/services/services.ts` 进入：`defineServiceKey<T>(name)`、`createServiceAssembly(instance, {keys, observer?})`、`export type *`。

- **服务键**以对象身份比较，`name` 只用于诊断；装配只接受 `options.keys` 登记表里的键，其它键的声明被拒绝（`unknown-key`）。
- **声明**：`declare(ProviderDeclaration | ConsumerDeclaration)` → `accepted | rejected(duplicate-id | unknown-key | location-mismatch | foreign-scope | scope-not-alive)`。登记不实例化。消费者登记时在其声明作用域下建一个专属子作用域承载借用。
- **报告**：`report()` 纯查询，返回每个入口的依赖判定（`satisfied | missing | unreachable | conflict | provider-rejected`）、问题（`conflict | cycle | missing-required | rejected-dependency`）与 `usable | rejected`。候选提供者只在入口作用域或其祖先上；同一祖先链上的同键提供者全部隔离；环含可选边，环内提供者全部拒绝；必需失败沿必需边反向传播到不动点。
- **解析**：`access(entryId, scope?)` → `ServiceAccess.resolve(key, {signal?})`。`scope` 缺省为消费者专属子作用域；给出时必须是入口声明作用域的严格后代（操作级作用域），提供者必须给出。结果联合：`resolved {instance, binding}` 或 `unavailable {reason, providerId, error, path}`，reason 为 `entry-rejected | undeclared-dependency | missing-provider | scope-lifetime | conflict | provider-rejected | dependency-cycle | dependency-unavailable | initialization-failed | provider-stopped | consumer-stopped | cancelled`。键自身的问题优先于入口整体被拒。
- **初始化**：首次解析在提供者 owner 作用域下新建服务作用域 `service:<key>#<n>` 作为代次；必需依赖先解析并作为实例的 `dependsOn`，再以 `scope.acquire` 调 `create({scope, services, signal})`；成功后服务作用域 `open()`。并发解析共享同一尝试；`signal` 只结束本次等待。可选依赖不因声明初始化，由 `create` 内 `services.resolve` 按需取得。
- **绑定**：`ServiceBinding {key, providerId, serviceScopeId, resourceId, dependency, stale, release()}`。实例以借用登记在访问作用域上：访问作用域关闭即释放，提供者关闭时等待借用者。`dependency` 可作消费者资源的 `dependsOn`，保证消费者先于提供者释放。
- **失败与恢复**：`create` 抛错或必需依赖不可用 → 服务作用域关闭收口本次登记资源，结果稳定；`recover(providerId)` 只在上次服务作用域收口完成后重置为 `unresolved`（在途收口直接等待，已结算未完成则重试一次，返回 `closeout-incomplete`），不自动重新初始化。
- **运行时等待环**：在某服务作用域（或其后代）内发起的解析归属为该初始化的等待边；被等待方反向可达等待方时当场返回 `dependency-cycle` 并留诊断，不挂起。
- **诊断**：`diagnostics()` 只含 `instanceId/location/scopeId/key/entryId/stage/reason/error{name,message}`；observer 抛错被吞掉。

## Module 合同

1. **Owner**：runtime；实现 `runtime/services/{services,contracts,assembly,composition}.ts`，合同测试 `services.test.ts`。
2. **Interface**：上节公开面；`assembly.ts`（静态检查纯函数）与 `composition.ts` 是内部实现。
3. **依赖方向**：只允许同目录相对导入与 `../lifecycle/lifecycle`，测试守卫锁定；无顶层 I/O、单例、计时器、字符串万能定位或自动扫描。
4. **数据边界**：装配只在内存维护声明、初始化尝试与诊断；实例是 lifecycle 服务作用域的资源，实际 I/O 由提供者执行。
5. **入口**：产品尚未接线；测试经 t05 建立的 `vitest.runtime-foundation.config.ts`（include `runtime/**/*.test.ts` 已覆盖）与 `tsconfig.runtime-foundation.json`。
6. **验证**：下节命令；真实浏览器与后端进程门禁归后续环境适配 Task。
7. **迁移撤销点**：全部新增文件加 lifecycle 两处纯新增导出；撤销即删除 `runtime/services/` 并回退 `Scope.parent` / `summarizeFailure` 导出。

## 验证命令与结果

cwd `packages/neuro-book`，HEAD `3defd3dc`，实现未提交：

| 命令 | 结果 | 证据 |
|---|---|---|
| `bun run test:runtime-foundation` | Vitest 4.1.10，2 files / 48 passed（lifecycle 28 + services 20），exit 0 | [test-runtime-foundation.txt](evidences/test-runtime-foundation.txt) |
| `bun run typecheck:runtime-foundation` | exit 0，无诊断 | [typecheck-runtime-foundation.txt](evidences/typecheck-runtime-foundation.txt) |
| 临时 smoke（`bun run` 系统 Temp 脚本，已删除） | 15 项检查全部 PASS，exit 0，进程自然退出 | [smoke-services.txt](evidences/smoke-services.txt) |

仓库根：`bun run docs:check` → [docs-check.txt](evidences/docs-check.txt)；`bun run governance:context -- --work w00017-application-runtime-architecture --task t06-runtime-services` → [governance-context.txt](evidences/governance-context.txt)。

smoke 用公开入口装配真实 `setInterval` 时钟服务、依赖它并向 scratch 文件追加写的 logger 服务、一次失败后恢复的 flaky 服务：并发首次解析只初始化一次、操作级作用域借用精确代次、稳定失败与 `recover`、根关闭时 logger 先于 clock 释放、旧绑定 stale、定时器停止。

测试 20 个用例覆盖：导入边界、键身份、声明校验五种拒绝、访问作用域规则、Spec 验收 1（并发 single-flight、子作用域命中祖先实例、兄弟作用域与另一实例隔离、等待方取消）、2（缺依赖闭包、可选缺失、必需依赖初始化失败传递）、3（重复提供隔离）、4（静态环、运行时等待环）、5（失败稳定与恢复、恢复不与 pending 收口并发、owner 停止时迟到成功不发布）、6（长寿命不得解析短寿命、操作级借用、消费者先于提供者释放）、7（精确 factory 绑定与换代 stale）、8（诊断脱敏与 observer 异常隔离）、9（server/browser × 实例级/操作级）。

## 相对 Spec 与计划的取舍

- 实例代次用「服务作用域」表达而不是单独的 generation 计数：每次初始化尝试新建一个 lifecycle 子作用域，`create` 期间登记的资源随失败整体收口，成功后与实例同寿命；`stale` 就是该作用域离开 `available`。
- 消费者不直接持有实例句柄，而是借用：寿命合法性由 lifecycle 的借用规则（不能借后代资源）与静态检查的祖先链候选共同保证；"长寿命捕获短寿命实例"在 `access` 的严格后代校验处被拒。
- 可选依赖不预解析：预解析会让"声明可选"变成"总是初始化"，违反第 9 条"不因查询或登记而实例化"。
- 运行时等待环只能经"提供者 `create` 内通过其它入口的访问"形成（解析只允许声明过的键，声明边已在静态图里）；实现保留等待边检测而不是依赖静态检查兜底。
- `recover` 对收口未完成只重试一次并报告，不轮询。

## 未运行项

全量 `bun run test`、`nuxt typecheck`、全仓 `governance:check`、真实浏览器宿主与 Spec 场景 9 的浏览器半边、后端真实进程 smoke、与 `runtime.plugins` 激活 single-flight 的协作（plugins 尚未实现）。

## 下一步

按本 Task 的实际接口创建 plugins 单元（t07）；`runtime.services` 晋升需要首片集成证据覆盖 Spec 全文，含真实浏览器宿主。
