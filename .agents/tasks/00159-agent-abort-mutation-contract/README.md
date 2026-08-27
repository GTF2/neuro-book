---
schema: nbook.task/v1
taskId: 00159-agent-abort-mutation-contract
actionIssueId: null
worktreeId: .worktree/t159-agent-abort-contract
branchId: feat/t159-agent-abort-contract
status: completed
createdAt: 2026-08-25T09:56:19Z
updatedAt: 2026-08-27T05:27:40Z
agentWorkflow:
  profile: nbook.agent-skills/v1
  kind: bug
  routes:
    - api-and-interface-design
    - documentation-and-adrs
    - spec-driven-development
    - test-driven-development
    - code-review-and-quality
  verification:
    required:
      - focused-test
      - regression-test
      - typecheck
      - docs-check
      - diff-check
    notRun:
      - check: browser
        reason: 本 Task 不做浏览器人工验收；当前合同验证使用服务端行为测试和仓库门禁。
      - check: smoke
        reason: 未获真实 Provider 或运行时 smoke 授权；不以真实外部依赖替代确定性行为测试。
---

# Task 00159：Agent abort mutation 合同闭合

## 状态

**Completed（PR #216 review remediation）。** 首轮交付已闭合 Agent Session abort 公开合同、方案 B forced fence、waiting retry/recovery、HTTP boundary、SSE ordering 与黑盒证据，并以 commit `88390ba4` 创建 PR #216。本轮先修复 internal-signal durability failure 与合同措辞二义，再复现并修复 running cooperative `clearQueue=false` 终态 queue pause 第二步失败导致重复 `aborted` lifecycle 的窗口，最后补上 durable snapshot 幂等 retry 及其 auto-leaf repair：若 lifecycle 已落盘但后续 auto-leaf append 失败，重试读取 durable snapshot，经同一 `SessionWriteExecutor` 补齐缺失 active leaf，跳过重复 lifecycle 并继续 pause/finish；本轮又修复 cooperative repair 的 SSE 发布顺序，确保 `invocation_aborted -> agent_end(aborted) -> session_state_changed`；四份公开合同、Task 18 迁移登记、实现和行为测试均已同步。最终语义边界与证据记录见 [walkthrough 012](walkthroughs/012-reviewer-2026-08-27_05-25-sse-evidence-boundary.md)，RED 证据校正见 [walkthrough 011](walkthroughs/011-reviewer-2026-08-27-red-evidence-correction.md)，断言校准记录见 [walkthrough 010](walkthroughs/010-reviewer-2026-08-27-assertion-and-evidence-calibration.md)，auto-leaf repair 记录见 [walkthrough 008](walkthroughs/008-tasker-2026-08-26_20-12-cooperative-auto-leaf-repair.md)，前一轮 durable snapshot 记录见 [walkthrough 007](walkthroughs/007-tasker-2026-08-26_19-29-durable-retry-idempotency.md)，终态失败记录见 [walkthrough 006](walkthroughs/006-tasker-2026-08-26_17-47-cooperative-terminal-failure.md)，更早 remediation 见 [walkthrough 005](walkthroughs/005-tasker-2026-08-26_14-44-pr216-review-remediation.md)。

## 背景与目标

Task 147 的 bounded forced-cancellation 实现已经合入当前主线，但取消行为合同此前未闭合：稳定 Reference 要求 abort 与其它 Session mutation 共用 `withSessionMutation()` / `withSessionMutations()` 边界，forced-abort 实现却在宽限期结束后直接进入 `SessionWriteExecutor` 并释放 invocation ownership；现有 Harness 黑盒合同又明确把 abort endpoint 排除在覆盖范围外。

本 Task 新增并最终实现唯一规范 [`Agent Session Abort`](../../../docs/specs/agent/session-abort.md)，覆盖 HTTP 输入、成功/错误输出、状态、事件、lifecycle、队列、取消失败与恢复；本 Task 的目标不是“行为合同未变”，而是把现有实现与新的公开合同收敛为一套可验收行为。

## 关联

