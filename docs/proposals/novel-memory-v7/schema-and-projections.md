# V7 Schema、实体摘要与查询投影

状态：reviewing。2026-09-09。本文把 [V7 逻辑模型](knowledge-model.md) 落为可执行的快照结构，并记录前两章手工金标实际推动的修订。它是设计验证合同；数据库服务、自动抽取、增量维护执行器尚未实现。

## 1. 可执行的唯一字段源

所有 TypeScript 类型由 Zod schema 推导，运行期解析和 JSON Schema 都从同一份定义产生，不另写一套接口。

| 产物 | 用途 |
| --- | --- |
| [schema.ts](../../../.agents/works/w00005-novel-understanding-spike/tasks/t07-v7-schema-gold/schema.ts) | 16 类节点、快照和维护记录的严格字段定义，`NodeOf<K>` 可取得任一节点类型 |
| [schema-v7.json](../../../.agents/works/w00005-novel-understanding-spike/tasks/t07-v7-schema-gold/schema-v7.json) | JSON Schema 2020-12，可独立检查结构和枚举；未知字段拒绝 |
| [management-schema-v7.json](../../../.agents/works/w00005-novel-understanding-spike/tasks/t07-v7-schema-gold/management-schema-v7.json) | Manifest、membership、ChangeSet、operation 的具体结构；不代表事务执行器已经存在 |
| [validate.ts](../../../.agents/works/w00005-novel-understanding-spike/tasks/t07-v7-schema-gold/validate.ts) | JSON Schema 之外的跨记录引用、时间可见性、支持图和原文位置约束 |
| [query.ts](../../../.agents/works/w00005-novel-understanding-spike/tasks/t07-v7-schema-gold/query.ts) | 快照投影、实体摘要索引和状态计算的实际实现 |
| [dataset-v7.json](../../../.agents/works/w00005-novel-understanding-spike/tasks/t07-v7-schema-gold/dataset-v7.json) | 真实 EPUB 前两章的可查看金标候选，所有引用均指向同一快照 |

工作目录是 [t07](../../../.agents/works/w00005-novel-understanding-spike/tasks/t07-v7-schema-gold/README.md)。`bun run typecheck`、`bun run test`、`bun run schema`、`bun run build`、`bun run validate` 是对应入口。测试用 Node 内置测试运行器；无需调用模型、安装新依赖或访问网络。样本由当前 Agent 逐段阅读后标注，不是自动抽取效果证明，也尚未经开发者认可。

## 2. 顶层与共用结构

`MemoryDataset` 有且仅有 `schema/book/snapshot/sources/nodes/coverage/partitionWatermarks/invalidationRoots`。

| 字段 | 结构与约束 |
| --- | --- |
| `schema` | 固定 `neurobook.memory.v7`，拒绝 V6 混入 |
| `book` | `{id,title}`，一本书的逻辑身份 |
| `snapshot` | `{id,sourceManifest,knowledgeRevision,readAt}`；读取数据已经是该版本有效成员集合 |
| `sources` | `{id,revision,chapterId,chapterOrder,title,paragraphs,sha256}[]`；章节 ID、顺序、来源 ID 在快照内唯一 |
| `nodes` | 按 `kind` 区分的严格联合；每个逻辑 ID 在快照内仅一个有效 revision |
| `coverage` | `{through,chapters,material,semantic,gaps,recordsExhausted,corpusClosed}`；完整物料覆盖与选定语义覆盖分开 |
| `partitionWatermarks` | 分区名到非负整数水位；不会用时间戳猜测处理顺序 |
| `invalidationRoots` | `{id,revision}[]`；依据闭包含脏根的结果不能作为就绪知识返回 |

每个节点共用 `{id,revision,kind,label,availableAt,scope,spans,dependencies,readiness,data}`。`id` 是逻辑身份，`revision` 为正整数；修改不可变记录意味着新 revision。金标使用便于人工核查的固定 ID，产品分配器应产生不含语义的 ID。`label` 必须在 `availableAt` 已可用，不能用最终称谓给早期实体做标签。

