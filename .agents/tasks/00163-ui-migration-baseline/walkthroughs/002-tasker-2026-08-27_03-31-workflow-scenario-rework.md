---
schema: nbook.walkthrough/v1
taskId: 00163-ui-migration-baseline
sequence: 2
role: tasker
status: verifying
createdAt: 2026-08-27T03:31:36Z
---

# Tasker walkthrough：workflow scenario 与 UI baseline 返工

## 返工范围与边界

- 本轮针对已确认的三项 P1 finding 返工：Workflow 证据聚合不完整、World Engine 两页最终 owner 不一致、walkthrough 对 `blocked` 停止条件的叙述冲突。
- 同步复核其余 preview 页面，依据“稳定 ID/key 且可独立触发，或独立行为/迁移 destination/evidence 才单列；theme、viewport、readonly、side-by-side、size 与参数变体不拆”的已接受粒度合同冻结场景。
- 仅修改本 Task 直属 `evidences/component-sfc-inventory.json`、`evidences/preview-scenario-baseline.json`、walkthrough 001 并新增本 walkthrough；未修改产品源码、Spec、Proposal、README/context、测试、配置或远端数据。
- 本轮扫描 revision：`fcfe0a0f445f8cf269b7ed052a38b1adb86e623b`。Task README/context 保持既有 `verifying` 状态和授权边界。

## Finding 1：Workflow 页面聚合了独立 stable keys

### 证据

- 页面同时加载正式 Catalog 与经典场景列表：`workflow.preview.vue#L91-L105`、`#L137-L185`；正式入口和 demo 入口各有独立 run API/状态区：`#L245-L301`、`#L429-L572`。
- 服务端 `DEMO_SCENARIOS` 明确登记五个稳定 key：`split-book`、`write-pipeline`、`rp-turn`、`sidecar-context`、`real-fanout`，见 `server/agent/workflow/workflow-demo-scenarios.ts#L382-L420`。
- `split-book`、`write-pipeline`、`rp-turn`、`sidecar-context`、`real-fanout` 的 run 函数各有不同的 fan-out、循环/ask、acquire/excursion 或真实模型行为，见同文件 `#L116-L368`；`real-fanout` 还明确创建真实 profile/session 并汇总。

### 修复

- `preview-scenario-baseline.json` 由原一条 `preview.workflow.formal-catalog-run` 改为六条独立 scenario：`preview.workflow.formal-catalog`、`preview.workflow.demo.split-book`、`preview.workflow.demo.write-pipeline`、`preview.workflow.demo.rp-turn`、`preview.workflow.demo.sidecar-context`、`preview.workflow.real-fanout`。
- 正式 Catalog 场景标为 `product-behavior` 并指向 Task O 的正式 Workflow surface；四个确定性 classic mock 场景标为 `demo-only` 并各有独立 Lab fixture；`real-fanout` 标为 `product-behavior`，记录真实 profile/Provider/Model/harness 依赖和正式 destination 候选。
- 每条 Workflow scenario 记录独立 trigger、input、fixture、observable、sourceEvidence 与 unverified；未把真实 API、模型费用、session 或浏览器运行缺失伪装成通过。

## Finding 2：World Engine 两页的最终 owner 被写成 M/N 混合

### 证据

- `world-engine.preview.vue` 以 Project 列表、Project session ready generation 和 `/api/projects/world-engine/*` 真实 API 为入口，见 `#L287-L322`、`#L451-L503`、`#L512-L706`、`#L1152-L1264`。
- `world-engine.workbench-preview.vue` 完全从 `cloneMockWorkbenchSlices`、`cloneMockWorkbenchSnapshots`、`mockWorkbenchSchema`、`mockWorkbenchSubjects` 和 localStorage v4 构成 mock 工作台，见 `#L73-L105`、`#L571-L648`、`#L788-L903`。

### 修复

- 两页不合并为同一 scenario：真实 Project/API 页保留 `preview.world-engine.project-mutation-query`（`product-behavior`），mock 工作台页保留 `preview.world-engine-workbench.review-drafts`（`demo-only`）。
- 两条记录的 `ownerTask`、`formalSurface`/`labFixture` 最终迁移归属均为 N；mock 条目额外以 `fixtureOwnerTask: M` 标记 M 只提供 mock/data/deterministic fixture，不形成 M/N 双 owner。
- World Engine owner contract 已写入 evidence 顶层；真实接口和 mock 恢复/重算均只列为 unverified，未声明运行完成。

## Finding 3：`blocked` 停止条件叙述不一致

### 原问题

- 初次 walkthrough 同时称真实 API/浏览器运行证据不足已“命中停止条件”，又称不追加 blocked walkthrough；这把“kind 无法静态判定”和“运行证据尚未执行”混为一谈。

### 修复

