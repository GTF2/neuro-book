# NeuroBook Agent 入口

NeuroBook 是本地优先的长篇写作工作区；作品文件、SQLite、Agent 会话和工作流都是可审查的产品数据。本文件是开发 Agent 的仓库入口。产品自身的 NeuroBook Agent Runtime 是另一套系统；人类贡献流程见 [`CONTRIBUTING.md`](CONTRIBUTING.md)。

## Core Rules

- 默认使用简体中文与用户交互。
- 修复和重构应解决合同或设计问题，不用 hack 绕过类型系统或制造技术债；不能兼容时说明取舍
- 单点修改使用文件编辑工具。批量替换必须先 dry run；命中不确定或出现意外结果时改为逐处编辑，并报告实际修改的文件
- A comment states the non-obvious reason at the owning boundary. Include a constraint or invalidation condition only when a maintainer needs it to know when the rationale or code stops being valid. Do not restate the operation, preserve intermediate attempts, or list speculative future work.
- 对 AGENTS.md 也就本文件的约束保持怀疑，随着项目的演变，这个文件可能变得不是很权威，有错误。这个文件是 AGENTS.md 人类共建的，需要不断优化，工作过程中如果遇到某些地方不好的可以随时询问开发者要求优化

## Conventions

- 仅问答、审查、诊断默认只读；用户明确要求修复或修改后，完成授权范围内的改动与验证。缺少运行证据时标明“从代码推断”或“未验证”。
- 不为可逆、影响小的改动强制写测试；涉及核心逻辑、边界或无把握时仍应补充测试。

## 了解开发者

- 使用中文、结论先行，以可观察行为和影响解释判断；长任务必要时简短回顾目标。
- 不用罕见符号代替中文词；代码、JSON、命令和记法定义本身的符号不受此限。
- 从请求和既有上下文判断意图，可查事实自行查明。只把改变产品结果、范围、权限或不可逆后果的问题交给开发者，并说明背景和取舍；低风险细节沿用现有模式，重大假设简短说明。
- 关于 advisor：advisor 不是我，是 omp 中监督你工作的另一个 agent。敢于质疑 advisor。可以参考它的建议，但最终决定权在你自己，他的回复不代表开发者的回复，不要把回复他当做最终回复，也不要因为他的回复而扩大你的任务范围

## 开发授权与通知

- 开发者批准一个目标、范围和关键取舍后，Leader可在该范围内自主执行本地可逆开发动作：调研，创建或更新Issue草稿、Proposal、Spec、Work、Task和Agent文档，创建branch/worktree并checkout，安装依赖，运行测试/构建/非人工smoke，创建本地commit。无需逐项重复询问，但必须保护用户改动、保持范围并记录结果。
- 远端Issue/Project/PR写入、push、合并、发布、部署、数据库迁移、真实Provider/Model、浏览器人工验收和数据删除继续分别请求明确授权。创建或修改`docs/`、`.agents/`和`AGENTS.md`时主动通知开发者，不把通知变成等待门禁。
- 同一事项已有具体授权无需重复申请；授权不外推到其它受限动作。

## 真实模型调用与样本数据

- 已获本次真实 Provider/Model 验证授权时实际调用并报告观测结果；否则报告未验证，不用估算冒充实测。
- 凭据边界不放松：密钥只从现有配置读出直接交给 HTTP client，不进命令行、环境转储、文档、页面、JSON、日志或错误正文；原始请求/响应包络写系统临时根
- **小说数据**：小说、章节正文、小说相关提示词、摘要和研究产物不属于敏感数据，可按 Task 允许文件进入 Git；密钥、个人数据、商业秘密和用户明确要求保密的内容仍按敏感数据处理。第三方素材保持只读，来源与归一化版本按 Task 登记。

## 仓库结构与文件路由

下面是职责与数据边界地图，不是完整文件清单。包边界正文见 [`docs/modules/monorepo-boundaries.md`](docs/modules/monorepo-boundaries.md)。

