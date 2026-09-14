---
schema: nbook.spec/v1
kind: behavior
status: implemented
capability: plot.keyframe
owners:
  - plot
---

# 关键帧写作（Keyframe）

关键帧把"人只写不可逆的状态变化、帧间正文交给模型补间"（写作宪法第三条）落成可查询、可回撞、可裁决留痕的产品能力：帧在故事时间轴上有唯一时刻锚点，帧与帧之间构成补间区间；补间正文由 writer 演化，撞出的冲突由作者裁决，推翻设定必须挂创作决策记录（宪法第六条）。

## 目标与非目标

目标：

- 作者或 leader 可以声明一个帧：人读标题、故事时刻、以及该帧**不可逆地改变了什么**（谁死、什么易主、哪条誓破了、什么东西从此不能再用）。
- 可以按故事时间读到全部帧，也可以读到任意一对帧之间的补间区间（区间里的帧是补间演化的路标）。
- 回撞结论与裁决结果可以落库：未发现冲突置 `confirmed`，发现冲突置 `violated`；作者裁决维持帧回到 `confirmed`，推翻帧置 `overthrown` 并挂创作决策记录。
- agent 面（leader / writer / 评审）能读帧与补间区间、能声明与更新帧，且 writer 拿到的帧内容只含事实字段。

非目标：

- 不规定补间正文的写作质量；帧驱动写得好不好由作者判定（见写作宪法否决权条款第 2 条）。
- 不做帧的自动创建或自动裁决：`derived` 帧必须由人或 agent 显式声明，裁决必须由作者发起。
- 不提供删除帧的产品动作：推翻已有帧必须留痕，删除只作为作者在界面 / HTTP 层的人工维护手段。
- 不改变 Scene、World Engine 或 ChapterBrief 的数据模型与职责。

## 术语与参与者

| 术语 | 含义 |
|---|---|
| 关键帧（keyframe） | 故事时间轴上的一个锚点，声明该时刻发生的不可逆状态变化 |
| `instant` | 帧锚定的 World Engine 时刻（非负整数字符串，与 Scene `worldAnchor` 同形） |
| `irreversibleChanges` | 声明式事实列表；补间回撞校验的标的，不是写作指令 |
| `source` | `author`（人声明）或 `derived`（从正文反推，宪法第六条） |
| `status` | `pending` / `confirmed` / `violated` / `overthrown` |
| `decisionRefId` | 指向推翻该帧的创作决策记录；`overthrown` 时必填 |
| 补间区间 | 一对帧之间 `(起点帧 instant, 终点帧 instant]` 的时间窗 |
| 回撞校验 | 用 `irreversibleChanges` 逐条核对补间正文的事实装置 |
| 裁决 | 回撞发现冲突后，作者选择维持帧（改正文）或推翻帧（留痕） |
| 参与者 | 作者（声明的最终来源）、leader（读写帧、组织补间）、writer（读帧事实写补间正文）、评审（消费回撞结论） |

## 输入与前置条件

- HTTP 入口：`GET /keyframes`（列表）、`POST /keyframes`（创建）、`GET /keyframes/tween?fromKeyframeId&toKeyframeId`（补间区间）、`GET|PATCH|DELETE /keyframes/:id`（单帧读写与作者维护）。
- Agent 工具入口：`get_story_keyframe`（列表 / 单帧）、`get_tween_keyframes`（补间区间）、`save_story_keyframe`（`action=create|update`）。
- 前置状态：Story 已存在（缺失时按既有规则惰性建立）；目标帧属于当前 Story；`sceneId` 非空时必须是同一 Story 的场景；`name` 在同一 Story 内唯一。
- 创建必填 `name`、`title`、`instant`、`irreversibleChanges`；`source` 缺省 `author`。
- 权限：读入口无副作用；写入口（`POST` / `PATCH` / `DELETE`、`save_story_keyframe`）标记为工作区写入，在只读模式下由既有写审批机制管辖。

## 输出与可观察行为

