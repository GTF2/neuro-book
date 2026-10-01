---
schema: nbook.work/v1
workId: w00022-dev-agent-skill-gap-fill
issueId: null
---

# 开发 Agent Skill 缺口补充（第一批）

按缺口分析结论新增开发层 Skill，把正在稳定失效的治理环节固化为可触发的薄指针方法。

## 来源与授权

2026-10-02 开发者提出「咱们这个项目的 Skills 还很缺，还得去找一找」，经确认目标是开发 Agent 层（`.agents/skills/`），来源方式为先做缺口分析再挑选。两路调查（works/tasks 治理流程、领域规范与验证体系）合并出 6 个候选，实施计划经开发者批准：本批只做证据最强的 4 个高优先 Skill，每个都有正在发生的失效作为证据。同日开发者追加决定：4 个新 Skill 直接挂进根 `AGENTS.md` 路由表，不先观察自动触发效果（t02）。

编号分配：按 `.agents/works/README.md` 编号分配流程核对，master 已登记 Work 至 w00017 与 w00021；本地分支、linked worktree 与 `git log --all` 均无 w00022 引用。w00018–w00020 为已知空缺（w00020 只存在于远端分支 `origin/fix/w00020-startup-exit-api-auth`），不回填，本地占号 w00022。

## 范围与非目标

- 新增 4 个 Skill：`verification-evidence`、`work-registry`、`task-snapshot`、`spec-registration`，并在 `.agents/skills/README.md` 登记。
- Skill 保持薄指针风格：真相源留在原文档，只补路由、判断清单和易错点；不建总流程 Skill，不叠加完成门禁。
- 4 个新 Skill 均挂进根 `AGENTS.md` 路由表的对应任务范围行（t02）。
- 不修存量失效：66 条 Spec 链接警告、越仓链接、规范路由表损坏、PROJECT-STATUS.md 陈旧、w00007/w00020 撞缺号处置，它们是后续独立 Task 的候选。
- 低优先候选（data-migration、desktop-delivery）本批不做。

## 执行位置

主工作区直接修改（治理文档，不建 worktree），分支 `master`。

## 收尾

[t01](tasks/t01-create-high-priority-skills/README.md) 已实现并验证。
[t02](tasks/t02-routing-table-entries/README.md) 已实现并验证。
[t03](tasks/t03-fix-w00021-t02-gate-wording/README.md) 已实现并验证。

已收尾：7f518094；待清理：无