`RecordRef={id,revision}` 是精确版本引用。`Position={chapter,paragraph}` 从 1 开始，是叙述边界，不是故事时刻。`Scope={world,perspective}` 保留原作、if 分支和角色作用域。`Span={sourceId,sourceRevision,paragraph,start,end}` 指向一段冻结的归一化原文，`start/end` 是 UTF-16 code unit 半开区间；不允许跨段、越界、空片段或切开代理对。来源 SHA-256 对 `paragraphs.join("\n")` 的 UTF-8 字节计算。

`readiness` 为 `ready/stale/pending`；节点是否有效属于 membership，不能把 `retracted` 混进当前准备状态。`null` 表示该槽位明确无值或未定位，例如开放区间端点；未知领域值使用带原因的 `Value.type=unknown`，不能用空字符串冒充。

## 3. 各节点的具体 Payload

下表中的字段均位于 `data`；完整嵌套类型和必填性以上面的可执行 schema 为准。

| kind | 必填数据与用途 |
| --- | --- |
| `entity` | `category,identityNote,names[{text,availableAt,dependencies}]`；跨章持续主体，名称有自己的披露边界和非空材料/身份依据 |
| `referent` | `localName,mentions,splitFrom`；局部指称，不把同名自动当同人；可在拆分时保留前身 |
| `mention` | `referent,text,span`；原文子串必须精确等于 text，代词也有自身锚点 |
| `resolution` | `referent,entity,decision,replaces`；`same/candidate/unresolved`，独立 Argument 与 Assessment 支持消歧 |
| `predicate` | `name,definition,roles[{name,valueKinds}],symmetric,family`；术语是有版本的记录，每个 role 的值类型由定义限制 |
| `disclosure` | `text,channel,mode,attribution[{channel,holder}],referents,mentionedTime`；保留叙述、思想、发言、文书、声音等来源及引述层次 |
| `beat` | `gist,chapterId,fromParagraph,toParagraph,mode,referents,disclosures`；章内连续材料分段，完整覆盖时不得留洞或重叠 |
| `fact` | `proposition,predicate,arguments,polarity,assertion,time,qualifiers,interpretationDependencies`；命题与来源释义分开，身份依据独立可失效 |
| `episode` | `summary,scale,participants,materials,components,children,relations,time`；事件、序列或弧线，可非连续引用材料，顺序和因果边类型分开 |
| `synthesis` | `topic,items,children,coverage,interpretation=true`；跨事件主题、力量体系等解释性综合 |
| `entitySummary` | `subject,facet,readAt,story,items,coverage,builtFrom`；可重建的主体摘要，逐项引用 canonical 知识 |
| `argument` | `conclusion,polarity,method,premises,assumptions,rationale,sourceRoots,applicability,bindings,jointScope,jointTime,review,status`；一次可审查的论证，不等于可信度分数 |
| `assessment` | `target,arguments,epistemic,note,unresolved,evaluatedAt`；该范围下对所有适用支持与反对路径的评估 |
| `time` | `description,precision,constraints[{relation,other,dependencies}]`；故事时间偏序，before/after/during/overlap/equal 不要求伪造日期 |
| `watch` | `targets,partitions,reason,checkedWatermarks`；补足“新材料还没有反向依赖边”时的失效触发 |
| `knowledgeAccess` | `target,holder,mode,establishedAt,evidence`；heard/read/believed/known/unaware，分别表示听闻、读到、相信、知晓和明确未察觉 |

`Value` 是 `ref/text/number/unknown/none/variable` 的严格联合。数字有可空 `unit`；每个角色论元为 `{role,value,anchor}`，没有可靠子串时锚定支持段落或通过推断前提追溯。Fact 的 entity 论元把当时的 `Resolution` 放入 `interpretationDependencies`，因此原主与当前意识的纠错会使错误归属的关系退出就绪结果。

`assertion={kind,holder,opaque}`；kind 包括 world/belief/speech/rule/paratext/hypothesis/fiction。belief/speech 必须有 holder 且 opaque=true。这里 `accepted` 表示相应命题得到支持：accepted 的“秘典自称来自星空彼岸”仍只是发言事实；“它确实来自星空彼岸”在金标中是另一个 tentative 推断。

`time` 为 unspecified、point 或 interval。interval 有可空 `start/end` 及 observed/explicit/inferred 边界来源。`qualifiers` 明确 `quantifier,conditions,textualConditions,exceptions,modality`，不能把 usually 当 all、possible 当 actual。金标目前以有限关系词和具体事件为主，并未实现自然语言量化逻辑证明器。

