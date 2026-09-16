# HANDOFF：接手上手指南（给下一个 AI）

> 你是接手 NeuroBook 的 AI。本文件是**唯一入口**：先读完它，再按"必读顺序"读四份文档，即可开工。
> 作者（开发者）是编程小白，**用中文、结论先行、大白话**与他沟通；他的原话："这个项目的生死交给你，但有些我自己的想法。"

---

## 0. 一句话现状

NeuroBook 是本地优先的长篇小说写作 IDE（Bun + TS monorepo，主应用 Nuxt 4 + Nitro + Prisma/SQLite）。
所有者把项目决定权交给了 AI，同时立了一份**写作宪法**——它是**项目最高优先级 spec，可否决任何功能**。
你的工作方式：**宪法 > 用户的硬性约定 > 其它一切文档**。

**作者授权的边界**：AI 可以迭代流程，**不能定义什么叫"好"**；"好"只有作者能判。

---

## 1. 七条宪法信念（速览；原文见 `docs/doctrine/writing-doctrine.md`）

1. **AI 被枷锁固身**——写得差不是能力问题，是太自由（自由到永远选概率最大的路）。要的是"被正确约束的 AI"，不是更听话的 AI。
2. **大纲 ≠ 切片**——大纲是因果链（给人看），切片是此刻横截面（给 AI 看）。**2026-09-14 修正：禁止意图级因果链（结局/目标/意义），允许事实级细节（谁在场/发生什么/世界状态）。**
3. **关键帧写作**——人只写"不可逆状态变化"的帧（谁死/剑易主/誓破），帧间补间交给 AI 演化（图生视频：人定帧、模型补间）。
4. **能用 AI 实现的流程，让 AI 自己迭代**——但"好"由人定义。
5. **事后校验，不事前告知**——硬事实不塞进 writer 动笔前的嘴（塞了写出来是报告味）；写完拿世界引擎撞，只砍真撞错的。信息控制四字段 = 事后核对清单，不是前置输入。
6. **判断力在执行层**——大纲只是脚手架，正文可以反推推翻设定；**推翻必须留痕**（挂创作决策记录）。
7. **写作是套路与反套路的组合**——不神化灵感，管理 AI 的套路库（llmlint 黑名单 + 逼它别选最大概率路径）。

宪法有两轮"终审实验"证据（`docs/doctrine/contrast-experiment-2026-09-14.md`、`keyframe-experiment-2026-09-14.md`），作者判词已记录：
**① 事实切片优于事前告知（但两份都"读不下去"）；② 关键帧驱动可读性明显变强（通过）。**

---

## 2. 必读顺序（约 30 分钟）

| 顺序 | 文件 | 为什么 |
|---|---|---|
| 1 | `docs/doctrine/writing-doctrine.md` | 宪法本体（含提交 5aa34d0c 的第二条精确化） |
| 2 | `PROJECT-STATUS.md` | 现状 + 「写作宪法对齐」章节 + **已知未收口列表（现为第 1–7 条，第 7 条是终审实验脚本待重建）** |
| 3 | `docs/standards/fork-upstream-sync.md` | 我们是 fork（上游 notnotype/neuro-book），这是同步与防冲突规则 |
| 4 | `docs/standards/fork-seams.md` | **接缝登记表 S1–S22**：改上游文件前先查这里 |
| 5 | `docs/doctrine/prior-art-2026-09-14.md` | 外部调研：哪些轮子已有（别重复造）、采纳清单 |
| 6 | `AGENTS.md` 顶部「与开发者的硬性约定（7 条）」 | 协作铁律：先说一句然后直接做（约 5 成把握即推进）、一次一个功能、不通测试不提交、不改无关文件、能判断就别老问、只推 origin、大白话 |

---

## 3. 当前状态（2026-09-15）

- 分支：**`feat/writing-doctrine-alignment`**。截至 2026-09-15 18:35（**GTF 正式授权 Neo 接手项目**，授权范围：Leader 单核 + 按需起子代理；推送 origin、合并上游、真实模型调用三项已获授权）：HEAD `4a161254`（人写帧 UI）；**与 `origin` 完全同步（0 领先 / 0 落后）**，相对上游**领先 83 / 落后 0**（上游顶端 `45906272` / 0.10.3-canary）。接手后累计 5 个提交，全部已推送。
- Neo 本轮提交（2026-09-15）：`cd109f7b`（语言硬规则加固）、`ba7cd006`（合并上游 0.10.3-canary，解决 4 处冲突）。更早两条为 `ea77062b`（Workflow 只读数据查询 + `infoControl` 自动编译）、`53e270ca`（修 leader 资产过期断言），均已推 origin。工作区仍有并行执行者未提交的改动（**未动、未提交**，清单见下）；这批改动已有独立备份（见 §5「在途改动备份」）。
- 本文件曾在 2026-09-14 被并行执行者删除，作者已还原；同名 `CLAUDE.md` 已删且不再使用。看到 `D HANDOFF.md` 这类删除时先确认来源，不要当成自己的改动。
- ⚠️ **有多个 AI/工具在同一仓库并行提交**（例：`676af095`、`282bc90d`、`9ab4bc56`、`ee651716`、`1176a5fb` 都不是"我"提交的）。
  开工前先 `git log --oneline -15` 看有没有新东西；**绝不回退、覆盖来源不明的提交**；做完自己的事再提交；提交时**只 `git add` 自己的文件**，别用 `git add -A`。
- 提交者身份（本机没配全局 git 身份）：
  `git -c user.name=GTF2 -c user.email=GTF2@users.noreply.github.com commit ...`

### 并行在途清单（当前不可触碰）

