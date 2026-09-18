---
schema: nbook.task/v2
taskId: t02-promise-overdue-view
role: tasker
---

# T0.6：承诺账本逾期视图后端

## 目标

为 Plot Promise 提供稳定、只读的逾期查询：作者能查看已经到期但仍处于 `open` 的承诺，不改变现有承诺账本的默认列表行为。

## 范围

- 只改 Plot 查询、DTO、必要 API/OpenAPI 映射、相邻测试与本 Task 交付记录。
- 新增专用 overdue 查询；现有 `GET /promises` 继续返回原数组，前端和 Agent 工具不改。
- 最新已写章定义为：当前 Story 中至少有一个非 archived Scene 状态为 `written` 或 `revised` 的 Chapter；以 `StoryChapter.sortOrder` 比较章节先后，ID 仅用于相同排序值时的稳定决胜。
- 逾期定义为：Promise 为 `open`、具有有效 deadline，且 deadline Chapter 的排序不晚于最新已写章。
- 不改 Prisma schema、不做 migration、不写入 `overdue` 持久字段、不触碰 UI 热区。

## 验收

1. 返回逾期 Promise、逾期 Promise 数、按 deadline Chapter 去重的逾期 Chapter 数，以及可空的最新已写章排序。
2. 覆盖同章 deadline、未来 deadline、`fulfilled` / `abandoned`、无 deadline、仅 archived Scene、章节 ID 与排序不一致、共用 deadline 的计数差异。
3. 受影响服务/API 测试、`bun run --cwd packages/neuro-book typecheck`、`bun run governance:check`、`bun run docs:check` 与 `git diff --cached --check` 通过。
4. 在 `walkthroughs/`、必要时 `evidences/` 和统一实施台账记录真实结果与未运行项。

## 开发者参与

- 已确认：逾期按 Chapter `sortOrder` 判断；同章 deadline 即计逾期；至少一个 `written` / `revised` Scene 即视为该章已写。
- 已确认：本 Task 只提供后端读取能力；T1.8 再接入前端逾期视图。
