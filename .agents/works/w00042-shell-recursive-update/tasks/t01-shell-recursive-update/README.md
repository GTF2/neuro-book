---
schema: nbook.task/v2
taskId: t01-shell-recursive-update
---

# 定位并修复外壳递归更新风暴

行为合同见 [`docs/specs/ui/workbench-shell.md`](../../../../../docs/specs/ui/workbench-shell.md)：本 Task 只修实现缺陷（响应式写入自激），不改变该 Spec 描述的布局、显隐与拖放行为。

## 目标

打开文件时不再抛出 304 条 `Maximum recursive updates exceeded in component <WorkbenchShellLayout>`，且布局行为与基线一致（`layout=split`、7 个叶完整、阅读面板正常渲染、显隐可用）。

## 状态

**已修复，实测通过（待提交/合入）。** 根因已收敛到可解释机制：编辑工作台编排层的**句柄身份守卫在深度响应式代理上恒假**。

## 根因（实测证据）

`useEditorWorkbench.ts` 的 `runtimes` 是 `reactive({})` 深代理容器，**从中读出的 `runtime.handle` 是原句柄的代理**。`bindViewHandle` 的守卫 `runtime.handle === handle` 因此恒为假：

1. 视图每次发布（`EditorViewHost.publish`）都上报句柄，守卫放行 → 完整重绑：写 `runtime.actions = []`；
2. `setActions` 紧随其后写回 `runtime.actions = actions`；
3. 两处交替写同一响应式键 → 挂 `WorkbenchShellLayout` 实例的渲染 job 被反复入队 **265 次**，突破 Vue `RECURSION_LIMIT`（100）→ 每次 flush 报一条，共 **304 条**。

证据（Vue 内部打点 + 语义复现）：

- 打点超限 job：`componentName=WorkbenchShellLayout`、`jobKind=render`、`enqueues=265`；60 帧入队栈交替命中 `bindViewHandle`（写 `actions=[]`）与 `setActions`（写回 actions），触发源为 `EditorViewHost` 的 pre-watch → `publish`。
- 最小语义复现（node + vue）：`runtimes.g.handle = handle` 后 `read === handle` 为 **false**、`toRaw(read) === handle` 为 **true**。
- 页面行为在警告风暴期间始终正常（`layout=split`、`proseLength=417`），304 条是同一超限 job 在后续每次 flush 重复上报。

## 修法

`packages/neuro-book/app/composables/useEditorWorkbench.ts`：`bindViewHandle` 的身份守卫改为 `toRaw(runtime.handle) === toRaw(handle)`，并注释说明代理身份陷阱；重复上报成为免操作，不再清空已上报动作。

回归测试：`packages/neuro-book/app/composables/useEditorWorkbench.test.ts` 新增「同一实例重复上报句柄是免操作，不清空已上报动作」。有效性已验证：临时回退守卫（改回直接比较）该测试失败，恢复后通过。

## 验收结果（本轮实测）

- 探针三段计数（`diag` 项目、1440×900、无头 Chromium，硬重启 dev server）：加载 0 条；展开文件树 0 条；**打开 Markdown 文件 0 条（基线 304）**。
- 行为三项与基线一致：`data-shell-layout=split`、`[data-leaf]` 10 项含 `right`、`.reader-panel .prose-page` 文本 417 字符（内容相同）、`diag=""`。
- 定向测试：`bun run test -- app/components/editor-workbench app/components/workbench app/composables` 40 文件 / 325 测试全过。
- 全量测试：579 文件通过 / 4952 测试通过 / 3 跳过。另有 22 条 `ReferenceError: DOMMatrix is not defined` 未处理错误（来源 `packages/nb-ui/src/components/controls/Dropdown.vue:99` 的 jsdom 环境缺口，`DesktopTitleBar(.Chrome).test.ts` 运行时触发），已用 stash 基线对照确认与本次改动无关、稳定复现于无改动基线，导致全量退出码为 1。
- `bun run typecheck`：输出 30 条 error 全部在基线既存文件（component-lab fixtures 与 server 侧），与本次改动文件零重叠。

## 未验证边界

- 仅覆盖「打开 Markdown 文件」路径；其他会触发同类重绑的交互（切标签、移动视图）未逐项复测，但共用同一守卫。
- `reactive` 容器读代理是 Vue 的固有语义，`toRaw` 比较是标准解法；如未来 `handle` 换成 `shallowRef` 存放，此守卫仍成立。

## 验证脚本（可复用，不入库）

`.local/w42c-debug/w42-verify.mjs`：三段计数 + 行为四项。**必须硬重启 dev server 验证**（HMR 对模板/组合函数改动不可靠）。

**进程清理必须按 PID**：`netstat -ano | grep ":<port>"` 取 PID → `powershell Get-CimInstance Win32_Process -Filter 'ProcessId=<pid>'` 核实命令行 → `taskkill /F /PID <pid>`。禁止按镜像名批量杀（曾两次误杀宿主编辑器）。

## 下一步

提交到 worktree 分支 `fix/w00042-shell-recursive-update`，只暂存两个改动文件与 Work/Task 文档。
