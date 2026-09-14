---
schema: nbook.spec/v1
kind: behavior
status: implemented
capability: plot.canon-read-back
owners:
  - plot
---

# canon 回读验证与验收回执（Canon Read-back）

拍板落库把确认过的剧情事实写进三个真相源（World Engine / Plot / lorebook）；本能力要求写完**立刻回读**刚写入的那部分，与确认过的事实清单逐条比对，产出一份**验收回执**（`已落地` / `偏离` / `未落地` + 证据 + 建议动作）。只核对、不自动修复。

## 目标与非目标

目标：

- canon 写入之后，回读刚写入的 slice/patch、Plot 实体与 lorebook 节点，与已确认的事实逐条比对。
- 产出结构化回执：每条 = 意图事实 + 回读结果 + 证据 + 建议动作。
- 让三类偏差可见：**写了但没生效**、**写成了另一件事**、**该写的没写**。
- 复用既有只读工具，不新增实体、字段或工具。

非目标：

- 不自动修复（重写 slice / 回滚 patch / 改写实体必须由人决定）。
- 不引入不可变世界版本 / 快照隔离（我们的 World Engine 支持补写过去，不需要版本冻结）。
- 不替代事后校验（正文 vs 声明）：本能力校验的是**写入 vs 确认意图**，发生在正文之前。
- 不改 writer 的动笔前上下文。

## 术语与参与者

| 术语 | 含义 |
|---|---|
| canon | 已被作者确认、写入真相源的剧情事实 |
| 真实源 | World Engine（时间线/状态）、Plot（Thread/Scene/Promise/Decision/帧）、lorebook（稳定设定） |
| 回读（read-back） | 写入后重新读取刚写入的那部分数据 |
| 验收回执（receipt） | 结构化清单：`intent` / `readBack` / `status` / `evidence` / `suggestedAction` |
| 回读结果 | `landed`（已落地）、`deviated`（偏离）、`missing`（未落地） |
| 参与者 | leader（执行写入与回读、整理回执）、作者（裁决偏差） |

## 输入与前置条件

- 触发方式：拍板落库的写入步骤之后立即执行（写入与回读之间不插入其它写入）。
- 输入：本批已确认的事实清单（写入前的意图）；本批写入涉及的 slice/patch、Plot 实体、lorebook 节点。
- 前置状态：本批写入已提交（尚未开始写入其它批次）。
- 权限：回读全部为只读。

## 输出与可观察行为

- 一份结构化验收回执：数组，每条含 `intent`、`readBack`、`status`（`landed`/`deviated`/`missing`）、`evidence`、`suggestedAction`。
- 一份人读 markdown 回执：按真实源分组（World Engine / Plot / lorebook），列出偏差与漏写。
- 回执可交给作者逐条处理；处理动作（重写 / 修正 / 保持）走既有写入路径，不由本能力执行。
- 全部为 `landed` 时给出明确的"全部落地"结论；不得用空回执冒充"已核对"。

## 状态与转换

本能力不引入持久状态：回执是运行期产物，可重复生成。

| 起始状态 | 事件 | 目标状态 | 拒绝条件 |
|---|---|---|---|
| 本批 canon 已写入 | 触发回读 | 返回回执（可能全部 `landed`） | 回读查询失败时 fail-closed（见失败与恢复） |
| 某条回读结果 `deviated`/`missing` | 作者裁决 | 修正（重写/补写）或保持 | — |

## 副作用与数据

- 无写入、无持久化、无文件、无网络、无事件、无缓存副作用：纯只读回读 + 归纳。
- 回执若需留存，按现有会话记录方式处理，不属于本能力合同。
- 数据 owner 不变（plot 与 world-engine 各自持有其数据）。

## 失败与恢复

- 回读查询失败：**fail-closed** —— 显式标注"该源未完成回读"，不产出"看起来干净"的回执（不把"没读到"说成"已核对"）。
- 部分源回读成功、部分失败：整份回执标注失败源为"未完成"，要求重跑。
- 无自动重试、无回滚（无写入，无需回滚）。

