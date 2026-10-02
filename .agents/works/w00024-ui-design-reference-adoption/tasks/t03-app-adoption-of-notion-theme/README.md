---
schema: nbook.task/v2
taskId: t03-app-adoption-of-notion-theme
---

# 主应用接入 Notion 主题

## 目标与范围

把 t02 的 notion 主题接入主应用与 Lab：

- `shared/theme/theme-axes.ts`：`productThemeIds` 白名单追加 `"notion"`（server 配置校验同源，DTO `z.enum` 自动跟随）；
- `app/utils/theme/theme-packs.ts`：产品主题登记表追加 notionTheme；
- `app/component-lab/lab-theme.ts`：Lab 装机清单追加，`LAB_COLORWAY_IDS` 追加 `notion-light` / `notion-dark`——不配上自带配色，Lab 里的 Notion 就是「别人的配色下的 Notion」，无评判价值；
- `app/component-lab/fixtures/SettingsProject.scenes.ts`：设置场景 fixture 的 themeOptions 同步三套；
- `install-theme-packs.test.ts`：两侧清单期望更新（该测试正是漂移兜底，改清单必须改它）；
- `bun run --cwd packages/neuro-book generate:openapi` 再生成路由 meta，themeId 枚举随白名单更新。

## 行为合同

行为合同未变之外的说明：主题白名单是配置 schema 的一部分，本次**有意**扩展合法取值集（新增 `notion`），已有取值与默认值（`nbook`）不变，老配置不受影响。

## 携带的存量漂移

`generate:openapi` 再生成时带出了此前任务合入 DTO 后未再生成的 meta 漂移：`connectionIdentityDraft`（w00021 t02）与 `associations` / `languageAssociations`（更早的配置改动）。这些均为已合入 DTO 的文档同步，无运行时行为；为保持生成物与生成器一致而随本 Task 一并提交，特此记录归属。

## 非目标

不按 Notion 参照改造任何既有组件样式；不在设置页外新增主题入口。

## 证据

- `bun run --cwd packages/neuro-book test app/utils/theme app/component-lab/fixtures` → 19 文件 116 用例全绿。
- `bun run --cwd packages/neuro-book test server/config shared/theme` → 10 文件 112 用例（除上述 install-theme-packs 期望更新后复跑全绿）。
- typecheck 与主工作区干净基线逐文件比对（结果见 Work README 收尾时的补充记录）。

## 执行位置

worktree `.worktree/w00024-ui-design-reference-adoption`，分支 `feat/w00024-ui-design-reference-adoption`。
