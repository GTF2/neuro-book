---
schema: nbook.task/v2
taskId: t08-runtime-application
---

# 运行实例内核与环境适配

## 目标与范围

实现第一切片的收口单元 [runtime.application](../../../../../docs/specs/runtime/application.md)：一次运行实例的创建、静态清单登记、启动门禁、业务接纳与停止；把它接到两个真实宿主——受管 Node 进程（`server/runtime/foundation/`）与浏览器页面（`app/runtime/`）——并提供同一条 `smoke:runtime-foundation` 入口按 `--host server|browser` 用受控装配在真实子进程与真实 Chromium 里验收。消费 [t05](../t05-runtime-lifecycle/README.md)、[t06](../t06-runtime-services/README.md)、[t07](../t07-runtime-plugins/README.md) 的公开入口，复用同一 `test:runtime-foundation` / `typecheck:runtime-foundation` 验证入口。

非目标：正式产品装配（`server/runtime/product-startup.ts`、`product-shutdown.ts` 与 Nuxt 插件仍走旧入口，不接线）、真实服务插件（第二片）、跨位置协议、dirty/在途关闭协商 UI、Windows 外部信号合作、把任何 Spec 晋升为 `implemented`。

## 当前状态

内核、两个适配器、合同测试、双宿主 smoke 全部通过，已在实现分支提交（本快照所在提交）。四项第一片 Spec 与注册表保持 `planned`：本 Task 的浏览器 smoke 已在真实 Chromium 跑过 `runtime.application` 的浏览器半边，但 lifecycle / services / plugins 三个 Spec 的浏览器场景只被受控清单间接覆盖，首片集成复核尚未对照 Spec 全文逐条核对。

执行位置：`.worktree/w00017-application-runtime-architecture` / `refactor/w00017-runtime-foundation`，基线 `492bc849`。

## 授权与限制

- 开发者原话「可以，继续下一步」：按整体实施路径进入环境适配，不重开架构。
- push、PR、合并各自需要明确授权；本 Task 只在实现分支工作，不动主工作区。
- 不需要产品数据库、真实 Provider 或人工浏览器验收；smoke 的 Chromium 由 playwright-core 自动驱动，临时产物只在测试支持包分配的系统 Temp。

## 公开接口摘要

调用方从三处进入，方向单向：适配器 → `runtime/application/application.ts` → t05/t06/t07。

- **内核** `createApplication(host, manifest)` / `createApplicationRegistry()`（`runtime/application/application.ts`）。
  - `HostContext {identity, stopSignal, emergency(report)}`：宿主只提供实例身份、停止来源与最小紧急输出；不扫描 cwd、不读凭据。
  - `ApplicationManifest {keys, receivers, capabilities?, plugins, gates}`：静态受信清单。`CapabilityProvider` 是以根作用域为 owner 的本地服务提供者（进程时钟、远端代理都从这里注入）；`StartupGate` 三种：`activate {entry}`、`resolve {key}`、`check {check()}`，`required` 缺省 true。
  - `Application {identity, root, assembly, plugins, startup, status(), admit(spec), stop(request?)}`：`startup` 是共享 Promise；`admit` 等同一启动结果后经根作用域 `accept`，未开放时 `rejected(startup-failed | stopping | closed)`；`stop` 幂等，`incomplete` 不映射为 closed。
  - `StartupResult = available | failed{stop} | stopped{stop}`，携带 `gates: GateOutcome[]`（`passed | failed{reason,error} | skipped`）与结构化 `failures: StartupFailure[]`（`category: manifest | gate | stopped`，`stage: register | gate`）。
  - `ApplicationRegistry {start, get, alive}`：同一 `instanceId` 存活期间共享实例；已关闭不复活，同 id 再启动得新实例。
