---
schema: nbook.task/v2
taskId: t03-model-discovery-dialog-entry
---

# 模型发现窗口的打开入口

## 目标与范围

让「发现/添加模型」真正打开模型发现窗口：接线里先置 `discoveryDialogOpen`，再启动发现，使结果列表、部分成功诊断与手工补全行有落点。

缺陷：`useProviderSettingsBinding.ts` 把 `onOpen-discovery` 接成 `() => void discoverModels()`，只跑发现。`discoveryDialogOpen` 除对话框自身的 v-model 回写外没有任何置 `true` 的路径，因此 `ModelDiscoveryDialog` 永远打不开——发现成功只留一条 toast，模型无法被勾选加入（开发者实测：发现到 30 个模型，但「已启用模型」仍为 0）。

## 非目标

- 不改发现协议与适配器（`openai-models` / `openrouter-models` / `anthropic-models` / `google-models`）或上游请求地址的拼接规则。
- 不改顶部「查询可用模型」的语义：它仍是只发现、不弹窗的快速查询。
- 不为「API Base 误填完整端点路径」增加额外提示（已知体验问题，另行处理）。

## 证据

- 现有设置区与服务端 config-service 套件保持通过（改动未触及它们的断言）。
- 该接线没有单元测试覆盖：`useProviderSettingsBinding` 无测试文件，本次未新建。

## 未验证

- 未在浏览器实跑「点发现/添加模型 → 窗口打开 → 勾选模型加入」；判定依据是 `discoveryDialogOpen` 的写入路径检索与组件 props/emits 合同。需界面确认。

## 执行位置

`.worktree/w00021-provider-connection-identity-edit`，分支 `fix/w00021-provider-connection-identity-edit`。
