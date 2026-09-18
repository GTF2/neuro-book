# T0.6 实施与验收记录

## 当前状态

已新增只读 `GET /api/projects/plot/promises/overdue`。常规 `GET /promises` 的数组响应、前端和 Agent 工具均未改变。

## 实际改动

- `ChapterRepository` 与 Prisma 实现增加“最新已写章节”查询：当前 Story 中至少有一条 `written` 或 `revised` Scene 的 Chapter 才算已写；按 `sortOrder` 降序、`id` 降序稳定选取最新项。
- `PromiseService` 增加 overdue 运行期视图：只纳入 `open`、有期限章、且期限章 `sortOrder <= latestWrittenChapterOrder` 的 Promise。
- 新 DTO 返回 Promise 列表、`overduePromiseCount`、按期限章去重的 `overdueChapterCount` 与可空 `latestWrittenChapterOrder`；不新增数据库字段或 migration。
- 新路由在 `promises/:promiseId` 的动态分支前处理 `/promises/overdue`，并同步 OpenAPI route-map。

## 验证

| 检查 | 结果 |
|---|---|
| `bun run --cwd packages/neuro-book test -- server/plot/services/promise.service.test.ts 'server/api/projects/plot/[...segments].test.ts'` | 通过：29/29（Promise 服务 11/11；Plot API 18/18）。 |
| `bun run --cwd packages/neuro-book typecheck` | 通过。 |
| `git diff --check` | 通过。 |

服务/API 回归覆盖：同章 deadline、未来 deadline、已兑现条目、无 deadline、没有已写 Scene 的空结果、章节 ID 与 `sortOrder` 不一致、多个 Promise 共用 deadline 时的去重计数。

## 未运行项

- 未运行全量单测、全量 E2E 或 `nuxt:build`：它们属于阶段 0 收口或阶段 1 的 UI/依赖门禁，且不得与并行 UI 线写盘并发。
- OpenAPI 生成器未运行：隔离 worktree 已知会对全部路由报告路径环境错误；仅维护 route-map，未手改自动生成区。
