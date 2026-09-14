# Fork 接缝登记表（fork seams）

> 本文件登记 fork 相对上游（notnotype/neuro-book）的**每一处改动**，用于每次合并上游前评估冲突面。
> 开发样式与同步规则见 [`fork-upstream-sync.md`](fork-upstream-sync.md)。
>
> **核心原则：能放资产层就不改核心。** 上游为 Skill / Workflow / Profile 提供官方三层覆盖
> （Seed Root → **Install Root** → Project Root），且 Install Root 的用户改动受 **dirty fail-closed**
> 保护（上游拒绝静默覆盖用户修改）——即：资产层定制**天然免疫上游更新**，核心改动则每次合并都要人肉处理。

## 一、改动面总览（2026-09-14 实测）

`git diff --stat upstream/master...HEAD`：**189 文件，+10268 / -1175**。

| 类别 | 文件数 | 性质 | 冲突风险 |
|---|---|---|---|
| `app/components/novel-ide/**`（Inline AI / 会话 UI 定制） | **83** | **继承的定制**（非写作宪法工作） | **高**（上游活跃开发区） |
| `server/generated/project-prisma/**` | 14 | 机械生成物（schema 变更的产物） | 零（合并后重生成即可） |
| `server/plot/**`（写作宪法核心接缝） | ~13 | 加法式小切口 | 中 |
| `server/agent/**`（tools/workflow/events/harness） | ~11 | 混合：fork 的 plot/keyframe 工具 + 继承的工具投影改造 | 中 |
| `assets/workspace/.nbook/agent/**` | 3 | 新增 workflow / skill phase + 既有 workflow 加一个参数 | 低（加法） |
| `assets/reference/plot/writer-brief.md` | 1 | **改写上游资产正文**（加 slice-only 段） | 中（上游改同文件即冲突） |
| `shared/dto/plot.dto.ts`、`api/projects/plot/**`、`openapi/route-map.ts`、`prisma/project.schema.prisma`、`workspace-files/project-workspace.ts`、`utils/novel-chapter.ts` | 7 | 加法式小切口 | 中低 |
| `docs/`（doctrine、standards、specs 注册表、testing）、`AGENTS.md`、`README`、`CONTRIBUTING`、`PROJECT-STATUS.md` | ~12 | fork 治理 + 外科手术式改写 | 低 |

## 二、核心接缝逐条登记（改上游文件的地方）

| # | 文件 | 改动内容 | 规模 | 能否下沉 |
|---|---|---|---|---|
| S1 | `server/plot/services/chapter-writer-brief.service.ts` | 新增 `slice-only` 模式分支；信息控制不参与其 status 门槛 | ~40 行，新增分支 | 不易（行为在核心） |
| S2 | `shared/dto/plot.dto.ts` | mode 枚举 + `slice-only`；Keyframe DTO/zod | ~60 行，新增段 | 不易 |
| S3 | `prisma/project.schema.prisma` + `workspace-files/project-workspace.ts` | `StoryKeyframe` 模型 + CREATE TABLE/索引 | 1 模型 + 1 段 SQL | 可（若改为项目文件存储则归零，代价：失去类型化 API/UI 路径） |
| S4 | `server/plot/{core/types,contracts/plot-repositories,repositories/prisma-keyframe.repository,assemblers/plot-dto.assembler,facade/plot.facade,services/plot-scope.guard}.ts` | Keyframe 类型/仓储/装配/守卫（多数为**新增文件或新增行**） | 新增文件 3 + 改上游 4 | 可（同上） |
| S5 | `server/api/projects/plot/[...segments].ts` + `server/openapi/route-map.ts` | `keyframes` 路由与 query schema | 各 1 段 | 不易 |
| S6 | `server/agent/tools/plot-tools.ts` | brief mode 枚举加 `slice-only`；（待做）keyframe 工具 | 1 行（+ 待新增工具） | 不易（agent 只能通过工具访问） |
| S7 | `server/utils/novel-chapter.ts` | `EntityIdLabel` 加 keyframe 相关标签 | 4 行 | 不易（类型联合） |
| S8 | `assets/reference/plot/writer-brief.md` | 加 slice-only 段 + status 阶梯说明 | 1 段改写 | **可**（新文件承载 fork 语义，上游那份只保留最小差异——待办） |
| S9 | `assets/workspace/.nbook/agent/workflows/chapter-write-review-revise/workflow.ts` | 新增 `infoControl` 入参（加法参数） | ~10 行 | 不可（要注入评审核对单） |
| S10 | `packages/neuro-book/package.json`、`docs/testing/README.md`、`AGENTS.md`、`docs/README.md`、`docs/specs/README.md`、`CONTRIBUTING*.md`、`PROJECT-STATUS.md` | 外科手术式单点（脚本项/优先级行/表格行/段落） | 各 1-3 行 | 部分可（治理类可另建文件） |
| S11 | `scripts/smoke/slice-vs-told-contrast.ts` | **新增文件**（对照实验脚本） | 新文件 | 不适用（加法） |
| S12 | `.agents/works/w00003-...`、`.gitignore` | 继承的 fork 治理改动 | 小 | 不适用 |

## 三、继承的定制（非本 fork 写作宪法工作，需要所有者决策）

| 范围 | 文件数 | 风险 | 可选处置 |
|---|---|---|---|
| `app/components/novel-ide/agent/**`（会话气泡/工具卡片/大纲面板/Inline AI） | 83 | 上游活跃开发区，每次上游改 UI 都可能冲突 | ① 向上游提 PR（接缝归零）；② 保留并接受合并成本；③ 回退不用 |

## 四、维护动作

1. **每次合并上游前**：`git diff --name-only upstream/master...HEAD` 对照本表，确认没有"未登记的新接缝"。
2. **新增能力前**：先判断能否落在资产层（Skill / Workflow / Profile / 项目模板 / 新增 reference 文件）。
3. **接缝只减不增**：除非有明确理由，新功能不改上游既有文件；必须改时登记进本表并说明理由。
4. **生成物**：`server/generated/**` 不参与冲突判断，合并后重跑 `bun run generate`。
