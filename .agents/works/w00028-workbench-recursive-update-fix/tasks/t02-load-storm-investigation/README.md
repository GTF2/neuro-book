---
schema: nbook.task/v2
taskId: t02-load-storm-investigation
---

# 加载期递归更新风暴：定位与处置

## 目标与范围

- 复核 w00028 剩余项：页面加载期的 `Maximum recursive updates exceeded in component <WorkbenchShellLayout>`（旧记录：每次加载约 203 条）与 `syncAnchors` 自激渲染。
- 手段：worktree 临时插桩（rebuild 原因与输入签名、`onRenderTriggered`/`onRenderTracked`、computed 求值与触发计数、Vue 递归警告计数、渲染次数）；定位后做最小附加式修复，插桩提交前移除。

## 结果

- **旧记录的 203 条递归更新警告在健康渲染器上不可复现**。三次探针（仓库自带 playwright + 本地 chromium 无头，1440×900）：
  1. 首次加载：`layout=split`、0 条递归警告、0 页面错误，仅 5 条既有 i18n 警告（`ide.workbench.view.refreshFiles`）。
  2. 带已保存布局的二次加载：同上。
  3. 视口抖动（1200×800 → 1600×1000 → 1024×700 → 1440×900）：同上。
- 内嵌浏览器（IAB）当前**面板不可见**：`document.hidden=true`，rAF 与 ResizeObserver 回调均不执行 → 页面冻结在 `extent 0×0` 的降级 compact 模式（诊断「紧凑呈现高度 0px 不足」）。这与 w00027「面板空白」同源：是渲染环境冻结，不是布局缺陷；页面可见后会自愈。旧记录的风暴也只在当时 IAB 的降级状态下被观测到。
- 插桩暴露的真实自激点（已最小修复）：`syncAnchors()` 每次 rebuild 都换新 `targets` 对象——即使 7 个落点元素完全没变，也因为 `targets` 同时是本组件渲染的依赖，让整棵槽内容白白重渲染一次。

## 证据

- 修复提交：`35195573`（`WorkbenchShellLayout.vue`，+11/-1；落点逐个比对，全部相同就不写 `targets`）。
- 渲染计数 A/B（同一套插桩下、无头 Chromium）：首次加载 renders 42 → 32；二次加载 36 → 29；视口抖动后 48 → 37；`render-tracked` 依赖读 16426 → 12733（约省 3.7k 次）。
- 结构复核（探针 4）：split(1440×900) → compact(420×560) → split 三次切换，`mismatched=[]`（7 个 `[data-shell-slot]` 全部落在对应 `[data-leaf]` 锚点或停放区），`data-layout-diagnostics` 空，0 递归警告、0 错误。
- 聚焦测试：`app/components/workbench` 13 文件 / 117 测试，116 通过；唯一失败 `WorkbenchPartHost.test.ts`「容器移动菜单」为既有基线（未改动 master 同样失败）。
- 探针脚本：`.local/storm-probe{,2,3,4}.mjs`（本地草稿，不入库）。

## 未验证

- 真实可见的 IAB 会话未复测（面板当前不可见且无法恢复）；旧 203 条警告因此无法直接对照「消失」。
- 无头探针覆盖 split/compact 布局与视口抖动，未覆盖真实拖拽手势与文件树点击。

## 执行位置

`.worktree/w00028-workbench-recursive-update-fix`，分支 `fix/w00028-workbench-recursive-update-fix`。
