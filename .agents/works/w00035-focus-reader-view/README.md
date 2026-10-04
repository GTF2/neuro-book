---
schema: nbook.work/v1
workId: w00035-focus-reader-view
issueId: null
---

# 专注读稿视图

给正文加一个「读」的形态：打开章节时除了编辑，还能切到只读阅读视图——宋体、按稿面字号与版心宽度排版、暖纸底、无编辑控件，供通读与校对用。

## 来源与授权

2026-10-04 开发者要求「列出计划，继续干」。方向来自 fork backlog #5（稿面优先的「专注读稿」视图）：沿 paper 暖轴做到极致、增量组件。

勘察结论（三个事实）：① 编辑器工作台已有「打开方式」菜单与 `switchEditor`（`useEditorWorkbench.ts:419/311`），新增第三个 `EditorContribution` 是零注册表改动的最小路径；② `--page-surface` / `--reading-size` / `--reading-measure` 已在 nbook 主题登记但产品零消费（`packages/nb-ui/themes/nbook/vars.css:296-311`）；③ 仓库唯一正面陈述「缺预览视图」在 `packages/neuro-book/docs/proposals/workbench-view-host.md:246`。

## 范围与非目标

- 只加阅读贡献与视图组件：`app/utils/editor-workbench/builtin-editors.ts` 加 `read` 贡献，新组件在 `app/components/editor-workbench/`。
- 不改 TipTap 编辑器、不改工作台 view registry（按 w00025 遗留的正路，视图化留待后续 Work）。
- 不做批注、不做朗读、不做导出。

## 当前 Task

| Task | 当前范围 |
|---|---|
| [t01](tasks/t01-reader-view/README.md) | 已交付并验证：阅读贡献 + 只读渲染 + 稿面排版（聚焦测试 143 通过、双主题探针实测） |

已收尾：615abb27；待清理：`.worktree/w00035-focus-reader-view`、`feat/w00035-focus-reader-view`。
