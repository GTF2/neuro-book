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
- 2026-10-04 无头探针实测（`.local/w00021-t03-probe.mjs`、`.local/w00021-t03-toggle-probe4.mjs`、`.local/w00021-t03-toggle-probe5.mjs`）：
  - 点「发现/添加模型」→ 窗口打开（标题「/ 模型发现」、搜索框、分组与诊断徽章齐全），点击前不存在该窗口。
  - 「远端完整」模型点「+」→ 直接加入，`PUT /api/config/global` 写入体含该模型（`enabled: true`）。
  - 已启用模型「−」停用再恢复：两次 `PUT`，净变化为零；测试后按备份逐字节还原 `config.json`。

## 未验证

- 「参考待确认」候选的补全窗口路径不在此 Task 范围内：其「确定」后未安排写回，由 [t04](../t04-candidate-confirm-writeback/README.md) 续修（探针现场：成功提示出现、无 `PUT`）。

## 执行位置

`.worktree/w00021-provider-connection-identity-edit`，分支 `fix/w00021-provider-connection-identity-edit`。
