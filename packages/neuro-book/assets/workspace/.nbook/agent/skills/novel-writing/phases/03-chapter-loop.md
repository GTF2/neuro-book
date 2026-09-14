# 环节三：正文循环（写作 → 评审 → 修订）

指导 leader 调用普通 `writer` profile 把设计好的章节写成正文，然后评审、修订到可交付。原理见 `reference/world-engine/workflow.md` 第 6 节 Leader-Writer 协作；本文只讲操作流程。

本环节不负责重新设计剧情。默认前提是本章剧情事实已经在环节一/二中由用户确认，并且涉及的状态变化已经落进 World Engine。若用户只是说“写这一章”但剧情事实、时间范围、参与角色或结尾位置还没确认，先回环节一/二，再回来调用 writer。

核心契约：**writer 对 World Engine 只读**。所以协作围绕"写作前 leader 已经把世界状态推进好"展开——leader 先演化世界、设计剧情，再调用 writer；writer 自己查询 World Engine 写正文。

## 前置检查

开始前确认：

- 当前 Project Workspace 明确。
- 目标章节内容节点存在，例如 `manuscript/001-volume/001-chapter/`，其中 `index.md` 是写入目标。**若目标章节节点还不存在（新用户写第一章时常如此），先用 `workspace node new manuscript/NNN-volume --type volume` 建卷，再用 `workspace node new manuscript/NNN-volume/NNN-chapter --type chapter` 建章节，再继续。**
- World Engine 已初始化（有 calendar、纪元锚点、需追踪的角色 subject）。**若未初始化，先走 `novel-setup` 阶段四，再回来写章节。**
- 本章剧情事实已经确认，且已在环节二落入 World Engine。若还没有确认，不要在本环节里替用户临时定稿。
- 需要设定上下文时，已确定要建议 writer 读取的 lorebook 内容节点 path。
- 本章若落在一对已声明关键帧之间：先用 `get_story_keyframe` / `get_tween_keyframes` 读出帧与补间路标。帧声明（`irreversibleChanges`）是事实级内容，可以进 writer 的动笔前上下文；但它仍是事实声明，不要改写成"必须写到 / 必须隐瞒"一类指令（宪法第二条、第五条）。

## 第一步：写作前先推进 World Engine（关键）

**世界状态先行。** 在调用 writer 之前，leader 先确认本章要发生的剧情事件已经按时间顺序写入 World Engine（解封、交流、追入、对峙……）。如果环节二已经推进过，只需用 `execute_world` 抽查相关 subject 和时间范围；如果还没推进，先回环节二完成剧情事实确认与状态写入，不要在本环节边设计边写。

推进时遵循**最少支持当前叙事**原则（详见 `reference/world-engine/recording-principles.md`）：

- 群体角色先用单一 subject 表示整体（"邪教徒巡逻队"而不是逐个邪教徒），需要时再拆分重要个体。
- 每个 subject 通常 1-2 条切面（起因 + 当前状态），不记录每一个细节行动。
- 临时龙套不建 subject，只在主角切面的 `events` 文本里提及。
- 角色需要展现之前未交代的能力 / 知识时，向更早时间插入一条 `kind=backstory` 切面溯源，而不是在当前时刻凭空 set。

操作边界（详见 `reference/world-engine/calendar-system.md` 与 `subject-lifecycle.md`）：

- 时间一律用项目 `world-engine/calendar.ts` 能 parse 的日历字符串。Simple Calendar 若配置了 `cycleNames` / `monthName`，可使用月份名；否则使用数字月份。禁止 raw instant。
- 同一 instant 只能有一个切面；目标时刻已存在切面时会冲突报错。优先用 `execute_world` 的 `world.slice.list({withPatches:true})` 或 `world.slice.get(sliceId)` 取得 `sliceId` / `patchId`，再用 `world.slice.editPatches` 合并或修正。只有整条切面作废时才用 `world.slice.delete` 物理删除。
- 写完后检查返回的 issues：`severity: "error"` 必须修；`severity: "advisory"` 确认本次语义符合预期即可，不落库。向用户解释时使用返回的 `title`、`message`、`explanation`，不要自行按 code 生成文案。
- 对用户用人话解释做了什么（"我把这段剧情记到时间线里了"），不抛 slice / patch / op 这些术语。

