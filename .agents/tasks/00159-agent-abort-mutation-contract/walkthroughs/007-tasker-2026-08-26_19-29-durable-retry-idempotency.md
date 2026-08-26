---
schema: nbook.walkthrough/v1
taskId: 00159-agent-abort-mutation-contract
sequence: 7
role: tasker
status: completed
createdAt: 2026-08-26T19:29:54Z
---
# Cooperative abort durable retry 幂等修复

## 问题

sequence 006 修复了 `clearQueue=false` cooperative terminal 的 queue pause 顺序，但仍存在部分持久化窗口：第一次 `commitInvocationState()` 可能已经写入精确 invocation 的 `aborted` lifecycle，随后第二次 queue projection pause 失败；外层错误路径重试时若不读取 durable history，会再次 append 相同 lifecycle。

## 修复

`commitInvocationState()` 继续只让 `aborted` terminal 进入本次幂等分支，并在同一个 `withSessionMutation()` 临界区读取 `repo.readSession()`。它按精确 `invocationId` 与 `status: "aborted"` 查找 durable lifecycle：

- 不存在时，通过既有 per-session `SessionWriteExecutor` 写入唯一 lifecycle；该 abort-owned write 使用 `runAbortDurabilityWrite()` 归一化失败；
- 已存在时跳过 lifecycle append；两种情况都继续执行 `pauseFollowUps()` 与 `finishInvocation()`；
- `end`、普通 `error` 和 `waiting` lifecycle 仍保持原路径与顺序，不使用该 aborted-only snapshot 判断。

## 回归证据

黑盒测试 `running cooperative abort 的终态 queue pause 失败不重复 aborted lifecycle` 在第二次 `AGENT_FOLLOW_UP_QUEUE_STATE_KEY` projection 写入时注入失败，并在注入点读取 durable snapshot。测试确认该精确 invocation 已有且仅有一条 `aborted` lifecycle；错误路径随后完成第三次 queue projection retry，最终 lifecycle 为 `start -> aborted`，follow-up 保留为 `paused`，`activeInvocation` 为 `null`，原 queue item 未丢失。

## 实际验证

| 检查 | 实际命令与结果 |
| --- | --- |
| targeted regression | `bun run --cwd packages/neuro-book test -- server/agent/harness/neuro-agent-harness.black-box.test.ts -t "running cooperative abort 的终态 queue pause 失败不重复 aborted lifecycle" --reporter=verbose`；`1 passed` |
| focused-test | `bun run --cwd packages/neuro-book test -- server/agent/harness/neuro-agent-harness.black-box.test.ts server/agent/harness/neuro-agent-harness.test.ts server/agent/session/write-plan.test.ts "server/api/agent/sessions/[sessionId]/abort.post.test.ts" server/agent/http.test.ts shared/dto/agent-session.dto.test.ts --reporter=dot --silent`；`6 files / 309 passed` |
| regression-test | `bun run --cwd packages/neuro-book test:agent -- --reporter=dot --silent`；`156 files / 1468 passed` |
| typecheck | `bun run --cwd packages/neuro-book typecheck`；exit code `0` |
| docs-check | `bun run docs:check`；`failures: []`、`checkedFiles: 5289` |
| governance-check | `bun run governance:check`；`failures: []`、`warnings: []` |
`write-plan.ts`、`write-plan.test.ts` 未修改；Task 00158 的既有 README 与未跟踪 walkthrough 未修改、未提交；sequence 006 历史记录保持不变。浏览器人工验收、真实 Provider/Model smoke、远端 CI、push、PR 元数据更新、merge、Issue 关闭、发布、部署和数据删除仍未执行。