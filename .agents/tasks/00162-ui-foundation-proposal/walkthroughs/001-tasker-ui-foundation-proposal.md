---
schema: nbook.walkthrough/v1
taskId: 00162-ui-foundation-proposal
sequence: 1
role: tasker
status: completed
createdAt: 2026-08-27T02:20:00Z
---

# Tasker UI Foundation Proposal

## 结果

- 已确认 Task 00162 为 `planned`，`agentWorkflow.kind` 为 `design`，设计产物与允许文件均为非空；本 worktree 分支为 `docs/t162-ui-foundation-proposal`。
- 先以 `reviewing` 写入 `docs/proposals/p-006-neurobook-ui-foundation.md`，完成结构自检与逐项语义核对后，才将 Proposal 状态改为 `accepted`。
- p-006 唯一设计产物已覆盖 Task 合同要求的问题、目标/非目标、当前证据、方案/备选与取舍、数据/接口/安全/迁移/发布/回滚影响、三个目标 capability/Spec 预期合同和日期决策记录。
- 仅创建了 Task 允许的两个文件：
  - `docs/proposals/p-006-neurobook-ui-foundation.md`
  - `.agents/tasks/00162-ui-foundation-proposal/walkthroughs/001-tasker-ui-foundation-proposal.md`

## 语义映射与事实边界

- 已将开发者批准的 Issue #191 方案完整映射到唯一 Proposal：显式 nb-ui 接入、AGPL-3.0-only 与 Product 分发目标、公开 `system | nbook-light | nbook-dark`、nbook 与 macOS 配色逐项相等的目标、Product 不安装 `macosTheme`、Global Config 唯一持久化 authority、认证显式配色允许 system 首帧后一次纠正、Source Dev-only Lab、14 个 preview 场景先迁移后删除，以及 Workbench/View Host、View Registry、Editor Split、插件运行时非目标。
- Proposal 的“当前行为与证据”明确记录：nb-ui 当前许可证仍是 `PolyForm-Noncommercial-1.0.0`；当前版本仍为 `0.2.0-alpha.0`；当前 nbook colorways 仍与 macOS 对应值不逐项相等（示例包含 nbook `#e3e4e6`/`#fffcf5`/`#1a1b1e` 与 macOS `#f6f8fa`/`#ffffff`/`#1c1c1e`）；主应用当前没有 nb-ui workspace 依赖、CSS 接入或 module 接入；应用仍有旧 `theme`/`customThemes`/snapshot/宿主调用；两个 UI capability 尚未登记。
- 目标许可证、变量相等、colorway clean cutover、Lab、Spec、组件迁移、preview 清退与 Product/浏览器验收均没有写成当前已完成。
- 现有 `theme.system` 作为同一 capability 原地更新，Proposal 明确不创建平行 Spec；后续 `ui.component-contracts` 与 `ui.component-lab` 只作为新的 `planned` Spec 预期边界，等待 Leader 在 Proposal accepted 后创建。

## 自检与实际验证

已执行：

- `git branch --show-current && git rev-parse HEAD && git status --short`：确认分支 `docs/t162-ui-foundation-proposal`，开始时 HEAD 为 `2f96b3ac9d722a1e50d52f0ba45f3acd03b97811`，工作树无既有改动。
- `git merge-base --is-ancestor 9e54e5d3863d3505ce26db149164e95d60950df6 HEAD; echo exit:$?`：返回 `exit:0`，任务 context 基线可达。
- 只读读取并核对：根 `AGENTS.md`、`.omp/RULES.md`、`.agents/roles/tasker/AGENTS.md`、`.agents/tasks/AGENTS.md`、Task README/context、`docs/proposals/README.md`、`docs/specs/README.md`、批准方案、nb-ui `README.md`/规范/manifest/colorways/package.json、NeuroBook `AGENTS.md`/`package.json`/`nuxt.config.ts`/主题 Spec/主题变量说明。
- `grep` 结构核对：Proposal 含所有最小结构章节；关键词覆盖许可证、colorway、Global Config、Lab、14 个 preview、三个 capability、排除边界、迁移/回滚和 required 行为；并额外确认 Lab 核心节点 `id="nb-lab-target"` 约束已写入。
- `git diff --check -- docs/proposals/p-006-neurobook-ui-foundation.md`：无输出，空白检查通过。

未执行（按 Task/当前会话边界）：

- 未运行 `bun run docs:check`、`bun run governance:check`、任何项目测试、formatter、lint、typecheck、build 或 browser 人工验收；这些检查由 Leader 统一执行，且当前 Task 合同明确将 docs/governance/diff 列为 required 但本次 assignment 明确要求不运行。
- 未执行 Issue/Project/PR/远端写入、push、合并、发布、部署、数据库迁移、真实 Provider/Model 或数据删除。

## Commit 前状态

- Proposal 已为 `accepted`；Task README/context 未修改，Spec、源码、测试、配置、依赖、lockfile、生成物未修改。
- commit 前实际 `git status --short --untracked-files=all` 仅列出上述 Proposal 与本 walkthrough；`git diff --cached --stat` 为 2 files changed、370 insertions；`git diff --cached --check` 无输出。没有为当前事实差异添加任何实现性补丁。
- 当前 `status: accepted` 仅表示 p-006 的长期方案完成结构检查和逐项语义核对；不表示 Issue #191 的实现、两个 planned Spec、`theme.system` 改版、许可证切换、nbook 数值对齐、Lab、preview 清退或 Product 验收完成。

## 本轮 Leader finding 与修正

- Leader 逐项对照批准计划发现两处 required 语义漂移：`world-engine.preview.vue` 的 owner 不应写成 M；批准边界是 M 仅解耦 N 所需的 mock/data 并提供 M-owned deterministic fixture，workbench-preview SFC 与两页 destination 保持 N-owned pending，由 N 最终完成两页 scenario 证据。另有迁移顺序把 A 写成“先登记两份 planned UI Spec”，实际治理顺序应由 Leader 在 p-006 accepted 后先创建/登记两份 planned Spec 并运行 `docs:check`，再创建 A Task；A 只消费既有 Spec，不创建行为合同。
- 按要求先将 p-006 从 `accepted` 退回 `reviewing`，只修正上述 Preview 表 owner/去向与迁移顺序；针对性语义修正已完成。当前 p-006 停在 `reviewing`，等待 Leader 实际运行 `docs:check` 并完成逐项语义核对；本 Tasker 不再自行将 Proposal 改回 `accepted`。
- 本轮未运行 `docs:check`、`governance:check`、formatter、lint、typecheck、build 或项目测试；Leader 将统一运行 required 门禁。未执行任何远端写入、push、PR、合并、发布或部署。

## Leader 门禁与接受

- Leader 在 p-006 保持 `reviewing` 时实际运行 `bun run docs:check`，结果 `failures: []`、`checkedFiles: 5288`；实际运行 `bun run governance:check`，结果 `failures: []`、`warnings: []`；baseline-to-HEAD 与 worktree diff checks 均通过。上述结果由 Leader 提供并作为本轮接受依据，本 Tasker 未重复运行这些命令。
- Leader 逐项语义核对确认前述两处 finding 已按批准计划修正，未发现新的语义漂移；据此由同一 Proposal owner 将状态从 `reviewing` 改为 `accepted`。此次状态切换不改变其它内容，不表示 Issue #191 实现、Spec、许可证切换、nbook 数值对齐、Lab、preview 清退或 Product 验收完成。