## 第二步：调用 writer（意图不下发）

通过 `invoke_agent` 调用 `writer`。两个入口各有分工：

- `input`：传 `{path: "manuscript/001-volume/001-chapter/index.md", chapterId: "<StoryChapter id>", context: {lorebookEntries: ["lorebook/character/foo/", ...]}}`。
  - `path` 是本轮唯一写入目标，必须是当前 Project Workspace 相对路径，指向章节 `index.md`。
  - `chapterId` 让 writer 用 `get_chapter_writer_brief` 自取本章**事实简报**。
  - `context.lorebookEntries` 只传内容节点 path 字符串数组（目录路径，结尾带 `/`）。
- `message`：只写交付要求（写进哪个文件、什么时候算完成）。

**写作宪法第二条/第五条：writer 的动笔前上下文只含事实，不含意义。** 所以：

| 由 writer 自取 / 只传事实 | 只交写后评审（不写进 message） |
| --- | --- |
| 时间 / 地点 / 在场角色 / 世界状态截面 | 本章目标与落点、本场目的、写作提示、线索脉络 |
| 本章参数（视角、语气） | 信息控制四字段（谁知道什么 / 谁不知道什么） |
| 建议读取的 lorebook | 禁写项、节奏与开场钩子 |
| World Engine 查询提示（autonomous 模式） | Promise 推进指令、未决决策警告 |

右列全部在 `get_chapter_writer_brief` 评审视图（`reviewChecklistMarkdown`）里：评审步骤交给评审 agent，或作为 `chapter-write-review-revise` 的 `brief` / `infoControl` 参数传入。ChapterBrief 上这些字段仍然要填——它们不是没用了，而是从"事前告知"改成"写完拿正文来撞"的核对清单，填得越具体，事后校验越准。

也不要传可查询的状态细节（HP / 位置 / 完整世界状态 / patch 细节）：writer 会用只读 `execute_world` 自查，塞进去既冗余，又让它退化成纯执行者。

writer 实际拿到的动笔前上下文长这样（`get_chapter_writer_brief` 的 writer 视图，节选）：

````
# Chapter Writer Brief — Autonomous（自主查询）

Chapter: 开篇(name: 001-opening)
Status: ready
> 事实切片:以下只给此刻的事实与查询提示——时间、地点、在场角色,以及你该用 execute_world 查什么。没有因果链,也没有意义指令;信息边界由系统在写完之后核对。放开写现场。

## 本章参数（覆盖 writer 默认）
- 视角：薇洛丝单视角第三人称

## 关键剧情点（按 Scene）

### 1. 星陨遗迹解封
- Thread: 薇洛丝主线（主线）
- 本场做什么: 薇洛丝在遗迹深处解开莉雅的封印，两人初次交流。
- World 查询提示: 用 execute_world 查 subject [薇洛丝, 莉雅]、地点 星陨遗迹 在 复兴纪元1日 18:00 ~ 18:40 的状态

## 建议读取
- lorebook/location/ruins-meteor/（depends_on · 确认遗迹设定）
````

## 第三步：writer 侧（自查状态后写正文）

writer 拥有 readonly `execute_world` 能力。它的典型流程是：用 `get_chapter_writer_brief` 按 `input.chapterId` 自取本章事实简报 → 读简报与 `input.context` 指定的 lorebook → 用 `execute_world` 按简报提示查相关 subject 在章节时间范围的状态 → 构思并写入正文到章节 `index.md` → `report_result` 报告落点。writer 的详细执行手册见 `novel-writer-execution` skill。

leader 不需要在此步骤干预；writer 是自主子代理。注意 writer 能查到角色真值，但在某个角色视角的叙述里不会让该角色"知道"他不该知道的设定——查询服务于写作一致性，不等于授权角色越界知情。

## 第四步：评审

writer 完成后，leader 对正文做评审。基础检查（每章必做）：

- 剧情点是否全部覆盖。
- 角色视角 / 信息边界是否越界（有没有让角色知道他不该知道的设定）。
- writer 是否有超出 brief 的自由发挥（新增角色、改变受伤程度、使用未预设能力）。
- 与 World Engine 状态是否一致（位置、伤势、持有物、认知）。

