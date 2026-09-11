# 质量、价格与复杂度方向修订

2026-09-11开发者要求停止推进，先分析并重写计划。本轮没有新增模型请求或业务代码，不撤销已有实现。主Agent确认smoke-008的Node PID33040属于本次运行后停止该进程；manifest.head=0，首轮C请求没有已保存响应，结果与费用未知，登记在对应stop.json。该中断不算模型质量失败，不是完成的smoke。

分析依据为已有逐轮原文核查、思考模式对照、t07 schema/query以及t10 draft/compiler。结论是现有阶段数和逐项复核仍缺少产品收益对照，最多一次返工只是局部改进。后续先以有依据的查询回答评价，再缩小默认建模，最后按实际开销决定是否试验A/B合并；不直接取消C或伪造passed，不更改t07、EntitySummary和t08。

更新文件为Task README、plan.md、quality-policy.md、scale-and-cost.md和ingest Spec的暂停/评价目标说明；新增smoke-008/stop.json及本记录。候选仍属研究计划，未晋升Spec状态。后续从计划步骤1开始，正式20章目标保留；本轮停在计划交付，符合最新用户指令。

验证：governance:context确认worktree、分支、tasker身份且failures为空；docs:check通过7346个文件（新增本记录之前），受影响已跟踪文档的git diff --check通过，仅有正常换行提示。额外结构化核对确认策略-5的8份源码与policy-source.json逐份一致、head=0、唯一未知响应与stop.json一致；进程查询确认PID33040已不存在。没有重跑业务测试，80项测试通过是上一轮策略-5的证据，不是新候选的结果。

只做本地计划修改，未提交或push；旧V6改动和已有未提交策略代码保留。开发真实DeepSeek调用无限授权仍有效，此次暂停原因是用户要求重新规划。
