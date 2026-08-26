---
schema: nbook.walkthrough/v1
taskId: 00159-agent-abort-mutation-contract
sequence: 6
role: tasker
status: completed
createdAt: 2026-08-26T17:47:20Z
---
# Cooperative abort 终态 queue pause 失败修复

## 发现与复现

审查 running cooperative abort 的 `clearQueue=false` 终态窗口：旧顺序先写 `aborted` lifecycle，再写 follow-up queue pause。通过在第二次 `AGENT_FOLLOW_UP_QUEUE_STATE_KEY` projection 写入时注入失败，RED 结果为历史出现 `start -> aborted -> aborted`，确认外层 `failInvocation()` 会重复追加终态。

## 修复

`commitInvocationState()` 对 `aborted` terminal 先在同一 `SessionWriteExecutor` queue 完成 follow-up pause，再写唯一 `aborted` lifecycle。pause 失败时 lifecycle 尚未落盘，错误路径可重试 side effect；成功后释放 ownership 并发布既有 abort terminal。普通 `error` terminal 与 waiting lifecycle 顺序保持不变。

新增黑盒回归 `running cooperative abort 的终态 queue pause 失败不重复 aborted lifecycle`，断言：

- 第二步 queue projection failure 确实发生；
- invocation 返回 `{status: "error", aborted: true}`；
- lifecycle 为 `start -> aborted`，匹配 invocation 只有一条 `aborted`；
- recovery 的 `activeInvocation` 为 `null`；
- `clearQueue=false` 的 follow-up 最终为 `paused`，`pausedBy.reason` 为 `aborted`，原 queue item 保留。

## 验证

| 检查 | 实际命令与结果 |
| --- | --- |
| targeted regression | `bun run --cwd packages/neuro-book test -- server/agent/harness/neuro-agent-harness.black-box.test.ts -t "running cooperative abort 的终态 queue pause 失败不重复 aborted lifecycle" --reporter=verbose`；`1 passed` |
| related waiting/cooperative | 代表性 8 个场景过滤运行；`6 passed` |
| focused-test | `bun run --cwd packages/neuro-book test -- server/agent/harness/neuro-agent-harness.black-box.test.ts server/agent/harness/neuro-agent-harness.test.ts server/agent/session/write-plan.test.ts "server/api/agent/sessions/[sessionId]/abort.post.test.ts" server/agent/http.test.ts shared/dto/agent-session.dto.test.ts --reporter=dot --silent`；`6 files / 309 passed` |
| regression-test | `bun run --cwd packages/neuro-book test:agent -- --reporter=dot --silent`；`156 files / 1468 passed` |
| typecheck | `bun run --cwd packages/neuro-book typecheck`；exit code `0` |

四份公开合同已同步该 queue-before-lifecycle 与失败不重复语义；`write-plan.ts`、`write-plan.test.ts` 未修改；Task 00158 外来改动未修改、未提交。

docs-check：`bun run docs:check`；`failures: []`、`checkedFiles: 5288`。
governance-check：`bun run governance:check`；`failures: []`、`warnings: []`。
diff-check：`git diff --check`；通过，仅有 Git LF/CRLF 转换警告，无 whitespace error。
浏览器人工验收、真实 Provider/Model smoke、远端 CI、push、PR 元数据更新、merge、Issue 关闭、发布、部署和数据删除仍未执行。
