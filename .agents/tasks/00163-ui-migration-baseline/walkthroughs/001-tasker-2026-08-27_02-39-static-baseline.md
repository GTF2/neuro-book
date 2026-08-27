---
schema: nbook.walkthrough/v1
taskId: 00163-ui-migration-baseline
sequence: 1
role: tasker
status: verifying
createdAt: 2026-08-27T02:39:47Z
---

# Tasker walkthrough：UI migration static baseline（返工中）

## 执行范围

- 已按 `.agents/skills/load_role/SKILL.md` 的 `tasker` 参数加载 `.agents/roles/tasker/AGENTS.md`，并读取根规则、`.omp/RULES.md`、Task 规则、Task README/context、主应用包规则、`docs/specs/README.md`、测试/数据格式规范和已接受的 p-006 Proposal 事实边界。
- 当前 Task 保持 `verifying`；本轮只写入两个直属 evidence JSON 与直属 walkthrough，不修改产品源码、测试、配置、Spec、Proposal、Task README/context 或远端数据。
- 本轮复核/返工扫描 revision：`fcfe0a0f445f8cf269b7ed052a38b1adb86e623b`；SFC evidence 也已同步该 revision。

## 组件清单方法与结果

- 对 `packages/neuro-book/app/components/**/*.vue` 使用 Git tracked glob 作为全集，按 repo-relative POSIX path 排序；每个 SFC 记录 path、componentName、domain、directDependencySignals、tierCandidate、finalDispositionTask、依据、局部 SFC 依赖和源证据行。
- 依赖信号仅是静态线索：`api`、`storage`、`pinia`、`project-session`、`drag-drop`、`editor`、`overlay`、`theme`、局部组件 import 和模板组件使用。`tierCandidate` 是静态候选，不是运行时判定。
- 计数：SFC glob `232`；inventory `232`；唯一路径 `232`；缺失 `0`；重复 `0`；`complete: true`。
- tier 候选：`presentational 49`、`composite 114`、`workspace 69`。
- 最终路径 owner 候选计数：C `4`、D `1`、E `15`、F `28`、G `10`、H `14`、I `28`、J `18`、K `24`、L `21`、M `17`、N `8`、O `44`。
- owner 冲突不被隐藏：共记录 `213` 条去重后的跨批次直接 SFC 依赖边，说明路径 owner 与依赖 owner 不同，后续需要 handoff；本 Task 不擅自改派 owner。典型冲突包括 F→E（Diff/Dialog）、F→G（StructuredTextEditor/Markdown Studio）、G→E（Markdown toolbar/Dialog）、I→E/F/J/K/O 等、L→K（Plot workbench/thread panel）、M→N（World Engine host preview）和 O→E（Agent/JsonViewer）。完整清单见 `evidences/component-sfc-inventory.json` 的 `ownerConflicts`。

## Preview 清单与粒度结果

- 对 `packages/neuro-book/app/pages/*.preview.vue` 使用 Git tracked glob，14 个 source path 的 expected/actual 集合逐字相等：`exactMatch: true`；缺失 `0`；意外 `0`。
- 返工后 scenario 总数为 `31`，全局唯一 ID `31`，重复 `0`，14 页均有 scenario；kind 计数为 `product-behavior 5`、`demo-only 26`。
- Workflow 页面拆为 6 条：正式 Catalog、`split-book`、`write-pipeline`、`rp-turn`、`sidecar-context`、`real-fanout`。前五条分别按正式 API、`DEMO_SCENARIOS` 稳定 key 和不同运行/观测行为冻结；`real-fanout` 保留为 product-behavior，因为它使用真实 profile、模型和 harness。
- World Engine 两页各一条：`world-engine.preview.vue` 的真实 Project/API 为 product-behavior、`world-engine.workbench-preview.vue` 的确定性 mock 为 demo-only；两条 `ownerTask` 与正式 destination 均为 N，mock/data 的 `fixtureOwnerTask` 才记录 M。
- `plot.preview.vue` 按直接导入 workspace 的稳定 view key 拆为 `locator`、`thread`、`chapter`、`tree` 四条；每条共享同一 dataset 但具有独立 view component、选择入口和可观察 surface。
- `plot-timeline.preview.vue` 按 `v-for phases` 的三个稳定 phase key 拆为 `phase-arrival`、`phase-unlock`、`phase-burning` 三条；`selectPhase()` 会重新调用 `buildPlotTimelinePhaseView`，导致不同 lanes/cards 与首个 Thread/Scene/Chapter，故不是普通 theme/参数变体。
- `diff-workbench.preview.vue` 按 `samples` 的 7 个稳定 document id 拆为 `markdown`、`profile`、`json`、`deleted`、`markers`、`long`、`binary`；差异内容/不可用分支可独立选择和验证。主题、side-by-side、whitespace、merge readonly、语言覆盖仍是参数，不再另拆。
- `dnd.preview.vue` 拆为篇级 `volume-reorder` 与章节级 `chapter-batch-drag` 两条独立拖拽合同；具体 volume/chapter IDs 作为同一 mechanic 的确定性 fixture，不为每个实体复制 scenario。
- Profile editor 是固定 `user-profile` mount，Subject State 是固定 `subject_elena_001` fixture；Structured Text 在同一 fixture 内枚举 rich/source 与 `@/$/` trigger，尺寸、格式工具和主题均是参数，因此各保留一条。Plot workbench/tree/thread 内实体 IDs 仍属各自 workspace fixture，不把数据项误报成独立迁移 surface。
## 事实边界、owner 与未验证项

- 两个 JSON 只含 repo-relative 路径、静态信号、短文案、行号和 scenario 元数据；未写入用户 Project 内容、Session 内容、secret、绝对路径或大段源码。
- 每条 product-behavior 均给出正式 surface 与源证据；每条 demo-only 均给出确定性 Lab fixture。evidence 只冻结候选 destination，不宣称迁移完成。
- 未运行浏览器、真实 API、Provider/Model、持久化或产品交互；这些限制逐条写入 `unverified`，不把静态推断写成运行通过。
- 停止条件“owner boundary 无法唯一覆盖 SFC”未命中：232 个路径均有一个 final disposition，213 条跨 owner 依赖作为 handoff 风险保留。
- 停止条件“场景 kind 必须依赖浏览器/真实 API”未命中：静态源码已明确区分真实 API/模型入口与本地 mock/data 入口。运行证据缺失不等于 kind 不可判定，故不追加 blocked walkthrough。

## 验证与 required 结果

- 本轮按 Task 合同不运行 formatter、lint、docs、governance、typecheck、产品测试或浏览器；Leader 的治理结果不在本 walkthrough 重复声称。
- 返工后将执行 JSON 解析/结构自检、`git diff --check` 与精确暂存集合的 `git diff --cached --check`；结果在 walkthrough 002 记录。

## 交付与后续边界

- `evidences/component-sfc-inventory.json`
- `evidences/preview-scenario-baseline.json`
- 本直属 Tasker walkthrough，以及返工映射见 `walkthroughs/002-tasker-2026-08-27_03-31-workflow-scenario-rework.md`。

后续 E–O 只能为上述已冻结 scenario 填 destination/evidence；P 在 destination/evidence、catalog ready 和真实 surface 证据闭合后才可清退 14 个 preview source。