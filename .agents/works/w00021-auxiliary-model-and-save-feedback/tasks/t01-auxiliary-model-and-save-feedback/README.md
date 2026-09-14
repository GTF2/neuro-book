---
schema: nbook.task/v2
taskId: t01-auxiliary-model-and-save-feedback
role: tasker
---

# 落地辅助任务模型来源与保存反馈改造

## 目标

按 [Spec：辅助任务模型来源](../../../../docs/specs/agent/auxiliary-task-model.md) 落地「辅助任务」模型来源（配置字段、继承解析、运行期消费与回退、界面），并把「Agent Profile 模型」面板的保存成功反馈从标题下方的绿色横幅移进头部「保存设定」按钮。

## 开发者参与

- 已确认：开发者提出「AI 解释用的是哪个模型、能不能在设置里单独指定」，确认主方案（一行选择、默认跟随、复用运行策略继承、不可用自动回退）并授权直接落地。
- 已确认：字段形态改为模型下拉（列出模型设置里的全部模型），复用同页「默认模型」的 `NovelIdeModelSelect`。
- 已确认（2026-09-15）：辅助任务模型默认值保持「跟随本 Profile 的模型」，不写死任何厂商模型。
- 已确认：保存成功反馈放入「保存设定」按钮，不保留标题下方的横幅。

## 修改步骤

1. 字段与类型：`shared/agent/profile-runtime-settings.ts` 增加 `ProfileAuxiliaryRuntimePatchSchema` 与 `auxiliary` 类型；`shared/dto/config.dto.ts` 导出 DTO、补解析后形状。
2. 继承解析：`server/agent/profiles/profile-runtime-settings.ts` 补默认值、合并与解析。
3. 读写修复：`server/config/normalizer.ts` 的 `normalizeProfileRuntimeSettingsPatch` 补 `auxiliary` 分组；`normalizer.test.ts` 补合法值 / `null` / 非法值三态用例。
4. 运行期消费：`server/agent/harness/neuro-agent-harness.ts` 的 `explainToolCall` 与私有 `resolveAuxiliaryModel`（不可用回退 + 警告日志）。
5. 界面：`settings/ProfileRuntimeSettingsFields.vue` 新增「辅助任务」组；两个调用方透传 `enabledModels`；`settings/profile-runtime-settings.ts` 接草稿与 patch；i18n 中英同步。
6. 保存反馈：`NovelIdeSettingsDialog.vue` 按钮三态 + `justSaved?`；`NovelIdeAgentProfileModelSettingsPanel.vue` 删横幅、接 `flashSaved`、重置主目录提示改 toast；i18n 增 `common.saved`、删两个失效文案。
7. 规范与登记：新增 `docs/specs/agent/auxiliary-task-model.md`（`planned`）、登记 `docs/specs/README.md`、提案升 `accepted`、`docs/standards/fork-seams.md` 登记接缝、Work `w00021` / Task `t01`。

## 验证

- `bun run --cwd packages/neuro-book test -- server/config app/components/novel-ide/settings`（本轮改动的合同测试）。
- `bun run --cwd packages/neuro-book typecheck`（i18n 类型由 zh-CN 派生，必须过）。
- `bun run docs:check`、`bun run governance:check`。
- 真机（交接方已做，证据为 `out/settings-saved-flash.png`）：设置 → Agent Profile 模型 → 运行策略，改辅助任务模型并保存后下拉不回弹、配置文件写入 `auxiliary.modelKey`；标题下方无成功横幅；「已保存」只出现在头部按钮上。
- 未验证项：真实 Provider 下「AI 解释这一步」确实使用指定模型（需 Provider 授权）；指定模型不可用时的回退只有代码路径、无合同测试；本轮收尾者未复跑真机探针，只核对了交接方留下的截图与代码。
