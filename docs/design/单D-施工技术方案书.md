# 单D-施工技术方案书

- 生成日期：2026-09-22
- 性质：单D 预研产物（闲时任务生成，待前线走查）
- 证据来源：三份勘察材料（布局勘察-面板换位、布局勘察-驾驶舱挂点、状态机设计）的编辑整合；全部 `文件:行号` 证据来自材料内的实读，本文未新增勘察。材料中路径凡以 `app/` 开头者均相对 `packages/neuro-book/`。

---

## 一、AI 面板与稿面换位方案

### 1.1 现状布局结构

主界面三栏**不在独立 Workbench 组件里**，全部由 `packages/neuro-book/app/pages/index.vue` 的 template 直接承载，用 **flex + order（非 grid）** 实现，且已有两套排布随 `layoutMode`（`ide`/`agent`）切换。

结构链（IDE 常态）：

```text
.novel-ide-page (flex h-screen)                         index.vue:2465-2469
├─ NovelIdeActivityBar（功能导航窄条，约56px）            index.vue:2499-2516
└─ div.relative.flex.min-w-0.flex-1.flex-col            index.vue:2518
   └─ div.flex.min-h-0.flex-1 ← 三栏 flex 行容器         index.vue:2523
      ├─ AgentModeSessionSidebar（order:0，Agent模式左侧会话栏） index.vue:2524-2539
      ├─ div.mode-transition-ide-tools（order:0，驾驶舱）  index.vue:2541-2561
      │   宽 = leftPanelWidth(340)px 或 0                index.vue:450
      │   └─ NovelIdeToolPanel                           index.vue:2549-2560
      ├─ main.mode-transition-studio（稿面，flex-1 order-2 居中） index.vue:2564-2679
      │   ├─ MarkdownStudioWorkbench（稿面主体）          index.vue:2592-2630
      │   └─ NovelPromptBar（底部 Inline AI 输入栏，仅 IDE 模式） index.vue:2647-2678
      └─ section.mode-transition-agent（AI 面板，order-3 右侧固定宽） index.vue:2682-2713
          宽 = agentPanelWidth(400)px                    index.vue:431-436
          └─ AgentChatSurface（:layout="drawer"）         index.vue:2699-2712
```

两种模式的列序与宽度（order 由 class 切换）：

| 栏 | IDE 常态 | Agent 模式 |
|---|---|---|
| 稿面 main | `flex-1 order-2`（居中主舞台）index.vue:2567 | `shrink order-3`（右侧，宽 agentStudioPanelWidth=460，可收 0）index.vue:2567、422-430 |
| AI 面板 section | `order-3 border-l`（右侧抽屉 400px）index.vue:2687 | `order-2 min-w-[340px] flex-[1.2] border-x`（**居中偏宽主舞台**）index.vue:2687 |
| 驾驶舱 | 开，340px（index.vue:449-450） | 强制收 0（`ideToolPanelOpen = !isAgentMode && …` index.vue:449） |

**关键结论**：决议目标三栏（左驾驶舱 → AI 面板居中偏宽 → 稿面在右）在现有 Agent 模式下已完整存在——AgentChatSurface 居中 `flex-[1.2]`、Studio 右挂 460px。换位实质 = 把 IDE 常态改成 Agent 模式的排布，并让驾驶舱保持可见。

### 1.2 宽度状态源与拖拽体系

- 全部宽度持久化于 localStorage `novel.ide.local`：`agentPanelWidth=400`、`agentSessionPanelOpen=true`、`agentSessionPanelWidth=280`、`agentStudioPanelOpen=true`、`agentStudioPanelWidth=460`、`agentStudioFileTreeWidth=200`、`leftPanelWidth=340`（`packages/neuro-book/app/stores/novel-ide.ts:222-229`）；持久化 pick 列表见 `stores/novel-ide.ts:2009-2019`。
- 拖拽体系：`useResizablePanel` 三条接线全在 index.vue:391-421（AI 抽屉 min320 / Agent 稿面 min320 / 稿面文件树 min160），`edge:"left"`，把手均挂 `-left-1`（index.vue:2577、2695）。
- 宽度上限：`agentPanelMaxWidth` = 视口 45%（index.vue:375）；`agentStudioMaxWidth` = 视口 − `agentModeReservedWidth`（=56+会话栏+340，index.vue:373-382）。
- 窄视口（<800px）AI 抽屉转浮层 overlay（index.vue:376、2688）。

