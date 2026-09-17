# NeuroBook「对话式创作 + 流程闭环」统一实施计划

- 日期：2026-09-17（深夜定稿）
- 制定者：总设计师（software-team-lead，主理人）
- 执行者：software-engineer（寇豆码）/ software-qa-engineer（严过关）/ software-product-manager（许清楚）；视觉线由并行 UI 会话承担（不归本计划管辖，但衔接判定在第 3 节）
- 依据文档（本计划的输入，执行者必读）：
  - `deliverables/competitive-flow-analysis-2026-09-17.md`（功能诊断：六维对比 + 八步链路断点）
  - `deliverables/ui-conversational-paradigm-assessment-2026-09-17.md`（UI 评估：对话式范式 + 改进清单 H/M/L）
- 已获授权：GTF 已拍板形态决策（检索选 C / 定稿审计选 B / 结算表做）；宪法有一定宽容度（规范与实际效果冲突时灵活取舍，最佳整体效果为最高原则）；其余决策由总设计师代决（见第 9 节）

---

## 1. 总体目标

**一句话：把两条调研共同的结论——「引擎已建成，缺的是接线和翻译层」——变成产品事实。让用户能以「跟主编聊天」的方式走通 从开书到定稿 的完整创作链路，同时把已建成的四个隐形能力（备份/历史/RAG/全稿扫描）接到用户手上。**

分解为四个可验收的子目标：

| 子目标 | 来源 | 完成形态 |
|---|---|---|
| G1 流程闭环 | 功能诊断断点 8 + 拍板 11B/12 | 每章循环收敛为「说需求 → 看结算与审计 → 点定稿」三动作，定稿 = 正文+世界状态+承诺节拍的原子提交 |
| G2 对话式链路 | UI 评估 H1–H4 | 主编开场白 / 方案确认卡 / writer 进度可见 / 复杂度阶梯 四件落地 |
| G3 能力兑现 | 功能诊断 P0 | 备份 UI、RAG 检查器解禁、历史时间线面板、llmlint 全稿扫描 四件前端接入 |
| G4 工程底座 | A6 快照遗留 | 依赖对齐修复 `nuxt:build`（当前生产产物构建是红的——stable 的硬阻塞） |

**明确不在本计划内**：文风注入（宪法第五条未落宪，GTF 态度开放但待正式修订）、`AgentChatSurface` 完整 4670 行拆分（只做与 H2 合并的第一刀）、移动端、签名/updater/macOS（需外部条件）。

## 2. 当前状态快照（2026-09-17 23:45）

| 工作线 | 状态 | 关键事实 |
|---|---|---|
| 视觉 UI 线（并行会话） | **在途**：工作区有未提交改动（`app/i18n/locales/*.ts`、`app/pages/index.vue`、EDITOR-REVIEW.md + 新截图）；已合入至 `d3b8d839`（位置感状态行） | 近期全量 489 文件 / 3769 通过 / 0 失败；剩余 #3 状态条 #4 ⌘K 收尾中 |
| 本线（工程/产品） | **干净**：两份调研报告已合入推送（`796cb4a3`），与 origin 0/0 同步 | e2e 12 条全绿（最近一次）；`node_modules` 已修复（install 536ms）；`nuxt:build` 仍红（依赖版本分裂） |
| 存量数据 | 真稿 224 章 / worldAnchor 全空 / Keyframe 与 Decision 0 条 | 真稿体检报告在 `deliverables/truthdata-checkup/` |

## 3. 两线衔接协议（最高优先级约束）

### 3.1 热区文件清单与认领规则

以下文件是两线共同的高频改动区，**在 UI 线完成合入（M1，见第 5 节）之前，本计划的所有任务禁止触碰**：

```
app/components/markdown-studio/**        （UI 线视觉主战场）
app/components/novel-ide/agent/AgentChatSurface.vue 及 AgentChatFlow/AgentComposer
app/i18n/locales/zh-CN.ts / en-US.ts     （UI 线正在改）
app/pages/index.vue                       （UI 线正在改）
app/utils/theme/**、app/styles/**、workbench-chrome.ts、nuxt.config.ts
packages/nb-ui/**
```

**例外**：阶段 0 任务全部设计为 server 侧 / assets 协议 / 全新文件，与上述零交集（逐任务标注「冲突面」）。

### 3.2 M1（UI 线合入验收）判定标准——满足后才启动阶段 1

