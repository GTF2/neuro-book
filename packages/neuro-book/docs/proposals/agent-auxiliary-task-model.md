# 辅助任务模型提案

状态：accepted

## 问题

Agent 会话里有两类「点一下才调用一次模型」的小功能：

1. **AI 解释这步**：工具卡片上的按钮，把一次工具调用解释成人话（`server/agent/harness/tool-explanation.ts`）。
2. **增强提示词**（原型已确认，尚未实现）：输入框右下角的按钮，把用户随手写的一句话补全成明确的指令。

两者目前**没有独立的模型设置**：

- 「AI 解释这步」用的是会话所属 Profile 解析出的模型（`neuro-agent-harness.ts` 的 `explainToolCall`：`modelResolver(config, snapshot.metadata.profileKey)`），也就是和正文写作同一个（通常最贵的）模型。
- 用户在设置里找不到任何入口能单独指定它；用 `/model` 临时切换会话模型也不会作用于解释。
- 这两项都不进入对话、不写历史，本质上属于旁路小任务，用主模型跑既贵又没有必要。

## 目标与非目标

### 目标

1. 在「Agent Profile 模型 → 运行策略」里新增一组「辅助任务」，**只加一行**模型选择：留空 = 跟随本 Profile 的模型（与现状完全一致），填写 = 指定另一模型。
2. 复用现有运行策略的继承模型（Global 通用值 → Global Profile 覆盖 → Project 通用值 → Project Profile 覆盖），与「自动摘要」同一套写法，不新增分区、不新增开关。
3. 指定的模型不可用时**自动回退**到 Profile 模型，不让辅助功能整体不可用。

### 非目标

- 不新增「关闭辅助功能」开关（关掉只会让用户找不到按钮）。
- 不改动自动摘要 / 上下文压缩 / 文件变更通知三组既有字段。
- 不引入按会话、按工具的模型覆盖，不做成本预算策略。
- 不实现「增强提示词」本身（那是独立的界面 + 接口工作，本提案只提供它的模型来源）。

## 方案

### 数据

`ProfileRuntimeSettingsPatch` 新增 `auxiliary`：

```ts
auxiliary?: {modelKey?: string | null};
```

- 省略（`undefined`）= 本层不表态，继续继承；
- `null` = 显式跟随所属 Profile 的模型；
- 字符串 = 指定模型 key。

解析后的 `ProfileRuntimeSettings.auxiliary.modelKey` 为 `string | null`，`null` 表示跟随。默认值即 `null`，因此**不配置时行为与现在完全一致**。

### 服务端

- `explainToolCall` 改为：先取该 Profile 的最终运行策略，有 `auxiliary.modelKey` 时按它解析模型；解析失败（模型被删除、缺密钥）写一条 warning 日志后回退到 Profile 模型。
- 新增私有方法 `resolveAuxiliaryModel(config, profileKey, modelKey)` 作为唯一入口，「增强提示词」实现时直接复用。

### 界面

在「Agent Profile 模型 → 运行策略」的「文件变更通知」之后新增一组「辅助任务」：一个模型下拉 + 继承来源提示 + 一行说明。不引入状态条、弹窗或其它控件。

**复用**：下拉直接用同页「默认模型」所用的 `NovelIdeModelSelect`（自带「跟随…」选项与模型清单），候选模型与「默认模型」同源（`enabledModels`），避免两处清单漂移。历史保存过、但已不在可用清单中的 model key 会合成一条「不可运行 · key」选项，让用户看得见并改掉它。

**取舍**：首版实现用的是文本输入（理由是同面板「摘要 Profile Key」这类跨层键都是文本输入），但同页「默认模型」是下拉，开发者明确要求下拉；下拉也直接消灭了「手填模型 key 打错」的问题。代价是需要把模型清单透传到运行策略字段组件（已完成）。

## 数据、接口、安全、迁移与回滚影响

- **数据**：配置新增一个可选字段，不需要迁移；旧配置读出来即 `null`（跟随）。
- **接口**：`ProfileRuntimeSettingsPatchDtoSchema` / `ProfileRuntimeSettingsDtoSchema` 新增字段，属向后兼容的新增；响应侧始终输出 `auxiliary.modelKey`。
- **安全**：只存模型 key，不涉及密钥；模型 key 不新增对外暴露面（它本来就在模型设置里可见）。
- **回滚**：删除该字段即回到「跟随 Profile 模型」；界面在字段缺失时按空值降级。
- **风险**：低。唯一副作用是辅助任务可能改用更弱的模型，回答质量下降——由用户显式选择承担。

## 对 Spec 的预期改动

- 目标 capability：建议新增 `docs/specs/agent/auxiliary-task-model.md`（`planned`），或并入现有 Agent 运行策略 capability。
- 需要写清的行为：
  - **输入**：Profile 运行策略里的 `auxiliary.modelKey`；「AI 解释这步」与「增强提示词」的调用请求。
  - **输出**：解释 / 增强文本；生效模型（供排查）。
  - **状态**：无独立运行态，沿用一次性旁路调用。
  - **副作用**：每次调用产生一次模型调用与费用；不写会话历史、不进主对话上下文。
  - **失败**：指定模型不可用 → 回退 Profile 模型并记录日志；两次都不可用 → 按现有错误路径返回。
  - **验收**：未配置时解释所用模型与 Profile 模型一致；配置后一致使用指定模型；指定模型被删除后解释仍可用（回退）。

## 决策记录

- 2026-09-14：开发者提出「AI 解释用的是哪个模型、能不能在基础设置里加设置」，确认主方案（一行选择、默认跟随、复用运行策略继承、不可用自动回退），并授权直接落地。
- 2026-09-14：开发者要求字段形态改为模型下拉（列出模型设置里的全部模型）。改为复用 `NovelIdeModelSelect`，与同页「默认模型」完全一致；同时把 `enabledModels` 透传到运行策略字段组件。
- 2026-09-14：真机验证发现 `server/config/normalizer.ts` 的 `normalizeProfileRuntimeSettingsPatch` 只规范了 summarizer / compaction / fileChangeNotice 三个分组，`auxiliary` 在读写配置时被静默丢弃（选完保存后界面回落成「跟随」、配置文件里仍是 `{}`）。已补上该分组的规范化，`mergeProfileRuntimePatches` 与 `resolveProfileRuntimeSettings` 本来就支持，因此这次只补一处；`normalizer.test.ts` 增加「合法值保留 / `null` 保留 / 非法值不参与遮蔽」用例。
- 2026-09-15：开发者确认辅助任务模型的默认值保持「跟随本 Profile 的模型」，不写成任何具体厂商模型（想省成本的用户在设置里手动选即可）。
- 2026-09-15：提案升 `accepted`；本能力建立规范归属 —— 新增 [Spec：辅助任务模型来源](../../../../docs/specs/agent/auxiliary-task-model.md)（`planned`）并登记进 `docs/specs/README.md`；实现记录登记为 Work `w00021-auxiliary-model-and-save-feedback` / Task `t01`。
