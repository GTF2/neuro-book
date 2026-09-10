---
schema: nbook.spec/v1
kind: behavior
status: implemented
capability: memory.v7-query-cli
owners:
  - novel-memory-spike
---

# V7 只读检索接口

## 目标与非目标

为 V7 已发布 JSON 快照提供 Agent 可调用的本地 CLI，支持从主体、命题和材料检索到证据回溯。该接口属于设计验证工具，不表示生产 NeuroBook 已接入 V7。首版为确定性结构/子串检索，不提供向量语义搜索、自然语言回答、知识写入、自动推断、LLM ingest、MCP 或已发布 SDK。

## 术语与参与者

调用者可以是人或 Agent。主体是持续对象；局部指称是某处文本所指的对象；身份判断建立二者的有依据映射。命题的 `assertion` 区分世界、信念与发言等类别，`epistemic` 表示当前依据评估；accepted 发言不等于发言内容为世界真相。认知记录的 heard/read/believed/known/unaware 保持原始区别。

## 输入与前置条件

输入为通过 t07 唯一 schema 及引用校验的 `neurobook.memory.v7` 快照。`--data <path>` 指定文件，缺省使用随工具提供的两章金标；不依赖运行目录。每次进程只读取一个完整快照。

共有范围：`--at <chapter[:paragraph]>`，缺省为快照阅读上限；只有章号时取该章可读末段。`--perspective <reader|entity-id>` 缺省 reader；`--world <id>` 缺省 original。非法位置、未知世界或非可见主体视角被拒绝。结果不会越过当前阅读范围；故事时点筛选本版未提供，返回记录自身时间字段。

分页 `--limit <1..100>` 缺省 20，`--cursor <token>` 续页。游标绑定快照内容、范围、命令、筛选、顺序和页大小；输入格式坏或跨查询/数据使用返回明确错误。单条 get、info 不分页；explain 可限定 `--depth <0..8>`，缺省 2，同时按 limit/cursor 分页已限定深度的记录。未知参数、未支持选项和非法枚举拒绝，不能默默忽略。

## 输出与可观察行为

| 命令 | 主要输入 | 返回 |
| --- | --- | --- |
| `info` | 共有范围 | 作品与快照、范围内类型计数、实际材料/语义覆盖、能力与局限 |
| `entities` | 可选 `--query`、`--category` | 主体候选、当前可见名称和别名、类别；同名候选并列，不自动择一 |
| `search` | `--query`、`--kind` 至少提供一项 | 范围内记录文字的确定性子串匹配；只给 kind 时按类型分页列举，例如 episode/synthesis；不把 ID、引用、未来名称当作搜索材料 |
| `facts` | 可选 `--entity`、`--target`、`--predicate`、`--assertion`、`--epistemic`、`--query` | 完整命题及当前评估/依据入口；entity/target 匹配显式论元引用，两个条件同时提供时要求二者都参与，保留多元结构 |
| `knowledge` | 必填 `--holder`，可选 `--about`、`--mode` | 显式知情记录、可见目标命题及来源；about 匹配目标或命题显式主体论元，不以共现推断认识关系 |
| `summaries` | 必填 `--entity`，可选 `--facet` | 当前范围每个 facet 最新可用摘要，缺失/过期明确报告；不临场生成摘要 |
| `get <id>` | 精确记录 ID | 范围内单条记录、当前评估和依据入口；不可见/失效不返回原始正文 |
| `explain <id>` | ID、depth、分页 | 沿记录引用/依赖、当前评估及支持它的论证追溯，返回记录、前提和原文摘录，去重；不枚举主体的全部反向身份归属；达到深度时返回边界句柄，页满给游标；不可见引用只给句柄/状态，不取全书原记录正文 |
| `source` | 必填 `--chapter`，可选 `--from`、`--to`、`--query` | 读者范围内编号原文段落；范围越界拒绝，角色视角拒绝整段原文入口，可通过自身可见记录摘录取证 |

成功 stdout 仅有一个带 `schema: neurobook.memory.query.v1`、`ok: true` 的 JSON 对象及换行。共有快照/有效范围、`items`、`coverage`、`completeness`、`truncation` 与 `nextCursor`；记录项保留 ID/revision/kind、内容、assessment 与 provenance 句柄。无匹配是成功空集合，`corpusClosed` 保持 false；`recordsExhausted` 表示当前范围的确定性匹配集合已到末页，且 explain 没有因深度或不可见引用而阻断追溯，不证明小说内容不存在或语义提取完整。explain 的 `nextCursor: null` 只表示当前深度生成的集合没有下一页；被截断时仍为 `recordsExhausted: false`，由 `truncation.depth` 和 `unavailableReferences` 说明原因。原始 schema 引用可能指向不可见记录，不能据其 ID 推断正文；仅在当前投影内解引用。

depth 限定 explain 向其他记录的遍历层数，根记录为 0；每项内联的当前 assessment、原文摘录是该项的查询元数据，仍随记录返回。explain 的不可见引用计数覆盖本次生成的整个遍历集合，不因翻到末页丢失前页遇到的边界；其他命令报告当前返回页的不可见引用数。