- 帧列表按 `instant` 升序返回，同 `instant` 时按 id 升序。
- 单帧返回值包含 `id`、`storyId`、`sceneId`、`name`、`title`、`instant`（字符串）、`irreversibleChanges`、`source`、`status`、`decisionRefId`、`note`、`createdAt`、`updatedAt`。
- 补间区间查询返回 `(起点帧 instant, 终点帧 instant]` 内的帧，起点帧本身不在结果内，终点帧在结果内；结果同样按 `instant` 升序。
- Agent 写工具的 action 语义：`create` 不接受 `keyframeId`、`status`、`decisionRefId`；`update` 不接受 `source`；`create` 恒为 `pending`。
- `writer` profile 调用读工具时，返回的帧不含 `note`（自由文本不保证是事实）；leader 与评审拿到完整字段。帧的其余字段是事实声明与元数据，writer 可读。

## 状态与转换

| 起始状态 | 事件 | 目标状态 | 拒绝条件 |
|---|---|---|---|
| （无） | 创建帧 | `pending` | 缺少必填字段、`name` 与同 Story 已有帧重复、`sceneId` 不属于该 Story |
| `pending` | 回撞未发现冲突 | `confirmed` | — |
| `pending` | 回撞发现冲突 | `violated` | — |
| `violated` | 作者裁决维持帧 | `confirmed` | — |
| `violated` / `pending` | 作者裁决推翻帧 | `overthrown` | 未提供 `decisionRefId` |
| 任意非 `pending` | 试图改回 `pending` | — | 请求失败（回撞流转单向） |

- 创建是唯一产生 `pending` 的路径；`confirmed` / `violated` / `overthrown` 由回撞与裁决产生。
- 更新是整字段替换语义：传入即替换（列表字段整体替换），未传字段保持不变，显式传 `null` 表示清空可空字段。
- 并发语义：帧写入串行经过 Project 的 Plot 写入边界，不提供乐观锁；同时修改同一帧时以最后一次成功写入为准。

## 副作用与数据

- 写帧会持久化到 Project SQLite 的 `StoryKeyframe` 表（owner：plot 模块），并级联受 Story 删除影响；`sceneId` 指向的场景被删时该帧保留并失去场景锚定。
- `decisionRefId` 指向创作决策记录；该决策被删时帧保留、留痕链接置空。
- 无网络、无事件总线、无缓存失效动作、无文件系统副作用。
- 补间区间查询是纯读，不产生持久状态。

## 失败与恢复

- `instant` 不是非负整数字符串：请求被拒绝，不写入。
- 补间区间终点帧的 `instant` 不晚于起点帧：请求被拒绝。
- `name` 与同 Story 已有帧重复：请求被拒绝，不覆盖已有帧。
- 目标帧不存在或不属于当前 Story：按不存在处理，不跨 Story 读取。
- `status=overthrown` 且无 `decisionRefId`（且帧上原本也没有）：请求被拒绝——推翻必须留痕。
- 无自动重试、无部分回滚；单次请求要么完整生效要么不生效。回撞 workflow 的结论不自动写入帧，由调用方显式提交，因此 workflow 失败不会留下半写状态。

## 边界与兼容

- 模块 owner：plot（数据面与服务面）、agent tools 投影（`server/agent/tools`）。
- 上游接缝：帧实体与 DTO、仓储、HTTP 路由、实体 ID 标签属 fork 接缝（见 `docs/standards/fork-seams.md` S2–S7）；agent 工具面为加法式新增，不改上游既有工具签名。
- 权限边界：writer 只读帧事实，写帧只在 leader / 作者通道；`note` 不对 writer 开放。
- 字段兼容：帧 DTO 为既有字段的加法扩展；新增 agent 工具是纯新增，不改变既有工具的行为与参数。
- 无数据库迁移：表与索引在既有项目初始化路径中已存在。

## 验收与 Smoke

