# Fork 接缝登记表（fork seams）

> 本文件登记 fork 相对上游（notnotype/neuro-book）的**每一处改动**，用于每次合并上游前评估冲突面。
> 开发样式与同步规则见 [`fork-upstream-sync.md`](fork-upstream-sync.md)。
>
> **核心原则：能放资产层就不改核心。** 上游为 Skill / Workflow / Profile 提供官方三层覆盖
> （Seed Root → **Install Root** → Project Root），且 Install Root 的用户改动受 **dirty fail-closed**
> 保护（上游拒绝静默覆盖用户修改）——即：资产层定制**天然免疫上游更新**，核心改动则每次合并都要人肉处理。

## 一、改动面总览（2026-09-14 实测）

`git diff --stat upstream/master...HEAD`：**294 文件** / +17137 -1529（2026-09-15 合并上游 `45906272` / 0.10.3-canary 后实测；上一轮基线为 259 文件 / +15241 -1487，两次计量的 merge-base 不同，不宜直接相减）。清单里包含 `CLAUDE.md` 删除项与 `HANDOFF.md`（曾被并行执行者删除后由作者还原），它们不是本 fork 写作宪法工作。

| 类别 | 文件数 | 性质 | 冲突风险 |
|---|---|---|---|
| `app/components/novel-ide/**`（Inline AI / 会话 UI 定制） | **83** | **继承的定制**（非写作宪法工作） | **高**（上游活跃开发区） |
| `server/generated/project-prisma/**` | 14 | 机械生成物（schema 变更的产物） | 零（合并后重生成即可） |
| `server/plot/**`（写作宪法核心接缝） | ~13 | 加法式小切口 | 中 |
| `server/agent/**`（tools/workflow/events/harness） | ~11 | 混合：fork 的 plot/keyframe 工具 + 继承的工具投影改造 | 中 |
| `assets/workspace/.nbook/agent/**` | 5 | 新增 workflow（`keyframe-tween-review`、`contrast-write-review`）+ 新增 skill phase + 既有 workflow 加参数 + 既有 skill 正文同步；`phases/03` 接真实工具名、主链接帧与「未来影响分析」步骤，`phases/05` 接真实工具名 | 低（加法） |
| `assets/reference/plot/**`（writer-brief 改写 + 新增 keyframe / future-impact-analysis / write-back-checks + README 索引同步） | 5 | **改写上游资产正文** + 新增 fork 正文 | 中（上游改同文件即冲突） |
| `assets/reference/world-engine/**`（README 索引补行 + 新增 canon-read-back.md） | 2 | 新增 fork 正文 + 上游索引补一行 | 低（加法为主） |
| `shared/dto/plot.dto.ts`、`api/projects/plot/**`、`openapi/route-map.ts`、`prisma/project.schema.prisma`、`workspace-files/project-workspace.ts`、`utils/novel-chapter.ts` | 7 | 加法式小切口 | 中低 |
| `docs/`（doctrine、standards、specs 注册表、testing）、`AGENTS.md`、`README`、`CONTRIBUTING`、`PROJECT-STATUS.md` | ~12 | fork 治理 + 外科手术式改写 | 低 |
| `packages/neuro-book/{nuxt.config.ts,app/spa-loading-template.html,scripts/cli/source-dev.ts}`（启动体验补丁：首屏加载占位 + 就绪后打开浏览器） | 3 | 加法式小切口（新增占位文件 + 少量配置/启动逻辑） | 低 |

## 二、核心接缝逐条登记（改上游文件的地方）

