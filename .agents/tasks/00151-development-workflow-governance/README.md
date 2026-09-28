---
schema: nbook.task/v1
taskId: 00151-development-workflow-governance
actionIssueId: null
worktreeId: t151-governance-workflow
branchId: refactor/t151-governance-workflow
status: in-progress
createdAt: 2026-08-22T10:50:46Z
updatedAt: 2026-08-23T00:45:00Z
agentWorkflow:
  profile: nbook.agent-skills/v1
  kind: refactor
  routes:
    - incremental-implementation
    - test-driven-development
    - code-simplification
    - code-review-and-quality
    - writing-for-agents
    - security-and-hardening
  verification:
    required:
      - typecheck
      - focused-test
      - regression-test
      - diff-check
      - docs-check
      - governance-check
      - security-review
    notRun:
      - check: browser
        reason: 治理脚本、schema 与文档改动无产品 UI 表面，且未获浏览器人工验收授权
---

# 开发流程与角色治理实现（P-005）

## 目标

依据已 accepted 的 Proposal [`p-005-development-workflow-governance.md`](../../../docs/proposals/p-005-development-workflow-governance.md)（ID `P-005`），实现 monorepo 级开发流程治理：批量 PM 分流协议、Intake / Selection set / Initiative / Task v2 / Proposal v1 合同、`agent-role` Skill 与 `governance:handoff`，并通过提案「验收方向」1–16 的全部场景。

## 授权

- 授权来源：P-005 `状态：accepted`（人类批准，见提案决策记录 2026-08-22）。
- `accepted` 只批准修改规范和创建实现 Task；合并、发布、远端写入等受限动作仍需人类明确授权。

## 实现交付物概要

1. Intake、candidate、selection set、Initiative、Task v2 的 schema 与唯一 ID / revision 合同；Proposal v1 frontmatter 迁移（含 `P-NNN` 编号、文件名前缀与历史提案补号清单）。
2. `agent-role` Skill（`pm|leader|tasker|reviewer`）与 `governance:handoff`：task / intake 双参数形态、CAS 三方 revision 比对、候选级 claim 幂等（`intakeId + candidateId + workKind`）、既有对象复用、intent journal / claim 台账崩溃恢复。
3. `governance:check` 扩展：selection set 绑定一致性、Task lineage 组合唯一性、accepted 语义收口检查。
4. 根 `AGENTS.md` 目标结构重排、四个角色合同更新，以及 `docs/proposals/README.md` 与 `.agents/roles/pm/AGENTS.md` 对 `accepted` 语义的一次性收口（提案验收场景 16）。
5. 以 `local://paste-1.md` 为基线的批量协议验收场景：48 原始项切分容错、47 canonical candidate、全覆盖映射、幂等重试无重复无孤儿。

## 非目标

- 不改变 NeuroBook 产品运行时行为、数据、公开接口或用户 Workspace。
- 不批量改写历史 Task、walkthrough 或已归档 Proposal 正文。
- 不创建第二套 Spec、`tasks/plan.md`、`tasks/todo.md` 或独立 DoD。
- governance 类不伪造产品 Spec；若实现中发现产品行为变化，按提案条款另开 behavior / architecture Proposal 与 Spec。

## 注释与文档约定

- 注释只在所有权边界说明非显而易见的原因；仅当维护者需要知道理由或代码何时失效时，才写约束或失效条件。
- 不复述操作步骤，不保留中间尝试，不罗列推测性的未来工作。

## 验收方向

以提案「验收方向」1–16 为准；本任务完成时逐项给出证据。`context.md` 由 Leader 在开工时生成当前快照并记录基线 revision。

## Spec 说明

本任务是 `kind: governance` 的开发流程治理实现：NeuroBook 产品行为合同未变（可观察行为、数据与公开接口均不变）。按提案「对 Spec 的预期改动」不新建产品 Spec，治理合同落在根 `AGENTS.md`、角色合同、schema 与治理命令本身。若实现中发现产品行为变化，停止并另开 behavior / architecture Proposal 与 Spec。
