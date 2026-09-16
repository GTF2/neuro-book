---
schema: nbook.spec/v1
kind: behavior
status: implemented
capability: agent.session-followup-queue
owners:
  - agent-runtime
  - session-persistence
---

# Agent Session Follow-up 队列投递

本文定义 Agent Session durable follow-up 队列的公开状态、单条与批量处理入口、暂停后的自动重试与人工接管边界。队列的消费与暂停内部机制沿用现有实现；本规范只约束对外可观察行为。取舍背景见 [Proposal](../../../packages/neuro-book/docs/proposals/agent-followup-queue-delivery.md)。

## 目标与非目标

目标：

- 让队列状态对用户可见：每条队列项暴露来源，队列整体暴露状态与暂停原因。
- 让用户能处理任意队列项：单条「送达」与单条「忽略」；暂停时可在不展开的情况下批量送达或批量忽略。
- 让暂停队列能自愈：会话空闲时自动重试投递，有次数上限与退避；超限转为「需人工处理」，不静默卡死。
- 让「停止运行」不丢队列：用户中止当前轮只中止运行，队列项全部保留为暂停，由用户决定后续处理。
- 保持界面克制：队列默认只占一行，不新增弹窗、状态条或与投递无关的控件。

非目标：

- 不改变 `steer` 语义与 steer 队列行为。
- 不改变 durable 队列的持久化结构，不做数据迁移。
- 不合并「Workflow 待处理」面板，不建立跨会话队列总览。
- 不提供后台任务重跑、任务编辑或队列项内容编辑。
- 不定义真实 Provider 行为、远端部署或跨设备同步。

## 术语与参与者

- **Session**：由 `sessionId` 定位、具有 durable history 与 live projection 的 Agent 对话。
- **follow-up 队列项**：等待在会话空闲时投递给 Agent 的一条输入，来源可能是用户（运行中排队）或系统（后台任务回流）。
- **来源**：队列项的公开身份，取值只有「用户」与「后台任务」两类；内部 `caller` 细节不对外暴露。
- **队列暂停**：队列停止自动投递的状态，携带原因（运行出错 / 被中止 / 进程中断 / 投递准入失败）与可选的可读说明。
- **准入失败**：队列项在执行前校验（附件、模型、策略）不通过，投递无法继续。
- **自动重试**：会话空闲后由系统发起的重新投递尝试，有次数上限与退避间隔。
- **需人工处理**：自动重试超过上限后队列停留的状态，等待用户选择重试或忽略。

## 输入与前置条件

HTTP 入口：

```text
POST   /api/agent/sessions/:sessionId/followups/:itemId/deliver
DELETE /api/agent/sessions/:sessionId/followups/:itemId
POST   /api/agent/sessions/:sessionId/followups/resume
```

路径参数：

- `sessionId` 与 `itemId` 必须是安全正整数与有效队列项标识；非法值返回 HTTP 400。
- Session 不存在返回 HTTP 404，错误码沿用现有 Session 错误合同。
- 队列项不存在或已被处理：返回 404 语义，不静默成功。

前置状态：

- 队列状态读取不要求会话空闲。
- 单条送达在会话运行中仍可发起，但按「置顶排到本轮结束后」处理，不打断当前 invocation。

## 输出与可观察行为

队列状态投影：

- 队列项新增来源字段，取值为「用户」或「后台任务」；缺失内部 `caller` 的旧队列项投影为未知来源。
- 队列状态包含：状态（`ready` / `paused`）、暂停原因与可读说明、自动重试进度（已试次数 / 上限）与「是否已转人工」。
- 不输出 `profileKey`、`toolCallId` 等内部标识。

界面反馈：

- 折叠条一行显示队列条数与当前状态；正常排队为低调样式，暂停为警示样式并附一行原因。
- 批量操作（全部忽略 / 全部送达）与展开切换位于折叠条右上角，未展开也可完成处理。
- 展开后按时间顺序列出队列项：来源徽标、人话标题、时间、原文入口与单条操作。
- 送达后该项从队列消失并作为消息出现在对话流中；忽略后该项永久移除。
- 运行中提交送达只是「置顶排队」，按钮显示「等待送达」；只有会话空闲时提交才显示「已送达」。
- 展开窗口限高且可滚动，不挤占对话区。

## 状态与转换

