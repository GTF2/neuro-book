# 主线实现与真实运行进度

本记录只记已发生的实现验证，不代表 20 章验收完成。

2026-09-11 上午恢复 `smoke-005`，沿用相同 policyHash，从 B attempt 4 继续，未重做 A。B attempt 4..6 都因 `f_prev_owner` 的 `assertion.holder` 缺少显式 Resolution 失败，head 保持 0。泛化错误只给主体 ID，模型反复新增该主体的其它身份记录，却没有补到该条 Fact 的 identities 数组。

当前编译预检查已按每条 Fact 的 entity 论元与 assertion.holder 聚合缺失身份错误，输出 Fact ID、字段路径、主体、位置、已选身份以及候选中可用的本地 Resolution ID。错误建议不枚举未提供给模型的历史记录。schema 描述和 B 提示词明确 holder 即使不在 arguments 中也需身份依据。新增“holder 不属于论元仍必须引用身份”的回归。

Reviewer 发现的 Fact 使用同章 Episode 论元、Argument 支持同章 Episode 已修复：Fact、Argument、Episode、KnowledgeAccess 使用同一就绪队列，按真实显式依赖构建；缺失或循环给出相关 ID，不通过更换数组顺序要求模型绕开合法引用。原有 Access/Episode 双向链测试继续通过，新增 Fact/Episode 和额外 Argument 的用例。

Schema 修复现在保留可解析但尚未通过 schema 的完整 JSON：`candidate.json` 为 `{value: unknown}`，`parsed.json` 仍只保存 schema 合法对象。下一次修复请求收到 priorCandidate，恢复时保持相同字节输入，不能用未验证候选绕过发布检查。独立测试覆盖枚举错误、修正响应落盘后中断、恢复不重发的组合。

上述当前源码共 52 项测试通过，类型检查通过。真实 `smoke-006` 使用启动时的代码，尚不包含之后的四类依赖顺序与未验证候选修复；不得在同目录混用新源码恢复。

`smoke-006` 第 1 章第一轮 A 的一次错误为精确提及落错段，第二次 A 通过；B 首次为 Episode relation=`after` 的非法枚举，第二次报告古书早期发言引用较晚身份及缺失材料 ID，第三次 B 通过。C 审查 177 个单元，176 通过、1 拒绝，无 missing：`f_codex_questions_tail` 把古书说出口的询问和内心困惑同时塞进 speech 的 content。候选没有发布，流程进入第二语义轮。

第二语义轮通过并发布首章 306 条记录，第二章开始。首章 t09 CLI 实测：info/实体发现成功；`entities --query 墨丘利秘典 --at 1:7` 为空，未泄漏未来名称；`facts --entity c01:e_su --target c01:e_creator` 返回 `c01:f_gives_tasks`，保持 speech/opaque 与古书归属。

但 `knowledge --holder c01:e_su --about c01:e_creator` 为空。已有听闻只连到泛化的古书转述，未连到已单独建模且含造物主论元的内容命题，C 没有发现此检索缺口。后续 B/C 通用合同明确：任务、身份、规则等关键披露的显式接收者应关联到含核心主体论元的内容 Fact；不能只在转述 text 中留名称。没有加入小说特定 ID 或答案，也没有手工修改已发布数据。

`smoke-006` 已完成两章，head=2、676 条记录，进程正常退出。第二章苏天晴、原主人、身体、秘典的 Resolution 都引用第 1 章的主体 ID。最终摘要复查确认 `sum_su_state` 将古书的角色指派、系统绑定/契约提示压成了无归属状态；新 B/C 通用规则要求摘要保留发言、思想、系统提示和不确定性的限定。当前源码 52 项测试通过，独立正式 20 章运行仍待完成。

2026-09-11 10:08（Asia/Shanghai）启动 `evidences/formal-001 --through 20`，独立于 smoke，起始 PID 58752、终端会话 88888。策略包含上述依赖、恢复、听闻关联与摘要归属修复；运行期间冻结源码。此行只表示正式运行已启动，不表示 head 已到 20。

