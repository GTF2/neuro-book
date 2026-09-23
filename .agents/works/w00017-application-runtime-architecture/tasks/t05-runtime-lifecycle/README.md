---
schema: nbook.task/v2
taskId: t05-runtime-lifecycle
---

# 资源生命周期与独立验证入口

## 目标与范围

实现第一切片的首个独立单元 [runtime.lifecycle](../../../../../docs/specs/runtime/lifecycle.md)：调用方能创建运行实例与作用域、登记资源和受管获取、接纳操作、借用其它作用域的资源，并关闭或显式恢复失败收口；阶段、owner、借用者与结果可查询。同时建立不依赖 Nuxt 生成态与产品初始化的机制测试／类型检查入口。

非目标：`runtime.services`、`runtime.plugins`、后端／浏览器环境适配、产品启动与关闭入口接线、Lab／Files／Settings；不修改现有全量 vitest／nuxt 配置，不改 `package.json` 版本、exports、依赖；不把任何 Spec 晋升为 `implemented`。[整体实施路径](../../implementation-plan.md) 拥有切片顺序，[Work](../../README.md) 拥有授权与 checkout。

## 当前状态

机制、合同测试与独立验证入口已实现并提交：`a03c7169`（独立验证入口）、`3defd3dc`（机制、测试、文档与证据）。`docs/specs/runtime/lifecycle.md` 与注册表保持 `planned`：Spec 场景 6（同一装配在真实浏览器宿主复用）没有浏览器证据，只在 Node 宿主用 `location: "browser"` 跑过同装配对照。[t06](../t06-runtime-services/README.md) 追加了只读字段 `Scope.parent` 与 `summarizeFailure` 导出，见其快照。

执行位置：`.worktree/w00017-application-runtime-architecture` / `refactor/w00017-runtime-foundation`，基线 `411449ec4c1fbc57cceaeb7aa9d2385132a0d3e0`（master 含 w00003 合并 `bb688931` 与七项 Spec `bc144b2d`）。

## 授权与限制

- 开发者已拍板：本 Task 是实现而非再次架构设计；实施计划已批准；提交授权为「拆两个原子提交」，只在 worktree 分支提交，不 push、不 PR、不合并、不动主工作区。
- 本 Task 不需要产品数据库迁移、真实 Provider 或浏览器；只操作测试支持包分配的系统 Temp。
- 子代理只允许外部 `omp` CLI（其次 `codex exec`）；收口阶段未派子代理。

## 公开接口摘要

调用方只从 `packages/neuro-book/runtime/lifecycle/lifecycle.ts` 进入：`createRuntimeInstance(identity, options?)`、`export type *`、`LifecycleStateError`。

- 阶段：`creating | available | stopping | closed`。「关闭未完成」是 stopping 阶段里 `CloseResult.status === "incomplete"`，不是第五阶段。
- `Scope`：`createChild`、`open`、`register`、`acquire`、`borrow`、`accept`、`close(request?)`、`recover(request?)`、`snapshot`；`stopSignal` 进入 stopping 即 abort。
- `CloseRequest.deadline?: AbortSignal`：截止只让本次尝试结算为 `incomplete`（`reason: "deadline"`），已在跑的释放继续，不撤销、不重入；结算本身记录一条 `stage: "close"` 的失败。
- `recover` 另起一次关闭尝试，只重试 `release-failed` 资源；在途尝试未结算时返回同一次尝试的 Promise。
- 阶段不允许的动作抛 `LifecycleStateError`（携带 `instanceId/scopeId/phase/action`）；获取失败、取消、关闭未完成走结果联合，不抛。跨实例、借自有或后代资源抛 `TypeError`。
- 释放回调签名 `(value) => void | Promise<void>`，没有 signal。跨作用域释放顺序依赖必须先 `borrow()`，把借用句柄放进 `dependsOn`。
- 父关闭／恢复对每个子作用域每次尝试只级联一次；父在全部子作用域 closed 之前不释放自身资源。停滞的借用者让 owner 报告 `blocked`，不挂起。
- 观察者抛错被吞掉，不改变机制状态；失败记录只含 `name/message`，不含资源值。

## Module 合同

