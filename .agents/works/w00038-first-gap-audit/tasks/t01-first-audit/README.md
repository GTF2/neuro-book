---
schema: nbook.task/v2
taskId: t01-first-audit
---

# 首次能力接线审计

行为合同未变：本 Task 只跑审计并修正开发 Agent Skill 的判定口径，不改产品行为与 Spec 合同。

## 目标与范围

用 `capability-gap-audit` Skill 对当前 fork 做首次全量审计，验证方法可跑、结论可用，并修正暴露的判定盲点。

## 审计结论（2026-10-04）

**工具面（46 个工具）**：三条路由路径全 0 的仅 2 个 —— `variable_read`、`variable_schema`，均已核实为**有意未接线**（`rp-mode/SKILL.md`「边界」节明确「第一版不做持久化 session 记忆，不实现完整变量系统」）。**当前 fork 无真实接线缺口。**

**workflow 面（9 个）**：全部有 Skill 引用（`split-book` 1 个，其余 ≥2），且都在 `novel-guide` 路由表内。

**悬空承诺面**：零命中 —— Skill 提到的工具全部已注册。

## 审计暴露的口径盲点（已修正）

**初版判定只看 Skill 一条路径**，把 30 个「Skill 零引用」工具列为缺口候选。实测发现其中 **28 个已接线**——Agent 拿到工具用法有三条路径，初版漏了后两条：

1. Skill（模型按 `when_to_use` 自选读取）。
2. **profile 注入的 reference**：`profiles/builtin/*.tsx` 的 `<Import path="reference/..."/>` 随 profile 直接进上下文。`reference/plot/system.md` 被 4 个 profile 注入，其「Agent Tools」章节列出全部 plot 工具与用法 —— `get_story_tree` 被 16 个 profile 引用，尽管 Skill 零引用。
3. profile 正文里直接写的工具名与协作纪律。

**验证方式**：读最近会话 JSONL 的 `custom_message`，能搜到注入的 reference 原文（实测会话 11 命中 `reference/plot/system.md` 的「Agent Tools」段）。

## 证据

- 审计命令与结论：见上（三条路径统计、workflow 引用、悬空承诺反查）。
- Skill 修正：`.agents/skills/capability-gap-audit/SKILL.md`（判定口径表改为三路径、新增「路由的三条路径」与「已知的有意未接线」两节、易错点补两条）。提交 `8a86c22f`。
- 门禁：`docs:check` 0 failures 且该 Skill 零警告；`governance:check` failures/warnings 均空。

## 验证

- 修正后的判定命令实跑：46 个工具收敛到 2 个候选，与人工核实一致。
- 审计结论可复现：同一命令在未改动产品资产的 master 上重复执行结果一致。

## 执行位置

主工作区（master），不建 worktree——审计 + 治理文档修正，不改产品代码。
