---
schema: nbook.task/v2
taskId: t04-candidate-confirm-writeback
---

# 候选模型确认后的写回缺口

## 目标与范围

`confirmTransientCandidate()` 把候选写入草稿后没有安排写回：成功提示照发，但 `userDirty` 未置位，防抖写回不排程，关闭/切区段时的 `flushSave()` 也会因 `userDirty === false` 直接跳过——候选模型停在内存里，刷新即丢。

修复：`enableModel({...candidate, enabled: true})` 之后补 `scheduleSave()`，与相邻处理器（`onAdd-provider`、`onAdd-manual-model` 等「改草稿 → scheduleSave」）保持同一模式。

发现路径：t03 的浏览器验收探针。点「发现/添加模型」打开窗口（t03 修复已生效），再点「参考待确认」候选的「+」→ 候选补全窗口「确定」→ 出现成功提示「模型已加入当前 Provider 白名单」，但既无 `PUT /api/config/global`，`config.json` 哈希也未变化。

上游对照：`upstream/master` 的同名函数同样缺这一行，属 fork 侧独立发现的缺陷。

## 非目标

- 不改候选补全窗口的字段校验与 `manualAdded` 提示语义。
- 不改防抖时长与其它处理器的保存策略。
- 不重构「对话框直接改草稿」的既有模式。

## 证据

- 探针：`.local/w00021-t03-candidate-probe.mjs`（发现 → 候选 → 确定 → 观察提示与网络）。
- 修复前实测：成功提示出现、`PUT` 计 0、`config.json` sha256 未变。
- 修复后实测：见下方「验证」；`PUT /api/config/global` 出现且写入体含候选模型（`enabled: true`）。

## 验证

- 修复后（worktree dev server）探针复测：候选「确定」→ `PUT /api/config/global` 发出，写入体含该候选（`id: CCG/deepseek-v4-flash`、`enabled: true`）；测试后配置按备份逐字节还原（sha256 回到 `dc9a40a3…`）。
- 聚焦测试：`bun run --cwd packages/neuro-book test -- app/components/novel-ide/settings`，19 files / 124 tests 通过；同命令在暂存修复后的基线重跑同样 124 通过，无回归。

## 执行位置

`.worktree/w00021-provider-connection-identity-edit`，分支 `fix/w00021-provider-connection-identity-edit`。
