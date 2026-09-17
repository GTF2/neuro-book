# NeuroBook 界面收敛与视觉引导方案

> **配套文档**：`DESIGN.md`（同目录）——那份讲视觉语言（配色/排版/主题包落地），这份讲**信息架构与引导**（怎么把"功能繁杂"变成"有引导的写作台"）。
> **触发需求**：GTF 原话——「UI 界面尽可能简洁干净，现在功能繁杂，让人看得眼花缭乱，也没有一个好的视觉引导」。
> **状态**：`draft`。所有外部借鉴都标了出处与证据等级；未验证项已显式标注。

---

## 1. 诊断：复杂度到底堆在哪

不是感觉问题，是可数的。

| 位置 | 现状 | 出处 |
|---|---|---|
| 活动栏常驻项 | **同屏 6–7 个图标**：`files` `characters` `plot` `world`（primary）+ `trace` `history`（secondary）+ 底部 `account` `settings`。**分组机制本来就有**（primary / secondary / footer，且 secondary 已带 overflow 进 More 的逻辑），问题不在「没有分组」，而在 primary 里配置型入口与写作型入口同权 | `app/utils/workbench-chrome.ts:61-86` |
| 首屏挂载 | **14 个** Dialog / Panel / Workbench / Screen 组件 | `app/pages/index.vue` |
| 剧本工作台 | 4 个 tab（线程规划 / 承诺账本 / 裁决记录 / 关键帧） | `PlotWorkbenchDialog.vue` |
| 应用体量 | 259 个组件 / 79,862 行 | 2026-09-17 体检报告 |
| 剧本预览页 | 单页 4 层 chrome 堆叠（页面头 → 工作区头 → 视图切换 → 内容） | `plot-locator-dark-viewport.png` 截图 |

### 根因（一句话）

**NeuroBook 的界面是按「能力清单」组织的，不是按「作者下一步要决定什么」组织的。**

后者是 Nielsen Norman Group 给渐进披露定的那个起手问题：

> "What must someone decide next, and which information can wait until that decision is made?"
> —— NN/g, *Progressive Disclosure*（E3）

NeuroBook 现在把四层能力（写正文 / 管设定 / 看运行 / 改配置）全部平铺在同一个层级上，让用户每次开软件都要重新做一次优先级判断。这就是「眼花缭乱」的机制性来源——**不是元素太多，是元素之间没有主次**。

### 一条会一直刺人的判据

2026 年多份写作工具评测里，评价一款写作应用的第一句话是这样的：

> "Does the app respect a writing session, or does it ship seventeen sidebars?"
> —— Daniel Ng, *Best Writing Apps 2026*（E1）

按这条量 NeuroBook 现在的稿面：活动栏 6–7 个图标 + 工具面板 + 编辑器工具栏（含一个带文字的「扫 AI 味」按钮）+ Agent 面板入口 + 状态栏。**进稿面时能看见的常驻控件明显多于"一次写作会话"需要的数量。**

---

## 2. 可以借鉴的成果（附出处与可转化规则）

按技能的 `research-catalog` 分级，只采纳能转化成项目规则的部分。

### 2.1 iA Writer 的 Focus Mode —— 直接回答「没有视觉引导」

**来源**：iA Writer 官方站 + 2026 年独立评测（E1/E2；多来源一致：App of the Year ×4、Apple Design Award finalist 2025、`thesunrisedigest.com` 2026 年评测第一）

**观察到的事实**：
- 官方定位："The main feature of iA Writer is **not having many features**"
- **Focus Mode**：高亮当前正在写的句子/段落，其余部分**变灰**——"fades out everything else in your document other than the line or paragraph you're working on"
- 有 **Syntax Highlight**：给形容词/副词/动词着色，用来在修订时发现文风问题
- 被总结为"a scalpel in a world of Swiss army knives"

**局限**：iA Writer 是纯文本编辑器，没有设定库、没有 AI、没有章节管理——它的极简靠**砍功能**达成，NeuroBook 不能照抄这个代价。

