---
schema: nbook.work/v1
workId: w00020-workflow-data-queries
issueId: null
---

# Workflow 只读数据查询：infoControl 自动编译

把 Work `w00016` 留下的最后一环补上：信息控制清单不再靠调用方每次手填，而是由 `chapter-write-review-revise` 按 `chapterId` **自动编译**。手段是启用内核早已定义、宿主一直没装的版本化只读查询面——`wf.query` → 宿主 `ActivityExecutor` → journal（重放返回原值，不重复读库）。

来源：[Proposal：Workflow 只读数据查询](../../../packages/neuro-book/docs/proposals/workflow-project-data-queries.md)（2026-09-14 `accepted`）；[Spec：Workflow 版本化只读数据查询](../../../docs/specs/agent/workflow-data-queries.md)（`planned`）。

## 交付边界

- 宿主装配：`server/agent/workflow/workflow-demo-service.ts` 的 `WorkflowRunner` 构造增加 `activities` 选项，注入宿主 `ActivityExecutor`；执行器按 run 的 Project 上下文解析作用域。
- 查询实现：新增 `server/agent/workflow/workflow-data-queries.ts`，注册版本化只读查询 `plot.chapter-info-control@1`（输入 `{chapterId}`，输出四字段），复用 `runReadyProjectOperation` + `activateReadyProjectModule(PROJECT_PLOT_WORLD_MODULE_TOKEN)` + `facade.getStoryChapterDto`。
- workflow 消费：`assets/workspace/.nbook/agent/workflows/chapter-write-review-revise/workflow.ts` 在 `infoControl` 缺省时调用查询并编译清单；返回值新增 `infoControlSource`（`auto` / `provided` / `missing`），保留既有布尔 `infoControlChecked`。
- 主链资产：`assets/workspace/.nbook/agent/skills/novel-writing/phases/03-chapter-loop.md` 把「每次都手填」放宽为「宿主支持时自动编译，必要时覆盖」。
- 规范归属：新增 `docs/specs/agent/workflow-data-queries.md`（`planned`）；`docs/specs/README.md` 登记「待实现规范」并更新「规范缺口」P1 行；`docs/specs/plot/chapter-writer-brief.md` 非目标指向新 capability。
- 接缝登记：`docs/standards/fork-seams.md` 新增 S22，并把 S9 的改动范围并入。
- 测试：`server/agent/workflow/workflow-data-queries.test.ts`（新增）、`chapter-write-review-revise.workflow.test.ts`（auto / provided 用例）。

## 不做

- 不做可写 action、completion、headless（属已接受提案 `agent-model-execution-surfaces.md` 的其它 capability）。
- 不为读四个字段增加模型调用。
- 不改 `infoControl` 显式入参语义（显式优先），不把 `infoControlChecked` 原地改成枚举。
- 不动并行执行者在途的 UI / 会话 / followup 改动。
