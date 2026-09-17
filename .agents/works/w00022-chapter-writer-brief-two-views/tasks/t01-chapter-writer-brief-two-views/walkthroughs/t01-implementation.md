# t01 实施记录：brief 双视图改造

日期：2026-09-14。分支：`feat/writing-doctrine-alignment`。

## 实际改动

**编译核心**

- `shared/dto/plot.dto.ts`：`ChapterWriterBriefStatusSchema` 删 `needs_chapter_brief`；`ChapterWriterBriefDtoSchema` 新增 `reviewChecklistMarkdown`；mode 与 status 注释改为「只决定世界状态怎么给」。
- `server/plot/services/chapter-writer-brief.service.ts`：`renderSuggestedBriefMarkdown` 拆成 `renderWriterBriefMarkdown`（事实切片）+ `renderReviewChecklistMarkdown`（事后核对清单）+ `appendChapterParams`；`chooseStatus(scenes)` 去掉信息控制门槛，`isInfoControlEmpty` 删除；删掉「信息控制未填写」「slice-only 模式」两条 warning。
- `server/agent/tools/plot-tools.ts`：工具文本输出改出 writer 视图；新增 `toWriterSafeBriefDetails`，`context.profileKey === "writer"` 时 `details` 只回传事实字段（Scene 去掉 `purpose`/`writingTip`/`threadSummary`/`threadWritingTip`，整体去掉 `promiseTasks`/`openDecisions`/`reviewChecklistMarkdown`）；工具描述与 mode 描述改写。

**评审通道**

- `assets/workspace/.nbook/agent/workflows/chapter-write-review-revise/workflow.ts`：`chapterId` 由可选变必填；writer 消息不再承载 `brief`，只留交付要求；`brief` / `infoControl` 只注入评审。

**Reference 与 skill 主链**

- `assets/reference/plot/writer-brief.md`（整篇改写）、`plot/system.md`、`plot/agent-spec.md`、`agent/leader-default.md`、`agent/novel-writing-workflow.md`、`world-engine/workflow.md`（§6.2 / §6.3 / §13）、`skills/novel-writing/phases/02-canon-commit.md`、`phases/03-chapter-loop.md`、`novel-writer-execution/SKILL.md`。

**用户文档（中英对等）**

- `vitepress/{zh-Hans,en-US}/core/plot-workbench.md`、`profile/writer.md`、`profile/leader.md`、`tutorials/04-first-three-chapters.md`。

**治理**

- 新增 `docs/specs/plot/chapter-writer-brief.md`（`implemented`），`docs/specs/README.md` 已实现规范表与规范缺口同步。
- `docs/standards/fork-seams.md`：S1/S2/S6/S8/S9 行改写，新增 S16 登记 Reference/Skill 接线。
- `PROJECT-STATUS.md`：对齐表首行改写、未收口第 0 条删除、第 5/6 条更新。
- `HANDOFF.md`：已完成第 8 条、P0 行标记完成。
- `app/components/novel-ide/plot/chapter-panel/PlotChapterEditorDialog.vue`：信息控制注释更新。

## 验证

- `vitest run chapter-writer-brief plot-tools segments`：6 文件 / 74 测试通过。
- `vitest run chapter-write-review-revise`：1 文件 / 4 测试通过。
- `bun run docs:check`：见 Task README / 最终报告（含修复一次相对链接失败）。
- `bun run typecheck`：见最终报告。
- 未运行：真实模型对照实验（需 Provider 与开发者授权，单轮 13–20 分钟）；"改完是否更好"由开发者判定。

## 偏差与说明

- HANDOFF 原方案提「`slice-only` 升为唯一合法形态」。实际落地为**保留三个枚举值**，三者在「只给事实」上完全一致，差异只剩世界状态呈现方式（查询提示 vs 展开摘要）——`slice-only` 与 `curated` 在事实渲染上等价，保留枚举值是为避免破坏上游接口（删枚举值属破坏性改动，另行评估）。已与开发者确认「保留三枚举、只废 status 门槛」。
- `infoControl` 自动编译（PROJECT-STATUS 旧第 4 条）未做：需要 Workflow 侧读取 Plot 的能力，属另一项 capability，已列入 Spec 的非目标。
- 未新增独立「评审清单」工具：评审视图经既有 workflow 参数（`brief` / `infoControl`）传给评审，避免扩大 agent 工具面。

## 自检发现的连带影响（已处理）

`scripts/smoke/slice-vs-told-contrast.ts`（写作宪法否决权条款第 2 条的终审实验脚本）在本轮改造后**对照条件失效**：

1. `autonomous` 编译产物不再含信息控制与禁写 → 「事前告知」组失去干预；
2. `chapter-write-review-revise` 的 `brief` 只注入评审、不再下发 writer → 两组正文的动笔前上下文退化为同一份事实切片。

即无论怎么跑，产出的都是「同一份输入的两份正文」。已做的处理：脚本文件头改写事实说明，`main()` 开头加 fail-closed 守卫（`SMOKE_CONTRAST_ALLOW_STALE_TOOLING=1` 才放行，且结果不可作为证据）；登记进 `PROJECT-STATUS.md` 未收口第 7 条与 `docs/standards/fork-seams.md` S11。

## 验证补充

- 自检 grep：`needs_chapter_brief` / `renderSuggestedBriefMarkdown` / `factualBrief` 在源码中无残留（仅存于 Spec、接缝表、PROJECT-STATUS 的历史叙述）。
- `bun run governance:check`：0 failures / 0 warnings。

## 终审实验链路重建（同一 Task 内完成，开发者批准「该怎么做怎么做」）

- 新增实验专用 workflow `assets/workspace/.nbook/agent/workflows/contrast-write-review/workflow.ts`：把调用方**显式给定**的 writer 提示原样下发（仅 trim 首尾空白），再做一致性 / 节奏 / 文风三维评审一轮、**不修订**；不接入普通写作主链。
- 新增 `server/agent/workflow/contrast-write-review.workflow.test.ts`：断言「writer message 与传入提示相同（仅 trim 首尾空白）」「核对单只进一致性评审」「writer 只被调一次」「缺 chapterPath / 缺 writerBrief 时在创建任何 agent 前失败」。
- `scripts/smoke/slice-vs-told-contrast.ts` 重写为**单变量**对照：两组共用同一份事实简报（`slice-only`）；A 组 writer 提示 = 事实 + 评审清单全文，B 组 = 纯事实 + 信息控制只进一致性评审。移除 fail-closed 守卫与 `--review-rounds`（实验固定一轮不修订）。
- 文档同步：`vitepress/{zh-Hans,en-US}/agent/workflow.md`、`assets/reference/agent/workflow/README.md`、`docs/standards/fork-seams.md`（S11 改写、新增 S17）、`PROJECT-STATUS.md` 第 7 条、`HANDOFF.md`。
- **未验证**：真实 Provider 跑一轮并由开发者判定（需 Provider 与开发者授权）；本轮只验证到「无模型运行级」与类型/文档门禁。