时间约束可由同一 time 节点 `spans` 直接举证，也可引用 `dependencies` 中的已存在材料；两者不能同时为空。`other` 是时间关系端点，不强迫成为内容依赖，从而避免 A before B 和 B after A 造成假的知识支持环。完整时序可满足性求解不在本 spike 查询实现中。

## 4. 前两章带来的实际模型调整

1. **三个身份分开。** 当前意识 `su`、身体 `body`、原主人 `original` 不合并。协会资助和医学院录取属于 original；原主病史不能自动成为当前意识的病史。
2. **Disclosure 和 Fact 不能共享一段不加区分的文本。** `annotations.fact.text` 可明确只保留受支持命题。例如“先答应、后担忧”不能因为 Disclosure 覆盖一段对话就把时序先后混为同一个状态。
3. **回忆发生和被回忆事件分开。** 第一章回忆“五分钟前”的猝死，Disclosure 的 `mentionedTime` 指向过去；Fact `recalls` 的发生时间不能冒充猝死时间。
4. **读者知道与角色知道显式分开。** 第二章旁白显示守护之星吸血，但苏天晴没注意。读者可见 `f214`，角色投影保留 unaware 认知记录，不返回该命题或相邻读者推断。书页任务是 read，不是 heard。
5. **名称是受范围限制的数据。** 墨丘利秘典、卧室、镜子的具体称呼各有首次披露位置；entity 最终名字和 predicate 术语不能预先进入搜索。局部 referent 的未来 mention 列表在投影中裁剪。
6. **摘要还需冻结解释所依据的判断状态。** 每个 summary item 增加 `assessmentBasis[{target,epistemic}]`。最初支持 tentative 的“可能来自……”可以保留；生成时 accepted 的依据转成 tentative 后，旧确定语气摘要必须失效。

## 5. EntitySummary 不是实体上的长文本字段

[V4](../../../.agents/works/w00005-novel-understanding-spike/tasks/t02-novel-memory-model-design/memory-model-v4.md) 已把 Summary 视为可重建的主体介绍和剧情梗概。V7 延续这个查询入口，并把范围、状态和逐项依据落实为结构：

```ts
type SummaryItem = {
    id: string;
    text: string;
    dependencies: RecordRef[];
    readiness: "ready" | "stale" | "pending";
    assessmentBasis: { target: RecordRef; epistemic: Epistemic }[];
};
type BuiltFrom = {
    sourceManifest: string;
    knowledgeRevision: number;
    partitionWatermarks: Record<string, number>;
};
```

同一 entity 可以有主体概况、态度变化、能力、关系等多个 facet；同一 facet 可按 chapter/readAt 发布多个摘要。一次查询对每个 facet 取当前边界内最近可用版本，不把全书 summary 自动裁几个句子当作早期 summary。金标中 su 有第一章概况、第二章概况和态度变化；book 有两章分别的概况。

摘要项依赖 Fact/Episode 等 canonical 知识。`entitySummary` 不得成为 Fact 或 Argument 的证据根；要继续推理必须展开到其原始依据，不能用同一句摘要不断强化自身。聚合用到的 Assessment 状态必须登记，结构校验拒绝遗漏。读者范围中摘要新鲜度要求 manifest、knowledgeRevision、水位及完整依据闭包均有效，任何 item stale/pending 则整份摘要暂不返回，状态是 `missing-or-stale`；本 spike 没有实现局部摘要重写。

## 6. 实际查询接口与正确性边界

```ts
createQueryIndex(dataset): QueryIndex;
querySnapshot(index, { readAt, perspective, world });
queryEntitySummaries(index, entityId, { readAt, perspective, world });
```

索引包含 byId、byKind、dependencies、dependents、assessments、summariesByEntity。querySnapshot 返回 `nodes,edges,knowledge,unavailable,coverage,sourceManifest,knowledgeRevision,diagnostics`；实体摘要查询返回 `items,status,coverage,diagnostics`。`knowledge` 明确角色对 target 的 heard/read/believed/known/unaware 状态，不能以“Fact 没返回 Assessment”为由在 UI 默认标成世界真相。

一次查询先限制 world/readAt，再递归检查内容与评估依赖、脏根和 Watch 水位。实体摘要查询从 summariesByEntity 找候选，不扫描所有节点寻找目标实体摘要。每次调用有自己的闭包 memo，不复用旧 head 的缓存。

