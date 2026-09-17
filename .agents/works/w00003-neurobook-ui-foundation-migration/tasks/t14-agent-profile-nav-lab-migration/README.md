---
schema: nbook.task/v2
taskId: t14-agent-profile-nav-lab-migration
role: tasker
---

# Agent Profile 导航实验室迁移

保留 Agent Profile 导航实验室迁移期间的产品排除扫描证据：对 `bun run --cwd packages/neuro-book nuxt:build:raw` 的产物扫描 `component-lab`、`AgentProfileNavListFixture`、`LabShell`、`data-lab-subject` 等禁入字面量，以及 `/lab` 路由与绝对路径泄漏。

## 保留证据

- `evidences/product-exclusion-2026-09-04.json` 保留完整扫描配置与结果；该次检查结果为 `failed`，不得视为通过。
- 本次只恢复 current Task 的身份记录，不重跑构建、不改变产品行为，也不对该历史 Task 作完成判断。
