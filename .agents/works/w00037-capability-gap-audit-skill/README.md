---
schema: nbook.work/v1
workId: w00037-capability-gap-audit-skill
issueId: null
---

# 能力面接线审计 Skill

把「功能面 ↔ 消费点接线」的缺口分析方法沉淀成开发 Agent Skill：发版前（或大改动后）用可复现的检索，找出「已实现但无人消费」的能力与「Skill 承诺但工具不存在」的落差。

## 来源与授权

2026-10-04 开发者要求继续推进计划。方向来自 fork backlog #6（把缺口分析方法沉淀成第五个开发 Skill）。方法来源：w00022 的缺口分析（两路调查 → 候选清单 → 按证据强度挑选）与 w00026 的接线实测（`save_promise_beat` 曾零命中，是真实缺口）。

## 范围与非目标

- 新增 `.agents/skills/capability-gap-audit/SKILL.md`，登记进 `.agents/skills/README.md`。
- 只写方法（检索手段、判定口径、易错点），真相源留在原文档；不复制 Spec 条款。
- 不新增机器门禁、不改 `governance:check`、不改产品资产。
- 不做「自动修复缺口」——审计只出结论，修复另开 Work。

## 当前 Task

| Task | 当前范围 |
|---|---|
| [t01](tasks/t01-capability-gap-audit-skill/README.md) | 已交付并验证：Skill 正文 + 索引 + 路由表（三条命令实测可跑、governance/docs 门禁 0 failures） |

已收尾：e9d2f8e3；待清理：无（纯治理文档，主工作区直接提交，未建 worktree）。
