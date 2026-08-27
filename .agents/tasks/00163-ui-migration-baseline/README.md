---
schema: nbook.task/v1
taskId: 00163-ui-migration-baseline
issueRequired: true
actionIssueId: 191
worktreeId: .worktree/t163-ui-migration-baseline
branchId: test/t163-ui-migration-baseline
status: verifying
createdAt: 2026-08-27T01:37:30Z
updatedAt: 2026-08-27T02:48:05Z
agentWorkflow:
  profile: nbook.agent-skills/v1
  kind: docs
  routes:
    - deprecation-and-migration
    - code-review-and-quality
  verification:
    required:
      - governance-check
      - diff-check
    notRun:
      - check: browser
        reason: 本Task只产出当前源码的静态基线证据，不改变浏览器可见行为
---

# Task 00163：NeuroBook UI Migration Baseline

## 目标

为Issue #191冻结完整非页面SFC清单、最终迁移owner候选和14个preview页面的可观察场景，防止后续实现时删减基线。

## 授权来源

开发者已于`2026-08-27T01:56:46Z`逐项接受本Task的目标、范围、依赖、验收和停止条件；Leader已将Task原地改为`planned`并完成接受留痕，当前可按本合同派发执行。

## 范围

- 扫描`packages/neuro-book/app/components/**/*.vue`；每个SFC恰好登记一次路径、组件名、领域、直接依赖信号、tier候选、最终处置Task C–O及依据。
- 精确盘点14页：workflow、两个world-engine、tsx-profile-editor、subject-state-viewer、structured-text-editor、五个plot、model-settings、dnd、diff-workbench的`*.preview.vue`。
- 每页登记稳定scenario ID、`demo-only | product-behavior`、触发方式、输入/fixture、可观察输出/事件、正式surface候选、源证据和未验证项。
- 输出`evidences/component-sfc-inventory.json`、`evidences/preview-scenario-baseline.json`和Tasker walkthrough。

## 非目标

- 不修改产品源码、Proposal、Spec、测试源码、配置、依赖、lockfile、Task范围或远端Issue/Project。
- 不创建Lab catalog/registry、fixture或preview迁移实现。
- 不把静态推断伪装成运行证据；无法确认的行为标记`inference`或`unverified`。

行为合同未变：本Task只冻结当前源码的静态迁移基线证据，不修改产品行为、数据、接口、状态、失败或安全边界；后续实现仍由p-006与planned Spec建立行为合同。

## 依赖

依赖PR #217治理revision `9e54e5d3`；可与00162并行，文件零重叠。后续A–P实现Task依赖本基线，但本Task不依赖p-006正文完成。

## 验收

- SFC evidence覆盖当前glob全集、路径唯一无缺失；owner冲突单列。
- Preview source集合与14个精确文件相等；每页至少一个scenario，ID全局唯一。
- product-behavior给出正式surface候选或阻塞；demo-only给出确定性Lab fixture需求。
- JSON无用户数据、secret、绝对路径或大段源码；walkthrough记录方法、计数、冲突和未验证项。
- governance与diff检查通过；不运行浏览器或产品测试。

## 停止条件

owner边界无法唯一覆盖SFC，或场景必须通过浏览器/真实API才能判定kind时，保留证据并追加blocked walkthrough，不自行改变产品合同。