1. `git status` 中 UI 线在途改动全部提交（工作区只剩他人在途的 `package.json` smoke 行与 `deliverables/` 证据）
2. 全量测试绿：`bun --bun run --cwd packages/neuro-book test`（0 failed）
3. **本线 12 条 e2e 复跑全绿**：`bun run --cwd packages/neuro-book test:e2e`——特别验证 07-agent-behavior 的行为锁没被 UI 线改动打破（其选择器依赖 i18n 文案，UI 线动过 i18n）

> 若行为锁被打断：先由 UI 线或本线修选择器（改 `e2e/support/agent.ts` 集中常量），绿了才算 M1。

### 3.3 测试互斥协议（避免已知假红）

全量测试 / e2e / `nuxt:build` 这三类重任务，**两线不得同时跑**（`.nuxt` 重建 + Vite 重优化会制造整体性假红——已三次实测确认）。约定：跑之前 `git status` + 观察最近文件 mtime，确认无并发写盘。e2e 需要端口 3400/3401/3499/3500 空闲。

### 3.4 i18n 并发追加规范（阶段 1 内也适用）

只允许**块尾追加**自己的 key，不改他人区块；提交信息标注 `[i18n-add]`；冲突时以「双方 key 都保留」为解决原则，禁止顺手删对方 key。

## 4. 任务清单（按阶段）

### 阶段 0：并行窗口期（立即启动，不等 UI 线）

> 全部为 server 侧 / assets 协议 / 全新文件。每个任务独立可交付、独立验收。

---

#### T0.1 写后结算表协议（writer 产出「本章新事实」的结构化上报）

- **执行者**：software-engineer
- **职责**：定义并落地「结算表」协议——writer 每完成一章，在交付消息尾部附加一个**约定格式的结构化文本块**（markdown 约定标题，如 `## 本章结算`），内容为：新增事实清单（人物/物品/状态变化/时间推进）、与既有设定的冲突点（writer 自己发现的）、未确定项。
- **关键设计决策（已定，不要改）**：**用文本协议，不用 tool call**。理由：① mock LLM 不支持 tool_calls（e2e 可测性）；② writer 工具面不加新工具（只读边界不动）；③ leader 直接在会话流里消费，无需新管线。
- **输入**：`packages/neuro-book/assets/workspace/.nbook/agent/profiles/builtin/writer.home.profile.tsx`（或实际 writer profile 路径，执行者先 grep `writer` profile 定位）；`assets/reference/agent/novel-writing-workflow.md`（第 28-29 行写后检查环节）；`skills/novel-writing/` 的正文循环环节。
- **改动面**：writer profile 的交付要求段 + novel-writing skill 文档 + leader profile 消费说明。**冲突面：零**（UI 线不碰 agent profile）。
- **输出**：协议文档段落（写进 novel-writing skill）+ profile 修改。
- **验收标准**：① 新增一条单测或契约测试锁定结算块格式约定；② e2e 新用例（沿用 mock LLM）：发起一次写作会话，断言交付消息可被解析出结算块结构（mock 吐固定结算样例文本）；③ `bun run --cwd packages/neuro-book typecheck` 绿。
- **前置任务**：无。
- **宪法兼容性**：完全事后路线（写完上报），宪法第五条明文鼓励方向。
- **未验证声明**：真实模型是否稳定产出合格结算块——需 `test:real-model`（要 API key），计划内标注「首次真实使用时人工抽查」。

---

#### T0.2 定稿原子提交服务（正文 + 世界状态 + 承诺节拍一事务）

- **执行者**：software-engineer
- **职责**：新建 server 服务 `finalizeChapter`：把「正文落盘 + World Patch 应用 + Promise beat 更新」组织为一个原子单元——用 nb-history 的事件快照做检查点，任一步失败整体回滚，成功则一次性提交并返回结算凭据。
- **输入**：`packages/nb-history/src/`（事件溯源 registerObservedWrite、内容寻址快照）；`server/world-engine/`（patch 应用入口）；`server/plot/`（promise beat 写入）；参照 InkOS「安全章节工作区」概念（功能诊断报告借鉴清单第 1 条）。
- **改动面**：`server/` 下新文件（建议 `server/plot/chapter-finalize.service.ts`）+ API 路由 `server/api/projects/plot/finalize.post.ts`。**冲突面：零**。
- **输出**：服务 + API + 测试。
- **验收标准**：① 单测：构造三步中第二步失败，断言正文与状态均回滚到提交前；② 单测：成功路径断言三处写入一致且产生一条 finalize 事件；③ typecheck 绿。
- **前置任务**：无（与 T0.1 并行；但 T0.1 的结算表是它的最佳输入，联调在 M3）。
- **宪法兼容性**：纯工程事务，不涉方法论。

