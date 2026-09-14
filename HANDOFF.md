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
| 2 | `PROJECT-STATUS.md` | 现状 + 「写作宪法对齐」章节 + **已知未收口列表（第 0 条是 P0）** |
| 3 | `docs/standards/fork-upstream-sync.md` | 我们是 fork（上游 notnotype/neuro-book），这是同步与防冲突规则 |
| 4 | `docs/standards/fork-seams.md` | **接缝登记表 S1–S15**：改上游文件前先查这里 |
| 5 | `docs/doctrine/prior-art-2026-09-14.md` | 外部调研：哪些轮子已有（别重复造）、采纳清单 |
| 6 | `AGENTS.md` 顶部「与开发者的硬性约定（7 条）」 | 协作铁律：先计划后代码、一次一个功能、不通测试不提交、不改无关文件、冲突问不许猜、只推 origin、大白话 |

---

## 3. 当前状态（2026-09-14）

- 分支：**`feat/writing-doctrine-alignment`**；工作区干净；**领先上游 45 提交、落后 0**。
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

### 进行中 / 待办（按优先级）

| 优先级 | 任务 | 说明 |
|---|---|---|
| **P0** | **brief 双视图改造**（最大缺口） | 现状：`suggestedBriefMarkdown` 含 **13 项意图级内容**（目标与落点、本场目的、写作提示、线索脉络、节奏/开场钩子、Promise 指令+note+payoffExpectation、未决决策警告），**slice-only 只挡掉 2 项（信息控制、禁写），其余 11 项在所有模式泄漏**。方案：拆 `factualBrief`（唯一进 writer：时间/地点/在场/世界状态截面/建议读取）与 `reviewChecklist`（只进评审）；`slice-only` 升为唯一合法形态；信息控制 status 门槛废止。审计明细在 `PROJECT-STATUS.md` 第 0 条。改后必须补断言"writer 视图不含意图级内容"的测试 |
| **P0** | **关键帧工具面** | `plot-tools.ts` **0 个 keyframe 工具**（agent 读写不了帧）；`assets/reference/` 无关键帧正文；`novel-writing/phases/03-chapter-loop.md` 不提帧（帧还是旁路，不是主产出物） |
| P1 | Swain 词汇统一（文档级） | 用 `Goal/Conflict/Disaster`、`Reaction/Dilemma/Decision` 替换自造的"欲望/阻力/代价"，与既有 `outcomeType`（yes_but/no_and…）对齐；**不要新增 schema 字段** |
| P1 | 未来影响分析 / 回读验证+回执 / 写回校验注册表 | 采纳 StoryForge 的三个成熟机制（见 prior-art 第五节 2/3/4） |
| P2 | 用户文档改写 | `README.md`、`vitepress/{zh-Hans,en-US}/core/plot-workbench.md`、`profile/writer.md`、`tutorials/04` 等仍写"信息控制=写作前置/强制生效"；**中英必须对等**，改完跑 `docs:check` |
| P2 | 人写帧入口 | UI（`app/`）没有关键帧面板；建议先做 agent 工具 + CLI 脚本（加法，低接缝），UI 后补 |

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

---

## 6. 关键文件地图

| 主题 | 路径 |
|---|---|
| 宪法 / 实验证据 / 外部调研 | `docs/doctrine/writing-doctrine.md`、`contrast-experiment-2026-09-14.md`、`keyframe-experiment-2026-09-14.md`、`prior-art-2026-09-14.md` |
| fork 规则 / 接缝登记 | `docs/standards/fork-upstream-sync.md`、`fork-seams.md` |
| 现状与缺口 | `PROJECT-STATUS.md`（「写作宪法对齐」+ 已知未收口 0–6 条） |
| brief 核心 | `packages/neuro-book/server/plot/services/chapter-writer-brief.service.ts`（渲染器 L352 起，`chooseStatus` 的信息控制门槛） |
| brief 格式契约 | `packages/neuro-book/assets/reference/plot/writer-brief.md` |
| 关键帧核心 | `server/plot/services/keyframe.service.ts`、`repositories/prisma-keyframe.repository.ts`、`api/projects/plot/[...segments].ts`（`handleKeyframes` L446） |
| 关键帧 schema | `prisma/project.schema.prisma`（StoryKeyframe）+ `server/workspace-files/project-workspace.ts`（迁移 SQL） |
| 评审核对单 | `assets/workspace/.nbook/agent/workflows/chapter-write-review-revise/workflow.ts`（`infoControl` 参数，只进一致性评审） |
| 补间 workflow | `assets/workspace/.nbook/agent/workflows/keyframe-tween-review/workflow.ts` |
| 写作 skill | `assets/workspace/.nbook/agent/skills/novel-writing/`（SKILL.md、phases/02-canon-commit.md、03-chapter-loop.md、**05-keyframe-tween.md 是正确范式模板**） |
| 实验脚本 | `packages/neuro-book/scripts/smoke/slice-vs-told-contrast.ts` |
| 上游契约 | `docs/specs/agent/asset-install-runtime.md`（三层覆盖 Seed→Install→Project + dirty fail-closed = 插件层保护） |

---

## 7. 与开发者的沟通方式

- 中文、结论先行、大白话；报错给"错误是什么、原因、打算怎么修"。
- 只把**改变产品结果/范围/权限/不可逆后果**的问题交给他，附选项与各自影响；低风险细节自行决定并简短说明。
- 他关心的事（按频率）：**不要闭门造车**（先查外部实践/GitHub）、**不要与上游冲突**（fork 要能长期同步）、**别让 AI 夺走导演权**（不可逆的东西只能人定）。
- 他的原话可作判据："AI 可以迭代流程，不能定义什么叫好。" "市场都在做更听话的 AI，我要做被正确约束的 AI。"

---

## 8. 建议的第一步

按硬性约定第 1 条（先计划后代码），用大白话向开发者复述 **P0 brief 双视图改造**的方案与影响面，确认后开工。
它是所有后续工作的前提：在 writer 只拿到事实之前，任何"事后校验"主张都立不住（对照组不成立）。
