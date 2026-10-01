---
schema: nbook.task/v2
taskId: t01-connection-identity-edit-window
---

# 连接身份编辑窗口

## 目标与范围

本次设置会话中新建的 Provider（克隆连接或从模板添加）在会话内保持 `id` / `baseURL` / `代理` 可编辑，即使它已经被自动保存并获得 `sourceIndex`。

## 实现

`ModelSettingsProviderDraft` 增加可选 `connectionIdentityDraft`；`useModelSettingsDraftSession` 用 `localKey` 集合登记本次会话新建的 Provider，`cloneProvider()` 在每次从服务端快照重建草稿时按该集合复原标记；`cloneActiveProviderConnection()` 与 `useProviderTemplateSession.addProvider()` 各自登记；`ModelProviderDetail.vue` 把只读判定拆成「已保存」与「身份已定稿」两件事，只有后者锁字段，克隆按钮的可见条件仍按「已保存」。

改动文件：`provider-settings-draft.ts`、`useModelSettingsDraftSession.ts`、`useProviderTemplateSession.ts`、`useProviderSettingsBinding.ts`、`ModelProviderDetail.vue`，以及后两者的同名测试。

## 非目标

- 不改 `sourceIndex` 的持久化语义与配置合同字段。
- 不改变长期行为：会话结束（重开设置窗口或刷新页面）后，已保存 Provider 的身份重新只读。
- 不调整 `modelApi`、API Key 等字段的只读策略（它们本来就可编辑）。
- 不引入显式保存按钮，不改变自动保存策略。

## 证据（worktree 内实跑）

- `bun run --cwd packages/neuro-book test app/components/novel-ide/settings` → 19 文件 / 113 用例通过。
- 回归用例「回退即失败」：临时让 `cloneProvider()` 不还原标记后，克隆用例精确失败在 `connectionIdentityDraft` 缺失上；恢复后通过。
- typecheck 与 master 基线逐条一致：worktree 与主工作区（干净 master）各 `exit 2`、30 条错误，规范化后 `diff` 为空。这 30 条是 master 既有失败，位于 `app/component-lab/fixtures/AgentExtraPanels.scenes.ts`、`app/component-lab/fixtures/index.ts`、`server/api/workspace-files/batch.post.ts`、`server/workspace-history/tracked-workspace-files.ts`，与本改动无关。

## 未验证

- 未在浏览器里实跑克隆后的输入（worktree 未启动服务），可编辑判定依据是组件 computed 与草稿数据。
- 未验证真实中转站 Provider 的连通性、模型发现与后续写作链路。

## 执行位置

`.worktree/w00021-provider-connection-identity-edit`，分支 `fix/w00021-provider-connection-identity-edit`。本轮改动未提交。
