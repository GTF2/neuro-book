---
schema: nbook.walkthrough/v1
taskId: t01-desktop-supervisor-portable-fix
sequence: 1
role: leader
status: verifying
createdAt: 2026-08-30T00:00:00Z
---

# Desktop Supervisor Portable 实现与验证

## 结论

Windows x64 Portable 的 Bun PATH 故障已由显式注入随包 `runtime/bun.exe` 修复；Manager bundle 的运行依赖泄漏已收口。监督器失败路径继续以 `beginFailure() → supervisor.disconnect() → close` 和 Job ownership 为最终边界。本 walkthrough 只记录当前实现和本机验证，不代表完整 Release 或平台安装通过。

## 代码与资产

- `9320856a`：`supervisorRuntime` 从 Owned Process 公共入口传到 Windows/POSIX Adapter；Electron 与 Manager Portable 调用方显式传入随包 Bun。
- `7729a441`：Manager build 删除 `yaml`、`semver` 外部化，packed 检查增加隔离环境与 `bun --no-install` 回归。
- 最终 Portable ZIP：`neuro-book-electron-portable-win-x64.zip`，SHA-256 为 `87ac1a8dccdf1d17e60e409a6816b4a2dda148dc40368a4aa2ab8e4c312cc6f9`。
- 最终 Depot ZIP：`neuro-book-desktop-depot-win-x64.zip`，SHA-256 为 `841f6fb2b5c38237e7aa0c0abfdb67f0f917862d9ccfe0c1ad995edf1f0ef797`。
- 构建身份：`imageId=sha256:9371210baf2d1bcd68bb18e0654e2e280688d4551d0f70ffb91114e5a4960a4d`，`sourceRevision=2d346ceb8aa682b724c27ee5ebce568e660fb55c`，Bun `1.3.14`，Electron `43.2.0`。

## 已验证结果

1. `packages/owned-process` 测试结果为 2 个测试文件通过、18 项通过、3 项按平台跳过。
2. 以下类型检查均通过：
   - `bun run --cwd packages/owned-process typecheck`
   - `bun run --cwd desktop/electron typecheck`
   - `bun run --cwd packages/neuro-book-manager typecheck`
3. `bun run --cwd packages/neuro-book-manager pack:check` 通过；packed Manager 在隔离 `HOME`/`USERPROFILE`、清除 `NODE_PATH` 的环境中执行 `--version` 和 `start --help` 成功。
4. `git diff --check` 通过。
5. 无 Bun PATH 的最终 Portable headless smoke 使用 `PATH=C:\Windows\System32;C:\Windows`，并将 `LOCALAPPDATA` 放在 Portable 根外；观察到 `electron-manager-spawned`、`electron-product-ready`、`electron-headless-ready`、`electron-headless-shutdown`，graceful shutdown 退出码为 `0`，无 `electron-fatal`。
6. 一个初次 smoke 失败来自测试隔离目录错误：`LOCALAPPDATA` 位于 Portable 根内，触发既有 Manager lease containment 保护。把隔离用户数据根移到 Portable 根外后重跑通过；该失败不是包回归。

## 治理收口

- 当前 Spec：[`docs/specs/desktop/supervisor-portable-runtime.md`](../../../../../../docs/specs/desktop/supervisor-portable-runtime.md)。
- Work/Task：[`w00007`](../../README.md)、[`t01`](../README.md)。
- `docs/specs/README.md` 新增 Desktop Portable Supervisor Runtime 的 implemented 登记；完整安装状态机、UAC、更新、卸载、签名和发布仍保留在 P0 缺口。
- 结构化 evidence 不保存 API key、Authorization、Cookie、响应体、用户正文或原始日志；只保存脱敏的路径、状态、摘要和退出结果。

## 未运行项与风险

未运行：真实 Release runner、真实平台安装/卸载、可见 GUI/人工窗口关闭、签名验证、发布/部署、POSIX Release runner 和真实 Provider/Model 请求。Portable ZIP/Depot ZIP 是本机生成并验证的内部资产，不等于公开签名安装器。

剩余风险：不同 Windows 版本、系统策略、可见窗口消息循环和真实安装范围仍需受授权的宿主机门禁；Supervisor ownership 失败仍按 `hard-kill-wait` 暴露，不能由本地 smoke 推断所有故障都能强制收口。