---

#### T0.3 设定检索自动候选（拍板 10C 的后端半）

- **执行者**：software-engineer
- **职责**：改造 retrieval 环节——leader 在编译 brief 前调用检索时，产出**候选清单**（lorebook 条目 + 相关正文片段，带 path/摘要/相关性），以结构化数据呈现给用户一键确认（前端确认 UI 是 T1.x，本任务只做数据与协议）。**不直接喂 writer**——确认后的清单仍按现行 handoff 协议进 `context.lorebookEntries`。
- **输入**：`server/agent/tools/`（retrieval 相关工具）；`novel-writing-workflow.md` 第 27 行（Retrieval handoff 环节现行契约）；`subject_rag_search` 工具现状。
- **改动面**：agent 工具层 + novel-writing skill 文档。**冲突面：零**。
- **验收标准**：① 工具单测：候选清单结构稳定（path/摘要/来源）；② 确认后的 handoff 数据形状与现行 `context.lorebookEntries` 完全兼容（不破坏 writer 协议）；③ typecheck 绿。
- **前置任务**：无。
- **宪法兼容性**：确认权在人（10C 的 C 就是这个）；writer 仍只拿事实级内容。

---

#### T0.4 llmlint 全稿扫描后端（目录模式 + 聚合结果）

- **执行者**：software-engineer
- **职责**：扩展 `llmlint-check`：支持目录目标（递归全部 .md）、返回聚合 DTO（按文件/级别/规则三维统计 + top 命中列表 + 总字数）。性能已实测可行（236 文件 1.48s，CLI 层）。
- **输入**：`server/workspace-files/llmlint-check.ts`（现有单文件实现，含 skill root 解析与 JSON 解析）；`packages/llmlint/skill/src/cli.ts`（check 的目录入参已支持——`<files...>` 可传目录）。
- **改动面**：server 两个文件（runner + API）。**冲突面：零**。
- **验收标准**：① 单测：目录模式聚合结构正确；② 在真稿**副本**上实测（复制到 %TEMP%，绝不碰真实 State Root），记录 224 章扫描耗时与命中统计作为基线数字；③ typecheck 绿。
- **前置任务**：无。
- **宪法兼容性**：只读检查，与现有单文件入口同一性质。

---

#### T0.5 存量项目 worldAnchor 半自动补齐（224 章通电工程）

- **执行者**：software-engineer
- **职责**：新建「锚点建议」服务：读章节正文 → 识别人物名（对照已有 lorebook character 条目 aliases）、地点词 → 生成建议锚点（subjects/时间估计）→ 存为「建议」状态待人工确认；提供确认 API（逐条或批量）。**不自动写入**。
- **输入**：`shared/dto/plot.dto.ts:276`（StorySceneWorldAnchorDto）；`server/plot/`（scene 更新入口）；真稿项目结构（`deliverables/truthdata-checkup/README.md`）。
- **改动面**：server/plot/ 新服务 + API。**冲突面：零**。
- **验收标准**：① 单测：建议生成与确认写入两环节；② 真稿副本上跑一次全量建议（224 章），抽查 20 章建议质量并记录准确率于交付说明；③ typecheck 绿。
- **前置任务**：无。
- **宪法兼容性**：人工确认制（写库前必须人点头）。

---

#### T0.6 承诺账本逾期视图后端

- **执行者**：software-engineer
- **职责**：plot promises 查询加 `overdue` 过滤（deadlineChapterId ≤ 当前最新已写章 且 status=open），返回带逾期章数。
- **输入**：`server/plot/`（promise 查询）；参照 InkOS hook_board 的「预期回收时间」警示概念。
- **改动面**：server/plot/ 查询扩展。**冲突面：零**。
- **验收标准**：单测（构造逾期/未逾期/已兑现三态）；typecheck 绿。
- **前置任务**：无。

---

#### T0.7 一致性审计引擎 v1（拍板 11B 的引擎半）

