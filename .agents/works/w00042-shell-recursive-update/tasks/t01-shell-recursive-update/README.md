---
schema: nbook.task/v2
taskId: t01-shell-recursive-update
---

# 定位并修复外壳递归更新风暴

行为合同见 [`docs/specs/ui/workbench-shell.md`](../../../../../docs/specs/ui/workbench-shell.md)：本 Task 只修实现缺陷（渲染期自激），不改变该 Spec 描述的布局、显隐与拖放行为。

## 目标

打开文件时不再抛出 304 条 `Maximum recursive updates exceeded in component <WorkbenchShellLayout>`，且布局行为与基线一致（`layout=split`、7 个叶完整、阅读面板正常渲染、显隐可用）。

## 验收标准（实测口径）

同一探针（`diag` 项目、1440×900、无头 Chromium）三段计数：

1. 加载后 / 展开文件树：0 条警告（基线已满足）。
2. 打开 Markdown 文件：**0 条**（基线 304 条）。
3. 行为三项与基线一致：`data-shell-layout=split`、`[data-leaf]` 含 7 项（含 `right`）、`.reader-panel .prose-page` 文本非空（基线 417 字符）。

## 已排除

- `syncAnchors()` 的写入（打开文件期间调用 0 次）
- `rebuild()` / `measure()`（调用 0 次）
- `ReaderPanelView` 的响应式逻辑（剥离后仍 304 条）
- 停放区 `display:none`（改 `visibility:hidden` 仍 304 条）

## 已定位

自激与停放区（`data-shell-parking`）里那组 `<Teleport :to="targets[part] ?? undefined" :disabled="!targets[part]">` 直接相关：

| 改动 | 警告 | 行为 |
|---|---|---|
| 清空该 `v-for` 的源 | 0 条 | 正常 |
| `:disabled` 固定 `false` | 0 条 | 正常 |
| 移除 `:disabled`（`to` 可为 undefined） | 0 条 | **退化**（compact、内容不渲染） |
| 加 `defer` | 0 条 | **退化**（同上） |
| `parkingReady` 守卫 + 占位元素 | 0 条 | **退化**（同上） |

**关键认识**：插槽内容**必须首渲染就挂载**——否则宿主事实（`rightPartHasVisibleViews` 等）永远为 false，布局塌缩成 compact。因此原实现的「先挂停放区、再搬进叶」不是缺陷，而是**功能前提**；自激是这个必需机制的副作用。

## 已排除（本轮新增）

- 渲染函数反复执行：`onRenderTriggered` 钩子**从未被调用**；DOM 变动仅 83 次，**少于** 304 条警告
- 两段式挂载假设：在 `onMounted` 里提前同步 `syncAnchors` 让 `disabled` 尽早收敛 → 行为不变、仍 304 条
- 微任务链异常：打开文件期间 `Promise.then` 1329 次，属正常量级
- 停放区尺寸：改 `visibility:hidden`、改保留真实尺寸，均仍 304 条

## 待办

1. **换模型**：现有关于自激机制的假设已被逐条推翻（渲染 effect、watcher、两段式挂载、微任务链都不是）。下一步应直接在 Vue 的 `flushJobs` 递归检测点（`RECURSION_LIMIT` 判定处，`node_modules/@vue/runtime-core/dist/runtime-core.esm-bundler.js`）打点，拿到被反复入队的 job 的真实身份（`queue[j].i` 指向的实例与其 effect 类型），而不是从外部行为反推。
2. 设计既消除警告、又保持基线的修法（四个尝试都造成 compact 退化或无效）。
3. 补回归测试（能捕获该警告；参考 `WorkbenchShell.test.ts` 的既有写法）。
4. 全量测试 + 门禁 + 浏览器实测三段计数。

## 验证脚本（可复用）

`.local/w42-verify.mjs`（临时草稿，不入库）：三段计数 + 行为四项（`layout` / 叶数 / 右栏 / 稿面字符数）。

**必须硬重启 dev server 验证**——HMR 对模板结构改动不可靠，本轮多次被 HMR 的脏状态误导（"0 条"的假象出现过两次）。基线（硬重启后）：`afterOpen=304`、`layout=split`、`leafCount=10`、`readerText=417`、`diag=""`。

**进程清理必须按 PID**：先 `netstat -ano | grep ":<port>"` 取 PID，再用 `powershell Get-CimInstance Win32_Process -Filter 'ProcessId=<pid>'` 核实命令行属于本项目，最后 `taskkill /F /PID <pid>`。禁止 `taskkill /F /FI "IMAGENAME eq node.exe"`（2026-10-05 曾两次误杀宿主编辑器）。

## 状态

**进行中（未完成）。** 自激根因未收敛，本轮不交付自激修复。


### 本轮实际交付

`WorkbenchShell.vue` 的 `setLeafVisible` 去重修复：原实现用 `next === hidden.value` 比较数组**引用**，
而两个分支都创建新数组，比较恒为假——去重完全失效，每次都写 `hidden`。改为只在实际变化时写。
这是一处**独立成立的真实缺陷**（宿主 watch 可见视图数 → 调本方法 → 写 `hidden` → 外壳重渲染，
无变化也写会让这个环一直转），但**它不是 304 条警告的来源**（实测：修完仍 304 条）。

配套回归测试 1 条（`WorkbenchShell.test.ts`），已验证能捕获该缺陷（回退修复即失败）。

### 未交付

自激修复。两个试过的方案（`parkingReady` 守卫、占位元素 + 稳定 `to`）都能消除警告，但都造成
**行为退化**（`layout` 从 split 退化为 compact、插槽内容不渲染），已回退。根因未收敛到可解释的
机制前不交付——`targets` 在打开文件时没有变化、`disabled` 也没有切换，该表达式却参与自激。

### 下一步建议

用 **Vue 开发构建**（而非当前的生产构建）复现，`onRenderTriggered` 的 `key`/`type` 在 dev 下可读，
能直接指出是哪个依赖触发了 213 次渲染。或在 `TeleportImpl` 的 `queuePendingMount` / `mountToTarget`
路径打点，验证两段式挂载假设。