正式运行三轮均因 C 拒绝而未发布，达到本次自动语义轮上限后正常退出，head=0。第三轮仅剩 `semantic:ep_contract` 的系统指令末句未引用相应材料，以及 `semantic:sum_role` 的高危判断未引用相应提问/事实；全部 A 单元通过。第一轮“听闻只连泛化文本”的修复已实际生成 `ac10 -> f24c`，其中 f24c 有造物主与苏天晴显式论元且保持 speech/古书归属，但该轮还有其它关键 heard 漏项被 C 拒绝，因此不能作为正式发布结果。

暴露出的收敛问题：当前 C 仅拒绝 B 两条记录也会在下一轮重做已通过 A，导致材料内容和 ID 漂移。下一步应仅在 C 的全部 material 单元 passed 时保留 A，并将上一版 B 与精确拒绝反馈交给整合修复；C 再次检查完整 A/B。复用必须带上原阶段/响应审计来源，成本报告将原始 A 调用归到最终有效链，不能伪造一次新 A 调用，也不能手改任何模型产物。此改动尚未实现，需与 report 文件 owner 协调。

10:55 主线已实现定向语义修复：C 精确覆盖全部单元、全部 material passed 且 missing 为空时，新轮保留 A；B 收到上一候选与拒绝理由。任何材料拒绝或未分类 missing 仍重新调用 A，且不给新 B 复用可能失配的旧候选。`material-reuse.ts` 以同章 `sourceRound` 和内容哈希记录原始来源，严格只允许较早且未复用的原阶段，避免路径越界、循环和重复计费。receipt 先落盘、accepted 后落盘。新增中断恢复、材料拒绝/遗漏、连续复用及原始来源被修改测试；runner 15 项测试和 typecheck 通过。report 还需要接入 materialOrigin，使最终 A 的有效调用指向原轮，而非要求复用轮存在伪造 attempt；尚未启动新正式运行。

10:58 `report.ts` 已接入原始 A 来源，在最终发布轮验证 reuse receipt 后，将原轮的匹配成功调用计为 production-accepted；复用轮不制造 attempt，旧 B/C 仍记生产修复。新增两次语义重修下 1A+3B+3C=7 次调用、有效 3 次、修复 4 次及间接来源拒绝测试。完整 57 项测试与 typecheck 通过。运行规模按当前 Task/Spec 的单本千万字口径；usage 的过时“千万本书”描述已纠正。当前 policy.context.records 实际为 90，与 scale-and-cost 中 150 的描述不同，需 Leader 同步文档口径；主线未改变此上限。

11:00 新正式运行 `evidences/formal-002 --through 20` 已启动，PID 60444、终端会话 2622，policy.version=`v7-ingest-2026-09-11-2`。包含定向修复、同章 A 来源收据和通用最小必要修复提示；从此冻结运行源码，不在同目录混用策略。此前 formal-001 已结束，仍 head=0。57 项测试与 typecheck 是本轮最近代码证据；提示词新增的修复说明不改变输出 schema。

formal-002 第 1 轮 A/B 均首次通过结构校验；C 捕获脑中声音误归为古书及问句升级信念，另列三处关键语义遗漏，故正确阻止发布并重做材料。第 2 轮 A 已通过、B 首次因三处未来依据被校验拦截，当前在 B attempt 2。C 同时将几个保守较晚的 identity.at 当作必须等于首次 mention 的错误；从合同看 at 是充分依据的可见时间，并不必须等于首次提及，此类复核误判需观察是否反复阻碍收敛，不能据此手改候选或绕过 C。head 仍为 0，进程继续。

formal-002 第 2 轮 B attempt 2 使用了与谓词 role 不匹配的 referent 值；attempt 3 已修正，但 `id_sysvoice` 标为 tentative 导致 f_system_declaration 及依赖它的 episode/access/summary 从 t07 投影排除。通用规则已说明未知来源实体可拥有 accepted 的局部归属，但模型仍混淆“真实身份未知”和“局部指称归属不确定”。源码没有改动，按原策略重新执行后从 B attempt 4 续跑；当前 PID 60924、终端会话 67843。未来若反复不收敛，需增强隐藏记录错误的身份依赖诊断，不能把 tentative 归属自动升级为 accepted。