## 边界与兼容

- 模块 owner：plot（本 Spec **不 owner World Engine 数据**，只约定 canon 提交后的回读行为）。
- 上游接缝：`phases/02-canon-commit.md`、`phases/03-chapter-loop.md` 是上游产品 Skill 资产，改动按 fork 接缝登记（见 `docs/standards/fork-seams.md`）；新增 Reference 正文为加法。
- 权限边界：只读；不引入新写入口，不改既有工具签名。
- 字段兼容：不新增 DTO 字段、不改 HTTP 路由。
- 形态约束：不由 workflow 承载（workflow 内 `adhoc` 工具面固定 `read` + `report_result`，读不到 Plot / World Engine 数据），由持有 `execute_world` 与 plot 工具的 leader 执行。

## 验收与 Smoke

- **Given** 一组已确认事实，**When** 写完并回读，**Then** 回执逐条给出 `已落地`/`偏离`/`未落地` 与证据。
- **Given** 一条 patch 落在错误 path，**When** 回读，**Then** 回执标 `deviated` 并给出实际落点。
- **Given** 一条事实在拆事件时被漏写，**When** 回读，**Then** 回执标 `missing`。
- **Given** 任意一次回读，**When** 结束，**Then** 断言未修改任何数据（slice / 实体 / lorebook 内容不变）。
- **Given** 回读查询失败，**When** 执行，**Then** 回执标注该源"未完成回读"，不报告"已核对"。
- Smoke 入口：本能力为资产层行为，主链入口见 `assets/workspace/.nbook/agent/skills/novel-writing/phases/02-canon-commit.md`（回读验证步骤）与运行期 Reference `assets/reference/world-engine/canon-read-back.md`；结构门禁 `bun run docs:check`、`bun run governance:check`。

## 实现合同

- owner：plot（本 Spec 约定 canon 提交后的回读行为；World Engine 数据 owner 不变）。
- 主链入口：`assets/workspace/.nbook/agent/skills/novel-writing/phases/02-canon-commit.md` 的「回读验证」步骤；运行期合同正文 `assets/reference/world-engine/canon-read-back.md`。
- 关键不变量：只读回读（不调用任何写工具）；写入与回读之间不插入其它写入；三类偏差必须可区分；任一源查询失败时 fail-closed 标注"未完成回读"；回执不落库，修正由人发起。
- 数据边界：复用既有只读入口 `execute_world`（`world.slice.get` / `world.slice.list`）、`get_story_chapter` / `get_story_scene_context` / `get_story_promise` / `get_story_keyframe`、lorebook 节点读取；不新增实体、字段、路由或工具。
- 形态约束：不由 workflow 承载（`adhoc` 工具面读不到 Plot / World Engine 数据）。

## 证据

- 批准依据：[Proposal：回读验证与验收回执](../../../packages/neuro-book/docs/proposals/read-back-verification.md)（`accepted`，2026-09-14，决策者：开发者概括授权）；来源 [外部调研第五节采纳清单 #3](../../doctrine/prior-art-2026-09-14.md)（StoryForge adopt 四段式）。
- 形态约束依据：[Agent Workflow Reference](../../../packages/neuro-book/assets/reference/agent/workflow/README.md)（adhoc 工具固定为 `read` + `report_result`）。
- 实现入口：[Reference：canon 回读](../../../packages/neuro-book/assets/reference/world-engine/canon-read-back.md)、[`phases/02-canon-commit.md`](../../../packages/neuro-book/assets/workspace/.nbook/agent/skills/novel-writing/phases/02-canon-commit.md)。
- 实现 provenance：[Work w00018](../../../.agents/works/w00018-canon-read-back/README.md)。
- 关联合同：[Plot 关键帧写作](keyframe.md)、[Plot 未来影响分析](future-impact-analysis.md)。