- 返工 walkthrough 001 的状态改为 `verifying`，并明确：所有 14 个页面的 `kind` 都能从源码区分真实 API/模型入口和本地 mock/data fixture；停止条件“场景 kind 必须通过浏览器/真实 API 才能判定”未命中。
- `unverified` 仍逐条保留浏览器、API、Provider/Model、持久化和真实交互未执行事实；未运行不等于 blocked，因此本轮不追加 blocked walkthrough。
- owner 边界停止条件也未命中：232 个 SFC 路径各自有唯一 final disposition，213 条跨批次依赖冲突继续保留在 inventory 供 handoff。

## 其余 13 页粒度复核

- `plot.preview.vue`：按 `PlotViewSwitcher` 稳定 view key 拆为 `locator`、`thread`、`chapter`、`tree` 四条；每条有独立 view component、选择入口和可观察 Inspector/selection surface。
- `plot-timeline.preview.vue`：按 `v-for phases` 的三个稳定 key 拆为 `phase-arrival`、`phase-unlock`、`phase-burning` 三条；`selectPhase()` 调用 `buildPlotTimelinePhaseView` 后 lanes/cards 和首个 Thread/Scene/Chapter 会改变。
- `diff-workbench.preview.vue`：按 `samples` 的七个稳定 document id 拆为 `markdown`、`profile`、`json`、`deleted`、`markers`、`long`、`binary`；二进制不可用分支也可独立选择和观察。主题、语言覆盖、side-by-side、whitespace 和 merge readonly 是参数，不拆。
- `dnd.preview.vue`：拆为篇级 `volume-reorder` 和章节级 `chapter-batch-drag` 两种独立拖拽操作；具体 volume/chapter ID 仍是同一机制 fixture，不逐实体复制。
- `tsx-profile-editor.preview.vue`：固定单一 `user-profile` mount 和模板入口，Profile catalog/节点/Inspector/source/preview 属同一编辑器合同，不拆。
- `subject-state-viewer.preview.vue`：固定 `subject_elena_001`、character schema 和属性树 fixture；对象层级行是同一 viewer 的递归数据，不拆为多个迁移场景。
- `structured-text-editor.preview.vue`：rich/source、`@`/`$`/`/` trigger、格式工具、尺寸和主题共享同一 Markdown fixture、同一 editor destination，作为一条场景枚举参数。
- `plot-workbench.preview.vue`、`plot-tree.preview.vue`、`plot-thread.preview.vue`：各自的 Thread/Scene IDs 是 workspace fixture；页面/工作台/树图/侧边栏本身已有独立 source scenario，未把实体数据误报成独立 destination。
- `model-settings.preview.vue`：固定单一真实设置 panel，Provider/model 列表、发现、健康检查、校验、保存/恢复属于同一正式 settings surface，不拆。
- `world-engine.preview.vue` 与 `world-engine.workbench-preview.vue` 已分别按上述 Finding 2 冻结，不合并页面。

## 返工结果

- Preview source 仍为精确 14 个：expected/actual 相等，缺失 `0`，意外 `0`，`exactMatch: true`。
- Scenario 总数由 `14` 修正为 `31`，全局唯一 ID `31`，重复 `0`，14 页均有场景。
- kind 计数：`product-behavior 5`、`demo-only 26`。
- 按页面计数：Workflow `6`、Plot workspace `4`、Plot timeline `3`、Diff `7`、DND `2`；其余页面各 `1`。
- 按最终 owner 计数：O `6`、N `2`、H `1`、M `1`、F `8`、K `9`、L `1`、J `1`、E `2`。
- SFC inventory 保持 `232` 条记录、唯一路径 `232`、缺失 `0`、重复 `0`、`complete: true`；tier 候选仍为 presentational `49`、composite `114`、workspace `69`；owner conflict `213` 条。

## 验证

- 已运行 JSON 解析/结构自检：`issues: []`；preview `scenarioCount: 31`、`uniqueIds: 31`、`sourceExact: true`；inventory `recordCount: 232`、`ownerConflicts: 213`。
- 已运行 `git diff --check`：退出码 `0`。
- 本轮未运行 `git diff --cached --check`，因为当前证据尚未由 Leader 统一暂存；提交前仅暂存两个 evidence 和两个直属 walkthrough，再补跑该检查。
- 按 Task 合同未运行 formatter、lint、docs、governance、typecheck、产品测试、浏览器、真实 API、Provider/Model 或远端写入。

## 当前状态与后续边界

- Task 与本 walkthrough 保持 `verifying`；未将静态 baseline 误报为迁移完成。
- 后续 E–O 只能为 31 条已冻结 scenario 填正式 destination/evidence；P 需在 destination/evidence、catalog ready 与真实 surface 证据闭合后才可清退 14 个 preview source。
- 未发现需要追加 `blocked` walkthrough 的静态 kind 阻塞；若后续实现阶段无法按已接受合同保留正式 surface、fixture 或 evidence，Tasker必须追加 blocked walkthrough 并交回 Leader，不得静默合并或缩减场景。