### 1.3 位置耦合点（换位时的边框/把手病灶）

- AI 面板边框：右挂 `border-l` / 居中 `border-x`（index.vue:2687）；`AgentChatSurface` 内部 `layout==="workbench"` 再叠一层 `border-x`（`packages/neuro-book/app/components/novel-ide/agent/AgentChatSurface.vue:4277`；该 prop 全文件仅此一处样式差异，props 定义在 122-132 行）。
- 稿面边框：Agent 模式 `border-l`（index.vue:2568）。
- 稿面空态 = `MarkdownStudioWelcome`，双挂载点 `packages/neuro-book/app/components/markdown-studio/MarkdownStudioWorkbench.vue:109、185`（无 activePath 或不可编辑时显示）——决议的「AI 正在写第 N 章/最新产出预览」落点在此组件或其父级。

### 1.4 施工方案

**1. 栏序对调（核心，仅动 index.vue 两处 class + 一处宽度 style）**

- 稿面 `main`（index.vue:2567）：IDE 分支 `'flex-1 order-2'` → `'shrink order-3'`；宽度改用现有 `agentStudioStyle`（index.vue:422-430）同源体系（常态即 `agentStudioPanelWidth`，460px）。建议目标值调到 `480~520`（稿面为「多功能舞台」需容纳对照视图），改 store 默认值 `stores/novel-ide.ts:227` 即可。
- AI 面板 `section`（index.vue:2687）：IDE 分支 `'order-3 border-l'`（固定宽）→ `'order-2 min-w-[360px] flex-[1.3] border-x'`（复用 Agent 分支写法，flex 值从 1.2 提到 1.3 体现「居中偏宽」）；`agentSlotStyle`（index.vue:431-436）IDE 分支改返回 `{}`（不再设固定宽）。
- 驾驶舱保持现状不动（order:0 左挂 340px，index.vue:2541-2561）。

**2. 可原样复用的部分（零改动）**

`NovelIdeToolPanel`、`AgentChatSurface`（含 drawer/workbench 双形态）、`MarkdownStudioWorkbench`、`AgentModeSessionSidebar`、`NovelIdeActivityBar` 组件本体全部复用；稿面左缘拖拽把手 `agentStudioResizeHandleRef` + useResizablePanel（index.vue:402-411、2577）`edge:"left"` 在稿面仍居最右的前提下不用改；AI 面板常态可直接传 `:layout="'workbench'"`（index.vue:2703，两形态仅差 border-x）。

**3. 需要动的接线**

- IDE 模式 AI 抽屉拖拽（index.vue:391-401、2694-2698 `agentResizeHandleRef`）：AI 面板变主舞台后此把手失去意义，常态删除；若要保留分界拖拽，改为拖 `agentStudioPanelWidth`。
- `agentPanelOverlay` 窄视口浮层（index.vue:376、2688）：AI 面板为主舞台后 <800px 逻辑需重设计（主舞台不能浮层化），至少要改为稿面收窄。
- `agentModeReservedWidth`（index.vue:373）中 `+340` 常数与新的 min-w 对齐。
- 空态：`MarkdownStudioWelcome` 增加「AI 正在写第 N 章/最新产出预览」区块，运行状态可参考 index.vue:368-372 已有的 `agentModeRunning` 等 computed 取法。
- 审稿态（稿面扩张/AI 收窄）：新增一个类似 `layoutMode` 的状态位驱动两栏 flex 值切换（如稿面 `flex-[1.6]`、AI `flex-[0.7]`），沿用现有 `transition-[width,flex…] duration-300` 过渡（index.vue:2565、2685 已声明 flex 过渡属性）。

**4. 回归风险**

