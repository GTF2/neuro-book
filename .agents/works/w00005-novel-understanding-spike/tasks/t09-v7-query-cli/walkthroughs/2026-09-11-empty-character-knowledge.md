# 无知情记录的角色自查询

真实formal-003第3章快照中，`knowledge --holder c01:e_su --about c01:e_book --at 1:10 --perspective c01:e_su --limit 100` 原先退出2，报Expected a visible entity ID。reader视角的同一查询成功为空。根因是scope已验证当前角色，但没有显式KnowledgeAccess时，角色投影未包含该主体；命令又按空投影重复拒绝holder。

t09参数验证现在接受已经通过scope验证的当前视角主体，仅用于knowledge与summaries。结果仍从原角色投影生成，没有把读者主体、额外知情或原文放入结果；其他不可见主体仍拒绝，get/explain边界不变。t07、领域schema、数据和t10运行策略未改。

回归测试修改前失败于Expected a visible entity ID；修改后本Task全部19项测试通过，typecheck通过。实测上述formal-003 CLI退出0，items为空、corpusClosed=false，scope仍为角色c01:e_su及1:10。测试同时验证自己的缺失摘要、其他主体仍拒绝、自己的get仍按原投影拒绝，以及无效视角不能自我豁免。空集合不表示unaware。

改动为service.ts参数边界、query.test.ts、Task入口与查询Spec。未运行浏览器或仓库全量测试；本次不包含领域投影变化。