- **执行者**：software-engineer
- **职责**：新建定稿审计服务：输入 = 本章结算表（T0.1 协议）+ 承诺账本 + World 当前状态 + llmlint 结果；输出 = 中文审计报告 DTO（三源：① 承诺对照——本章该兑现/推进的承诺是否在结算中体现；② 状态对照——结算声明的事实变化是否已进 World patch（T0.2 的 finalize 数据）；③ 文本质量——llmlint high 命中列表）。**只报告不改稿**。
- **输入**：T0.1/T0.2/T0.4 的产出（**前置**）；`server/plot/services/chapter-writer-brief.service.ts`（状态机参照）。
- **改动面**：server 新目录（建议 `server/consistency/`）+ API。**冲突面：零**。
- **验收标准**：① 单测：构造「该兑现的伏笔没兑现」「结算声明与 World patch 不一致」两个矛盾场景，断言报告检出；② 报告文案由 PM 提供（见 T0.8）；③ typecheck 绿。
- **前置任务**：T0.1、T0.2、T0.4。
- **宪法兼容性**：事后审计，11B 拍板的直接落地。

---

#### T0.8 主编话术与文案包（PM 并行产出，不碰代码）

- **执行者**：software-product-manager
- **职责**：产出全部用户可见文案的**成稿**（zh-CN + en-US 双语），交付为一份文案规格文档（带 i18n key 命名建议），供阶段 1 直接取用：① 新会话开场白（无项目版/有项目版/续写中断版，三种）；② brief 失败的人话翻译（needs_plot/needs_world_anchor/needs_world_context 三态 + 「带我去补」按钮文案）；③ 审计报告的中文模板（T0.7 消费）；④ 方案确认卡的确认/修改/重做按钮文案与防疲劳摘要级文案（M5）；⑤ 「再来一章」快捷入口文案。
- **输入**：两份调研文档的话术示例；`app/i18n/locales/zh-CN.ts` 现有 key 命名风格。
- **输出**：`deliverables/copywriting-pack-2026-09/`（新目录）文案规格 md。
- **验收标准**：GTF 可读的成稿（不是提纲）；每条带使用场景注释。
- **前置任务**：无。
- **注意**：PM 产出纯文档，**不改任何代码文件**。

---

### 阶段 1：UI 线合入后（M1 达成）启动

> 本阶段全部触碰前端热区。启动前置：第 3.2 节 M1 三条全部满足。

---

#### T1.0 依赖对齐专项（修 `nuxt:build`，G4）

- **执行者**：software-engineer（**独占窗口**：此任务进行期间，其他人不做任何代码提交）
- **职责**：更新 `bun.lock` 使依赖树满足 Nuxt 4.5.1 期望（Vue 全家桶 ≥3.5.40，连带 `devalue` 等一批）→ `bun install`（本机已修复，秒级）→ 全量验证。
- **输入**：`bun.lock`；A6 快照的归因记录（`deliverables/stable-admission-a6/`：@vue/shared 3.5.39 vs ^3.5.40 冲突链）。
- **验收标准**：① `bun run --cwd packages/neuro-book nuxt:build` **EXIT=0**（当前是红的——这是本任务唯一硬指标）；② 全量测试 0 failed；③ e2e 全绿；④ `product-start.test.ts` 绿。四条全过才提交。
- **风险预案**：若升级引发大面积类型/运行时错误（预计 `@vue/shared` 影响 moderate）——回滚方案：`git checkout bun.lock package.json && bun install --frozen-lockfile`（实测 536ms）。**宁可回滚不硬推**。
- **前置任务**：M1。

---

#### T1.1 主编开场白（H1）

- **执行者**：software-engineer
- **职责**：新建会话时按项目状态注入 assistant 首条消息（三种场景文案用 T0.8 成稿）：无项目→「想写点什么？」；有项目→「上次写到 N 章…」；刚定稿→衔接语。技术上：会话创建路径（`AgentChatSurface` 的 createSession 流）注入一条本地 assistant 消息（不调模型——**离线可测**）。
- **输入**：T0.8 文案包；`AgentChatSurface.vue` 会话创建逻辑（e2e helper `e2e/support/agent.ts` 已有 createSession 封装可参照）。
- **验收标准**：① e2e：新建会话断言首条 assistant 消息出现且文案正确（三场景至少覆盖两种）；② 既有 12 条 e2e 复跑绿（开场白不能破坏既有流）；③ typecheck + i18n 追加规范。
- **前置任务**：M1、T0.8。