- Spec：[`Agent Session Abort`](../../../docs/specs/agent/session-abort.md)
- ADR：[`ADR 0019：Agent abort mutation boundary`](../../../packages/neuro-book/docs/adr/0019-agent-abort-mutation-boundary.md)
- Task 18 黑盒合同：[`HARNESS-BLACK-BOX-CONTRACT.md`](../../../packages/neuro-book/.agents/tasks/18-agent-runtime-pipeline-hooks/HARNESS-BLACK-BOX-CONTRACT.md)

## 已确认冲突

1. [`packages/neuro-book/assets/reference/agent/attachments.md:107-115`](../../../packages/neuro-book/assets/reference/agent/attachments.md) 规定 invocation claim、terminal transition、runtime command、附件登记、archive/restore 和 abort 共用 Session mutation 边界，并规定 relation lock -> Session mutation lock -> `SessionWriteExecutor` write lock 的顺序。
2. [`packages/neuro-book/server/agent/harness/neuro-agent-harness.ts:6485-6510`](../../../packages/neuro-book/server/agent/harness/neuro-agent-harness.ts) 的 `forceAbortInvocation()` 以同步控制面操作直接调用 `enqueueForcedAbortLifecycle()`、`finishInvocationState()` 和 `publishRuntimeEvent()`，没有重新进入 `withSessionMutation()`。
3. [`packages/neuro-book/.agents/tasks/18-agent-runtime-pipeline-hooks/HARNESS-BLACK-BOX-CONTRACT.md:52-62`](../../../packages/neuro-book/.agents/tasks/18-agent-runtime-pipeline-hooks/HARNESS-BLACK-BOX-CONTRACT.md) 明确暂不覆盖 abort endpoint，因此当前黑盒证据不能证明 HTTP abort、合作取消和 forced-abort 的公开合同。
4. `abortInvocationMatching()` 的 admission 阶段仍通过 `withSessionMutation()` 读取并 claim 当前 invocation；冲突集中在宽限期后的强制终态控制面，以及该路径与持久化 write queue 的关系。

## 决策（2026-08-25）

开发者已选择**方案 B：明确窄化例外**。宽限期到点的 forced-abort 保留同步 control-plane fence，以维持 `INVOCATION_ABORT_GRACE_MS = 150` 与 forced-abort `300ms` 上界；普通 abort admission 继续通过 `withSessionMutation()`，唯一 forced-abort `aborted` lifecycle 继续经同一个 SessionWriteExecutor，并由 per-session write queue 保证后续 `start` 排在旧终态之后。

方案 B 不是当前实现已合规的证明。实现还必须处理 forced enqueue 同步失败（保留 aborting ownership、HTTP 503 可重试）和已入队物理写失败（同一 write queue pending recovery），并由 Spec、ADR、Reference、Task 18 和行为测试共同证明。

方案 A 未选择；不要求本 Task 重新把 forced-abort 控制面塞回可能被长写入占用的 mutation lock。

## 实现范围

- 更新 `agent.session-abort` Spec、ADR 0019、Agent mutation/SSE Reference，使选定边界、锁顺序、ownership release、迟到事件隔离、durable lifecycle ordering 和 fail-closed 行为唯一且无矛盾。
- 扩展 Task 18 黑盒合同，正式纳入 `POST /api/agent/sessions/:sessionId/abort` 的黑盒输入、返回、状态、错误、恢复和事件合同。
- 为 HTTP abort、合作取消、非合作 provider/tool 的 forced-abort、重复取消、迟到结果、物理写恢复和后续 invocation 顺序补行为测试。
- 复核并实现 `SessionWriteExecutor` 的 forced-abort 授权仍然单 session、单 invocation、单 `aborted` lifecycle、fail closed，并提供 pending recovery。

## 非目标

- 不改变 compaction 算法或 Task 147 的上下文压缩合同。
- 不增加第二套锁、直接 repository 写入、tombstone 旁路或静默兼容分支。
- 不通过放宽 timeout、忽略持久化失败或删除黑盒断言来消除失败。
- 不执行真实 Provider、浏览器人工验收、远端写入、push、PR 更新、发布或部署，除非另行获得明确授权。
## 验收

