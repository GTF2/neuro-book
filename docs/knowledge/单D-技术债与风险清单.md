# 单D-技术债与风险清单

- 生成日期：2026-09-22
- 性质：单D 预研产物（闲时任务生成，待前线走查）
- 证据来源：三份勘察材料（批次一遗留核实、施工前置坑清单、布局翻转施工风险评估）的编辑整合；结论均来自材料内真实执行的 grep/ls/git log/git show 及文件读取（只读），本文未新增勘察。凡需运行态 DB / 用户截图 / 真机操作的事项均如实标注未验证。

---

## 一、批次 1 遗留（五项）

### 1. PDF 导入降级 —— 属实，前后端证据链完整

- 前端登记点：`packages/neuro-book/app/components/novel-ide/agent/AgentComposer.vue:646` 注释「图片按钮（009C1R2 件7a）…『+』通用导入已删（PDF 归后续小单）」；`AgentComposer.vue:647` input `accept="image/png,image/jpeg,image/gif,image/webp"`，仅四类图片。
- 后端校验位：`packages/neuro-book/server/api/agent/sessions/[sessionId]/attachments.post.ts:16`（注释「严格流式接收一个名为 file 的 multipart 图片」）、`:55-60`（413 错误码 AGENT_IMAGE_LIMIT_EXCEEDED）。图片域校验核心在 `packages/neuro-book/server/agent/attachments/agent-attachment-codec.ts:24-31`——`saveImage` 用 `imageMimeType(input.bytes)` 探测，非图片或 MIME 与内容不一致即抛 `AttachmentError("invalid_input")`（`:29-31`），无任何 PDF 分支。
- 预算口径也是纯图片：`packages/neuro-book/shared/agent/agent-image-policy.ts` 全部字段按 image 命名（maxImageBytes 16MB 等）。

**对单D 影响**：无——附件管道与单D UI 施工面不重叠。**处置**：登记后续小单（前端已有注释锚点），不在单D 内修。

### 2. 空会话无删除 API —— 属实，但有「归档」旁路

- 路由全集核实（`ls` 实测）：`packages/neuro-book/server/api/agent/sessions/` 下仅 `index.get.ts`、`index.post.ts` 加 `[sessionId]/` 下 15 个端点（abort/attachments×4/commands/context-inspection/current-project/entries×2/events/index.get/invocations/relations/tree），**无任何 delete 端点**；`grep delete` 在该目录零命中。全 API delete 端点清单里有 composer-drafts、profiles、traces、passport、projects、workspace-files，独缺 sessions。
- harness 层无删除：`packages/neuro-book/server/agent/harness/neuro-agent-harness.ts` grep 无 deleteSession/removeSession；仅有 private `archiveSession`（`:2373`，注释 `:2372`「归档 Session。关系账本保持不变」=DB 行不删），经 session command `"archive"` 暴露（`:3254-3256`）。
- 前端有归档按钮（逐个手动）：`packages/neuro-book/app/components/novel-ide/agent/AgentModeSessionSidebar.vue:238`、`AgentSessionDialog.vue:323`，命令发送在 `AgentChatSurface.vue:3456`。
- 「约 78 个」数字未验证（需查运行态 DB，本次只读勘察未动 SQLite）。

**对单D 影响**：低——会话侧栏若在单D 改版范围内，归档按钮交互可能被重排。**处置**：绕（存量逐个归档可隐藏）+ 登记小单（批量清理或物理删除 API），不阻塞单D。

### 3. 微调11 图标保存反馈 —— 找到三处候选病灶，均无反馈路径

组件实名 `WorkspaceFileDetailPanel.vue`（`.nuxt/components.d.ts:201` 映射 `NovelIdeWorkspaceFileDetailPanel`）：

