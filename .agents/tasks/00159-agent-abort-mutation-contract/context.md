# 任务上下文（PR #216 review remediation 最终快照）

快照时间：2026-08-26T18:21:24Z

## 基线与授权

- checkout：`.worktree/t159-agent-abort-contract`
- branch：`feat/t159-agent-abort-contract`
- 本轮基线 HEAD：`88390ba44f6f78eb60789164027f2515eaaa1e8d`（PR #216 首轮交付）；本轮未合并或 rebase 远端 `master`。
- 远端 master：`8fdb304130e42fa04876b8b470bf3aaf3b9997aa`（已包含 00158 修复；本轮不合并/rebase base）。
- `actionIssueId: null`；本轮授权范围为本地实现、测试、文档、Task 记录、迁移登记与 local commit；不含 merge、关闭 Issue、发布、部署、真实 Provider/Model、浏览器人工验收或远端 PR 写入。
- 00158 的 README 与 walkthrough 是外来用户改动，本轮不修改、不提交。

## 本轮唯一 scope

修复 16 名 reviewer 合并报告确认的两个真实运行时缺陷与合同措辞二义：

1. **internal-signal durability failure**：external `AbortSignal` 或 Project-close 触发 forced abort，`enqueueForcedAbort()` 同步失败时，原 `invokeAgent()` 有界返回 `status: "error"`，不伪造成功、不释放 ownership。
2. **durability write 错误分类**：abort-owned queue/waiting write 统一收敛到 `AgentAbortDurabilityError`（503、`session_abort_durability_unavailable`、`retryable: true`），其它 projection/read/profile/authorization 错误保持原分类。
3. **running cooperative terminal 原子性**：`clearQueue=false` 先持久化 follow-up pause，再写唯一 `aborted` lifecycle；终态 queue projection 第二步失败时不重复 lifecycle，重试完成 paused queue。
4. **公开合同措辞**：统一 `expectedInvocationId` 内部属性、三支 admission、Aborting 重试、Running/Waiting SSE 顺序、steer 与 `clearQueue`、`interrupted` recovery 投影和 existing-aborted recovery 语义。

非目标：`write-plan.ts`/`write-plan.test.ts` 只读回归基线；不增加第二把锁、repository 旁路、兼容分支、timeout 放宽或伪造 durable success。
## 最终验证（2026-08-26）

- focused-test：6 files / 309 passed。
- regression-test：156 files / 1468 passed。
- package typecheck：exit code 0。
- `bun run docs:check`：`failures: []`、`checkedFiles: 5288`。
- `bun run governance:check`：`failures: []`、`warnings: []`。
- `git diff --check`：通过；仅有 Git LF/CRLF 转换警告，无 whitespace error。
- Task 18 canonical/destination hash：`sha256:4cdd4a88b7d86bed12c7246d282415a5faacec30fa7fa675b3cf767d612c97e6`；`sourceSha256` 未变；manifest hash：`sha256:d4973620e6a2c63ee6c568815b5e76edb7178cc8121372280b3b16cb40682c57`。

## 预算（保持不变）

`INVOCATION_ABORT_GRACE_MS = 150`、forced-abort `300ms`、external-signal `1_000ms`、外层测试 `30_000ms`。


## 未运行与边界

浏览器人工验收、真实 Provider/Model smoke、远端 CI、push、PR 元数据更新、merge、Issue 关闭、发布、部署和数据删除均未运行；本地 remediation commit 是本轮预期交付。
