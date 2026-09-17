# 主编话术与文案包（T0.8）

> 状态：**成稿**（不是提纲，每条可直接落地）
> 日期：2026-09-17 ｜ 执行者：software-product-manager
> 来源：`deliverables/unified-implementation-plan-2026-09-17.md` 第 4 节 T0.8 卡片
> 人设蓝本：`deliverables/ui-conversational-paradigm-assessment-2026-09-17.md`（2.2 节话术示例）；`deliverables/competitive-flow-analysis-2026-09-17.md`（快捷入口缺口）
> 消费方：T1.1（组 1）、T1.6①（组 2）、T0.7 + T1.7（组 3）、T1.3 + M5（组 4）、T1.6②③ + T1.5-B2（组 5）

---

## 0. 人设与文风规则（全包通用，写新文案时照此执行）

「主编」是一位资深图书编辑，也是能一起熬夜改稿的朋友：懂行、直接、有分寸。

1. **说人话**：禁用工程词——「检测到」「初始化」「实体」「校验」「锚点」「上下文」「状态」作技术义使用，一律不出现。技术概念必须翻成编辑行话：场景、伏笔、设定、时间线、稿子。
2. **短句优先**：每条不超过两句。
3. **不卑不亢**：热情但不谄媚。不说「好的呢」「马上为您」「亲」。
4. **给出路**：凡是「有问题」的话术，必须让用户知道下一步点什么。
5. **人称**：主编自称「我」，称用户「你」。
6. **标点**：中文全角；每条最多一个问句。

## 1. i18n key 命名风格依据

实际读过 `packages/neuro-book/app/i18n/locales/zh-CN.ts`（行号为 2026-09-17 读取值，该文件有他人改动在途，落地时以 key 名为准）：

- **功能域命名空间 + camelCase 子键、动宾优先**：`ide.picker.sampleBook: "打开示例书"`（zh-CN.ts:1721）、`markdownStudio.toolbar.proseLint: "扫 AI 味"`（zh-CN.ts:2754）。
- **审批类按钮两字动词**：`agent.planApproval.approve: "批准"` / `reject: "拒绝"`（zh-CN.ts:2511-2512）。
- **变量插值单花括号**：`markdownStudio.status.chapterOf: "第 {current} / {total} 章"`（zh-CN.ts:2758）。
- **同族按钮就近挂靠**：llmlint 面板内已有 `markdownStudio.proseLint.rescan: "重新扫描"`（zh-CN.ts:2764），「扫全稿」应挂同命名空间。

**本包新增命名空间建议**：

| 命名空间 | 用途 | 挂靠理由 |
|---|---|---|
| `agent.chiefEditor.*` | 主编人设话术（开场白、brief 话术） | 与 `chatSurface`/`planApproval` 平级的新子命名空间，集中管理人设文案，避免散落 |
| `agent.planConfirm.*` | 方案确认卡（T1.3 组件族） | 与 `planApproval` 区分：后者是既有计划审批，前者是结构化方案卡 |
| `agent.auditReport.*` | 定稿审计报告 UI 壳与按钮 | 报告正文由服务端拼装（见组 3 说明），UI 壳需要 key |
| `markdownStudio.proseLint.scanAll*` | 扫全稿 | 就近挂既有 `proseLint` 命名空间 |
| `ide.picker.chatWithAi` | 书架空态第三入口 | 与 `sampleBook`（zh-CN.ts:1721）同层同风格 |

---

## 组 1 ｜ 新会话开场白（3 条）

注入方式（T1.1）：新建会话时注入一条本地 assistant 消息，**不调模型**，离线可测。三种场景按项目状态选择。

### 1.1 无项目（主编第一句话）

- **key**：`agent.chiefEditor.opening.noProject`
- **zh-CN**：想写点什么？不用先想好整本书——一个画面、一个人物、哪怕一种心情都行，随口说说，我帮你把它捏成故事的形状。
- **en-US**：What do you feel like writing? A single image, a character, even just a mood is enough to start — I'll help shape it into a story.
- **场景**：新用户（或书架为空）新建会话的第一条 assistant 消息。
- **变量**：无。
- **注**：蓝本来自范式评估 2.2 节阶段一话术，此处微调收紧为两句。

### 1.2 有项目（接续语）

- **key**：`agent.chiefEditor.opening.withProject`
- **zh-CN**：上次写到第 {chapterNo} 章。今天接着写，还是先聊聊剧情？
- **en-US**：Last time we left off at chapter {chapterNo}. Keep writing today, or talk through the plot first?
- **场景**：打开有进度的项目后新建会话。
- **变量**：`{chapterNo}`＝最近一章的章序号（整数，调用方传入）。

