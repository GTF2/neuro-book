---
schema: nbook.work/v1
workId: w00025-agent-panel-restore
issueId: null
---

# Agent 面板恢复挂载

把 Agent 对话面挂回工作台右区，并让右上角「Agent 助手」开关真正控制右区的出现与消失。

## 来源与授权

2026-10-02 开发者报告「右上角那个小机器人，我点了没有反应，不出现 Agent 面板」。主工作区调查：`c4c9cbb3`（#192 阶段 1 步骤 2，2026-09-14）把 `<AgentChatSurface>` 从 `app/pages/index.vue` 模板里摘掉（提交信息原文「原有业务组件暂不挂载（仍在仓库里，未删除）」），此后右区只剩空容器占位；开关翻转的 `agentPanelOpen` 没有任何消费者，右区无论开关都是 388px 空区。

上游把同类问题挂在 issue notnotype/neuro-book#130（open，priority high，「为 Web 工作台提供稳定的 Agent 侧栏入口」），但 `upstream/master` 与全部上游分支都没有挂回，工作台视图注册表里也只有 `nbook.view.files` 一项。

开发者选定「先解封」：把面板挂回右区、开关驱动右区显隐；按提案注册成工作台视图的正路留作后续 Work。

## 范围与非目标

- 只恢复 `AgentChatSurface` 在 IDE 页的挂载与右区叶的显隐；不改 Agent 侧栏内部实现，不改工作台容器/视图注册表。
- 不建立第二套视图通道（descriptor + factory + 落位是后续 Work）。
- 关闭面板的语义保持「右区不占宽度」——除非右区还有别的可见视图（用户把容器搬到了右区），此时叶必须留着。

## 当前 Task

| Task | 当前范围 |
|---|---|
| [t01](tasks/t01-agent-panel-restore/README.md) | 当前：右区挂回 Agent 面 + 开关驱动叶显隐 |
