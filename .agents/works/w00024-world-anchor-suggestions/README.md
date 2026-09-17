---
schema: nbook.work/v1
workId: w00024-world-anchor-suggestions
issueId: null
---

# 存量项目 worldAnchor 建议补齐

为已有小说项目提供确定性的 worldAnchor 建议能力：从章节正文和已生效的角色、地点设定中提取候选，只生成待确认建议；作者经明确确认后，才把缺失锚点合并写入 Scene。

## 交付边界

- T0.5：建议生成、人工确认与拒绝的服务端闭环；不调用 LLM，不新增前端或 Agent 自动确认工具。
- T0.6、T0.7：仅在 T0.5 完成并记录真实结果后，由 Leader 创建新的 Task；本 Work 不预建未知结果的任务。
- 建议队列保存在项目 `.nbook/world-anchor-suggestions.json`，不改 Prisma schema。

## 编号修复说明

`origin/master` 只登记到 `w00015-editor-workbench-spec-and-docs`。功能分支后续引入的 `w00014-chapter-writer-brief-two-views` 与 `w00015-keyframe-agent-toolface` 分别撞号；它们将在实现分支合入时迁移为 `w00022-chapter-writer-brief-two-views` 与 `w00023-keyframe-agent-toolface`，不重写历史。
