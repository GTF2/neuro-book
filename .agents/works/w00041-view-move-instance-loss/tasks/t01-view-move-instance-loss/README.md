---
schema: nbook.task/v2
taskId: t01-view-move-instance-loss
---

# 定位并修复视图移动后实例丢失

行为合同见 [`docs/specs/ui/workbench-shell.md`](../../../../../docs/specs/ui/workbench-shell.md)：该 Spec 明确「保留既有业务入口与业务数据权威，不因容器移动、合并、模式切换销毁视图实例」，本 Task 修的是实现偏离该合同的部分，不改变合同本身。

## 目标与范围

修掉「工作台视图移动到另一个 Part 后内容空白」：移动本身已生效（叶、容器模式、位置记录都对），但视图实例没有挂载到新位置。

## 复现步骤

1. 起 Source Dev，进一个有内容的 Project，打开任意 Markdown 章节（让文件树与阅读面板都有内容）。
2. 在文件树标题的「更多」里选「移动到 → Agent」（或拖动其标题到右栏）。
3. 观察：`view:nbook.files` 叶出现在右栏、容器变 `multiple`，但 section 内只剩标题，文件树内容整体消失，且不随时间恢复。

## 已知事实

- 复现稳定，20 秒内多次采样不恢复。
- 同容器里的 `nbook.reader` 正常——它在移动**前**就在右栏（不是「移动已有实例」路径）。
- 移动的判定、提交、位置记录都正常（叶与容器模式已按预期变化）。
- 相关实现：`WorkbenchPartHost.vue`（容器挂载点与实例泊车）、`WorkbenchViewInstances.vue`（实例层与 Teleport）、`WorkbenchContainerInstances.vue`。

## 验证要求

- 修复后重跑复现步骤：移动后内容在**新位置**正常渲染，且原位置不再残留。
- 对照既有测试：`app/components/workbench/*` 全绿（不得引入新失败）。
- 若根因在实例层，补一条能捕获该缺陷的回归测试（移动后实例仍挂载）。

## 状态

待定位。
