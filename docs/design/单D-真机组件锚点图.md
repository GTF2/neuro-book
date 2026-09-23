# 单D-真机组件锚点图

- 生成日期：2026-09-22
- 性质：单D 预研产物（闲时任务生成，待前线走查）
- 证据来源：三份真机勘察材料（锚点-聊天流三件、锚点-输入区二件、锚点-刻度应答二件）的编辑整合；各组件行号来自材料内全文或分段实读，决议对照 `docs/design/009-单D-UI总攻蓝图.md:72-107`（材料实读）。本文未新增勘察。所有路径相对 `packages/neuro-book/app/components/novel-ide/agent/`（另注明者除外）。

## 七组件总表

| # | 组件 | 文件 | 一句话现状 | 施工改动量级 |
|---|---|---|---|---|
| 1 | AgentChatSurface | `AgentChatSurface.vue`（4502 行） | AI 面板纵向宿主：头部→附件/LinkedAgent/SystemPrompt 面板→ChatFlow→WorkflowPendingPanel→Composer→三弹窗 | 小：本文件结构几乎不动，改 4397 挂载位 + 接线；栏位翻转落点在 index.vue |
| 2 | AgentChatFlow | `AgentChatFlow.vue` | 消息流：滚动消息列 + 右缘刻度条，轮块聚合/吸底/分页/空态三模式 | 零：主舞台化即本体现状，全部不动 |
| 3 | chat-work-blocks | `chat-work-blocks.ts` | 无 Vue 依赖的流聚合纯函数：轮切块、注入收拢、类别映射 | 零：与驾驶舱/堆叠卡正交；仅顺手修 253 行滞后注释 |
| 4 | AgentComposer | `AgentComposer.vue` | AI 面板底部输入容器：队列芯片→改动条→pending 替换面板→输入栏主体→运行状态行 | 中：堆叠卡容器段、pending 呈现关系、输入栏四规格、底部栏一体共六项 |
| 5 | AgentTextBubble | `AgentTextBubble.vue` | 单条消息渲染三分流（system 折叠卡/user-AI 气泡/横滑切分支手势） | 零~微：消息内容件不动；唯一评估点 AI 行长 max-w |
| 6 | AgentSessionScaleBar | `AgentSessionScaleBar.vue`（189 行） | 会话流右缘 24px 竖向刻度条，纯渲染+指针交互 | 零：随 AI 面板整体平移，本体无涉 |
| 7 | AgentWorkflowPendingPanel | `AgentWorkflowPendingPanel.vue`（327 行） | workflow PendingAsk 应答全链：SSE 订阅→轮询→草稿收集→整 Run 提交，就地内联滑出面板 | 中：入口让位驾驶舱、开合控制权移交、approve 换滑动卡，数据层全复用 |

---

## 一、AgentChatSurface.vue（AI 面板宿主）

### 现状

单栏纵向 flex 容器，无三栏概念——`<section class="relative flex h-full min-h-0 flex-col">`（`AgentChatSurface.vue:4275-4279`），`layout: "drawer" | "workbench"` prop（`:124`）只控制是否加 `border-x`（4277）。纵向堆叠：头部（4281-4316：会话标题/info 菜单/新建/会话列表入口）→ 附件面板（4318）→ LinkedAgent 面板（4334）→ SystemPrompt 面板（4345）→ **AgentChatFlow（4356-4395，约 40 个 props/emits 接线）** → **AgentWorkflowPendingPanel（4397，单标签仅传 session-id）** → **AgentComposer（4399-4466，约 45 个 props/emits，`:key="composerContextGeneration"` 4400）** → 三个弹窗（4469-4500）。数据接线：`composerAvailability`(286)、`queuedMessages`(307)、`renderNodes`(321)、`connectionStatusLabel`(332)、`runPhaseLabel`(342)、草稿会话 `composerDraftSession`(198-199, 1234)。

