---
schema: nbook.walkthrough/v1
taskId: 00159-agent-abort-mutation-contract
sequence: 11
role: reviewer
status: completed
createdAt: 2026-08-27T04:53:14Z
---
# RED 证据与最终记录校正

## 校正原因

sequence 009 和 010 已完成并提交，按 Task 治理规则保持原文不变。复核发现其中关于旧实现收到的具体 `session_state_changed` 数量没有保留可审计的事件 trace，不能把该具体数量继续作为证据。最终记录改为只陈述实际观察到的目标回归失败，不补写未留存的 received 数值。

## 当前合同

- 测试保留 `abortEventAt >= 0`，保证 `invocation_aborted` 存在。
- 测试保留 `terminalEventAt > abortEventAt`，保证 `agent_end(status: "aborted")` 存在且顺序正确。
- `invocation_aborted` 与 `agent_end(aborted)` 之间不得出现 `session_state_changed`。
- 终态唯一性只统计 `index > terminalEventAt` 的 `terminalStateEvents`，要求恰好一个；不统计包含 prepare/lifecycle 的全生命周期 state。
- cooperative partial auto-leaf repair 继续使用 `ensureAutoLeaf(..., {suppressEvents: true})`。

临时移除 `suppressEvents` 后，目标回归确实在 terminal 后终态 state 唯一性断言处失败；该记录不声称未保留 trace 中的具体 received 数量。恢复参数后 fixed target 通过。

## 最终证据入口

Task README 与 context 改为指向本 walkthrough。sequence 009/010 保留为历史审查记录，本 walkthrough 的验证表是当前校正后的权威入口。

## 实际验证

| 检查 | 实际命令与结果 |
| --- | --- |
| fixed target | `bun run --cwd packages/neuro-book test -- server/agent/harness/neuro-agent-harness.black-box.test.ts -t "running cooperative abort 的部分 lifecycle append 重试补齐 active leaf" --reporter=verbose`；`1 passed` |
| focused-test | `bun run --cwd packages/neuro-book test -- server/agent/harness/neuro-agent-harness.black-box.test.ts server/agent/harness/neuro-agent-harness.test.ts server/agent/session/write-plan.test.ts "server/api/agent/sessions/[sessionId]/abort.post.test.ts" server/agent/http.test.ts shared/dto/agent-session.dto.test.ts --reporter=dot --silent`；`6 files / 310 passed` |
| regression-test | `bun run --cwd packages/neuro-book test:agent -- --reporter=dot --silent`；`156 files / 1469 passed` |
| typecheck | `bun run --cwd packages/neuro-book typecheck`；exit code `0` |
| docs-check | `bun run docs:check`；`failures: []`、`checkedFiles: 5293` |
| governance-check | `bun run governance:check`；`failures: []`、`warnings: []` |
| diff-check | `git diff --check`；通过，仅有 LF/CRLF 转换警告，无 whitespace error |

本轮未修改 `packages/neuro-book/server/agent/session/write-plan.ts` 或 `write-plan.test.ts`，未覆盖 sequence 001–010，未修改或提交 Task 00158 外来改动。浏览器人工验收、真实 Provider/Model smoke、远端 CI、push、PR 元数据更新、merge、Issue 关闭、发布、部署和数据删除仍未执行。