**转化成本项目的规则**：
> **规则 G1｜稿面专注模式**：进入写作会话时，当前段落/句子保持全色（`--text-main`，不透明度 1），其余段落降到 **28% 不透明度**。纯静态、无动画，键盘可切换，不需要模型参与。
> 这是"视觉引导"最便宜也最直接的一件东西——**用户不需要找路，因为路被点亮了**。

### 2.2 NN/g 的披露上限与四条判断 —— 回答「活动栏怎么分组」

**来源**：NN/g, *Progressive Disclosure*（**E3**，权威可用性研究机构）

**观察到的事实（原文要点）**：
- **"designs that go beyond 2 disclosure levels typically have low usability"** —— 超过 2 层披露，用户会在层级间迷路
- 如果功能实在太多："at least **chunk your advanced features into groups that make sense**, so that users need check only one place and can ignore any areas that they don't need"
- **"it's rarely a good idea to offer multiple ways to progress to secondary options"**
- 四条分组判断（频率 / 共同使用 / 期望 / 受众）：

| 判断 | 留在第一层 | 下沉到第二层 |
|---|---|---|
| 频率 | 出现在常见任务路径上 | 专门或罕见场景 |
| **共同使用** | 用户需要**和其他可见选项一起比较** | 属于独立的决定 |
| 期望 | 标签与控制让下一步显而易见 | 短描述能命名清楚 |
| 受众 | 多数用户完成任务需要它 | 只有部分用户需要 |

**⚠️ 反直觉警告（这条最容易被做错）**：
> NN/g 的酒店预订案例：房型、价格、日期、可订状态**必须同屏**（用户要反复比较、来回改），而地址与支付信息属于后续阶段。
> 概括成一句话：**"设计师为了首屏干净把所有高级控件都藏起来，会拆散人们需要一起比较的选项组。"**

**局限**：渐进披露被广泛接受，但严格对照实验很少。Carroll & Rosson 的原话是 *"No empirical evidence exists regarding the effectiveness of progressive disclosure."* 所以要按**假设**来验证，不要当真理。

**转化成本项目的规则**：
> **规则 G2｜活动栏分两层，不超两层**：常驻区只放写作会话里高频且需要并置比较的入口；其余收进一个「更多」菜单。**严格两层，不做第三层。**
> **规则 G3｜分组先过"共同使用"判断**：`characters` / `plot` / `world` 是同一件事（设定）的三个面，作者常需要对照——**可以合并成一个入口用 tab 切换，但绝不可以拆到两个层级去**。

### 2.3 Sudowrite 的「有主见」 —— 回答「配置项太多」

**来源**：Sudowrite 官方对比文 + 第三方评测（E1）

**观察到的事实**：
- 被描述为 "surprisingly uncluttered"、"minimalist interface"
- 关键设计选择：**"You do not configure anything; you buy a credit plan and start."** —— 功能有强主见，craft opinions are baked in
- 与 Novelcrafter 的对照：Sudowrite = Magic Wand（包办），Novelcrafter = Master Blueprint（给你结构自己搭）
- Novelcrafter 同样被评价为「简洁直观的界面和设计，易于上手」，但它是**可配置**的那一侧

**局限**：这两家都是 SaaS，能靠服务端约定来省掉配置项；NeuroBook 是本地优先 + 自带 Provider，模型/端点这类配置**省不掉**。

**转化成本项目的规则**：
> **规则 G4｜能定默认值就不要让用户选**：凡是"选不选都行"的项，一律给一个合理默认值并藏进高级设置。参考现有实现里的正面例子——「辅助任务模型」默认「跟随本 Profile」而非让用户填 key（`w00021`）。
> 判据：新增一个设置项时，先回答"不给它默认值会发生什么"。答不上来就不该出现在默认视野里。

### 2.4 Figma 的「方向感」 —— 回答「没有好的视觉引导」

**来源**：Figma Resource Library, *Seven essential UI design principles*（E3，设计工具厂商的成体系规范）

**观察到的事实**：
- 层级靠字号/字重、对比、间距三件事，不要全部拉满
- **"Be intentional about what goes where on a screen, especially what users see first and what they have to scroll to see"**
- 渐进披露的已知风险是"losing users along the way"，对策原文：**"Give users a way to orient themselves, so they know where they are and how many steps they have to go"**

