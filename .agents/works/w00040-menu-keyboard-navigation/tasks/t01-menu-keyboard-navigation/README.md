---
schema: nbook.task/v2
taskId: t01-menu-keyboard-navigation
---

# 菜单键盘导航缺陷：定性与最小修复

行为合同见 [`docs/specs/ui/workbench-shell.md`](../../../../../docs/specs/ui/workbench-shell.md)：菜单的 enabled / disabled 与键盘可用性属外壳交互合同；本 Task 只修实现与测试口径，不改合同本身。

## 目标与范围

定性 6 条既有失败中属于菜单体系的那 4 条，修掉其中口径明确的部分，把需要跨包改动的部分如实登记。

## 定性结论（2026-10-05）

排查起点是 w00039 交付时观察到的 6 条既有失败。逐条实测后分为两类：

**口径失真（已修）**：

- `DesktopTitleBar`「没有桌面 bridge 也画标题栏…」与 `DesktopTitleBarChrome`「浏览器里的粘贴画成禁用…」：断言查 `data-disabled` / `aria-disabled`，但 `MenuNodes` 早已改用原生 `<button :disabled>`。禁用状态**本身完全正确**（实测 `disabled=true`、`hasAttribute("disabled")=true`），断言口径落后于实现。
- 同一处暴露第二个缺陷：`DropdownItem.title`（类型注释写明「原生 title 提示（如禁用原因）」）从未绑定到 DOM，导致「请用 Ctrl+V」这类禁用原因用户看不到。已在 `MenuNodes` 绑定 `:title="item.title"`。

**真实产品缺陷（已修）**：

- `DesktopTitleBar`「键盘进标题栏后 Edit 六条仍可用…」、`DesktopTitleBarChrome` 两条键盘用例、`WorkbenchPartHost`「容器移动菜单…」：根因是上游 `0afe7c69` 把菜单项换成原生 `<button>` 后脱离 reka-ui 的 roving-focus。`MenuNodes` 只绑 `pointerenter`/`mouseenter`，没有 `focus`，因此键盘进菜单不落焦、项间不循环、父项不能靠焦点展开子菜单（鼠标路径正常）。

## 验证

- 修复前：3 个文件 6 条失败。
- 修复后：40/40 全通过。
- nb-ui 526/526（含原 `grid-splitter` 基线失败转绿——它被同一处焦点抢占影响）；产品侧 `app/components` + `app/utils/workbench` 1347/1347。
- 实测证据：`resolveTitleBarMenuGroups({editTarget:"none"})` 直调全禁用；组件渲染项 `disabled=true`、标签 `BUTTON`。

## 落地内容

- `MenuNodes` 自建 roving-focus：ArrowDown/ArrowUp 项间移动（跳过禁用项、两端循环）、Home/End 直达首尾、焦点落到父项展开子菜单。层级定位按父容器收本层项，避免把子菜单的项混进来。
- `Dropdown` 在内容容器接住「打开即聚焦容器」的焦点并转交首项。
- `MenuNodes` 绑定 `item.title`，禁用原因重新可见。
- 两处产品测试断言改为原生 `disabled` 口径。

## 待办

无。三个消费者（Dropdown / Menubar / ContextMenuPanel）共用 `MenuNodes`，修复对三者同时生效；各自的既有测试均通过。