- 图标区 UI：`packages/neuro-book/app/components/novel-ide/workspace/WorkspaceFileDetailPanel.vue:336-339`（当前图标展示+「选择图标」按钮）、`:416-419`（LucideIconPickerDialog）。
- **病灶候选 A（静默保存）**：`applySelectedIcon`（`:201-207`）选中后 `void saveDraft()` 不带 `notify`；`saveDraft`（`:152-168`）仅 `options?.notify` 时弹成功提示（`:165-167`）——图标保存与 title blur（`:313`）等自动保存同为静默，用户无「已保存」感知。
- **病灶候选 B（守卫静默丢弃）**：`saveDraft:153` 在 `diagnostics` / `frontmatterError` / `savingFile` 时直接 return，但此时 `draft.value.icon` 已在 `:205` 改写、UI 已显示新图标（`currentIconName :103` 从 draft 读取）——**视觉已变、磁盘未写、零提示**。
- **病灶候选 C（失败无提示）**：`store.saveCurrentFile`（`packages/neuro-book/app/stores/novel-ide.ts:913-976`）仅冲突走弹窗，其余错误 rethrow（`:972`）；图标路径 `void saveDraft()` 无 catch，失败时无任何通知。

**对单D 影响**：高——单D 若改版属性面板（FileDetailPanel 属 028 已统一的表单化形态），此病灶正好顺手修。**处置**：修（待用户截图指认 A/B/C 哪一表现，三个都是十行内小改：A 加 `{notify:true}`、B/C 加失败通知）。

### 4. 024 OOM 双层防御 —— 均在位

- **resourceLimits 层**：`packages/neuro-book/server/agent/profiles/profile-compile-worker.ts:745-757`——`createCompileWorker` 对 precompiled（`:751`）与 tsx loader（`:753-756`）两分支 Worker 均传 `resourceLimits = {maxOldGenerationSizeMb: 1024}`（`:749`）；注释 `:747-748` 明记「防止异常源码把 Worker 推到系统级 OOM 连坐 dev 进程（用户资产 personas 预览崩溃实测形态）」。commit `a9b30dc5`（git log 核实）。
- **crash 上报路径**：Worker `error`/`exit(code!==0)` 事件（`:306-313`）→ `handleCrash`（`:354-363`）→ `workerFailedResult` 按编译失败上报并移除槽位，不连坐主进程。
- **sync 捕获层**：`packages/neuro-book/server/api/workspace-files/sync-user-assets.post.ts:10-27`——try/catch 包住 `prepareSystemAssets`，失败转友好 500；注释 `:20-21`「冒泡出去曾与 dev 进程异常退出（exited code 5）同时段出现，不允许再向上逃逸」。commit `223799d9`（`git show --stat` 核实，恰为该单文件）。
- BOARD 登记：`docs/tasks/BOARD.md:43`——「根因循环未定位（崩溃堆栈在用户终端未回传，dev 日志管道已就位待复发即抓）」。

**对单D 影响**：无。**处置**：等（复发抓栈；防御已兜底，不宜在无堆栈时深挖）。

### 5. 023 句柄泄漏 —— 登记在案但从未进入施工，无代码可核

- 仅两处登记：`docs/design/009-单C-总任务书.md:147`（「023 句柄泄漏复现定位」）；`docs/tasks/BOARD.md:41`（028 行尾「本行只剩句柄泄漏；背景见 021 排查」，状态**待办·优先级中**）。
- 021 排查结论（`docs/tasks/BOARD.md:34`）：删书失败根因=凌晨僵尸 dev 实例（pid 26292）持 workspace 文件锁 + `runtime.lease` mkdir 锁残留死链，判定「非产品代码缺陷」；lease 自愈已由任务 022 落地验收（`docs/tasks/任务022-中文化第一批+lease自愈.md:78`）。
- 代码侧现状：021/022/023 相关任务书 grep「句柄|泄漏|leak」零命中；仓库内无句柄泄漏专项修复代码、无 evidence、无复现步骤——**该项自登记起未做任何定位工作**（此为本次核实的核心发现）。

**对单D 影响**：无。**处置**：等（无复现路径；环境态僵尸实例+lease 自愈已兜底），建议单D 前把它从已完成的 028 BOARD 行拆出独立小单登记，避免悬挂在完成行里被遗忘。

---

## 二、施工前置坑

### 坑1：i18n 冻结窗口——键规模与窗口设置

**现象**：单D 照图施工与批次 2-5 重排合并、i18n 一次过（`docs/design/009-单D-UI总攻蓝图.md:121`）。i18n 文件是双巨石文件，替换（改既有值）与追加混行必冲突——总任务书铁则 8 已裁定：批量替换执行期间冻结其他一切 i18n 改动（`docs/design/009-单C-总任务书.md:174`）。

