# t01 实施记录：辅助任务模型来源 + 保存反馈改造

日期：2026-09-15。分支：`feat/writing-doctrine-alignment`。

本轮代码由本轮执行者落地，收尾者（本次登记）复核代码与交接证据、补规范归属与接缝登记，并重跑测试与类型检查。

## 调研结论（决定了本轮做法）

1. 「AI 解释这一步」原先用 `modelResolver(config, snapshot.metadata.profileKey)` 直接取会话 Profile 的模型，也就是与正文写作同一个（通常最贵的）模型，且设置里没有任何入口能单独指定它——`/model` 临时切换会话模型也不作用于解释。
2. 这类旁路调用**不写会话历史、不进主对话上下文**，所以单独换一个便宜模型不会污染写作上下文；这是本能力成立的前提。
3. 运行策略已有四层继承（Global 通用 → Global Profile 覆盖 → Project 通用 → Project Profile 覆盖）与字段级合并，因此不需要发明新的继承机制，只加一组字段即可。
4. 首版把字段做成文本输入（理由是「摘要 Profile Key」这类跨层键都是文本输入），开发者明确要求改成下拉：同页「默认模型」的 `NovelIdeModelSelect` 自带「跟随…」选项与模型清单，直接消灭「手填模型 key 打错」这一类问题，代价是需要把 `enabledModels` 透传到运行策略字段组件。

## 实际改动

### 面 1：辅助任务模型来源

- `shared/agent/profile-runtime-settings.ts`：新增 `ProfileAuxiliaryRuntimePatchSchema`（`modelKey: string.trim().min(1).nullable().optional()`）并挂进 `ProfileRuntimeSettingsPatchSchema`；`ProfileRuntimeSettingsPatch` / `ProfileRuntimeSettings` 增加 `auxiliary`；注释写明「`null` = 显式跟随」、「指定值不可用时回退，不允许辅助功能整体不可用」。
- `shared/dto/config.dto.ts`：导出 `ProfileAuxiliaryRuntimePatchDtoSchema`，并在 `ProfileRuntimeSettingsDtoSchema` 补解析后形状 `auxiliary.modelKey: string | null`。
- `server/agent/profiles/profile-runtime-settings.ts`：`DEFAULT_PROFILE_RUNTIME_SETTINGS.auxiliary.modelKey = null`；`mergeProfileRuntimePatches` 增一组字段级合并；`resolveProfileRuntimeSettings` 增解析分支。
- `server/config/normalizer.ts`：`normalizeProfileRuntimeSettingsPatch` 增 `ProfileAuxiliaryRuntimePatchDtoSchema.safeParse(record.auxiliary)` 与回写分支。
- `server/agent/harness/neuro-agent-harness.ts`：
  - `explainToolCall` 改为先按 Profile 解析运行策略取 `auxiliary.modelKey`，再交给新私有入口 `resolveAuxiliaryModel(config, profileKey, modelKey)`；
  - `resolveAuxiliaryModel`：`null` 时直接用 Profile 模型；指定 key 解析失败时写 `agent.auxiliaryModel.fallback` 警告日志后回退 Profile 模型。
- `app/components/novel-ide/settings/profile-runtime-settings.ts`：草稿字段 `auxiliaryModelKey`、继承来源 `sources.auxiliaryModelKey`、patch 组装（trim 后非空才写入）。
- `app/components/novel-ide/settings/ProfileRuntimeSettingsFields.vue`：新增「辅助任务」组（`NovelIdeModelSelect` + 继承来源提示 + 说明行），候选模型来自新增的 `enabledModels` prop；历史保存过但已不在可用清单中的 key 会合成一条「不可运行 · key」选项。
- `AgentProfileDefaultsPanel.vue` / `AgentProfileDetailPanel.vue`：透传 `enabledModels`。
- i18n（`zh-CN` / `en-US` 对等）：`runtime.groups.auxiliary`、`runtime.auxiliaryModelKey`、`runtime.auxiliaryFollowProfile`、`runtime.auxiliaryHint`。
- 规范归属：新增 `docs/specs/agent/auxiliary-task-model.md`（`planned`）并登记 `docs/specs/README.md`；提案 `agent-auxiliary-task-model.md` 由 `draft` 升 `accepted`。

### 面 2：保存反馈进「保存设定」按钮

- `NovelIdeSettingsDialog.vue`：`SettingsSavePanelExpose` 增可选 `justSaved?`（未实现该态的面板按 `false` 处理，其余 5 个面板不用改）、新增 `activeSaveJustSaved` computed；头部保存按钮三态——默认 / 有改动（accent）/ 保存成功后绿底 + ✓「已保存」，2.4 秒回落。
- `NovelIdeAgentProfileModelSettingsPanel.vue`：删除 `successText` 与标题下方的绿色成功横幅（模板只剩红色错误条）；新增 `justSaved` + `flashSaved()` / `clearSavedFlash()` + `onBeforeUnmount` 清理；`watch(dirty)` 一旦再次改动立即取消成功态；`defineExpose` 增 `justSaved`；「重置主目录」成功提示改用 `notification.success`。
- i18n：新增 `common.saved`；删除已失效的 `profileModels.projectSaveSuccess` / `globalSaveSuccess`（`en-US` 类型派生自 `zh-CN`，必须同步删）。

### 面 1 的缺陷修复（真机发现）

- 现象：选完辅助任务模型点保存，界面立刻回弹成「跟随本 Profile 的模型」，配置文件里始终是 `profileRuntimeDefaults: {}`。
- 根因：`normalizeProfileRuntimeSettingsPatch` 只规范化 `summarizer` / `compaction` / `fileChangeNotice` 三组，`auxiliary` 在读写配置时被静默丢弃；`mergeProfileRuntimePatches` 与 `resolveProfileRuntimeSettings` 本来就支持该分组，所以只差这一处。
- 处置：补该分组的规范化；`normalizer.test.ts` 增「合法值保留 / `null` 保留 / 非法值不参与遮蔽」用例；提案决策记录补一条。

## 验证

- `bun run --cwd packages/neuro-book test -- server/config app/components/novel-ide/settings server/agent/profiles/leader-assets-profile.test.ts`：**14 文件 / 144 条全通过**。
- `bun run --cwd packages/neuro-book typecheck`：**退出码 0**（i18n 增删文案后类型仍过）。
- 真机探针（本轮执行者，Playwright + msedge；收尾者只复核了截图与代码，未复跑）：保存后下拉保持所选模型、配置文件写入 `auxiliary.modelKey`；页面里不存在成功横幅文案；唯一匹配「已保存」的元素尺寸 56×16，即头部按钮而非横幅。证据：`out/settings-saved-flash.png`（截图中标题下方无横幅，头部为绿底 ✓「已保存」）。

## 偏差与说明

- 未采用「给辅助任务加关闭开关」：关掉只会让用户找不到按钮，问题不在开关而在模型来源。
- 未把辅助任务默认值写成具体厂商模型（例如 `deepseek/deepseek-flash`）：默认跟随 Profile 模型才与改动前行为一致，也不把某个厂商的 key 变成产品默认值。2026-09-15 开发者确认保持跟随。
- 未把字段改成必填或加校验错误提示：非法值按「未配置」处理，与既有运行策略字段一致。

## 未验证

- 真实 Provider 下「AI 解释这一步」确实使用指定模型（需 Provider 授权）。当前证据只到「配置保存与解析正确」。
- 指定模型不可用时的回退分支没有合同测试，只有代码路径与日志点。
- 运行中的应用要重启 dev server 后才装载新的面板文案与运行策略字段。