1. **Owner**：runtime；实现文件 `runtime/lifecycle/{lifecycle,contracts,scope,close-plan}.ts`，合同测试 `lifecycle.test.ts`。
2. **Interface**：上节公开面；`contracts.ts` 只导出类型与 `LifecycleStateError`，`scope.ts` / `close-plan.ts` 是内部实现，不作为公开合同。
3. **依赖方向**：机制目录只允许同目录相对导入，测试用导入边界守卫锁定不 import Vue、Nuxt、Nitro、驱动、Project、Agent；无顶层 I/O、单例、计时器。
4. **数据边界**：只在内存维护作用域、登记、借用、在途工作与失败记录；不引入持久状态，不删除持久数据。资源实际 I/O 由提供者执行。
5. **入口**：产品尚未接线；测试从 `vitest.runtime-foundation.config.ts`（include `runtime/**/*.test.ts`，setup 第一项与 globalSetup 均为 `@notnotype/neuro-book-test-support/vitest`，`oxc: false` + 显式 esbuild 转换、独立 sourcemap）与 `tsconfig.runtime-foundation.json`（`lib: ["ESNext"]`、`types: ["node"]`、`nbook/*` → `./*`、不依赖 `.nuxt`）进入。
6. **验证**：下节命令；集成门禁（真实浏览器宿主、后端进程）由后续环境适配 Task 承担。
7. **迁移撤销点**：全部为新增文件，没有旧入口被替换；撤销即删除 `runtime/lifecycle/`、两份配置与 `package.json` 两行 script。

## 验证命令与结果

cwd `packages/neuro-book`，HEAD `411449ec`，无 `.nuxt`：

| 命令 | 结果 | 证据 |
|---|---|---|
| `bun run test:runtime-foundation` | Vitest 4.1.10，1 file / 28 passed，exit 0 | [test-runtime-foundation.txt](evidences/test-runtime-foundation.txt) |
| `bun run typecheck:runtime-foundation` | exit 0，无诊断 | [typecheck-runtime-foundation.txt](evidences/typecheck-runtime-foundation.txt) |
| 临时 smoke（`bun run` 系统 Temp 脚本，已删除） | 20 项检查全部 PASS，exit 0，进程自然退出 | [smoke-lifecycle.txt](evidences/smoke-lifecycle.txt) |

仓库根：`bun run docs:check` → [docs-check.txt](evidences/docs-check.txt)；`bun run governance:context -- --work w00017-application-runtime-architecture --task t05-runtime-lifecycle` → [governance-context.txt](evidences/governance-context.txt)。

smoke 用公开入口跑真实 `setInterval` 与 `EventTarget` 订阅、两个子作用域借用、依赖借用的消费者、忽略 signal 的长操作取消、300ms 截止关闭、注入一次释放失败后两次 `recover`。首次运行两条 FAIL 均为脚本预期写错（父在子 closed 前不释放自身资源；截止结算本身记录一条 close 失败），机制未改动；证据文件含说明与脚本源码。

测试 28 个用例覆盖：导入边界、空 `instanceId`、阶段转换、可选／必需获取、观察者异常隔离、Spec 验收 1–5 与 7、关闭顺序与失败聚合、失败记录不泄露资源值、双实例与 server/browser 同装配。不再加同义用例。

## 相对原计划的取舍

- `ResourceStatus` 收成 `registered | releasing | released | release-failed`：计划里的 `blocked` 不是资源状态，改在 `CloseIncomplete.blockedReleases` 里报告阻塞来源。
- `CloseIncompleteReason` 为 `release-failed | deadline | blocked`，没有计划的 `cleanup-pending`：恢复时若仍有 pending 清理，新尝试先等待其结算再重试，而不是另立一种未完成原因。
- 释放回调不接收 signal；截止只影响本次尝试的结算，机制不假装能中断提供者的清理。
- `borrow(handle)` 接资源句柄而非 `ResourceId`；`dependsOn` 接自有资源句柄或借用句柄（`ReleaseDependency`），跨作用域依赖必须先借用，owner 因此能看到活跃借用者。
- `accept` 没有计划的 `uses`：占用关系只由借用与 `dependsOn` 表达，在途操作只以 `termination` 进入关闭门禁。
- 不建 `smoke:runtime-foundation` CLI；本 Task 的 smoke 为一次性脚本，CLI 留给环境适配单元按宿主模式建立。
- 已修的类型细节：可选链不能含 `#private`（TS18030）改为显式判空；句柄 `unwrap` 用对象重载接 `ReleaseDependency`；失败释放 mock 必须写成 `vi.fn<ReleaseResource<T>>(...)`。

## 未运行项

全量 `bun run test`、`nuxt typecheck`、全仓 `governance:check`、浏览器宿主与 Spec 场景 6、后端真实进程 smoke。全仓 `governance:check` 的既有失败结论不沿用（`34c3d5db` 之后 w00003/t14 README 已补）。

## 下一步

服务装配 Task 已创建为 [t06](../t06-runtime-services/README.md)；之后推进 plugins、环境适配与首片集成复核。`runtime.lifecycle` 晋升需要首片集成证据覆盖 Spec 全文，含真实浏览器宿主。
