---
schema: nbook.work/v1
workId: w00042-shell-recursive-update
issueId: null
---

# 外壳递归更新风暴

修掉打开文件时 `Maximum recursive updates exceeded in component <WorkbenchShellLayout>` 的批量警告（实测 304 条/次）。

## 来源与授权

2026-10-05 开发者按我给出的选项选择了「把那个上游报错彻底根治」（原话「那先按你推荐的去干」）。该警告自 w00028 起存在；w00028 当时结论是「在健康渲染器不可复现」，但本轮在无头 Chromium 上稳定复现——触发条件是**打开文件**（w00028 只测了加载与视口抖动，没测打开文件）。

## 现象与根因

打开任意 Markdown 文件时一次性抛出 304 条 `Maximum recursive updates exceeded in component <WorkbenchShellLayout>`。页面**行为正常**（布局 split、阅读面板渲染、显隐可用），只是控制台刷警告。副作用：w00041 的视图移动缺陷正是被它触发的（异常 reject 了 `nextTick` 链）。

根因（打点 + 最小复现实证）：`useEditorWorkbench` 的 `runtimes` 是深响应式容器，读出的 `runtime.handle` 是代理，`bindViewHandle` 的守卫 `runtime.handle === handle` **恒为假** → 视图每次发布都完整重绑（写 `actions=[]`）并与 `setActions`（写回 actions）交替写同一响应式键 → `<WorkbenchShellLayout>` 的渲染 job 被入队 265 次、突破 Vue 递归上限，每条后续 flush 报一条、累计 304 条。

## 已确认的事实（实测）

| 实验 | 结果 |
|---|---|
| 加载页面 / 展开文件树 | 0 条 |
| 打开 Markdown 文件（修复前） | **304 条** |
| 打点超限 job 身份 | `WorkbenchShellLayout` 渲染 job，入队 265 次 |
| 60 帧入队栈 | 交替命中 `bindViewHandle`（清空 actions）与 `setActions`（写回 actions） |
| 最小语义复现（node） | 代理读出 `read === handle` 假、`toRaw(read) === handle` 真 |
| 修复后打开 Markdown 文件 | **0 条** |

早期排查排除了：停放区 Teleport 的 `:disabled` 表达式（修 `disabled` 只是改了写入时序，不是源）、`syncAnchors`/`rebuild`/`measure`（打开文件期间调用 0 次）、`ReaderPanelView` 响应式、停放区尺寸与两段式挂载假设。另修出一处独立缺陷：`WorkbenchShell.vue` 的 `setLeafVisible` 数组引用比较恒假导致去重失效（真实缺陷，非警告来源）。

## 范围与非目标

- 修外壳的递归更新警告，不改变布局与显隐的可观察行为（基线：`layout=split`、阅读面板渲染、7 个叶完整）。
- 不动上游热区；修复保持局部、可替换。

## 当前 Task

| Task | 当前范围 |
|---|---|
| [t01](tasks/t01-shell-recursive-update/README.md) | 已交付并合入：根因定位（深响应式代理上句柄身份守卫恒假）+ 修复 + 回归测试；另修 `setLeafVisible` 去重失效（fcdd8da2） |

## 收尾

已收尾：df147204；待清理：.worktree/w00042-shell-recursive-update、fix/w00042-shell-recursive-update

## 已知既有缺陷（非本 Work 范围）

全量测试退出码 1 由 22 条 `ReferenceError: DOMMatrix is not defined` 未处理错误造成（`packages/nb-ui/src/components/controls/Dropdown.vue:99`，jsdom 无 `DOMMatrix`）。stash 基线对照确认与 w00042 无关、在无改动基线稳定复现。测试全部通过，仅退出码受影响；未登记独立 Work。
