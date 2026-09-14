---
schema: nbook.task/v2
taskId: t01-info-control-non-silent
role: tasker
---

# 让漏传 infoControl 必定可见

## 目标

按 [Spec：Chapter Writer Brief 事实/意义双视图](../../../../docs/specs/plot/chapter-writer-brief.md) 的非目标与验收条款，使「信息控制清单缺失」在**评审消息、运行日志、返回值**三处都可见，不再静默失去事后校验。

## 开发者参与

- 已确认：开发者授权「需要同意的一概同意」，本轮按任务表自主推进 P1「infoControl 自动编译」。
- 本轮判断与取舍：真正的自动编译需要 workflow 确定性读取项目数据的能力（宿主未接线 `wf.query` / `wf.callAction`），本轮先做零成本、确定性的「显形」保证，并把该能力登记为 P1 规范缺口；不用「每章多一次模型调用」换取读一个数据库字段。
- 待开发者判定：真实模型下漏传 / 传错清单时的评审表现（需 Provider 运行）。

## 修改步骤

1. `chapter-write-review-revise/workflow.ts`：新增 `infoControlChecked`；一致性评审的核对段抽成 `infoControlBlock`（有清单＝原文 + 逐条核对要求；无清单＝显式「信息边界未核对」标注段）；缺失时 `wf.log` 警告；`argsHint` 写明来源与后果；返回值加 `infoControlChecked`。
2. `chapter-write-review-revise.workflow.test.ts`：新增「漏传必显形」用例（标注 + 返回值 + 事件流警告 + writer 不带意图）；已有 infoControl 用例补 `infoControlChecked=true`。
3. `phases/03-chapter-loop.md`：`infoControl` 改为每次必传，写清编译来源（`get_story_chapter` 四字段）与漏传后果。
4. `assets/reference/plot/writer-brief.md`：第 3 段分工表标注「由 leader 编译传入；漏传显式标注」。
5. `docs/specs/plot/chapter-writer-brief.md`：非目标补「漏传不再静默」；验收补两条场景。
6. `docs/specs/README.md`：新增 P1 缺口「Workflow 侧读取项目数据（infoControl 自动编译）」。
7. `docs/standards/fork-seams.md`：S9 补记本轮行为。

## 验证

- `bun run --cwd packages/neuro-book test -- chapter-write-review-revise`。
- `bun run --cwd packages/neuro-book test -- server/agent/workflow`。
- `bun run --cwd packages/neuro-book typecheck`、`bun run docs:check`、`bun run governance:check`。
- 未验证项：真实模型下的评审表现；`wf.query` 接线后的真自动编译（本轮未实现）。