**证据**：

- 键文件：`packages/neuro-book/app/i18n/locales/zh-CN.ts`（2658 行）、`en-US.ts`（2656 行）；本次 `grep -cE "^ +[a-zA-Z0-9_]+: "` 实测**各 2518 个键行**，两文件键集合一致（diff 唯一差异是 `expandFull:` 键位置顺序不同，非缺失）。
- 顶层 11 个命名空间：common/api/worldEngine/dialog/auth/admin/settings/ide/agent/markdownStudio/composables（`packages/neuro-book/app/i18n/locales/zh-CN.ts:2-2650`，其中 settings 占 164-903 行、ide 占 904-1785、agent 占 1786-2443——单D 重排的主战场 agent 段约 660 键）。
- 配置入口：`packages/neuro-book/app/i18n/i18n.config.ts:1-12`，经 `nbook` 别名导入双文件。
- 增长速度：词表盘点时（2026-09-20）双语各 2299 条（`docs/knowledge/界面英文词表.md:5`），三天增到 2518（+219，来自 022/028/009C 各批块尾追加）。
- 影响面：103 个 `.vue` 文件使用 `$t`/`useI18n`（本次 `grep -rl` 实测）；至少 4 个测试文件直接 import 双语文件断言键值（如 `packages/neuro-book/app/components/novel-ide/agent/AgentCacheRing.test.ts:4-5`、`AgentSessionScaleBar.test.ts:4-5`、`AgentThinkingLevelSelect.test.ts:4`）。

**规避动作**：冻结窗口=「重排+中文化第二批（词表 139 条，`docs/knowledge/界面英文词表.md:5`）+新键追加」三件事捆成一个窗口、单一执行体独占两份 locales 文件；窗口起止各跑一次键行数对账（`grep -cE "^ +[a-zA-Z0-9_]+: " zh-CN.ts` 与 en-US.ts，两数相等且差值=本窗口计划增删数）+ 上述 import 双文件的组件测试，防键漂移与双语失衡。022 批次的「双语言文件自动融合」流程（BOARD 47 行 028 合入记录）可复用作合并模板。

### 坑2：测试基线 3353——跑法

**现象**：master 侧当前全量基线，验收对账的锚点。

**证据**：`docs/tasks/任务009C1R3-三轮走查部件返修.md:31`：**vitest 全量 3353 过 / 17 败 / 3 跳**（=合并后 master 实测 3351 + 2 新用例）；17 败=server/agent/profiles worker 系 `NEURO_BOOK_REPOSITORY_ROOT` 环境性失败，属已知常量非回归信号。跑法定义在 `packages/neuro-book/package.json:43`（`"test": "vitest run"`）；Windows 强制 `maxWorkers: 2`（`packages/neuro-book/vitest.config.ts:21`，4 workers 实测进程池异常退出）；真实模型测试独立入口 `test:real-model`（`packages/neuro-book/package.json:48`），默认全量不含。

**规避动作**：施工验收跑 `bun run --cwd packages/neuro-book test`（等效 `cd packages/neuro-book && bun run test`）；对账公式=3353±本单计划增删，17 败零增即绿。本次勘察按任务书要求**未真跑全量**。

### 坑3：nitro 增量缓存跑旧代码

**现象**：改 server 代码后 dev server 可能继续跑旧 bundle，源码 diff 是新的、行为是旧的，极易误判成「代码写错了」。

**证据**：总任务书明文（`docs/design/009-单C-总任务书.md:182`：改 server 代码后必须清 `.nuxt/dev` 或 grep bundle 验证，增量缓存会跑旧代码骗人）；实战翻车记录（`docs/tasks/任务022-中文化第一批+lease自愈.md:79`：自愈代码在源码但 bundle 0 命中、500 误判）。本次实测 `.nuxt/dev/` 存在且含 `index.mjs` 等产物（dev server 在跑，属预期）。

