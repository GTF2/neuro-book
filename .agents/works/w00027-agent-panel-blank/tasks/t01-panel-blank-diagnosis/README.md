---
schema: nbook.task/v2
taskId: t01-panel-blank-diagnosis
---

# 定位 Agent 面板空白断点

## 目标与范围

- 复现路径：`/?project=<id>` 干净加载 → 真实点击（`tab.cua.click` 坐标点击，合成点击无效）标题栏「Agent 助手」→ 面板应占右区且可见。
- 已确认的机制：每个 Part 的槽内容由 `WorkbenchShellLayout` 的 Teleport 挂到 `[data-leaf="<part>"]` 锚点；锚点缺失（Part 隐藏）时内容留在 `data-shell-parking`（`WorkbenchShellLayout.vue:454-465`）。`WorkbenchShellLayout.test.ts:244-257` 已覆盖 Panel 的隐藏 → 显示搬回，机制在单测里成立。
- 待确认：曾观测到「右区叶已占宽 444px、槽内容仍在停放区」——需判定是布局/锚点同步问题，还是存储上下文耗尽（见阻塞）后的降级表现。

## 阻塞与未验证

- 2026-10-02 现场：反复加载把服务端存储访问上下文打满（`STORAGE_ACCESS_CONTEXT_CLIENT_LIMIT = 32`、空闲 30 分钟才回收、客户端无页面卸载释放路径），页面出现「暂时无法建立新的存储连接，请稍后重试」，随后标签页主线程卡死；ZCode 内置浏览器在多次卡死后所有 tab 命令超时（连 `/api/novels` 都打不开），实测中断。
- 需要：ZCode 重启或内置浏览器恢复后重做干净复现。若干净环境下面板可见且可交互，本 Task 记为「降级态表现」并关闭。

## 执行位置

尚未开始代码改动；复现确认后再按需建 worktree（改动预计落在 `app/pages/index.vue` 与 `app/components/workbench/*`，保持最小 hunk）。