| 当前状态 | 触发 | 下一状态 | 说明 |
|---|---|---|---|
| ready | 新项入队 | ready | 按时间顺序等待投递 |
| ready | 会话空闲 | ready | 正常投递并逐条 ack |
| ready | 投递准入失败 | paused（准入失败） | 保留队首并公开有界原因 |
| ready | 运行出错 / 进程中断 | paused（对应原因） | 停止自动投递，等待空闲自愈 |
| ready | 用户主动停止运行 | paused（用户停止） | 队列项全部保留；该暂停不自动重试，只由用户操作恢复 |
| paused | 会话空闲（自动重试） | ready 或 paused | 仅当暂停原因不是「用户停止」时参与；重试成功则继续投递，失败重新暂停并累加次数 |
| paused | 用户「全部送达」 | ready | 解除暂停并按时间顺序投递 |
| paused | 自动重试超过上限 | needs-attention | 停止自动重试，等待人工 |
| needs-attention | 用户「手动重试」 | ready 或 needs-attention | 重新尝试投递并重置计数 |
| 任意 | 用户忽略单条 / 全部忽略 | 队列项消失 | 忽略不可撤销；全部忽略需要界面二次确认 |

并发与幂等：同一队列项只能被投递一次；重复送达请求按「已不存在」处理，不重复投递。同一会话的队列操作串行化在 Session mutation 边界内，不并发改写队列真相。

## 副作用与数据

- 送达会向 Session 写入消息，并可能触发一次 invocation（会话空闲时）。
- 忽略会把队列项从队列真相中永久移除，不写入 Session 消息。
- 自动重试会真实触发投递流程，包含模型调用；因此必须有次数上限，且只在该 Session 空闲时发起。
- 队列真相仍保存在 Session custom state，本规范不引入新的持久化格式与迁移。
- 事件：队列状态与队列项变化通过现有 Session 事件通道对外广播。

## 失败与恢复

- 准入失败：队列进入暂停，公开有界原因；队首保留，不丢弃消息与附件。
- 投递的运行失败不重放：队列项的消息一旦 durable 写入会话即按「已送达」处理并被 ack——即使随后的模型运行失败，也不会把这条用户消息重新投递（失败的是那轮运行，不是投递）；队列因此回到 `ready` 空态，运行错误走既有 invocation 错误呈现。自动重试的「失败」指队列再次进入暂停（如准入失败），此时累加重试次数。
- 自动重试失败：累加次数并按退避间隔延后；达到上限转为 `needs-attention`，停止自动重试并公开原因。
- 手动重试失败：保持 `needs-attention`，界面保留重试入口，不清空队列。
- 会话运行中的单条送达：置顶而不打断当前 invocation；本轮结束后按顺序第一个送达。
- 用户主动停止运行：只中止当前 invocation；队列项全部保留并进入暂停。已经写入 Session 的消息不回滚（它已属于对话历史），尚未投递的项留在队列里等用户处理。该暂停不参与自动重试，否则「停止」会立刻把下一条送进运行。
- 进程重启恢复：沿用现有恢复路径；`needs-attention` 的队列不自动转为可投递，避免无界重试。
- 校验失败（非法 `sessionId` / `itemId`）：fail-closed，返回 4xx，不产生任何队列副作用。

## 边界与兼容

- 来源字段为白名单枚举，新增来源类型必须同步本规范与投影映射。
- 旧队列项与旧客户端：新字段缺失时界面按「未知来源」与「无自愈信息」降级，不报错。
- 新接口为纯新增。界面「停止」使用 abort 的 `clearQueue: false`，让队列暂停保留；`clearQueue` 的默认清空语义保留给「取消整批待回答输入」等显式丢弃路径。两者对队列的作用必须保持可区分（停止 = 保留并暂停、忽略 = 移除单条、取消整批 = 清空）。
- 队列与「Workflow 待处理」仍是两个独立能力，界面需要能让用户区分二者。
- 权限：队列操作与现有 Session 交互策略（`canInvoke` 等）保持一致；不允许在会话不可交互时绕过策略投递。

## 验收与 Smoke