**规避动作**：改任何 server 代码后 `rm -rf packages/neuro-book/.nuxt` 重启，再 grep 产物验证新代码字符串命中（`.nuxt/dev/index.mjs`）；已验证的完整组合（`docs/tasks/任务009C1R-批次1判返返修.md:51`）：清 `.nuxt` + `node_modules/.cache` → 重启 → curl 首页 / `@vite/client` / `pages/index.vue` 三件全 200。注意 vite cacheDir 受 `NEURO_BOOK_CACHE_ROOT` 环境变量重定向（`packages/neuro-book/nuxt.config.ts:54-56`）——设了该变量时 `node_modules/.cache` 清了不够，还得清 `$NEURO_BOOK_CACHE_ROOT/vite`。

### 坑4：SFC 模板平衡——vue-tsc 不报、dev 编译器才报

**现象**：`<style>` 块误插 `<template>` 内部等 SFC 结构错误，typecheck 静默通过，但 dev 编译器报错且组件 404→导入链炸——R3 刚再犯一次（ScaleBar，`docs/tasks/任务009C1R3-三轮走查部件返修.md:33`）。

**证据**：`docs/tasks/任务009C1R-批次1判返返返修.md:51`：正则计数器对裸 `>` 有系统性误报（模板内含 `=>`、比较符），已废弃；有效办法=栈追踪（leftover 空=平衡）+ dev 编译器双确认。

**规避动作（施工自查三步）**：

1. `grep -n "</template>" <组件>.vue` 确认 `</template>` 行号在 `<style` 之前、且 `<script>`/`<template>`/`<style>` 三块顶层各只出现一次开闭；
2. typecheck 过≠安全，改完 SFC 必须过 dev 编译：清缓存重启后 curl 该组件路由 200；
3. 不要用数尖括号正则自检（已知误报）。

### 坑5：增补勘察发现（5 项）

1. **UnoCSS safelist 全量 lucide**（`packages/neuro-book/uno.config.ts:9`：`safelist: Object.keys(lucideIcons.icons).map(...)`）：任意 `i-lucide-*` 图标类名动态拼接都有效，新组件加图标**零配置**；代价是产物 CSS 恒全量，不要在此仓库担心「图标类没被扫到」。
2. **路径别名双处维护**：`nbook` → packages/neuro-book 根，同时映射在 `packages/neuro-book/nuxt.config.ts:50-52` 与 `packages/neuro-book/vitest.config.ts:10-14`；测试与运行时一致，但别名本身改动需两处同步。
3. **typecheck 独立 dotenv**：`packages/neuro-book/package.json:41` `"typecheck": "nuxt typecheck --dotenv .env.typecheck --logLevel silent"`——静默通过即零错，有任何输出即有错；验收口径写「typecheck 零错」时以此命令为准。
4. **impeccable detect 必须在仓库目录外跑**（`AGENTS.md:139`：本仓库 npm overrides 会致 EOVERRIDE）——单D UI 施工若要跑 UI 反模式扫描，先 cd 出仓库。
5. **词表口径**：中文化第二批备料 139 条、13 个页面区域（`docs/knowledge/界面英文词表.md:5`），冻结窗口的工作量输入；其中「Agent 统一译 AI 助手」等通用口径先读（同文件 `:8-14`）。

---

## 三、施工整体风险（按等级分级）

勘察范围：`packages/neuro-book/app/pages/index.vue`（2833 行，主布局宿主）、`stores/novel-ide.ts`、agent 面板族、`useResizablePanel.ts`、desktop 契约测试、i18n locale、`docs/design/009-单D-UI总攻蓝图.md`（决议来源，蓝图 §三第 3 层）。只读，未运行任何写命令。

**当前布局实现底细（翻转的施工面）**：布局全部集中在 `index.vue` 单文件：ActivityBar（左缘图标条）→ 容器内四个 flex 子块按 `order` 排序。栏位换位机制已存在——**现有「IDE/Agent 双模式」就是靠 order 互换实现的**：Studio 在 agent 模式 `order-3`、IDE 模式 `flex-1 order-2`（`index.vue:2567`）；Agent 面板在 agent 模式 `order-2 min-w-[340px] flex-[1.2]`、IDE 模式 `order-3`（`index.vue:2687`）。翻转本质是把这套 order/宽度/flex 权重的默认态改掉，机制可复用，但下方耦合点要逐个改。