| # | 文件 | 改动内容 | 规模 | 能否下沉 |
|---|---|---|---|---|
| S1 | `server/plot/services/chapter-writer-brief.service.ts` | 渲染器拆成 writer 视图（事实切片）与评审视图（事后核对清单）；`chooseStatus` 去掉信息控制门槛、`needs_chapter_brief` 废止 | 约 120 行改写，函数边界不变 | 不易（行为在核心） |
| S2 | `shared/dto/plot.dto.ts` | mode 枚举 + `slice-only`；Keyframe DTO/zod；status 枚举删 `needs_chapter_brief`，brief DTO 加 `reviewChecklistMarkdown` | ~65 行，新增段 | 不易 |
| S3 | `prisma/project.schema.prisma` + `workspace-files/project-workspace.ts` | `StoryKeyframe` 模型 + CREATE TABLE/索引 | 1 模型 + 1 段 SQL | 可（若改为项目文件存储则归零，代价：失去类型化 API/UI 路径） |
| S4 | `server/plot/{core/types,contracts/plot-repositories,repositories/prisma-keyframe.repository,assemblers/plot-dto.assembler,facade/plot.facade,services/plot-scope.guard}.ts` | Keyframe 类型/仓储/装配/守卫（多数为**新增文件或新增行**） | 新增文件 3 + 改上游 4 | 可（同上） |
| S5 | `server/api/projects/plot/[...segments].ts` + `server/openapi/route-map.ts` | `keyframes` 路由与 query schema | 各 1 段 | 不易 |
| S6 | `server/agent/tools/plot-tools.ts` | brief mode 枚举加 `slice-only`；brief 工具文本改出 writer 视图、`details` 按 `profileKey` 收口（writer 不带意图级结构化数据）；keyframe 工具见 S18 | 约 35 行 | 不易（agent 只能通过工具访问） |
| S7 | `server/utils/novel-chapter.ts` | `EntityIdLabel` 加 keyframe 相关标签 | 4 行 | 不易（类型联合） |
| S8 | `assets/reference/plot/writer-brief.md` | 整篇改写为双视图格式契约（writer 视图 / 评审视图 / 三模式差异 / status 阶梯） | 全文改写 | **可**（新文件承载 fork 语义，上游那份只保留最小差异——待办） |
| S9 | `assets/workspace/.nbook/agent/workflows/chapter-write-review-revise/workflow.ts` | `infoControl` 入参（加法参数）；`brief` 改为一律只注入评审、writer 消息只留交付要求，`chapterId` 由可选变必填；2026-09-14 加「漏传 `infoControl` 必定显形」（一致性评审显式标注「信息边界未核对」+ 运行日志警告 + 返回值 `infoControlChecked`）；2026-09-14 再升级为「缺省时经宿主只读查询 `plot.chapter-info-control@1` 自动编译清单」，返回值加 `infoControlSource`（auto/provided/missing），能力缺席退回上面的显形路径 | 约 45 行 | 不可（要注入评审核对单） |
| S10 | `packages/neuro-book/package.json`、`docs/testing/README.md`、`AGENTS.md`、`docs/README.md`、`docs/specs/README.md`、`CONTRIBUTING*.md`、`PROJECT-STATUS.md` | 外科手术式单点（脚本项/优先级行/表格行/段落）；`AGENTS.md` 另新增「与开发者的硬性约定」7 条小节（fork 开发者的协作约束，含 CodeBuddy 宿主规则文件指针）；2026-09-14 修正 `CONTRIBUTING{,.en}.md` 的 monorepo 命令（`bun run --cwd packages/neuro-book …`）并同步 `PROJECT-STATUS` 版本行 | 各 1-3 行 + 约 14 行 | 部分可（治理类可另建文件） |
| S11 | `scripts/smoke/slice-vs-told-contrast.ts` | **新增文件**（对照实验脚本）；2026-09-14 重建：改用实验专用 workflow，A 组 writer 提示由脚本拼接，唯一变量 = 意图清单是否随提示下发 | 重写约 90 行 | 不适用（加法） |
| S12 | `.agents/works/w00003-...`、`.gitignore` | 继承的 fork 治理改动 | 小 | 不适用 |
| ~~S13~~ | ~~`packages/neuro-book/scripts/cli/source-runtime.ts`~~ | **已注销（2026-09-15）**：上游 `392faaa3` 独立修了同一问题（「应用不得跨根 import 根 #scripts」），且实现更严格——仓库根只由 `source-dev.ts` 注入、缺失即 fail closed。fork 原写法（`NEURO_BOOK_REPOSITORY_ROOT` 注入 + 按包位上溯回退）会静默掩盖注入失败，故合并时取上游版，本接缝消失 | — | 已归零 |
| S14 | `packages/neuro-book/app/spa-loading-template.html`（新增）+ `packages/neuro-book/nuxt.config.ts`（`spaLoadingTemplate` + 存在性断言） | SPA 首屏加载占位。上游 `ssr: false` 且未配 `spaLoadingTemplate`，首屏 HTML 只有空的 `<div id="__nuxt"></div>`，JS 下载并执行前完全白屏（dev 模式按需编译可达数秒）。**坑**：该配置项传字符串时 Nuxt 走 `resolve(srcDir, value)`，`~` 别名**不展开**（`"~/x.html"` → `<srcDir>/~/x.html`）；文件不存在则报 `NUXT_B7016` 并 `return ""`，加载界面**静默消失**。故此处传构建时解析的绝对路径，并加断言使其缺文件即启动报错。同文件另加 `vite.ssr.external: ["node:sqlite", "bun:ffi"]`，消除 Rollup 对这两个宿主内置模块反复报的解析告警（两者均以 `await import()` 惰性加载） | 新增 1 文件 + 上游改约 18 行 | **可**（上游若自行引入加载占位则本项归零） |
| S15 | `packages/neuro-book/scripts/cli/source-dev.ts` | 直接执行 CLI 时，先 HTTP 探测到应用真正可服务，再打开系统浏览器（跨平台：`start` / `open` / `xdg-open`）。不用 `nuxt dev --open`，因其在 Vite 监听时即抢跑、早于 Nitro 编译完成十余秒。`import.meta.main` 守卫保证被 import 时（launcher 测试、Manager 内部入口）不生效；`NEURO_BOOK_DEV_NO_OPEN=1` 亦可关闭。另注入 `NODE_OPTIONS=--disable-warning=ExperimentalWarning`（保留用户既有 NODE_OPTIONS），静音 `node:sqlite` 的实验性 API 警告（需 Node 21.3+，本机 v22.22.2） | 新增 2 个辅助函数 + 1 段调用 + 1 项环境变量，约 58 行 | 不易（launcher 行为） |

