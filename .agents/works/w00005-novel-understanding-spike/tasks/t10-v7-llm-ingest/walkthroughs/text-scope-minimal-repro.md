# 提前泄漏后续名称：最小复现

最新：formal-004正式首章在相同策略 -4 下再次复现，而且进入fact正文。实际 `get c01:f_book_asks_name --at 1:13` 返回“黑色古书（墨丘利秘典）向苏天晴要求姓名。”；正式名实际1:29才出现。详见 [query-cli-formal-004.md](query-cli-formal-004.md) 的两条直接CLI及 ../evidences/formal-004-query-verification-ch01.json。首章结构通过不表示该正文时间边界通过。

query_cli 于 2026-09-11 在已停止、只读的 formal-003 已发布第三章快照执行三次真实 CLI get，均退出 0。完整返回见 ../evidences/formal-003-text-scope-get.json。这里验证的是查询实际可见文本，不是根据源码推断。

在 t10 目录运行：

```powershell
node --import tsx ../t09-v7-query-cli/cli.ts --data evidences/formal-003/ch03/dataset-v7.json get c01:t_now --at 1:7
node --import tsx ../t09-v7-query-cli/cli.ts --data evidences/formal-003/ch03/dataset-v7.json get argument:c01:i2 --at 1:7
node --import tsx ../t09-v7-query-cli/cli.ts --data evidences/formal-003/ch03/dataset-v7.json get assessment:c01:i2:at:1:7 --at 1:7
```

三者 availableAt 都是 1:7，却分别在 time.label / time.data.description、argument.data.rationale / argument.data.review.note、assessment.data.note 中包含“墨丘利秘典”。该段原文只说“黑色古书”，argument 的显式依据也仅指向 1:7，没有后续自称的依据。其 rationale 更直接写出“后续自称墨丘利秘典”。

同一快照 entities --query 墨丘利秘典 --at 1:7 为空，search --query 墨丘利秘典 --at 1:7 返回上述三者。因此实体名称投影有效不能证明整个返回安全，去掉搜索字段也不能修好 get。原数据、候选及冻结运行代码没有改动。

smoke-007 首章现已发布，其五个实际主体名称的首次原文出现前边界抽查均无命中，详见 query-cli-smoke-007.md。Parent 拥有通用修复边界和运行控制。

## 同类问题在旧数据的第2、3章也复现

追加一个无小说专用 ID 的只读审计：从实际实体 names 提取至少两字符的名称，查找各名称首次原文出现位置，投影到上一段，扫描 presenter 返回的完整字符串字段。脚本原文、全部结果及直接 get 保存在 ../evidences/text-scope-lexical-audit.json。扫描 formal-003 的 32 个名称及 smoke-007 的 5 个名称；这只是词面候选发现，不能自动当作语义错误或防泄漏完备性证明。

两个追加的明确最小复现，实际 CLI 均退出 0：

```powershell
node --import tsx ../t09-v7-query-cli/cli.ts --data evidences/formal-003/ch03/dataset-v7.json get argument:c02:i_guardian_star --at 2:33
node --import tsx ../t09-v7-query-cli/cli.ts --data evidences/formal-003/ch03/dataset-v7.json get c03:t_ch3_morning --at 3:5
```

前者在 2:33 的 rationale 写“后被称为守护之星”，但该段只说“金色十字星”，名称首次在 2:38 激活界面出现。后者在 3:5 的 time.label / description 写“看风信子视频……并制定蹲点计划”，但本段只有端早餐刷手机；风信子名字直到 3:16 才被念出。两者证明这不是单条古书身份记录的偶发措辞。

审计还命中“魔法少女（反派）”和“蓉城医学院”，前文已有反派魔法少女、蓉城最好的医学院等同义/描述信息，因此不能仅凭这些精确词串的首次出现认定提前泄漏。本轮明确报告的仍是古书正式名、守护之星正式名以及时间节点提前包含后续情节。