**三栏摆位真相（跨文件，宿主的宿主）**：栏序与宽度全在 `pages/index.vue`——agent 模式下 AI 面板 `order-2 min-w-[340px] flex-[1.2]`（`index.vue:2687`），稿面 Studio `order-3 shrink` + `agentStudioStyle` 固定宽（`index.vue:2567`、422-430：320px..`agentStudioMaxWidth`，关则 0px）；IDE 模式下 AI 面板退化为右侧抽屉 `order-3 border-l`（`index.vue:2687` 二分支）+ 左缘拖拽 handle（`index.vue:2695-2697`）。稿面在 agent 模式有独立拖拽 handle（`index.vue:2577-2580`）与 `useResizablePanel`（`index.vue:402-411`）。

### 单D 施工改什么

1. **布局翻转**：本文件自身结构几乎不动；真正落点在 `index.vue:2687`（AI 面板 order/宽度）与 `index.vue:2567`/`422-430`（稿面宽度）。当前已是「AI 中偏宽、稿右固定宽」，缺的是决议 78 行的**阶段化宽度状态机**（常态 ↔ 审稿态一键切换，稿面扩张接管/AI 收窄）——现状只有 `agentStudioPanelOpen` 开/关（`index.vue:384-390`），无「审这章」触发源与回常态按钮，需新增状态位接进 `agentStudioStyle`/AI 面板宽度分支。
2. **待办堆叠卡**：挂载点现成——4397 处 AgentWorkflowPendingPanel 恰在 ChatFlow 与 Composer 之间，即「输入框上方」。新增堆叠卡组件插此处；`AgentWorkflowPendingPanel` 的徽标行（`AgentWorkflowPendingPanel.vue:253-262`）按决议（蓝图 86 行「不再有独立徽标+弹窗」）并入驾驶舱行，本组件降为数据源或改造为堆叠卡。注释滞后确认：`AgentWorkflowPendingPanel.vue:252` 仍写「点击弹居中 Dialog」，实际 238-243 起已是 `pendingPanelOpen` + `onClickOutside` 就地内联面板（264 起渲染），以代码为准。
3. **驾驶舱数据接线**：「AI 正在干啥」可复用 `runPhaseLabel`(342)/`queuedMessages`(307) 的取数模式；驾驶舱本体住左栏（蓝图 97 行，住处未终决），不在本文件，但跨面板取 session 态需经本组件 expose 或提升 store（现状 `agentSurfaceRef` 模式见 `index.vue:370-372`）。

### 复用不动点

- **输入栏四规格**（蓝图 89 行）：实现体在 AgentComposer 内部；本文件 4399-4466 接线面不动——`composerContextGeneration` 重建键、draft 持久化（1234-1239）保持。
- **底部栏一体**（蓝图 107 行）：flex-col 流末端的 Composer 挂载位天然钉底（4399 无 shrink 包裹），不动。

---

## 二、AgentChatFlow.vue（消息流）

### 现状

双栏结构=滚动消息列 + 右缘会话刻度条（`AgentChatFlow.vue:458` 外层 `relative flex min-h-0 flex-1`，滚动容器 459，刻度条 666-674）。核心机制：`flowItems = groupChatNodesIntoBlocks(chatNodes)`（108）；轮展开态默认「运行中/失败展开、用户 toggle 固定」（111-121）；收起态可见节点过滤（139-150：非折叠工具保留、system 注入隐藏）；轮尾唯一动作组宿主（153-156）；刻度格聚合封顶 50（162, 182-214）与点格直接定位（348-355）；吸底/用户上滚释放/分页 prepend 锚定（257-430）；渲染三分支=user/system 节点（483-515）、注入收拢行（517-551）、轮块+轮中途注入行（553-631）；空状态三模式 unselected/main/compact（636-664）。

### 单D 施工改什么

