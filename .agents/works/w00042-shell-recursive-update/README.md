---
schema: nbook.work/v1
workId: w00042-shell-recursive-update
issueId: null
---

# 外壳递归更新风暴

修掉打开文件时 `Maximum recursive updates exceeded in component <WorkbenchShellLayout>` 的批量警告（实测 304 条/次）。

## 来源与授权

2026-10-05 开发者按我给出的选项选择了「把那个上游报错彻底根治」（原话「那先按你推荐的去干」）。该警告自 w00028 起存在；w00028 当时结论是「在健康渲染器不可复现」，但本轮在无头 Chromium 上稳定复现——触发条件是**打开文件**（w00028 只测了加载与视口抖动，没测打开文件）。

## 现象

打开任意 Markdown 文件时一次性抛出 304 条 `Maximum recursive updates exceeded in component <WorkbenchShellLayout>`。页面**行为正常**（布局 split、阅读面板渲染、显隐可用），只是控制台刷警告。副作用：w00041 的视图移动缺陷正是被它触发的（异常 reject 了 `nextTick` 链）。

## 已确认的事实（实测）

| 实验 | 结果 |
|---|---|
| 加载页面 / 展开文件树 | 0 条 |
| 打开 Markdown 文件 | **304 条** |
| 禁用停放区（`data-shell-parking`）里那组 `Teleport` | **0 条** |
| 保留 Teleport、把 `:disabled` 固定为 `false` | **0 条** |
| 移除 `:disabled` 属性（`to` 可能为 undefined） | 0 条，但**行为退化**（compact + 内容不渲染） |
| 禁用 `syncAnchors()` 调用 | 仍 305 条 |
| 打开文件期间 `syncAnchors` / `rebuild` / `measure` 调用次数 | **均为 0** |
| 剥离 `ReaderPanelView` 响应式逻辑 | 仍 304 条（排除阅读面板） |
| `onRenderTriggered` 计数 | 213 次触发（触发源 key 在生产构建下不可读） |

**结论**：自激源是停放区那组 `Teleport` 的 `:disabled="!targets[part]"`，且与 `syncAnchors` 的写入无关（它没跑）。固定 `disabled=false` 能消除警告，但直接移除 `disabled` 会让首渲染的 `to` 为 `undefined`、内容不挂载，行为退化。

## 未解决

- **根因未收敛到可解释的机制**：`targets` 在打开文件时没有变化，`disabled` 的表达式求值却参与自激。Vue 源码里的 `pendingMounts` / 两段式挂载路径（`runtime-core` 的 `TeleportImpl`）是嫌疑，但未取得决定性证据。
- 试过的两个修法（`parkingReady` 守卫、占位元素 + 稳定 `to`）都能消除警告，但**都造成行为退化**（`layout` 从 split 退化为 compact、内容不渲染），已回退。

## 范围与非目标

- 修外壳的递归更新警告，不改变布局与显隐的可观察行为（基线：`layout=split`、阅读面板渲染、7 个叶完整）。
- 不动上游热区；修复保持局部、可替换。

## 当前 Task

| Task | 当前范围 |
|---|---|
| [t01](tasks/t01-shell-recursive-update/README.md) | 进行中：根因未收敛，自激修复待续 |