**转化成本项目的规则**：
> **规则 G5｜任何多步流程都要有"我在哪、还剩几步"**：例如 Agent 会话的 follow-up 队列、世界引擎的入库流程、章节写作的帧循环。
> 星炉的启动屏用了「四步进度点」（`index.html` 的 `.nf-startup-journey`），那是同一个机制的漂亮实现——**可参考它的表达，不要复制它的装饰**。

### 2.5 空态即引导 —— 回答「新用户第一次打开看什么」

**来源**：三份行业实践整理（E2/E3 混合：tool.lu 的 onboarding skill、produktly、adoptkit，均引用 NN/g 口径）

**观察到的事实（多来源一致）**：
- "**Every blank screen is either a dead end or a launchpad**"
- 好的空态必含四件：这块地方是干什么的 / 为什么现在是空的 / 哪个动作能创建第一个 / 填满后长什么样的预览
- **Sample Data / Demo Mode**：对"空态会让人无法理解产品"的类型（仪表盘、项目工具、CRM），预置示例内容让用户在填自己的数据前就体验完整功能
- 三层节奏：Layer 1（第 1 天）只求"aha moment"，移除非必要 UI；Layer 2（第 1 周）行为触发的语境化提示；Layer 3（第 2 周+）高级能力
- **最常见的失败方式**：把渐进披露当成"藏起来"，或用**时间**驱动（第 3 天弹 A、第 7 天弹 B）而不是**行为**触发

**与项目既有结论吻合**：2026-09-17 体检报告的产品评审已建议「**空态即演示**」——新书预置 3 章示例书（含 1 个未兑现伏笔 + 5 处 AI 味），打开即感知全部能力。**本方案把它从"建议"提到"界面设计的第一原则"**。

**转化成本项目的规则**：
> **规则 G6｜空态即演示，且用真内容**：新项目不给空白页。预置 3 章示例（带一个未兑现伏笔、几处 AI 味），并在界面上**明示这是示例**、可一键清空。
> **规则 G7｜行为触发，不做时间滴灌**：提示的出现条件必须是"用户做了某事"（例：写满 3 章后才提示未来影响分析），不是"用了几天"。

### 2.6 搜索是专家的逃生通道

**来源**：NN/g（E3）+ 行业实践整理（E2）

**观察到的事实**：复杂界面里，搜索让用户绕过层级——**"Search is disclosure for experts."**

**转化**：
> **规则 G8｜提供全局命令入口**：给一个 `⌘K` / `Ctrl+K` 命令面板，覆盖所有被下沉到"更多"的功能。这样第二层就不是"藏起来"，而是"换一条更快的路"。**这条是让 G2 成立的配套条件**——没有它，下沉就等于藏。

---

## 3. 方案：三层收敛

三层的分工很清楚：**L1 加引导（做加法）、L2 收信息（做重排）、L3 退视觉（做减法）**。三者不冲突，可以并行立项，但**建议按 L1 → L2 → L3 的顺序**，因为 L1 见效最快、风险最低。

### L1 · 视觉引导层（新增，解决「没有引导」）

| # | 做什么 | 依据 | 成本 |
|---|---|---|---|
| L1-1 | **稿面专注模式**：当前段落全色，其余 28% 不透明度，键盘可切换 | G1（iA Writer） | 低（纯 CSS + 一个状态位） |
| L1-2 | **单一主操作**：任一界面同一时刻只有一个 accent 实底按钮，其余退为描边或纯文字 | Figma 层级原则 | 低（改组件用法，不改组件） |
| L1-3 | **位置感**：稿面顶部常驻「本卷第 3/12 章 · 今日 +1,240 字 · 本章 3 个待处理」 | G5（Figma / 星炉四步进度） | 低（数据已有） |
| L1-4 | **空态引导**：新项目预置 3 章示例 + 明示"这是示例" + 一键清空 | G6（体检报告已建议） | 中（要造示例内容） |

### L2 · 信息收敛层（重排，解决「功能繁杂」）

