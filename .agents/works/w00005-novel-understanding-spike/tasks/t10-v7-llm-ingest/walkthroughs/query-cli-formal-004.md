# formal-004 逐章只读复验

策略 -4，policyHash db2d3861ac85b2f062c3cf2fdd8e1550105c55fb4d0f72560fb312bd35f2a0cc。formal-004 已于14:56由主 Agent停止在head=1，不得恢复该目录。原因是已发布首章的正文提前名称泄漏；主 Agent正实现新词面时间保护并准备新策略smoke/20章。query_cli 仅消费实际发布前缀。旧 formal-003 也已停止，本文不沿用其完成数字。20章验收仍未完成。

## 首章发布前

第1轮 C 全部180个逐项单元通过，但报告 integration 漏项：苏天晴明说财富及变成萝莉的愿望、其签约动机缺少发言事实、古书heard与摘要内容。A 已通过，因此第2轮复用原材料，仅生成新B。

第2轮 C 又发现 A 的 d_11 将第19段已发出的“你干嘛呢”和第21段“不疼的吗？”合成同一次voice/question；第20段叙述古书的不理解，21段没有古书发言使用的括号，不能据此建立苏天晴heard古书内心疑问。当前B还将第66段“任务帮助她走上顶点”错归为“古书帮助”，以及摘要依据不完整。第3轮因此重新抽取A，尚未发布。此前C通过材料不等于该材料以后不会被复核发现错误；不把所有重复调用都当作结构补丁可节省的成本。

## 查询重点

首章将复验来源/schema/连续快照/重编译、古书正式名之前的所有返回字段、造物主听闻在1:65/66的边界。后续检查同名人物、任务目标与风信子的连续指称、跨章摘要、不同人物各自的守护之星、角色视角及原文证据。

名称词面审计从实际Entity.names及原文首次位置产生检查点，不把验收答案或金标作为模型输入。它可以发现提前名称泄漏，但同义转述和整章自由文本仍需语义判断；“未命中”不是防泄漏完整证明。

## 已发布首章：结构通过，但正文提前名称仍复现

14:49复验 head=1，76段、2036字符、266节点、162个逐项复核单元，快照 sha256 75bc03107b7b9d60e28d29cf76703fb1634ef01759304fb6155d2077bf9d2943。原文/input hash、完整材料与C、schema/引用/时间、确定性重编译和最新快照一致性全部通过。完整验证与查询证据见 ../evidences/formal-004-query-verification-ch01.json。

这份正式随机样本再次出现早期文本泄漏，且已不限于论证、注释或时间文本：

```powershell
node --import tsx ../t09-v7-query-cli/cli.ts --data evidences/formal-004/ch01/dataset-v7.json get c01:f_book_asks_name --at 1:13
node --import tsx ../t09-v7-query-cli/cli.ts --data evidences/formal-004/ch01/dataset-v7.json search --query 墨丘利秘典 --at 1:13 --limit 100
```

两者实际退出0。get的fact.label / data.proposition写“黑色古书（墨丘利秘典）向苏天晴要求姓名。”，而名称到1:29才出现。其assessment.label及argument.label派生复制相同文字。search还返回1:11可见的 argument:c01:id_r_book，其rationale写“其名墨丘利秘典由后文披露”。此外1:19“你干嘛呢”与1:21“不疼的吗”的fact正文也直接使用墨丘利秘典。全部实体names边界仍正确，因此不能把问题归为实体名称投影。

首章知情查询的正向项通过：当前苏天晴 c01:e_su_tianqing，造物主 c01:e_creator；knowledge在1:65为空，在1:66返回 c01:a_su_heard_creator_customized_tasks -> c01:f_creator_customized_tasks，heard且保留speech/古书holder/opaque。古书内心 c01:f_book_thinks_no_pain 的苏天晴knowledge为空，说明前述thought/heard错误已在发布数据中修正。

已明确保留并报告正文提前泄漏，未修改候选、快照或冻结策略。运行曾进入第2章，随后主 Agent受控停止；stop.json保留第2章第1轮C请求无响应的未知费用状态。20章仍未完成。

t09 查询实现已由主 Agent在3e764d60修复无KnowledgeAccess时当前视角holder不可见的问题。对本快照实际运行 `knowledge --holder c01:e_su_tianqing --about c01:e_mercury_codex --at 1:10 --perspective c01:e_su_tianqing --limit 100` 退出0并返回空集合，未再报Expected a visible entity ID。原输出保存于 ../evidences/formal-004-empty-character-fixed.json；此项仅变更查询实现，不改变旧ingest快照或正文泄漏状态。