需要更严格评审时（用户要求、重点章节、开局章节），可扩展评审维度：节奏与爽点、文风与 AI 味、承诺兑现（对照 Plot Promise）、读者弃书风险。可用 `invoke_agent` 拉独立评审视角逐维度出具体问题清单，每条附可执行的修改建议。

> 本环节的写-评-修可以整体交给 `run_workflow` 的 `chapter-write-review-revise` 编排：它调用真实 writer 写入目标章节文件，三个评审维度（一致性/节奏/文风）并发挑问题，writer 按 major 问题修订循环。args 传 `chapterPath` + `chapterId`（都必填：writer 按 chapterId 自取事实简报）+ `brief`（可选，**只注入评审**，不下发 writer）+ `infoControl`（**每次都要传**：从 `get_story_chapter` 读本章 ChapterBrief 的 `readerKnows` / `protagonistKnows` / `mustHide` / `hintOnly` 四字段，编译成「读者已知 / 主角已知 / 必须隐藏 / 可暗示」清单；**只注入一致性评审**，不下发 writer）+ `lorebookEntries` / `reviewRounds`(1-3) / `revise`。**漏传 `infoControl` 不会静默跳过**：一致性评审会显式标注「信息边界未核对」，返回值 `infoControlChecked=false`——看到这个标记就补上清单重跑。前置与手动流程相同：剧情事实已拍板、World Engine 已推进、章节节点已存在。需要逐步人工把关或用户要参与每轮决策时，仍按本文手动循环。轻量非章节文本（简介、文案）用 `write-review-loop`（不写文件）。
>
> 写完若干章后想做全书体检，用 `consistency-audit` workflow：leader 先列章节路径、用 execute_world 预查相关角色状态整理成 worldFacts 文本，一并传入。

## 第五步：修订

按评审结论修改正文。默认不改变核心剧情事实。

1. 确认目标文件和修改范围。
2. 读取目标正文、相关 World Engine 状态、已确认剧情事实和必要 lorebook。
3. 判断修改类型：
   - 文风/语句：直接 edit。
   - 节奏/结构：先给修改方案，再按用户确认执行。
   - 事件结果变化（改变结果、物品状态、角色位置、伤势或信息披露）：先回环节二确认剧情事实，落库后再改正文。
4. 修改正文。
5. 复查视角边界、角色信息、World Engine 状态一致性和用户要求。
6. 如果产生新事实，记录后续 World Engine 回补事项；用户确认后再写入切面。

评审 → 修订可循环多轮，直到基础检查全过、用户满意。用户直接要求润色已有旧章节时，也从本步骤进入（跳过写作步骤）。

修订约束：

- 只修改用户指定范围或明确相关段落。
- 不引入未确认的核心设定或剧情转向。
- 如改变世界状态，已说明并提交或挂起 World Engine 回补。

## 两种协作模式

**模式 A：标准（推荐）**

```
leader 设计剧情 → leader 写作前推进 World Engine → leader 确认 ChapterBrief 与 Plot → writer 自取事实简报并写正文 → leader 按核对清单评审 → 修订
```

世界状态先行，writer 看到的状态始终一致。需要严格控制剧情走向时用这个模式。

**模式 B：自由发挥（可选，默认不推荐）**

```
leader 给大致方向 → writer 自由发挥（含剧情细节）→ leader 事后把偏离的状态变化补回 World Engine
```

仅在**用户明确允许 writer 自由发挥**的探索性写作时使用。leader 只给方向，writer 可增加新角色、改变受伤程度。写后 leader 读取正文、提取状态变化，补进 World Engine（创建新角色 subject、更新状态、补能力溯源）。此模式生成快、即兴感强，但 writer 承担了部分剧情设计、World Engine 滞后于正文、需要更多后处理，所以默认不推荐。

## 完成标准

- 正文写入唯一目标章节 `index.md`。
- 本章状态变化已在 World Engine：标准模式写作前已推进，自由模式写后已补回。
- writer 已通过 `report_result` 报告写入路径与剧情摘要。
- 评审基础检查全部通过：剧情点覆盖、视角与信息边界无越界、与 World Engine 一致。
- 修订产生的新事实已落库或显式挂起。
- 若本章落在一对帧的补间区间内：区间帧没有悬空的 `violated` 状态——要么维持帧并已 `confirmed`，要么被推翻且已 `overthrown` 并挂 `decisionRefId`（宪法第六条）。
