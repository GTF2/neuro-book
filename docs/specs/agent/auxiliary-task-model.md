---
schema: nbook.spec/v1
kind: behavior
status: implemented
capability: agent.auxiliary-task-model
owners:
  - agent-runtime
  - config
---

# 辅助任务模型来源

## 目标与非目标

**目标**：让「每次只调用一次模型、不进入对话」的旁路小功能可以**单独指定模型**，默认仍跟随所属 Profile 的模型；指定模型不可用时自动回退，不让辅助功能整体不可用。首期消费者是「AI 解释这一步」（工具卡片上的解释按钮）。

**非目标**：

- 不实现「增强提示词」本身（界面与接口是独立工作）；本能力只提供它的模型来源。
- 不新增「关闭辅助功能」开关：关掉只会让用户找不到按钮。
- 不引入按会话、按工具、按任务的模型覆盖，不做成本预算或用量策略。
- 不改变自动摘要 / 上下文压缩 / 文件变更通知三组既有运行策略字段的语义与默认值。
- 不改变「AI 解释这一步」的旁路契约：不写会话历史、不进主对话上下文、不产生新的事件或路由。
- 不承诺指定模型一定可用；不可用是回退条件，不是失败。

## 术语与参与者

| 术语 | 含义 |
|---|---|
| 辅助任务 | 用户点一次、只调用一次模型、不进入对话的旁路小功能；首期只有「AI 解释这一步」 |
| 辅助任务模型 | 辅助任务使用的模型，由运行策略的 `auxiliary.modelKey` 决定 |
| 跟随 | `modelKey` 为 `null`：使用所属 Profile 解析出的模型，与未配置时的行为完全一致 |
| 本 Profile 的模型 | 按既有 Profile 模型解析规则、由会话 Profile key 解析出的模型 |
| 运行策略继承 | 字段级继承的四层链：Global 通用 → Global Profile 覆盖 → Project 通用 → Project Profile 覆盖 |
| 回退 | 指定的模型不可用时，改用本 Profile 的模型继续执行，事实写运行日志 |
| 参与者 | 设置界面（字段写入方）、配置读写层（字段 owner）、Agent harness（消费方）、既有 Profile 模型解析（被复用） |

## 输入与前置条件

- **触发方式**：用户在「设置 → Agent Profile 模型 → 运行策略 → 辅助任务」写入字段；运行期由会话级「AI 解释这一步」调用读取。
- **字段形状**：`auxiliary.modelKey` 为三态。
  - 省略（本层不表态）：继续继承下一层；
  - `null`：显式跟随本 Profile 的模型；
  - 非空字符串：指定模型 key（保存前去除首尾空白）。
- **前置状态**：写配置需要与既有配置中心相同的权限与作用域（Global 通用值 / Global Profile / Project 通用值 / Project Profile）；解释调用需要会话存在且带有 Profile key。
- **输入约束**：界面下拉的候选来自模型设置里可用的模型清单（`enabledModels`）；空字符串等非法值不参与遮蔽，按「本层未表态」处理。
- **有效范围**：只影响辅助任务，不影响该 Profile 的正文写作、工具调用与其它运行策略字段。

## 输出与可观察行为

- **设置界面**：运行策略里出现「辅助任务」组，含一个模型下拉（首项为「跟随本 Profile 的模型」，其余为模型设置里的全部模型）、一行继承来源提示与一行说明。历史保存过但已不在可用清单中的 key 显示为一条「不可运行 · key」选项，让用户看得见并改掉它。
- **配置往返**：保存后再次读取，选中的模型保持不变（不回弹成「跟随」），配置文件中真实存在 `auxiliary.modelKey`；未配置时该字段不出现。
- **解释这一步**：配置为指定模型时用该模型；未配置或配置为 `null` 时用本 Profile 的模型，与改动前完全一致。
- **回退可见性**：回退只写运行日志（`agent.auxiliaryModel.fallback`，含 `profileKey` / `modelKey` / 错误摘要），不在界面报错、不产生用户可见提示。