支持论证的前提在一条 Argument 内是 AND，Assessment 的不同支持路径是 OR。某条支持失效而独立支持仍可用时，结论可保留；适用的反对路径 dirty 时不能因其消失把 disputed 静默改成 accepted，暂不返回就绪结论。Argument 的 review/applicability 会限制状态，必要前提 tentative/disputed 时 usable 下游降为 conditional。这里使用的联合变量绑定、作用域和时间适用性结论是金标明确给定的值；代码没有假装能自动证明任意规则的同时成立。

查询不会把晚出的 `evaluatedAt` 当作早期评估。早期可用需要已存在的该范围评估；独立的早期支持路径可以参与该范围评估，但晚出结论文本和后知解释不允许直接回溯。`unsupported` 的论证判断和 `stale/pending` 的准备状态不是同一个概念。

角色投影是显式认知记录的受限子集，不从读者论证链递归推导角色掌握所有前提，也不自动把命题参与实体的别名知识授予角色。当前实现消费 reader 作用域材料加 knowledgeAccess；独立写入 `scope.perspective=<entity>` 的摘要和完整 storyAt/perspective 联合服务属于后续实现，不能以本次结果宣称已经支持。原作/分支、多 Manifest 历史游标、数据库事务与恢复同样只有 schema 和设计合同，本地查看器不是服务访问控制边界。

返回节点经过范围投影；原始 dataset 是完整管理与审查工件。查看器原文窗口必须自行遵守所选 readAt，角色视图也不能用整章原文扩大角色认知。原始 JSON 下载明确作为管理数据，不可当作范围受限查询响应。

### 名称、局部指称与身份投影（2026-09-10）

`Entity.names` 保持原有结构，但每个名称必须依赖至少一个可溯源 Mention，以及将该 Mention 所属 Referent 归属到当前 Entity 的 Resolution。人工整理的描述性标签也必须锚定到对应段落，不能用空依赖保存最终名称。跨记录校验拒绝未来材料、其它作用域、其它 Entity 的身份依据和没有 Mention 的名称。

名称是字段级派生值，不能加入 Entity 整体的生存依赖。查询仅返回当前阅读范围内、所有依赖 ready、身份为 `same` 且其 Assessment 为 `accepted` 的名称，按可用位置选择最新名称。撤回后回退到仍有效的较早名称；无有效名称则只显示稳定 ID，持续 Entity 不被删除。角色投影不自动获得读者的名称集合。查询每次检查名称闭包，目前没有可因缺少名称反向索引而读到旧值的持久化缓存；将来缓存名称时须单独登记字段级失效边。

局部 Referent 的 `mentions` 与 `localName/label` 按当前有效 Mention 投影。首个提及撤回后，显示下一个有效提及；尚无有效提及时使用 Referent ID。仅由完整段落建立的语境指称使用中性 ID 标签，不从 Entity 拷贝后知名称。Resolution 为候选、未决或非 accepted 时仍可返回供审查，但不能用于把名称或 Fact 的解释性身份绑定到确定实体；原始 Disclosure 不因此被抹去。

样书中“黑色古书”和“墨丘利秘典”仍为同一个 Entity。后者从第一章第 29 段的 `mention:book:c1:2` 和 `resolve:book:c1` 取得显示依据；不依赖直到第 30 段才完整可用的 `d111`，避免提前透露整段介绍。撤回该 Mention 后，显示名回到“黑色古书”。这表示原文确实使用了这个名字并把它指向该对象，不认证自报名的真实性。`f111` 继续保持 `speech + holder=book + opaque=true`，其 accepted 评估不能将“来自星空彼岸”等发言内容改写为 world 命题。

当前人工金标仍按章整理局部 Referent，并由人工决定共指关系；本轮没有实现自动逐提及消歧、身份拆分执行器或名称自动重建。显示名不是新的领域命题类型。EntitySummary 的结构、标注、更新机制和查询缓存规则均未修改。

## 7. 查询优化的实际证据与后续存储结构