### 等级汇总

| 等级 | 风险项 |
|---|---|
| 高 | R1 栏序/宽度联动硬编码单文件、R2 拖拽手柄方向假设、R3 双态扩三态动画重调、R5 desktop 契约测试断言源码字符串 |
| 中 | R4 刻度条位置假设、R6 持久化宽度旧值漂移、R7 四大 Dialog 搬家、R8 审稿对照视图不存在、R10 index.vue 单文件膨胀 |
| 低 | R9 驾驶舱新栏与左栏 tabs 扩容 |

### 高

**R1 栏位顺序与宽度联动硬编码在单文件**
- 证据：三处 `order-2/order-3` 切换 `index.vue:2567,2687`；宽度上限联动 `agentModeReservedWidth = 56 + 会话栏 + 340`（`index.vue:373`）、`agentPanelMaxWidth = 45% 视口`（`index.vue:375`）、`agentStudioMaxWidth = 视口宽 - reserved`（`index.vue:377-382`）、`agentStudioFileTreeMaxWidth`（`index.vue:383`）。翻转后「AI 居中偏宽、稿面居右」需要整套重算，且这些常量互相咬合。
- 缓解：先把栏位声明抽成配置（每态一列 order/flex/min/max），再换值；重命名宽度字段时同步 R5 契约测试。

**R2 拖拽手柄方向全部假设「面板在右、手柄挂左缘」**
- 证据：三个面板全用 `edge: "left"`（`index.vue:395,406,416`），模板手柄全是 `-left-1`（`index.vue:2577,2638,2695`）。AI 面板移到中间后其右缘/左缘两侧都是邻栏，手柄方向与 edge 语义要按新邻接关系逐个重定。`useResizablePanel` 本身已支持四向（`useResizablePanel.ts:4,155-157`），是配置级改动——这是好消息。
- 缓解：手柄 edge 与栏位排布写进同一份配置（见 R1），逐面板核对方向。

**R3 双态状态机扩成三态，FLIP/View Transition 动画全要重调**
- 证据：`NovelIdeLayoutMode = "ide" | "agent"`（`novel-ide.ts:97`）；过渡动画按 `to-agent/to-ide` 两方向写死（`index.vue:1403,1503`），FLIP 用 `MODE_TRANSITION_SELECTORS` 五个类名算位移（`index.vue:99-109`），`view-transition-name` 五组 CSS（`index.vue:2799-2815`）。新三态（常态/审稿态/工作区态）需要 3×2 个方向对、审稿态还有「稿面扩张+AI 收窄」的连续宽度动画，方向向量弄反会播反向动画。
- 缓解：状态机先落 store（三态枚举+合法迁移），动画方向表按状态对生成而非手写；`data-workbench-layout-mode`（`index.vue:2468`）扩值。

**R5 桌面契约测试断言 index.vue 源码字符串（高，易踩）**
- 证据：`desktop/shared/src/desktop-ui-contract.test.ts:115-117` 断言 index.vue 必须包含 `agentPanelMaxWidth`、`agentPanelOverlay`、`data-agent-panel` 三个字符串。重构改名（R1 抽配置几乎必然改名）会静默弄断 desktop 契约测试。
- 缓解：改名 PR 内同步更新该测试；`agentPanelOverlay`（视口 <800px 抽屉化，`index.vue:376`）语义在「AI 居中」后是否保留要单独裁决。

### 中

**R4 刻度条「挂 AI 面板滚动容器右缘」的位置假设**
- 证据：`AgentSessionScaleBar` 挂在 `AgentChatFlow.vue:667`（滚动容器外右缘，`AgentSessionScaleBar.vue:138` w-6 右缘轨道），hover 预览卡 `absolute right-full` 向左展开（`AgentSessionScaleBar.vue:168`）。AI 面板换到居中后右缘邻稿面，卡片仍向左开没问题；但「主舞台居中偏宽」会拉宽消息流，刻度密度映射（50 格封顶）视觉密度变化需走查确认。这是视觉风险不是结构风险。
- 缓解：保留挂载点，真机走查长会话场景（蓝图 §三已列此项，`009-单D-UI总攻蓝图.md:91`）。

