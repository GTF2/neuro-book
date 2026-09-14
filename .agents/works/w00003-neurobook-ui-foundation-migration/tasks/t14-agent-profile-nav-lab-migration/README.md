---
schema: nbook.task/v2
taskId: t14-agent-profile-nav-lab-migration
role: tasker
---

# Agent Profile Nav Lab Migration

保留 Agent Profile 导航/Lab 迁移期间的产品排除扫描证据：对 `bun run --cwd packages/neuro-book nuxt:build:raw` 的产物扫描
`component-lab`、`AgentProfileNavListFixture`、`LabShell`、`data-lab-subject` 等禁入字面量，以及 `/lab` 路由与绝对路径泄漏。

完整扫描配置与结果见 `evidences/product-exclusion-2026-09-04.json`。