1. **主舞台化**：本组件即常态主舞台主体，消息流结构不动。
2. **堆叠卡**：建议插宿主层（AgentChatSurface 4397 位）而非本组件内——滚动容器（459）内的卡会随流滚走，违反「输入框上方」钉位；若要钉在流顶部之上需出滚动容器，改动面更大，宿主层更小。
3. **空状态**（636-664）：维持；「稿面空白态显示 AI 正在写」落稿面组件，不在本文件。
4. **读档核对**：任务书提示本文件 110 行残留「≥2 条才收拢」旧说法——材料实读 110 行注释为轮展开态说明，**未发现该字样**；该滞后说法实际残留于 `chat-work-blocks.ts:253`（见第三节）。

### 复用不动点

全量复用：轮次块、刻度条、吸底、分页、编辑/分支接线（483-515 的事件透传）不动。

---

## 三、chat-work-blocks.ts（流聚合纯函数）

### 现状

无 Vue 依赖的投影模块。类型：工作块类别 6 种（7）、`ChatRoundItem`（22-47，含 `hasFailure`/`isRunning`/`workByKind`/`firstTarget`）、注入收拢项（50-54）、渲染单元联合 `ChatFlowItem`（57-60）。映射表：不折叠工具清单 10 个（66-77，workflow/交互/生命周期类）、工具→类别 36 个（80-120）。聚合算法 `groupChatNodesIntoBlocks`（256-302）：user 消息切段、开头连续 system 收拢（`flushSystemRun` 261-269）、中途注入归轮（287-295）。计数摘要常量 `MIN_DETAIL_COUNT=2`（123）、`WORK_DETAIL_LIMIT=3`（318）；图标/文案映射 `CHAT_WORK_BLOCK_META`（305-312）。

### 单D 施工改什么

与驾驶舱/堆叠卡正交（那两者是「待拍板/伏笔/Workflow 待应答」数据面，本模块只管消息流形态），**基本不动**。可复用：`ChatRoundItem.isRunning`（30）可作驾驶舱「AI 正在干啥」的轮级运行态来源；`firstTarget`（46）已是「最新产出目标」语义，可喂稿面空白态预览。唯一顺手项：修正 253 行滞后注释——「（件3g，≥2 条才收拢）」与实现不符，`flushSystemRun`（261-269，含 265 行新注释）对单条也收拢，且 289-291 行开头单条 system 同样走收拢行。

### 复用不动点

类型、映射表、聚合算法、计数常量全部原样。

---

## 四、AgentComposer.vue（输入容器）

### 现状

AI 面板底部输入容器（Composer 壳），自上而下聚合六段：

1. 队列消息芯片条：519-530（steer/queue 预览，flex-wrap 灰芯片）。
2. 工作区改动条 `AgentWorkspaceChanges`：532。
3. 等待用户输入面板 `AgentUserInputPrompt`：534-551——`hasPendingUserInput` 时**整体替换**输入栏（555 行输入栏 `v-show="!hasPendingUserInput"` 对应）。
4. 输入栏主体：554-719——可用性 banner（561-579）、图片缩略图条（582-591，独立 `border-b` 区）、图片能力警告（593-596）、图片元数据错误（598-604）、TipTap 输入框 `AgentComposerInput`（606-642，restoring 态原位覆盖 632-641）、工具条（644-718：图片按钮 647-656 / 缓存绿环 658-668 / 模型选择器 670-679 / 思考档 681-687 / 手动展开按钮 690-697 / 三态模式按钮 700-708 / 发送按钮 710-717）。
5. 运行状态行：721-746（连接状态、reconnect/refreshHistory、运行相位、模式徽标，`justify-end` 芯片排）。
6. 逻辑层：availability 八态映射 120-197；图片事务 `useComposerImageTransaction` 230-243；发送门禁 `messageSubmitBlocked` 291-297；`composerExpanded` 手动展开 ref 106。

### 单D 施工改什么