- IDE↔Agent 模式切换动画（`MODE_TRANSITION_SELECTORS` index.vue:99-109、view-transition index.vue:2798-2832）基于 DOM 位移；换位后常态与 Agent 模式排布趋同，位移幅度变小，需目检不破。
- `leftPanelWidth`/`agentStudioPanelWidth` 等持久化旧值（stores/novel-ide.ts:2009-2019）在新布局下直接生效，460 旧默认值偏窄时首屏观感需验收。

---

## 二、驾驶舱新栏挂点

### 2.1 左栏现状结构：图标栏 + 面板双栏

| 层 | 组件与行为 | 证据 |
|---|---|---|
| 图标栏（48px 固定） | `NovelIdeActivityBar`，`aside w-12 shrink-0`，纵向分 primary/secondary/agentPanel/footer 四组按钮 | `packages/neuro-book/app/components/novel-ide/NovelIdeActivityBar.vue:251-253`（w-12）、`:337-354`（agentPanel 按钮）、`:357-378`（footer） |
| 图标项来源 | `createWorkbenchActivityItems` 返回 primary=[home?,files,characters,plot,world]、secondary=[trace,history]、agentPanel、footer，类型枚举 `WorkbenchActivityItemId` | `packages/neuro-book/app/utils/workbench-chrome.ts:12-23`（枚举）、`:64-86`（items 构造） |
| 面板（280–560px 可拖宽） | `NovelIdeToolPanel`，`MIN_PANEL_WIDTH=280 / MAX_PANEL_WIDTH=560`，头部两行（项目切换器+tab 标题/上传下载按钮），内容区按 `activeTab` 切 WorkspaceFilePanel / WorkspaceCharacterPanel / NovelPlotPanel | `packages/neuro-book/app/components/novel-ide/NovelIdeToolPanel.vue:24-25`（宽限）、`:363-432`（头部）、`:434-440`（内容切换） |
| tab 枚举 | `NOVEL_IDE_TABS = ["files", "characters", "plot"]`，仅三个 | `packages/neuro-book/app/components/novel-ide/mock-data.ts:1` |
| 挂载与开关 | index.vue 里 `div.mode-transition-ide-tools` 包住 ToolPanel；宽度用 store 的 `leftPanelWidth`（默认 340，`app/stores/novel-ide.ts:229`）；展开条件 `ideToolPanelOpen = !isAgentMode && displayActiveLeftTab !== null`，收起时 `width:0` | `packages/neuro-book/app/pages/index.vue:2541-2561`（挂载）、`:449-450`（开关）、`:437-448`（displayActiveLeftTab 归一） |

### 2.2 驾驶舱挂进左栏的插入点

1. **B 型一栏两段（首选）**：`NovelIdeToolPanel.vue:434` 的内容区 `<div class="contain-layout-paint min-h-0 flex-1 overflow-hidden">`——在它上方插驾驶舱常驻段、下方保留现有 tab 切换内容；面板宽度（280–560）天然容纳四行仪表盘。若做成新 tab，则在 `:434-440` 加一支 `cockpit` 分支，并同步改 4 处枚举：`mock-data.ts:1`、`workbench-chrome.ts:12-23` 与 `:73-77`（primary 数组，插在 plot/world 之后）、`NovelIdeActivityBar.vue:66-77`（iconClasses）+ `:79-90`（labels）+ `:92-122`（active/invoke 分支）、`NovelIdeToolPanel.vue:48-52`（titleMap）。
2. **常驻性冲突（必须处理）**：现有面板整体随 `activeLeftTab=null` 收成 0 宽（index.vue:449-450）——「驾驶舱常驻可见」要求改 `ideToolPanelOpen` 判定，或让 displayActiveLeftTab 在 null 时仍保留驾驶舱段；不动这行，驾驶舱会随用户关 tab 一起消失。
3. **备选（并列栏）**：`index.vue:2541-2561` 容器内在 `NovelIdeToolPanel` 之前并列插独立驾驶舱组件——但 tab 收起时会留空栏，需连带改 `:449-450`，改动面比方案 1 大。
4. **左栏宽度预算**：图标栏 48 + 面板默认 340（可拖 280–560），驾驶舱段只需在现有面板内部纵向分配，不新增横向栏。

