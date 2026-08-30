---
schema: nbook.spec/v1
kind: behavior
status: implemented
capability: desktop.supervisor-portable-runtime
owners:
  - owned-process
  - desktop-electron
  - neuro-book-manager
---

# Desktop 监督器与 Portable Runtime

本文定义 Windows x64 Electron Desktop 在 Portable 运行形态下启动和收口 Manager Supervisor 的当前行为合同。它只覆盖随包 Bun、Owned Process 监督器和 Manager bundle 自包含边界；完整安装状态机、UAC、升级、卸载及跨平台 Desktop 验收仍由规范缺口表跟踪。

## 目标与非目标

目标：

- Portable Desktop 的 Electron 宿主在宿主机没有 Bun PATH 时，仍使用 Portable 根内经过清单绑定的 Bun 启动 Manager Supervisor。
- 监督器启动失败、协议失败、控制 IPC 失败、宿主断连和主动终止都在有界窗口内收口；只有监督器 `close` 之后才提交 completion 或 ownership failure。
- Manager CLI bundle 在没有用户机 Node/Bun 依赖、清除 `NODE_PATH` 且使用 `--no-install` 时仍可运行。
- 保持 Product/Manager 的进程树由 Owned Process 统一拥有，不引入按名称扫描、父子 PID 扫描或 `taskkill` fallback。

非目标：

- 本规范不定义完整 Desktop 安装、UAC、更新、卸载、签名、发布服务器或真实用户数据删除合同。
- 本规范不把本机打包和 headless smoke 解释为 Release runner、可见 GUI、人工窗口关闭或真实平台安装已通过。
- 本规范不改变 POSIX 进程组的领域行为；它只规定跨平台入口可选的监督器 runtime 注入，以及 Windows Portable 的实际消费。

## 术语与参与者

- **Electron Envelope**：承载启动页、Desktop 页面和 Manager GUI 的 Electron 主进程。
- **Manager Supervisor**：由 Envelope 启动、通过 NDJSON 与 Envelope 交互并负责 Product 启停的 Manager CLI 进程。
- **监督器 runtime**：运行 Owned Process supervisor 源码的 Bun executable。Portable 场景是 `runtime/bun.exe`，不是依赖 PATH 的字面量 `bun`。
- **Owned Process lease**：由 `spawnOwnedProcess()` 返回的进程树所有权句柄，包含 stdio、completion 和幂等 `terminate()`。
- **Windows Job**：监督器在创建目标前建立并自加入的 Job Object；`KILL_ON_JOB_CLOSE` 负责清理目标及其后代。
- **Portable 根**：包含 `.output/`、`runtime/`、`manager/`、`desktop/`、`data/` 和 `.cache/` 的解压目录。
- **grace window / hard completion window**：目标优雅退出窗口和父侧等待监督器关闭的有界窗口；二者不是无限等待的替代名称。

## 输入与前置条件

Electron Desktop 本地启动必须满足：

- 当前平台是 Windows x64，Portable 根中的 `manifest.json`、Product Runtime Contract、Manager bundle、Electron Envelope 和 `runtime/bun.exe` 可读取并通过既有完整性检查。
- `launchProduct()`、`repairProduct()` 和 Manager GUI 的 CLI 调用把已解析的 Manager Bun 作为 `supervisorRuntime` 传给 `spawnOwnedProcess()`。
- Product/Manager 的目标命令、参数、cwd、环境和 stdio 通过 Owned Process 规范传递；监督器自身使用宿主环境，目标环境不能裁剪监督器建立 Job 所需的环境。
- Manager bundle 的依赖已经在构建阶段内联；Portable 运行不提供 `node_modules`、用户级 `NODE_PATH` 或联网安装前置条件。

`spawnOwnedProcess(spec, options?)` 的 `options.supervisorRuntime` 是可选公开输入。Desktop Portable 调用方必须显式提供它；未提供时，通用 Adapter 保留既有宿主默认选择，仅用于非 Portable 调用方，不构成 Desktop 的运行时回退。

## 输出与可观察行为

- 没有 Bun PATH 的 Portable headless 启动仍能观察到 `electron-manager-spawned`、Product ready、`electron-headless-ready` 和 graceful shutdown，进程以退出码 0 结束，且不产生 `electron-fatal`。
- Manager Supervisor 的 stdout/stderr 仍是目标输出通道；控制协议走独立 IPC，不把监督消息混入 Product NDJSON。
- 目标正常结束后，监督器先关闭 Job handle，再报告 completion；目标留下的受管后代由 Job 清理，不把直接 child 退出误报为完整树已释放。
- 主动终止的 completion 带有调用方提供的 `timeout`、`abort`、`cancel`、`shutdown`、`startup-failure` 或 `host-disconnect` 原因；自然退出不伪造 termination reason。
- Supervisor 错误在监督器 `close` 前不会被父侧提前当作最终 completion；无法在窗口内观察到 `close` 时返回 `OwnedProcessError`，其 `stage` 为 `hard-kill-wait`。

