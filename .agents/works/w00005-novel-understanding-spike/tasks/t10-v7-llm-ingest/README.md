---
schema: nbook.task/v2
taskId: t10-v7-llm-ingest
role: tasker
---

# V7 LLM Ingest 与 20 章实验

2026-09-10 开发者明确跳过两章 CLI 人工体验门槛，要求先提交 CLI，再落实文档与计划，推进真实 LLM ingest，完成审查、优化和验证后处理样书前 20 章。CLI 检查点为 `37ef4bf1`；V7 schema/金标/查看器检查点为 `7bfdb19e`。开发者授权使用 DeepSeek 最新模型 ID `deepseek-flash`，真实 API smoke、调试与 20 章调用不限量、无需再次审批。

在既有 Work `w00005-novel-understanding-spike`、worktree `.worktree/w00005-novel-understanding-spike`、分支 `feat/w00005-v6-ingest-viewer` 实施。当前先完成设计和计划，再开始业务代码；Leader 维护 Spec、计划与 Work，Tasker 实现本目录代码、测试、提示词及实际运行。独立 Reviewer 按相同合同复核。无 push、发布或生产接入。

本 Task 拥有 V7 章级材料抽取、跨章增量整合、独立语义复核、摘要投影、确定性校验、耐久恢复与 CLI 导出；消费 t07 唯一 schema/query 及 t09 查询入口，不将 V6 输出转成 V7 伪装真实 ingest，不以金标答案作为模型输入。原 EPUB 和归一化原文只读复用。t07 金标、EntitySummary 合同和 t08 查看器只读；确有模型合同问题先报告证据给 Leader，不绕开类型与校验。

开发者于 2026-09-11 明确“千万级别的书”指单本一千万字的长篇。价格要求针对成品，开发调试无限 token、无需节省。主线记录每阶段/章 token、缓存、重试和按实际时段估价，生产有效调用与开发尝试分开；以正式 20 章测量估算单本千万字成本，检查有界旧知识上下文和局部摘要更新避免模型成本平方增长，不能为省钱绕过复核或漏报覆盖。

开发者要的是前 20 章可实际查询的自动产物。模型原始输出、输入快照、实际 model ID、调用用量、失败与重试、版本和覆盖应可审计；密钥仅运行时读取，禁止写入 prompts、日志、Git 或回复。预算没有人为金额/总调用上限；单次超时、有限自动重试和失败保留用于防止死循环，必要时由 Agent 诊断后继续。

初始调查分工：Tasker 只读检查 t07/schema、query/validate、t09 CLI、旧原文与运行设施，提出精简且可恢复的 V7 ingest 设计和风险；Reviewer 只读核对 DeepSeek 官方 API 文档中的 deepseek-flash、JSON 输出、参数限制、响应/错误及价格。文档与计划落盘并由 Leader 通知后进入实现，不在调查阶段改代码。

调查已完成，[行为规范](../../../../../docs/specs/memory/v7-llm-ingest.md)、[实施计划](plan.md) 和 [DeepSeek API 核验](deepseek-api.md) 已落盘，2026-09-10 进入实现。主线 Tasker（query_cli）拥有 draft/compiler/prompts/runner/CLI、配置与主线测试，依照计划完成整套管线和实际运行；并行 I/O Tasker（ingest_io）仅拥有 `source.ts`、`source.test.ts`、`provider.ts`、`provider.test.ts`，按下述接口提供适配。独立 Reviewer（cli_review）只读复核。各实现者不得相互覆盖文件；修改共享接口先协调。

I/O 完成后 ingest_io 继续拥有 `cost.ts`、`cost.test.ts`：按 provider 用量与 UTC 时段估价，分开生产有效调用/生产修复与开发调用，提供单位原文字数和千万字外推的纯函数。与主线直接协调最小输入接口，不修改 runner、prompts 或主线配置；未知 usage/cache 费用必须报告未知或区间，不能记零。

成本纯函数完成后 ingest_io 拥有独立只读 `report.ts` 与聚焦测试：从运行 manifest、已发布候选及尝试审计生成成本/覆盖/模型/阶段报告，区分正式运行与开发 smoke；不修改运行状态。与 query_cli 协调导出的最小调用接口和实际日志字段，CLI 接线仍由 query_cli 完成。