## 状态与转换

本能力不引入新的持久状态：只有配置里的一个可选字段。解释调用本身无状态。

| 起始 | 事件 | 结果状态 | 说明 |
|---|---|---|---|
| 未配置 | 解释这一步 | 用本 Profile 的模型 | 与改动前一致 |
| 配置为 `null` | 解释这一步 | 用本 Profile 的模型 | 显式跟随，语义上区分于「未表态」 |
| 配置为可用模型 key | 解释这一步 | 用该模型 | 主路径 |
| 配置为不可用模型 key | 解释这一步 | 回退本 Profile 的模型 | 记警告日志，不报错 |
| 指定模型事后被删除 | 解释这一步 | 同上一行 | 界面显示「不可运行 · key」，解释仍可用 |
| 在某一层配置 | 解析 | 该层生效，其余层继续继承 | 字段级继承；未表态的层不遮蔽下层 |

- **幂等**：同一配置重复保存得到同一结果；解释调用不改变任何配置。
- **并发**：配置写入沿用既有配置中心的并发与作用域语义，本能力不新增锁或版本。

## 副作用与数据

- **持久化**：配置新增一个可选字段；旧配置读出来即「跟随」，不需要数据迁移。
- **费用**：每次解释调用产生一次模型调用与相应费用；改用更便宜的模型即减少这部分费用。
- **不进对话**：调用不写会话历史、不进入主对话上下文、不影响后续 Agent 决策（沿用既有旁路契约）。
- **无**文件、事件、缓存或外部进程副作用。
- 数据 owner 为 config（字段读写），消费 owner 为 agent-runtime（harness）。

## 失败与恢复

- **指定模型不可用**（key 无效、模型被删除、缺少凭据）：回退到本 Profile 的模型并记警告日志，辅助功能保持可用。
- **回退后仍失败**：按「AI 解释这一步」既有错误路径返回（沿用既有 provider 错误码），本能力不新增失败语义、不改错误码。
- **配置值非法**（空字符串、类型不符）：该值不参与遮蔽，按「本层未表态」处理，继续继承。
- **配置读写丢字段**：属缺陷而非降级——字段写入后必须能在解析结果里读回；丢失即视为实现缺陷。
- 无回滚需求：删除字段即回到「跟随本 Profile 的模型」。

## 边界与兼容

- **模块所有权**：字段与读写路径归 config；运行期消费归 agent-runtime；Profile 模型解析沿用既有实现，本能力不复制一套解析规则。
- **权限与安全**：只存模型 key，不涉及密钥，不新增对外暴露面（同一 key 本来就在模型设置中可见）。
- **公开接口**：运行策略 patch / 解析结果的 `auxiliary` 字段属**向后兼容的新增**；解析结果始终输出 `auxiliary.modelKey`，未配置时为 `null`。
- **回滚**：删除该字段即回到改动前行为；界面在字段缺失时按「跟随」降级。
- **既有合同不变**：自动摘要 / 上下文压缩 / 文件变更通知的字段与默认值不变；「AI 解释这一步」的 HTTP 入口、错误码与旁路契约不变。
- **无数据迁移**。

## 验收与 Smoke

- **Given** 运行策略中没有任何 `auxiliary` 配置，**When** 触发解释这一步，**Then** 使用的模型与该 Profile 解析出的模型一致（与改动前行为相同）。
- **Given** 运行策略配置了可用模型 key，**When** 触发解释这一步，**Then** 使用该模型。
- **Given** 配置的模型后来被删除或不可用，**When** 触发解释这一步，**Then** 解释仍可用（回退到 Profile 模型），且运行日志出现 `agent.auxiliaryModel.fallback`。
- **Given** 在 Project Profile 层配置、Global 与 Global Profile 层不表态，**When** 解析运行策略，**Then** 生效值为 Project Profile 的值，其它层不遮蔽。
- **Given** 配置值为空字符串，**When** 保存并重新解析，**Then** 该层视为未表态，继续继承。
- **Given** 在设置里改辅助任务模型并保存，**When** 重新打开该面板，**Then** 下拉保持所选模型、配置文件含 `auxiliary.modelKey`。
- **Smoke 入口（当前可执行）**：`bun run --cwd packages/neuro-book test -- server/config app/components/novel-ide/settings`（配置规范化三态与草稿组装）；真机为「设置 → Agent Profile 模型 → 运行策略 → 辅助任务」保存后重开面板观察下拉是否回弹。真实 Provider 下的模型归属观测尚未执行。