### 1.3 刚定稿（衔接语）

- **key**：`agent.chiefEditor.opening.afterFinalize`
- **zh-CN**：第 {chapterNo} 章定稿了。趁手感还在——第 {nextChapterNo} 章想写什么？
- **en-US**：Chapter {chapterNo} is locked in. While it's fresh — what should chapter {nextChapterNo} be about?
- **场景**：用户刚点完某章「定稿」后开启的下一条会话（含「再来一章」进入的会话）。
- **变量**：`{chapterNo}`＝刚定稿章号；`{nextChapterNo}`＝下一章章号（**调用方算好 `{chapterNo}+1` 传入，i18n 不做运算**）。

---

## 组 2 ｜ brief 失败人话翻译（3 态 + 按钮）

技术含义（`packages/neuro-book/server/plot/services/chapter-writer-brief.service.ts:277-288`，按固定优先级聚合）：
- `needs_plot`：本章一个场景都没挂（scenes 为空）；
- `needs_world_anchor`：有场景没定世界时间（start/end instant 缺）；
- `needs_world_context`：场景的世界信息算不出来或有角色/地点没登记（worldContext 为空或 unresolved 主体非空）。

翻译原则：不说状态名，只说「缺什么 + 补了会怎样」，按钮负责「去哪补」。

### 2.1 缺场景（needs_plot）

- **key**：`agent.chiefEditor.briefGate.needsPlot`
- **zh-CN**：第 {chapterNo} 章还缺一场戏。说说这章该发生什么，我来把它排上。
- **en-US**：Chapter {chapterNo} still needs a scene. Tell me what should happen here and I'll get it in place.
- **场景**：进度区/会话内 brief 状态为 needs_plot 时的话术。
- **变量**：`{chapterNo}`。

### 2.2 缺时间定位（needs_world_anchor）

- **key**：`agent.chiefEditor.briefGate.needsWorldAnchor`
- **zh-CN**：场景「{sceneTitle}」还没定发生在故事里的哪段时间——定个时间，这章就能开写。
- **en-US**：The scene “{sceneTitle}” isn't pinned to a point in the story's timeline yet. Give it a time and this chapter is good to go.
- **场景**：brief 状态为 needs_world_anchor。
- **变量**：`{sceneTitle}`＝首个缺时间定位的场景标题。

### 2.3 缺设定档案（needs_world_context）

- **key**：`agent.chiefEditor.briefGate.needsWorldContext`
- **zh-CN**：场景「{sceneTitle}」里有些人物、地点还没登记进设定。补齐了我才查得到他们此刻的样子。
- **en-US**：Some of the people and places in “{sceneTitle}” aren't in the setting records yet. Fill them in and I can check what they're like at this point in the story.
- **场景**：brief 状态为 needs_world_context。
- **变量**：`{sceneTitle}`＝首个缺档案的场景标题。

### 2.4 「带我去补」按钮（三态共用）

- **key**：`agent.chiefEditor.briefGate.takeMeThere`
- **zh-CN**：带我去补
- **en-US**：Take me there
- **场景**：紧随三态话术的统一按钮。跳转目标按态区分：needs_plot → 剧情场景编辑；needs_world_anchor → 该场景的世界时间定位；needs_world_context → 设定登记（lorebook/世界主体）。

### 2.5 多处待补后缀（可选）

- **key**：`agent.chiefEditor.briefGate.moreCountSuffix`
- **zh-CN**：（还有 {count} 处要补）
- **en-US**：(and {count} more to fill in)
- **场景**：可选。同一状态命中多个场景时，追加在 2.2/2.3 话术末尾；默认只报第一处，避免刷屏。
- **变量**：`{count}`。

---

## 组 3 ｜ 定稿审计报告模板（三源）

消费方：T0.7 定稿审计服务（输出中文审计报告 DTO）+ T1.7（确认卡形式展示）。
**分工说明**：报告**正文段落**（三源标题、无问题句、问题条目）建议由服务端按本模板拼装（DTO 直接携带成句中文，前端不做二次拼接）；**UI 壳与按钮**走 i18n key。en-US 版本供后续国际化，服务端可按 locale 输出对应模板。

### 3.1 报告头

