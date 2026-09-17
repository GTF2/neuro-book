---
schema: nbook.task/v2
taskId: t14-agent-profile-nav-lab-migration
role: tasker
---

# Agent Profile 导航实验室迁移

此 Task 的原始正文未随历史 checkpoint 保留；当前仅恢复 current Task 的最小身份记录，使既有证据可被治理工具索引。

## 保留证据

- `evidences/product-exclusion-2026-09-04.json` 记录一次产品构建排除检查；该次检查结果为 `failed`，不得视为通过。
- 本次只修复缺失 README 的治理结构，不重跑构建、不改变产品行为，也不对该历史 Task 作完成判断。
