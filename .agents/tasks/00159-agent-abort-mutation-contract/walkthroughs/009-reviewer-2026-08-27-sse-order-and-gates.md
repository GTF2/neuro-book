---
schema: nbook.walkthrough/v1
taskId: 00159-agent-abort-mutation-contract
sequence: 9
role: reviewer
status: completed
createdAt: 2026-08-27T02:35:56Z
---
# Cooperative abort repair 的 SSE 顺序审查

## 审查发现

`commitInvocationState()` 在 cooperative `aborted` lifecycle 已持久化但自动 leaf 缺失时，会通过同一个 `SessionWriteExecutor` 调用 `ensureAutoLeaf()`。该 helper 默认在 write plan 完成后发布 `session_state_changed`；如果不抑制该发布，repair 的状态事件可能先于 `runLoop` 的 `agent_end(aborted)`，违反 Running terminal 的公开顺序。

## 修复

cooperative partial-persistence repair 现在调用 `ensureAutoLeaf(..., {suppressEvents: true})`。repair 只补 durable auto leaf；Running terminal 的 `session_state_changed` 仍由 `finishInvocation()` 在 `agent_end(aborted)` 后统一发布。未改变 waiting partial-repair、普通 `end`/`error`/`waiting` lifecycle 或 abort-owned write 的错误分类。

## 回归断言

黑盒测试 `running cooperative abort 的部分 lifecycle append 重试补齐 active leaf` 在启动 invocation 前订阅 session events，并只观察精确 `invocationId`：

- `invocation_aborted` 必须先于 `agent_end(status: "aborted")`；
- 两者之间不得出现 `session_state_changed`；
- terminal 之后必须恰好出现一个 `session_state_changed`；
- durable history 仍保持单条 `start -> aborted` lifecycle，重试补齐唯一 active auto leaf，并释放 `activeInvocation`。

为验证断言有效，临时移除 `suppressEvents` 后运行目标回归，旧实现收到 5 个精确 invocation 的 `session_state_changed`，`toHaveLength(1)` 断言失败；恢复参数后目标回归通过。

## 实际验证

| 检查 | 实际命令与结果 |
| --- | --- |
| fixed targeted regression | `bun run --cwd packages/neuro-book test -- server/agent/harness/neuro-agent-harness.black-box.test.ts -t "running cooperative abort 的部分 lifecycle append 重试补齐 active leaf" --reporter=verbose`；`1 passed` |
| focused-test | `bun run --cwd packages/neuro-book test -- server/agent/harness/neuro-agent-harness.black-box.test.ts server/agent/harness/neuro-agent-harness.test.ts server/agent/session/write-plan.test.ts "server/api/agent/sessions/[sessionId]/abort.post.test.ts" server/agent/http.test.ts shared/dto/agent-session.dto.test.ts --reporter=dot --silent`；`6 files / 310 passed` |
| regression-test | `bun run --cwd packages/neuro-book test:agent -- --reporter=dot --silent`；`156 files / 1469 passed` |
| typecheck | `bun run --cwd packages/neuro-book typecheck`；exit code `0` |
| docs-check | `bun run docs:check`；`failures: []`、`checkedFiles: 5290` |
| governance-check | `bun run governance:check`；`failures: []`、`warnings: []` |
| diff-check | `git diff --check`；exit code `0`，仅报告 LF/CRLF 转换警告，无 whitespace error |

未修改 `packages/neuro-book/server/agent/session/write-plan.ts` 或 `write-plan.test.ts`；未覆盖 sequence 001–008；未修改或提交 Task 00158 外来改动。浏览器人工验收、真实 Provider/Model smoke、远端 CI、push、PR 元数据更新、merge、Issue 关闭、发布、部署和数据删除仍未执行。
