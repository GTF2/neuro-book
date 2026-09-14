---
schema: nbook.spec/v1
kind: behavior
status: implemented
capability: plot.future-impact-analysis
owners:
  - plot
---

# 未来影响分析（Future Impact Analysis）

正文被采纳为 canon 之后，主动扫描「本轮新确认的事实 → 下游规划」的正向扩散：哪些承诺的兑现已经不可能、哪些后续 Scene 与事实冲突、哪些已声明关键帧被正文推翻、哪些承诺的期限/节奏已经落空。产出一份**只标记、不改动**的受影响清单，由作者与 leader 逐项裁决。

## 目标与非目标

目标：

- 给定一章的落点与本章新确认的事实，产出一份受影响下游清单；每条包含目标对象、影响类型、证据与建议动作。
- 三类扫描面都必须覆盖：**Promise 面**（承诺兑现与期限/节奏）、**Scene 面**（后续同线场景与相邻章场景）、**帧面**（补间区间与不可逆变化）。
- 清单只标记待处理；确认"改"的项经人裁决后走既有写入路径。

非目标：

- 不自动修改任何规划（Scene / Promise / 帧 / beat）：本能力只产出清单。
- 不替代反向核对（正文 vs 声明）：三维评审与 `consistency-audit` 仍是独立一环。
- 不引入世界版本冻结 / 派生世界。
- 不改 writer 的动笔前上下文，不新增实体、字段或 HTTP 路由。

## 术语与参与者

| 术语 | 含义 |
|---|---|
| 新事实（confirmed change） | 本章修订中被确认的、会改变世界状态的事实：结果改写、物品易主、角色位置或伤势变化、信息披露 |
| 反向核对 | 正文 vs 已声明（三维评审、`consistency-audit`） |
| 正向扩散 | 新事实 → 下游规划（本能力） |
| 受影响清单（impact list） | 结构化数组，每条 = `target` / `impactType` / `evidence` / `suggestedAction` |
| 影响类型 | `promise_unfulfillable`（兑现已不可能）、`scene_conflict`（后续场景与事实冲突）、`keyframe_overthrown`（帧被正文推翻）、`deadline_missed`（期限/节奏落空） |
| 参与者 | leader（执行扫描、整理清单）、作者（逐项裁决）、writer（不参与本能力） |

## 输入与前置条件

- 触发方式：正文循环的「修订」步骤之后、完成标准之前；由 leader 在持有 Plot 工具面的会话内执行。
- 输入：本章落点（`chapterPath` / `chapterId`）与本轮已确认的新事实集合；未产生新事实时本能力可跳过。
- 前置状态：本章正文已写入且修订收敛；本章剧情事实已确认并落入 World Engine；Plot 数据（Promise / Scene / 关键帧）可读。
- 权限：全部为只读查询；本能力本身不写入。确认"改"的项由人发起后续写入。

## 输出与可观察行为

- 一份结构化受影响清单：数组，每条含 `target`（Promise / Scene / 关键帧 / 章的身份）、`impactType`（见术语表）、`evidence`（引用正文或规划数据的可核对证据）、`suggestedAction`（改计划 / 保持 / 待裁决）。
- 一份人读 markdown 清单：按目标类型分组，每条给出目标、影响、证据、建议动作。
- 清单可逐项确认；确认结果只影响后续由人发起的写入，不由本能力落库。
- 三类扫描面各给独立分组，便于逐面核对；无受影响项的面显式给出"未发现"，不静默省略。

## 状态与转换

本能力不引入持久状态：清单是运行期产物，可重复生成；重复运行对同一输入应给出等价清单（受底层数据变化影响）。

| 起始状态 | 事件 | 目标状态 | 拒绝条件 |
|---|---|---|---|
| 本章无新事实 | 触发扫描 | 返回"无需分析" | — |
| 本章有新事实 | 触发扫描 | 返回受影响清单（可能为空） | 底层查询失败时 fail-closed（见失败与恢复） |

## 副作用与数据

- 无持久化、无文件写入、无网络、无事件、无缓存副作用：本能力是纯读 + 归纳。
- 清单若需留存，由 leader 按现有会话记录方式处理，不属于本能力的持久合同。
- 底层数据 owner 不变（plot 模块持有 Promise / Scene / 关键帧）。

## 失败与恢复