---

#### T1.2 writer 进度可见（H3）

- **执行者**：software-engineer
- **职责**：写作期（writer 运行中）在聊天侧栏/底部常驻一个极小进度指示（第 N 章 · brief ready · 流式中），点击展开 writer 会话入口。数据源：`AgentLinkedAgentPanel.vue` 现有 linked-agent 状态 + writer payload 的 chapterId（`novel-writing-workflow.md` 第 56 行：writer 用 chapterId 自取 brief）。
- **输入**：`AgentLinkedAgentPanel.vue:22-47`（现有状态点）；`server/plot/services/chapter-writer-brief.service.ts:277-288`（brief 状态机，需要新开一个查询 API 暴露给前端）。
- **改动面**：server 加一个只读查询 API（零冲突）+ 前端 AgentChatSurface 侧栏小件。
- **验收标准**：① e2e（mock LLM）：发起写作后进度指示出现且章号正确；② 12 条既有 e2e 复跑绿。
- **前置任务**：M1、T1.1（同文件顺序执行，见冲突策略 7.1）。

---

#### T1.3 L2 方案确认卡（H2，与行动 12 拆分第一刀合并）

- **执行者**：software-engineer
- **职责**：新建 `AgentPlanConfirmCard.vue` 组件族：结构化方案（大纲章节列表/设定包/检索候选清单——T0.3 数据源）以卡片呈现，逐项 ✓/✗/改，整体确认/重做；确认结果回传 agent 会话（作为用户消息或工具响应）。**同时**：这是 AgentChatSurface 拆分的第一刀——确认卡作为独立模块挂载，不内联进 4670 行巨石（新组件 + 巨石里只加挂载点）。
- **输入**：`AgentRequestUserInputBubble.vue`（同族交互件参照）；T0.3 候选清单 DTO；T0.8 卡片文案；InkOS Studio Chat「确认卡拦截重动作」模式（UI 评估报告 2.3）。
- **验收标准**：① e2e：构造一个带方案卡的场景（mock 吐候选数据或直接测前端组件级交互——执行者按可测性选择并说明）；② 防疲劳默认：卡片默认摘要级、展开见细节（M5 一并做）；③ 12 条既有 e2e 复跑绿。
- **前置任务**：M1、T0.3、T0.8、T1.2（顺序）。

---

#### T1.4 复杂度阶梯（H4）

- **执行者**：software-engineer
- **职责**：把 `layoutMode`（ide/agent）与创作阶段联动：灵感期（无项目/新会话）默认 agent 布局；进入写作期（打开章节编辑）默认 ide + 专注模式提示。**只做默认值的智能切换 + 一次可记忆的用户覆盖**（用户手动切过就不再自动切——localStorage 记忆）。
- **输入**：`stores/novel-ide.ts:97,240`（layoutMode）；`useFocusMode.ts`；novel-guide 阶段判断（作为语义依据，前端做轻量版判定：有无项目 + 当前是否在写作会话）。
- **验收标准**：① e2e：无项目新用户进 agent 布局、打开章节后建议切 ide（提示条形式，不强制）；② 既有 e2e 复跑绿。
- **前置任务**：M1、T1.2。

---

#### T1.5 兑现层前端三件 + 扫全稿入口（G3）

- **执行者**：software-engineer（可拆给两个 Agent 并行：A=备份+历史，B=RAG+全稿）
- **职责**：
  - A1 备份/恢复 UI：设置区内新页面（发起备份/历史列表/恢复引导三块），调既有 `/api/passport/backups/*`（**注意**：端点已加鉴权，恢复码流程文案要写清）。
  - A2 历史时间线面板：nb-history TimelineEntry 能力的 UI（按时间列出项目事件、删除找回入口），挂 `WorkspaceHistoryInboxDialog` 同族位置。
  - B1 RAG 检查器解禁：翻转 `NovelRagPanel.contract.test.ts` 的「不挂载」断言，把 `NovelRagInspectorDialog` 挂进主 IDE（放「世界」活动域）。
  - B2 llmlint 全稿扫描入口：现有 `NovelProseLintPanel` 加「扫全稿」按钮（调 T0.4 目录模式），结果聚合视图（按文件分组的命中列表 + 统计头）。
- **验收标准**：各件单测/组件测试 + e2e 至少一条（备份发起→列表出现）；既有 e2e 复跑绿；i18n 追加规范。
- **前置任务**：M1；B2 另需 T0.4。

