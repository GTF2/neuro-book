---
schema: nbook.spec/v1
kind: behavior
status: implemented
capability: plot.chapter-writer-brief
owners:
  - plot
---

# Chapter Writer Brief 事实/意义双视图

## 目标与非目标

**目标**：`get_chapter_writer_brief` 编译出的交付物分成两个互不重叠的视图，分别服务"动笔"与"事后校验"两件事：

- **writer 视图（事实切片）**：唯一进入 writer 动笔前上下文的文本，只含事实级细节——章节身份、每个 Scene 的时间/地点/在场 subject、世界状态截面或查询提示、建议读取清单。
- **评审视图（核对清单）**：只交给写完后的评审使用，收纳全部意图级内容——本章目标与落点、本场目的、写作提示、线索脉络、节奏/开场钩子、Promise 推进任务、未决决策、信息控制四字段、禁写项。

**非目标**：

- 不规定正文写作质量，也不规定 llmlint 规则（属第七条）。
- 不新增 Scene / Promise / Decision / Keyframe 实体字段。
- 不删除 `ChapterWriterBriefMode` 的既有枚举值（删除属破坏性改动，另行评估）。
- 不做 `infoControl` 的自动编译：`chapter-write-review-revise` 的评审清单入参仍由调用方传入；自动编译需要 Workflow 侧确定性读取 Plot 数据的能力（当前宿主未接线 `wf.query` / `wf.callAction`），属另一项 capability，已登记在规范缺口表。
- **但漏传不再静默**：清单缺失时一致性评审收到显式「信息边界未核对」标注、运行日志记警告、返回值 `infoControlChecked=false`。事后校验可以缺失，但缺失必须可见（宪法第五条）。

## 术语与参与者

| 术语 | 含义 |
|---|---|
| 事实级细节 | 谁在场、发生什么、时间地点、世界状态截面、不可逆变化。宪法第二条允许进入 writer 动笔前上下文 |
| 意图级内容 | 结局、意义、本章目标与落点、本场目的、写作指令式节拍、"必须隐瞒/只能暗示"、推进指令、禁写。宪法第二条禁止进入 writer 动笔前上下文 |
| writer 视图 | 编译产物的 `suggestedBriefMarkdown` 字段，即 agent 工具 `get_chapter_writer_brief` 的文本输出 |
| 评审视图 | 编译产物的 `reviewChecklistMarkdown` 字段，不进入 writer 上下文，由评审消费 |
| 本章参数 | `ChapterBrief.pov` / `tone`。属写作参数而非意义指令，保留在 writer 视图 |
| 参与者 | leader（编译并交接）、writer（消费 writer 视图）、章节评审（消费评审视图）、Plot 模块（编译 owner） |

## 输入与前置条件

- 入口：HTTP `GET /api/projects/plot/chapter-writer-brief?chapterId=&mode=`；agent 工具 `get_chapter_writer_brief({projectRoot?, chapterId, mode?})`。
- 必填 `chapterId`（StoryChapter 数字 id）。`mode` 取 `autonomous`（默认）/`curated`/`slice-only`。
- 前置：项目已 open；章节存在且属于当前 Story。
- 数据来源：`ChapterBrief`、章节承载的 `Scene` 及其 `Thread`、Scene `worldAnchor` 与 World Engine 上下文、Scene 结构化 refs、Scene 上的 `PromiseBeat`、触及本章的 open `Decision`。
- 权限：只读，`mutates: false`，不写任何实体，不改变 `plot.selection`。

## 输出与可观察行为

返回 `ChapterWriterBriefDto`，其中两个 markdown 字段的归属如下。

**writer 视图（`suggestedBriefMarkdown`）段落骨架**

1. 标题与模式行、`Chapter: <title>(name: <name>)`、`Status: <status>`。
2. `Warnings`：数据完整性问题（缺 World Anchor 时间范围、subject 未解析、上下文查询失败、未关联 Scene）。
3. `本章参数（覆盖 writer 默认）`：仅 `pov` / `tone`。
4. `关键剧情点（按 Scene）`：每场 `Thread`、`本场做什么`（Scene summary）、时间 / 出场 subject / 地点，以及 World 状态：
   - `autonomous`：只给 `execute_world` 查询提示（subject + 地点 + 时间窗）。
   - `curated` / `slice-only`：展开 `World slices` 与 `Subject states` 摘要，不 dump raw attrs 或 patch JSON。
5. `建议读取`：由 Scene 结构化 refs 编译的路径清单。