与本人共用一个工作区、未提交、属并行执行者：`app/components/novel-ide/agent/{AgentChatSurface.vue,AgentComposer.vue,useAgentSession.ts}`、`app/composables/useAgentSessionApi.ts`、`app/i18n/locales/{en-US,zh-CN}.ts`、`server/agent/{events/public-queue-projection.ts,harness/neuro-agent-harness.ts,http.ts}`、`shared/dto/agent-session.dto.ts`；未跟踪的 `docs/specs/agent/session-followup-queue.md`、`agent/AgentFollowUpQueuePanel.{md,vue}`、`proposals/agent-followup-queue-delivery.md`、`server/api/agent/sessions/[sessionId]/followups/`；以及 `docs/proposals/README.md` 中仍未提交的两行（follow-up 队列、辅助任务模型）。

> 该文件曾与本人改动混在同一处：只提交自己那行时用的是「工作区内容减去对方几行 → `git add` → 再写回原内容」，使 index 只含自己的行。注意 PowerShell 里 `[System.IO.File]::WriteAllText` 用的是**进程 CWD** 而非 shell 的 `cd`，必须传绝对路径，且用 `New-Object System.Text.UTF8Encoding($false)` 避免写入 BOM。

### 已完成（不要重做）

1. **写作宪法** + 第二波修正 + 两轮实验证据（作者判词在案）。
2. **slice-only brief 模式**（模式枚举/DTO/HTTP/工具 schema 贯通）——**但只完成了一半，见 P0**。
3. **信息控制事后核对**：`chapter-write-review-revise` workflow 新增 `infoControl` 入参，只注入一致性评审、绝不下发 writer（有测试断言）。
4. **关键帧模型**（第三条落地）：Prisma `StoryKeyframe`（instant 锚 + irreversibleChanges + source author/derived + status pending/confirmed/violated/overthrown + decisionRefId 留痕）、迁移 SQL（`project-workspace.ts` 的 CREATE TABLE）、仓储/服务/facade（`keyframe.service.ts`）、REST（`handleKeyframes` 在 `server/api/projects/plot/[...segments].ts` L446，含 `keyframes/tween` 补间区间）、`keyframe-tween-review` workflow、skill `phases/05-keyframe-tween.md`。测试全绿。
5. **治理接线**：`docs/README.md` 真相源优先级新增第 0 级=宪法；`docs/specs/README.md` 规范缺口登记两个新 capability；`PROJECT-STATUS.md` 更新。
6. **fork 工程**：上游合并实测零冲突；`git rerere` 已启用；`docs/standards/fork-{upstream-sync,seams}.md` 成文。
7. **调研**：StoryForge / 章纲范式 / DOC 学术 / Swain 方法论（采纳清单见 prior-art 文档第五节）。
8. **brief 双视图改造（P0，2026-09-14 完成）**：`suggestedBriefMarkdown`（事实，唯一进 writer）与 `reviewChecklistMarkdown`（意图，只进评审）落地；三个模式统一只给事实、`needs_chapter_brief` 废止；agent 工具对 writer 调用收口 `details`（writer 拿不到任何意图级结构化数据）；`chapter-write-review-revise` 的 `brief` / `infoControl` 只注入评审、`chapterId` 变必填。Reference 与 skill 主链（`plot/{writer-brief,system,agent-spec}.md`、`agent/{leader-default,novel-writing-workflow}.md`、`world-engine/workflow.md` §6.2/6.3/13、`skills/novel-writing/phases/02|03`、`novel-writer-execution`）与用户文档 `vitepress/{zh-Hans,en-US}/{core/plot-workbench,profile/writer,profile/leader,tutorials/04}` 中英对等同步；Spec `docs/specs/plot/chapter-writer-brief.md` 晋升 `implemented`；Work 记录在 `.agents/works/w00014-chapter-writer-brief-two-views/`。
9. **关键帧 agent 工具面与主链接线（P0，2026-09-14 完成）**：`plot-tools.ts` 新增 `get_story_keyframe` / `get_tween_keyframes` / `save_story_keyframe`（写面 `action=create|update`；读面对 writer 白名单剔除 `note`）；新增 Reference `assets/reference/plot/keyframe.md` 并接入目录索引；`phases/05-keyframe-tween.md` 的「Plot API」改为真实工具名，`phases/03-chapter-loop.md` 前置检查与完成标准接帧；Spec `docs/specs/plot/keyframe.md` 晋升 `implemented`（P0 规范缺口闭合）；Work 记录在 `.agents/works/w00015-keyframe-agent-toolface/`；接缝登记 S18。
10. **信息控制漏传必定显形（2026-09-14）**：`chapter-write-review-revise` 在 `infoControl` 缺失时给一致性评审显式的「信息边界未核对」标注段、运行日志记警告、返回值新增 `infoControlChecked=false`；主链 skill 把 `infoControl` 改为每次必传并写清编译来源；Spec 与 `writer-brief.md` 契约同步；真自动编译登记为 P1 规范缺口。Work 记录在 `.agents/works/w00016-info-control-non-silent/`；接缝 S9 更新。
11. **文档杂项收口（2026-09-14）**：Swain 词汇统一（帧 / 场景张力槽位改用 `Goal/Conflict/Disaster`、`Reaction/Dilemma/Decision`，与 `outcomeType` 对齐；宪法与实验记录不动）；`agent/tools.md` 与 `core/world-engine.md` 中英补关键帧内容；`CONTRIBUTING{,.en}.md` 命令修正为 monorepo 用法；`PROJECT-STATUS` 版本行对齐 `RELEASE.md`。
12. **未来影响分析（StoryForge 机制一，2026-09-14 完成）**：正文采纳后由 leader 扫描「新事实 → 下游规划」的失效（Promise / Scene / 帧 / 期限），产出只标记、不改动的受影响清单交作者逐项裁决。新增 Reference `assets/reference/plot/future-impact-analysis.md`；主链 skill `phases/03-chapter-loop.md` 新增「第六步：未来影响分析」；Spec `docs/specs/plot/future-impact-analysis.md` 晋升 `implemented`；Work 记录在 `.agents/works/w00017-future-impact-analysis/`；接缝登记 S19。**形态修正**：不做 `impact-scan` workflow——workflow 内 `adhoc` 工具面固定 `read` + `report_result`，读不到 Plot 数据，故由持有 Plot 工具面的 leader 在 skill 阶段执行。
13. **canon 回读验证（StoryForge 机制二，2026-09-14 完成）**：拍板落库写入之后立刻回读 slice / Plot 实体 / lorebook，与确认意图逐条比对，产出验收回执（已落地 / 偏离 / 未落地）。新增 Reference `assets/reference/world-engine/canon-read-back.md`；`phases/02-canon-commit.md` 新增「回读验证」步骤、`phases/03-chapter-loop.md` 前置检查接回读；Spec `docs/specs/plot/canon-read-back.md`（implemented）；Work `w00018-canon-read-back`；接缝 S20。
14. **写回校验清单（StoryForge 机制三，2026-09-14 完成）**：把散落在四处以上的写回校验项收敛成声明式清单（项名 / 判据 / 失败动作 block·warn·record / 消费方），成为各消费方的单一索引入口。新增 Reference `assets/reference/plot/write-back-checks.md`；消费方只加指向不改语义；Spec `docs/specs/plot/write-back-checks.md`（implemented）；Work `w00019-write-back-checks`；接缝 S21。**至此 StoryForge 三机制（未来影响分析 / 回读验证+回执 / 写回校验注册表）全部完成。**
15. **Workflow 只读数据查询 + `infoControl` 自动编译（2026-09-15 完成，提交 `ea77062b`）**：宿主**首次装配** `ActivityExecutor`（装配点 `server/agent/workflow/workflow-demo-service.ts`），注册版本化只读查询 `plot.chapter-info-control@1`（输入 `{chapterId}` → 章节信息控制四字段）；`chapter-write-review-revise` 在 `infoControl` 缺省时按 `chapterId` 自动编译核对清单，**不再靠调用方手填**。新增模块 `server/agent/workflow/workflow-data-queries.ts`；Proposal `workflow-project-data-queries.md` 升 `accepted`；Spec `docs/specs/agent/workflow-data-queries.md`（**仍是 `planned`**，见待办）；Work `w00020-workflow-data-queries`；接缝 S22（S9 范围同步扩展）。**三条设计要点**：①返回值新增 `infoControlSource`（`auto`/`provided`/`missing`）而**不原地改**既有布尔 `infoControlChecked`——它已被 `w00016` 合同测试与主链 skill 消费，改语义属静默破坏；②**能力缺席 ≠ 查询失败**：宿主未装配执行器 / 未注册该引用（内核抛 `ActivityExecutorNotConfiguredError` / `ActivityDefinitionNotFoundError`）视为**部署状态**，退回 `w00016` 的漏传显形且 run 仍完成（否则测试 / demo 宿主跑不了同一份 workflow 资产）；查询本身失败（Project 未打开 / 章节不存在 / DB 错误）才 fail-closed，绝不把「查不到」说成「没问题」；③只读、无副作用，成功结果进 journal、重放命中返回原值不重读库——与 Temporal Activity / `sideEffect`、Restate `ctx.run` 同构，**复用内核既有语义而非另造**（内核 `runtime.ts` 命中 journal 时执行体完全不被调用）。显式传入 `infoControl` 始终优先，且此时**不发起查询**。
16. **修 leader 资产过期断言（2026-09-15，提交 `53e270ca`）**：`server/agent/profiles/leader-assets-profile.test.ts` 沿用 upstream 旧口径，断言 leader 默认 profile 含「`invoke_agent.message` 必须写清」。该口径已被本 fork 按宪法第二/五条**反转**——`assets/reference/agent/leader-default.md` 现要求 message「只写交付要求」，意图级内容不下发 writer（相对 upstream 仅 3 行增删）——**资产是对的，测试是过期的一侧**。断言改为锁住反转后的合同，并**额外**断言 `意图级内容不下发 writer`（否则单靠前半句，有人删掉宪法实质那句测试仍绿）。登记在接缝 S16。
17. **设置保存反馈 + 辅助任务模型收口（2026-09-15，提交 `1176a5fb`，22 文件 / +549 -23）**：两个交付面，**代码由本轮的并行执行者写，我（写本条的 AI）只做核对、补规范归属、登记与独立复验**。
   ①**辅助任务模型来源**：「AI 解释这一步」原先直接用会话 Profile 的模型（通常最贵），现在运行策略新增一组 `auxiliary.modelKey`——`null` = 跟随本 Profile 的模型（默认，与改动前完全一致），指定值不可用时**回退 Profile 模型并记 `agent.auxiliaryModel.fallback` 警告日志**（旁路小功能不该因一个失效 key 整体不可用）；四层继承沿用既有机制，与「自动摘要」同款写法。运行期入口：`explainToolCall` → 私有 `resolveAuxiliaryModel`。界面「辅助任务」组复用同页 `NovelIdeModelSelect`（候选与「默认模型」同源，消灭手填 key 打错），历史保存过但已不在清单中的 key 合成一条「不可运行 · key」选项。**顺带修真机缺陷**：`normalizeProfileRuntimeSettingsPatch` 此前只规范化 summarizer / compaction / fileChangeNotice，`auxiliary` 在读写配置时被静默丢弃（选完保存界面立刻回弹成「跟随」、配置文件里始终是 `{}`）；`mergeProfileRuntimePatches` 与 `resolveProfileRuntimeSettings` 本来就支持该分组，所以只补这一处。**默认值保持「跟随本 Profile」**（2026-09-15 开发者拍板，不写死厂商模型）。
   ②**保存反馈改造**：「Agent Profile 模型」面板保存成功后标题下方的绿色成功横幅**删除**，改为头部「保存设定」按钮三态（默认 / 有改动 accent / 保存成功绿底 +「已保存」2.4 秒回落）；`SettingsSavePanelExpose` 的 `justSaved` 是**可选字段**，其余 5 个面板不受影响；再次改动即时取消成功态；「重置主目录」提示改 `notification.success`。
   治理：新增 `planned` Spec [`docs/specs/agent/auxiliary-task-model.md`](docs/specs/agent/auxiliary-task-model.md)（辅助任务此前**完全没有规范归属**）并登记 `docs/specs/README.md`；Proposal `agent-auxiliary-task-model.md` 升 `accepted`；接缝登记 **S23**；Work `w00021-auxiliary-model-and-save-feedback` / Task `t01`。
   验证：**在临时 worktree 里只放本批子集**（`bun install` + `nuxt:prepare` + `generate`）跑 `server/config` + `app/components/novel-ide/settings`，**13 文件 / 127 条全通过、typecheck 退出码 0**；完整工作区另跑 14 文件 / 144 条全通过；`docs:check` 5515 文件 0 失败、`governance:check` 通过。子集纯度核对：worktree 内 harness 的 `followUp` 计数与 HEAD 一致（93），已暂存的 i18n 里 `followUpQueue` 出现 0 次。真机证据是上一轮留下的 `out/settings-saved-flash.png`（**本收尾轮只复核、未复跑探针**）。
   **未验证**：真实 Provider 下「解释这一步」是否真用指定模型；回退分支只有代码路径与日志点、**无合同测试**（→ 待办表有对应晋升条件）。**未推送** `origin`。
