# V7 设计与反例复核记录

日期：2026-09-09。Work `w00005-novel-understanding-spike`，Task `t06-v7-model-design`，role `leader`，Issue 为 null。实际 revision `467d9a30251eb65d50f8270f02e52e394b64140e`，分支 `feat/w00005-v6-ingest-viewer`。本文保存执行证据，不替代 [提案正文](../../../../../../docs/proposals/novel-memory-v7.md)。

## 授权与检查边界

开发者要求完整设计 V7、反复推敲多种情况及工程可行性，文档落盘后再审查。本轮完成本地文档设计，未将提案自行接受或登记为 planned Spec，未实现 V7，未调用小说提取 Provider/embedding，未修改 V6 数据及代码，未暂存、提交、推送或发布。

读取交接文档、t05 需求、初版/V3/V4/V5/V6 相关设计、V6 ingest 及真实 dataset 中第 8–10 章。仅查看 nb-memory、nb-workflow、nb-history 的 README 评估边界，未完成包实现或产品集成审查。另核对 SQLite 官方隔离与 FTS5 文档；这些只支持存储和检索机制，不证明领域模型或性能正确。

使用 domain-modeling、spec-driven-development、doubt-driven-development、decision-brief 与仓库 writing-for-agents 的相应方法。遵守开发者本轮“完成后再审查”的明确要求，中途不设置逐阶段确认；没有外部跨模型 CLI 审查。独立审查使用当前工具提供的隔离上下文子 Agent，结论不代表开发者批准。

## 改动范围

新增：

- `docs/proposals/novel-memory-v7.md`。
- `docs/proposals/novel-memory-v7/knowledge-model.md`。
- `docs/proposals/novel-memory-v7/maintenance-and-query.md`。
- `docs/proposals/novel-memory-v7/scenarios-and-validation.md`。
- 本 Task README 和本记录。

修改：Work README 增加当前 t06 入口，提案 README 增加 reviewing 索引。t05 需求原样保留；旧版本设计和产物均未改写。

## 第一轮：两个独立边界审查

审查前的主张：实体拆分必须能恢复具体材料归属；全书身份不能泄露人物认知；发布与查询必须在后台修正期间保持可解释且不混合版本。审查者只收到待审文档、需求路径和反例任务，未收到上述主张或作者论证过程。

### 知识模型审查

Agent `v7_knowledge_review` 独立读取知识模型与需求，提出两条。均按正文核对后分类为 **valid + actionable**：

| 发现 | 修正 | 复核结果 |
| --- | --- | --- |
| P1 世界身份归一化会改变角色信念含义 | 知识模型 §4.4 保留持有者身份呈现；替换需其自身知道同指的依据；I06 | 原审查者复核已闭合，无新实质问题 |
| P2 单个 Referent 内部误消歧无法拆开 | §2.1/2.3 为入记忆论元保留 Mention/Span，允许局部 Referent 拆分和材料重提取；I05 | 原审查者复核已闭合，无新实质问题 |

### 维护与查询审查

Agent `v7_runtime_review` 独立读取维护、知识模型与需求，提出四条。均为 **valid + actionable**：

| 发现 | 修正 | 复核结果 |
| --- | --- | --- |
| P1 新反证水位没有明确保护间接依赖 | 维护 §3.4 对全部依赖前提订阅分区做有效性检查；D04b | 原审查者复核已闭合 |
| P1 同知识快照下异步索引补齐导致漏页 | §5.3/8.1 固定检索视图、覆盖、路径与评分版本，canonical 穷尽单独判定；Q09 | 原审查者复核已闭合 |
| P1 旧 manifest 当前知识的选择不明确 | §8.3、知识 §1.1 增加 per-manifest head、成员生命周期和共享提取纠错传播；Q10 | 原审查者复核已闭合 |
| P2 取消与 validated 后的发布竞争 | §2.2/8.2 事务内检查任务状态/generation，明确先提交者结果；E04b | 原审查者复核已闭合 |

## 第二轮：跨文档反例检查

Agent `v7_final_review` 使用新的隔离上下文完整读取需求和四份提案，检查共同语义、条件组合和八类使用场景。提出三条，均为 **valid + actionable**：

| 发现 | 修正 | 复核结果 |
| --- | --- | --- |
| Argument 到 Assessment 汇总缺乏可执行判定 | 知识 §7.1/7.3 明确前提强度、usable/conditional/challenged/blocked、命题反证和 Argument 质疑，增加确定性决策表；D09/D10 | 原审查者复核主体规则已闭合 |
| AND 前提可能来自不相交时间或不同变量对象 | 知识 §7.1 定义变量绑定与联合适用环境，场景 §3.0 增加真实互动和合成权限推演；F10/F11 | 原审查者复核主体规则已闭合 |
| 上位类别集合可能漏掉已整理子类成员 | 知识 §4.2、维护 §5.2 定义有限类别闭包、歧义、截断、去重与派生依据；Q11 | 原审查者复核主体规则已闭合 |

复核另指出合成权限样例中“后文时间与既有 t3 依据冲突”被直接当成旧 Argument 无效，违反刚补的冲突表。分类为 **valid + actionable**，改成先重审/争议，确认旧提取误读并撤回支持后才否决。最终定向复核确认该段直接矛盾已消除，三项问题闭合。两轮独立审查共处理 10 个实质发现（含该样例矛盾），当前没有未处理的审查发现；达到无新增实质问题的停止条件。

本轮还自检并固定原文坐标单位为存储正文的 UTF-16 code unit 半开区间、禁止截断代理对，避免把关键证据坐标合同留给实现者猜测。共形成 60 行反例验收矩阵；这些是计划中的案例，不是 60 个已通过测试。

## 验证记录

- `bun run governance:context --work w00005-novel-understanding-spike --task t06-v7-model-design --role leader`：已运行，通过，failures 为空，身份与本记录一致。
- 首次 `bun run docs:check` 在 walkthrough 尚未创建时报告 1 个悬空链接，目标正是本文件；创建后重跑通过，checkedFiles 为 6118，failures 为空。
- 对工作树开始时 t01–t05 范围内 Git 已修改/未跟踪的 716 个文件按路径排序，计算每文件 SHA-256 后再计算清单摘要。基线与正文初次完成后的摘要均为 `C54FF6D411B8D80173A69491708671D0404AE5A58224DB30883D34EC083B7BB3`。此检查不包括本轮允许更新的 Work README。
- 六个新增 Markdown 的 23 个本地链接目标均存在；60 行反例矩阵已计数。两个修改入口的 `git diff --check` 通过，六个新增文件逐行 trailing-whitespace 检查为空；Git 只提示当前配置下未来 LF/CRLF 转换。
- 运行时测试、模型问答、浏览器、性能和费用实验未运行。文档门禁证明路径、格式和治理身份，不能证明 V7 行为正确。

## 留给开发者的审查边界

提案记录推荐决定，不再把基本模型问题悬置为“以后再设计”。正式序列化 schema、DDL、MCP 名称、模型选择及量化预算仍是实现前工程配置；它们不能改变已经提出的语义边界。

运行效果仍未验证，特别是语义复核准确性、长篇材料覆盖、依赖膨胀和中文检索成本。下一步由开发者审查 reviewing 提案；独立 Agent 的无新增问题结论不替代这一步。