writer 视图**不得出现**：本章目标与落点（`goal`/`ending`）、本场目的（`purpose`）、写作提示（`writingTip`）、线索脉络（`thread.summary`）、节奏与开场钩子（`pacing`/`opening`）、Promise 任务段、未决决策段、信息控制段、禁写段。

**评审视图（`reviewChecklistMarkdown`）段落骨架**

1. `本章目标与落点` ← `goal` + `ending`。
2. `节奏 / 下一章牵引` ← `pacing` + `opening`。
3. `信息控制` ← `readerKnows` / `protagonistKnows` / `mustHide` / `hintOnly`，明确标注"仅用于事后核对，不是写作任务的一部分"。
4. `禁写` ← `doNotWrite`。
5. `关键剧情点意图（按 Scene）` ← 每场 `purpose`、`writingTip`、所属 Thread `summary`。
6. `本章 Promise 任务` ← 按 Scene 分组的 beat 标签、固定推进指令、`beat.note`、`payoffExpectation`。
7. `未决决策警告` ← 触及本章的 open Decision：待决问题、候选方案、触及原因，措辞含"不得擅自写死"。

两个视图均按空态省略段落；两字段均满足 `z.string().min(1)`，即任意章节、任意 mode 下都产出非空文本（无内容时给出明确的"本章无 X"占位行，而不是空串）。

## 状态与转换

本能力不引入持久状态。`status` 是每次编译计算出的派生值，阶梯（短路优先级）：

| 序 | 条件 | status |
|---|---|---|
| 1 | 章节无关联 Scene | `needs_plot` |
| 2 | 任一 Scene 缺 `startInstant` / `endInstant` | `needs_world_anchor` |
| 3 | 任一 Scene 世界上下文缺失或存在未解析 subject | `needs_world_context` |
| 4 | 以上都不满足 | `ready` |

- `needs_chapter_brief` 已废止：信息控制是否填写不再参与 status，也不再阻断 handoff（宪法第五条：该数据改作事后核对）。
- 幂等：同一章节数据下重复调用返回相同结果；并发调用只读，无竞争语义。

## 副作用与数据

- 无副作用：不写数据库、不写文件、不发事件、不落缓存、不改变 `plot.selection`。
- 数据 owner 不变：`ChapterBrief` / `Scene` / `PromiseBeat` / `Decision` 写入仍由既有 `save_*` 工具与 leader 负责。

## 失败与恢复

- `chapterId` 缺失或非法：HTTP 400；工具侧参数校验失败。
- 章节不存在或不属于当前 Story：`PlotScopeGuard` 拒绝，错误原样上抛，不返回半成品 brief。
- Scene 缺时间范围：不查 World Engine，`needs_world_anchor`，writer 视图给出对应 warning。
- World Engine 上下文查询抛错：该 Scene 的 `worldContext` 为 `null` 并记通用 warning，编译继续；status 降为 `needs_world_context`。
- 未解析 subject：记入 warning 与 `unresolvedSubjectIds`，不静默丢弃。
- 无重试、无回滚需求（只读编译）。

## 边界与兼容

- 模块 owner：`plot`（`server/plot/services/chapter-writer-brief.service.ts`）。
- 上游接缝：本能力改动 `server/plot/services/chapter-writer-brief.service.ts`（S1）、`shared/dto/plot.dto.ts`（S2）、`server/agent/tools/plot-tools.ts`（S6）、`assets/reference/plot/writer-brief.md`（S8）。按 fork 规则只做外科手术，改完登记 `docs/standards/fork-seams.md`。
- 字段兼容：保留 `suggestedBriefMarkdown`（内容收窄为 writer 视图），新增 `reviewChecklistMarkdown`。`ChapterWriterBriefStatus` 删除 `needs_chapter_brief` 值。
- 模式兼容：三个枚举值全部保留。`autonomous` 与 `curated`/`slice-only` 的差异只保留"世界状态给查询提示还是展开摘要"；三者在"只含事实"这一点上完全一致。
- 不持久化，故无数据迁移。

## 验收与 Smoke

- **Given** 章节已关联带 World Anchor 的 Scene、World 上下文可解析、`ChapterBrief` 填了 `goal`/`purpose`/`writingTip`/信息控制，
  **When** 以任一 mode 调用 `get_chapter_writer_brief`，
  **Then** `suggestedBriefMarkdown` 不含 `goal`/`ending`/`purpose`/`writingTip`/`thread.summary`/`pacing`/`opening`/信息控制/禁写/Promise 任务/未决决策的任何一段，且 `reviewChecklistMarkdown` 全部包含。
