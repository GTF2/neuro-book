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
| 4 | `docs/standards/fork-seams.md` | **接缝登记表 S1–S18**：改上游文件前先查这里 |
| 5 | `docs/doctrine/prior-art-2026-09-14.md` | 外部调研：哪些轮子已有（别重复造）、采纳清单 |
| 6 | `AGENTS.md` 顶部「与开发者的硬性约定（7 条）」 | 协作铁律：先说一句然后直接做（约 5 成把握即推进）、一次一个功能、不通测试不提交、不改无关文件、能判断就别老问、只推 origin、大白话 |

---

## 3. 当前状态（2026-09-14）

- 分支：**`feat/writing-doctrine-alignment`**。截至 2026-09-14，本地与 `origin` **已同步**（HEAD `07c83a9b`）；领先上游 70 提交、**落后 11**（上游已到 `45906272` / 0.10.3-canary）。工作区有并行执行者未提交的 Agent follow-up 队列 / settings 改动（未动、未提交）。
- 本文件曾在 2026-09-14 被并行执行者删除，作者已还原；同名 `CLAUDE.md` 已删且不再使用。看到 `D HANDOFF.md` 这类删除时先确认来源，不要当成自己的改动。
- ⚠️ **有多个 AI/工具在同一仓库并行提交**（例：`676af095`、`282bc90d`、`9ab4bc56`、`ee651716` 都不是"我"提交的）。
  开工前先 `git log --oneline -15` 看有没有新东西；**绝不回退、覆盖来源不明的提交**；做完自己的事再提交。
- 提交者身份（本机没配全局 git 身份）：
  `git -c user.name=GTF2 -c user.email=GTF2@users.noreply.github.com commit ...`

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

12. **未来影响分析（StoryForge 机制一，2026-09-14 完成）**：正文采纳后由 leader 扫描「新事实 → 下游规划」的失效（Promise / Scene / 帧 / 期限），产出只标记、不改动的受影响清单交作者逐项裁决。新增 Reference `assets/reference/plot/future-impact-analysis.md`；主链 skill `phases/03-chapter-loop.md` 新增「第六步：未来影响分析」；Spec `docs/specs/plot/future-impact-analysis.md` 晋升 `implemented`；Work 记录在 `.agents/works/w00017-future-impact-analysis/`；接缝登记 S19。**形态修正**：不做 `impact-scan` workflow——workflow 内 `adhoc` 工具面固定 `read` + `report_result`，读不到 Plot 数据，故由持有 Plot 工具面的 leader 在 skill 阶段执行。
13. **canon 回读验证（StoryForge 机制二，2026-09-14 完成）**：拍板落库写入之后立刻回读 slice / Plot 实体 / lorebook，与确认意图逐条比对，产出验收回执（已落地 / 偏离 / 未落地）。新增 Reference `assets/reference/world-engine/canon-read-back.md`；`phases/02-canon-commit.md` 新增「回读验证」步骤、`phases/03-chapter-loop.md` 前置检查接回读；Spec `docs/specs/plot/canon-read-back.md`（implemented）；Work `w00018-canon-read-back`；接缝 S20。
14. **写回校验清单（StoryForge 机制三，2026-09-14 完成）**：把散落在四处以上的写回校验项收敛成声明式清单（项名 / 判据 / 失败动作 block·warn·record / 消费方），成为各消费方的单一索引入口。新增 Reference `assets/reference/plot/write-back-checks.md`；消费方只加指向不改语义；Spec `docs/specs/plot/write-back-checks.md`（implemented）；Work `w00019-write-back-checks`；接缝 S21。**至此 StoryForge 三机制（未来影响分析 / 回读验证+回执 / 写回校验注册表）全部完成。**

### 进行中 / 待办（2026-09-14 重排：只留未完成项，按优先级；已完成见上）

