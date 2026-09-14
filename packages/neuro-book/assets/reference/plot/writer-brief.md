# Writer Brief 格式规范

> 本文定义 `get_chapter_writer_brief` 编译出的两个视图的**格式契约**:各有哪些段、每段从哪来、三种防全知模式的差异。writer profile 的 `description` 指向本文;leader 用 `get_agent_profile("writer")` 发现后按需读。
>
> 这是「brief 应该长什么样」的真相源。brief 的**内容来源**由 Plot Scene / ChapterBrief / World Engine / 规划层(Promise beats + open Decision)决定;**世界状态怎么给**由防全知模式决定(见 [reference/world-engine/workflow.md](../world-engine/workflow.md) §6.2)。

## 一句话

`get_chapter_writer_brief` 产出两个互不重叠的视图:**writer 视图**(`suggestedBriefMarkdown`,只含事实级细节,是 writer 唯一的动笔前上下文)与**评审视图**(`reviewChecklistMarkdown`,全部意图级内容,只交给写完之后的评审)。这是写作宪法第二条/第五条的机制落地:**给事实,不给意义**。

## 两个视图的分工

| 视图 | 字段 | 给谁 | 内容 |
| --- | --- | --- | --- |
| writer 视图 | `suggestedBriefMarkdown` | **只给 writer**(agent 工具 `get_chapter_writer_brief` 的文本输出) | 章节身份、数据警告、本章参数、每个 Scene 的时间/地点/在场角色、世界状态截面或查询提示、建议读取 |
| 评审视图 | `reviewChecklistMarkdown` | **只给评审**(覆盖度与信息边界核对) | 目标与落点、节奏/开场钩子、信息控制四字段、禁写、按 Scene 的目的/写作提示/线索脉络、Promise 推进任务、未决决策警告 |

两个字段都非空:任一章节、任一 mode 下都产出可读文本;评审视图四项全空时给「本章无意图级内容」占位段,而不是空串。

writer 调 `get_chapter_writer_brief` 时,工具的结构化结果也会收口为事实字段——意图数据不进 writer 的 tool result。

## 三种防全知模式

模式只决定**世界状态怎么给**,不决定给不给意图——三个模式的 writer 视图都只含事实。

| 模式 | writer 能力 | writer 视图里的世界状态 |
| --- | --- | --- |
| **autonomous(自主查询,默认)** | Plot 只读 + World Engine 只读 + lorebook 读 | **只给查询提示**(查哪些 subject、哪个时间窗),writer 自查 |
| **curated(受控投喂)** | 读不到设定源 | **展开状态摘要**(World slices + Subject states;不 dump raw attrs/patch JSON) |
| **slice-only** | 同 curated | 与 curated 相同的事实截面;保留该枚举值只为上游接口兼容 |

调用:`get_chapter_writer_brief({projectPath, chapterId, mode})`,`mode` 默认 `autonomous`。

## writer 视图段落骨架(编译器产出顺序)

1. **标题与状态行** ← 模式标签 + `Chapter` + `Status` + 一行模式说明(明示「只给事实、没有意义指令;信息边界写完再核对」)。
2. **Warnings** ← 数据完整性问题(缺 World Anchor 时间范围、subject 未解析、World 上下文查询失败、未关联 Scene)。**信息控制未填不再产生 warning**。
3. **本章参数(覆盖 writer 默认)** ← `ChapterBrief.pov` / `tone`。只写覆盖项:writer profile 已有默认人称/字数/文风,brief 不重复。
4. **关键剧情点(按 Scene)** ← 每个 Scene 的 `summary`(本场做什么)+ 所属 Thread 标题 + 时间/出场 subject/地点,再按模式给 World 状态(见上)。
5. **建议读取** ← 由 Scene 的结构化 refs(content 类)编译,带 relation gloss;writer 按需读,不必全读。

**writer 视图明确不含**:本章目标与落点(`goal`/`ending`)、本场目的(`purpose`)、写作提示(`writingTip` / Thread `writingTip`)、线索脉络(Thread `summary`)、节奏与开场钩子(`pacing`/`opening`)、Promise 任务段、未决决策段、信息控制段、禁写段。

