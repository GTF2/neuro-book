# Task 144 - Electron Desktop 启动与 Workbench UI 优化

## 目标

在不改变 Product、Manager、State Root、Cache Root 和 shutdown 所有权的前提下，改善 Electron 的启动感知速度和桌面工作区信息层级。本轮只收口 Electron；Tauri 保留既有合同和 headless 门禁，不再做可见 UI。

## 实现结果

- 主窗口先加载 Envelope 自带的本地启动页，Product 继续由 Manager Supervisor 在后台验证、迁移和启动。
- 顶部保留一个 36px Desktop Workbench 标题栏；书架、Project 切换、搜索占位和 Agent 面板入口都在同一条标题栏内。
- Activity Bar、右侧 Agent 面板、Dialog/ DialogWindow 和 Markdown Studio 欢迎页完成本轮布局收口。
- Dialog Full/XL 使用暗色遮罩、无 blur、统一 surface 和阴影；欢迎页在 1280×720 常见尺寸下无需滚动。

## Source / Product / Portable

- Source revision：`ab5b09a082e18e996af92079b21e9a1810f9d6dc`，`dirty=false`。
- Product Build A/B：3,242 files、134,535,097 bytes，imageId `sha256:05bf9a72e1033ba2f5a5cda7b530ebf1b53a6fbc40c3519e5d10de3f3a734a56`。
- A/B 的 tree digest、shape digest 和 3,242 个 payload 文件逐字节一致；仅 `createdAt` 与 ready marker 摘要属于允许的控制字段差异。
- Electron Portable E1/E2：ZIP 389,602,174 bytes，SHA-256 `sha256:1317c44fd971dca1245d37bec8c801d5e03c2404ea162d93173b20c7cb31c269`；固定输出逐字节一致。
- Portable payload：9,622 files、986,457,862 bytes；Bun 1.3.14、Electron 43.2.0、Tool Pack 6,293 files / 387,904,585 bytes。

详细摘要见：

- [Electron startup profile](evidence/electron-startup-profile.json)
- [Electron Portable acceptance](evidence/electron-portable-acceptance.json)

## 启动统计

定义：

- cold：Electron 和 Product 完全退出后重新启动，运行间隔 1 秒。
- warm：上一轮 graceful shutdown 完成后立即启动。

| 指标 | cold 平均 | warm 平均 |
| --- | ---: | ---: |
| 启动页可见 | 212.84 ms | 237.66 ms |
| Product ready | 4,618.96 ms | 5,173.15 ms |
| Desktop Bridge ready | 4,793.71 ms | 5,369.37 ms |
| 正式窗口 ready | 4,794.97 ms | 5,370.92 ms |

10 次可见运行全部退出码为 0，shutdown 结果均为 `graceful`。本样本中 warm 没有稳定收益，说明主要耗时仍在 Product 启动和端口 ready；没有在 Electron 壳中复制 migration 或绕过 Manager，也没有立即新开 Product Runtime 优化任务。

## 自动化与仓库外验收

- Desktop Contract：8 files / 31 tests passed。
- 相关前端测试：3 files / 10 tests passed。
- 根 typecheck、Electron bundle、Headless smoke：通过。
- Product Runtime Image self-verifier：通过，imageId 与 A/B 一致。
- 仓库外真实 Electron CDP：标题栏 y=0、高度 36px；页面从 y=36 开始；Activity Bar 48px；欢迎页无需滚动；Agent 面板打开并可调整宽度；Dialog 1120×640、遮罩 `rgba(0, 0, 0, 0.5)`、`backdrop-filter: none`、阴影存在；Project 切换通过；File → Quit graceful。
- 可见运行结束后 Electron/Product 进程、CDP 端口和 Product 端口均收口。

## 未验证与后续

- Windows 原生拖动、最大化、Snap Layout 和系统托盘本轮没有标记为通过：Computer Use 需要 app approval，而当前执行上下文没有可用的 elicitation；直接 Win32 探针也无法把后台窗口置前。
- Monaco、TipTap、SSE/WebSocket、剪贴板、下载和文件对话框未在本轮重新跑；相关既有证据仍以 Task 143 为准。
- 签名安装器、updater、WebView2 Runtime Pack、macOS 包、Docker/B/S 全矩阵和最终 Electron/Tauri 选型不属于本轮。