| S16 | `assets/reference/plot/system.md`、`plot/agent-spec.md`、`agent/leader-default.md`、`agent/novel-writing-workflow.md`、`world-engine/workflow.md`（§6.2/§6.3/§13）、`assets/workspace/.nbook/agent/skills/novel-writing/phases/02-canon-commit.md`、`phases/03-chapter-loop.md`、`novel-writer-execution/SKILL.md`、`server/agent/profiles/leader-assets-profile.test.ts` | 双视图接线：把「信息控制前置 / 把意图写进 writer message / brief 给框架」的叙述改为「事实进 writer、意图进评审」；2026-09-14 `plot/agent-spec.md` 加 `Scene Tension Slots`（Swain 词汇与 `outcomeType` 对齐）；2026-09-15 同步修正 `leader-assets-profile.test.ts` 里沿用 upstream 旧口径的**过期断言**——`leader-default.md` 的 message 口径已反转为「只写交付要求、意图不下发 writer」，断言从「必须写清」改为锁住反转后的合同 | 各文件 1-3 段 | 不易（上游 Reference 与产品 Skill 正文） |

| S17 | `assets/workspace/.nbook/agent/workflows/contrast-write-review/workflow.ts` + `server/agent/workflow/contrast-write-review.workflow.test.ts` | **新增文件**：实验专用「写 → 三维评审」workflow，把调用方显式给定的 writer 提示原样下发（仅 trim 首尾空白）；不接入普通写作主链 | 新 workflow + 新测试 | 不适用（加法） |

| S18 | `server/agent/tools/plot-tools.ts`（keyframe 三工具，与 S6 同文件）、`assets/reference/plot/keyframe.md`（**新增**）、`assets/reference/plot/README.md`、`assets/workspace/.nbook/agent/skills/novel-writing/phases/{03-chapter-loop,05-keyframe-tween}.md` | keyframe 工具面：新增 `get_story_keyframe` / `get_tween_keyframes` / `save_story_keyframe`（`create` 恒 pending、不接受 status/decisionRefId/keyframeId，`update` 不接受 source；读面按 `profileKey=writer` 白名单剔除 `note`）；新增关键帧 Reference 正文并接入目录索引；主链 skill 把「Plot API keyframes / PATCH keyframes / POST decisions」改为真实工具名，正文循环的前置检查与完成标准补帧收口 | plot-tools 约 +130 行；reference 新增 1 文件；skill 各 1-3 段 | 不易（agent 只能通过工具访问）；新增 reference 文件本身属资产层 |

