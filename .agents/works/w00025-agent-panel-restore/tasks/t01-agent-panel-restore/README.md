---
schema: nbook.task/v2
taskId: t01-agent-panel-restore
---

# 右区挂回 Agent 面并让开关生效

## 目标与范围

- `app/pages/index.vue` 右区叶：Agent 面板打开时挂载 `<AgentChatSurface>`（沿用被摘掉那段的 props：`active` / `layout="drawer"` / `novel-id` / `project-ready-revision` / `history-inbox-refresh-key` / `selected-file-path` / `open-reference` 与三个 emit），脚本侧接线本就在仓库里。
- 右区叶显隐：`setLeafVisible("right", ...)` 从「非书架态恒显示」改成「Agent 面板打开、或右区仍有可见视图」；右区空容器不再占 388px。
- 工作台容器宿主只在右区确实有可见视图时渲染，避免与 Agent 面争同一列。

## 非目标

- 不做工作台视图注册（descriptor + factory + 默认落位），不新增 Activity Bar 入口。
- 不改窄屏（< 800）堆叠规则——那由 `WorkbenchShell` 持有，本次只按它的既有拓扑落位。

## 证据

- 单测：`app/utils/workbench/product-catalog.test.ts` 33 通过（新增 1 条「叶的显隐事实按可见视图数」：Project 未打开时容器仍在切片里但可见视图为 0，右区默认 0）。受影响套件 `test workbench` 71 文件 / 983 测试：982 通过、1 失败；失败项 `WorkbenchPartHost.test.ts`「容器移动菜单」在未改动的 master 上同样失败（主工作区实测 1 failed / 20 passed），属既有基线。
- typecheck：与 master 基线逐文件一致（30 条既有错误：`tracked-workspace-files.ts` 22、`AgentExtraPanels.scenes.ts` 4、`batch.post.ts` 3、`fixtures/index.ts` 1），本次零新增。
- 浏览器实测（worktree dev server，真实 Project `xin-xiao-shuo`，1280×720）：
  - 默认态：右区叶停在停放区，页面只剩 `left`（328px）与折叠的 `panel`，编辑区拿到全部剩余宽度；不再有 388px 空容器占位。
  - 点右上角「Agent 助手」：`aria-pressed=true`、标题变「关闭 Agent 助手」，右区叶 388px@x=876 挂出 `AgentChatSurface`（会话头「未命名对话 / 主创」、空态推荐指令、按钮组：新建对话、Session 附件、关联 Agent、Session Tree、查看 System Prompt、Session 列表、关闭、选择模型、选择图片、展开大文本编辑），编辑区 869→468px。
  - 点面板内「关闭」：叶回停放区，`aria-pressed=false`，编辑区 468→869px；两次切换期间无 console error、无 unhandled rejection。
  - 输入框为 `role="textbox"`、`aria-label="新建对话后即可输入消息"`、`contenteditable="false"`：未建会话时按设计禁用。

## 未验证

- 未实测发消息链路：Provider 还没有已保存模型（会话栏显示「选择模型...」），发送要等开发者先加模型并选默认。
- 未在 390px 窄屏复核（右区叶在窄屏按 `WorkbenchShell` 的既有堆叠规则落位）。
- 未验证「用户把容器搬到右区」时面板与容器宿主叠放的实际观感（规则上两者都会渲染）。

## 执行位置

`.worktree/w00025-agent-panel-restore`，分支 `fix/w00025-agent-panel-restore`。
