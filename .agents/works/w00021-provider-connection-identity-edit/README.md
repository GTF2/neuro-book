---
schema: nbook.work/v1
workId: w00021-provider-connection-identity-edit
issueId: null
---

# Provider 连接身份编辑窗口

修复「克隆连接或从模板添加 Provider 后立刻被自动保存，连接身份字段随即锁死」的缺陷：本次设置会话中新建的 Provider，在会话内保持 `id` / `baseURL` / `代理` 可编辑；会话结束后恢复为既有的只读语义。

## 来源与授权

2026-10-02 开发者在 fork（GTF2/neuro-book）接入中转站 Provider 时发现设置页无法修改 API Base，克隆连接后同样改不动。开发者要求本地立分支自行修复，不向上游提 PR。

根因（主工作区调查）：`useProviderSettingsBinding.ts` 的 `onClone-provider-connection` 与 `onAdd-provider` 在创建草稿后立即调用 `scheduleSave()`，500ms 防抖写回后 `saveResult()` 用服务端快照重建草稿，`cloneProvider()` 给每个 Provider 带上 `sourceIndex`，而 `ModelProviderDetail.vue` 以 `sourceIndex !== undefined` 判定身份只读。

实现与设计意图冲突的证据：`cloneActiveProviderConnection()` 注释写「用户确认后再单独保存」，但实现没有确认步骤；`useProviderTemplateSession.addProvider` 注释记录了「用户在设置里改不回来」，只对 `modelApi` 做了兜底，`baseURL` 未处理。

## 范围与非目标

- 只改设置页前端草稿模型与 Provider 详情视图的只读判定。
- 不改配置合同、服务端写入、Secret 处理，也不放弃「已保存 Provider 的连接身份默认不可变」这一长期语义。
- 不引入显式保存按钮，不改变自动保存策略，不调整 Provider id 在其他模块的引用规则。

## 当前 Task

| Task | 当前范围 |
|---|---|
| [t01](tasks/t01-connection-identity-edit-window/README.md) | 已实现并验证，随 `3b5d566a` 合入 master |
| [t02](tasks/t02-connection-identity-save-contract/README.md) | 已实现并验证：把「身份未定稿」声明接到保存契约，并放行会话新建 Provider 的改名守卫 |
| [t03](tasks/t03-model-discovery-dialog-entry/README.md) | 已实现并验证：窗口打开与勾选加入经无头探针实测（详见 t04 的验收记录） |
| [t04](tasks/t04-candidate-confirm-writeback/README.md) | 当前：修复候选模型「确定」后成功提示与落盘不一致 |

2026-10-02 开发者使用中转站 Provider 时发现 t01 只解锁了界面，保存仍被服务端身份守卫拒绝（`连接身份不可修改（Base URL 或代理已变化）`），要求继续修通，并选定「保留身份不可变语义、只对会话新建 Provider 豁免」的方向。Work 因此重新进入进行中，撤销此前记下的收尾行。

2026-10-04 t03 的浏览器验收发现同族缺陷：候选（「参考待确认」）模型在补全窗口点「确定」有成功提示但不落盘。以 t04 续修。