| S19 | `assets/reference/plot/future-impact-analysis.md`（**新增**）、`assets/reference/plot/README.md`（索引补行）、`assets/workspace/.nbook/agent/skills/novel-writing/phases/03-chapter-loop.md`（**新增「第六步：未来影响分析」**，与 S16/S18 同文件） | 未来影响分析：正文采纳后由 leader 扫描「新事实 → 下游规划」的失效（Promise / Scene / 帧 / 期限），产出只标记、不改动的受影响清单，交作者逐项裁决。形态约束：**不做 workflow**——workflow 内 `adhoc` 工具面固定为 `read` + `report_result`，读不到 Plot 数据，故由持有 Plot 工具面的 leader 在 skill 阶段执行；复用既有只读工具，不新增实体 / 字段 / 工具 / 路由 | 新增 reference 1 文件；skill 约 +20 行 | 不适用（新增 reference 属资产层）；skill 改动并入既有接缝 |

| S20 | `assets/reference/world-engine/canon-read-back.md`（**新增**）、`assets/reference/world-engine/README.md`（索引补行）、`assets/workspace/.nbook/agent/skills/novel-writing/phases/{02-canon-commit,03-chapter-loop}.md`（**新增「回读验证」步骤**） | canon 回读验证：拍板落库写入之后，立刻回读刚写入的 slice / Plot 实体 / lorebook，与确认意图逐条比对，产出验收回执（已落地 / 偏离 / 未落地 + 证据 + 建议动作）；与事后校验（正文 vs 声明）、未来影响分析（新事实 → 下游）三者分工互补。形态约束同 S19：**不做 workflow**——`adhoc` 工具面读不到 World Engine / Plot 数据，由持有 `execute_world` 与 plot 工具的 leader 执行；复用既有只读入口，不新增实体 / 字段 / 工具 / 路由 | 新增 reference 1 文件；skill 02 约 +14 行、03 约 +1 行 | 不适用（新增 reference 属资产层）；skill 改动并入既有接缝 |

| S21 | `assets/reference/plot/write-back-checks.md`（**新增**）、`assets/reference/plot/README.md`（索引补行）、`assets/reference/plot/writer-brief.md`（分工表后加指向，与 S8 同文件）、`phases/{02-canon-commit,03-chapter-loop}.md`（各加一句指向） | 写回校验清单：把散落在四处以上的写回校验项（目标覆盖 / 信息边界 / 禁写 / 字 AI 味 / 节奏 / 正文 vs 声明 / 承诺兑现 / 关键帧回撞 / canon 回读 / 下游失效 / World Engine issues / 未决决策）收敛成**声明式清单**（项名 / 标的 / 判据 / 失败动作 block·warn·record / 消费方），成为各消费方的单一索引入口。**文档级**：不改 workflow 语义与返回、不改 `reviewChecklistMarkdown` 结构、不新增实体 / 字段 / 工具 / 路由 | 新增 reference 1 文件；其它各 1-2 行指向 | 不适用（新增 reference 属资产层）；指向改动并入既有接缝 |

| S22 | `server/agent/workflow/workflow-data-queries.ts`（**新增**）、`server/agent/workflow/workflow-demo-service.ts`、`assets/workspace/.nbook/agent/skills/novel-writing/phases/03-chapter-loop.md`（与 S16/S18/S19/S21 同文件） | Workflow 只读数据查询：宿主首次装配 `ActivityExecutor`（`WorkflowRunner` 第三参 `options.activities`），注册版本化只读查询 `plot.chapter-info-control@1`（输入 `{chapterId}` → 章节信息控制四字段），供 `chapter-write-review-revise` 在 `infoControl` 缺省时按 `chapterId` 自动编译事后核对清单。只读、无副作用；成功结果进 journal、重放命中返回原值不重读库；**能力缺席**退回漏传显形（run 仍可完成），**查询失败** fail-closed。复用既有 Project 作用域登记（`runReadyProjectOperation` + `activateReadyProjectModule(PROJECT_PLOT_WORLD_MODULE_TOKEN)`） | 新增 1 文件；`workflow-demo-service.ts` 装配点约 +8 行；skill 1 处；`workflow.ts` 改动并入 S9 | 加法为主；`workflow-demo-service.ts` 属上游文件，装配点被上游改动时需人肉处理 |

