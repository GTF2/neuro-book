---
schema: nbook.task/v2
taskId: t01-panel-blank-diagnosis
---

# 定位 Agent 面板空白断点

## 目标与范围

- 复现路径：`/?project=<id>` 干净加载 → 点击标题栏「Agent 助手」→ 面板应占右区且可见；再点一次应收起。
- 机制：每个 Part 的槽内容由 `WorkbenchShellLayout` 的 Teleport 挂到 `[data-leaf="<part>"]` 锚点；锚点缺失（Part 隐藏）时内容留在 `data-shell-parking`（`WorkbenchShellLayout.vue:454-465`）。`WorkbenchShellLayout.test.ts:244-257` 已覆盖 Panel 的隐藏 → 显示搬回。

## 结果

- **干净环境实测通过，面板「打开即见、关闭即收」，本 Work 无需代码改动。**
- 用无头 Chromium（正常 rAF/ResizeObserver 语义）三次读取同一页面：
  - 初始：`aria-pressed=false`、标题「打开 Agent 助手」、`right` 槽在停放区（0×0）。
  - 第一次点击后：`aria-pressed=true`、标题「关闭 Agent 助手」、`[data-leaf="right"]`=400×842，槽已搬进右叶（388×830，含 80 字符内容）。
  - 第二次点击后：回到初始（右叶不占宽、槽回停放区）。
  - 全程 0 页面错误、0 控制台错误；唯一警告是既有 i18n 缺口 `ide.workbench.view.refreshFiles`。
- 此前「面板停在停放区 / 右区空白」的观测来自**冻结的内嵌浏览器**：面板不可见（`document.hidden=true`）时 rAF 与 ResizeObserver 回调都不执行，外壳 `measure()` 拿不到尺寸，`extent` 恒 `0×0` → 投影退化成 compact（诊断「紧凑呈现高度 0px 不足」）→ `right`/`panel` 留在停放区。属降级渲染环境，不是布局/锚点缺陷；w00025 验收（健康环境）面板正常也与此一致。

## 证据

- 探针脚本：`.local/w00027-probe.mjs`（本地草稿，不入库）；命令 `bun .local/w00027-probe.mjs`，输出含上述三段状态与错误摘要。
- 环境侧佐证：同一时刻在内嵌浏览器里 `document.visibilityState=hidden`、`ResizeObserver` 回调不执行、`requestAnimationFrame` 0 帧（`visibility.set(true)` 也无法恢复）。

## 未验证

- 未在「真实可见的内嵌浏览器」里复测（面板当前卡在不可见，无法恢复）；未覆盖存储上下文耗尽后的降级路径与真实拖拽手势。

## 执行位置

无代码改动；未建 worktree/分支。