## 实现合同

- owner：字段与读写路径归 config（`shared/agent/profile-runtime-settings.ts`、`shared/dto/config.dto.ts`、`server/config/normalizer.ts`、`server/agent/profiles/profile-runtime-settings.ts`）；运行期消费归 agent-runtime（`server/agent/harness/neuro-agent-harness.ts`）。Profile 模型解析**复用**既有 `modelResolver`，本能力不复制一套解析规则。
- 公开接口：运行策略 patch 与解析结果中的 `auxiliary.modelKey`（`string | null`），属向后兼容的新增；解析结果始终输出该字段，未配置时为 `null`。不新增 HTTP 路由、agent 工具或环境变量。
- 稳定入口：`auxiliary.modelKey` 字段与其 DTO；`normalizeProfileRuntimeSettingsPatch` 的 `auxiliary` 分组规范化（该分组此前在读写配置时被静默丢弃，属已修缺陷）；四层继承解析；`NeuroAgentHarness` 的 `modelResolver` 构造注入点。回退逻辑 `resolveAuxiliaryModel` 为 private，对外可观察的消费入口是 `explainToolCall`。
- 回退语义：`modelKey` 非 `null` 时先用 `{modelKey}` 解析；解析抛错则记 `agent.auxiliaryModel.fallback`（含 `profileKey` / `modelKey` / 错误摘要）并回退到该 Profile 的模型，辅助功能保持可用。回退只写运行日志，不进用户面、不改既有 provider 错误码。`modelKey` 为 `null` 时直接走 Profile 模型，不尝试解析 override。
- 字段三态：省略（本层不表态，继续继承下一层）、`null`（显式跟随）、非空字符串（指定 key，保存前去除首尾空白）。空字符串等非法值不参与遮蔽，按「本层未表态」处理。
- 不进对话：解释调用不写会话历史、不进入主对话上下文、不影响后续 Agent 决策（沿用既有旁路契约）。
- 测试入口：`server/config/normalizer.test.ts` 与 `app/components/novel-ide/settings/profile-runtime-settings.test.ts`（字段三态与草稿组装）；`server/agent/harness/neuro-agent-harness.test.ts` 的「辅助任务模型解析合同」（未配置 / 指定可用 / 指定不可用回退三条路径，断言落在下游实际收到的模型、resolver 调用序列与回退日志）；`scripts/smoke/real-model/auxiliary-model.test.ts`（**真实 Provider 端到端观测**：指定的辅助模型走 openrouter、未配置走 Profile 的 deepseek，按请求 host 与请求体 `model` 判定）。

## 证据

- 批准依据：[Proposal：辅助任务模型](../../../packages/neuro-book/docs/proposals/agent-auxiliary-task-model.md)（2026-09-15 `accepted`）。
- 实现与验证记录：Work [`w00021-auxiliary-model-and-save-feedback`](../../../.agents/works/w00021-auxiliary-model-and-save-feedback/README.md) / Task `t01`（含真机证据 `out/settings-saved-flash.png`）。
- 区域缺口来源：`docs/specs/README.md`「规范缺口」P1 行「配置、模型与凭据」——该区域此前没有单一规范，本 Spec 建立本能力的归属。
- 复用而不修改的既有合同：Reference [`agent/`](../../../packages/neuro-book/assets/reference/agent/README.md)（Profile 与运行策略的既有语义）。
