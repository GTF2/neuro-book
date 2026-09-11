# formal-003 逐章结构与查询复查

query_cli 只读消费正式产物，主 Agent 唯一控制活动运行及恢复。formal-003（策略 v7-ingest-2026-09-11-3）已停止在第4章第6轮B的已保存检查点，head=3；不得用新源码恢复。主 Agent 正接入按记录替换的结构重试并准备新策略/新目录，见Task README及 `formal-003-runtime.md`。实际20章验收仍未完成；本文件是旧策略前三章与失败复核的证据。

新增 `experiments/verify-published.ts` 用于复验已发布前缀：显式指定 head，核对原 EPUB 归一化输入、连续发布、逐章 schema/引用/时间/哈希、完整材料和逐项复核，并确定性重编译最新快照。可选 `--check-rerun` 仅在活动写入者退出后执行，以会抛错的假 provider 验证重复运行调用数和请求审计数量均不增加，旧候选/快照文件字节不变。它不读取凭据、不调用模型、不修改正式策略。

12:27，`bun run typecheck` 退出 0；`node --import tsx experiments/verify-published.ts --run-dir evidences/formal-003 --epub <登记EPUB路径> --head 1` 退出 0。首章 76 段、2036 Unicode 字符、346 条节点、211 个逐项复核单元；快照 hash `31fe9daf656adfb4bac0b4a0b75c7d01b2f6975e152ae5018961e106f9978a71` 与确定性重编译一致。活动进程尚在运行，未执行重复运行检查。

第2章第1轮 C 拒绝 `material:d_32`：原文“敲一下？搓动某个位置？”是内心设想，候选误记为已尝试动作。missing 正确归为 material，下一轮重新提取 A。第2轮 B 首次产生非法 episode relation 枚举，后续结构修复已通过，C 从 12:28 开始。这些是候选失败记录，不是已发布数据错误。

## 已发布两章

12:31 复验 head=2 通过，163段、4234 Unicode字符、688节点；第2章173个复核单元通过，确定性重编译与最新发布一致。原始输出保存于 `evidences/formal-003-verification-ch02.json`。第1章快照哈希与前次相同。CLI `entities --query 苏天晴 --limit 100` 返回两个独立主体：`c01:e_su` 与 `c01:e_originalOwner`；原主人的名称依赖 `c02:i_su_original`，从2:18才可见。身体和古书的第2章身份继续分别指向 `c01:e_body`、`c01:e_book`。`summaries --entity c01:e_originalOwner` 返回新摘要 `c02:s_original_ch2`，保留原主身世与苏天晴判断的区别。作者成年声明 `c02:f_paratext_adult` 的 assertion 为 paratext/holder=null，未升级世界事实。

本章发现两个需要交付披露的检索/数据局限，未改冻结实现或候选：

- 原主人仍保留第1章创建时的 category=unresolved；已明确为身体的前主人且有新姓名/身世后，`entities --query 苏天晴 --category person` 会排除它。不加 category 的同名发现正常。这是持续主体类别没有随证据细化的问题。
- 最新快照的 coverage.gaps 累积保留第1章“原主人的姓名、身份、去向……未知”，与第2章已查出的姓名和死因冲突；还包含第一章“allowedIds为空”的运行上下文说明。gaps 是历史累积的字符串，缺乏章段与已解决状态，不能作为当前事实。早期/受限范围已被t09安全替换，但完整读者范围仍可见这些过时说明。

12:33 六次实际 CLI 的完整 JSON 保存在 `evidences/formal-003-queries-ch02.json`，全部退出0：category=person仅返回当前意识；不加类别时原主姓名在2:17不可见、2:18可见；秘典名在1:7为空；造物主听闻在1:65为空、1:66返回 `c01:a7`。所有受限查询只返回通用 coverage.gaps，未泄漏后章剧情。

## 已发布三章：一处跨章身份缺口

12:56 复验 head=3 通过，250段、6906字符、1089节点，第3章197个复核单元。`evidences/formal-003-verification-ch03.json` 保存完整结构/原文/重编译验证；前两章哈希仍相同。

实际查询发现：第3章创建风信子 `c03:e_fengxinzi`，但未与第2章任务目标 `c02:e_official_magical_girl` 归并，也未建两者的身份关系。`facts --entity c03:e_fengxinzi --target c02:e_official_magical_girl --limit 100` 返回空。旧任务目标的摘要在第3章被复用为 `c03:summary-reuse-9b6a580993886c19`，仍写“姓名与身份未揭示”。这会使按旧任务目标查后续对手的 Agent 缺少连续身份线索。

