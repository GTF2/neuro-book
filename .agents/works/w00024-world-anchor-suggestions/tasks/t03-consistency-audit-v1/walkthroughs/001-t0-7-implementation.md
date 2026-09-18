# T0.7 实施与验收记录

## 当前状态

已实现独立的只读章节一致性审计端点：`POST /api/projects/plot/consistency-audit`。调用方必须明确提供 `chapterId`、结算文本、唯一正文路径与本次 finalize 返回的 `worldSliceIds`，服务不会猜测正文或改写任何项目数据。

## 实际改动

- 新建 `server/consistency/chapter-consistency-audit.service.ts`，用可注入 ports 组装确定性三源报告。
- 承诺对照只使用 `open` Promise、deadline 与 factual beat；只在 deadline 正好为当前审计章节且没有 factual beat 时报告“该兑现未兑现”。`cadenceChapters` 不参与硬判断。
- 状态对照先解析 T0.1 结算块。结算缺失、缺少 World 切面凭据或凭据无法读取均显式返回 `unavailable` / `unknown`；由于结算是自由文本、没有事实到 patch 的结构化映射，服务不会把“无法逐条核对”伪装为“事实没有写入世界”。
- 文字体检复用单文件 `runLlmlintCheck()`，只投影 `high` 命中，按行号稳定排序并截断摘录。llmlint 的 high 命中退出码不是 runner 失败。
- 新增独立 API，避免扩大 Plot catch-all 路由；输入受到长度、路径、重复 slice ID 和请求体大小限制。

## 验证

| 检查 | 结果 |
|---|---|
| `bun run --cwd packages/neuro-book test -- server/consistency/chapter-consistency-audit.service.test.ts` | 通过：4/4。 |
| `bun run --cwd packages/neuro-book typecheck` | 通过。 |
| `git diff --check` | 通过。 |

覆盖：本章 deadline 未兑现、World 切面证据存在但自由文本无法结构化对照、缺失结算块、llmlint high 过滤/排序/摘录截断。

## 未运行项

- 未运行真实 llmlint CLI 的 API 集成测试：服务单测通过注入 ports 锁定审计规则；真实 CLI 已由 T0.4 专项测试覆盖。
- 未运行全量单测、全量 E2E 或 `nuxt:build`：它们属于阶段 0 收口或阶段 1 的 UI/依赖门禁，且不得与并行 UI 线写盘并发。
- OpenAPI 生成器未运行：隔离 worktree 已知会对全部路由报告路径环境错误；独立 T0.7 API 未手改自动生成区。