第 2 轮 B attempt 4 将 id_sysvoice 修为 accepted 的未知来源局部归属，结构与投影通过。C 只拒绝 id_book 的较晚 at=11，全部材料通过且 missing=[]。第 3 轮已真实复用第 2 轮 A（sourceRound=2、sha256=a9f337e8ff71ba057370a462ad80702cfe85416177e04b85526727e55be6ddbd），B 将 id_book 改为 at=7 并显式改用 book 局部指称作依据，55 秒通过，C 正在检查完整组合。没有伪造 A attempt，没有修改旧模型结果。

第 3 轮 C 又发现 sum_foxbody 的睡裙描述缺少 d16 依据，以及古书听到自报姓名的知情漏项，全部 A 单元仍通过。因为当前 missing 为未分类 string[]，runner 按保守规则重做 A；第 4 轮 A 已通过，B 正在运行（PID 60924 / session 67843）。这暴露出下一优化点：将 C missing 显式标明 material/integration 层，只有确实材料漏项才重做 A；不能靠字符串关键词猜层。还需明确 C 的 at 判定是依据最晚可用边界，不是必须等于首次 mention。当前正式 run 不修改源码，尚未引入这两项，head=0。

第 4 轮 C 全通过，第 1 章正式发布 240 条记录（8 Entity、15 Fact、12 Access、5 Episode、8 Summary），第 2 章已开始。CLI `knowledge --holder c01:ent_su --about c01:ent_creator --at 1:66` 返回 `c01:a_su_heard_role_assignment -> c01:f_book_assigns_role`，Fact 保持古书 speech/opaque，creator 位于 task_source 显式论元，原 smoke 的检索缺口已修复。`entities --query 墨丘利秘典 --at 1:7` 的 items 为空。`--report` 成功读到首章 15 次真实调用，已知估价 $0.493202016，后续章节调用另列；不能据此冒充 20 章成本。

更正前述记录上限观察：prompts 的总 recordLimit=entities(60)+records(90)=150，文档 150 正确。第 2 章 context=88796 字符、133 记录、24 语义种子、missingReferences=0，未越过实际 150 上限。

需 Leader 处理的范围隔离缺陷：真实数据把 integration.gaps 的小说语义全文合进 dataset.coverage.gaps，而 t07/t09 在早 `--at` 查询时原样返回全快照 gaps。实测上述 `--at 1:7` 虽名称 items 为空，coverage.gaps 仍透露造物主、契约与脑中声音等后文。这不是名称投影错误，而是无章段元数据的覆盖说明泄漏。t10 当前冻结运行，t07/t09 在本 Task 只读；建议由 Leader 在 t09 输出边界对窄范围请求隐去无法按范围证明可见的全快照语义 gaps（或明确设计带范围的覆盖说明），并加真实 CLI 回归。不得通过手改已发布 dataset 修复。

11:40 接续确认 formal-002 head=2，原 PID 60924 仍活动，命令为同目录 --through 20；终端 session 67843 已不能从主线读取，因此后续通过进程和原始阶段文件监测，不重复启动。第 3 章 A 修复一次非法 mode 后通过，B attempt 1 聚合报告跨段未来依据，当前 attempt 2。第 2 章已发布快照查询苏天晴返回 `c01:ent_su` 和 `c01:ent_original_owner` 两个主体，前者新增别名“狐狐”，原主人同名未归并；古书也继续复用 `c01:ent_book`。范围 gaps 修复已由 Leader 接手 t09，t10 策略保持不变。

11:43 query_cli 自身仍可通过 session 67843 读取原进程；主线不可读该会话不代表运行停止。第二章 485 条记录、163 原文段落，B 第二次修复后 C 首次通过；第三章 B 第二次通过，C 当前运行。PID 60924 不变。

11:53 第三章第 3 轮 C 拒绝 A 的一处真实身份误归属：第39段“一介狐狐”明确承接“原本的苏天晴”，却被收进当前苏天晴 r_su。另有数条 identity.at 晚于首次 mention 的过严复核。原 PID 60924 已退出，head=2。确认无活动写入者后按同一策略恢复到 ch03/round-4/material，当前 PID 26100、session 75779；从此次恢复开始 stderr 同时持久在 `evidences/formal-002/progress.log`，主线可直接读取而不依赖子 Agent 会话 ID。源码/策略未改，未重新调用前两章。

