---
schema: nbook.spec/v1
kind: behavior
status: planned
capability: agent.workflow-data-queries
owners:
  - agent-runtime
  - plot
---

# Workflow 版本化只读数据查询

## 目标与非目标

**目标**：让 workflow 脚本能通过**版本化只读查询**确定性读取项目数据，并把结果记进 journal（重放返回原值，不重复读库）。首期只服务一个已证实的消费者——`chapter-write-review-revise` 在 `infoControl` 缺省时按 `chapterId` 自动编译信息控制事后核对清单，使"漏传清单"从**看得见**变成**不再发生**。

**非目标**：

- 不提供任何**可写** action：本能力只读，不写数据库、不写文件、不产生外部副作用。
- 不向脚本暴露任意 SQL、文件路径、shell 或模型调用；脚本只能传类型化参数。
- 不改变 `wf.workspace.read`（文件只读）与 agent 工具面、HTTP 路由。
- 不改变 `chapter-write-review-revise` 的 `infoControl` 显式入参含义：显式传入始终优先于自动编译。
- 不实现 completion / headless / 可写 activity（属已接受提案 `agent-model-execution-surfaces.md` 的其它 capability）。
- 不承诺 exactly-once（只读，重复执行无副作用，故允许重试）。

## 术语与参与者

| 术语 | 含义 |
|---|---|
| 查询引用 | 带显式版本后缀的稳定标识，形如 `plot.chapter-info-control@1`。脚本只能引用已注册的引用，不能自造 |
| 宿主执行器 | workflow 宿主在装配 `WorkflowRunner` 时注入的 `ActivityExecutor`；本能力只使用其 `query` 面 |
| 能力缺席 | 宿主未注入执行器，或执行器未注册被引用的查询。内核以稳定错误名表达（`ActivityExecutorNotConfiguredError` / `ActivityDefinitionNotFoundError`） |
| 显形路径 | Work `w00016` 引入的既有行为：清单缺失时一致性评审收到显式「信息边界未核对」标注、运行日志记警告、返回值标记未核对 |
| 自动编译 | 脚本按 `chapterId` 调用查询，把返回的四字段编成核对清单 |
| 参与者 | workflow 脚本（调用方）、workflow 宿主（装配执行器与查询实现）、Plot 模块（数据 owner）、一致性评审（清单消费者） |

## 输入与前置条件

- 触发方式：workflow 脚本调用 `wf.query(查询引用, 输入, 选项?)`。本能力首期只注册一个引用：
  - **引用**：`plot.chapter-info-control@1`。
  - **输入**：`{chapterId: number}`（StoryChapter 数字 id，必须为正整数）。
  - **选项**：沿用内核 `ActivityCallOptions`（`key` / `timeoutMs` / `metadata`），本能力不定义新选项。
- 前置：当前 run 绑定到已打开的 Project（run 的宿主上下文持有已 ready 的 Project 作用域）；目标章节属于该 Project 的 Story。
- 权限：只读。查询实现复用既有 Project 作用域守卫；不得接受脚本传入的 Project 路径、SQL 或文件路径。
- 输入约束：`chapterId` 必须是正整数；非正整数或不合法输入在脚本侧即视为"无法编译"，不发起查询。

## 输出与可观察行为

- 查询成功返回稳定结构：`{chapterId, readerKnows, protagonistKnows, mustHide, hintOnly}`，四个字段为 `string | null`，原样映射自章节的真实数据（不做二次解释、不做拼接）。
- 成功结果进入 journal：参数指纹与结果被记录；同一 run 重放命中 journal 时返回原结果，**不再次调用宿主查询实现**。
- 消费者可观察行为（`chapter-write-review-revise`）：
  - `infoControl` 显式传入 → `infoControlSource=provided`，一致性评审收到清单原文；不发起查询。
  - `infoControl` 缺省且查询成功、四字段至少一项非空 → `infoControlSource=auto`、`infoControlChecked=true`，一致性评审收到自动编译的清单原文。
  - `infoControl` 缺省且查询成功、四字段全空 → `infoControlSource=auto`、`infoControlChecked=true`，一致性评审收到显式说明「本章未声明信息控制」（与"未核对"区分开）。
  - `infoControl` 缺省且**能力缺席** → `infoControlSource=missing`、`infoControlChecked=false`，退回显形路径，run 正常完成。
- 无论来源为何，清单**绝不**进入 writer 的动笔前上下文（写作宪法第二条、第五条）。

## 状态与转换

本能力不引入持久状态；journal 中的查询记录属既有 run 记录的一部分。

| 起始 | 事件 | 结果状态 | 说明 |
|---|---|---|---|
| 有 `infoControl` 入参 | 运行评审 | `provided` | 不查询 |
| 无 `infoControl`、能力可用、章节可读 | 运行评审 | `auto` | 查询结果进 journal |
| 无 `infoControl`、能力可用、四字段全空 | 运行评审 | `auto`（清单为空但已核对） | 与"未核对"显式区分 |
| 无 `infoControl`、能力缺席 | 运行评审 | `missing` | 退回显形，run 可完成 |
| 无 `infoControl`、查询抛错 | 运行评审 | run 失败 | fail-closed，不产出"未核对但不报错" |
| 同一 run 重放 | 命中 journal | 不变 | 返回原结果，不重新查询 |

