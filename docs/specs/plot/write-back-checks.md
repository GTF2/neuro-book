---
schema: nbook.spec/v1
kind: behavior
status: implemented
capability: plot.write-back-checks
owners:
  - plot
---

# 写回校验注册表（Write-back Checks）

把"写完正文 / 写完 canon 之后要核对什么、失败怎么办"收敛成**一份声明式清单**：每项登记校验名、标的、判据、失败动作与消费方。清单是消费方（`reviewChecklistMarkdown`、三维评审、`consistency-audit`、未来影响分析、canon 回读）的**单一索引入口**——校验项只在这里定义一次，别处引用它的项名，不再各自另述判据。

## 目标与非目标

目标：

- 提供一份清单，能一屏回答"当前这条流程核对哪几项、每项判据是什么、失败是必须改还是仅提示"。
- 每个校验项登记五要素：`name` / `target` / `criterion` / `failureAction`（`block` / `warn` / `record`）/ `consumer`。
- 消费方引用清单项名，不重复定义判据；新增一类校验只改清单与对应消费方引用。
- 第一版以运行期 Reference 正文承载（文档级），不引入运行时引擎、不新增实体或字段。

非目标：

- 不引入 StoryForge 的 `FIELD_REGISTRY` / `AdoptionSchema` 运行时机制（只要"声明的形状"）。
- 不自动执行校验、不自动修复。
- 不改 writer 的动笔前上下文（校验项只进评审 / 核对侧）。
- 第一版不改 `chapter-write-review-revise` 的 workflow 语义，不改 `reviewChecklistMarkdown` 的段落结构。
- 不做 UI。

## 术语与参与者

| 术语 | 含义 |
|---|---|
| 写回校验项（check） | 一条"写完要核对什么"的声明 |
| 标的（target） | 校验对象：正文 / canon（World Engine）/ Plot 实体 / lorebook |
| 判据（criterion） | 判定通过与否的条件，须可核对 |
| 失败动作（failureAction） | `block`（必须改才能收口）/ `warn`（提示，人大致判断）/ `record`（只留痕） |
| 消费方（consumer） | 读取该项的执行方：brief 评审视图、三维评审、`consistency-audit`、未来影响分析、canon 回读 |
| 参与者 | leader（执行核对）、评审 agent（按项核对）、作者（对 `warn` 与偏差裁决） |

## 输入与前置条件

- 触发方式：清单是**文档级**的，无运行时触发；消费方在各自流程中引用它。
- 输入：无运行时输入。
- 前置状态：无。

## 输出与可观察行为

- 一份清单文档（`assets/reference/plot/write-back-checks.md`），登记全部写回校验项及其五要素。
- 消费方在各自位置给出"完整清单见该 Reference"的指向：`assets/reference/plot/writer-brief.md` 的分工表、`phases/03-chapter-loop.md` 的评审 / 收口步骤、`phases/02-canon-commit.md` 的回读步骤。
- 作者 / 评审可据清单确认"本条流程核对哪几项、每项失败怎么办"。
- 清单不改变任何既有校验项的语义：迁移时失败动作**不降级**（原 `major` 不得变成 `warn`）。

## 状态与转换

本能力不引入持久状态：清单是文档，无状态机、无并发语义。

## 副作用与数据

- 无持久化、无文件写入（除清单文档本身）、无网络、无事件、无缓存副作用。
- 清单只描述校验规则，不承载数据。

## 失败与恢复

- 无运行时失败语义。
- 清单与消费方不一致（消费方引用了不存在的项、或项名写错）时：视为缺陷，须在同一变更中同步清单与引用。
- 新增校验项时若未登记清单：视为缺陷（违反"单一索引入口"）。

## 边界与兼容

- 模块 owner：plot（清单归 plot 域的写后核对）。
- 上游接缝：`assets/reference/plot/writer-brief.md` 与两个 skill 是上游 / 产品资产，改动按 fork 接缝登记（见 `docs/standards/fork-seams.md`）；新增清单 Reference 为加法。
- 接口兼容：第一版不改 workflow 入参、不改 `reviewChecklistMarkdown` 段落结构；`get_chapter_writer_brief` 行为不变。
- 演进：清单稳定后可评估下沉为代码级注册表常量（届时另立提案）。

## 验收与 Smoke

- **Given** 一条写作流程（写章 / 拍板落库），**When** 查看写回校验清单，**Then** 能看到该流程涉及的校验项、判据与失败动作。
- **Given** 新增一类校验，**When** 只改清单并让消费方引用项名，**Then** 消费方无需重复定义判据。
- **Given** 从现有分散描述迁移到清单，**When** 比对，**Then** 原有失败动作不降级（`major` 仍对应 `block` 语义）。
- Smoke 入口：清单文档本身即入口（`assets/reference/plot/write-back-checks.md`）；结构门禁 `bun run docs:check`、`bun run governance:check`。

## 实现合同

- owner：plot。
- 公开入口：运行期 Reference `assets/reference/plot/write-back-checks.md`（清单）；消费方指向见 `writer-brief.md`、`phases/03-chapter-loop.md`、`phases/02-canon-commit.md`。
- 关键不变量：校验项只在清单定义一次；消费方引用项名不另述判据；失败动作语义不降级；清单为文档级，不引入运行时执行。
- 数据边界：不新增实体、字段、HTTP 路由或 agent 工具。
- 形态约束：文档级承载；不引入运行时注册表引擎。

## 证据

- 批准依据：[Proposal：写回校验注册表](../../../packages/neuro-book/docs/proposals/write-back-validation-registry.md)（`accepted`，2026-09-14，决策者：开发者概括授权）；来源 [外部调研第五节采纳清单 #4](../../doctrine/prior-art-2026-09-14.md)（StoryForge `FIELD_REGISTRY` / `AdoptionSchema` 形状）。
- 实现入口：[Reference：写回校验清单](../../../packages/neuro-book/assets/reference/plot/write-back-checks.md)。
- 消费方指向：[`writer-brief.md`](../../../packages/neuro-book/assets/reference/plot/writer-brief.md)、[`phases/03-chapter-loop.md`](../../../packages/neuro-book/assets/workspace/.nbook/agent/skills/novel-writing/phases/03-chapter-loop.md)、[`phases/02-canon-commit.md`](../../../packages/neuro-book/assets/workspace/.nbook/agent/skills/novel-writing/phases/02-canon-commit.md)。
- 实现 provenance：[Work w00019](../../../.agents/works/w00019-write-back-checks/README.md)。
- 关联合同：[Plot Writer Brief 双视图](chapter-writer-brief.md)、[Plot 关键帧写作](keyframe.md)、[Plot 未来影响分析](future-impact-analysis.md)、[canon 回读验证](canon-read-back.md)。