12:00 主 Agent 按 Task README 暂接窄范围 Tasker 修复。formal-002/ch03/round-4/integration/attempt-1 响应落盘后停止 PID 26100；该响应因 length 截断失败，程序已发出 attempt-2，停止时其响应未保存，报告应保持结果未知。formal-002 保留 head=2；不能在新源码下恢复此目录。

策略 v7-ingest-2026-09-11-3 已实现：C missing 为显式 `{stage: material|integration, note}`，仅整合漏项保留已全通过 A，材料问题重新提取；C 每轮只读取本次候选和依据，不携带上一语义轮的拒绝结论，阶段自身格式错误仍按既有恢复合同修复。C 提示词明确 identity.at 是依据可用边界，可以晚于首次提及，也无需在 at 所在段再次提及对象。没有改造小说候选、跳过逐项复核或关闭思考。

新增整合漏项中断恢复、真实调用来源计费、较晚身份依据与未来依据拒绝验证。新整合漏项与材料漏项用例在旧实现失败，修复后 59 项全测和 typecheck 通过。原有正式两章和开发样本仍可用 t09 查询。新策略需独立目录运行，并追加实际 C 与20章证据；本记录不宣称真实20章已完成。

12:04 主 Agent 启动 `evidences/formal-003 --through 20`，PID 58704，终端 session 66038，进度同时保存在 progress.log。policyHash=`9ab683a523cfad3f0e1618a50f9c0bf3a1e192a43c6f302b5c1d4f85c87ec569`，原 inputHash 不变；六份策略源码保存在 policy-source.json。当前源码冻结。独立只读 CLI Reviewer 的 session 为 40406，报告目标为 reviewer-2026-09-11-classified-gaps.md；Reviewer 仅审查本次漏项分层、C反馈隔离及时间说明。不能重复启动 formal-003 或恢复 formal-002。

独立 CLI Reviewer 已完成，窄范围无阻断，结论见 [分层漏项复核](reviewer-2026-09-11-classified-gaps.md)。按其非阻断建议新增组合回归：上一轮语义漏项后，C出现逐项覆盖错误，修复响应落盘后中断，再恢复；实际fake调用A1/B2/C3，共6次，恢复未重发，生产有效3次/修复3次。runner当前17项通过、typecheck通过；仅测试文件变化，不改变活动策略哈希。

formal-003 已发布首章346条记录，C第一次通过；第二章已开始。首章真实CLI确认 `c01:e_su` 对 `c01:e_creator` 在1:65为空、1:66返回 `c01:a7 -> c01:f17` 的heard且保持古书speech。C接受firstMention=10、identity.at=11且依据在11可用的合法候选，没有重复旧时间误判。详情见 [新策略查询检查](leader-formal-003-query.md)。实现与已结束实验检查点已提交为 `60cff3f7`；活动formal-003未包含于该提交，尚未推送。

12:01 第 4 轮 A 通过；B attempt 1 达到 64000 输出上限（其中推理 57650），完整响应和 length 失败已保存，下一次容量升到 128000。随后 PID 26100 退出，attempt 2 只有 request.json，服务端结果仍未知，不能记作未计费。query_cli 初见进程退出后尝试隐藏后台 Node 恢复（PID 64636）；版本保护检测到策略变化，立即拒绝且没有调用模型、没有写入该 pending attempt 的 failed 状态，64636 也已退出。日志为 `evidences/formal-002/resume-003.stdout.log` 和 `resume-003.stderr.log`。

随后读取最新 README，确认 Leader 已接管 draft/prompts/runner 的漏项分层与时间审查修复，并要求暂停 formal-002。旧源码与 `policy-source.json` 对比显示这三个文件已切换至 version 3；query_cli 没有覆盖其修改，不再尝试旧目录恢复。当前无活动 ingest，head=2，待 Leader 写明修复完成及新启动身份后继续 20 章。此前“意外退出”的初判已由此协调状态更新，pending attempt 2 仍按未知服务端结果保留。