## 状态与转换

| 当前状态 | 事件 | 下一状态 | 可观察结果 |
| --- | --- | --- | --- |
| 未启动 | `spawnOwnedProcess()` 发送 `start` | 启动中 | 监督器先创建并配置 Job，再创建目标；失败即拒绝启动未受管目标。 |
| 启动中 | 监督器发送 `ready` | 运行中 | 父侧获得 lease；目标输出和控制 IPC 保持分离。 |
| 运行中 | `terminate(reason)` | 终止中 | 只发送一次终止请求；重复调用返回同一个 completion。 |
| 运行中 | supervisor error、非法协议或 control IPC 失败 | 失败收口中 | `beginFailure()` 保留第一个错误，安装一个 watchdog，并断开监督 IPC。 |
| 失败收口中 | supervisor 收到 disconnect | Job 收口中 | 监督器以 `host-disconnect` 执行 Job 的强制清理；不依赖 PID 扫描。 |
| 终止中或 Job 收口中 | Supervisor 报告终态并 `close` | 已完成或已失败 | 父侧先观察 `close`，再 resolve completion 或 reject 原始 ownership error。 |
| 任意未收口状态 | `graceMs + hardKillWaitMs` 到期且没有 `close` | ownership failure | 父侧以 `hard-kill-wait` 失败；不宣称树已安全终止。 |

并发语义：同一 lease 只有一个终态、一个 watchdog 和一个终止请求；迟到的 message、error、close 或 disconnect 不能改写已提交结果。不同 lease 的 Job 独立，终止一个 lease 不影响另一个 lease。

## 副作用与数据

- 每个 Windows lease 创建一个监督器 Job、一个目标进程树、一个控制 IPC 和按调用方声明的 stdio 管道；lease 结束时清理 timer、IPC listener、Job handle 和受管后代。
- Portable payload 固定包含 `runtime/bun.exe`、`manager/neuro-book.mjs`、Electron runtime、Product Image、Tool Pack 和安装清单；manifest 记录 Bun、Envelope、ASAR、Product image、Manager bundle 和工具摘要。
- Manager bundle 构建时内联 `yaml`、`semver` 等运行依赖；packed 验证在隔离 `HOME`/`USERPROFILE`、清除 `NODE_PATH` 的环境中运行 `bun --no-install`。
- 日志只记录阶段、终止原因、监督器阶段和 OS error 等诊断字段，不记录完整用户命令、秘密或用户正文。

## 失败与恢复

- Portable 缺少 Manager、Bun、清单或 Product Runtime 时，在创建 Product 目标前 fail closed；不把缺失的随包 runtime 静默替换为宿主 PATH 的 `bun`。
- `beginFailure()` 只保留第一个错误，设置一次 `graceMs + hardKillWaitMs` watchdog，并在 IPC 仍连接时调用 `supervisor.disconnect()`。监督器的 disconnect handler 进入 `hardTerminate("host-disconnect")`，关闭 Job 或返回带 Win32 error 的 ownership failure。
- 监督器已报告错误但未关闭时，父侧保留错误并等待 `close`；监督器已报告终态但未关闭时，父侧同样等待 `close`。watchdog 到期才返回 `hard-kill-wait`，不把“直接 PID 消失”当作树已收口。
- `TerminateJobObject`、Job 初始化、协议解析或 IPC 关闭失败均保留阶段和 OS error；不改用 `taskkill`、WMI、按名称终止或跨 invocation 的清理。
- Manager bundle 在隔离执行中无法加载依赖时，`pack:check` 失败；修复方式是从 canonical source 重建 bundle，不在 Portable 中联网安装或读取用户机依赖。

## 边界与兼容

- `packages/owned-process` 拥有 Job、监督器 IPC、终止状态机和 bounded completion；Electron 只选择并注入已验证的随包 runtime；Manager 只拥有 Supervisor Protocol 和 Product 业务阶段；打包器拥有 payload、manifest 和 hash。
- `supervisorRuntime` 是向后兼容的可选参数，不改变未传入时的通用 Adapter 默认行为；Desktop 三个调用点均显式注入，避免 Portable 行为依赖默认分支。
- Windows 当前合同限定 x64；POSIX Adapter 使用同一公开入口但继续维持自己的 process group 实现。完整跨平台 Desktop、安装和发布合同仍未在本 Spec 中声称完成。
- 本规范与 ADR 0013、ADR 0014 的 Manager/Envelope ownership 及离线 Depot 决策一致；旧 Task 117 仅作为历史实现 provenance，不替代本 Spec。

## 验收与 Smoke