| key | zh-CN | en-US |
|---|---|---|
| `agent.auditReport.title` | 第 {chapterNo} 章 · 定稿审计 | Chapter {chapterNo} · Final Audit |
| `agent.auditReport.subtitle` | 我核对了三样东西：答应读者的、世界该有的、文字本身的。 | I checked three things: what we promised readers, what the world should hold, and the words themselves. |

### 3.2 源① 承诺对照

| 项 | key | zh-CN | en-US |
|---|---|---|---|
| 标题 | `agent.auditReport.promiseTitle` | 承诺对照 | Promise check |
| 无问题 | `agent.auditReport.promiseOk` | 该推进的都推进了，账面干净。 | Everything that should move forward did — the ledger is clean. |
| 问题条目·该兑现未兑现 | `agent.auditReport.promiseIssuePayoff` | 《{promiseTitle}》到了该兑现的时候，这章没兑现。 | “{promiseTitle}” was due to pay off, but this chapter didn't. |
| 问题条目·该推进未推进 | `agent.auditReport.promiseIssueProgress` | 《{promiseTitle}》说好这章往前走一步，实际没动。 | “{promiseTitle}” was supposed to move forward this chapter, but it didn't budge. |

- **条目格式**：每问题一行，行内只有上述成句；「·」前缀与悬挂缩进由 UI 渲染。
- **变量**：`{promiseTitle}`＝承诺标题（服务端取账本数据）。

### 3.3 源② 状态对照

| 项 | key | zh-CN | en-US |
|---|---|---|---|
| 标题 | `agent.auditReport.worldTitle` | 状态对照 | State check |
| 无问题 | `agent.auditReport.worldOk` | 这章发生的事都记进了世界，没漏项。 | Everything that happened this chapter made it into the world record — nothing slipped. |
| 问题条目·声明未入账 | `agent.auditReport.worldIssueMissing` | 本章里{factSummary}，还没写进世界状态。 | This chapter {factSummary}, but it isn't in the world record yet. |

- **条目格式**：同 3.2。
- **变量**：`{factSummary}`＝结算表声明的事实变化短语（如「林晚的左臂受了伤」；en 为从句，如 "left Wan's left arm injured" → 调用方保证语法完整）。

### 3.4 源③ 文字体检

| 项 | key | zh-CN | en-US |
|---|---|---|---|
| 标题 | `agent.auditReport.textTitle` | 文字体检 | Language check |
| 无问题 | `agent.auditReport.textOk` | 没扫出那种一眼假的 AI 腔。 | No telltale AI-ish writing came up. |
| 有问题·汇总行 | `agent.auditReport.textIssueSummary` | 扫出 {count} 处比较扎眼的，都列在下面。 | Found {count} spots that stand out — listed below. |
| 问题条目 | `agent.auditReport.textIssueItem` | 第 {line} 行：{excerpt}（{ruleName}） | Line {line}: {excerpt} ({ruleName}) |

- **条目格式**：命中按行号排序；`{excerpt}`＝原文摘录（截 20 字，服务端截断）；`{ruleName}`＝llmlint 规则的**中文名**（规则名翻译属独立工作，见「未覆盖项」）。
- **变量**：`{line}`、`{excerpt}`、`{ruleName}`、`{count}`。

### 3.5 结尾建议区（服务端按问题数三选一）

| 情形 | key | zh-CN | en-US |
|---|---|---|---|
| 区标题 | `agent.auditReport.adviceTitle` | 我的建议 | My take |
| 全干净 | `agent.auditReport.adviceAllClear` | 三样都过关。就差你一句话——定，还是再看看？ | All three checks pass. Your call — lock it in, or sleep on it? |
| 有问题·轻 | `agent.auditReport.adviceMinor` | 问题不大，改不改你定：改完再定，或者先定、下次一起收拾。 | Nothing serious — your call: fix now and lock in, or lock in and clean up next round. |
| 有问题·重（含硬伤） | `agent.auditReport.adviceMajor` | 这章先别定。把上面的硬伤处理了，我们再来一遍。 | Let's not lock this one in yet. Deal with the hard issues above and we'll run it again. |

### 3.6 报告动作按钮（T1.7 确认卡消费）

| key | zh-CN | en-US |
|---|---|---|
| `agent.auditReport.finalize` | 定稿 | Finalize |
| `agent.auditReport.goBack` | 回去改 | Go back and revise |
| `agent.auditReport.finalizeHint` | 定稿后，这一章的改动会正式入账。 | Once finalized, this chapter's changes go on the record for good. |

