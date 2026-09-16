# Agent 队列投递提案

状态：accepted

## 问题

Agent 会话的 durable follow-up 队列一旦进入 `paused`，用户在当前界面里**没有任何处理入口**，也看不到它为什么停住：

1. 界面只剩输入框上方两行 10px 小字（`AgentComposer.vue` 的 pending 队列 chips），内容是系统通知的原始正文，例如 `队列 <system-reminder> agent #26 返回: {"status":"completed"}`。它不显示消息来源（谁发的）、不显示队列状态（为什么没送达），也没有任何可点击的操作。
2. 「为什么在排队」的数据**前端其实已经有了**：`followUpQueue.status`（`ready` / `paused`）与 `pausedBy.reason` / `pausedBy.message` 已由会话层同步到界面（`useAgentSession.ts` 的 `applyLiveState`），但渲染队列 chips 时只取了 `.items`，状态字段被丢弃（`AgentChatSurface.vue` 的 `queuedMessages` 计算）。
3. 「谁发的」数据**服务端已经存在**：队列项内部保留 `caller`（`user` / `agent` / `system`）与 `messageIdentity`（`server/agent/messages/stored-types.ts`），但公共投影 `projectQueuedMessage` 有意不输出它们（`server/agent/events/public-queue-projection.ts`），界面因此无法区分「用户排队的消息」与「后台任务回流通知」。
4. **队列暂停后不会自愈**：把队列复位为 `ready` 的唯一入口是 `enqueueFollowUp`，它只在「会话正在运行 + 用户以 prompt/followup 模式发消息」时触发；`enqueueDurableSystemFollowUp` 遇到 `paused` 会**保持** `paused`（`server/agent/harness/neuro-agent-harness.ts`）。队列没有超时、没有重试、没有降级出口。
5. 界面没有处理队列的接口：服务端目前只有 abort 的 `clearQueue` 开关（默认清空整个队列），没有「送达单条」「忽略单条」「解除暂停」。

可观察后果：应用闪退或运行被中断后，用户重启会话，输入框上方长期挂着送不达的通知条；发消息、干活都正常，但那几条通知既送不出去也删不掉。用户唯一的绕行手段是「先发消息让会话跑起来，再按 Ctrl+Enter 排队」这条隐含路径。

## 目标与非目标

### 目标

1. **看得见**：队列条直接回答「谁发的」（用户 / 后台任务 / 系统）与「为什么没送达」（暂停原因），并说明当前会何时送达。
2. **能操作**：每条队列项可「立即送达」与「忽略」；暂停时批量操作（全部送达 / 全部忽略）集中在折叠条右上角，不展开也能完成处理。
3. **能自愈**：队列暂停后，在会话空闲时自动重试投递（有次数上限与退避）；超过上限转为「需人工处理」，由用户决定重试或忽略。
4. **不加多余东西**：默认只占一行；展开窗口限高可滚动；不引入状态弹窗、不改动与投递无关的控件。

### 非目标

- 不改变 `steer` 语义：`steer` 仍不进 follow-up 队列，仍用于运行中即时引导。
- 不重构「Workflow 待处理」面板：两者语义不同（队列 = 消息投递；Workflow = 等待回答），本次只在视觉上区分，不合并。
- 不做跨会话队列总览，不新增任务中心。
- 不改变 durable 队列的持久化结构（仍是 session custom state 中的队列真相），只扩展对外投影与操作接口。
- 不引入后台任务重跑、任务编辑等新能力。

## 当前行为与证据

### 队列消费与暂停

- 消费只发生在 `drainFollowUps`：会话有进行中的 invocation 时直接返回；队首已写入会话则 ack；`queue.status === "paused"` 时直接返回；admission 失败则调用 `pauseFollowUpAdmission`（`server/agent/harness/neuro-agent-harness.ts`）。
- drain 的触发点：入队、invocation 以 `completed` 收尾、压缩收尾、进程启动恢复 `recoverDurableFollowUps`。
- 暂停来源：用户中止 / 运行出错 / 进程中断（`pauseFollowUps`）与投递 admission 失败（`pauseFollowUpAdmission`）。abort 默认清空队列（`abortInvocationMatching` 的 `clearQueue ?? true`）。
- 恢复入口只有 `enqueueFollowUp`（写 `status: "ready"`），其余路径遇到 `paused` 均保持暂停。

### 对外数据

- 公共队列项 DTO：`id` / `clientMessageId` / `kind` / `text` / `images` / `omittedImages` / `input` / `createdAt`（`shared/dto/agent-session.dto.ts`）。**没有来源字段**。
- 公共队列状态 DTO 已有 `status: "ready" | "paused"` 与 `pausedBy: {invocationId, itemId?, reason, message?}`，`reason` 取值为 `error` / `aborted` / `interrupted` / `admission_error`。
- 内部队列项保留 `caller`（`user` / `agent` / `system`，可带 `sessionId` / `profileKey` / `toolCallId`）与 `messageIdentity`；投影函数明确不输出它们。

### 界面

- 队列 chips 的渲染位置、数据来源与 i18n 文案键已定位（`AgentComposer.vue` 的 pending 队列块；`AgentChatSurface.vue` 的 `queuedMessages`；`agent.composer.queue`）。
- `AgentWorkflowPendingPanel` 渲染的是 `kind === "workflow" && status === "waiting"` 的作业，与队列无关。

## 方案、备选方案和取舍

### 主方案：折叠条 + 按需展开 + 单条操作 + 空闲自愈

界面（详见原型 `queue-stuck-redesign.html`）：