2026-09-11 成本范围澄清后，cost_scale Tasker 已完成 `cost.ts`、`report.ts` 的单本千万字只读复核，11 项测试和类型检查通过，无保留实现改动。全部 runner/report 相关所有权交回 query_cli：实现 C 仅拒绝 B 时保留已审通过 A、携带上一 B 候选定向修复，以及真实调用来源和费用分类；材料被拒绝或存在材料漏项时仍重新抽取。Leader 维护规范和成本解释。

长篇上下文审查确认身份链先占满预算会使语义记录无法入选，ingest_io 追加拥有 `prompts.ts` 的 ContextRecord、PriorContext、priorContext 区域及 `prompts.test.ts`，修复相关语义种子与实体、依赖的有界分配。query_cli 继续拥有该文件的 policy、阶段规则、makeRequest 与引用校验；修改前直接协调，避免覆盖。

I/O 合同：`captureSources(epubPath, through)` 返回 `{book,sources,archive:{sha256,selection},normalization:'epub-body-blocks-v1'}`，来源类型复用 t07；`ModelProvider` 接受 `{model:'deepseek-flash',system,user,maxTokens,timeoutMs,thinking?:'enabled'|'disabled'}`，返回 `{text,model,finishReason,usage:{inputTokens,outputTokens,cacheHitTokens,cacheMissTokens}|null,responseId,durationMs,raw?}`。`createDeepSeekProvider({apiKey,baseUrl?})` 提供单次请求适配，runner 拥有重试及调用前/后持久化；成功响应保留原始 JSON、实际 model、system_fingerprint 和所有 usage 明细，错误以可审计且不含密钥的 category/status/retryable 表达。`loadProviderConfig({envKey?,configPath?})` 仅读取显式凭据来源。

开发者已提供本机配置路径 `C:/Users/notnotype/AppData/Local/NeuroBook/data/workspace/.nbook/config.json`。Leader 已通过结构化投影确认 `models.providers` 中 `id=deepseek`、enabled=true、官方 baseURL 与非空密钥；只读取此 provider。配置中的模型列表仍为旧 ID，不修改用户配置，不以列表过时阻止此次显式授权的 `deepseek-flash` 请求。密钥不可输出、复制到 Task 或传入命令行参数。原 EPUB 为主工作区 `.local/novels/转生反派萝莉，找茬魔法少女.epub`。

验收包含确定性 fake 下的非法引用/范围/身份、发言与世界事实分离、复核拒绝、跨章名称与摘要历史、失败/恢复/重复执行/发布原子性；实际 API smoke；独立代码审查及修复；连续发布 1..20 章；t09 CLI 对导出进行结构、范围、证据与跨章查询验证。开发者收到产物后再用 Agent 评价真实查询质量。

2026-09-11 独立 ingest_review Reviewer 继续复核其已报告的 Fact/Argument/Episode 合法依赖问题，以及 raw JSON 候选保存修复后的恢复路径；仅修改独立 walkthrough，不修改实现。另抽查 `smoke-006` 已发布章的身份连续性、发言/世界真值和摘要归属，记录可复现的查询缺口或语义错误；不得手改数据，不调用模型，不把金标答案传回模型。当前 `smoke-006` 已连续发布 1..2，正式 20 章仍由 query_cli 运行。

语义材料复用完成后，query_cli 可直接请求独立 ingest_review Reviewer 接续上述复核并追加 `material-reuse.ts`、runner/report 的复用恢复和真实计费来源检查；Leader 此处已授权适用合同内的并行复核。report 文件已由 cost_scale 释放，不必等待额外确认。

Leader 在真实 `smoke-006/ch02` CLI `knowledge --holder c01:e_su --about c01:f_codex_role_plan --at 1:66` 复现额外范围缺陷：顶层 `coverage.gaps` 仍返回第二章的每日任务、神典石及原主人同名等内容。t07 的 coverage.gaps 是无位置字符串，不能靠 readAt 投影过滤。修复转由 t09 统一输出边界承担：受限阅读/角色/世界范围隐藏未标注位置的语义说明，完整读者范围保留。当前 Agent 接续 t09 Tasker 完成此修复；t10 活动源码、已发布数据和 t07 保持不变。为这个真实边界补回归并纳入复核。