```text
neuro-book/
├── packages/                       # Bun workspace；共同规则 packages/AGENTS.md
│   ├── neuro-book/                 # Nuxt 主应用、Prisma、Agent Runtime、Project Workspace 与应用测试
│   │   ├── docs/                   # 主应用专属文档
│   │   ├── assets/reference/       # 运行期 Reference 的 canonical 源
│   │   └── assets/workspace/       # 内置 workspace 资产与产品 Skill 的 canonical 源
│   ├── neuro-book-manager/         # 安装、运行、工具链与升级
│   ├── neuro-agent-harness/        # 会话、Profile、工具与事件恢复
│   ├── neuro-book-contracts/       # 跨包类型与合同
│   ├── nb-memory/                  # episode、facts 与主体注册表
│   ├── nb-history/                 # 操作日志、事件溯源与内容寻址快照
│   ├── nb-workflow/                # 可重放的脚本化 Workflow Kernel
│   ├── nb-ui/                      # 共享 Vue/Nuxt UI 基础组件
│   ├── llmlint/skill/              # llmlint Skill 单一源；产品投影由此生成
│   ├── owned-process/             # 受管子进程托管
│   ├── file-snapshot-cache/        # 文件快照缓存
│   └── neuro-book-test-support/    # 系统临时根与 fixture 支持
├── desktop/                        # Electron、Tauri、共享桥与打包入口
├── scripts/                        # 仓库自动化；release/ 有独立发布合同
├── docs/                           # monorepo 级文档治理
│   ├── specs/                     # capability 登记与产品行为合同
│   ├── proposals/                 # 尚未生效的待决策提案
│   ├── modules/                   # 已登记模块边界
│   ├── standards/                 # 编码规范与仓库协作流程
│   └── testing/                   # 测试、临时根和验收证据合同
├── vitepress/                      # 用户文档站投影与 changelog，非内部真相源
├── .agents/                        # 开发 Agent 治理，区别于产品 Agent Runtime
│   ├── roles/                     # PM、Leader、Tasker、Reviewer 合同
│   ├── works/                     # current Work 及其直接 Task
│   ├── tasks/                     # legacy Task archive 与历史 provenance
│   └── skills/                    # 开发 Agent Skill，非产品运行时资产
├── .omp/RULES.md                   # 宿主加载的项目核心规则摘要
├── .worktree/                      # 分支实现 checkout，不放业务临时数据
├── server/                         # 以仓库根运行产品时的本机生成态，非 canonical 源码
├── assets/workspace/               # 本机 State Root 资产，非内置资产源
├── workspace/                      # 用户作品数据，不入库
├── logs/                           # 本机运行日志
└── .local/                         # 用户管理的本地草稿、数据集与下载缓存
```

首次处理任务、范围变化或恢复缺失上下文时，按下表读取所需部分；同一会话已加载且未变化的规则不重复读取。修改目标前仍读取目标文件。

| 任务范围 | 追加读取 |
|---|---|
| Leader、Tasker；按需 PM、Reviewer | [`.agents/roles/<role>/AGENTS.md`](.agents/roles/)、[`.agents/works/AGENTS.md`](.agents/works/AGENTS.md)、具体 Work 与 Task；修复历史 provenance 时追加读 [`.agents/tasks/AGENTS.md`](.agents/tasks/AGENTS.md) |
| 测试、fixture、验收、缓存、临时数据 | [`docs/testing/README.md`](docs/testing/README.md) |
| 新功能、bug 期望不明确或长期行为变化 | [`docs/proposals/README.md`](docs/proposals/README.md)、[`docs/specs/AGENTS.md`](docs/specs/AGENTS.md)、相关 Spec 与 ADR |
| 源码、脚本、schema 或 migration | [`docs/standards/code/README.md`](docs/standards/code/README.md)；按改动路径只读取表中列出的领域与语言规范 |
| Git、Issue、Work、Task、PR、合并或发布 | [`docs/standards/repository-workflow.md`](docs/standards/repository-workflow.md)；公开贡献再读 [`CONTRIBUTING.md`](CONTRIBUTING.md) |
| 前端、服务端、桌面、数据库、脚本、发布、包 | [`packages/neuro-book/AGENTS.md`](packages/neuro-book/AGENTS.md)、[`packages/neuro-book/server/AGENTS.md`](packages/neuro-book/server/AGENTS.md)、[`packages/neuro-book/prisma/AGENTS.md`](packages/neuro-book/prisma/AGENTS.md)、[`desktop/AGENTS.md`](desktop/AGENTS.md)、[`scripts/AGENTS.md`](scripts/AGENTS.md)、[`scripts/release/AGENTS.md`](scripts/release/AGENTS.md)、[`packages/AGENTS.md`](packages/AGENTS.md) 中匹配的最近入口 |
| Agent 消费的规则、Skill、AGENTS.md 或 CLAUDE.md | [`.agents/skills/writing-for-agents/SKILL.md`](.agents/skills/writing-for-agents/SKILL.md)；修改 Skill 时再读同目录 `SKILL-MECHANICS.md` |