18. **基线收口（2026-09-15，Neo 接手项目后的第一刀）**：三件事。
   ①**语言硬规则落地提交**（`cd109f7b`，3 文件 / +17 -1）：上一轮改的三处入口（`AGENTS.md` 文首块、`.omp/RULES.md` 第 1 条、`.agents/AGENTS.md` 加载首位）当时只跑了门禁、没提交，现补提；`governance:check` → `failures: []`，`docs:check` → 5515 文件 0 失败。
   ②**合并上游**（`ba7cd006`，落后 11 → **追平**）：4 个文件冲突，逐处按语义解决——`source-runtime.ts` 与 `agent-jobs-wiring.test.ts` 取上游（上游 `392faaa3` 独立修了同一问题「应用不得跨根 import 根 #scripts」，且 fail closed 比 fork 的按包位回退更严格，**S13 接缝归零**）；`useInlineEditorAgentController.ts` 取上游（`#235` 把行内 AI 所有权从 Surface 实例搬到 Inline controller，从根上取代了 fork 的 `inlineOperationScopeOf` 补丁）；`index.vue` 结构取上游、**保留 fork 的可见反馈**（新登记 **S24**）。合并前把未提交改动 stash 收好、合并后原样 pop，**全程零冲突**。
   ③**验证**：`app/composables` 8 文件 / 47 条、`app/components/novel-ide/agent` 29 文件 / 317 条、server 基线 38 文件 / 275 条，**全绿**；`packages/neuro-book` typecheck 无本次引入的错误。
   **未收口**：typecheck 仍有 7 处错误（6 处 `DesktopTitleBar.vue` 键盘导航真 bug + 1 处队列功能在途代码），**均非本次合并引入**，见待办表。
