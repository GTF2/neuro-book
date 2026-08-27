---
schema: nbook.walkthrough/v1
taskId: 00159-agent-abort-mutation-contract
sequence: 10
role: reviewer
status: completed
createdAt: 2026-08-27T03:59:38Z
---
# 断言与验证证据校准

## 校准原因

sequence 009 已经完成并提交，按 Task 治理规则保持原文不变。本轮审查发现其测试断言需要同时保证终端事件存在性与顺序，并且不得把 invocation 全生命周期的 `session_state_changed` 计入终态唯一性；README/context 的当前 `docs:check` 计数也必须与实际输出一致。

## 代码与测试校准

- 恢复 `abortEventAt >= 0`，保证 `invocation_aborted` 存在。
- 恢复 `terminalEventAt > abortEventAt`，保证 `agent_end(status: "aborted")` 存在且顺序正确。
- 保留 `invocation_aborted` 与 `agent_end(aborted)` 之间无 `session_state_changed` 的区间断言。
- 终态 state 只统计 `index > terminalEventAt` 的 `terminalStateEvents`，并要求恰好一个；不再统计包含 `prepareRun`/lifecycle 的全生命周期 state。
- cooperative partial auto-leaf repair 保持 `ensureAutoLeaf(..., {suppressEvents: true})`，避免 repair 在 `agent_end(aborted)` 前发布 state。

临时移除 `suppressEvents` 后运行目标回归，固定测试在 terminal 后 `terminalStateEvents` 数量为 2 处失败；恢复参数后 fixed target 通过。该 RED 只用于终态区间集合，不把全生命周期 state 数量作为合同。

## 验证计数校准

sequence 009 原文保持历史记录，其中 `docs:check` 的 `checkedFiles: 5290` 不回写。当前 Task README、context 和本 walkthrough 的最终权威验证记录统一使用新增 sequence 010 后实际 `docs:check` 输出的 `checkedFiles: 5292`。

## 实际验证

| 检查 | 实际命令与结果 |
| --- | --- |
| fixed target | `bun run --cwd packages/neuro-book test -- server/agent/harness/neuro-agent-harness.black-box.test.ts -t "running cooperative abort 的部分 lifecycle append 重试补齐 active leaf" --reporter=verbose`；`1 passed` |
| focused-test | `bun run --cwd packages/neuro-book test -- server/agent/harness/neuro-agent-harness.black-box.test.ts server/agent/harness/neuro-agent-harness.test.ts server/agent/session/write-plan.test.ts "server/api/agent/sessions/[sessionId]/abort.post.test.ts" server/agent/http.test.ts shared/dto/agent-session.dto.test.ts --reporter=dot --silent`；`6 files / 310 passed` |
| regression-test | `bun run --cwd packages/neuro-book test:agent -- --reporter=dot --silent`；`156 files / 1469 passed` |
| typecheck | `bun run --cwd packages/neuro-book typecheck`；exit code `0` |
| docs-check | `bun run docs:check`；`failures: []`、`checkedFiles: 5292` |
| governance-check | `bun run governance:check`；`failures: []`、`warnings: []` |
| diff-check | `git diff --check`；通过，仅有 LF/CRLF 转换警告，无 whitespace error |

本轮未修改 `packages/neuro-book/server/agent/session/write-plan.ts` 或 `write-plan.test.ts`，未覆盖 sequence 001–009，未修改或提交 Task 00158 外来改动。浏览器人工验收、真实 Provider/Model smoke、远端 CI、push、PR 元数据更新、merge、Issue 关闭、发布、部署和数据删除仍未执行。
