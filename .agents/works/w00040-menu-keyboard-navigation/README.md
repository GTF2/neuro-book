---
schema: nbook.work/v1
workId: w00040-menu-keyboard-navigation
issueId: null
---

# 菜单键盘导航与禁用原因修复

`MenuNodes`（nb-ui 菜单项渲染的共用件）在重构后改用原生 `<button>`，脱离了 reka-ui 的焦点管理体系：键盘导航（ArrowDown 进首项、循环跳过禁用项、Escape 归位）与子菜单的焦点展开全部失效；同时 `DropdownItem.title`（禁用原因）从未绑定到 DOM，用户看不到「为什么禁用」。

## 来源与授权

2026-10-05 排查 w00039 的 6 条既有失败时定性发现。原判断为「测试模型失真」，实测推翻：**禁用状态本身正确**（原生 `disabled` 生效），失败的是键盘导航与 `title` 传递两条真实能力。开发者授权「剩下你能干的，你先干了」——本 Work 只登记与已确认的最小修复，键盘导航的完整修复待开发者确认范围。

## 范围与非目标

- 已修：`MenuNodes` 绑定 `item.title`（禁用原因进 DOM）；两处测试断言从 radix 的 `data-disabled` 改为原生 `disabled` 口径。
- 待定：键盘导航（roving focus）与子菜单焦点展开的恢复。
- 非目标：不改菜单的视觉、不重写 `useMenuCascade`、不动 `Dropdown` 的浮层定位。

## 影响面

`MenuNodes` 被三个组件共用：`Dropdown`（含产品标题栏菜单）、`Menubar`、`ContextMenuPanel`（右键菜单）。缺陷对三者的键盘路径同时生效。

## 根因

上游 `0afe7c69`「统一多级菜单的级联状态与渲染」把菜单项从 reka-ui 的 `DropdownMenuItem` 换成原生 `<button>`，reka 的 roving-focus 不再管理这些项。`MenuNodes` 只绑了 `@pointerenter`/`@mouseenter`，没有 `@focus`，因此：

- `ArrowDown` 从触发器进菜单时焦点不落到第一项；
- 菜单项之间的 `ArrowDown`/`ArrowUp` 循环、跳过禁用项失效；
- 父项靠**焦点**展开子菜单的路径失效（鼠标路径正常）。

## 当前 Task

| Task | 当前范围 |
|---|---|
| [t01](tasks/t01-menu-keyboard-navigation/README.md) | 当前：定性 + 最小修复（title 绑定、断言口径） |
