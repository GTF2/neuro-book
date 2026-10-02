---
schema: nbook.task/v2
taskId: t02-notion-theme-pilot
---

# Notion 参照主题试点

## 目标与范围

按 t01 引入的 Notion 设计参照落地一套可切换主题 `packages/nb-ui/themes/notion/`（manifest + vars.css + colorways + index，第一档格式，自带亮暗两套配色）：

- 取值方向：暖墨文字（rgb(55,53,47) 家族）、canvas 白面板、hairline 9% 墨、交互蓝 `#2383e2`、阴影基色 rgb(15,15,15)；暗色为 Notion 暖黑（#191919 桌面 / #252525 面板 / #2b2b2b 输入）。
- 两处按 design-language.md 判据的刻意偏离：层级用「发丝轮廓 + 单条环境投影」而非 Notion 的 4px/12px 中景投影（坑 #38）；CJK 字距归零、行高放松（§四）。
- 实心浮层无玻璃：`--overlay-surface` 取 `--bg-panel`，`--overlay-blur` 整条置 none（坑 #1）；实心面上高亮沿用默认 `--bg-hover`，不覆写 `--overlay-item-active`。
- 注册进 playground 装载序列与 `theme-packages.test.ts` 的 THEMES（并装断言更新为五套）。

## 行为合同

行为合同未变：只新增主题包与测试/装载注册，不改既有组件、既有主题与库实现。

## 非目标

不把 notion 注册进主应用主题切换器（铺开另行 Task）；不按 Notion 改造既有组件样式。

## 证据

- `bun run --cwd packages/nb-ui test src/theme/` → 4 文件 79 用例全绿（含 notion 的安装、vars.css 无字面色、暗色分档存在、五套并存断言）。
- `bun run --cwd packages/nb-ui typecheck` → 干净通过。
- playground（localhost:3000）浏览器实测：Notion × Light/Dark 两档截图与计算样式取证——radius 8/12px、`--overlay-surface` 实心、`--overlay-blur` none、暗色 elevation 换重配方、bg-input(#2b2b2b) 高于 bg-panel(#252525)、accent(#2383e2) ≠ status-warning。

## 执行位置

主工作区（master）。属一次性新增主题包（主应用运行时尚不装载该主题），经开发者当轮指示直接完成；主应用接入铺开时按仓库惯例走 worktree。