截至本次构建，两章 163 段生成 615 节点：24 Entity、36 Referent、45 Mention、36 Resolution、55 Disclosure、58 Fact（其中 7 个跨记录推断）、33 Beat、7 Episode、11 EntitySummary、18 Time、33 KnowledgeAccess、57 Predicate、101 Argument 和 101 Assessment。未为了填满 schema 制造样本不存在的 Synthesis 或 Watch；Watch 由故障注入测试验证。

对同一金标在同一范围查询苏天晴摘要，实际计数如下：

| 路径 | 顶层候选 | 访问的依据记录 | 返回 |
| --- | ---: | ---: | --- |
| 全图投影后再筛选 | 615 | 615 | 全图 615 节点，再由调用者选摘要 |
| summariesByEntity 定位 | 3 | 249 | 第二章概况和态度变化 2 份摘要 |

这个结果证明已经实现了按主体定位候选以及避免扫描无关顶层记录；它也暴露出摘要的依据闭包不小。没有把 615 对 3 宣称为端到端 205 倍加速，更没有用两章运行时间外推百万字小说。

进入 SQLite 实现时建议保留以下派生索引，原始节点仍是规范记录：

| 索引 | 查找键 | 失效与重建 |
| --- | --- | --- |
| node membership | `(manifest,knowledgeRevision,id)` | 事务内发布有效成员 |
| entity summary | `(manifest,perspective,world,entityId,facet,readAt)` | 任一来源、身份、评估或范围变化使对应摘要失效 |
| fact roles | `(manifest,predicateId,role,entityId)` | Fact 与 Resolution revision 变更时替换 |
| evidence reverse edges | `(premiseId,premiseRevision)` | 与 ChangeSet 同步登记；不靠全文搜索找消费者 |
| assessment targets | `(manifest,targetId,scope,evaluatedAt)` | 新支持、反证或 Watch 水位推动重评 |
| material search | `(sourceManifest,readAt,scope,projectionGeneration)` | 披露范围过滤先于排序；中文短名称需实测分词与精确匹配 |

大规模优化下一步是把验证过的依赖闭包状态作为带 head、水位和 scope 的缓存，发布失效根后使旧缓存不可用；并分别测 index 构建、正文索引、摘要读取、证据展开的成本。尚未实现这一缓存或 SQLite 存储，不需要为了两章增加数据库进程。

## 8. 维护数据的落库合同

`managementSchema` 独立于有效读取快照：manifest 保存 sources、parent、head；membership 保存版本上的 active/superseded/retracted 及原因；ChangeSet 保存 operationKey、baseKnowledgeRevision、executionGeneration、readSet、creates、supersedes、invalidationRoots、水位、validation/status 和提交 revision；operation 保存 stage、状态、cursor、callBudget/callsUsed、outputChangeSet。

这些字段足以表达设计中的候选、冲突、取消、提交与未知 Provider 结果，仍需事务层兑现 head CAS 和 executionGeneration 的同事务检查。JSON Schema 结构通过不证明并发正确、SourceManifest 继承正确或重放可靠；这些执行测试不属于本次小样本读取实现。

## 9. 已执行的聚焦验证

12 项 Node 测试通过，其中第一项覆盖全部 12 个手工金标问题的 expected/forbidden refs；其余验证早期 JSON 名称和谓词泄漏、代词与原主归属、身份纠错失效、角色显式未知、独立 OR 路径、脏反证、tentative 推断链、摘要 manifest/head/item/水位与判断状态变化、间接 Watch 失效、晚评估不回溯、非法角色及引用、摘要循环作证、支持自环、Beat 缺口和 UTF-16 边界。严格 TypeScript 检查、金标结构及引用校验、JSON Schema 导出已实际运行。

2026-09-10 扩展至 18 项测试；新增名称撤回回退、候选与非 accepted 身份阻断实体绑定、名称依赖与乱序选择、局部首称失效、非法名称材料/身份/范围拒绝、accepted 自述不提升为世界断言。最初四项缺陷测试均先失败再修复，跨记录名称校验测试亦先失败再修复。重建的 11 个 EntitySummary 节点与旧数据完整 JSON 相同；两次金标和两份 JSON Schema 构建的 SHA-256 各自一致。

金标编译同一输入得到同一结构；不含随机 ID 或构建时间。该验证证明当前人工选定数据可以被结构承载、查询和审查。它不证明自动抽取召回率、摘要自动维护质量、全书回答质量、持久化恢复或生产性能。