> **本轮修正（读代码后）**：初版这里写的「活动栏 10 个平级入口」**不准确**。分组机制本来就存在——
> `createWorkbenchActivityItems` 返回 `primary` / `secondary` / `footer` 三组，`secondary` 还已经带了
> overflow 进 More 的逻辑（`resolveActivityBarSecondaryItems`）。同屏常驻是 **6–7 个图标**，不是 10 个。
>
> 另外**撤回**初版的一个建议：把 `characters` / `plot` / `world` 合并成一个「设定」入口。
> 按 NN/g 的共同使用判断重过一遍，这三个恰恰是写一场戏时要**同时对照**的东西
> （这个人的性格、这个地方的规则、这条线走到哪了），塞进同一个入口的 tab 里等于逼用户在写作途中
> 反复切换——正是酒店案例点名的失败形态。**省下两个图标位不值得这个代价。**

**活动栏：按「写作时用的」与「配置时用的」分层**（严格两层，见 G2）。

需要的不是新机制，是新的**放法**：

```
现在                                   建议
primary    files                       primary    files          ← 写作
           characters                             characters     ← 写作时查
           plot                                   plot           ← 写作时查
           world                                  ───────
secondary  trace              ──────►  secondary  trace
           history                                history
                                                  world          ← 配置一次，长期不动
footer     account                     footer     account
           settings                              settings
```

判断依据是 NN/g 的频率与共同使用两条：`files` / `characters` / `plot` 在写作会话中被反复查阅且需要并置对照；`world` 是世界观引擎的配置面，配置一次长期不动。

**两条不能违反的约束**：
1. **`characters` / `plot` / `world` 不许拆到不同层级**——它们是被同一个人在同一段时间里用的（G3 的共同使用判断）。
2. **下沉项必须有 `⌘K` 入口**（G8），否则就是"藏起来"而不是"渐进披露"。

**其余重排**：
- 剧本工作台默认 tab：线程规划 → **承诺账本**（体检报告行动 #9，一行代码）
- 首屏重心：文件管理 → **能力预览 + 一个明确的开始动作**（体检报告发现 #15）
- 首屏挂载的 14 个 Dialog/Panel：改为**按需挂载**（`v-if` 懒挂载），减少首屏 DOM 与视觉噪音

### L3 · 视觉退场层（减法，解决「不干净」）

**这是本项目独有的一张牌**：nb-ui 的角色映射层就是为这件事设计的。`docs/authoring-themes.md` 原文：

> "角色映射这一层最容易被忽略……**一整套「界面退场」的低 chrome 风格可以只靠它表达，一行组件代码都不用改**"

```css
:root[data-nb-theme="sepia-paper-calm"] {
    --button-surface: transparent;    /* 按钮平时不显形，hover 才有底 */
    --button-outline: transparent;
    --control-surface: transparent;
    --panel-outline: transparent;     /* 面板不描边，靠留白分层 */
    --divider: transparent;           /* 分隔线退场 */
    --elevation-raised: none;         /* 只有真正浮起的元素才有阴影 */
}
```

配套三条：
- **分隔靠留白与底色，不靠线**：现在界面里大量 `border-[var(--border-color)]`，逐处评估哪些能删。
- **强调色克制**：一屏之内 accent 实底元素不超过一个（L1-2）。
- **状态色只在需要时出现**：`--status-*` 是语义色不是装饰色。

---

## 4. 取舍与风险（诚实清单）

| 风险 | 具体是什么 | 对策 |
|---|---|---|
| **下沉 ≠ 隐藏** | NN/g 明确指出：失败实现把"渐进披露"做成"藏起来"。用户找不到 = 被藏了 | G8：所有下沉项进 `⌘K`；并且"更多"菜单本身常驻可见 |
| **别拆散共用选项** | NN/g 酒店案例警告过：为干净而拆开需要对比的选项组，会逼用户反复开合 | G3：设定三项合并而非拆散；分组前先跑"共同使用"判断 |
| **实证证据有限** | Carroll & Rosson：渐进披露的严格实证证据不足。它是有力的**假设**，不是已验证的事实 | 按假设验证：给 L1-1 设一个可证伪的判据（见 §5） |
| **别用时间驱动** | 行业实践里最常见的翻车方式：按天数弹提示 | G7：行为触发 |
| **极简的代价** | iA Writer 的极简靠砍功能达成，NeuroBook 不能砍（设定库/AI/帧都是核心） | 不做全面极简，只做**分层**——能力都在，只是不再平铺 |
| **专注模式可能打扰** | 若默认开启，用户可能觉得正文"被弄花了" | 默认**关闭**，首次用到时给一次提示；提供快捷键 |

