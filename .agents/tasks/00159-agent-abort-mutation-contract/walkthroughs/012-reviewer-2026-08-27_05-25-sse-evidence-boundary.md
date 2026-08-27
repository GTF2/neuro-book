---
schema: nbook.walkthrough/v1
taskId: 00159-agent-abort-mutation-contract
sequence: 12
role: reviewer
status: completed
createdAt: 2026-08-27T05:21:47Z
---
# SSE 证据语义边界校正

## 校正原因

本记录按 Task 的 append-only 规则补充 sequence 009–011 的语义边界。sequence 009 与 010 已完成并提交，sequence 011 已在 `2c2bdf51` 中完成；本记录不回写或追加它们，只把历史风险与本轮实测结果分开说明。

## 证据边界

- sequence 009 中“repair state 可能先于 `agent_end(aborted)`”是旧实现路径上的历史风险判断，保留为审查背景，不是本轮保留的事件 trace，也不应解读为本轮已经实测到 terminal 前的 state。
- sequence 010 记录的本轮实际 RED 是 terminal 后 `terminalStateEvents=2`，因此终态唯一性断言失败；`invocation_aborted -> agent_end(aborted)` 区间内无 `session_state_changed` 的 interval 断言同时通过。
- 本轮修复与当前证据针对 terminal 后重复 `session_state_changed`，不是已实测的 terminal 前提前 state。
- sequence 011 继续负责不使用未保留 trace 支撑的其它具体 received 数量；本记录只使用 sequence 010 已记录的 `terminalStateEvents=2`。

## 记录关系

011 已恢复为提交 `2c2bdf51` 中的原文。009、010、011 均保持 append-only 历史内容；012 是独立的语义澄清记录，并成为 Task README 与 context 的最新证据入口。没有源码或测试行为变更。

## 实际验证

| 检查 | 实际命令与结果 |
| --- | --- |
| docs-check | `bun run docs:check`；`failures: []`、`checkedFiles: 5294` |
| governance-check | `bun run governance:check`；`failures: []`、`warnings: []` |
| diff-check | `git diff --check`；通过，无 whitespace error；并以 `git diff --exit-code -- .agents/tasks/00159-agent-abort-mutation-contract/walkthroughs/011-reviewer-2026-08-27-red-evidence-correction.md` 确认 011 相对 `2c2bdf51` 无差异 |

未重复运行 focused-test、regression-test 或 typecheck；本次仅新增文档证据与入口引用。未修改源码、测试、sequence 009–011，未修改或提交 Task 00158 外来改动。浏览器人工验收、真实 Provider/Model smoke、远端 CI、push、PR 元数据更新、merge、Issue 关闭、发布、部署和数据删除仍未执行。