---

## 三、工作区态状态机（常态/审稿态/工作区态三态管理方案）

### 3.1 现状勘察：已有布局态管理

**唯一的布局态位：`layoutMode`（二态）**

- 类型 `"ide" | "agent"`：`packages/neuro-book/app/stores/novel-ide.ts:97`，定义于 `:222`，导出于 `:1911`。**未持久化**（persist pick 列表 `stores/novel-ide.ts:2001-2029` 中无它）。
- 消费集中在 `packages/neuro-book/app/pages/index.vue`：`:366` `isAgentMode`；`:1516-1528` `toggleAgentLayoutMode`（View Transition + FLIP 降级转场 `:1402-1511`）；模板三栏 `:2524-2698`。
- 现有互斥规则（三态设计可直接继承）：agent 态点左栏入口强制回 ide（index.vue:1633-1643 `handleSidebarToggle`）；agent 态开 Plot 工作台先回 ide（`:1804-1819`）；切换/关闭 Project 时统一清空全部弹窗与工作台（`:1833-1845` `releaseProjectSurface`）。
- 页面级散装开关键（index.vue:74-84）：`settingsDialogOpen` / `traceViewerOpen` / `historyInboxOpen` / `agentPanelOpen` / `worldEngineWorkbenchOpen` / `profileWorkbenchOpen`——三态化后大部分应收编。

**AI 面板/编辑器 compact 模式**：`MarkdownStudioWorkbench` 有 `compact` prop（`packages/neuro-book/app/components/markdown-studio/MarkdownStudioWorkbench.vue:31`，影响 min-width `:88`），由 index.vue:2601 `:compact="isAgentMode"` 驱动；内部继续下传 `:112`、`:184`。

**重内容=全屏 Dialog（现状）**：Plot `packages/neuro-book/app/components/novel-ide/plot/workbench/PlotWorkbenchDialog.vue:300-302`（`size="full"`）；世界引擎 `WorldEngineWorkbenchDialog` 挂载于 index.vue:2521；设置 `packages/neuro-book/app/components/novel-ide/NovelIdeSettingsDialog.vue:770-777`（`Dialog size="full" overlay-type="opaque"`）。设置内部已是「配置目标栏+左右分栏」结构（`:782` 起），VS Code 化可平移。

**轻内容=Dialog（现状）**：收件箱 `packages/neuro-book/app/components/novel-ide/history/WorkspaceHistoryInboxDialog.vue`、trace 查看器 `packages/neuro-book/app/components/novel-ide/agent/trace-viewer/AgentTraceViewerDialog.vue`。左栏 tab 仅 `"files" | "characters" | "plot"`（`packages/neuro-book/app/components/novel-ide/mock-data.ts:1,3`）。待拍板=Plot 工作台 decisions 分区（`stores/novel-ide.ts:232` `plotWorkbenchTab: "thread"|"promises"|"decisions"`）。

**宽度体系**：`useResizablePanel`（`packages/neuro-book/app/composables/useResizablePanel.ts:34-40`）统一拖拽；左栏默认 340（`stores/novel-ide.ts:229`，渲染 index.vue:450）、AI 面板默认 400 min 320（`stores/novel-ide.ts:223`、index.vue:393）、agent 审稿流 min 340 flex-1.2（index.vue:2687）。持久化分档：sessionStorage（`novel.ide.session`）+ localStorage（`novel.ide.local`，含各面板宽度，`stores/novel-ide.ts:1997-2031`）。URL 仅 `?project=` `?openPath=`（index.vue:347、2171）。

**审稿态：无现有实现**。全仓（app+shared）搜 `reviewMode|审稿|review-state` 无布局态相关命中（仅测试文件名误匹配）；B5 的审稿态是全新概念，无既有代码可复用，只能复用 agent 态的布局机制。

### 3.2 三态定义与三栏表现