| S23 | `shared/agent/profile-runtime-settings.ts`、`shared/dto/config.dto.ts`、`server/agent/profiles/profile-runtime-settings.ts`、`server/config/normalizer.ts` + `normalizer.test.ts`、`server/agent/harness/neuro-agent-harness.ts`（另加两处，与 S9/S22 的宿主改动不同段）、`app/components/novel-ide/settings/{ProfileRuntimeSettingsFields.vue,AgentProfileDefaultsPanel.vue,AgentProfileDetailPanel.vue,profile-runtime-settings.{ts,test.ts},NovelIdeAgentProfileModelSettingsPanel.vue}`、`app/components/novel-ide/NovelIdeSettingsDialog.vue`、`app/i18n/locales/{zh-CN,en-US}.ts` | 辅助任务模型来源 + 设置保存反馈：运行策略新增 `auxiliary.modelKey` 一组（`null` = 跟随本 Profile，四层继承沿用既有机制），`explainToolCall` 按该值解析模型、不可用时回退 Profile 模型并记 `agent.auxiliaryModel.fallback` 警告日志；`normalizeProfileRuntimeSettingsPatch` 补 `auxiliary` 分组规范化——该分组此前在读写配置时被静默丢弃（真机缺陷：选完保存界面即刻回弹），`mergeProfileRuntimePatches` / `resolveProfileRuntimeSettings` 本来就支持，故只补这一处；设置面板新增「辅助任务」组（复用同页 `NovelIdeModelSelect`，避免两处模型清单漂移）；保存成功反馈由标题下方绿色横幅改为「保存设定」按钮上的 2.4 秒绿底 ✓「已保存」（`SettingsSavePanelExpose` 增可选 `justSaved?`，其余面板不受影响） | 核心约 120 行 / UI 与文案约 90 行 | 不易（模型解析在 harness、字段在共享 DTO 与配置读写层，都是行为所在）；UI 与 i18n 改动属本表「`app/components/novel-ide/**`」既定的继承定制区，不新增独立接缝 |

| S24 | `packages/neuro-book/app/pages/index.vue` | 行内 AI Prompt Bar 的 fork 改进（上游没有）：① owner 缺失时不再静默 `return`，改走 `notifyInlinePromptUnavailable()` 给可见反馈（否则按钮点了没反应）；② 发送被取代（`result.status === "superseded"`）时写状态文案 + 警告通知，避免界面「闪一下消失」、无法区分「没发出去」与「发了没输出」。另含 `d5b225dc` 的中文化（菜单分区标题「样式 / 插入」、通知标题「行内 AI」）。**结构已在 2026-09-15 跟随上游 #235**：owner 不再持有 surface、`sendPrompt` 不再传 `operationKey`、refresh watch 改走 `inlineEditorAgent.operationScopeKey`——fork 原先的 `inlineOperationScopeOf` 补丁已被上游从根上取代（`captureOperation` 去参），该函数现无生产消费者、仅存自身测试 | 相对上游约 41 行新增 | 不易（须与上游的行内 AI 所有权结构同步，上游改这段即需人肉融合） |

## 三、继承的定制（非本 fork 写作宪法工作，需要所有者决策）

| 范围 | 文件数 | 风险 | 可选处置 |
|---|---|---|---|
| `app/components/novel-ide/agent/**`（会话气泡/工具卡片/大纲面板/Inline AI） | 83 | 上游活跃开发区，每次上游改 UI 都可能冲突 | **所有者已决定（2026-09-14）：保留现状，接受每次上游改 UI 的合并成本。** 缓解措施：启用 `git rerere` 复用冲突解决；每次合并后跑相关 UI 测试 |

## 四、维护动作

1. **每次合并上游前**：`git diff --name-only upstream/master...HEAD` 对照本表，确认没有"未登记的新接缝"。
2. **新增能力前**：先判断能否落在资产层（Skill / Workflow / Profile / 项目模板 / 新增 reference 文件）。
3. **接缝只减不增**：除非有明确理由，新功能不改上游既有文件；必须改时登记进本表并说明理由。
4. **生成物**：`server/generated/**` 不参与冲突判断，合并后重跑 `bun run generate`。
