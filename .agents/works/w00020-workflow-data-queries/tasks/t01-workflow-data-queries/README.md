---
schema: nbook.task/v2
taskId: t01-workflow-data-queries
role: tasker
---

# 实现 workflow 只读数据查询与 infoControl 自动编译

## 目标

按 [Spec：Workflow 版本化只读数据查询](../../../../docs/specs/agent/workflow-data-queries.md) 落地首期只读查询 `plot.chapter-info-control@1`，并让 `chapter-write-review-revise` 在 `infoControl` 缺省时自动编译清单。

## 开发者参与

- 已确认：开发者概括授权（"继续你的任务，发挥主观能动性"），接受 [Proposal：Workflow 只读数据查询](../../../../packages/neuro-book/docs/proposals/workflow-project-data-queries.md)。
- 已确认：`infoControlChecked` 保持布尔语义，来源用新增字段 `infoControlSource` 承载（不做静默破坏性变更）。
- 已确认：能力缺席（宿主未装配/未注册）退回显形且 run 可完成；查询本身失败 fail-closed。

## 修改步骤

1. `server/agent/workflow/workflow-data-queries.ts`（新增）：导出查询引用常量、结果类型、宿主查询实现（经 Project 作用域读 `StoryChapter.brief` 四字段）与 `MemoryActivityExecutor` 装配工厂（可注入 reader 以便单测）。
2. `server/agent/workflow/workflow-demo-service.ts`：`WorkflowRunner` 构造传 `activities`，由工厂按 `runContextStorage` 的 Project 上下文解析作用域。
3. `assets/workspace/.nbook/agent/workflows/chapter-write-review-revise/workflow.ts`：`infoControl` 缺省 → `wf.query` 自动编译；`ActivityExecutorNotConfiguredError` / `ActivityDefinitionNotFoundError` → 退回 `missing`（显形 + 警告）；其它错误 → 抛出（fail-closed）；返回 `infoControlSource`。
4. `assets/workspace/.nbook/agent/skills/novel-writing/phases/03-chapter-loop.md`：更新 `infoControl` 传参说明。
5. 治理：`docs/specs/README.md`（待实现规范 + 规范缺口 P1）、`docs/standards/fork-seams.md`（S22 + S9 范围）。
6. 测试：新增宿主查询单测；workflow 测试补 auto / provided 用例，既有 missing 用例保持通过。

## 验证

- `bun run --cwd packages/neuro-book test -- server/agent/workflow`（workflow 与查询用例）。
- `bun run docs:check`、`bun run governance:check`。
- 结构核对：Spec 九节齐全、capability 唯一、planned 无实现步骤泄漏、证据为活跃链接；查询结果形状与 Spec 一致；writer 消息不含清单。
- 未验证项：真实 Provider 下整条写作链的端到端效果（需 Provider 授权）；宿主装配对既有 demo 场景的行为回归依赖既有测试覆盖。