- **后端适配** `ServerRuntimeHost.start({instanceId, manifest, signals?, process?, emergency?}) → ServerHost {application, requestStop(source), stopSource, detached}`（`server/runtime/foundation/server-host.ts`）。每个实例挂接一次进程信号监听（缺省 SIGINT/SIGTERM），停止结算后移除；`requestStop` 给控制路由、stdin 命令等其它来源使用，只有第一次生效。
- **浏览器适配** `BrowserRuntimeHost.start({instanceId, manifest, page?, emergency?}) → BrowserHost {application, destroy(), stopSource, detached}`（`app/runtime/browser-host.ts`）。`page` 缺省当前 `window`（无 DOM 时必须显式传入，否则 `TypeError`）；`pagehide` 只发出停止请求并记录 `unload`，不等待关闭结果；`destroy()` 走同一生命周期合同并返回结果。
- **smoke** `bun run smoke:runtime-foundation -- --host server|browser [--browser-executable <path>]`（`scripts/smoke/runtime-foundation.ts` + `runtime-foundation/{controlled-manifest,server-entry,browser-entry}.ts`）。

## Module 合同

1. **Owner**：runtime 拥有内核；server 拥有后端适配器；app 拥有浏览器适配器；smoke 归 scripts。
2. **Interface**：上节公开面；`bootstrap.ts` 是内核内部实现。
3. **依赖方向**：内核只允许同目录相对导入与 `../lifecycle/lifecycle`、`../services/services`、`../plugins/plugins`，测试守卫锁定且断言源码不引用 `process.` / `window.` / `document.`；两个适配器只导入 `runtime/application/application`（测试守卫锁定），浏览器适配器额外断言不含 `vue | nuxt | #imports | server/ | node:`；smoke 的浏览器 bundle 用 esbuild browser 平台打包并断言不含服务端模块。适配器用相对路径而非 `nbook/*`，避免机制验证配置依赖 `.nuxt` 生成态。
4. **数据边界**：内核只在内存维护登记、门禁与停止结果；正常停止不删除配置、Project、数据库或 Storage 记录；浏览器实例释放只撤自己的在场登记，不发共享后端的全局关闭（smoke 用在场计数端点核实 `released=win-a closes=0`）。
5. **入口**：产品尚未接线；`tsconfig.runtime-foundation.json` 与 `vitest.runtime-foundation.config.ts` 的 include 追加 `server/runtime/foundation/**`、`app/runtime/**`、smoke 目录；`package.json` 追加 `smoke:runtime-foundation`。
6. **验证**：下节命令；真实进程与真实 Chromium 由 smoke 覆盖。
7. **迁移撤销点**：全部新增文件加三处配置追加；撤销即删除四个新目录/文件并回退配置行。

## 验证命令与结果

cwd `packages/neuro-book`，HEAD `492bc849`，实现未提交时运行：

| 命令 | 结果 | 证据 |
|---|---|---|
| `bun run test:runtime-foundation` | Vitest 4.1.10，6 files / **88 passed**（lifecycle 28 + services 20 + plugins 24 + application 7 + server-host 4 + browser-host 5），exit 0 | [test-runtime-foundation.txt](evidences/test-runtime-foundation.txt) |
| `bun run typecheck:runtime-foundation` | exit 0，无诊断 | [typecheck-runtime-foundation.txt](evidences/typecheck-runtime-foundation.txt) |
| `bun run smoke:runtime-foundation -- --host server` | 18 项 PASS，exit 0；两个真实子进程（正常路径 exit 0、注入必需失败 exit 2），Windows 走 `stdin:stop` 合作停止 | [smoke-server.txt](evidences/smoke-server.txt) |
| `bun run smoke:runtime-foundation -- --host browser` | 21 项 PASS，exit 0；chromium 151.0.7922.34（playwright-core 自带 revision 1234），两个 tab + 同 tab 两实例，bundle 90.8 KiB 不含服务端模块 | [smoke-browser.txt](evidences/smoke-browser.txt) |