- 幂等：查询只读、无副作用；同一参数在 journal 命中时返回同一结果。并发查询只读，无竞争语义。
- 拒绝：非法 `chapterId`（非正整数）在脚本侧不发起查询，直接判为无法编译。

## 副作用与数据

- **无副作用**：不写数据库、不写文件、不发事件、不改 `plot.selection`、不改任何 Plot 实体。
- 数据 owner 不变：ChapterBrief 四字段的写入仍由既有 `save_*` 工具与 leader 负责；本能力只读同一份数据。
- journal：成功查询的参数与结果进入既有 run journal；这是内核既有行为的复用，不是新持久化。

## 失败与恢复

- **能力缺席**（宿主未注入执行器 / 未注册引用）：视为部署状态，脚本退回显形路径（`missing`），run 正常完成。
- **查询失败**（Project 未打开、章节不存在、不属于当前 Story、DB 错误）：fail-closed，错误上抛终止 run；绝不降级为"未提供清单"，避免把"查不到"说成"没有问题"。
- 失败查询不进入成功 journal；由于只读且无副作用，run 恢复时可安全重试。
- 无回滚需求（只读）；不承诺 exactly-once。

## 边界与兼容

- 模块所有权：查询实现归 Plot（数据 owner）；装配与注入归 agent-runtime（workflow 宿主）。
- 权限与安全：查询按 Project 作用域限定，拒绝跨 Project 与串代访问；脚本只能传类型化参数。
- 版本兼容：引用名带显式版本后缀；新增查询 = 新增引用，不改变既有引用的参数与结果形状；结果形状变更须升版本号。
- 既有合同不变：`chapter-write-review-revise` 的 `infoControl` 入参含义、`infoControlChecked` 的布尔语义（= 本轮是否真的做了信息边界核对）与 `w00016` 的显形保证全部保留；`infoControlSource` 为新增可观察字段。
- 与已接受提案的关系：复用 `agent-model-execution-surfaces.md` 的 `ActivityExecutor` 计划，只新增只读查询一类，不扩大其范围。
- 无数据迁移。

## 验收与 Smoke

- **Given** `infoControl` 缺省、宿主已装配 `plot.chapter-info-control@1` 且章节四字段已填，**When** 运行 `chapter-write-review-revise` 一轮评审，**Then** 一致性评审消息含自动编译的清单原文、返回 `infoControlSource=auto` 且 `infoControlChecked=true`，且 run 中无额外模型调用用于取数（journal 中只出现一条 `query`，其 `reference` 为该查询引用）。
- **Given** `infoControl` 缺省、宿主未装配该查询，**When** 运行，**Then** 退回显形：一致性评审含「信息边界未核对」、返回 `infoControlSource=missing`、`infoControlChecked=false`，run 正常完成。
- **Given** `infoControl` 缺省、四字段全空，**When** 运行，**Then** `infoControlSource=auto`，一致性评审收到「本章未声明信息控制」说明而非「未核对」。
- **Given** 查询抛错（章节不存在），**When** 运行，**Then** run 以失败收口，不产出"未核对但不报错"的结果。
- **Given** 同一 run 重放，**When** 命中 journal，**Then** 宿主查询实现不被再次调用，返回原结果。
- **Given** 显式传入 `infoControl`，**When** 运行，**Then** `infoControlSource=provided`，查询不被调用。
- **Given** 任一路径，**When** 检查 writer 收到的消息，**Then** 不含信息控制清单任何内容。
- 合同测试入口（实现阶段落地）：workflow 三态（auto / provided / missing）+ fail-closed 用例、宿主查询实现的结果形状与失败用例。Smoke 以无模型运行级测试为主，不要求真实 Provider。

## 实现合同

`planned`：目标合同已批准，代码**部分落地**——宿主只读查询的注册与输入/结果校验、workflow 的三态消费（`auto` / `provided` / `missing`）与 fail-closed 分支均已有合同测试。尚未闭合的两项：① 宿主执行器目前使用内核提供的进程内执行器（不提供进程重启 / 重试 / lease 保证；对只读查询可接受，因为内核 journal 才是重放的第一真相，生产级执行器边界仍归已接受提案 `agent-model-execution-surfaces.md`）；② 查询触及真实 Project 数据库的端到端路径尚无独立集成测试。当前进度与未闭合项同 `docs/specs/README.md`「规范缺口」P1 行；闭合后原地晋升 `implemented` 并在本节补齐 owner、公开接口、journal/重放边界与稳定入口。

## 证据

- 批准依据：[Proposal：Workflow 只读数据查询](../../../packages/neuro-book/docs/proposals/workflow-project-data-queries.md)（2026-09-14 `accepted`）；依赖已接受提案 [Agent 模型执行面](../../../packages/neuro-book/docs/proposals/agent-model-execution-surfaces.md)。
- 既有行为基线（本能力复用、不修改）：[`plot.chapter-writer-brief.md`](../plot/chapter-writer-brief.md)（信息控制四字段的事后核对定位）、Work `w00016-info-control-non-silent`（漏传显形）。
- 缺口来源：`docs/specs/README.md`「规范缺口」P1 行「Workflow 侧读取项目数据（infoControl 自动编译）」。
