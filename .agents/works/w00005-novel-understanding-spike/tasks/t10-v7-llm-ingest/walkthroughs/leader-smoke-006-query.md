# 已发布 Smoke 的真实 CLI 检查

2026-09-11，Leader 在 t09 目录实际运行 `bun cli.ts --data ../t10-v7-llm-ingest/evidences/smoke-006/ch02/dataset-v7.json ...`。以下命令退出码均为 0；这是两章开发样本的验收证据，不是正式 20 章交付。

快照为 `llm-through-2`，contentHash 为 `4bd08a3be4c62da377fc89e6a51516dcedc24f68ee910d8ad45ec36a1d637858`。`info` 返回 2 章、163 段、676 条记录，其中 23 个 Entity、62 个 Fact、20 个 KnowledgeAccess、7 个 Episode、11 个 EntitySummary。材料 complete，语义 partial，corpusClosed=false。

## 查询结果

| 命令后缀 | 实际结果与含义 |
| --- | --- |
| `entities --query 苏天晴` | 两个主体：`c01:e_su` 当前苏天晴与 `c01:e_owner` 原主人；没有按同名自动合并 |
| `entities --query 苏天晴 --at 1` | 只有 `c01:e_su`，第二章揭示的原主人同名尚未进入名称投影 |
| `summaries --entity c01:e_su` | 返回当前 `c02:sum_su_ch2`，有依赖和 assessmentBasis；摘要表述仍需独立语义检查 |
| `knowledge --holder c01:e_su --about c01:e_creator` | 空；不能因此回答苏天晴不知道造物主 |
| `knowledge --holder c01:e_su --about c01:f_codex_role_plan --at 1:66` | 返回 `c01:acc_su_heard_role_plan`，mode=heard，证据 `c01:d_p66` |
| `source --chapter 1 --from 66 --to 66` | 返回古书声称造物主定制任务的原句 |

此前首章同一 CLI 还检查了 `entities --query 墨丘利秘典 --at 1:7`，为空；没有提前暴露其自称名称。首章快照 hash 为 `1267d0b37e05ad05d6c7ad1ecf984c68af162a903950ded5dab8f59f58267503`。

## 缺口一：听闻连接没有指向内容主体

`c01:f_codex_role_plan` 的显式论元是 speaker=古书、addressee=苏天晴、content=一整段文字。造物主只出现在 content 文字，因此按实体过滤的 knowledge 不命中。另一个 `c01:f_gives_tasks` 已有造物主与苏天晴论元，但没有听闻边指向它。

这是抽取连接的缺口，不能靠查询程序从台词自动推断知情。主线已把关键披露接收者应连接带明确内容主体的 Fact 写入通用 B/C 规则；该 Fact 仍保留 speech/holder，heard 不能升级成 known。旧开发数据保持不变，新策略需真实运行验证。

## 缺口二：覆盖说明泄漏未来内容

在两章快照运行 `knowledge --holder c01:e_su --about c01:f_codex_role_plan --at 1:66`，items 正确只给首章听闻，但顶层 `coverage.gaps` 同时含第二章神典石、每日任务、原主人同名等剧情。`entities --query 苏天晴 --at 1` 也有相同泄漏。名称和记录投影通过并不代表整个响应满足 readAt。

根因从代码确认：t10 把全部 `integration.gaps` 拼进无位置的 coverage.gaps；t07 只能缩小 coverage 的 through/chapters，不能过滤无位置信息。合同内修复是在 t10 导出时仅留下不含剧情的覆盖限制，具体逐章缺口留在审计与运行报告，保持可审查且不泄漏早期查询。已登记 Spec 和 Task，待主线实现、回归与独立复核。

## 摘要注意事项

首章 `sum_su_state` 将古书角色指派、系统提示的契约/绑定结果压成不带来源的状态句；C 曾通过仍不能视为无误。主线已为 B/C 增加摘要必须保留发言、思想、系统提示及不确定性的规则。第二章摘要的“原主死因与自己相同”等也应保留认知来源，正式产物需再次按引用逐条抽查。

## 后续实现的本地复核

11:05 Leader 独立运行 `bun run test -- compiler.test.ts runner.test.ts report.test.ts`，3 个文件 33 项测试通过。已阅读语义就绪队列、raw candidate 修复、跨轮 A 的来源收据与 report 计费入口；上述来源必须指向同章较早的实际模型阶段且内容哈希一致，报告仍强制每章每阶段恰有一次最终有效调用。该结果不覆盖尚未修复的 coverage.gaps，也不代表真实 20 章通过。