---

#### T1.6 对话式链路剩余件（M1-M3 优先级带）

- **执行者**：software-engineer
- **职责**（每件独立小任务，按序）：① brief 失败人话翻译 + 「带我去补」按钮（数据源 brief 状态机 API——T1.2 已开）；② 空态「和 AI 聊」第三入口（`ProjectPickerScreen.vue` 空态区 + 直达 agent 布局新会话）；③ 「再来一章」快捷路径（定稿后一键复制上章参数进下一章循环——依赖 T1.7）；④ 灵感探索显式入口（功能诊断 P1-6，空态引导进 novel-idea-exploration 会话，与 ② 合并实现）。
- **验收标准**：各件 e2e 或组件测试；文案用 T0.8。
- **前置任务**：M1、T1.1、T0.8；③ 另需 T1.7。

---

#### T1.7 定稿闭环串联（G1 的用户面）

- **执行者**：software-engineer
- **职责**：写作期聊天流末尾出现「定稿」按钮（writer 交付 + 结算表呈现之后）：点击 → 调 T0.2 finalize API（原子提交）→ 展示 T0.7 审计报告（确认卡形式，复用 T1.3 组件族）→ 用户「定稿」或「回去改」。这是把 T0.1/T0.2/T0.7 三个后端件接到用户手上的最后一根线。
- **验收标准**：① e2e 全链（mock LLM）：写完→结算块呈现→点定稿→审计报告出现→确认→断言三处写入（正文文件内容 + world patch 计数 + promise beat 状态，用 API 断言）；② 既有 e2e 复跑绿。
- **前置任务**：T0.1、T0.2、T0.7、T1.2、T1.3。

---

#### T1.8 novel-setup 进度可视化 + 逾期视图前端（P1-8/P1-9）

- **执行者**：software-engineer
- **职责**：① setup 四阶段进度条（checklist 已有 task_create 机制，前端渲染成阶段进度组件——数据从会话 task 状态取）；② 承诺账本加「逾期」过滤 tab（调 T0.6 overdue API，逾期条目高亮 + 逾期章数徽标）。
- **验收标准**：组件测试 + e2e 各一条；既有 e2e 复跑绿。
- **前置任务**：M1、T0.6（②需要）。

---

### 阶段 2：收口（全部任务完成后）

#### T2.1 E2E 行为锁扩充（QA 主导）
- 新链路全部补进 e2e（开场白/方案卡/进度/定稿闭环/逾期视图各至少一条），保持「红灯=真问题」。
- 验收：e2e 总数 ≥ 20 且全绿。

#### T2.2 全量回归 + A6 快照刷新（QA 主导）
- 固定 revision 跑完全部门禁（沿用 `deliverables/stable-admission-a6/` 的方法），重点：`nuxt:build` 首次绿、全量 0 失败；更新准入清单 A6 状态。

#### T2.3 文档收口（总设计师或 PM）
- `PROJECT-STATUS.md`：写作模式状态更新（定稿闭环/对话式链路落地）；README 叙事补「主编对话式创作」一节（与实际能力对齐——功能诊断断点 1 的教训）；`docs/standards/fork-seams.md` 登记新接缝；Journey 提案基线数字刷新。

## 5. 里程碑（含可验证完成判定）

| 里程碑 | 判定标准（全部满足才算达成） | 预计时点 |
|---|---|---|
| **M0 阶段 0 完成** | T0.1–T0.8 全部合入推送；每任务验收标准逐条通过（单测/typecheck 绿）；全量测试 0 failed | UI 线合入前后均可（不等它） |
| **M1 UI 线合入验收** | 第 3.2 节三条：工作区净 + 全量绿 + **12 条 e2e 复跑绿**（行为锁未断） | UI 线自定（非本计划控制） |
| **M1.5 依赖对齐达成** | `nuxt:build` EXIT=0 + 全量 0 failed + e2e 全绿 + product-start 绿（T1.0 四条） | M1 后独占窗口 |
| **M2 对话式链路贯通** | T1.1/T1.2/T1.3/T1.4 合入；新 e2e（开场白/进度/方案卡）绿；既有 12 条复跑绿 | 顺序执行完 |
| **M3 定稿闭环贯通** | T1.7 合入；全链 e2e（写→结算→定稿→审计→三处写入断言）绿 | M2 + T0 组就绪后 |
| **M4 项目收口** | T2.1–T2.3 完成：e2e ≥20 全绿 + A6 快照刷新（`nuxt:build` 首绿入档）+ 文档三件更新 | 全部完成后 |