## 评审视图段落骨架

1. **本章目标与落点** ← `ChapterBrief.goal` + `ending`(结尾定句)。
2. **节奏 / 下一章牵引** ← `ChapterBrief.pacing` / `opening`。
3. **信息控制(事后核对)** ← `readerKnows` / `protagonistKnows` / `mustHide` / `hintOnly`,并附逐条核对说明:角色是否知道了他不该知道的信息、「必须隐藏」项是否被直接或变相泄露、「可暗示」项是否被明说。
4. **禁写** ← `ChapterBrief.doNotWrite`。
5. **关键剧情点意图(按 Scene)** ← 每场的 `purpose` / `writingTip` / 所属 Thread `summary` / Thread `writingTip`。
6. **本章 Promise 任务**(Task 93 D25) ← 本章各 Scene 上的 PromiseBeat,按 Scene 分组:`[建立]/[推进]/[反挫]/[兑现]` 标签 + 按 kind 固定的一句推进指令(埋设不解释/推进保悬念/反挫压回/兑现不复读),`beat.note` 全文作「本次指示」,`payoffExpectation` 全文只附在兑现任务上。archived 场的 beats 不参与(D5),abandoned 线的 beats 不下发;**无任务时整段不出现**。
7. **未决决策警告**(Task 93 D26) ← 触及本章的 open Decision:决策 title/name、待决问题、候选方案、触及原因,措辞含「不得擅自写死」。触及判定 = anchor 命中本章 / 本章内 Scene / 本章 Scene 所属 Thread / 本章 beats 的 Promise,外加 story 级且拍板期限距本章 ≤3 章序位(含期限已到/已过;期限章已删则无从计算章序,不触发);act/content 锚不做章级触及判定。判定口径**宁多勿漏**。**无触及时整段不出现**。

### 3 / 6 / 7 三段的分工

三段都在约束「writer 写出来该是什么样」,但防的错误与数据来源不同,互不替代:

| 段 | 防什么 | 来源与维护 |
| --- | --- | --- |
| 3 信息控制 | **防泄露**:写完逐条核对,writer 是否让角色知道了他不该知道的、是否泄露了必须隐藏项 | ChapterBrief 手填;不参与 status 阶梯 |
| 6 本章 Promise 任务 | **防欠债**:规划期打的计划 beat,本章该推进的债务线推进到位、幅度按 note 收住 | PromiseBeat 派生,自动编译;有任务才出现 |
| 7 未决决策警告 | **防写死**:未拍板的问题保持开放,不替 leader 做决定 | open Decision 派生,自动编译;触及本章才出现 |

## status 阶梯

`needs_plot`(无 Scene)→ `needs_world_anchor`(Scene 缺时间范围)→ `needs_world_context`(subject 未接入 World Engine)→ `ready`。

**信息控制不参与 status**:四字段全空不再降级、不再阻断 handoff——它已降级为事后核对清单(宪法第五条)。规划层两段只追加内容,同样**不参与 status 阶梯**。非 `ready` 时 leader 应先补齐再交接。

## 不进 brief 的东西

- **设定复述**:角色底设、力量体系、世界规则——指向 lorebook,不抄进 brief(双真相源会漂移)。
- **可查询状态**:HP / 位置 / 属性数值——autonomous 由 writer 查;curated / slice-only 由编译器展开摘要,但仍不 dump raw attrs/patch JSON。
- **文风约束**:文风、避讳词、show-don't-tell、markdown 方言——全在 writer profile,brief 不重复。

## 相关文档

- [system.md](system.md):Plot 两棵树、ChapterBrief 与 Promise / PromiseBeat / Decision 实体。
- [agent-spec.md](agent-spec.md):Promise 自由文本三层分工(summary / payoffExpectation / beat.note)与 Decision 纪律——评审视图第 6/7 段消费的字段怎么填。
- [../world-engine/workflow.md](../world-engine/workflow.md) §6:防全知模式、Leader-Writer 协作。
- [../agent/leader-default.md](../agent/leader-default.md):leader 调用 writer 的协议。
