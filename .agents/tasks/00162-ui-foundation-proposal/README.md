---
schema: nbook.task/v1
taskId: 00162-ui-foundation-proposal
issueRequired: true
actionIssueId: 191
worktreeId: .worktree/t162-ui-foundation-proposal
branchId: docs/t162-ui-foundation-proposal
status: completed
createdAt: 2026-08-27T01:37:30Z
updatedAt: 2026-08-27T04:28:19Z
agentWorkflow:
  profile: nbook.agent-skills/v1
  kind: design
  routes:
    - documentation-and-adrs
    - spec-driven-development
    - code-review-and-quality
  verification:
    required:
      - docs-check
      - governance-check
      - diff-check
    notRun:
      - check: browser
        reason: 本Task只落盘架构Proposal和Task报告，没有浏览器可见表面
---

# Task 00162：NeuroBook UI Foundation Proposal

## 目标

把开发者已批准的Issue #191 UI Foundation方案无语义漂移地落为p-006，完成`reviewing -> accepted`文档门禁，为后续planned Spec和实现Task提供唯一决策依据。

## 授权来源

开发者已批准`local://issue-191-ui-lab-migration-plan.md`，并在当前对话要求Leader按最新治理规范使用Issue #191统筹、派发多个扁平Task。该批准覆盖本Task的本地可逆设计文档编辑、验证和本地提交；不授权push、PR、Issue/Project写入、合并、发布或部署。

## 范围

- 创建p-006，先以`reviewing`写完整Proposal；结构检查和逐项语义核对后改为`accepted`。
- 记录问题、目标/非目标、当前证据、方案、备选与取舍、数据/接口/安全/迁移/发布/回滚影响、目标Spec和日期决策记录。
- 固定已批准决策：nb-ui目标许可证为AGPL且允许Product分发；公开colorway为`system | nbook-light | nbook-dark`；nbook目标变量与macOS逐项相等但Product不装macosTheme；主应用显式导入且不启用nb-ui Nuxt module；Global Config是唯一持久化配色authority；认证显式配色刷新允许system首帧后一次纠正；Lab仅Source Dev且Product无Lab资产；14个preview场景先迁移再删；Workbench/View Host等不在Issue #191。

## 非目标

- 不创建或修改Spec、Issue/Project、产品源码、测试源码、配置、依赖、lockfile或生成物。
- 不重新决定已批准取舍，不实现Issue #191。
- 不执行push、PR、合并、发布、部署、浏览器人工验收或真实Provider/Model。

行为合同未变：本Task只记录已批准的Proposal，不修改现有产品行为、数据、接口、状态、失败或安全边界；后续实现必须先由planned Spec建立行为合同。

## 验收

- p-006从`reviewing`完成结构检查和逐项语义映射后成为`accepted`。
- 明确当前事实与目标状态：nb-ui当前仍为PolyForm，nbook colorways当前仍未与macOS深相等。
- 链接Issue #191并声明后续目标capability为`ui.component-contracts`、`ui.component-lab`及原地更新的`theme.system`。
- docs、governance和diff门禁通过；实际结果写入Tasker walkthrough。

## 停止条件

批准方案与仓库现状出现无法消除的语义冲突，或必须新增产品取舍、Spec、业务代码、远端写入时，追加blocked walkthrough交回Leader。

## 设计类型

架构方案

## 设计产物

- `docs/proposals/p-006-neurobook-ui-foundation.md`

## 决策范围

只核对已批准方案与当前仓库事实并消除文案歧义；不得新增或改变产品结果。出现两个以上合理解释时停止并提交唯一待决问题。

## 允许文件

- `docs/proposals/p-006-neurobook-ui-foundation.md`
- `.agents/tasks/00162-ui-foundation-proposal/walkthroughs/001-tasker-ui-foundation-proposal.md`