依据是原文3:11“目前就正好有一名活跃的魔法少女”、3:13“这名魔法少女”的视频、3:14“提前了解接下来的对手”、3:16念出代号风信子；结合2:82–84的蓉城正牌魔法少女任务，至少应表达带依据的任务目标关联，不应只剩两份断开的主体记录。不是仅凭同名推断合并。

复核过程也说明随机性：第1轮 C 曾以这个缺口拒绝 `i_fx`；第2轮 B 按意见复用旧主体，但 C 又发现旧A的两处归属错误而要求重提取。第3轮 A/B重新生成后再次新建风信子，C此时只核对3:15–16的章内身份并判passed，没有重查这条跨章连续性。原始记录与已发布快照未手改，六份策略源码未改；此问题报告给Leader作为正式20章质量结论的一部分。

第3章原主人摘要明确使用“叙述披露”，风信子摘要保留秘典情报/视频/苏天晴判断；反派一般概念与具体角色分开，具体角色继续指向 `c02:e_villain_role`。这些检查不能抵消上面的身份缺口。

## 未发布第4章的复核误判样本

第4章第4轮 C 在发现真实来源/观察者错误之外，也错误拒绝了一条正常转述。`material:d34` 原文为4:47“秘典！你给我的强化药该不会是假的吧？！”；候选为“苏天晴想质问秘典：给她的强化药该不会是假的吧。”，holder=r_sutianqing、channel=thought，about包含苏天晴、秘典、药剂。转述中的“她”仍指发问者苏天晴。C却以“原话是‘你给我的强化药’，d34写成‘给她的强化药’，改变受事”拒绝；这不是由候选支持的受事变化。

该样本说明 semantic rejection 的数量不能直接当作真错误数量，独立C也会误判人称转述。第4轮另有把白灵看到十字星写成风信子看到、把南小风内心推测写成叙述事实等真实问题，所以不能据这一条误判越过整轮拒绝。保留原响应与候选，未改变运行或替模型改判。

第5轮还出现前后评语相互纠正的样本：第4轮 C missing声称“第20段明确白灵自称观星者精灵”，要求补身份事实；第5轮 A 的 b7写成“自称观星者精灵”，第5轮 C 又正确指出原文是“自称白灵的观星者精灵”，自称对象是名字，拒绝了这一转换。第5轮另捕获南小风与苏天晴的两枚守护之星被合并等真实问题；不能把全部反复修复都归因于误判。当前仍无第4章发布结果。

## 早期文本搜索确有后续名称泄漏

在已发布 `formal-003/ch03/dataset-v7.json` 执行 `search --query 墨丘利秘典 --at 1:7 --limit 100`，实际退出0并返回3条；`--at 1:10` 同样返回3条。完整JSON保存于 `evidences/formal-003-text-scope-ch03.json`。这修正了此前仅以 `entities --query 墨丘利秘典 --at 1:7` 为空即认为未来名称已完全阻断的结论：主体名称投影正确，其他文本字段仍泄漏。

- `argument:c01:i2` 在1:7可见，rationale为“第7段黑色古书作为漂浮对象出现，后续自称墨丘利秘典；r2映射为魔法古书/artifact实体。”；review.note也写“第7段黑色古书与后文自称墨丘利秘典对应同一artifact”。它的显式premises只有1:7的mention及d4。
- `assessment:c01:i2:at:1:7` 把相同C评语写入note，因此也在1:7暴露后续名称。
- `c01:t_now` 早期可见，但label/description为“第1章当前场景：苏天晴在昏暗房间与墨丘利秘典对话。”。

这是模型自由文本与C评语被赋予较早可见时间导致的问题，不能只通过Entity.names或coverage.gaps投影解决；更不能把搜索改为不搜这些字段就当作修好，因为get/explain仍能读到。新策略若处理此项，应在记录的正文/理由/评语/时间描述等字段统一遵守可见范围，并用实际早期全文搜索及get/explain补验收。旧快照与候选未修改；本轮尚未尝试更改t07/t09或活动主线。

## 无知情记录时的角色视角交互

另保存 `evidences/formal-003-empty-character-query.json`：`knowledge --holder c01:e_su --about c01:e_book --at 1:10 --limit 100` 在默认reader范围退出0并返回空；只增加 `--perspective c01:e_su` 则退出2、INVALID_ARGUMENT、Expected a visible entity ID。该角色在reader范围已存在，但此时还没有显式KnowledgeAccess，t07角色投影连holder自身也未列入characterAllowed，t09的requireEntity因此拒绝自己的知识查询。这是实际交互限制；若期望角色在无记录时也可查询空集合，应特判已被scope确认的当前视角主体，而非放宽任意不可见主体。未修改查询实现。
