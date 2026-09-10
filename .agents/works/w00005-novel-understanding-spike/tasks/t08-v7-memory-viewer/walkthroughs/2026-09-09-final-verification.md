# V7 查看器恢复交付与验证

2026-09-09。Tasker 恢复上一会话未完成的构建与实际浏览器验收。使用 t07 已冻结的两章金标：615 节点、163 段，数据 SHA-256 `28995d9322fc262eaaa8763a9a27ff00602e48cf4f578b3e4645677eadc649b6`。

## 交付结果

`viewer-v7.html` 内嵌唯一 schema 校验器、金标、脚本、CSS 和 Lucide 图标，直接离线打开。实体摘要、局部/全图、类型和状态过滤、读者/角色知情投影、阅读边界、论证与原文回链、章节叙事、JSON 导入导出均已实际运行。

本次恢复修复 `package.json` 浏览器入口：使用 Node + tsx 执行 Playwright。浏览器 profile 明确放入仓库测试支持包分配的临时根，启动也在 finally 清理边界内。新增默认首屏和 su 局部图截图；按稳定实体 ID 定位，避免投影显示名称改变导致验收失败。截图检查后修正选中目录行的文字对比，并将完整边类型图例改为默认折叠，缩短窄屏图谱到详情的距离。

最终 HTML：905589 bytes；两次连续构建 SHA-256 均为 `42d6d5e741b87ca8724250ffa4f4489f94476e1c27b8a5b234d80380ebb92ee1`。

## 已运行检查

- `bun run typecheck`：退出 0，strict 类型检查通过。
- `bun run test`：退出 0，4 项聚焦测试通过，涵盖过滤、孤立节点保留、实际边局部范围和稳定布局。
- `bun run build` 连续两次：退出 0，最终字节数与哈希一致。
- `bun run browser`：最终退出 0，使用隔离的 headless Microsoft Edge。615 条可见记录逐一打开，实体摘要依赖跳转、披露原文、第一章与段落边界、角色知情投影、错误导入保留旧数据、导入导出往返、键盘焦点均通过。
- 1440、1024、768、320 像素视口无页面横向溢出。页面错误和外部 HTTP 请求均为空。

最终原始验收报告和 6 张截图：`C:/Users/NOTNOT~1/AppData/Local/Temp/neuro-book/runs/t08-v7-memory-viewer/browser-199bf964/`。报告为 `browser-result.json`；截图为 `viewer-default.png`、`viewer-protagonist-local.png`、`viewer-1440.png`、`viewer-1024.png`、`viewer-768.png`、`viewer-320.png`。报告的 HTML 哈希与上述交付一致。默认首屏和 320 窄屏经 Agent 视觉复核；不是开发者人工验收。

## 失败与边界

首次 `bun run browser` 使用 Bun 直接启动 Playwright，在 Edge 调试管道启动阶段 180 秒超时，没有进入页面。相同脚本换用 Node + tsx 后成功启动并完成交互；裸 Node strip-types 因测试支持包扩展名解析失败，因此正式入口沿用 tsx。第一次 Node 运行仅新增截图的显示名假设失败，修为稳定 ID 后通过。以上失败未记为通过。

首次 Bun 失败留有 `C:/Users/notnotype/AppData/Local/Temp/neuro-book/agent/v7-browser-z10txb`，marker owner 为已退出的 pid 41064。精确校验 owner 后清理的命令被工具策略拒绝，未绕过；按仓库既有 stale root 回收合同处理。最终成功运行的 profile、导出临时文件和受控临时根均由 finally 正常清理。未触碰用户浏览器进程。

无真实 Provider 调用、生产接入、提交、push 或部署。人工金标的完整语义质量及全书规模性能仍待开发者审查；本次浏览器验收只证明当前离线数据的查看与范围交互。