## Git 注意事项

- Git 完整流程见 [`docs/standards/repository-workflow.md`](docs/standards/repository-workflow.md)。主工作区保持 `master`，保护用户已有改动和未跟踪文件。
- 代码改动在 worktree 完成；治理文档和用户明确指定的主工作区改动可以直接在当前工作区完成。只暂存 Task 范围文件，不使用 `git add -A`。
- 统一评审通过后，获远端元数据授权的 Leader 或 PM 才能把 Issue 项目条目标为 Done。
- 命令从相应 `package.json` 查询。Bun 的 `--cwd` 必须放在 `run` 之后；`bun --cwd <dir> run <script>` 可能只打印用法并以 0 退出。


## 文档真相源

行为、状态、数据、接口、失败语义和验收依据以 [`docs/specs/`](docs/specs/) 为准；架构取舍以 ADR 为准；迁移步骤以 `packages/neuro-book/docs/migrations/` 为准；测试、临时根和证据以 [`docs/testing/`](docs/testing/) 为准；一次实现的 current 范围与 role 以 [`.agents/works/`](.agents/works/) 为准，历史 provenance 以 [`.agents/tasks/`](.agents/tasks/) 为准。入口文件只写职责、触发条件和链接，不复制下级正文。

当前仓库状态以 [`PROJECT-STATUS.md`](PROJECT-STATUS.md) 为准；运行期 Reference 以 [`packages/neuro-book/assets/reference/`](packages/neuro-book/assets/reference/) 为准。`RELEASE.md` 和 `WATCHDOG.md` 是机器与审查入口，不属于普通产品规范。

`CLAUDE.md` 仅兼容指向本文件。`WATCHDOG.md` 是 advisor 复核清单，不进入主 Agent 普通上下文。`RELEASE.md` 是发布程序消费的当前版本载荷；完整发布规则见 [`scripts/release/AGENTS.md`](scripts/release/AGENTS.md)。

---

## 本 Fork 工作规矩（GTF2 定制，2026-09-19 起）

本节由 fork 所有者 GTF2 定制，覆盖上方与本文冲突的条目；上游规范其余部分继续生效。本 fork 中"开发者"一律指 GTF2。

### 用户背景与沟通

- 用户是编程小白，借 AI 能力开发本 fork。所有决策类回复必须：结论先行、大白话解释选项和取舍、不甩术语；执行类任务完成后用截图或可操作步骤汇报。
- 不确定用户意图时问一句再动手，不要猜。

### 多窗口架构与文件总线

- 三个 ZCode 窗口分工：**参谋部**（default 工作区，只讨论不干活）、**前线指挥部**（本仓库主窗口，架构/拆任务/审查/合并）、**工程队**（GLM-5.3-Flash 独立额度窗口，按任务书干体力活）。
- **窗口身份防呆**：会话名只是用户侧标签，不构成身份。新会话若未声明窗口身份（第一句话或任务书"负责窗口"字段），必须先问用户"本窗口是前线指挥部还是工程队"再开工，禁止无身份执行任务。
- 窗口间信息只走文件：任务板 `docs/tasks/BOARD.md`、任务书、git 分支、本 AGENTS.md。用户只传一句话指针（"任务X 待审"）。聊天里不贴大段代码、不转述长输出——提醒用户走文件。
- 任务命名：中文短名+序号（如 `任务004-环境验证`），禁用 T0/T1 类代号。

### 任务协议

