# 有限语义返工的查询验收准备

按当前 quality-policy.md 调整 query_cli 拥有的 experiments/verify-published.ts；没有改动管线、提示词、t07或t09。旧 formal-003、formal-004 保持停止，不按新代码恢复。新策略尚未冻结/运行，因此本文只记录验收工具准备，不表示20章完成。

原验收程序要求C全passed，不再适用于开发者接受的有限返工及pending隔离。现在仍校验所有审查单元恰好有一次判定，同时将每章rejected对应的真实记录ID累积下来，在每份后续发布快照逐个确认它仍为pending，且在完整reader查询投影中不可见。原文/hash/连续快照/结构/确定性重编译与零调用重复执行检查保留。

逐快照输出本章rejected数量、missing数量、累计rejected单元、直接pending记录数、完整reader可见和不可见记录数。不可见数包含依赖、旧摘要新鲜度及范围规则，不能把它全算成pending造成的损失；具体关键查询仍单独实测。名称词面审计作为独立质量指标保留，不成为发布硬门禁。

本次执行 bun run typecheck 退出0。没有在旧策略快照上冒充新策略重编译验证；待新smoke实际发布后检查通过与隔离行为。
