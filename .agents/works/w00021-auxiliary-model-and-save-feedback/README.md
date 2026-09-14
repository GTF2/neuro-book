---
schema: nbook.work/v1
workId: w00021-auxiliary-model-and-save-feedback
issueId: null
---

# 辅助任务模型来源 + 设置保存反馈收口

本轮把「Agent Profile 模型」面板上两件**已经落地但尚未登记**的改动收口成一份 current 记录：一是给旁路小功能（AI 解释这一步）一个独立的模型来源，二是把保存成功反馈从占地方的横幅挪进「保存设定」按钮。

来源：[Proposal：辅助任务模型](../../../packages/neuro-book/docs/proposals/agent-auxiliary-task-model.md)（`accepted`）；[Spec：辅助任务模型来源](../../../docs/specs/agent/auxiliary-task-model.md)（`planned`）。

## 交付边界

两个交付面共用同一个面板，故合并在一份 current 记录里；下面按面分开列。

### 面 1：辅助任务模型来源（AI 解释这一步）

- 字段与类型：`shared/agent/profile-runtime-settings.ts` 新增 `ProfileAuxiliaryRuntimePatchSchema`（`modelKey: string|null`，`null` = 显式跟随本 Profile 模型）与 `ProfileRuntimeSettings.auxiliary`；`shared/dto/config.dto.ts` 导出对应 DTO 并补解析后形状。
- 继承与默认：`server/agent/profiles/profile-runtime-settings.ts` 的默认值（`modelKey: null`）、字段级合并与解析；四层继承（Global 通用 → Global Profile → Project 通用 → Project Profile）沿用既有机制。
- 读写路径：`server/config/normalizer.ts` 的 `normalizeProfileRuntimeSettingsPatch` 补 `auxiliary` 分组规范化。这是本轮的**缺陷修复**：该函数此前只规范化 `summarizer` / `compaction` / `fileChangeNotice`，`auxiliary` 在读写配置时被静默丢弃（界面选完保存立刻回弹成「跟随」，配置文件里始终是 `{}`）。`mergeProfileRuntimePatches` 与 `resolveProfileRuntimeSettings` 本来就支持该分组，因此只差这一处。
- 运行期消费：`server/agent/harness/neuro-agent-harness.ts` 的 `explainToolCall` 改为按该 Profile 的最终运行策略取 `auxiliary.modelKey`，经私有入口 `resolveAuxiliaryModel` 解析；未配置或指定模型不可用时回退到 Profile 模型，回退事实写 `agent.auxiliaryModel.fallback` 警告日志。
- 界面：`app/components/novel-ide/settings/ProfileRuntimeSettingsFields.vue` 新增「辅助任务」组（一个模型下拉 + 继承来源提示 + 一行说明），下拉复用同页「默认模型」的 `NovelIdeModelSelect`；`AgentProfileDefaultsPanel.vue` / `AgentProfileDetailPanel.vue` 透传 `enabledModels`；`settings/profile-runtime-settings.ts` 负责草稿字段、patch 组装与继承来源。
- 文案：`app/i18n/locales/{zh-CN,en-US}.ts` 的 `profileModels.runtime` 新增 `groups.auxiliary` / `auxiliaryModelKey` / `auxiliaryFollowProfile` / `auxiliaryHint`（中英同步）。
- 规范归属：新增 `docs/specs/agent/auxiliary-task-model.md`（`planned`）并登记进 `docs/specs/README.md`；提案状态 `draft` → `accepted`。
- 测试：`server/config/normalizer.test.ts` 新增「合法值保留 / `null` 保留 / 非法值不参与遮蔽」用例；`app/components/novel-ide/settings/profile-runtime-settings.test.ts` 的 fixture 补 `auxiliary` 字段。

### 面 2：保存反馈进「保存设定」按钮（去掉成功横幅）

- `app/components/novel-ide/NovelIdeSettingsDialog.vue`：`SettingsSavePanelExpose` 新增可选字段 `justSaved?`，新增 `activeSaveJustSaved` computed；头部保存按钮从两态变三态——默认 / 有改动（accent）/ **保存成功后绿底 + ✓「已保存」，2.4 秒自动回落**。
- `app/components/novel-ide/settings/NovelIdeAgentProfileModelSettingsPanel.vue`：删除 `successText` 与标题下方的绿色成功横幅（模板里只剩红色错误条）；新增 `justSaved` + `flashSaved()` / `clearSavedFlash()` 与 `onBeforeUnmount` 清理；`watch(dirty)` 一旦再次改动立即取消成功态；`defineExpose` 增加 `justSaved`；「重置主目录」的成功提示改用轻量 `notification.success`，不再占面板高度。
- 文案：`app/i18n/locales/{zh-CN,en-US}.ts` 新增 `common.saved`（已保存 / Saved），删除已失效的 `settings.panels.profileModels.projectSaveSuccess` / `globalSaveSuccess`（`en-US` 类型派生自 `zh-CN`，必须同步）。

## 不做

- 不实现「增强提示词」本身：本轮的辅助任务模型只提供它的模型来源，界面与接口是独立工作。
- 不把辅助任务模型默认值改成任何厂商的具体模型：默认保持「跟随本 Profile 的模型」，与未配置时的既有行为完全一致（2026-09-15 开发者确认）。
- 不新增「关闭辅助功能」开关，不改自动摘要 / 上下文压缩 / 文件变更通知三组既有字段，不做按会话或按工具的模型覆盖。
- 不动并行执行者在途的队列 / 会话改动：`AgentChatSurface.vue`、`AgentComposer.vue`、`useAgentSession.ts`、`useAgentSessionApi.ts`、`server/agent/http.ts`、`server/agent/events/public-queue-projection.ts`、`shared/dto/agent-session.dto.ts`、`AgentFollowUpQueuePanel.*`、`server/api/agent/sessions/[sessionId]/followups/**`、`docs/specs/agent/session-followup-queue.md` 及对应提案均不属本轮。
- 不代并行执行者提交 `docs/proposals/README.md`：该文件的队列提案行与本轮提案行相邻，等该文件空闲后再补登记行。