- [x] 方案 B 已选定，取消失败的 ownership、HTTP 结果、重试和 recovery 合同已写入 Agent Session Abort Spec 与 ADR 0019。
- [x] 当前 Reference、Spec、Task 18 黑盒合同、代码和测试对 abort 边界一致；forced control-plane 例外与 write queue recovery 已有 ADR 解释。
- [x] 黑盒合同覆盖 abort endpoint：合作取消与 forced-abort 均有输入、返回、生命周期顺序、终态事件、`activeInvocation: null`、重复取消、迟到结果和 durable recovery 断言。
- [x] 后续 invocation 的 `start` 不先于旧 invocation 唯一 `aborted` durable lifecycle；forced-abort 授权缺失或 plan 非法时 fail closed。
- [x] running cooperative `clearQueue=false` 终态在 mutation 临界区按 durable snapshot 幂等提交 lifecycle；注入第二次 pause 失败时 snapshot 已有且仅有一条匹配 `aborted`，重试跳过 lifecycle 并完成 paused queue；另注入 lifecycle 的第二个物理 append（auto-leaf）失败，snapshot 观察到 lifecycle 已存在且对应 leaf 缺失，重试经同一 write queue 补齐唯一 active leaf，最终 activeInvocation 为 `null`。
- [x] `focused-test`、`regression-test`、`typecheck`、`docs-check`、`governance-check` 和 `diff-check` 全部通过；最新 SSE 证据语义边界与最终校正记录在 [walkthrough 012](walkthroughs/012-reviewer-2026-08-27_05-25-sse-evidence-boundary.md)，具体 RED 数量校正见 [walkthrough 011](walkthroughs/011-reviewer-2026-08-27-red-evidence-correction.md)。

## 当前基线与证据

- 实现 worktree：`.worktree/t159-agent-abort-contract`；分支：`feat/t159-agent-abort-contract`。
- 本轮基于首轮交付 commit `88390ba44f6f78eb60789164027f2515eaaa1e8d`，未合并或 rebase 远端 `master`。
- 本轮唯一 scope 已闭合：internal-signal abort gate 有界失败、abort-owned durable error 归一化、合作终态 durable snapshot 幂等提交，以及 lifecycle 部分落盘后的 active auto-leaf repair；四份合同的 admission、Aborting retry、SSE、steer/follow-up、`interrupted` 和 recovery 语义同步。
- Task 18 `HARNESS-BLACK-BOX-CONTRACT.md` canonical/destination SHA-256：`sha256:fcdac89d9aab62f8f11a7c862902a7f8b7742aeba6d7cd047dc1159eb283e30b`。
- Task 18 `sourceSha256` 保持：`sha256:2e0f87da418450938512f9f6196b671065886482f3c9a1809763f4698c7a4201`；`legacy-index.json` 与 `.migration-complete` 的 manifest SHA-256：`sha256:2eb3307366b9ea880d4d69e44c8f84cda2f5b6514cf772238c54aa6fd301d67f`。
- `agent.session-abort` Spec 已为 `implemented`，四份公开合同与实现/测试已同步；`write-plan.ts`、`write-plan.test.ts` 未修改。
- `bun run --cwd packages/neuro-book test -- server/agent/harness/neuro-agent-harness.black-box.test.ts server/agent/harness/neuro-agent-harness.test.ts server/agent/session/write-plan.test.ts "server/api/agent/sessions/[sessionId]/abort.post.test.ts" server/agent/http.test.ts shared/dto/agent-session.dto.test.ts --reporter=dot --silent`：`6 files / 310 passed`。
- `bun run --cwd packages/neuro-book test:agent -- --reporter=dot --silent`：`156 files / 1469 passed`。
- `bun run --cwd packages/neuro-book typecheck`：exit code 0。
- `bun run docs:check`：`failures: []`、`checkedFiles: 5294`。
- `bun run governance:check`：`failures: []`、`warnings: []`。
- `git diff --check`：通过；仅有 LF/CRLF 转换警告，无 whitespace error。


## 未运行

- 浏览器人工验收、真实 Provider/Model smoke、远端 CI、push、PR 更新、发布、部署和数据删除继续未运行；本地 remediation commit 是本轮预期交付。
