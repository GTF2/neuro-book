---
schema: nbook.walkthrough/v1
taskId: 00163-ui-migration-baseline
sequence: 1
role: tasker
status: completed
createdAt: 2026-08-27T02:39:47Z
---

# Tasker walkthrough：UI migration static baseline

## 执行范围

- 已按 `.agents/skills/load_role/SKILL.md` 的 `tasker` 参数加载 `.agents/roles/tasker/AGENTS.md`，并读取根规则、`.omp/RULES.md`、Task 规则、Task README/context、主应用包规则、`docs/specs/README.md`、测试/数据格式规范和已接受的 p-006 Proposal 事实边界。
- 当前 Task 为 `planned`；本轮只执行只读源码扫描，写入两个直属 evidence JSON 与本直属 walkthrough。不修改产品源码、测试、配置、Spec、Proposal、Task README/context 或远端数据。
- 扫描 revision：`4849416b9455679b19246cc25be198d7413ffff8`。

## 组件清单方法与结果

- 对 `packages/neuro-book/app/components/**/*.vue` 使用 Git tracked glob 作为全集，按 repo-relative POSIX path 排序；每个 SFC 记录 path、componentName、domain、directDependencySignals、tierCandidate、finalDispositionTask、依据、局部 SFC 依赖和源证据行。
- 依赖信号仅是静态线索：`api`、`storage`、`pinia`、`project-session`、`drag-drop`、`editor`、`overlay`、`theme`、局部组件 import 和模板组件使用。`tierCandidate` 是静态候选，不是运行时判定。
- 计数：SFC glob `232`；inventory `232`；唯一路径 `232`；缺失 `0`；重复 `0`；`complete: true`。
- tier 候选：`presentational 49`、`composite 114`、`workspace 69`。
- 最终路径 owner 候选计数：C `4`、D `1`、E `15`、F `28`、G `10`、H `14`、I `28`、J `18`、K `24`、L `21`、M `17`、N `8`、O `44`。
- owner 冲突不被隐藏：共记录 `213` 条去重后的跨批次直接 SFC 依赖边，说明路径 owner 与依赖 owner 不同，后续需要 handoff；本 Task 不擅自改派 owner。典型冲突包括 F→E（Diff/Dialog）、F→G（StructuredTextEditor/Markdown Studio）、G→E（Markdown toolbar/Dialog）、I→E/F/J/K/O 等、L→K（Plot workbench/thread panel）、M→N（World Engine host preview）和 O→E（Agent/JsonViewer）。完整清单见 `evidences/component-sfc-inventory.json` 的 `ownerConflicts`。

## Preview 清单方法与结果

- 对 `packages/neuro-book/app/pages/*.preview.vue` 使用 Git tracked glob，得到并冻结 14 个 source path；evidence 同时保存 expected/actual 集合和 exact comparison。
- 14 个源文件与预期集合逐字相等：`exactMatch: true`；缺失 `0`；意外 `0`。
- 每个 source page 恰好登记 1 个稳定 scenario ID，scenario 总数 `14`，全局唯一 ID `14`，重复 ID `0`，无页面缺 scenario。
- kind 计数：`demo-only 10`、`product-behavior 4`。
- `product-behavior` 已为每页给出 formalSurface 候选或记录阻塞/未验证；`demo-only` 已给出确定性 fixture/Lab destination。当前只冻结候选，未声称迁移完成。
- 14 个 scenario ID：
  - `preview.workflow.formal-catalog-run`
  - `preview.world-engine-workbench.review-drafts`
  - `preview.world-engine.project-mutation-query`
  - `preview.profile-template.visual-edit`
  - `preview.subject-state.viewer`
  - `preview.structured-text.modes-and-triggers`
  - `preview.plot.workspace-views`
  - `preview.plot.workbench-dialog`
  - `preview.plot.tree-view`
  - `preview.plot.timeline-view`
  - `preview.settings.model-provider`
  - `preview.plot.thread-panel`
  - `preview.dnd.chapter-batch-drag`
  - `preview.diff-workbench.modes-and-merge`

## 事实边界、冲突与未验证项

- 所有 JSON 证据均只含 repo-relative 路径、静态信号、短文案和行号；未写入用户 Project 内容、Session 内容、secret、绝对路径或大段源码。
- “由 API/真实 workspace/真实模型驱动”的页面行为只记为 `product-behavior` 候选或未验证项；没有浏览器、真实 API、Provider/Model、持久化或完整交互证据时，不把静态判断写成运行通过。
- `workflow.preview.vue` 同时存在正式 Catalog/API 路径和经典 mock/真模型 demo，当前以一个主 scenario 覆盖页面并明确两类入口及未验证边界；后续若实现 Task 需要逐交互拆分，必须回到 baseline/Leader 合同，不在本 Task 静默增删 scenario。
- owner 边界冲突已单列；停止条件“owner 无法唯一覆盖”未命中，因为 232 个路径均按 context 的路径前缀得到一个 finalDispositionTask，但 213 条跨批次依赖作为后续 handoff 风险保留。
- 停止条件“场景必须通过浏览器/真实 API 才能判定 kind”已命中于涉及真实 API、Provider、Project/session 和实际浏览器交互的场景；因此对应 `unverified` 明确列出，未把证据升级为运行结论，也未新增 blocked walkthrough（当前 Task 的要求可由静态基线完成；若后续迁移无法保留 kind，应由实现 Task 追加 blocked walkthrough）。

## 验证与 required 结果

- `git diff --check`：已执行，退出码 `0`；只检查本 Task 新增 evidence/walkthrough 的工作树差异。
- `git diff --cached --check`：未执行；本轮未暂存文件，提交前会以精确暂存集合补跑。
- `governance-check`：未在本 Tasker 恢复阶段重复运行；Leader 已报告其合同修复后 `bun run governance:check` 为 `failures[]`、`warnings[]`，本轮未改合同文件。
- 浏览器和产品测试：按 Task 合同不运行；不存在浏览器可见行为变更。
- formatter、lint、docs、governance、typecheck 和产品测试均未运行（除 Leader 在恢复前报告的治理结果外，不把未执行项写成通过）。

## 停止条件命中情况

- `owner boundary cannot uniquely cover SFC`：未命中最终 path coverage；已记录 213 条跨 owner 依赖冲突供后续 handoff。
- `scenario kind requires browser/real API`：对真实 API/Provider/Project/session/浏览器交互场景命中“静态证据不足”边界，已在两个 JSON 的 `unverified` 中报告；不伪造运行证据。

## 交付

- `evidences/component-sfc-inventory.json`
- `evidences/preview-scenario-baseline.json`
- 本直属 Tasker walkthrough

停止条件与后续迁移规则均保持原合同：后续 E–O 只能为已冻结 scenario 填 destination/evidence，P 在 destination/evidence、catalog ready 和真实 surface 证据闭合后才可清退 14 个 preview source。