19. **接手后的第二轮：bug 修复 + 两个 Spec 晋升 + 人写帧 UI（2026-09-15，Neo）**：GTF 说「按你说的做」后连做四项，`f7ac415c` / `fc6e4c72` / `d2047671` / `4a161254` 四个提交全部已推 origin。
   ①**修 `DesktopTitleBar.vue` 键盘导航**（`f7ac415c`，4 行）：`d5b225dc` 把 `menus` 由常量数组改为 `computed`，但 `menuButtonKeydown` / `menuItemKeydown` 里 4 处仍按数组访问 `menus.length` / `menus[index]`；`<script setup>` 中 computed 不自动解包 → `NaN` 与 `undefined`，**桌面标题栏菜单的左右方向键导航实际是坏的**。改 `menus.value.*`；该文件 6 处 TS2339 归零，`test:desktop-contract` 16 文件 / 61 条全绿。
   ②**`agent.workflow-data-queries` 晋升 `implemented`**（`fc6e4c72`）：新增 `server/agent/workflow/workflow-data-queries.integration.test.ts`——真开 Project + 真 SQLite、**不 mock** project-session 与 plot（与既有合同测试互补），两个用例覆盖「部分字段读取 + 未填归一化为 null」与「章节不存在 fail-closed」。Spec 补齐 owner / 公开接口 / 稳定入口 / journal 重放边界 / 失败语义；README 三处同步。
   ③**`agent.auxiliary-task-model` 晋升 `implemented`**（`d2047671`）：补 3 条回退合同测试（断言落在「下游实际收到的模型」、resolver 调用序列 `[{modelKey},{modelKey:null}]` 与 `agent.auxiliaryModel.fallback` 日志三要素）+ **真实 Provider 端到端观测**（新增 `scripts/smoke/real-model/auxiliary-model.test.ts`，包装 `globalThis.fetch` 记录后透传真发请求）：实验组 `auxiliary.modelKey=openrouter/claude-opus-4-6` → 请求打到 `kapibala.asia`；对照组未配置 → 打到 `api.deepseek.com`，模型归属可见。**顺带发现**：既有 smoke helper `createAgentSmokeHarness` 注入的 `modelResolver: () => setup.model` 会忽略 modelKey override，用它做实验组必然退化成 Profile 模型 → 该用例改为直接构造 `NeuroAgentHarness`。
   ④**人写帧 UI 入口**（`4a161254`）：宪法第三条此前只有 agent 工具面，`app/` 无界面入口。新增 `app/components/novel-ide/plot/keyframe/`（logic / api / LedgerTab / EditorDialog + 26 条纯逻辑单测），剧本工作台加第 4 个 tab「关键帧」。**instant 显示取原始数字**（不为显示新造后端接口）：依据是日历格式化只在服务端且需动态 import 项目自己的 `world-engine/calendar.ts`、World Engine HTTP 面只把时间当入参（无反向出口）、`StoryKeyframeDto` 不含格式化字段——Scene 那边的 `startTime` 是服务端另行补的，帧这条路径后端没补。**浏览器人工验证未做**。
   验证：`app/components/novel-ide` + `app/stores` 43 文件 / 413 条、`server/agent/workflow` 16 文件 / 67 条、`neuro-agent-harness` 3 文件 / 237 条、`server/config` + settings 13 文件 / 127 条 —— 全绿；`governance:check` → `failures: []`、`docs:check` → 5524 文件 0 失败；typecheck 仅剩 1 处错误（他人未提交的在途 follow-up 队列代码）。
   **i18n 部分暂存（本轮首次用到，值得记）**：两个 i18n 文件里既有他人未提交的 41 行、又有本次的 68 行。做法：读工作区文件 → 按 hunk 行号删掉他人那 41 行 → `git hash-object -w` 得 blob → `git update-index --cacheinfo 100644,<sha>,<path>`，使 **index 只含本次改动而工作区文件不动**；提交后 `git status` 仍显示该文件 modified（他人的改动还在），已核对无损。比 `git apply --cached` 分段补丁更省事（不必处理 hunk 行号漂移）。