12:06 从主线独立审查请求和实际进程确认 Leader 已启动 `formal-003 --through 20`，PID 58704，policyHash=`9ab683a523cfad3f0e1618a50f9c0bf3a1e192a43c6f302b5c1d4f85c87ec569`、version 3。query_cli 只接续只读监测，不重复启动或修改主线。已由当前源码、policy 和实际 JSON schemas 重新算 hash 并确认相同；Leader 已同步保存 `policy-source.json` 的源码快照，query_cli 的另一种封套写入被 immutable 保护拒绝，未覆盖该文件。formal-002 的暂停报告已写为 `evidences/formal-002-paused-report.json`：已发布两章 19 调用，已知估价 $0.684891852；未发布章另列 13 调用，其中 1 次未知服务端结果，不能记零。

formal-003 于 12:13 发布第1章：A 两次、B 三次、C 首次通过，共 6 次调用，346 条记录（35 Fact、21 Access、7 Entity）。实际 t09 CLI：`knowledge --holder c01:e_su --about c01:e_creator --at 1:66` 返回 a7→f17、heard，Fact 保持 speech/holder=e_book/opaque；`entities --query 墨丘利秘典 --at 1:7` 返回空且 coverage.gaps 为通用无剧情说明。Su 摘要 s1 保留“据其记忆”“苏天晴认为”“古书称”“系统提示”等来源限定。当前进入第二章，未据首章结果宣称整个 20 章完成。

query_cli 12:33 验证两章通过：163段/4234字符/688节点，新增 `experiments/verify-published.ts` 对归一化原文、连续发布、逐章 schema/哈希/复核与确定性重编译进行验证，typecheck退出0。两份JSON证据为 `evidences/formal-003-verification-ch02.json`、`evidences/formal-003-queries-ch02.json`；详情和后续更新集中在 `walkthroughs/query-cli-formal-003.md`。发现原主人category仍为unresolved导致person过滤漏检，完整读者coverage.gaps保留已过时的“原主人姓名未知”及首章allowedIds说明；同名发现、2:17/2:18姓名边界和1:65/1:66听闻边界正常。未改冻结源码或候选，运行恢复由主Agent唯一控制。

query_cli 12:58 报告已发布第三章的实质身份缺口：风信子 `c03:e_fengxinzi` 与第二章任务目标 `c02:e_official_magical_girl` 没有归并或显式关联，旧主体摘要还复用“姓名与身份未揭示”。原文3:11、13、14、16有连续对手线索；第1轮C曾拒绝此缺口，第2轮B修过，但重提取A后的第3轮又新建主体且C漏判。结构重编译通过（250段/6906字符/1089节点），不能据此把此项语义质量判通过。命令、原文和审查过程见 `walkthroughs/query-cli-formal-003.md` 的三章小节。未动冻结策略或已发布数据。

query_cli 追加实测：`search --query 墨丘利秘典 --at 1:7 --limit 100` 在formal-003/ch03快照返回3条未来名称泄漏。Argument rationale、C review.note、Assessment.note及Time.label/description含后文名称，却被赋予1:7或更早的可见时间；Entity.names投影为空并不足以阻止原记录文本泄漏。完整证据为 `evidences/formal-003-text-scope-ch03.json`，分析见逐章复查同名小节。请Leader在新策略准备及最终范围结论中纳入；query_cli未修改t07/t09、候选或当前主线。

query_cli 14:49在策略 -4 的正式 `formal-004/ch01` 再次复现正文泄漏：`get c01:f_book_asks_name --at 1:13` 退出0，fact正文“黑色古书（墨丘利秘典）向苏天晴要求姓名。”提前包含1:29才出现的名称；`search --query 墨丘利秘典 --at 1:13` 同时返回该Fact和1:11的身份论证。1:19和1:21的fact正文也使用后续名。因此smoke-007的对应扫描为空仅为那份样本通过，不能当作通用修复。最小复现及9个实体名称的逐边界扫描见 `walkthroughs/query-cli-formal-004.md`、`evidences/formal-004-query-verification-ch01.json`；旧数据跨2/3章及三次get最小复现见 `walkthroughs/text-scope-minimal-repro.md`。正式首章结构/来源/重编译通过，266节点、76段、2036字符、162复核单元；造物主知情1:65空/1:66 heard通过，古书内心未再被标为苏天晴heard。运行进入第二章，主Agent仍唯一控制。
