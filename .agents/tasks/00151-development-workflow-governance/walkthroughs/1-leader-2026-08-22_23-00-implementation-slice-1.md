---
schema: nbook.walkthrough/v1
taskId: 00151-development-workflow-governance
sequence: 1
role: leader-tasker
status: completed
createdAt: 2026-08-22T15:01:36Z
---

# 实现记录（切片 1）：治理工作流合同 + handoff CLI + Proposal v1 迁移

## 交付物（本切片已完成）

1. `scripts/ci/governance-workflow-contract.ts`：Intake / candidate / selection set / Initiative / Task lineage 的 schema 校验器；`candidateSetFingerprint` 计算与 selection scope 摘要比对；活跃提案 frontmatter 校验（ID/文件名前缀/kind/status/decision.by 规则）；Initiative DAG 无环校验。
2. `scripts/cli/governance-handoff.ts`：`pm-leader`（三方 revision CAS + 候选状态门禁 + journal）、`claim`（ledger 幂等键 `intakeId|candidateId|workKind`、duplicate-of 链解析复用既有 claim、lineage CAS 写入、promoted 仅由成功 claim 写入、崩溃重试收敛）、`task`（CAS 交接记录）。
3. `scripts/ci/agent-governance.ts` 接入五个新校验器；`package.json` 新增 `governance:handoff`；`expectedGovernanceFiles` 纳入 agent-role Skill。
4. `.agents/skills/agent-role/SKILL.md`（严格角色入口）+ 技能索引行。
5. Proposal v1 迁移：P-002/P-003/P-004/P-005 加 `nbook.proposal/v1` frontmatter 并删除正文状态行；文件名改 `p-NNN-*`；索引与编号登记更新；归档 P-001 按 Task 非目标保持冻结。
6. `docs/proposals/README.md` 生效规则补 PM 自主接受收口；`.agents/roles/pm/AGENTS.md` 步骤 8 同步边界。
7. 回归测试 `scripts/ci/governance-workflow.test.ts`：16 例覆盖指纹稳定性、提案迁移失败面、批量覆盖缺口、乱序候选集、fingerprint 篡改、DAG 环、lineage 重复/越界、pm-leader happy+幂等重放+三方 CAS 冲突+closed 门禁、claim 收敛（模拟 ledger 后崩溃）+ 跨 set 幂等键拦截 + scope 越界、task CAS 过期/非法边。

## 验证证据

- focused/regression：`bun x vitest run … agent-governance.test.ts governance-workflow.test.ts` → **53/53 通过**（签名层移除删 3 例 + 安全修复补 4 例；clean-cutover 前为 52/52）。
- `bun x tsc --noEmit -p scripts/tsconfig.json` → exit 0。
- `bun run docs:check` → `{"failures":[],"checkedFiles":5223}`（最终复跑值；切片早期为 5222）。
- `git diff --check` → clean。

## 历史问题与修复记录（全部已解决）

1. ~~`governance:check` exit 1（迁移哈希漂移）~~ **已于人类授权后解决**：`verifyTaskMigration` 改为 tracked 只读 index blob、同时比对 raw LF 与安全 CRLF 变体哈希；复跑 `governance:check` exit 0（failures: []）。归档提案冻结边界保持不变。
2. acceptance 12 子场景（伪造 handoff journal 拒绝）：**已由人类决策废止**（2026-08-23）——不做宿主签名 hook，selection set 去除 authorization 签名层；批量协议显式限定为单人本地信任模式（提案待审查 12a）。相应测试用例已随签名层移除。
3. `security-review`：**已完成**——独立 reviewer 代理（SecReview151R3 + R4 re-review）出具报告：无 Critical，4 Required + re-review 5 项中 4 项已修复并复验，回归测试补充已补齐（4 例新增）（见 evidences/security-review-evidence.json）。

security-review 已由独立 reviewer 完成（SecReview151R3 + R4 re-review），无 Critical，全部 Required 已修复。所有 required 门禁均已以真实退出码 0 收敛（vitest 53/53、tsc、docs:check、diff-check、governance:check exit 0）。

## Re-review（SecReview151R4）与二轮修复

Re-review 确认首轮 4 项 Required 中 3 项闭合，另发现 5 项遗漏；其中 4 项已修复，第 5 项（回归测试补充）已补齐（4 例新增）：

1. `--initiative`/`--phase` 绕过 SAFE_ID → claim 入口统一校验（非法字符即 exit 1）。
2. `--task`/`--reuse-task` 未走 SAFE_ID（resolveTaskReadmePath 可穿越）→ 补 SAFE_ID 校验。
3. reuse-task 归属校验在 frontmatter 损坏时静默跳过 → 改为硬失败。
4. pm-leader 不检查 expiresAt → 补过期检查（exit 2）。
5. 四项修复缺回归测试 → **已补齐**：SAFE_ID 拒绝穿越、ledger fail-closed、过期 claim 拒绝、reuse-task 目标不存在拒绝（4 例新增，governance-workflow.test.ts 16/16）。

修复后复跑（含新增 4 例安全回归）：vitest 53/53、governance:check exit 0、tsc 0、diff-check clean。
