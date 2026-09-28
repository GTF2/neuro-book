# Context：00151-development-workflow-governance

- 快照生成时间：2026-08-22T11:26:40Z（开工时重新读取）
- 基线 revision：42a0783883be9616d4ffe1432d5b7f5b994a457a（开工时 `git rev-parse HEAD` 实测，与 origin/master 一致）
- 任务状态：in-progress（切片 1 完成，含独立 security-review 证据；待人类合并决策）
- 执行位置：worktree `.worktree/t151-governance-workflow`，分支 `refactor/t151-governance-workflow`（依根 AGENTS.md 分支与 worktree 合同创建）
- 授权来源：Proposal `P-005`（`docs/proposals/p-005-development-workflow-governance.md`）人类批准 accepted，见其决策记录 2026-08-22 条目
- 关键阅读顺序：
  1. 根 `AGENTS.md` 与 `.omp/RULES.md`
  2. 提案全文，重点是「批量输入与 PM 分流」「进度与真相源模型」「治理命令」「验收方向」
  3. `.agents/tasks/README.md`、`.agents/tasks/AGENTS.md`
  4. `scripts/ci/agent-governance-contract.ts`、`scripts/ci/agent-governance.ts` 及其测试（现有治理基线）
  5. `.agents/roles/{pm,leader,tasker,reviewer}/AGENTS.md` 与 `docs/proposals/README.md`（accepted 语义收口的落点）
- 注意事项：实现期间按改动面做 focused 验证（typecheck、相关 vitest 文件、docs-check）；required 八项是完成门槛，全部交付物闭合后逐项收敛并留证据，不在每个中间步骤重复全量。
- 注意事项：实现期间 `bun run docs:check`、脚本 typecheck 与 `governance:check` 需持续可过；验收场景 16 要求一次性收口 README / PM 角色合同 / `governance:check` 三处语义。
- 注释约定：只在所有权边界说明非显而易见的原因，必要时写约束或失效条件；不复述操作、不保留中间尝试、不罗列推测性未来工作。

- ~~验收阻塞 1~~（已解决，经人类授权）：迁移哈希校验改为 index blob 双形态比对（raw LF + CRLF 变体），对 .gitattributes/autocrlf 签出行尾稳健；`governance:check` exit 0。归档提案冻结边界保持不变。

- ~~验收阻塞 2~~ 已由人类决策关闭（2026-08-23）：不做宿主签名 hook，selection set 去除 authorization 签名层与信任锚；批量协议限定为单人本地信任模式（提案待审查 12a）。顺序门禁为程序性工件，授权依赖人类直接确认 + revision/fingerprint 校验。
- security-review：已完成——独立 reviewer 代理出具报告（evidences/security-review-evidence.json）：无 Critical，4 Required 全部修复；re-review 补 5 项中 4 项修复、回归测试已补齐（4 例新增）。