默认不丢弃 tentative/disputed/unsupported，返回各自状态；明确 epistemic 筛选才排除。knowledge 结果缺少显式记录时返回空集合，不等同于 unaware；unaware 只来自显式记录，目标不可见时只保留引用，不展开正文。角色视角不带入读者额外论证、评估或完整原文。

排序确定且分页不重复/遗漏，entities 只匹配当前可见名称，按精确、前缀、子串匹配排序并返回 `nameMatches`；同级按可见位置、ID 排序。其他列表按可见位置、ID 排序，explain 按从根记录开始的逐层遍历排序。材料原文和领域内容均为数据，CLI 不执行其中的命令。

## 状态与转换

本能力不引入持久状态。每次读取、校验并固定快照后查询。分页游标可重复调用；文件改变后旧游标拒绝，调用者从第一页重新查询。不同并发进程各自读取文件，不写锁和缓存。

## 副作用与数据

仅读取显式文件或随工具金标，向 stdout/stderr 写结果。无网络、模型、数据库或作品写入，无持久索引和缓存。测试临时文件由测试支持包创建及清理。共享查询服务不访问进程参数或流，为后续适配提供同一行为边界。

## 失败与恢复

help 退出 0 并输出文本。成功查询退出 0，包括空结果。参数/范围/游标错误退出 2；文件读取或数据校验错误退出 3；请求的单条记录不可用退出 4；意外内部错误退出 1。失败 stdout 为空，stderr 为单个 `schema: neurobook.memory.query.v1`、`ok: false`、`error: {code, message}` JSON 对象，不输出堆栈或整本输入。修正参数/文件后重试；失败不会改动数据。

## 边界与兼容

t07 是唯一数据、类型、校验和范围投影 owner，本能力消费其公开入口；不得另建领域 schema 或通过读取原始节点绕过投影。CLI 参数和内部可序列化请求分离，后续 MCP/SDK 可适配同一查询服务。本版只承诺 v1 输出及已列命令，历史其他快照的选择通过 `--data` 完成。

## 验收与 Smoke

给定两章金标，`entities --query 苏天晴` 保留同名主体候选，`facts --entity su --target creator` 保留相关完整发言命题，`knowledge --holder su --about creator --at 1:65` 无命中而 `--at 1:66` 返回 heard 与 f119。`explain f119` 能到论证和披露，增大深度可到原文；受限深度/页数明确截断。全部 facts 翻页到 58 条，切换 scope 或修改快照后旧游标拒绝。

角色视角查 source 被拒绝，get 未来/失效记录无正文；前章名称检索不召回后章才有的名字；无知情记录不生成否定事实。坏 JSON、非法参数、越界阅读位置和不可用记录按退出码与流合同返回。开发者以真实 Agent 调用后的质量反馈作为下一轮 ingest 的推进条件。

在 t09 目录运行 `bun run test` 与 `bun run typecheck`；[查询合同测试](../../../.agents/works/w00005-novel-understanding-spike/tasks/t09-v7-query-cli/query.test.ts) 和 [CLI 进程测试](../../../.agents/works/w00005-novel-understanding-spike/tasks/t09-v7-query-cli/cli.test.ts) 共 16 项通过。实际 smoke 使用 `bun cli.ts knowledge --holder su --about creator --at 1:66`、`bun cli.ts explain f119 --depth 0`；从仓库外用 CLI 绝对路径同样可读取默认金标。命令、输出解释与交给 Agent 的验证任务见 [使用指南](../../../.agents/works/w00005-novel-understanding-spike/tasks/t09-v7-query-cli/USAGE.md)。

## 实现合同

实现 owner 为 [t09 查询服务](../../../.agents/works/w00005-novel-understanding-spike/tasks/t09-v7-query-cli/index.ts)，公开 `createQueryService(dataset)`、请求 schema、请求/响应类型和错误转换。服务固定并验证一个内存快照，每次结果不共享可变数据；不读文件、进程参数或输出流。[CLI 适配](../../../.agents/works/w00005-novel-understanding-spike/tasks/t09-v7-query-cli/cli.ts) 负责参数、只读文件及 JSON 流。服务消费 [t07](../../../.agents/works/w00005-novel-understanding-spike/tasks/t07-v7-schema-gold/index.ts)，依赖方向不能倒置。

## 证据

2026-09-10 开发者在当前会话明确要求先做 V7 CLI，验证查询接口后再做 LLM ingest 与 20 章试验。本 Spec 限定这一授权的只读能力；完整 V7 长期提案仍为 reviewing。上述 16 项测试、类型检查、真实 CLI smoke 及独立代码审查通过；尚未验证真实 Agent 的回答质量及 20 章规模。设计背景见 [V7 查询方案](../../proposals/novel-memory-v7/maintenance-and-query.md)，实现 provenance 见 [t09](../../../.agents/works/w00005-novel-understanding-spike/tasks/t09-v7-query-cli/README.md)。
