---
schema: nbook.task/v2
taskId: t01-desktop-supervisor-portable-fix
role: leader
---

# Desktop Supervisor Portable 修复治理收口

## 目标

将已完成的 Windows x64 Portable Supervisor 修复补齐为可恢复的 current Work/Task/Spec 记录，并保留真实验证、未运行门禁和安全边界。

## 行为合同

当前行为合同位于 [`docs/specs/desktop/supervisor-portable-runtime.md`](../../../../../docs/specs/desktop/supervisor-portable-runtime.md)。本 Task 不另建第二份 Supervisor 合同，不改变 `graceMs + hardKillWaitMs`、Job ownership、`beginFailure() → supervisor.disconnect() → close` 或 Portable payload 边界。

## 已知实现

- `spawnOwnedProcess(spec, options?)` 接受可选 `supervisorRuntime`。
- Electron `launchProduct()`、`repairProduct()` 与 Manager GUI `runManagerCli()` 显式传入已解析的随包 Bun。
- Windows Supervisor 先建立 Job Object、设置 kill-on-close 并 self-assign，再创建目标；父侧失败收口等待 Supervisor `close`。
- Manager bundle 内联 `yaml`、`semver` 等运行依赖；packed 检查隔离 `HOME`/`USERPROFILE`、清除 `NODE_PATH` 并使用 `bun --no-install`。

## 真实验证记录

交接结果已确认：

- `packages/owned-process` 测试：2 个测试文件通过，18 项通过，3 项按平台跳过。
- `bun run --cwd packages/owned-process typecheck` 通过。
- `bun run --cwd desktop/electron typecheck` 通过。
- `bun run --cwd packages/neuro-book-manager typecheck` 通过。
- `bun run --cwd packages/neuro-book-manager pack:check` 通过；packed Manager 的 `--version` 与 `start --help` 在隔离环境中成功。
- `git diff --check` 通过。
- 修复版 Portable 在 `PATH=C:\Windows\System32;C:\Windows` 且 `LOCALAPPDATA` 位于 Portable 根外时完成 headless smoke：观察到 Manager/Product/headless ready 与 graceful shutdown，退出码为 `0`，没有 `electron-fatal`。
- 最终 Portable/Depot manifest 记录 `dirty: false`；包身份、Bun、Electron、ASAR、Product image、Manager bundle 和 Tool Pack 摘要已记录在脱敏 evidence。

## Task 产物

- [`walkthroughs/001-verification.md`](walkthroughs/001-verification.md)：实现边界、验证结果、偏差和未运行门禁。
- 所属 Work：[`w00007`](../../README.md)。
- [`docs/specs/desktop/supervisor-portable-runtime.md`](../../../../../docs/specs/desktop/supervisor-portable-runtime.md)：当前 `implemented` Spec。

## 开发者参与与授权边界

本 Task 只执行本地代码/文档验证和治理记录。没有执行真实 Release workflow、平台安装、可见 GUI/人工窗口验收、签名、发布、部署、远端 Issue/PR 写入、push、数据库迁移或数据删除。

Provider/API key 不写入 Task、Spec、evidence、命令行、日志、回显或 Git diff；真实 Provider 连通性必须在凭据轮换后经现有 Global Config secret API 单独处理。

## 完成门禁

- Work、Task、Spec 互相链接且 capability 唯一。
- Spec 九个行为章节、实现合同和证据链接完整。
- `docs:check`、`governance:check` 与 `git diff --check` 取得当前 worktree 的真实结果。
- Release runner、安装、签名、发布和人工 GUI 门禁保持明确的未运行状态。