| 态 | 定义 | 左栏(轻内容) | 中间 | 右侧 |
|---|---|---|---|---|
| **常态 normal** | 写作主界面（继承现 ide 态） | 340px 可拖，tab 扩展为 files/characters/plot/history(对话)/inbox(收件箱)/pending(待拍板) | flex-1 编辑器，`compact=false` | AI 面板 400px 默认可开合（overlay <800px，沿 index.vue:376） |
| **审稿态 review** | 审稿/批注主界面（复用 agent 态机制） | 同上 340px；轻内容仍可用 | 正文区 `shrink order-3`（沿 index.vue:2567）+`compact=true`（沿 `:2601`） | 审稿流 `flex-1.2 min-340`（沿 `:2687` AgentChatSurface agent 样式） |
| **工作区态 workspace** | 重内容 VS Code 页 | 左分区导航 240px 固定（设置/大纲/角色/世界书/世界引擎/世界引擎状态） | 内容区 flex-1，即时生效非模态 | AI 面板强制 width:0 |

维度分离：**态（uiMode 单值互斥）× 轻内容面板开合（activeLeftTab 可 null，沿 index.vue:1787-1789 折叠语义）**两个正交维度；弹窗只剩删除类确认（现成范例：写冲突 `workspaceConflictDialogOpen` `stores/novel-ide.ts:213`、关脏标签确认 `:1278-1288`）。

### 3.3 转移表与状态图（文字版）

```text
[常态 N] ──用户点审稿入口 / 审稿任务到达且接受──────────> [审稿态 R]
[常态 N] ──用户点重内容入口(大纲/角色/世界书/引擎/设置)──> [工作区态 W]，returnMode=N
[审稿态 R] ──用户点重内容入口──────────────────────────> [工作区态 W]，returnMode=R（审稿会话挂起不销毁）
[审稿态 R] ──用户点「回到写作」/ 关闭审稿───────────────> [常态 N]（审稿结果落盘或暂存）
[工作区态 W] ──返回按钮 / Esc / 点左栏轻内容 tab────────> returnMode（N 或 R）
[工作区态 W] ──点另一重内容分区（设置↔大纲…）──────────> [工作区态 W]（仅换分区，不触发转场动画）
[任意态] ──切换/关闭 Project（releaseProjectSurface）──> [常态 N]，全维度清零（沿 index.vue:1833-1845）
[任意态] ──崩溃/刷新恢复──────────────────────────────> [常态 N]（uiMode 不持久化，同 layoutMode 现状）
```

ASCII 总图：

```text
                 ┌─────────重内容入口(设置/大纲/角色/世界书/引擎)─────────┐
                 │                                                       ▼
  [常态 N] ⇄(回到写作/关闭审稿) [审稿态 R] ──重内容入口──> [工作区态 W]
     ▲                                                       │
     └──────────────返回/Esc/点轻内容tab（returnMode）──────────┘
  （N 与 R 内：轻内容面板为左栏 340px 独立开合；W 内：AI 面板强制收起）
```

### 3.4 互斥与回退规则

1. **uiMode 单值**，任何时刻只处一态；禁止「审稿态里再叠工作区弹窗」——重内容一律转 W。
2. **审稿态点重内容**：进 W，`returnMode="review"` 记忆；W 返回时恢复审稿会话滚动位置与批注草稿（挂起不销毁）。
3. **工作区态点轻内容**（历史/收件箱/待拍板）：视为退出 W，回 returnMode 并在左栏展开对应 tab（复用 `handleSidebarToggle` 语义，index.vue:1633-1643）。
4. **Esc 分层**：W 内 Esc=返回 returnMode；编辑器内 Esc 不冒泡到态切换（避免写作误退）。
5. **Program 事件**：Project 冷切换清全部（已有 `releaseProjectSurface`）；审稿完成=停留 R 并给 CTA；窗口 <800px 时 AI 面板 overlay 化规则不变（index.vue:376）。

### 3.5 落点建议

