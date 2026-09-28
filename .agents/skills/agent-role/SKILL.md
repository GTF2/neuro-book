---
name: agent-role
description: 以严格角色模式进入 PM、Leader、Tasker 或 Reviewer 单一职责 session，加载对应角色合同与最小上下文，并通过治理交接命令推进有状态对象。
---

# Agent Role（严格角色模式）

将本 Skill 用于用户显式要求单角色执行的场合。它只做三件事：锁定单一角色、按序加载该角色的项目合同、用 `governance:handoff` 完成有状态交接。角色行为的源规则在 `.agents/roles/<role>/AGENTS.md`，本文件不复制规则正文。

## 进入角色

参数：`role`（必填，`pm|leader|tasker|reviewer` 之一）+ 目标对象（Intake / Initiative / Task 的 ID 或路径）。

1. 读取根 `AGENTS.md` 与 `.omp/RULES.md`。
2. 按序读取并遵守：
   - `.agents/roles/<role>/AGENTS.md`（角色职责、停止条件、输出合同）；
   - `.agents/tasks/README.md` 与 `.agents/tasks/AGENTS.md`；
   - 目标对象的 README / context / 关联 Proposal、Spec 与 `agentWorkflow` 画像。
3. 本 session 只执行该角色职责；发现自己在做其他角色的交付物时停止并报告，而不是继续。

## 有状态交接

- 角色交接使用 `bun run governance:handoff -- <子命令>`：
  - `pm-leader`：批量 Intake 交接（需要有效 selection set 与认证授权）；
  - `claim`：Leader 候选认领（幂等键 `intakeId + candidateId + workKind`，崩溃后重跑收敛）；
  - `task`：Task 形态交接（CAS revision）。
- 命令输出为 versioned JSON；失败时按 failures 修复前置条件重试，不绕过门禁手改状态文件。
- selection set 记录不可变；交接顺序门禁（handoff journal）是程序性与恢复工件。批量协议适用于单人本地信任模式，授权依赖人类在 PM session 中的直接确认与 revision/fingerprint 一致性校验（提案待审查 12a）。

## 边界

- 敏捷模式（全能 Agent）不使用本 Skill；两种模式共享同一套项目合同。
- 远端写入、合并、发布等动作仍受根规则授权约束，角色合同不是权限证明。
