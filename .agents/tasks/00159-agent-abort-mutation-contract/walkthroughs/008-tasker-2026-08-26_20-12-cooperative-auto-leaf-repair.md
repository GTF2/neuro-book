---
schema: nbook.walkthrough/v1
taskId: 00159-agent-abort-mutation-contract
sequence: 8
role: tasker
status: completed
createdAt: 2026-08-26T20:12:50Z
---
# Cooperative abort partial auto-leaf repair

## 问题与 RED

`SessionRepository.appendEntry()` 对非 leaf entry 先写 lifecycle，再单独写自动 leaf。若第二个 `appendLine` 失败，精确 invocation 的 `aborted` lifecycle 已在 JSONL 中，但 active leaf 仍指向旧 entry。此前 `commitInvocationState()` 只根据 durable lifecycle 是否存在跳过重复 append，重试会结束 invocation 却留下缺失的 active leaf。

先加入黑盒回归并在修复前运行：

```text
bun run --cwd packages/neuro-book test -- server/agent/harness/neuro-agent-harness.black-box.test.ts -t "running cooperative abort 的部分 lifecycle append 重试补齐 active leaf" --reporter=verbose
```

结果：失败；最终 `snapshot.leafId` 仍是旧 leaf，不等于已落盘 `aborted` lifecycle 的 entry ID，确认 partial append blocker。

## 修复

`commitInvocationState()` 只对 aborted terminal 读取一次 durable snapshot，并保留精确匹配的 `aborted` lifecycle。若 lifecycle 已存在且 snapshot 的 active leaf 不是该 lifecycle，则调用既有 `ensureAutoLeaf()` helper；该 helper 生成 `lifecycle.aborted.repair` plan，经同一个 per-session `SessionWriteExecutor` queue 幂等追加 auto leaf，然后继续原有 queue pause 与 `finishInvocation()`。`repo.readSession()` 保持在 `runAbortDurabilityWrite()` 外，ordinary `end`、`error`、`waiting` lifecycle 继续沿用原错误分类。

## 回归证据

黑盒测试 `running cooperative abort 的部分 lifecycle append 重试补齐 active leaf` 在匹配精确 aborted lifecycle 的 auto-leaf `appendLine` 调用前读取 durable snapshot，并注入第二个物理写失败。失败点确认：

- 精确 invocation 只有一条 `status: "aborted"` lifecycle；
- 对应 auto leaf 数量为 0；
- active leaf 仍不是该 lifecycle。

注入解除后，cooperative terminal 的错误路径重试同一 invocation。最终确认：

- invocation 返回 `{status: "error", aborted: true}`；
- lifecycle 序列保持 `start -> aborted`，匹配 lifecycle 只有一条；
- active leaf 指向 aborted lifecycle，且对应 auto leaf 恰好一条；
- `activeInvocation` 为 `null`。

## 实际验证

| 检查 | 实际命令与结果 |
| --- | --- |
| RED | 同上；修复前 `1 failed`，暴露 active leaf 未修复 |
| targeted regression | `bun run --cwd packages/neuro-book test -- server/agent/harness/neuro-agent-harness.black-box.test.ts -t "running cooperative abort 的部分 lifecycle append 重试补齐 active leaf" --reporter=verbose`；`1 passed` |
| related cooperative/waiting | `bun run --cwd packages/neuro-book test -- server/agent/harness/neuro-agent-harness.black-box.test.ts server/agent/harness/neuro-agent-harness.test.ts -t "running cooperative abort 的终态 queue pause 失败不重复 aborted lifecycle|running cooperative abort 的部分 lifecycle append 重试补齐 active leaf|waiting abort 的 partial lifecycle append|waiting abort 的 lifecycle 持久化失败|WaitingUser \\+ abort|Running \\+ abort 清理 steer" --reporter=dot --silent`；`2 files / 6 passed / 222 skipped` |
| focused-test | `bun run --cwd packages/neuro-book test -- server/agent/harness/neuro-agent-harness.black-box.test.ts server/agent/harness/neuro-agent-harness.test.ts server/agent/session/write-plan.test.ts "server/api/agent/sessions/[sessionId]/abort.post.test.ts" server/agent/http.test.ts shared/dto/agent-session.dto.test.ts --reporter=dot --silent`；`6 files / 310 passed` |
| regression-test | `bun run --cwd packages/neuro-book test:agent -- --reporter=dot --silent`；`156 files / 1469 passed` |
| typecheck | `bun run --cwd packages/neuro-book typecheck`；exit code `0` |
| docs-check | `bun run docs:check`；`failures: []`、`checkedFiles: 5290` |
| governance-check | `bun run governance:check`；`failures: []`、`warnings: []` |
| diff-check | `git diff --check`；通过，仅有 LF/CRLF 转换警告，无 whitespace error |

本轮没有修改 `packages/neuro-book/server/agent/session/write-plan.ts` 或 `write-plan.test.ts`，没有覆盖历史 walkthrough，没有修改 Task 00158 外来改动。浏览器人工验收、真实 Provider/Model smoke、远端 CI、push、PR 元数据更新、merge、Issue 关闭、发布、部署和数据删除仍未执行。