- **状态存 pinia**：把 `NovelIdeLayoutMode` 从二值扩为 `"normal" | "review" | "workspace"`（`stores/novel-ide.ts:97`），新增 `workspaceReturnMode: "normal" | "review"` 与 `workspaceSection: "settings" | "plot" | "characters" | "lorebook" | "world-engine"`。理由：全部面板宽度/开合已在此 store 且走 persist 分档（`stores/novel-ide.ts:1997-2031`），新维度直接复用管道；**uiMode 不入 persist pick**（刷新回常态，与 layoutMode 现状一致）。
- **URL 不承载三态**：现有 query 只有 project/openPath（index.vue:347、2171）；态是会话瞬态，入 URL 会污染多窗口与深链；未来需要「深链到设置页」再加 `?view=`。
- **调度者=store 内单一 action**（如 `setUiMode(next, opts)`）收拢转场：现在 index.vue 有 7 处直接 `layoutMode.value = "ide"`（`:1519` `:1536` `:1601` `:1614` `:1636` `:1811` 等），迁移时应全部改调 action。转场动画统一经 `runLayoutModeTransition`（index.vue:1484）扩展第三方向（normal↔review 沿用现有 to-agent/to-ide FLIP；↔workspace 用整页纸面滑动，`createIdePaperSlideOverlay` `:1407` 可复用）。
- **组件迁移路径**：`PlotWorkbenchDialog`（full Dialog `PlotWorkbenchDialog.vue:300`）、`WorldEngineWorkbenchDialog`（index.vue:2521）、`NovelIdeSettingsDialog`（`NovelIdeSettingsDialog.vue:771-777`）的内部「Sidebar+内容」结构平移进 W 态分区；`WorkspaceHistoryInboxDialog` / `AgentTraceViewerDialog` / 待拍板队列改为左栏 tab（扩 `NOVEL_IDE_TABS`，`mock-data.ts:1`）。页面级散装 ref（index.vue:74-84）相应删除，入口统一挂 ActivityBar（`NovelIdeActivityBar.vue:67-76,111-119` 已有全部图标位）。

---

## 四、窄屏降级链

### 4.1 响应式现状：无 CSS 断点，仅 JS 阈值

**主三栏布局没有任何 CSS 断点或容器查询**（全库 grep `@media|useBreakpoints|matchMedia`，命中的 @media 仅 5 处且全是局部组件）：

- `DesktopTitleBar.vue:729`（960px 藏品牌字）、`:743`（720px 藏搜索框）
- `SharedMergeEditor.vue:236`（1100px 合并编辑器转单列）
- `MarkdownStudioWorkbench.vue:227`（1180px 评论区收 spacer）
- `index.vue:2778` + `Tooltip.vue:254`（prefers-reduced-motion）
- `ProjectPickerScreen.vue:948`（hover:none）
- `@container` 零命中

唯一的整体级宽度响应是 JS（均在 index.vue）：

- `:374` `useWindowSize()` → `:375` `agentPanelMaxWidth = max(360, viewport*0.45)`；**`:376` `agentPanelOverlay = viewportWidth < 800`**——IDE 模式右侧 AI 抽屉在 <800px 时转 `absolute right-0` 浮层不再占位（class 分支 index.vue:2688，条件 `agentPanelOverlay && !isAgentMode`）。
- `:377-382` `agentStudioMaxWidth = max(320, innerWidth - agentModeReservedWidth)`，其中 `:373` reserved = 56 + sessionSidebar宽 + 340。
- `leftPanelWidth` 无任何 viewport 钳制：`useResizablePanel` 只在渲染/拖拽时 clamp（`packages/neuro-book/app/composables/useResizablePanel.ts:70-72`），窄屏下 ToolPanel 340px 照常占位。
- ActivityBar 的 ResizeObserver 自适应是**纵向**（按高度把 secondary 图标折进 More 菜单，`NovelIdeActivityBar.vue:218-224` + `workbench-chrome.ts:97-125`），与窗口宽度无关。

### 4.2 三栏窄屏现状行为（代码推断，未真机断言）