- **Given** `ChapterBrief` 信息控制四项全空，
  **When** 编译 brief，
  **Then** `status` 为 `ready`（不再出现 `needs_chapter_brief`），且不产生"信息控制未填写"类 warning。
- **Given** `mode=autonomous`，
  **When** Scene 已连 World Engine，
  **Then** writer 视图出现 `World 查询提示`、不展开状态切面文本。
- **Given** `mode=curated` 或 `slice-only`，
  **When** Scene 已连 World Engine，
  **Then** writer 视图出现 `World slices` 与 `Subject states` 摘要，且不含任何意图级段落。
- **Given** 章节无关联 Scene，
  **When** 编译，
  **Then** `status=needs_plot`，`suggestedBriefMarkdown` 仍为可读的非空文本。
- **Given** 调用 `chapter-write-review-revise` 时未传 `infoControl`，
  **When** 运行一轮评审，
  **Then** 一致性评审消息含「信息边界未核对」显式标注、返回值 `infoControlChecked=false`、事件流含未提供清单的警告，且 writer 消息仍不含信息控制内容。
- **Given** 传入了 `infoControl`，
  **When** 运行一轮评审，
  **Then** 一致性评审消息含清单原文与逐条核对要求，返回值 `infoControlChecked=true`。
- Smoke 入口：`packages/neuro-book/server/plot/services/chapter-writer-brief.service.test.ts`、`packages/neuro-book/server/agent/tools/plot-tools.test.ts`、`packages/neuro-book/server/api/projects/plot/[...segments].test.ts`。

## 实现合同

- **owner**：`plot` 模块，编译入口 `server/plot/services/chapter-writer-brief.service.ts` 的 `getChapterWriterBrief(chapterId, mode)`；对外经 `PlotFacade.getChapterWriterBrief`、HTTP `GET /api/projects/plot/chapter-writer-brief`、agent 工具 `get_chapter_writer_brief` 暴露。
- **视图边界（关键不变量）**：`suggestedBriefMarkdown` 是唯一进入 writer 动笔前上下文的文本；`reviewChecklistMarkdown` 与 `promiseTasks` / `openDecisions` 只服务写完之后的评审。agent 工具在 `context.profileKey === "writer"` 时把 `details` 收口为事实字段（去掉 `reviewChecklistMarkdown` / `promiseTasks` / `openDecisions`，Scene 去掉 `purpose` / `writingTip` / `threadSummary` / `threadWritingTip`），使意图数据在任何消费路径下都到不了 writer。
- **数据边界**：只读聚合，不写 Project SQLite、不写 Workspace 文件、不发事件、不改 `plot.selection`。
- **失败语义**：章节越权交给 `PlotScopeGuard` 拒绝；World 上下文查询失败降级为 `needs_world_context` 并记 warning，不抛半成品。
- **测试入口**：`packages/neuro-book/server/plot/services/chapter-writer-brief.service.test.ts`（含 writer 视图事实/意义分离黑名单断言 `expectWriterViewFactOnly`）、`server/agent/tools/plot-tools.test.ts`（writer profile 下 details 收口）、`server/api/projects/plot/[...segments].test.ts`（HTTP 三模式）、`server/agent/workflow/chapter-write-review-revise.workflow.test.ts`（意图不下发 writer 消息）。

## 证据

批准依据（写作宪法为最高优先级 spec，本能力是其第二条 / 第五条的机制落地）：

- [写作宪法](../../doctrine/writing-doctrine.md)（第二条精确化、第五条裁决）
- [对照实验：事前告知 vs 事后校验](../../doctrine/contrast-experiment-2026-09-14.md)
- 实现与验证：[`chapter-writer-brief.service.ts`](../../../packages/neuro-book/server/plot/services/chapter-writer-brief.service.ts)、[`chapter-writer-brief.service.test.ts`](../../../packages/neuro-book/server/plot/services/chapter-writer-brief.service.test.ts)、[`plot-tools.test.ts`](../../../packages/neuro-book/server/agent/tools/plot-tools.test.ts)、[`[...segments].test.ts`](../../../packages/neuro-book/server/api/projects/plot/[...segments].test.ts)、[`chapter-write-review-revise.workflow.test.ts`](../../../packages/neuro-book/server/agent/workflow/chapter-write-review-revise.workflow.test.ts)、[`writer-brief.md`](../../../packages/neuro-book/assets/reference/plot/writer-brief.md)