| 决议项 | 落点 | 改法概述 |
|---|---|---|
| 待办堆叠卡（蓝图 85/86 行：输入框上方、右划通过/左划拒绝、非模态） | 在 532 与 534 之间插入堆叠卡容器段；props 增待办列表、emits 增通过/拒绝 | 新增一个插槽位承载堆叠卡组件（新组件本体不在本文件）；本组件只出容器与数据通道 |
| 堆叠卡与现有 pending 替换式呈现的关系（蓝图 86 行「Workflow 待应答并入堆叠卡」） | 534-551（`AgentUserInputPrompt` 的 `v-if` 替换）与 555（输入栏 `v-show`） | 现 pending 是「替换输入栏」模态式；并入堆叠卡后需改为「输入框上方呈现、输入栏保留」。注意 `AgentUserInputPrompt` 有草稿表单（538-539 draft props），堆叠卡只有划动二值，表单能力去向（保留/简化）蓝图未定，施工前需定 |
| 输入栏规格①去手动放大按钮、随字数自动增高（蓝图 89 行） | 删 690-697 按钮、106 行 `composerExpanded`、616 行 `:expanded` 传参、366-367 的 title/icon computed | 自动增高本体在 `AgentComposerInput`（另一组件）；本组件删手动通道 |
| 输入栏规格②图片附件在输入框内悬浮（蓝图 89 行） | 删 582-591 独立缩略图条（`border-b` 区） | 缩略图移入输入框内文字上方；删图按钮（586-588）与 URL 解析（447-450）逻辑可随迁 |
| 输入栏规格③统计整合进绿环、旁边不重复（蓝图 89 行） | 721-746 运行状态行 | token 统计芯片已在 009C1R2 删除（721 行注释），现状合规；连接状态/运行相位/模式徽标三芯片是否并入工具条或绿环 hover，蓝图 107「一体成型」倾向并入，需一次归位 |
| 底部栏一体成型：同容器无缝、去明显分界线（蓝图 107 行） | 556-558（输入容器 border）、644（工具条 `border-t`）、517（外壳 `px-2 pb-1`） | 状态行（721-746）并入 556 输入容器尾部成为同容器；去掉 644 行 `border-t` 这类明显分界，改弱分隔或纯间距 |

### 复用不动点

- 布局翻转（换位/宽度）在宿主布局层，本组件 `shrink-0` 自适应填充（517），无固定宽度假设——不动。
- 输入栏规格④钉死面板底部：517 行 `shrink-0` + 相对定位已满足——不动。
- 按钮 hover 灰底（蓝图 107「hover 显灰色选中底块」）：650/691/701 行均已是 `hover:bg-[var(--bg-hover)]`——已达标不动。
- 图片事务、发送门禁、availability 八态、模式切换逻辑（230-310、120-197）——不动。

---

## 五、AgentTextBubble.vue（单条消息渲染）

### 现状

单条聊天消息渲染，三分流：

1. system 分支：329-365——折叠卡（reminder/error/prompt 三态样式 333-337），默认收起（235 行 `isSystemCollapsed`，仅 error 展开），错误卡带分支切换器（347-352）。
2. user/AI 分支：368-539——AI 身份锚定行（370-382，`suppressIdentity` 由轮块模式控制 47 行）、steer 轻标记（384-387）、思维链折叠（390-411）、正文（414-502：用户右侧气泡 `w-fit max-w-[36rem]`、AI 零边框文档流 `w-full`；编辑态 435-455；contentBlocks 按序渲染 458-469；用户长消息 120 字阈值折叠 161-171+渐隐 490-500）、功能按钮排（504-538，hover 显示、unknown 投递常显 174）。
3. 横滑切分支手势：293-324（`startSwipe`/`endSwipe`，阈值 `SWIPE_MIN_DELTA_X=48`、`SWIPE_MAX_DELTA_Y=24` 于 19-20 行，纵向滚动不拦截）。

### 单D 施工改什么

- **基本不动**。本组件是消息流内容件，布局翻转（栏位换位/宽度）在宿主层；稿面空白态「AI 正在写第 N 章/最新产出预览」的落点在稿面组件，数据机制可借用本组件已有的 `contentOmitted` 有界预览（479-482），但不在本文件改。
- 唯一评估点：AI 面板居中偏宽后 AI 消息 `w-full`（417 行）行宽变大，长 Markdown 行长可能超可读上限；可考虑给 AI 文档流加 `max-w` 行长限制。蓝图对此无明确规定，属施工时排版决策。