**IDE 模式**（行容器 index.vue:2523）：ActivityBar(48) + ToolPanel(默认340) + Studio(`flex-1 min-w-0`，index.vue:2565-2567 order-2) + AI 抽屉(order-3，默认400)。Studio 是唯一弹性项：窄屏时被两侧固定宽无限压缩（min-w-0）；<800px 时 AI 抽屉转 overlay 退出占位，ToolPanel 仍占 340。

**Agent 模式**：目标栏位「AI 面板居中偏宽 + 稿面在右」现已存在——AI 面板 `order-2 min-w-[340px] flex-[1.2]`（index.vue:2687），稿面 Studio `shrink order-3` 拖宽（index.vue:2567）。窄屏风险：overlay 降级只挂了 `!isAgentMode` 条件（index.vue:2688），Agent 模式无降级；固定最小占位 = ActivityBar 48 + SessionSidebar 220（`packages/neuro-book/app/components/novel-ide/AgentModeSessionSidebar.vue:6`）+ AI 面板 340 + Studio 下限 320（index.vue:381）≈ 930px，更窄即互相挤压，只能靠手动收 Studio（`agentStudioStyle` 支持 width:0，index.vue:422-430）。

### 4.3 降级链建议（外推设计，非现行行为）

1. **中屏（约 1024–1280）**：把 `agentPanelOverlay` 阈值从 800 上调或按模式分档，AI 面板先转 overlay。
2. **<800**：现有 IDE 抽屉 overlay 已覆盖；补 Agent 模式同等待遇（去掉 index.vue:2688 的 `!isAgentMode` 限制需另评交互——见 1.4 第 3 条，换位后该逻辑本身要重设计）。
3. **更窄**：自动收 ToolPanel（机制已有——`activeLeftTab=null` 即 0 宽，index.vue:449-450），驾驶舱随之进 ActivityBar 角标/More 菜单（overflow 机制现成，`workbench-chrome.ts:97-125`）。

---

## 遗留与待复核

以下均为材料中标注的待人工复核项，汇总如下：

1. **视觉验证整体缺失（面板换位章）**：全部结论为代码静态勘察，未启动 dev server 做视觉验证；flex 值（1.3）与稿面宽 480~520 为建议值，需真机调参。
2. **浏览器级真机断言缺失（驾驶舱章/窄屏章）**：勘察时无浏览器工具，「三栏窄屏现状行为」均为代码推断；dev server 存活探测已执行（`curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/` → `200`），但不构成视觉断言。
3. **降级链为外推设计**：4.3 节非现行行为；Agent 模式 overlay 化（去掉 index.vue:2688 的 `!isAgentMode`）需另评交互；换位后 AI 面板成为主舞台，<800px 浮层逻辑需整体重设计（主舞台不能浮层化）。
4. **持久化旧值验收**：`leftPanelWidth`/`agentStudioPanelWidth` 等（stores/novel-ide.ts:2009-2019）在新布局下直接生效，首屏观感需验收。
5. **模式切换动画目检**：换位后 IDE 常态与 Agent 模式排布趋同，`MODE_TRANSITION_SELECTORS`（index.vue:99-109）与 view-transition（index.vue:2798-2832）位移幅度变小，需目检不破。
6. **驾驶舱常驻性方案待拍板**：改 `ideToolPanelOpen` 判定还是保留 displayActiveLeftTab 驾驶舱段（index.vue:449-450），两案未定；若做新 tab 需同步改 4 处枚举（mock-data.ts:1、workbench-chrome.ts:12-23 与 73-77、NovelIdeActivityBar.vue:66-122、NovelIdeToolPanel.vue:48-52）。
7. **空态新区块落点待定**：「AI 正在写第 N 章/最新产出预览」放 `MarkdownStudioWelcome`（MarkdownStudioWorkbench.vue:109、185）还是其父级，未定。
8. **状态机迁移量**：index.vue 有 7 处直接 `layoutMode.value = "ide"`（:1519 :1536 :1601 :1614 :1636 :1811 等）需改调统一 action；散装开关（index.vue:74-84）收编范围待逐个确认。