**R6 持久化宽度字段的旧值语义漂移**
- 证据：localStorage pick 含 5 个布局字段（`novel-ide.ts:2013-2019`）：`agentPanelWidth=400` 默认（`novel-ide.ts:223`）是「右侧抽屉宽」，翻转后变「中间主舞台宽」，老用户存的 400px 会让 AI 面板过窄。
- 缓解：翻转上线时给宽度字段做一次版本迁移（存键加 schema 版本或重置默认）。

**R7 重内容对话框改工作区页，四大 Dialog 搬家（量大但模式统一）**
- 证据：现重内容全是模态：设置 `NovelIdeSettingsDialog.vue`（1333 行，但分区面板在 `settings/` 目录 26 个文件、`settings.section.*` 分区导航已有 `NovelIdeSettingsDialog.vue:88-118`）、世界引擎 `WorldEngineWorkbenchDialog.vue`（2203 行）、收件箱 `WorkspaceHistoryInboxDialog.vue`（212 行）、属性工坊 `UserProfileWorkbenchDialog.vue`。改法=外壳从 Dialog 换成工作区页宿主，内部分区面板全可复用；但各 Dialog 有「未保存草票/保存中」守卫逻辑（`index.vue:2521` 的 `worldEngineWorkbenchHasUnsavedDrafts`），改非模态后关闭守卫、路由切换守卫要重设计。
- 缓解：先做一个「工作区页宿主」壳（与审稿态同机制，蓝图已定 `009-单D-UI总攻蓝图.md:81`），逐个 Dialog 搬入，每搬一个走查一个；设置页「即时生效无保存按钮」要逐分区核对现在是否有点保存按钮的草稿模式（`settings` 下有 `*-draft.ts` 草稿会话，改即时生效是行为变更非纯搬家）。

**R8 审稿态「对照视图」不存在，需新视图模式**
- 证据：`WorkspaceEditorViewMode` 只有 `"rich" | "source"`（`shared/editor-workbench.ts:2`）；「左摘要右对照」是新增形态。可复用资产在：`common/diff/DiffWorkbench.vue`、`SharedDiffEditor.vue`、`SharedMergeEditor.vue`（目录实存）。
- 缓解：对照视图作为 viewMode 第三值落 shared 合同，复用 diff 组件族，不新建编辑器。

**R10 index.vue 单文件膨胀**
- 证据：2833 行已含布局+动画+项目会话+桌面桥+十几个弹窗编排；翻转再进三态状态机+驾驶舱+工作区页路由，会突破 3500 行。
- 缓解：施工时把「布局编排层」抽成子组件/composable（如 useWorkbenchLayout），与 R1 配置化合并做。

### 低

**R9 驾驶舱新栏与左栏 tabs 扩容**
- 证据：左栏现状=`NovelIdeActivityBar`（自包含左缘条，`NovelIdeActivityBar.vue:251` border-r）+ `NovelIdeToolPanel`（edge:"right"，`NovelIdeToolPanel.vue:79`，位置不动，方向不受翻转影响）；tab 枚举仅 `["files","characters","plot"]`（`mock-data.ts:1`）。驾驶舱=ToolPanel 新增 tab 或新面板段，轻内容三入口（历史对话/收件箱/待拍板）同法扩。波及小。
- 缓解：收件箱轻面板可从 212 行 Dialog 内列表逻辑抽取复用。

### i18n 键新增量预估（推算，非实测）

现有规模实测：`zh-CN.ts` 2658 行约 2518 键，其中 `ide` 节约 231 值（904-1143 行区间统计）、`agent` 节约 814 值（1786 行起）。新增预估（按同类面板密度推算）：

| 区块 | 估量 | 说明 |
|---|---|---|
| 驾驶舱 | 30-50 键 | 章节进度/AI 状态/待拍板行/伏笔计数/各行动作词 |
| 堆叠卡 | 15-25 键 | 通过/拒绝/滑动提示/卡内字段标签 |
| 工作区页 | 20-40 键 | 页壳+分区导航+空态；设置文案大头复用现有 `settings.*` |
| 审稿态 | 10-15 键 | 「审这章」/对照标签/一键回常态 |
| 合计 | **约 75-130 新键 ×2 locale** | 双文件同步（en-US/zh-CN），符合蓝图「i18n 冻结窗口一次过」安排（`009-单D-UI总攻蓝图.md:121`） |

