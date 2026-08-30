---
schema: nbook.work/v1
workId: w00007-desktop-supervisor-portable-fix
issueId: null
---

# Desktop Supervisor Portable 修复

闭合 Windows x64 Electron Desktop Portable 在宿主机没有 Bun PATH 时的监督器启动与失败收口，并把已验证的窄化行为登记为 current `implemented` Spec、Work、Task 和可脱敏证据。

## 目标

- Portable Electron/Manager 调用方显式使用随包 `runtime/bun.exe`，不依赖宿主 PATH 中的 `bun`。
- 监督器失败沿 `beginFailure() → supervisor.disconnect() → close` 收口；Job Object 继续拥有目标进程树。
- Manager 单文件 bundle 在清除 `NODE_PATH`、隔离用户目录和 `bun --no-install` 下自包含。
- 记录实际 Portable headless smoke、包身份和未执行的 Release 门禁，不把本机 smoke 投影为完整发布通过。

## 当前规范与 Task

- 当前 Spec：[`docs/specs/desktop/supervisor-portable-runtime.md`](../../../docs/specs/desktop/supervisor-portable-runtime.md)
- 实现与验证 Task：[`t01-desktop-supervisor-portable-fix`](tasks/t01-desktop-supervisor-portable-fix/README.md)
- 历史 provenance：[`legacy Task 117`](../../../.agents/tasks/117-windows-process-tree-lifecycle/README.md)

## 已完成实现

- `9320856a`：Electron Supervisor 使用显式随包 Bun。
- `7729a441`：Manager 运行依赖内联，Portable bundle 不依赖用户机模块。
- 当前 Worktree 分支：`fix/windows-supervisor-bun`。

## 范围边界

本 Work 只覆盖 Windows x64 Portable supervisor runtime、Owned Process 生命周期和 Manager bundle 自包含。真实 Release runner、平台安装、可见 GUI/人工验收、签名、发布、部署、远端写入和数据删除不在本 Work 授权范围内。

Provider/API key 配置不属于本 Work；任何真实 Provider 请求都必须遵守现有 Global Config secret 边界和单独授权。