20. **follow-up 队列在途工作收编（2026-09-16，提交 `67d8cf18`，已推 origin）**：GTF 拍板「收编」后一轮完成。定性结论先行：那批放了近两天的在途改动**不是野代码**——提案 `agent-followup-queue-delivery.md` 里有 GTF 本人 2026-09-14 的拍板记录（主方案 +「停止不清队列」决策），实现质量高（+470 行全加法、串行化边界、错误合同齐全），缺口只有三处：①真 bug ②零测试 ③文档状态尾巴。本轮：①修 `AgentChatSurface.vue` 「全部忽略」二次确认 `confirm()` 参数顺序（传了 `{title,message}` 对象、合同是 `message,title`，修复前弹窗正文显示 `[object Object]`）；②补 6 条 harness 合同测试（送达置顶与真实投递 / 不存在项 404 / 忽略保留暂停原因且绝不投递 / completed 收尾自动重试与进度公开 / 3 次重试上限 exhausted / 用户停止不自动重试+显式恢复）+ 1 条投影测试（`source` 白名单映射、内部标识不外泄）；③Spec `session-followup-queue.md` 晋升 `implemented` 并补实现合同，**测试发现一处 Spec 漏写的合同并已补**：投递的消息 durable 写入会话后即按已送达 ack，模型运行失败不重放该消息（失败的是运行不是投递）；`docs/specs/README.md` 注册表同步、`docs/proposals/README.md` 两行状态与本体对齐。验证：harness 204/204、projection 3/3、typecheck 0 错误、governance `failures: []`、docs:check 5529 文件 0 失败。**未验证**：队列条 UI 的浏览器人工 smoke（真实会话里走一遍暂停→送达→忽略路径）。测试编写时踩过的坑值得记：`followup` 入队要求 active invocation 存在，用例必须用 deferred 门闩挂住 provider 再入队（照抄 `模型错误后暂停 followUp queue` 用例的模式），否则全文件跑时撞时序空窗报 `active_invocation_required`。
21. **运行期可见性验证（2026-09-16，GTF 发话后执行）**：停掉旧实例 → 重启 dev server（10 秒就绪，无租约冲突、无报错；顺带证明收编 `67d8cf18` 后的代码真实启动正常）→ `POST /api/projects/open` 200 → 逐项核对：①`/api/agent/workflow/catalog` 列出 `keyframe-tween-review`（中文标题「关键帧补间-回撞」、whenToUse 与参数齐全，`source: install`）；②State Root 资产根（`%LOCALAPPDATA%\NeuroBook\data\workspace\.nbook\`）实测存在 `reference\plot\keyframe.md`（3420 字节，**内容含三个工具名** `get_story_keyframe` / `get_tween_keyframes` / `save_story_keyframe`，即 agent 运行时读到的 Reference 就是带工具清单的版本）与 `agent\skills\novel-writing\phases\05-keyframe-tween.md`，启动日志 `synced user assets: skipped 94`（全部最新）；③三个工具为代码注册（harness plot 工具面），服务正常启动 + plot-tools 测试绿即生效，无独立缓存。**边界**：本验证到「资产与注册在运行实例生效」为止；工具在真实会话里被 agent 实际调用的观测，留待真实模型尺度验证时顺带确认（需 Provider 授权）。

### 进行中 / 待办（2026-09-15 重排：只留未完成项，按优先级；已完成见上）

| 优先级 | 任务 | 说明 |
|---|---|---|
| ~~P1~~ | ~~人写帧入口（UI）· 两个 Spec 晋升~~ **均已完成（2026-09-15）** | 见已完成第 19 条：关键帧面板（剧本工作台第 4 个 tab，`app/components/novel-ide/plot/keyframe/`）；`agent.workflow-data-queries` 与 `agent.auxiliary-task-model` 两个 Spec 均晋升 `implemented` |
| **P1** | **关键帧面板的浏览器人工验证** | 面板已实现并通过 43 文件 / 413 条测试，但 tab 切换、新建/编辑对话框与实际渲染**未经人眼确认**（dev server 在本环境会被宿主回收，未起）。GTF 在自己的终端跑 `cd packages/neuro-book && bun run dev`（用 `127.0.0.1:3000`），点「剧情 → 剧本工作台 → 关键帧」看一眼即可 |
| P1 | 真实模型尺度验证 | 帧驱动在整章 / 整卷尺度的表现、裁决闭环（改正文 vs 推翻帧 + `decisionRefId`）实操；需先造帧素材（跑完清理），已获作者概括授权 |
| ~~P2~~ | ~~运行期可见性验证~~ **已完成（2026-09-16）** | 见已完成第 21 条：重启后 workflow catalog 含 `keyframe-tween-review`、State Root 里 Reference/skill phase 就位且 Reference 含三个工具名；真实会话调用观测并入真实模型尺度验证 |
| ~~P2~~ | ~~合并上游（例行）~~ **已完成（2026-09-15）** | 见已完成第 18 条。当前与上游**追平**（领先 77 / 落后 0，上游顶端 `45906272` / 0.10.3-canary） |
| ~~P1~~ | ~~推 origin~~ **已完成（2026-09-15）** | 已推送 14 条到 `origin/feat/writing-doctrine-alignment`（`7791f828..5bcdc5c8`），当前 0 领先 / 0 落后 |
| ~~P1~~ | ~~修 `DesktopTitleBar.vue` 键盘导航~~ **已完成（2026-09-15）** | 见已完成第 19 条 ①。4 处改 `menus.value.*`，该文件 6 处 TS2339 归零；`test:desktop-contract` 16 文件 / 61 条全绿 |
| P2 | ~~队列功能收口~~ **已完成（2026-09-16，提交 `67d8cf18`）** | 见已完成第 20 条：收编 + 修 confirm bug + 7 条合同测试 + Spec 晋升 implemented；剩队列条 UI 浏览器人工 smoke |
| P2 | ~~`docs/proposals/README.md` 补登记行~~ **已完成（2026-09-16）** | 随 `67d8cf18` 一并落地，两行状态已与提案本体对齐（均 accepted） |
| P2 | 只读查询面扩展（可选） | 当前只注册 1 个查询引用 `plot.chapter-info-control@1`；新增消费者 = 新增引用（名字带显式版本后缀），不改既有引用的参数与结果形状 |

---

## 4. 铁律（违反会制造无法解决的冲突）

1. **上游领地永不删除**（清单见 `fork-seams.md`）：`desktop/tauri`、`nb-memory`、`nb-ui`、`rp.*`/`simulator.*`/`director` profiles、`RP模式` skill、legacy tasks、已判定死代码的脚本——**只记录、不删除**（删除会产生 modify/delete 冲突，是唯一难解的冲突类型）。
2. **加法优先**：新能力 = 新文件。改上游共享文件只做**外科手术**（枚举加一项、表加一行），不重排、不改名、不格式化。
3. **新接缝必须登记**进 `docs/standards/fork-seams.md`。
4. 修改 `docs/`、`.agents/`、`AGENTS.md` 要**主动通知**开发者（不必等回复）。
5. **宪法修改需所有者批准** + 附对照实验证据。
6. 合并上游：开工前 `git fetch upstream && git merge upstream/master`；合并后跑 `bun run docs:check`。
7. **不通测试不提交**；提交消息说明改了什么、验证了什么。

---

## 5. 本机环境怪癖（不照做会寸步难行）

| 事项 | 做法 |
|---|---|
| **PATH 里没有 node** | 测试命令：在 `packages/neuro-book` 下运行 `& "$env:USERPROFILE\.workbuddy\binaries\node\versions\22.22.2-3\node.exe" ..\..\node_modules\vitest\vitest.mjs run <过滤词>` |
| 工具超时 10 秒 | 大套件用 `Start-Process ... -RedirectStandardOutput <log> -NoNewWindow` 后台跑，再轮询读日志 |
| vitest 过滤词 | 用子串（`segments`、`server/plot`）；**不要**用带 `[...]` 的路径（方括号会被当通配）；**不要用 `cmd /c` 包装**（会解析失败） |
| git 身份 | 每次提交加 `-c user.name=GTF2 -c user.email=GTF2@users.noreply.github.com` |
| 提交消息 | 多行/含斜杠括号时 PowerShell `-m` 会解析失败 → 写文件后 `git commit -F <文件>` |
| `.gitignore` 误伤 | `packages/neuro-book/.gitignore` 的 `workspace/` 规则会忽略 `assets/workspace/**` 的**新文件** → 新增 .nbook 资产要 `git add -f` |
| dev server | **GTF 的启动入口是 `.local/run-dev.cmd`**（`.local/` 被 gitignore，仅 README 例外）。2026-09-15 修：该脚本第 3 行曾硬编码老工作区 `C:\Users\Administrator\CodeBuddy\NeuroBook\neuro-book`，**双击它启动的一直是那份旧代码**——这正是「3000 端口在跑旧代码」的根因（已改为 `D:\MyProject\neuro-book`，并加了两句防混提示与 `echo Source root:`）。手起：`cd packages/neuro-book; bun run dev`（端口 3000）。**两个实例不能并存**：共享 State Root，第二个会因 `runtime.lease` 租约冲突启动失败（`ELOCKED: Lock file is already being held`），必须先停老的。**判断实例归属别用 `/api/app/version`**（两份工作区的 versionLabel 完全相同）——看首页 HTML 里的 `/_nuxt/@fs/<源码根>`，或直接拉运行时模块 `GET /_nuxt/@fs/<abs>/.../PlotWorkbenchDialog.vue` grep 标识符，这是「跑的到底是不是我改的代码」最快的证据。项目会话会因 UI 关闭变 409 `PROJECT_NOT_OPEN` → `POST /api/projects/open {projectRoot}` 重开 |
| 门禁 | `bun run docs:check`（文档，~50s）、`bun run governance:check`（治理）、`bun run typecheck`（~90s） |
| 真实模型实验 | `bun run smoke:contrast -- --project <root> --chapter-id <id>`（需 Provider 已配置、项目已 open；单轮写+评审约 13–20 分钟） |
| 残留 | `.git/COMMIT_MSG_FORK_RESEARCH.txt` 是此前提交消息的临时文件，可留可删 |
| 应用与 State Root（2026-09-14 实测） | 应用跑在 `http://127.0.0.1:3000`（`/` 返回 200，版本 `v0.10.2-canary.20260908.091411Z`）；State Root = `C:\Users\Administrator\AppData\Local\NeuroBook\data`，项目在 `…\data\workspace\xin-xiao-shuo`（224 章 / 294 场景 / 9 线索；`StoryKeyframe`、`StoryDecision` 为 0 条） |
| `localhost` 解析坑 | Windows 上 `localhost` 常解析到 `::1`，而应用只监听 IPv4 → 探活与脚本会超时。**一律用 `127.0.0.1`** |
| 文本搜索看不见点号目录 / 被 gitignore 的目录 | 搜索工具对 `.nbook`、`.agents` 返回 0 条 ≠ 不存在；`packages/neuro-book/assets/workspace` 被 `.gitignore` 排除**但其中很多文件是 tracked 的**，凡按 `.gitignore` 过滤的搜索（含 IDE）会整棵跳过它。**对策：搜仓库一律 `git grep --no-index -n "<pattern>"`**，或列目录 / 直接读文件确认。（2026-09-15 曾因此把「资产里实际不存在」错当成依据） |
| 在会话里跑测试 | 不想找 node 路径时可用 bun：`bun run --cwd "…/neuro-book/packages/neuro-book" test -- <过滤词>`（本机实测可用，bun 1.4.2） |
| PowerShell 传 JS 给 bun | `bun -e "…"` 会被吞引号 → 写成临时 `.mjs` 再 `bun <文件>`，用完删除 |
| **暂存区纪律** | 别在暂存区留东西：同仓别的 AI 一条 `git commit` 就可能把你的暂存内容一起带走。**「暂存 + 提交」一把做完**；`git add` 只点自己的文件，永不 `git add -A` |
| 部分暂存（共享文件只有自己那几段要提交） | `git diff --output=<文件> -- <路径>` 取原始补丁 → 用 `[System.IO.File]::ReadAllText/WriteAllText`（UTF-8 **无 BOM**）按 `@@` 分段过滤 → 写回时**末尾必须补一个换行**（少了 `git apply` 会报 `corrupt patch`）→ `git apply --cached`。纯度核对用 `git diff --cached --numstat`（本机实测 harness +29/-1、两份 i18n 各 +5/-2） |
| 独立 worktree 做子集验证 | 只 `bun install` 不够：还要 `bun run --cwd packages/neuro-book nuxt:prepare`（生成 `.nuxt/tsconfig*`，否则 vitest 报 `Tsconfig not found`）和 `bun run --cwd packages/neuro-book generate`（生成 `server/generated/prisma`，否则类型检查报 `Cannot find module 'nbook/server/generated/prisma/client'`）。临时目录放 `.worktree/`（被 `.gitignore` 忽略）；`bun install` 首次约 200s |
| 删除目录 | 用**普通绝对路径** + `-Recurse -Force`（宿主的安全删除会走回收站，`\\?\` 长路径前缀会被它拒绝：`relative path rejected`）；Git 自己删含 `node_modules` 的目录会报 `Filename too long`，所以用 PowerShell 删、删完再 `git worktree prune` |
| **提交能力（2026-09-15 实测更正）** | **本环境可以正常 `git commit`。** 实测：`commit --allow-empty` 成功（`7791f828` → `31290b33`）、`git update-ref refs/heads/feat/writing-doctrine-alignment <sha>` 回退干净、未提交文件无损；`git update-ref refs/heads/__probe__ HEAD` 创建引用再删除也成功。**上一轮记的「本沙箱不能移动分支引用、不要在此环境 commit」是沙箱开启时的假阳性，已作废。** 提交一律 `git -c user.name=GTF2 -c user.email=GTF2@users.noreply.github.com commit -F <消息文件>`（本轮 `cd109f7b`、`ba7cd006` 均如此落地）；提交消息写文件再传，别用 `-m` |
| **在途改动备份** | `.workbuddy/backups/2026-09-15-followup-inflight/`：`all-uncommitted.patch`（合并上游前的全部未提交差异）+ `untracked.tar.gz`（5 个未跟踪项）。合并流程为 **stash → merge → pop**（`git stash push -u`），全程零冲突；该备份仍保留作兜底 |
| **推送 origin 必须禁交互（实测）** | 裸 `git push` 在 Agent 环境会**卡死**：本机 `credential.helper` 是 git-credential-manager，未禁交互时它要弹窗，非交互环境直接挂住（实测卡满 3 分钟、零输出、被后台化）。**正确写法**：`GIT_TERMINAL_PROMPT=0 GCM_INTERACTIVE=never git push origin <branch>`——此时 GCM 改用已存凭据，实测成功。诊断同类问题的通用手法：加 `GIT_TERMINAL_PROMPT=0` 让它立即失败并报原因，而不是挂住 |
| **合并上游的稳妥流程（2026-09-15 实测）** | ① 先 `git status` 看清哪些改动是自己的、哪些是别人的；② 只把**自己的**文件单独提交（`git add` 点名，永不 `-A`）；③ `git stash push -u -m "<说明>"` 收好其余改动；④ `git fetch upstream && git merge upstream/master --no-edit`；⑤ 冲突逐处按语义解决（两侧独立修同一问题**优先取上游**，fork 独有的改进要**融合保留**）；⑥ 跑 typecheck + 受影响测试；⑦ 提交后 `git stash pop` 原样恢复 |

---

## 6. 关键文件地图

| 主题 | 路径 |
|---|---|
| 宪法 / 实验证据 / 外部调研 | `docs/doctrine/writing-doctrine.md`、`contrast-experiment-2026-09-14.md`、`keyframe-experiment-2026-09-14.md`、`prior-art-2026-09-14.md` |
| fork 规则 / 接缝登记 | `docs/standards/fork-upstream-sync.md`、`fork-seams.md` |
| 现状与缺口 | `PROJECT-STATUS.md`（「写作宪法对齐」+ 已知未收口 0–6 条） |
| brief 核心 | `packages/neuro-book/server/plot/services/chapter-writer-brief.service.ts`（`renderWriterBriefMarkdown` / `renderReviewChecklistMarkdown`；`chooseStatus` 已无信息控制门槛） |
| brief 格式契约 | `packages/neuro-book/assets/reference/plot/writer-brief.md` |
| brief 双视图 Spec / Work | `docs/specs/plot/chapter-writer-brief.md`（implemented）、`.agents/works/w00014-chapter-writer-brief-two-views/` |
| 关键帧核心 | `server/plot/services/keyframe.service.ts`、`repositories/prisma-keyframe.repository.ts`、`api/projects/plot/[...segments].ts`（`handleKeyframes` L446） |
| 关键帧 schema | `prisma/project.schema.prisma`（StoryKeyframe）+ `server/workspace-files/project-workspace.ts`（迁移 SQL） |
| 关键帧工具 / Reference / Spec / Work | `server/agent/tools/plot-tools.ts`（`get_story_keyframe` / `get_tween_keyframes` / `save_story_keyframe`）、`assets/reference/plot/keyframe.md`、`docs/specs/plot/keyframe.md`（implemented）、`.agents/works/w00015-keyframe-agent-toolface/` |
| 评审核对单 | `assets/workspace/.nbook/agent/workflows/chapter-write-review-revise/workflow.ts`（`infoControl` 参数，只进一致性评审；缺省时经宿主只读查询自动编译） |
| Workflow 只读查询（宿主） | `server/agent/workflow/workflow-data-queries.ts`（查询注册 + 装配工厂）、`server/agent/workflow/workflow-demo-service.ts`（**装配点**：`WorkflowRunner` **第三参** `options.activities`） |
| 只读查询 Spec / Work / Proposal | `docs/specs/agent/workflow-data-queries.md`（planned）、`.agents/works/w00020-workflow-data-queries/`、`packages/neuro-book/docs/proposals/workflow-project-data-queries.md`（accepted） |
| 补间 workflow | `assets/workspace/.nbook/agent/workflows/keyframe-tween-review/workflow.ts` |
| 写作 skill | `assets/workspace/.nbook/agent/skills/novel-writing/`（SKILL.md、phases/02-canon-commit.md、03-chapter-loop.md、**05-keyframe-tween.md 是正确范式模板**） |
| 实验脚本 / workflow | `packages/neuro-book/scripts/smoke/slice-vs-told-contrast.ts`、`assets/workspace/.nbook/agent/workflows/contrast-write-review/workflow.ts`（实验专用，不接入主链） |
| 上游契约 | `docs/specs/agent/asset-install-runtime.md`（三层覆盖 Seed→Install→Project + dirty fail-closed = 插件层保护） |

---

## 7. 与开发者的沟通方式

- 中文、结论先行、大白话；报错给"错误是什么、原因、打算怎么修"。
- 只把**改变产品结果/范围/权限/不可逆后果**的问题交给他，附选项与各自影响；低风险细节自行决定并简短说明。
- 他关心的事（按频率）：**不要闭门造车**（先查外部实践/GitHub）、**不要与上游冲突**（fork 要能长期同步）、**别让 AI 夺走导演权**（不可逆的东西只能人定）。
- 他的原话可作判据："AI 可以迭代流程，不能定义什么叫好。" "市场都在做更听话的 AI，我要做被正确约束的 AI。"

---

## 8. 建议的第一步

brief 双视图（[Spec](docs/specs/plot/chapter-writer-brief.md)、[Work](.agents/works/w00014-chapter-writer-brief-two-views/)）与关键帧工具面（[Spec](docs/specs/plot/keyframe.md)、[Work](.agents/works/w00015-keyframe-agent-toolface/)）均已于 2026-09-14 完成。建议按下面顺序继续（开工前先向开发者复述方案与影响面）：

1. **人写帧入口（P1）**：`app/` 还没有关键帧面板——宪法第三条要求"人写帧"，目前只有工具面与 CLI 路径。UI 属并行执行者的活跃区，动手前先与其边界对齐。
2. **`agent.workflow-data-queries` 晋升 `implemented`（P1）**：`infoControl` 真自动编译已落地（见 §3 已完成第 15 条）；只差给真实 Project 数据库路径补一个集成测试，即可把 `planned` Spec 原地晋升。
3. **帧驱动的尺度验证（P1，需 Provider 授权）**：两轮终审实验已完成（判词见 `docs/doctrine/`），仍缺整章 / 整卷尺度的帧驱动表现与裁决闭环实操。
4. **合并上游（P2，例行）**：已落后 11 提交（上游 `45906272` / 0.10.3-canary），等并行执行者的未提交改动落定后合并。

真实模型对照实验入口仍是 `bun run smoke:contrast -- --project <项目> --chapter-id <章 id>`（需 Provider 已配置、项目已 open；注意用 `127.0.0.1`）。