## 6. 资源分配方案

| 执行者 | 阶段 0 | 阶段 1 | 阶段 2 |
|---|---|---|---|
| software-engineer | T0.1→T0.2→T0.3→T0.4→T0.5→T0.6→T0.7 顺序推进（同仓写代码不并行）；T1.0 独占窗口 | T1.1→T1.2→T1.3→T1.4→T1.7→T1.6→T1.8；T1.5 可拆第二工程师位并行（A/B 组文件零交集） | 支援 |
| software-product-manager | T0.8 文案包（与工程师完全并行，纯文档） | 话术微调支持 | T2.3 文案 |
| software-qa-engineer | 每任务验收复核（跑测试+看 diff） | 阶段 1 各任务验收 + 12 条 e2e 复跑把关 | T2.1/T2.2 主导 |
| 并行 UI 会话 | 视觉线收尾（不受本计划调度，按 3.2 判定衔接） | —（预期已合入） | — |

**资源冲突核心识别**：本线只有一个 engineer 主力，而阶段 0 有 7 个编码任务——已按依赖排序串行（T0.7 需要前置三个）。若要提速，可增派第二 engineer 只做 T0.4/T0.5/T0.6 这类「零依赖、零冲突面」的独立件（文件零交集，安全并行）。

## 7. 代码合并冲突预防与解决策略

### 7.1 AgentChatSurface 巨石（4670 行）——最大冲突源

**策略：严格串行 + 每步行为锁复跑。** T1.1→T1.2→T1.3 顺序执行，任何人不得并行改此文件；每任务完成后立即复跑 12 条 e2e（行为锁）才允许下一个开始。T1.3 同时承担拆分第一刀（新组件外挂，巨石只加挂载点）——**往「减行数」方向改，不内联新增**。

### 7.2 i18n 文件

按 3.4 追加规范；两线同日都改 i18n 时，后提交者先 `git pull --rebase` 解决（双方 key 保留）。

### 7.3 分支策略

**统一在 `feat/writing-doctrine-alignment` 顺序提交，不开并行分支**（合并成本 > 串行等待成本；本仓历史上并行分支出过 loose ref 丢失事故）。唯一例外：若某任务实验性大（如 T1.0 失败重试多轮），可开 `exp/` 前缀分支，验证通过后 cherry-pick 回主线。

### 7.4 提交纪律（沿用本线既有惯例）

- 只 `git add` 自己的文件（逐个列路径，禁 `git add -A`）
- 提交者身份 `git -c user.name=GTF2 -c user.email=GTF2@users.noreply.github.com`
- 不通过测试不提交；未验证部分在交付说明明说
- 推送：`GIT_TERMINAL_PROMPT=0 GCM_INTERACTIVE=never git push origin feat/writing-doctrine-alignment`，禁 force、禁推 upstream

## 8. 风险清单（识别依据 → 应对）

| # | 风险 | 识别依据 | 应对措施 |
|---|---|---|---|
| R1 | AgentChatSurface 多任务改动互相踩踏 | 4670 行 + T1.1/T1.2/T1.3 三任务 + 行动 12 都要动它 | 7.1 严格串行 + 行为锁复跑门槛 |
| R2 | UI 线合入时间不可控（M1 遥遥无期） | 工作区持续有在途改动、其剩余任务清单未清零 | 阶段 0 设计为零依赖（7 个后端任务全部不等 M1）；M1 等待期间产能不闲置 |
| R3 | i18n 双线追加冲突 | 两线都频繁加 key | 3.4 追加规范 + rebase 保留双方 |
| R4 | 并发写盘假红（.nuxt 重建 / Vite 重优化） | 本线已三次实测命中 | 3.3 测试互斥协议；重任务前查 mtime |
| R5 | 依赖对齐引发大面积升级回归 | bun.lock 与 node_modules 曾严重漂移；Vue 全家桶升级影响面广 | T1.0 独占窗口 + 四条验收硬指标 + 秒级回滚预案 |
| R6 | 确认疲劳掏空「人批准」实质 | UI 评估 4.2 风险 3（NovelCrafter 用户已现此症） | T1.3 卡片默认摘要级；不可逆操作强确认仪式（M5） |
| R7 | 真实模型行为与 mock 不符（结算表质量） | mock 不支持 tool_calls 已知；结算表是新协议 | T0.1 文本协议保 e2e 可测；首次真实使用人工抽查并回修 prompt |
| R8 | 锚点建议质量差导致补齐工程不可用 | 224 章人物识别依赖 lorebook aliases 完整度（存量项目可能不全） | T0.5 验收含「真稿副本抽查 20 章记录准确率」；低于阈值则先做 aliases 补全预处理再跑 |
| R9 | 阶段 0 协议改动（writer profile/skill）与真实会话不兼容 | profile 编译有 worker 链路，改文本协议可能影响既有会话 | T0.1 验收含 profile 契约测试；灰度：协议是「附加块」，旧会话不带结算块也能正常走（向后兼容设计） |