1. **无 Bun PATH 的 Portable 启动**：Given 修复版 Windows x64 Portable ZIP，`PATH` 仅包含 `C:\Windows\System32;C:\Windows`，`LOCALAPPDATA` 位于 Portable 根外；When 运行 `desktop\NeuroBook-Electron.exe --headless`；Then Manager、Product 和本地服务依次 ready，出现 `electron-headless-ready`，graceful shutdown 结束且退出码为 0，无 `electron-fatal`。
2. **监督器失败收口**：Given supervisor error、非法协议或控制 IPC 失败；When 父侧进入 `beginFailure()`；Then 只保存首个错误、断开 supervisor、由 Job ownership 收口目标树，并在 `close` 后返回原始错误或在窗口耗尽后返回 `hard-kill-wait`。
3. **Manager 自包含**：Given packed Manager、隔离 `HOME`/`USERPROFILE`、清除 `NODE_PATH` 且禁止安装；When 运行 `--version` 和 `start --help`；Then 输出 Manager 版本并可读取启动参数，不解析用户级错误版本的 `yaml`。
4. **包身份**：Given Portable manifest 和 Depot distribution manifest；When 校验 ZIP、Bun、Electron、ASAR、Product image、Tool Pack 和 Manager 摘要；Then 路径、字节数、SHA-256、`dirty: false`、imageId 与构建身份一致。
5. **范围边界**：真实 Release runner、可见 CMD 关闭、人工 GUI、真实平台安装、签名发布和 POSIX runner 未运行时，不得把本 Spec 的本机 smoke 结果投影为这些门禁已通过。

## 实现合同

- `spawnOwnedProcess(spec, options)` 将 `OwnedProcessOptions.supervisorRuntime` 转发到 POSIX/Windows Adapter；Windows Adapter 使用显式 runtime 启动 supervisor，默认逻辑仅作为非 Portable 调用方兼容行为。
- Windows supervisor 在创建目标前建立 Job、设置 `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE` 并 self-assign；目标和后代继承 Job。父侧 `beginFailure()` 通过 disconnect 触发 supervisor 的 `host-disconnect` 收口，父侧 completion 以 supervisor `close` 为最终确认边界。
- Electron `launchProduct()`、`repairProduct()` 与 Manager GUI 的 `runManagerCli()` 分别传入 `runtimeConfig.managerBun` 或 `bunPath`；这些路径来自 Portable/Installed manifest 解析，不来自用户 PATH。
- `packages/neuro-book-manager/scripts/build.mjs` 以 Bun 单文件 bundle 内联运行时依赖；`scripts/pack-check.mjs` 在 packed 包中执行隔离环境回归。

实现入口：

- [`packages/owned-process/src/types.ts`](../../../packages/owned-process/src/types.ts)
- [`packages/owned-process/src/index.ts`](../../../packages/owned-process/src/index.ts)
- [`packages/owned-process/src/windows-adapter.ts`](../../../packages/owned-process/src/windows-adapter.ts)
- [`desktop/electron/src/main.ts`](../../../desktop/electron/src/main.ts)
- [`desktop/electron/src/manager-main.ts`](../../../desktop/electron/src/manager-main.ts)
- [`desktop/packaging/package-portable.mjs`](../../../desktop/packaging/package-portable.mjs)
- [`packages/neuro-book-manager/scripts/build.mjs`](../../../packages/neuro-book-manager/scripts/build.mjs)
- [`packages/neuro-book-manager/scripts/pack-check.mjs`](../../../packages/neuro-book-manager/scripts/pack-check.mjs)

## 证据

- 架构依据：[`ADR 0013：Desktop Envelope、发行组件与宿主交互`](../../../packages/neuro-book/docs/adr/0013-desktop-envelope-distribution-and-interaction.md)、[`ADR 0014：Electron Desktop Productization`](../../../packages/neuro-book/docs/adr/0014-electron-desktop-productization.md)。
- 进程生命周期历史依据：[`legacy Task 117`](../../../.agents/tasks/117-windows-process-tree-lifecycle/README.md)。它保留完整生命周期设计和历史 Release 门禁，但不代替当前 Spec。
- 当前实现 provenance 与验证记录：[`w00007 / t01 Desktop 监督器 Portable 修复`](../../../.agents/works/w00007-desktop-supervisor-portable-fix/tasks/t01-desktop-supervisor-portable-fix/README.md)、[`验证 walkthrough`](../../../.agents/works/w00007-desktop-supervisor-portable-fix/tasks/t01-desktop-supervisor-portable-fix/walkthroughs/001-verification.md)。
- 合同测试：`packages/owned-process` Windows Adapter 测试共 18 项通过、3 项按平台跳过；Manager `pack:check` 的隔离 packed 检查通过。
- 实际命令证据：Owned Process 聚焦测试、Owned Process/Electron/Manager typecheck、Manager `pack:check`、`git diff --check`、Portable 打包和无 Bun PATH headless smoke 均记录在当前 Task walkthrough；真实 Release workflow、可见 GUI、平台安装和人工验收保持未运行。
