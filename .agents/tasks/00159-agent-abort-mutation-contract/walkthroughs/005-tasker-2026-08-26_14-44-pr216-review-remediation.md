---
schema: nbook.walkthrough/v1
taskId: 00159-agent-abort-mutation-contract
sequence: 5
role: tasker
status: completed
createdAt: 2026-08-26T16:40:47Z
---
# PR #216 abort 合同审查修复收尾

## 本轮范围

本轮只处理 PR #216 审查报告确认的 Agent Session abort 合同缺陷与文档登记：

- external `AbortSignal` 与 Project-close 在 `enqueueForcedAbort()` 同步失败时，让原 `invokeAgent()` 有界返回 `status: "error"`；不伪造 `aborted: true`，不释放 ownership，不 resolve `InvocationCompletion`，不发布 `agent_end`。
- abort-owned durable write 统一映射为 `AgentAbortDurabilityError`：HTTP 503、`session_abort_durability_unavailable`、`retryable: true`；projection/read/profile/authorization 错误保持原分类。
- 保持 Waiting rollback/部分持久化、Running ownership、Aborting retry、forced pending recovery、existing-aborted leaf/observer/live-state repair 与同一 per-session `SessionWriteExecutor` queue 语义。
- 同步 `docs/specs/agent/session-abort.md`、Task 18 黑盒合同、SSE Reference、ADR 0019，消除 `expectedInvocationId`、三支 admission、Aborting 重试、SSE 顺序、steer/`clearQueue`、`interrupted` 和 existing-aborted recovery 的双重真相。
- 补强黑盒与 Harness 行为断言：队列/生命周期/leaf 写入故障、重复与并发 abort、迟到结果、不可 abort active invocation、unloadable Idle、DTO rejection matrix，以及 internal signal/Project-close gate 有界性。

未修改 `write-plan.ts` 或 `write-plan.test.ts`；未修改 Task 00158 的既有文件。

## RED / GREEN 证据

- RED：新增回归测试在旧实现上证明 external `AbortSignal` 或 Project-close 触发 forced enqueue 同步失败时，原 `invokeAgent()` gate 可能永久 unresolved。
- GREEN：`resolveInvocationAbortFailure()` 在两处 internal listener 接住同步失败并 resolve abort gate；显式 HTTP abort 仍保留 503 retryable 失败语义，ownership 交给显式重试或合作 terminal。
- GREEN：abort-owned queue、resolution、lifecycle、auto-leaf 与 retrying-Aborting 写入均通过窄化 `runAbortDurabilityWrite()` 归一化 durable error；既有 `AgentAbortDurabilityError` 原样保留。

## 实际验证

| 检查 | 实际命令与结果 |
| --- | --- |
| focused-test | `bun run --cwd packages/neuro-book test -- server/agent/harness/neuro-agent-harness.black-box.test.ts server/agent/harness/neuro-agent-harness.test.ts server/agent/session/write-plan.test.ts "server/api/agent/sessions/[sessionId]/abort.post.test.ts" server/agent/http.test.ts shared/dto/agent-session.dto.test.ts --reporter=dot --silent`；`6 files / 308 passed` |
| regression-test | `bun run --cwd packages/neuro-book test:agent -- --reporter=dot --silent`；`156 files / 1467 passed` |
| typecheck | `bun run --cwd packages/neuro-book typecheck`；exit code 0 |
| governance-check | `bun run governance:check`；`failures: []`、`warnings: []` |
| diff-check | `git diff --check`；通过，仅有 Git LF/CRLF 转换警告 |
| docs-check | `bun run docs:check`；`failures: []`、`checkedFiles: 5287`。首次执行曾因 README 预引用本文件而失败；创建本文件后重跑已通过 |

另：Task 18 黑盒合同最终 canonical/destination hash 为 `sha256:c713385b449b41559a75a3e66cca14300db087d655197bc070ac5fb10c0c4b7e`；其 `sourceSha256` 保持 `sha256:2e0f87da418450938512f9f6196b671065886482f3c9a1809763f4698c7a4201`；`legacy-index.json` 与 `.migration-complete` 的 manifest hash 同步为 `sha256:d4973620e6a2c63ee6c568815b5e76edb7178cc8121372280b3b16cb40682c57`。

## 代码审查结论

- 正确性：internal gate、HTTP 503、ownership、唯一 aborted lifecycle、recovery 与迟到事件隔离均有行为断言。
- 可读性：失败归一化集中在 abort-owned write helper；公开合同按 admission、状态、事件、失败和恢复分层。
- 架构：forced control-plane 仍是窄化例外；唯一 durable write 与 recovery 继续使用同一个 per-session write queue；没有第二把锁或 repository 旁路。
- 安全：DTO 严格拒绝非法类型、数组、primitive 与未知字段；未知 internal signal 错误不向客户端暴露内部异常。
- 性能：保持 `150ms` grace、`300ms` forced-abort、`1_000ms` external-signal 与 `30_000ms` 测试预算；未引入额外轮询或无界等待。

## 未运行与授权边界

浏览器人工验收、真实 Provider/Model smoke、远端 CI、push、PR 元数据更新、merge、Issue 关闭、发布、部署和数据删除均未运行；本轮只进行本地代码、测试、文档、治理、hash 登记和后续本地 commit。