1. **暂停可见（主路径）**：Given 会话有 2 条后台任务通知且队列因进程中断而暂停；When 用户打开该会话；Then 折叠条显示「队列已暂停 · 2 条消息没有送达」与一行原因，展开后每条显示「后台任务」来源与「原文」入口，且没有任何内部字段。
2. **单条送达（空闲）**：Given 队列暂停且会话空闲、有 2 条待送达；When 用户对第 1 条点「立即送达」；Then 该条作为消息出现在对话流中，队列剩 1 条，暂停状态与另一条保持不变。
3. **运行中送达**：Given 会话正在运行且队列有 1 条；When 用户点「立即送达」；Then 当前 invocation 不被打断，该条被置顶并在本轮结束后第一个送达。
4. **忽略与二次确认**：Given 队列有 1 条通知；When 用户点「忽略」；Then 该项永久移除且不再送达；When 用户点「全部忽略」；Then 界面先要求二次确认。
5. **空闲自愈**：Given 队列因上一轮中断而暂停、会话空闲；When 自动重试成功；Then 队列按顺序投递完成并恢复 `ready`，界面不再显示暂停提示。
6. **超限转人工**：Given 自动重试已连续失败 3 次；When 会话再次空闲；Then 队列不再自动重试，界面显示「需人工处理」与原因，并提供手动重试入口。
7. **停止不丢队列**：Given 会话正在运行且队列有 2 条（其中 1 条刚被点过「送达」）；When 用户点右下角「停止」；Then 当前运行被中止，2 条消息仍留在队列里并显示「队列已暂停 · 你停止了上一轮…」；会话空闲后不会自动重新投递，直到用户点「送达」或「全部送达」。

Smoke：在本地应用（`http://localhost:3000`）打开一个队列暂停的会话，按第 1、2、4 条逐步操作，检查折叠条文案、条目来源徽标与对话流变化；用接口直接调用 resume 验证第 5 条的空闲自愈路径。

## 实现合同

- **队列操作**:[`server/agent/harness/neuro-agent-harness.ts`](../../../packages/neuro-book/server/agent/harness/neuro-agent-harness.ts) 的 `deliverFollowUpItem` / `dismissFollowUpItem` / `resumeFollowUps`,全部在 Session mutation 边界内串行化;空闲自动重试由 invocation `completed` 收尾钩子 `resumePausedFollowUpsThenDrain` 触发,上限 `FOLLOW_UP_AUTO_RETRY_LIMIT = 3`。队列项不存在统一抛 `AgentFollowUpItemMissingError`。
- **HTTP**:[`server/api/agent/sessions/[sessionId]/followups/`](../../../packages/neuro-book/server/api/agent/sessions/[sessionId]/followups/) 三个路由(单条 deliver / 单条 DELETE / resume);`server/agent/http.ts` 把 `AgentFollowUpItemMissingError` 映射为 404(`AGENT_FOLLOW_UP_ITEM_NOT_FOUND`),`itemId` 非法返回 400。
- **公开投影**:`server/agent/events/public-queue-projection.ts` 把内部 `caller` 白名单映射为 `source`(user → 用户;agent / system → 后台任务;缺失 → unknown),不输出 `profileKey` / `toolCallId` / `sessionId`;`shared/dto/agent-session.dto.ts` 新增可选 `source` 与 `autoRetry`(attempt / limit / exhausted)。
- **界面**:`AgentFollowUpQueuePanel.vue` 为纯展示组件(折叠条 + 展开列表,不自己发请求),由 `AgentComposer` 挂载、`AgentChatSurface` 承接操作与二次确认;「停止运行」使用 abort 的 `clearQueue: false`。
- **关键不变量**:`autoRetry` 计数为进程内存态,进程重启后归零——paused 队列沿用既有恢复路径重新获得自动重试额度;`deliver` / `resume` 操作会重置计数;自动重试只由 `completed` 收尾触发,error / aborted 收尾不触发。
- **测试**:[`neuro-agent-harness.test.ts`](../../../packages/neuro-book/server/agent/harness/neuro-agent-harness.test.ts) 覆盖送达置顶与真实投递、忽略保留暂停原因且不投递、completed 收尾自动重试与进度公开、重试 3 次超限转人工、用户停止不自动重试 + 显式恢复;[`public-queue-projection.test.ts`](../../../packages/neuro-book/server/agent/events/public-queue-projection.test.ts) 锁定 `source` 白名单映射与内部标识不外泄。

## 证据

- Proposal:[`agent-followup-queue-delivery.md`](../../../packages/neuro-book/docs/proposals/agent-followup-queue-delivery.md)(`accepted`,含开发者对「停止不清队列」等取舍的决策记录)
- 实现与测试:见上文实现合同;2026-09-16 收编时补齐合同测试并经 `server/agent` 套件回归验证
- 界面原型:`queue-stuck-redesign.html`(工作区根,含三情景与自愈/超限演示)