### 复用不动点

- **横滑手势实现（293-324 + 19-20 阈值）是待办堆叠卡「右划通过/左划拒绝」（蓝图 85 行）的现成参考/抽取来源**：pointer capture + 位移阈值 + 纵向不拦截的完整模式可直接复制到新堆叠卡组件；本组件自身保留原用途（切分支），不动。
- system 折叠卡、思维链折叠、编辑态、按钮排、用户长消息折叠（66-103、111-171、329-538）——与决议无交集，不动。

---

## 六、AgentSessionScaleBar.vue（会话刻度条）

### 现状

AI 会话流右缘 24px 竖向刻度条，纯渲染+指针交互件（189 行）。聚合归挂载侧——segments 由 `AgentChatFlow.vue:182-214`（scaleSegments computed，封顶 SCALE_SEGMENT_LIMIT、只聚合对话项）算好传入，本件只渲染收到的格（自述见 `AgentSessionScaleBar.vue:14`）。关键结构：props/emit 契约 `:13-23`（seek/expand 两个出口）；高亮算法「anchorIndex ≤ activeIndex 的最后一格」`:36-44`；体量三档线长（weight≥6/≥3/其余，w-full/w-2/3/w-1/2）`:47-62`；指针纵坐标换格+拖动 80ms 节流 seek `:64-113`；hover 跟手预览卡 `:119-131`（模板 166-172，`right-full` 朝左弹）；模板主体=右缘窄条+底部「开完整会话树」按钮 `:138-165`。

### 单D 施工改什么

**不动**。本件是 AI 面板内部的右缘贴附件（挂载点 `AgentChatFlow.vue:667-674`，`class="h-full"`、自身 `w-6 shrink-0`），布局翻转只做 AI 面板与稿面的栏位换位，本件随 AI 面板容器整体平移到中栏，组件本体无涉。hover 预览卡朝左弹（168 行 `right-full`）弹出方向在面板内侧，换位变宽后仍成立。驾驶舱四常驻项（写到第几章/AI 正在干啥/待拍板数/伏笔未还数）决议未纳刻度条，无需迁移。

### 复用不动点

全部：渲染、高亮、指针交互、预览卡、底部按钮。

---

## 七、AgentWorkflowPendingPanel.vue（workflow 待应答）

### 现状

当前 Session 后台 workflow run 的 PendingAsk 应答全链件（327 行）。数据链=Job SSE 订阅 `AgentWorkflowPendingPanel.vue:20`（useAgentJobsFeed）→ waitingJobs 过滤（kind=workflow + ownerSessionId 匹配 + status=waiting）`:45-52` → 每 Run 轮询 `/api/agent/workflow/runs/:id`（waiting 态 2s/其它 500ms/404 降级文案）`:89-131` → 草稿收集（select 单选/多选、text、approve 布尔）`:166-201` → 整 Run 一次性 POST resume `:209-236`（submittedRuns+ask 签名防重复应答 `:102-111`）。容器：就地内联滑出面板（009C1R3 件11，onClickOutside 收起）`:238-243`；模板=徽标按钮 `:254-262`（「N 个流程等应答」）→ 展开 `max-h-[50vh]` 内联面板 `:264-325`，内含每 Run 一组 ask 卡（select 药丸 288-295 / text 输入 296-300 / approve 同意·否决 301-307）+ 每 Run 独立「应答并继续」提交钮 `:310-318`。挂载点：`AgentChatSurface.vue:4397`，位于 AgentChatFlow（4360-4395）与 AgentComposer（4399 起）之间——**恰为「AI 面板输入框上方」**。