2026-09-11 初始正式两章报告显示输出推理占比较高，且多轮修复成本大于最终有效链。为评估成品单本千万字成本，cost_scale Tasker 追加拥有独立 `experiments/thinking-cost/` 实验脚本及 `evidences/thinking-cost-001/`、对应 walkthrough：以已保存的真实 A/B/C 请求做显式 thinking disabled 对照，不修改冻结的主线文件或正式运行，不使用金标/验收答案。逐请求保留输入、响应、用量及确定性校验，比较同一输入的输出成本、结构和逐项语义判定；结果只能证明所测阶段，不冒充端到端质量。真实 API 已授权，不需再询问。

对照的 C 拒绝样本需包含 formal-002 第1章 round-1：存在明确的发言来源和问句升级信念错误；round-2 只有 id_book 时间争议，不能单凭它证明非思考复核会拦住真实语义错误。基线模型判定不是金标，逐项差异应对原文独立判断。

2026-09-11 Leader 决定在当前 formal-002 调用返回并保存后尽快结束本次运行，先完成 Spec/plan 中已登记但尚未实现的漏项分层及可用时间审查，再以新策略身份运行正式 20 章。query_cli 负责受控停止与恢复身份，不修改旧模型产物、不在旧目录运行新代码。新 C missing 每项用明确 stage=material/integration 与具体说明，整合漏项保留已全通过 A，未知归属保守记 material；新增回归验证定向修复、重启与来源计费。时间提示按证据最晚边界审查，不能要求每条身份判断与首次提及同段。思考模式对照初步发现关闭思考会引入结构错误及漏判，暂不据此关闭生产阶段思考；等待独立实验结论后选择有证据的模式，不能只按 token 更低采用。

交接补充：当前主 Agent 暂接 t10 Tasker 的窄范围修复职责，拥有 `draft.ts`、`prompts.ts`、`runner.ts` 及对应回归；query_cli 暂停 formal-002，不自行恢复或覆盖这些文件。修复完成后主 Agent 将在本文件和 walkthrough 写明新策略及启动身份，再交回主线运行。正式前两章和当前请求/响应保持原样。

策略 -3 已在 `60cff3f7` 提交，新正式运行 `evidences/formal-003` 于 2026-09-11 12:04 启动。主 Agent 唯一控制该运行及同策略恢复；六份策略源码冻结。query_cli 继续只读验证已发布前缀，拥有 `experiments/verify-published.ts`、逐章查询与验证证据及对应 walkthrough。主 Agent 维护 `query-guide.md`、成本说明和最终交接；formal-002 保留停止状态，不再续跑。20 章完成状态以新运行 manifest 为准，不能沿用旧运行或 smoke 的完成数字。

主 Agent 追加独立结构修复实验 `experiments/record-patch/` 与 `evidences/record-patch-001/`：消费formal-003已保存的第4章修复请求，比较完整重写与按ID替换相关记录。仅允许替换已有记录，不新增、删除或自动推断语义；合成完整候选后仍执行原有全部校验。保留真实请求/响应、变更集合、未变记录检查、用量与失败。思考模式保持enabled，四个样本覆盖枚举、身份ID、角色重名与可用时间，不引入金标。先落实实验合同与边界测试，再运行已授权真实API；结果不能冒充端到端质量，不修改冻结主线或正式候选。

4次对照已完成：三个B补丁均通过原确定性校验，输出合计由73231降到12013 tokens；A补丁修正枚举后仍被剩余原文定位错误拦住。正式formal-003在第4章第6轮B attempt-3自然退出，head=3，全部响应落盘。Leader决定将按记录替换纳入A/B的结构错误重试，保留完整候选生成与完整C审查。主 Agent 接续Tasker，拥有运行期 `record-patch.ts`、`prompts.ts`、`runner.ts`、对应测试与文档；先完成恢复/计费回归和独立复核，再以新策略/新目录做真实smoke及20章。旧运行停止，不能按新源码恢复。query_cli继续只读审查，禁止自行恢复formal-003。

策略 -4 已通过71项测试、typecheck、独立恢复/计费复核和真实 `smoke-007` 首章。首章76段、277记录、172个复核单元，重放哈希一致，重复运行0次API调用；早1:7全文搜索未来名称为空。2026-09-11 14:30启动新的 `evidences/formal-004` 连续1..20，终端session29575，policyHash `db2d3861ac85b2f062c3cf2fdd8e1550105c55fb4d0f72560fb312bd35f2a0cc`，七份策略源码冻结。主 Agent 唯一控制运行与恢复；query_cli只读验证新发布前缀，旧formal-003停止。完整20章以formal-004 manifest.head为准。
