# 正式运行前缀的 CLI 检查

本记录随实际发布前缀追加，不代表 20 章验收已完成。运行身份为 `formal-002`，inputHash=`4875ca2cd860109dcce836d4164b53082eec2cab791ec53b7ce7f9283a72a7c4`，policyHash=`aa25575fa65820c9131c2a179feefdb1d606413d53362d327d2ae55cfdc47957`。原始失败与模型产物不改写。

## 首章实际结果

Leader 实际运行 t09 `bun cli.ts --data ../t10-v7-llm-ingest/evidences/formal-002/ch01/dataset-v7.json ...`，下列命令均退出 0。快照 contentHash 为 `34fedabc4cea9bd92242afcc16ac79b6fa8d5312766423d4dba45dca6933789f`，76 段、240 条记录，其中 8 个 Entity、15 个 Fact、12 个 KnowledgeAccess、5 个 Episode、8 个 EntitySummary。语义覆盖仍为 partial。

1. `entities --query 苏天晴` 发现 `c01:ent_su`；`entities --query 造物主` 发现 `c01:ent_creator`。本轮 ID 与 smoke 不同。
2. `knowledge --holder c01:ent_su --about c01:ent_creator --at 1:65` 的 items 为空；相同查询改为 `--at 1:66` 后返回 `c01:a_su_heard_role_assignment`，mode=heard，目标 `c01:f_book_assigns_role`，证据 `c01:d36`。
3. 目标 Fact 显式保留 speaker=古书、addressee=苏天晴、task_source=造物主；assertion 为 speech，holder=`c01:ent_book`，opaque=true。接受这条发言记录并不代表造物主定制任务已被确认为世界真相。原来按造物主主体查不到听闻的缺口，在本次真实自动产物中已关闭。
4. `summaries --entity c01:ent_su` 返回 `c01:sum_su`，使用“苏天晴回忆”“她认为”“墨丘利秘典称”“古书称”等来源限定。`summaries --entity c01:ent_creator` 返回 `c01:sum_creator`，facet 为“古书宣称”，正文明确“古书称造物主……”。这两条摘要没有把相关说法升级成无来源世界状态。

## 覆盖说明修复

首次检查时，`--at 1:65` 的 coverage.gaps 已提及第66段及以后造物主、系统声音等剧情。2026-09-11 已在 t09 统一输出边界修复：受限范围只返回通用说明，完整 reader 保留原文，摘要和综述内部同样处理。6 次真实 CLI 复验通过，包括 1:7 名称、1:65/1:66 听闻与角色视角；数据指纹未变。见 [独立范围修复记录](../../t09-v7-query-cli/walkthroughs/2026-09-11-coverage-scope.md)。该修复没有修改活动运行策略或已发布文件。

第二章以后主体复用、相识过程、摘要与最终成本待真实发布后检查。首章经过多轮修复，不能仅以首章费用外推成品价格；最终以完整正式前缀计量并区分有效调用与修复。
