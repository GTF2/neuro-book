# T0.7 审计结论与信息完整性修复记录（2026-09-18）

## 修复原因

初版的 `beatStats.factual` 统计的是全部章节、全部 kind 的 factual beat，不能证明当前 deadline 章已有兑现。早期某章的 factual plant 会掩盖当前章无 payoff 的情况，造成系统性漏报。

同时，World 自由文本缺少 patch 映射时的 `unknown` 被当成失败参与 advice，导致正常的新增事实几乎总显示「问题不大」。结算中的 `conflicts` / `unresolved` 已被协议解析，但服务没有消费；任一承诺、World 或 llmlint 读取失败会让完整报告消失。

## 实际改动

- 承诺判据改为：`open`、deadline 正好等于当前章，且当前章没有 `kind=payoff` 且 `state=factual` 的 beat，才提示「到了该兑现的时候」。
  - 服务新增内部详情列表方法，复用 repository 已查询的 beats / Scene / chapter 数据；普通 `GET /promises` 仍返回摘要数组，HTTP 契约不变。
  - `promise-beat` 仍是 `warn`，不会阻止作者定稿。
- World `unknown` / `unavailable` 仍明确标作不能核对，但不再伪装成正文或承诺问题；advice 单独提示「还有无法核对的项」。
- writer 结算的 `conflicts` 进入状态对照 issues 并形成 warning；`unresolved` 进入 `pendingItems`，作为待确认项而非错误。
- 承诺账本、llmlint 与 World 切面读取分别降级为 `unavailable`，保留截断的可诊断原因；章节不存在继续沿用 HTTP 失败语义。
- 路由区分「切面不存在」和底层 World 读取失败，并将审计 port 收到的 `prosePath` 实际传给 llmlint runner。
- 运行期 Reference 补记：`factual payoff` 仅是写后审计证据，不改变 `status` 或 `derivedStage`；写回清单登记当前章 factual payoff 的精确判据和 `warn` 动作。

## 验证

| 检查 | 结果 |
|---|---|
| `bun run --cwd packages/neuro-book test -- server/consistency/chapter-consistency-audit.service.test.ts server/plot/services/promise.service.test.ts` | 通过：2 个文件、22/22。 |
| 本轮相关服务/API 测试（含 T0.5、workspace archive） | 通过：5 个文件、63/63。 |
| `bun run --cwd packages/neuro-book typecheck` | 通过。 |
| `git diff --check` | 通过。 |

新增回归覆盖包括：别章 factual payoff 不掩盖当前章未兑现、当前章 factual payoff 通过、unknown 不触发 warning、promise warning 不阻塞定稿、conflicts / unresolved 的不同呈现，以及三类 ports 的独立降级。

## 边界与未运行项

- 仍然不声称自由文本事实已写入或未写入 World；没有结构化事实→patch 映射时只能是 `unknown`。
- 仍不写正文、World、Promise、Scene、worldAnchor 队列或 finalize 事件。
- 全量测试、E2E、`nuxt:build` 与真实 llmlint CLI API 集成未在本 Task 修复阶段运行；其中全量测试留待 M0 收口。