## 9. 总设计师代决记录（原需 GTF 决策，按授权直接定）

| # | 决策 | 选择 | 理由 |
|---|---|---|---|
| D1 | 结算表用 tool call 还是文本协议 | **文本协议** | mock e2e 可测 + writer 工具面不加新工具 + 向后兼容（R9） |
| D2 | 一致性审计维度规模 | **三源 v1**（承诺/状态/文本），不做 37 维大而全 | 先闭环后加密；维度表可持续扩充（宪法宽容度：宁少而准） |
| D3 | 行动 12 拆分与 H2 的关系 | **合并**：确认卡是拆分第一刀 | 避免巨石被两次大动；新组件外挂模式验证拆分路径 |
| D4 | 依赖对齐的执行方式 | **M1 后独占窗口专项** | 大面积升级需独占验证窗口；与功能改动混行无法归因 |
| D5 | 文风注入 | **不进本计划** | 宪法第五条未落宪（GTF 态度开放≠已授权）；先做指纹采集的只读分析工具可以后排 |
| D6 | 分支模型 | **同分支顺序提交** | 并行分支合并成本高 + 本仓有 ref 丢失前科 |
| D7 | 复杂度阶梯的自动切换强度 | **默认值智能切换 + 一次用户覆盖记忆** | 全自动切换会抢控制权（违背「人批准」精神），纯手动又违背极简愿景——折中 |

## 10. 接手指引（任何人从此开始）

1. **读本文档第 1、2 节**知道目标与现状 → 2. **查 `git log --oneline` 对照第 5 节里程碑**判断当前进度 → 3. **找到第一个未完成的任务卡片**（按阶段顺序）→ 4. **按卡片「输入」列读必读文件**（卡片自包含，但输入文件提供完整上下文）→ 5. **执行 → 跑验收标准里的命令 → 按 7.4 纪律提交** → 6. 在本文件末尾「执行台账」追加一行。

### 执行台账（每任务完成后追加）

| 日期 | 任务 | 执行者 | commit | 验收结果 | 备注 |
|---|---|---|---|---|---|
| 2026-09-17 | 计划定稿 | 总设计师 | `796cb4a3` 后本文件提交 | — | 两份调研输入就绪 |
| 2026-09-17 | T0.8 文案包 | software-product-manager | （见 git log 本条） | 55 条成稿；两处二选一总设计师代决（推倒重来/和 AI 聊） | PM 报告 shell 异常，纯文档任务未受影响 |
| 2026-09-17 | T0.1 结算表协议 | software-engineer | 01900a91 | 契约 4/4 + e2e 13/13（新 08 用例）+ typecheck 0；主理人独立复验 | 提交时 assets/workspace 需 git add -f（已知坑）；工作区另有 5 张过期证据 png（UI 线界面变化所致，未混入提交，待收口时统一重截） |
| 2026-09-17 | T0.2 定稿原子提交 | software-engineer | （本条 commit） | 单测 7/7 + plot 92/92 + e2e 13/13 + typecheck 0；主理人复验 7/7 | 自抓 writeSlice 先提交后返回 issues 的真 bug 并加变体锁；测试窗口内改源码的过程偏差已自查并干净重跑 |
| 2026-09-17 | T0.3 检索自动候选 | software-engineer | （本条 commit） | 工具 12/12 + 契约 17/17 + agent 全量 1522 + typecheck 0；主理人复验 | e2e 有 1 条资源型 flake（ERR_INSUFFICIENT_RESOURCES，单独重跑过，判 13/13 有效）；确认协议双通道供 T1.3 方案卡直接消费 |