- **Given** 一个已有 Story，**When** 声明两个 `instant` 递增的帧，**Then** 列表按时间升序返回两帧，且两帧初始 `status` 都是 `pending`。
- **Given** 两个已声明帧，**When** 查询补间区间，**Then** 返回结果不含起点帧、含终点帧，且都在 `(起点, 终点]` 内。
- **Given** 一个 `pending` 帧，**When** 提交回撞结论 `confirmed`，**Then** 帧状态变为 `confirmed`。
- **Given** 一个 `confirmed` / `violated` 帧，**When** 尝试改回 `pending`，**Then** 请求被拒绝。
- **Given** 一个需要推翻的帧，**When** 只提交 `status=overthrown`，**Then** 请求被拒绝；补上 `decisionRefId` 后成功，且帧上可读到该留痕。
- **Given** `writer` profile，**When** 读帧，**Then** 返回值不含 `note`；**Given** leader profile 读同一帧，**Then** 含 `note`。
- Smoke 入口：`server/plot/services/keyframe.service.test.ts`、`server/api/projects/plot/[...segments].test.ts`、`server/agent/tools/plot-tools.test.ts`、`server/agent/workflow/keyframe-tween-review.workflow.test.ts`。

## 实现合同

- owner：plot 模块持有 `StoryKeyframe` 数据与服务（`server/plot/**`），agent 工具面由 `server/agent/tools/plot-tools.ts` 投影。
- 公开接口：HTTP `keyframes` 路由族；agent 工具 `get_story_keyframe` / `get_tween_keyframes` / `save_story_keyframe`。
- 关键不变量：创建恒 `pending`；状态不可回退到 `pending`；`overthrown` 必须有 `decisionRefId`（且该决策必须属于同一 Story）；补间区间必须满足 `起点 instant < 终点 instant`；`name` 同 Story 唯一；帧只在本 Story 范围内可读。
- 数据边界：写入经 Plot 仓储层（JSON 列 `irreversibleChanges` 在仓储边界归一化）；agent 工具不直接访问数据库。
- writer 视角收口：读工具的返回对 `writer` profile 走白名单（剔除 `note`），与 brief 工具的收口策略一致，避免自由文本进入 writer 的动笔前上下文。
- 测试入口：`keyframe.service.test.ts`（状态不变式与失败语义）、`[...segments].test.ts`（HTTP 合同）、`plot-tools.test.ts`（工具 action 语义、补间区间传参、writer 收口）、`keyframe-tween-review.workflow.test.ts`（补间 workflow 的 writer 输入只含事实）。

## 证据

- 批准依据：[写作宪法](../../doctrine/writing-doctrine.md) 第三条（人定帧、模型补间）与第六条（推翻留痕）；实测记录 [关键帧补间实验](../../doctrine/keyframe-experiment-2026-09-14.md)（第三条首次实测通过）；此前登记在规范缺口表的 P0 条目，本轮补齐。
- 实现入口：[`keyframe.service.ts`](../../../packages/neuro-book/server/plot/services/keyframe.service.ts)、[`plot-tools.ts`](../../../packages/neuro-book/server/agent/tools/plot-tools.ts)、[Plot HTTP 路由](../../../packages/neuro-book/server/api/projects/plot/)、[Reference：关键帧](../../../packages/neuro-book/assets/reference/plot/keyframe.md)。
- 验证：[`keyframe.service.test.ts`](../../../packages/neuro-book/server/plot/services/keyframe.service.test.ts)、[`plot-tools.test.ts`](../../../packages/neuro-book/server/agent/tools/plot-tools.test.ts)、[`keyframe-tween-review.workflow.test.ts`](../../../packages/neuro-book/server/agent/workflow/keyframe-tween-review.workflow.test.ts)。
- 主链接入：[`phases/03-chapter-loop.md`](../../../packages/neuro-book/assets/workspace/.nbook/agent/skills/novel-writing/phases/03-chapter-loop.md) 与 [`phases/05-keyframe-tween.md`](../../../packages/neuro-book/assets/workspace/.nbook/agent/skills/novel-writing/phases/05-keyframe-tween.md)。
- 实现 provenance：[Work w00015](../../../.agents/works/w00015-keyframe-agent-toolface/README.md)。