| 优先级 | 任务 | 说明 |
|---|---|---|
| **P1** | 人写帧入口（UI） | `app/` 没有关键帧面板（宪法第三条要求人写帧）；agent 侧工具面已可支撑对话 / 脚本路径。**等 UI 执行者回一句**：帧的 `instant` 显示走 (a) 原始数字，还是 (b) 我补「instant ↔ 项目日历时间」转换接口；选 (b) 我做后端那半 |
| **P1** | `infoControl` 真自动编译 | **Proposal 已出**：[`workflow-project-data-queries.md`](packages/neuro-book/docs/proposals/workflow-project-data-queries.md)（`draft`；复用已接受提案 `agent-model-execution-surfaces.md` 的 `ActivityExecutor` 计划，只加只读数据查询）。接受后落 planned Spec + Work/Task |
| P1 | 真实模型尺度验证 | 帧驱动在整章 / 整卷尺度的表现、裁决闭环（改正文 vs 推翻帧 + `decisionRefId`）实操；需先造帧素材（跑完清理），已获作者概括授权 |
| P2 | 运行期可见性验证 | 重启 dev server 后确认 3 个关键帧工具 + 新 Reference + 新 workflow 文本在运行的应用里生效；**作者暂不希望被打断**，等他一句话 |
| P2 | 合并上游（例行） | 2026-09-14 实测：领先上游 70 / **落后 11**（上游已到 `45906272` / 0.10.3-canary）；并行执行者有未提交改动，现在合并风险高，等其落定后再 `git fetch upstream && git merge upstream/master` 并跑 `docs:check` |
| P2 | 补 proposals 注册表行 | `docs/proposals/README.md` 里本轮加的两行（未来影响分析、workflow 只读数据查询）仍留在工作区未提交（该文件同时有并行执行者的未提交行，不替他提交）；等该文件空闲后补一个单行提交 |

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
| dev server | `cd packages/neuro-book; bun run dev`（端口 3000）。项目会话会因 UI 关闭变 409 `PROJECT_NOT_OPEN` → `POST /api/projects/open {projectRoot}` 重开；多实例租约冲突时重启 dev server |
| 门禁 | `bun run docs:check`（文档，~50s）、`bun run governance:check`（治理）、`bun run typecheck`（~90s） |
| 真实模型实验 | `bun run smoke:contrast -- --project <root> --chapter-id <id>`（需 Provider 已配置、项目已 open；单轮写+评审约 13–20 分钟） |
| 残留 | `.git/COMMIT_MSG_FORK_RESEARCH.txt` 是此前提交消息的临时文件，可留可删 |
| 应用与 State Root（2026-09-14 实测） | 应用跑在 `http://127.0.0.1:3000`（`/` 返回 200，版本 `v0.10.2-canary.20260908.091411Z`）；State Root = `C:\Users\Administrator\AppData\Local\NeuroBook\data`，项目在 `…\data\workspace\xin-xiao-shuo`（224 章 / 294 场景 / 9 线索；`StoryKeyframe`、`StoryDecision` 为 0 条） |
| `localhost` 解析坑 | Windows 上 `localhost` 常解析到 `::1`，而应用只监听 IPv4 → 探活与脚本会超时。**一律用 `127.0.0.1`** |
| 文本搜索看不到点号目录 | 搜索工具对 `.nbook`、`.agents` 返回 0 条 ≠ 不存在；改用列目录、`git ls-files` 或直接读文件确认 |
| 在会话里跑测试 | 不想找 node 路径时可用 bun：`bun run --cwd "…/neuro-book/packages/neuro-book" test -- <过滤词>`（本机实测可用，bun 1.4.2） |
| PowerShell 传 JS 给 bun | `bun -e "…"` 会被吞引号 → 写成临时 `.mjs` 再 `bun <文件>`，用完删除 |

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
| 评审核对单 | `assets/workspace/.nbook/agent/workflows/chapter-write-review-revise/workflow.ts`（`infoControl` 参数，只进一致性评审） |
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
2. **帧驱动的尺度验证（P1，需 Provider 授权）**：两轮终审实验已完成（判词见 `docs/doctrine/`），仍缺整章 / 整卷尺度的帧驱动表现与裁决闭环实操。
3. **`infoControl` 真自动编译（P1）**：漏传已不再静默（见 §3 已完成第 10 条）；剩下的是让 workflow 能确定性读项目数据（宿主 `wf.query` / `wf.callAction` 未接线）。
4. **合并上游（P2，例行）**：已落后 11 提交（上游 `45906272` / 0.10.3-canary），等并行执行者的未提交改动落定后合并。

真实模型对照实验入口仍是 `bun run smoke:contrast -- --project <项目> --chapter-id <章 id>`（需 Provider 已配置、项目已 open；注意用 `127.0.0.1`）。