仓库根：`bun run docs:check` → [docs-check.txt](evidences/docs-check.txt)；`bun run governance:context -- --work w00017-application-runtime-architecture --task t08-runtime-application` → [governance-context.txt](evidences/governance-context.txt)。

smoke 在两个宿主装配**同一份**受控清单（`controlled-manifest.ts`：clock / presence 能力由宿主注入，greeter 插件依赖 clock 并贡献一条命令，可选 flaky 插件与注入的必需 check 门禁按参数加入；命令表接收者经句柄取实现）。覆盖：同一 instanceId 重复启动共享实例、门禁全部通过后接纳开放、经接纳操作调用命令、合作停止/显式销毁后关闭完成且来源正确、停止结算后监听移除、停止后接纳被拒与旧句柄不可调用、在场只释放一次、必需门禁失败不接纳且可选失败单独报告、失败后已取得资源收口、紧急输出可见且不含注入的敏感串；浏览器额外覆盖同窗口两实例隔离、另一窗口不受影响、`pagehide` 记录为 unload 进入停止、页面无未捕获错误。

测试 16 个用例覆盖：三处导入边界；并发接纳等待同一启动、能力只创建一次；必需/可选门禁失败的结果结构、紧急输出、资源收口、后续接纳拒绝；清单拒绝的插件是结构化 `manifest` 失败且门禁报 `unknown-entry`；启动完成前宿主停止 → `stopped`、余下门禁 `skipped`、迟到完成不重开、资源释放一次；停止后拒绝新业务、在途操作执行方仍在存活依赖上跑完、依赖释放失败时根报 `incomplete(blocked)` 而非 closed、重复停止同一结果；注册表共享/隔离/不复活；server 适配器的单次挂接、信号来源、结算后移除与不再触碰、`requestStop` 首次生效、显式信号列表、启动失败即结算并可同 id 重启；browser 适配器的无 window 拒绝、同窗口两实例隔离与只释放自身在场、`pagehide` 只记录 unload、启动失败结算脱敏。

## 相对 Spec 与计划的取舍

- 内核不做任何宿主探测：停止来源统一为 `HostContext.stopSignal`；宿主适配器各自拥有自己的监听并在结算后移除，内核不知道信号、页面或验收脚本的存在。
- 在途操作在停止时的语义沿用 lifecycle：等待方立即得到 `cancelled: scope-stopping`，执行方 `termination` 在存活依赖上跑完后才结算，关闭等它结束——满足 Spec「已接纳操作以及其清理仍按精确 owner 使用存活依赖」而不引入第二套取消模型。
- 能力释放失败时整实例报 `incomplete(blocked)`：能力由 services 的服务作用域持有，它 `release-failed` 停在 stopping，根作用域因未关闭子作用域报 blocked；紧急输出携带三个计数，不映射为 closed。
- smoke 在 Node（`node --import tsx`）而非 Bun 下运行：Bun 1.3.14 在 Windows 上与 playwright-core 的启动管道互不兼容（`chromium.launch` 60 s 超时，与仓库既有 playwright smoke 的做法一致）；server 子进程用同一运行器（`process.execArgv` 透传）。
- Windows 上外部进程无法向 Node 发送合作信号，server smoke 用 stdin `stop` 走 `requestStop("stdin:stop")`；POSIX 走 SIGTERM。两条路径进同一 `requestStop`。

## 未运行项

全量 `bun run test`、`nuxt typecheck`、全仓 `governance:check`、正式产品装配接线（product-startup/shutdown 退出旧入口）、POSIX 信号路径（本机 Windows）、人工浏览器验收、dirty/在途关闭协商。

## 下一步

首片集成复核：对照四项 Spec 全文逐条核对本切片证据（含真实 Chromium 半边），决定是否晋升 `runtime.lifecycle`、`runtime.services`、`runtime.plugins`、`runtime.application` 为 `implemented`，并规划产品装配接线；第二片（诊断、平台文件、SQLite）可在公共合同稳定后按整体路径并行。
