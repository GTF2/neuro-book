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

## 根因（2026-10-05 定位）

`WorkbenchViewInstances` 的落点发布**只挂在 `nextTick` 上**，而 `nextTick` 挂在 Vue 的 flush promise
链上。移动视图会触发外壳的递归更新风暴（`Maximum recursive updates exceeded in component
<WorkbenchShellLayout>`），那条链被 reject——合并回调因此**一次都不执行**，`publishScheduled` 停在
`true`，此后所有登记都被第一行的去重挡掉，目标再不发布。

实测证据（浏览器，`__vueParentComponent` 链读实例内部状态）：

```
published["nbook.files"]: connected: false, htmlLen: 23427   ← 实例在脱离文档的旧元素里
targets["nbook.files"]:   connected: true,  htmlLen: 0       ← 新目标已登记、已连通、空
publishScheduled: true                                        ← 卡死
```

即：文件树的 23K DOM 完整渲染在一个**已经不在文档里**的元素上，新位置因此只剩标题。

## 修复

`WorkbenchViewInstances.vue` 三处（与容器实例层 `WorkbenchContainerInstances` 同口径）：

1. **同步发布兜底**：`register` 时若当前 `published` 目标已脱离文档，立即换目标（`publishImmediate`），
   不等那条可能被 reject 的链。只在"旧目标已脱离"这个明确信号下触发——常规登记仍走 `nextTick`
   合并，否则会干扰手势期间的布局结算（实测：无差别同步发布会打破 ViewHost 的两条手势测试）。
2. **去重按发布结果**：`register` 的提前返回同时要求 `published` 已指向该元素，避免"登记表里是它、
   发布里不是"时被误判为重复。
3. **调度自愈**：`nextTick` 的 rejection 复位 `publishScheduled`，一次被吞掉的发布不再永久卡死调度。

## 验证

- **浏览器实测**（`diag` 项目，1440×900）：
  - `nbook.files` 移到右栏：section 文本 2 → **196**，目标 `childCount: 1 / htmlLen: 19251`（修复前为 0）。
  - `nbook.reader` 移到左栏：稿面 417 字符完整保留，`panelLeaf` 跟随到 `left`。
- **回归测试**：`WorkbenchViewInstances.test.ts` 新增「落点脱离文档后重新登记」一条；**已验证它能捕获
  缺陷**（临时禁用同步发布后该条失败，恢复后通过）。
- **既有测试**：`app/components/workbench` + `app/utils/workbench` 748/748 通过。
- `governance:check`：failures / warnings 均空。

## 状态

已修复并验证，待提交合入。