1. 默认折叠成一行。正常排队时是低调的灰条（「N 条将在本轮结束后送达」）；暂停时是琥珀条（「队列已暂停 · N 条消息没有送达」+ 一行原因）。批量操作（全部忽略 / 全部送达）与「详情·收起」都在这一行右上角。
2. 展开后是按时间排序的条目列表：每条左侧是来源徽标（你 / 后台任务）与人话标题，右侧是时间、「原文」（带小箭头，展开显示系统通知原始正文）与操作按钮。窗口限高可拖拽，超出内部滚动。
3. 暂停后会话空闲时自动重试投递（退避 + 上限）；超过上限转为「需人工」，横幅给出原因并保留手动重试入口。

数据与接口：

1. 在公共队列项投影中新增来源字段，取值由 `caller`.kind 白名单映射（`user` → 用户；`agent` / `system` → 后台任务），不输出 `profileKey`、`toolCallId` 等内部信息；缺失 `caller` 的旧队列项按「未知来源」兼容。
2. 新增三个队列操作接口：送达单条、忽略单条、解除暂停（批量送达复用解除暂停；批量忽略复用清空语义）。
3. 队列项的人话标题由投递方生成：后台任务终态投递正文改为结构化标题（如「[后台任务完成] 任务标题」），而不是只给 `{"status":"completed"}` 这类机器状态。

### 备选方案

- **A. 取消队列概念**，系统通知直接写入会话，不再等空闲。取舍：会打断正在进行的运行、污染对话时序，也让「后台任务回流」与「用户消息」无法区分。放弃。
- **B. 只在暂停时弹一个全局对话框**处理积压。取舍：打断当前操作、无法逐条处理、与「默认不占空间」冲突。放弃。
- **C. 只做自愈，不改界面**。取舍：自愈失败时用户仍然没有任何出口，且看不到为什么失败。放弃。
- **D. 把队列与 Workflow 待处理合并为一个「待处理区」**。取舍：两者输入、副作用与失败语义不同，合并会掩盖差异；本次不做，保留为后续独立提案。

### 取舍原则

新控件必须直接服务于「送达 / 忽略 / 查看来源与原因」三件事；默认态只占一行；不新增弹窗、状态条与说明文字。任何会挤占对话区或增加常驻视觉噪音的方案都放弃。

## 数据、接口、安全、迁移、发布与回滚影响

- **数据**：durable 队列结构不变，仅扩展公共投影字段；不需要数据迁移。旧队列项（无 `caller`）按未知来源显示。
- **接口**：新增三个 session 级端点（送达单条 / 忽略单条 / 解除暂停）与两个 DTO 字段（来源、自愈状态）。均为新增，不改动既有端点语义。
- **安全**：来源字段只映射白名单枚举，不输出 `profileKey`、`toolCallId`、消息正文以外的内部标识；「忽略」是丢弃操作，批量忽略需要在界面二次确认。
- **发布**：先落地服务端投影与接口，再切换界面；界面在字段缺失时按未知来源降级，保证新旧兼容。
- **回滚**：下线新接口不影响既有队列行为；界面回退到当前 chips 只依赖旧字段。
- **风险**：自愈重试会真实触发模型调用。必须限制次数、只在本会话空闲时执行，并在超限后停止自动重试。

## 对 Spec 的预期改动

- 目标 capability：新增 `docs/specs/agent/session-followup-queue.md`（`planned`），并登记到 `docs/specs/README.md` 的功能域表；同时更新 Agent Runtime Reference 中关于队列的部分。
- 需要写清的行为：
  - **输入**：用户对单条 / 全队列发起的送达、忽略操作；会话进入空闲事件。
  - **输出**：队列状态（ready / paused + 原因）、队列项（来源、人话标题、时间、原文）、自动重试进度与超限状态。
  - **状态**：ready、paused（含原因）、自动重试中、超限需人工。
  - **副作用**：送达会写入会话消息并可能触发一次 invocation；忽略会从队列永久移除；自动重试可能产生模型调用。
  - **失败**：投递 admission 失败 → 暂停并公开有界原因；自动重试超限 → 停止重试并公开「需人工」；单条送达在会话运行中 → 置顶排到本轮结束后。
  - **验收**：暂停队列在会话空闲后能自动恢复或明确转为需人工；用户能在不展开的情况下处理整个队列；界面不显示任何未映射的内部字段。
- 实施前需要开发者确认本提案的取舍，并把上述行为写入 `planned` Spec。

## 决策记录

- 2026-09-14：整理问题、现状证据与主方案（原型 `queue-stuck-redesign.html`）。
- 2026-09-14：开发者确认按主方案落地（设计原则：简洁、易懂、不加多余控件），状态改为 `accepted`。三项取舍按主方案定案：
  1. 运行中「立即送达」= 置顶排到本轮结束后，不打断当前 invocation；
  2. 自动重试最多 3 次、间隔逐步拉长，超限转为「需人工处理」并保留手动重试；
  3. 「Workflow 待处理」与队列本次不合并，保留为后续独立提案。
- 2026-09-14：开发者实测发现缺陷——「送达」后 AI 开始运行，此时点右下角「停止」会让**整个队列被清空**（`abortInvocationMatching` 的 `clearQueue ?? true`），队列条目与尚未投递的通知一起消失，界面上只剩一个思考中指示。决策：
  1. 界面「停止」改为 `clearQueue: false`，队列进入暂停并**保留全部条目**，由用户在队列条上处理。
  2. **用户主动停止造成的暂停不参与自动重试**：否则会话刚空闲就会把下一条送进运行，「停止」等于失效；该暂停只能由用户显式操作（送达 / 全部送达 / 重新排队）恢复。
  3. 运行中提交的「送达」只是置顶排队，按钮文案由「已送达」改为「等待送达」，避免与真正送达混淆。
- 对应 `planned` Spec：[`agent/session-followup-queue.md`](../../../docs/specs/agent/session-followup-queue.md)。