---

## 5. 验收判据（可证伪）

| 判据 | 怎么量 | 现状 |
|---|---|---|
| 写作型与配置型入口分层 | `primary` 里不含 `world` | 当前 primary 含 `world` |
| 披露层级 ≤ 2 | 数从常驻项到目标功能的层级数 | 当前部分功能需 3 层 |
| **"十七个侧栏"判据** | 进稿面后，一屏内可见的常驻控件数（活动栏 + 工具面板头 + 编辑器工具栏 + 状态栏项） | **待测** |
| 一个界面一个主操作 | 数 accent 实底按钮数，应 ≤ 1 | 待测 |
| 专注模式有引导作用 | A/B：开/关专注模式下，连续写作不中断时长、光标回看次数 | **未做用户测试** |
| 空态不是死路 | 新项目打开后，从零到写下第一句话的点击数 | 待测（体检报告建议 J1 首字 90 秒） |
| 下沉项可直达 | `⌘K` 能搜到每一个从活动栏移走的功能 | 未实现 |

> 全部判据都**未实测**。这份文档给的是可执行的假设与检查方法，不是结论。

---

## 6. 落地顺序建议

1. **先做 L1-1（稿面专注模式）+ L1-3（位置感）** —— 成本最低，你当天能看到界面"变干净、有引导"。
2. **再做 L3（视觉退场）** —— 一个主题包搞定，不改组件（依赖 `DESIGN.md` 里的 `sepia-paper` 主题包先落地）。
3. **最后做 L2（活动栏分组 + 空态重排）** —— 涉及导航结构，改动面最大，放在视觉层稳定之后，避免返工。

> **为什么 L2 放最后**：导航结构的改动会牵动 14 个 Dialog/Panel 的挂载条件与 i18n，且在视觉层未定时做，等于把同一批文件的改动做两遍。

---

## 附录：本轮外部参考的提取记录

| 来源 | 等级 | 回答的问题 | 观察到的事实 | 局限 | 转化成的规则 |
|---|---|---|---|---|---|
| NN/g *Progressive Disclosure* | E3 | 活动栏怎么分组 | ≤2 层；四条判断；酒店案例的共同使用警告 | 严格实证证据有限（Carroll & Rosson） | G2 / G3 |
| iA Writer 官方 + 2026 评测 | E1/E2 | 视觉引导怎么做 | Focus Mode（高亮当前段、其余变灰）；"最大的特色是没多少功能" | 纯文本编辑器，靠砍功能达成 | G1 |
| Figma *UI design principles* | E3 | 层级与方向感 | 层级靠字号/对比/间距；要给用户"在哪、还剩几步" | 通用规范，非写作场景专用 | G5 |
| Sudowrite / Novelcrafter 对比（官方 + 三方） | E1 | 配置项怎么减 | "You do not configure anything"；有主见 | SaaS 可省配置，本地优先省不掉 | G4 |
| Onboarding 实践整理（引用 NN/g 口径） | E2/E3 | 空态与首次体验 | 空态四要素；示例数据模式；行为触发而非时间滴灌 | 多为厂商内容，非独立研究 | G6 / G7 |
| 2026-09-17 项目体检报告 | E4（本项目真实证据） | 首屏重心 | 「空态即演示」建议；默认 tab；首屏重心错位 | 报告自述设计部分无独立复核 | G6 + L2 重排 |
| 星炉启动屏（`index.html`） | E0 | 进度表达 | 四步进度点 + 阶段状态 | 仅视觉参考，未见运行态 | G5 的表达参考 |

> **没有采纳的**：星炉的多窗口系统、内嵌字体、707KB 手写 CSS（理由见 `DESIGN.md` §7.1）。