- 任一只读扫描失败：**fail-closed** —— 明确报告"该面未完成核对"，不产出"看起来干净"的空清单（不把"没查到"说成"没有问题"）。
- 部分面成功、部分面失败：清单标注失败面为"未完成"，并要求重跑，不静默降级。
- 无自动重试、无回滚（无写入，无需回滚）。

## 边界与兼容

- 模块 owner：plot（数据面）；执行面在 leader 会话内，属 agent 资产层。
- 上游接缝：`phases/03-chapter-loop.md` 是上游共享资产，本能力对它的改动按 fork 接缝登记（见 `docs/standards/fork-seams.md`）；新增 Reference 正文为加法。
- 权限边界：只读；不引入新写入口，不改既有工具签名。
- 字段兼容：不新增 DTO 字段、不改 HTTP 路由。
- 与 `workflow-project-data-queries` 的关系：workflow 内 `adhoc` 工具面固定为 `read` + `report_result`，读不到 Plot 数据，因此本能力不由 workflow 承载；当 workflow 数据查询能力落地后，可另立 workflow 编排作为可选演进。

## 验收与 Smoke

- **Given** 一章修订把某角色写成"受伤无法赴约"，**When** 执行未来影响分析，**Then** 清单含一条 `target` 指向涉及该角色赴约的 Promise、`impactType=promise_unfulfillable`、带正文证据。
- **Given** 新事实使后续 Scene 描述不可能，**When** 执行分析，**Then** 清单含 `scene_conflict` 条目并给出涉及的后续 Scene。
- **Given** 正文推翻了一个已声明关键帧的不可逆变化，**When** 执行分析，**Then** 清单含 `keyframe_overthrown` 条目，提示后续需按宪法第六条走推翻留痕。
- **Given** 本章无新事实，**When** 执行分析，**Then** 返回"无需分析"而非空清单。
- **Given** 某面只读查询失败，**When** 执行分析，**Then** 结果标注该面"未完成核对"，不报告"未发现"。
- **Given** 任意一次分析，**When** 结束，**Then** 断言未修改任何规划数据（Promise / Scene / 关键帧数量与内容不变）。
- Smoke 入口：本能力为资产层行为，主链入口见 `assets/workspace/.nbook/agent/skills/novel-writing/phases/03-chapter-loop.md`（未来影响分析步骤）；结构门禁 `bun run docs:check`、`bun run governance:check`。

## 实现合同

- owner：plot 模块持有 Promise / Scene / 关键帧数据；本能力是 leader 会话内的资产层行为，无新增代码模块。
- 主链入口：`assets/workspace/.nbook/agent/skills/novel-writing/phases/03-chapter-loop.md` 的「第六步：未来影响分析」；运行期合同正文 `assets/reference/plot/future-impact-analysis.md`。
- 关键不变量：只读扫描（不调用任何写工具）；三类扫描面（Promise / Scene / 帧）必须各自给结论；无新事实时返回"无需分析"而非空清单；任一查询失败时 fail-closed 标注"未完成核对"；清单不落库，裁决后的写入由人发起。
- 数据边界：复用既有只读工具 `get_story_promise` / `get_story_thread` / `get_story_scene_context` / `get_story_keyframe` / `get_tween_keyframes`；不新增实体、字段、HTTP 路由或 agent 工具。
- 形态约束：不由 workflow 承载（workflow 内 `adhoc` 工具面固定 `read` + `report_result`，读不到 Plot 数据）。

## 证据

- 批准依据：[Proposal：未来影响分析](../../../packages/neuro-book/docs/proposals/future-impact-analysis.md)（`accepted`，2026-09-14，决策者：开发者概括授权）；来源 [外部调研第五节采纳清单 #2](../../doctrine/prior-art-2026-09-14.md)（StoryForge 章后整理 → 未来影响分析）。
- 形态约束依据：[Agent Workflow Reference](../../../packages/neuro-book/assets/reference/agent/workflow/README.md)（adhoc 工具固定为 `read` + `report_result`，workflow 读不到 Plot 数据）。
- 实现入口：[Reference：未来影响分析](../../../packages/neuro-book/assets/reference/plot/future-impact-analysis.md)、[`phases/03-chapter-loop.md`](../../../packages/neuro-book/assets/workspace/.nbook/agent/skills/novel-writing/phases/03-chapter-loop.md)（第六步）。
- 实现 provenance：[Work w00017](../../../.agents/works/w00017-future-impact-analysis/README.md)。
- 关联合同：[Plot 关键帧写作](keyframe.md)、[Plot Writer Brief 双视图](chapter-writer-brief.md)。