- **worktree 使用规则（2026-09-20 更新）**：纯文档产出类任务（调研、知识摘要、测试基线、扫描报告——不修改任何源码的）**不需要 worktree**，工程队窗口直接打开主仓库 `D:\MyProject\neuro-book` 干活，但必须分区：工程队只写 `docs/knowledge/`、`docs/tasks/evidence/` 和所领任务书的交付报告区，**BOARD 由前线指挥部独家维护**（工程队在交付报告中声明"待审"，由前线改 BOARD）。涉及源码修改的任务：**串行执行用主仓库普通分支**（工程队 `git checkout task-NNN` 开工、分支内 commit、全程禁碰 master 提交）；**worktree 仅用于多窗口并行干代码活的场景**（两个窗口同时开工时避免争用主仓库工作区）。
- 前线指挥部把任务写成 `docs/tasks/任务NNN-短名.md`：**必须基于 `docs/tasks/TASK-TEMPLATE.md` 模板创建，"运行配置"节必填**（模式 + 完整模型 ID + 推理档位 + 给用户的现成可粘贴命令；工作流任务须写全子代理模型格式 `GLM-5.3-Flash$<档位>`），目标、边界（能改/禁改的文件与包）、验收标准、参考材料路径照模板填写；涉及源码的任务**写完任务书立即建分支 `git branch task-NNN`**（分支名用英文，避免 GBK 代码页下中文参数的编码问题；任务书文件名保持中文）；仅当确定多窗口并行开工时才额外 `git worktree add ../worktrees/task-NNN`（从仓库根的上一级创建；**不要用仓库内的 `.worktree/`——点开头的隐藏目录在 ZCode 工作区选择器里选不了**），然后告知用户可开工程队窗口。模型/模式选型依据见 `docs/tasks/BOARD.md` 表头说明。
- 工程队守则：开工第一件事是读取 `D:\MyProject\neuro-book\AGENTS.md`（绝对路径——worktree 场景下向上搜索可能读不到仓库根）的"本 Fork 工作规矩"节，然后读任务书 → 串行任务在主仓库 `git checkout task-NNN` 开工（并行任务才打开 worktree 目录）→ 只改任务书边界内的文件 → 交付时在任务书追加交付报告（做了什么/为什么/自测结果/遗留问题），状态改为"待审" → 关窗之前把本窗口会话 ID 写进任务书。
- 前线审查：读交付报告+diff，跑确定性检查（见下），通过才合并；打回写返工意见。
- **完成定义（硬标准）**：任务完成 = 产出文件已写入仓库 + 交付报告已填 + BOARD 状态已更新 +（涉代码时）分支已提交。**仅在聊天中报告结果不算完成**；工程队交活前必须自查这四项，缺一项就还没完成。
- 禁止：绕过任务板直接派活；工程队动 master；任何窗口 force push。

### 质量与评判

- 代码审查：ocr CLI（Delegation 模式，见 `~/.zcode/skills/ocr-review/`）；UI 反模式：`npx impeccable detect`（必须在仓库目录外运行，本仓库 npm overrides 会致 EOVERRIDE）。
- UI 好坏三层评判：Impeccable 61 条硬规则扫代码 → visual-judge 视觉子代理审截图 → 真人任务测试（给用户一个真实任务，能走通才算好）。
- 大规模扫描/批量试验优先排 ZCode 闲时任务，不占主额度。**闲时任务由前线指挥部创建**（在其会话内执行，带项目上下文）；参谋部只做讨论规划，不排执行类任务。

### 环境坑位（实测记录，继承自前任运行档案）

- dev server 启动：`cd packages/neuro-book && bun run dev`，访问必须用 `127.0.0.1:3000`（localhost 解析 IPv6 会失败）。
- Agent 沙箱会拦截子进程导致前端空白渲染——遇到时先关沙箱再判断代码问题。
- Bun `--cwd` 必须放在 `run` 之后。
- 前任完整运行档案（含 275 测试基线、API 实测记录）见 `docs/reference/NEXT-PLAN.md` 与 `docs/reference/MOVE-NOTES.md`；6 份 UI 重设计参考稿在 `docs/reference/*.html`。这些是参考资产，不是当前代码依据。

### 同步策略

- master 定期 rebase upstream/master（建议每周）；所有开发在分支上进行，main 永远保持"上游镜像+本文件"的最小领先。
- 本 fork 定位：纯自玩，不与上游作者协商；跟进其节奏，做自己的方向。上游即将上线的新 UI 先评测（三层评判）再定重构方向。