- `finalizeHint` 用于「定稿」按钮的强确认提示（悬停说明或点击后二次确认行）；「定稿」提交世界与账本写入，按不可逆口径提示。

### 3.7 整报告渲染样例（供 T0.7 对照）

> **第 3 章 · 定稿审计**
> 我核对了三样东西：答应读者的、世界该有的、文字本身的。
>
> **承诺对照**
> · 《这把枪还没响》到了该兑现的时候，这章没兑现。
>
> **状态对照**
> 该推进的都推进了，账面干净。 ←（示意：此源无问题时用这句）
>
> **文字体检**
> 扫出 6 处比较扎眼的，都列在下面。
> · 第 14 行：他的眼中闪过一丝不易察觉的复杂神色（眼中闪过一丝…）
> · …
>
> **我的建议**
> 这章先别定。把上面的硬伤处理了，我们再来一遍。
>
> ［回去改］ ［定稿］

---

## 组 4 ｜ 方案确认卡文案

消费方：T1.3 `AgentPlanConfirmCard.vue` 组件族 + M5 防疲劳默认。命名空间 `agent.planConfirm.*`（与既有 `agent.planApproval` 区分）。

### 4.1 卡片标题（按方案类型三选一）

| key | zh-CN | en-US |
|---|---|---|
| `agent.planConfirm.titleOutline` | 这版大纲你过目 | Here's the outline — take a look |
| `agent.planConfirm.titleLorebook` | 这批设定你过目 | Here's the setting pack — take a look |
| `agent.planConfirm.titleRetrieval` | 我找到这些资料 | Here's what I found |

### 4.2 三个主按钮（与 `planApproval` 的两字动词风格对齐）

| key | zh-CN | en-US | 行为 |
|---|---|---|---|
| `agent.planConfirm.confirm` | 就这么定 | Let's go with this | 整体确认，方案落库 |
| `agent.planConfirm.reviseItems` | 改几处 | Tweak a few | 进入逐项 ✓/✗/改 |
| `agent.planConfirm.redoAll` | 推倒重来 | Start over | 整体重做，回会话重新讨论 |

- **已定（总设计师代决 2026-09-17）**：采用「推倒重来」。理由：与「批准/拒绝」两字动词风格一致（三字对仗更利落），且「推倒重来」在大纲讨论语境里是常用口语、无冒犯感；「整体重做」偏工程腔，与主编人设不符。

### 4.3 逐项操作（图标按钮的文本/tooltip）

| key | zh-CN | en-US |
|---|---|---|
| `agent.planConfirm.keepItem` | 保留 | Keep |
| `agent.planConfirm.dropItem` | 不要 | Drop |
| `agent.planConfirm.editItem` | 改 | Edit |

### 4.4 防疲劳摘要态（M5：默认摘要级，展开见细节）

| key | zh-CN | en-US |
|---|---|---|
| `agent.planConfirm.summaryState` | 共 {count} 项 · 摘要 | {count} items · summary |
| `agent.planConfirm.expandDetail` | 展开细看 | Show details |
| `agent.planConfirm.collapseDetail` | 收起 | Collapse |

- **场景**：卡片默认只显示「共 {count} 项 · 摘要」+ 展开按钮；展开后才见逐项列表。变量 `{count}`＝方案条目数。

### 4.5 不可逆操作的强确认（弹层）

| key | zh-CN | en-US |
|---|---|---|
| `agent.planConfirm.irreversibleTitle` | 这个动作收不回来 | This one can't be undone |
| `agent.planConfirm.irreversibleBody` | {actionName}之后，就回不到现在这版了。 | After you {actionName}, there's no way back to this version. |
| `agent.planConfirm.irreversibleConfirm` | 就这么办 | Do it |
| `agent.planConfirm.irreversibleCancel` | 再想想 | Hold on |

- **场景**：触发不可逆动作（如「推倒重来」将丢弃已生成方案、或涉及删除已落库条目）时弹出。
- **变量**：`{actionName}`＝动作名（zh 传「推倒重来」等动词短语；en 传动词原形）。

### 4.6 提交后回执（主编口吻收尾，各一条）

| key | zh-CN | en-US |
|---|---|---|
| `agent.planConfirm.afterConfirm` | 好，就按这个来。 | Great — going with this. |
| `agent.planConfirm.afterRedo` | 行，我重新想一版。 | Alright, I'll take another pass. |

---

## 组 5 ｜ 快捷入口文案

### 5.1 再来一章（定稿后一键进下一章）