**注释滞后（实读确认）**：`AgentWorkflowPendingPanel.vue:252` 注释仍写「点击弹居中 Dialog」，实际 238-243 已改就地内联面板、264 起为内联 div，无 Dialog。引用以代码为准。

### 单D 施工改什么

1. **发现入口让位驾驶舱**（决议：待办发现入口唯一=驾驶舱行）：本件自持徽标 `:254-262` 是独立发现入口，与驾驶舱「Workflow 待应答」行重复，应移除或降级为纯状态显示；`waitingCount`（54 行）已现成，上提供驾驶舱行渲染。
2. **开合控制权移交**：`pendingPanelOpen`（239 行）现为件内自翻转+onClickOutside 收起（241-243），决议要求点驾驶舱行弹出。改为由外部（AgentChatSurface 或驾驶舱事件）经 prop/v-model 控制开合；onClickOutside 整板收起可保留为顺手收尾，但不再是唯一入口。
3. **approve 类 ask 换滑动卡**：决议「右划=通过/左划=拒绝」。现 approve 是双按钮 `:301-307`，改滑动卡后右划映射 `setDraft(runId, key, true)`、左划映射 false（167-172 行现成），视觉沿用 285 行独立圆角卡即堆叠形态。
4. **select/text 保留表单**：多选药丸（288-295）与文本输入（296-300）无法用单向滑动承载，原控件不动——堆叠卡内两类混排。
5. **施工注意（超出本件边界）**：滑动「单卡即答」与现 API 合同冲突——submitRun（209-236）是整 Run 一次 POST 全部 answers，310-318 也是每 Run 一个总提交钮。若要逐卡即时提交需后端支持部分应答；在合同不变前提下，滑动只是选值交互，仍走整 Run 提交钮，本件内可闭环。

### 复用不动点

全部数据层：feed 订阅（20）、waitingJobs 过滤（45-52）、轮询与清理机（57-153）、草稿与校验（166-206）、submitRun 与防重（209-236）。延续 238 行自述的件11 原则「应答逻辑零改动只动容器」，单D 仍只动入口与容器。

---

## 遗留与待复核

以下为材料中标注的待人工复核/未勘察项，汇总如下：

1. **AgentComposer.vue / AgentWorkBlock.vue 内部未勘察**（聊天流材料明确列为未勘察项；AgentComposer 后由输入区材料补勘察，AgentWorkBlock 仍未见）。
2. **「待拍板/伏笔」后端数据源未读**：`agent-pending-resolution.ts`/`task-list.ts` 只见目录未读，堆叠卡与驾驶舱的数据供给侧待勘察。
3. **`AgentComposerInput` 内部未读**：输入栏规格①「随字数自动增高」的本体在另一组件，改动量未评估。
4. **堆叠卡与 `AgentUserInputPrompt` 草稿表单的关系未定**（四.施工表第 2 行）：表单能力保留/简化蓝图未裁定，施工前需定。
5. **滑动「单卡即答」与整 Run POST 合同冲突**（七.施工第 5 点）：逐卡即时提交需后端支持部分应答；合同不变时滑动仅是选值交互，取舍待前线裁定。
6. **AI 消息行长 `max-w` 无蓝图规定**（五.评估点）：属施工时排版决策。
7. **驾驶舱住处未终决**（蓝图 97 行）：左栏挂点方案见《单D-施工技术方案书》第二章，二选一待拍板。
8. **阶段化宽度状态机无现成触发源**（一.施工第 1 点）：「审这章」入口与回常态按钮需新增状态位，设计见《单D-施工技术方案书》第三章。
9. **注释滞后三处**（引用以代码为准，可随手修）：`chat-work-blocks.ts:253`（「≥2 条才收拢」与实现不符）、`AgentWorkflowPendingPanel.vue:252`（仍写「弹居中 Dialog」）、`AgentTextBubble.vue:413`（写「固定 65% 宽」，417 行实现实为 `w-fit max-w-[36rem]`）；另 `AgentChatFlow.vue:110` 任务书提示的旧说法本次实读未发现。