### 回滚策略建议

- 现状：批次 1 已在 `task-009c-r3` 分支 commit（fad65f0a），tag 全是 canary 自动发布 tag（`git tag` 实测），无手工回滚 tag 惯例——**回滚单位=分支/merge commit，不依赖 tag**。
- 建议：骨架翻转单独一支 `task-单D骨架` 分支，内部按四段 commit：①栏位换位+手柄/宽度联动 ②三态状态机 ③驾驶舱 ④工作区页宿主。master 合并前整支可弃；合并后回滚用 `git revert -m 1 <merge>`（仓库已是 merge 惯例，见 fc402907）。R6 宽度迁移与 R5 契约测试必须与①同 commit，避免中间态可运行但数据/契约断裂。
- 验收门：每段 commit 后跑 `bun --cwd packages/neuro-book run test`（vitest run，`packages/neuro-book/package.json:43`）+ `typecheck`（同文件 `:41`），骨架全部合入前用真机走查 J1-J5。

### 与批次 2（交互件）的顺序依赖

- 批次 2 件（置信度标/灵感库/选择题 1B，蓝图 §二积木表）落点在 `AgentChatSurface.vue`（4502 行）与 `AgentChatFlow.vue` 的**消息流内部**；翻转改的是同一文件的**外壳层**（layout prop、根 section 类，`AgentChatSurface.vue:124,4277`）。同文件双层施工=必然 merge 冲突。
- 结论：**骨架先行、批次 2 后上**。理由有三：①翻转决定 AI 面板净宽（居中偏宽 vs 现右侧 400px 默认），置信度标/工作块等交互件的换行与密度设计依赖最终宽度；②堆叠卡（待办统一体系）挂在「输入框上方」，位置规格随新布局定（蓝图 §三 85 行）；③骨架是纯结构改动不改消息语义，先行可让批次 2 在稳定容器上施工。反向并行不可取。
- 衔接点：翻转期间冻结 AgentChatSurface 外壳层改动；批次 2 开工前骨架必须已合入 master，避免 rebase 大文件。

---

## 遗留与待复核

以下为材料中标注的待人工复核/未验证项，汇总如下：

1. **「约 78 个空会话」数字未验证**（一.2）：需查运行态 DB，本次只读勘察未动 SQLite；批量清理或物理删除 API 待登记小单。
2. **微调11 用户侧具体表现未验证**（一.3）：A（静默保存）/B（守卫静默丢弃）/C（失败无提示）三处候选病灶待用户截图指认是哪一表现，再决定修哪处（均为十行内小改）。
3. **024 OOM 根因循环未定位**（一.4，`docs/tasks/BOARD.md:43`）：崩溃堆栈在用户终端未回传，dev 日志管道已就位，待复发即抓；防御已双层兜底，不宜在无堆栈时深挖。
4. **023 句柄泄漏无代码可核**（一.5）：自登记起未做任何定位工作，无复现步骤；建议从已完成的 028 BOARD 行拆出独立小单，避免悬挂遗忘。
5. **全量 vitest 未跑**（坑2）：任务书明示不跑，3353 基线引用自 `任务009C1R3-三轮走查部件返修.md:31` 记录，非本次实测。
6. **dev server 编译行为未实测**（坑3、坑4）：只读约束下未做清缓存重启与 curl 验证；「已验证组合」引用自历史任务书记录。
7. **「i18n 引用测试 7 条」口径未能复核**（坑1）：022 提到的 7 条未找到独立对称性测试文件，本次只找到 4 个组件测试直接 import 双语文件。
8. **风险评估全部为静态代码阅读**（三章）：未启动 dev server、未跑测试套件、未实际操作拖拽手柄；i18n 新增量 75-130 键为推算值。
9. **`agentPanelOverlay` 语义待裁决**（R5）：视口 <800px 抽屉化逻辑在「AI 面板居中」后是否保留，需单独裁定。
10. **设置页草稿模式核对**（R7）：`settings` 下 `*-draft.ts` 草稿会话改「即时生效」属行为变更非纯搬家，需逐分区核对。
