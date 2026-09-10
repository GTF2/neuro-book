---
schema: nbook.task/v2
taskId: t07-v7-schema-gold
role: tasker
---

# V7 具体 schema 与前两章金标

## 2026-09-10 继续优化

开发者在询问模型层、摘要、世界命题与古书身份后，授权继续优化 V7，明确排除 EntitySummary。保持 EntitySummary 字段、语义、摘要标注与更新机制不变；本轮修复名称/指称/身份的证据依赖与范围投影，确保撤回名称依据可使显示名失效且不抹去持续实体。区分对象同一性与对象自报名真实性；所有名称均需可追溯的材料，不能靠空依赖的最终名称缓存。审查世界断言、角色信念、发言内容及评估状态的现有合同，修复同合同缺陷，不引入生产存储或自动抽取。旧版只读。新增回归验证、重新生成金标与 schema，记录语义变化和局限；与 t08 协调后交付。

2026-09-09 开发者要求补齐具体 V7 数据结构、实体 summary 查询优化，并从主工作区 `.local/novels/转生反派萝莉，找茬魔法少女.epub` 前两章制作金标；允许根据实际抽取调整模型。此为本地设计验证 spike，提案仍待审查，不替换产品实现。

在既有 Work worktree、`feat/w00005-v6-ingest-viewer` 分支执行。参考 [V7 提案](../../../../../docs/proposals/novel-memory-v7.md)、[需求](../t05-v7-requirements/requirements.md) 和 V4 主体摘要设计。只读旧版、第三方 EPUB 和既有用户改动。

本 Task 拥有具体 schema、结构/引用校验、样书规范化来源、手工语义金标、金标构建和聚焦验收；`docs/proposals/novel-memory-v7/schema-and-projections.md` 保存字段与投影语义。源数据和金标属于需交付的审查材料，不是临时测试文件。查看器由 [t08](../t08-v7-memory-viewer/README.md) 拥有，共用本 Task 的唯一 schema。Leader 负责语义标注与取舍，Tasker 负责 schema 和工具实现；各自写入边界通过派发消息约定。

验收：可机读 schema、严格类型及运行期校验一致；引用和证据位置有效；两章 Beat 连续覆盖；材料/认知/推断区分；实体摘要可展开逐项依据；前章查询不泄漏后章；错误输入被拒绝；生成物两次构建一致。记录真实验证和尚未验证的模型自动抽取质量。允许本地浏览器自动验证，不宣称开发者人工验收；无远端写入、提交、部署或外部 Provider 调用。

执行结果写入 walkthroughs；完成后交开发者审查。

## 交付与复核入口

具体结构和摘要查询见 [schema 与投影](../../../../../docs/proposals/novel-memory-v7/schema-and-projections.md)；[金标语义审查](walkthroughs/gold-review.md) 说明选取与修正依据，[恢复验证](walkthroughs/verification.md) 记录来源复现、12 项测试和生成物确定性。前两章金标是待开发者审阅的参考答案集，尚不代表自动抽取质量。
