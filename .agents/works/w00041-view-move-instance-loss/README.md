---
schema: nbook.work/v1
workId: w00041-view-move-instance-loss
issueId: null
---

# 视图移动后内容丢失

把工作台视图从原容器移动到另一个 Part 后，视图实例不挂载——新位置的容器只剩标题，内容区空白。

## 来源与授权

2026-10-05 w00039 的移动能力端到端验证中发现，并在 `nbook.files`（既有视图，与 w00039 无关）上做了对照复现。开发者此前对同类工作台缺陷的要求是「这个还是要修的」（见 w00028 来源），本轮授权为「剩下你能干的，你先干了」。

## 现象与证据

复现（`probe` 项目，1440×900，无头 chromium）：

- 打开 `manuscript/.../index.md`，文件树（`nbook.files`）正常显示，`textLen: 194`。
- 用文件树标题的「更多 → 移动到 → Agent」把它移到右栏。
- 移动**生效**：`view:nbook.files` 叶出现在右栏，`data-container-mode` 从 `single` 变 `multiple`。
- 但内容**消失**：section 内 `textLen` 从 194 掉到 **2**（只剩标题「文件」），`[data-container-content="nbook.tools"]` 在整页消失。
- 20 秒内 4 次采样（2s/6s/12s/20s）**均未恢复**，不是渲染时序问题。
- **同容器对照**：同一右栏容器里的 `nbook.reader`（w00039 新增，移动前在右栏、移动后仍正常）`textLen: 427`，稿面完整——差异在「移动已有实例」这条路径，不在新挂载。

## 范围与非目标

- 修「视图移动后实例未挂载」这条路径，让内容跟着视图走。
- 不改移动的判定与提交逻辑（落点求值、位置记录、菜单与拖动入口都正常）。
- 不重构容器实例层与 Teleport 机制，除非缺陷根因就在那里。

## 当前 Task

| Task | 当前范围 |
|---|---|
| [t01](tasks/t01-view-move-instance-loss/README.md) | 已交付并合入：根因定位（`nextTick` 发布链被上游异常中断）+ 三处修复 + 回归测试 |

已收尾：f3d9df6f；待清理：无（2026-10-06 核实清理完成：worktree 与分支均已删除）。
