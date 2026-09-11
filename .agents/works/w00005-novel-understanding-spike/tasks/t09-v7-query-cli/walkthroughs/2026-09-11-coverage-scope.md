# 覆盖说明的查询范围修复

2026-09-11，当前 Agent 接续 t09 Tasker 完成实现与复验。真实 LLM 输出的 `coverage.gaps` 含剧情说明；t07 会裁剪覆盖章段，却没有足够元数据裁剪这些字符串。早 readAt 查询的 items 虽正确，整个响应仍会泄漏未来内容。

修复位于 t09 `createRecordPresenter` 的统一输出边界：完整快照 reader 范围且没有过滤其它世界时保留原说明，其它范围返回通用的缺口说明。顶层以及 EntitySummary/Synthesis 内嵌 coverage 统一处理，不修改输入、t07 合同或已发布文件。代价是受限范围暂时没有具体缺口文本，仍明确报告语义 partial；需要精确说明时应在未来合同中给说明添加范围。

新增两项回归先失败后通过，覆盖早 readAt、角色、世界过滤、显式可读的摘要/综述、完整 reader 保留说明和输入不变。全部 18 项测试、strict typecheck 通过。自审确认所有记录输出经过同一 presenter，顶层经过 presentCoverage，通用说明不会声称没有缺口。

实际从 t09 目录运行 `bun cli.ts --data <snapshot> ...`，以下 6 次调用均退出 0：

| 快照 | 命令 | 观察结果 |
| --- | --- | --- |
| formal-002/ch01 | `entities --query 墨丘利秘典 --at 1:7` | items 为空，coverage 仅通用说明 |
| formal-002/ch01 | `knowledge --holder c01:ent_su --about c01:ent_creator --at 1:65` | items 为空，coverage 仅通用说明 |
| formal-002/ch01 | 同一 knowledge，`--at 1:66` | `c01:a_su_heard_role_assignment`，heard，目标仍为古书 speech/opaque |
| formal-002/ch01 | 同一 knowledge，`--perspective c01:ent_su` | 听闻可见，coverage 仅通用说明 |
| formal-002/ch01 | `summaries --entity c01:ent_creator` | 完整读者范围保留原 gaps，摘要明确“古书称” |
| smoke-006/ch02 | `knowledge --holder c01:e_su --about c01:f_codex_role_plan --at 1:66` | 原听闻正常返回，不再附第二章剧情缺口 |

响应中的数据指纹保持原值：formal-002/ch01 为 `34fedabc4cea9bd92242afcc16ac79b6fa8d5312766423d4dba45dca6933789f`；smoke-006/ch02 为 `4bd08a3be4c62da377fc89e6a51516dcedc24f68ee910d8ad45ec36a1d637858`。没有手改已发布数据。上述查询验证针对这个具体泄漏，不能替代最终 20 章语义质量验收。

独立 Reviewer 已复核同一输出边界并在真实两章数据复现修复，未发现新阻断：受限查询不再包含原始 20 条 gaps，完整读者查询仍保留。`bun run docs:check` 检查 6690 个文件通过，`git diff --check` 通过。未执行全仓库测试或浏览器验收，本改动没有修改查看器。