| key | zh-CN | en-US |
|---|---|---|
| `agent.chatSurface.nextChapterQuick` | 再来一章 | One more chapter |
| `agent.chatSurface.nextChapterQuickHint` | 带上这一章的设置，直接开下一章 | Carry this chapter's setup into the next one |

- **场景**：定稿完成后出现在会话流末尾；点击复制上一章参数（视角/场景/字数目标等）直接进入下一章循环（T1.6③，依赖 T1.7）。Hint 为按钮 tooltip（可选）。
- **注**：点击后新会话的开场白用组 1.3（刚定稿衔接语）。

### 5.2 和 AI 聊（书架空态第三入口）

| key | zh-CN | en-US |
|---|---|---|
| `ide.picker.chatWithAi` | 和 AI 聊 | Chat with AI |
| `ide.picker.chatWithAiHint`（可选） | 不知道写什么？先聊聊，一个念头也行。 | Not sure what to write? Just talk — one stray idea is enough. |

- **场景**：`ProjectPickerScreen.vue` 空态区（现有「新建」「打开示例书」两钮旁的第三钮，见该文件 :765-768 现状）；点击直达 agent 布局新会话（T1.6②，与④灵感探索入口合并实现），开场白用组 1.1。
- **已定（总设计师代决 2026-09-17）**：采用「和 AI 聊」。理由：空态是产品第一屏，「主编」概念此时尚未建立（用户还没经历过会话），过早引入人设词反而增加理解成本；「和 AI 聊」零学习成本，人设在会话内部由话术建立。

### 5.3 扫全稿（llmlint 全稿扫描）

| key | zh-CN | en-US |
|---|---|---|
| `markdownStudio.proseLint.scanAll` | 扫全稿 | Scan the whole manuscript |
| `markdownStudio.proseLint.scanAllRunning` | 正在扫全稿，稍等… | Scanning the whole manuscript… |
| `markdownStudio.proseLint.scanAllSummary` | 全书 {fileCount} 个文件，扫出 {hitCount} 处 | {hitCount} hits across {fileCount} files |
| `markdownStudio.proseLint.scanAllEmpty` | 全稿干净，没扫出 AI 味。 | The whole manuscript is clean — no AI-ish writing found. |
| `markdownStudio.proseLint.scanAllFileGroup` | {fileName}（{hitCount}） | {fileName} ({hitCount}) |

- **场景**：`NovelProseLintPanel` 内新增按钮（与既有 `proseLint.rescan: "重新扫描"` 同族，zh-CN.ts:2764）；调 T0.4 目录模式，结果按文件分组 + 统计头（T1.5-B2）。
- **变量**：`{fileCount}`、`{hitCount}`、`{fileName}`。
- **注**：级别措辞复用既有 `proseLint.levelHigh/Medium/Low`（zh-CN.ts:2772-2774）。

---

## 未覆盖项说明（如实列出，不充数）

1. **llmlint 规则中文名映射**（组 3 的 `{ruleName}`）：360 条规则的中文命名是独立工作量，本包只定条目格式；建议单独排期。
2. **「再来一章」点击后的下一章循环内话术**：依赖 T1.7 定稿闭环的具体交互形态，届时按「话术微调支持」补。
3. **两处二选一已由总设计师代决（2026-09-17）**：①组 4.2 采用「推倒重来」；②组 5.2 采用「和 AI 聊」——理由见各条「已定」注。
4. **书架空态整体文案重写**：属 UI 线（ui-redesign）范畴，本包只给第三入口的按钮与提示。
5. **组 3 的 en-US 服务端输出**：当前 T0.7 契约是中文报告 DTO；en 模板已备好，接入时机由工程师定。
6. **行号时效**：zh-CN.ts 有他人改动在途，文中行号是 2026-09-17 快照；落地以 key 名与命名风格为准。

## 条数统计

| 组 | 条数（含可选） |
|---|---|
| 组 1 开场白 | 3 |
| 组 2 brief 翻译 | 5（3 话术 + 1 按钮 + 1 可选后缀） |
| 组 3 审计报告 | 20（头 2 + 源①4 + 源②3 + 源③4 + 建议 4 + 按钮 3） |
| 组 4 方案确认卡 | 18（标题 3 + 主按钮 3 + 逐项 3 + 摘要态 3 + 强确认 4 + 回执 2；另有 1 条备选按钮文案） |
| 组 5 快捷入口 | 9（3 主 + 6 辅，其中 2 条可选） |
| **合计** | **55** |
