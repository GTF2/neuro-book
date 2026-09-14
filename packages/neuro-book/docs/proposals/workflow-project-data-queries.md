# Workflow 只读数据查询：首期消费者 infoControl 自动编译

状态：accepted

## 问题

Workflow 是"可重放的确定性编排"，但它今天**读不到项目数据**：宿主只装配了 Session、Agent 与只读 Workspace 端口，项目 SQLite 里的规划数据（ChapterBrief、Promise、Scene、帧）对脚本不可见。

由此产生的可观察问题：`chapter-write-review-revise` 的**信息控制事后核对清单**只能由调用方手填（`infoControl` 参数）。漏填时，一层事后校验就整段消失。

2026-09-14 的 Work `w00016` 已经消除了"静默"：漏传时一致性评审收到显式「信息边界未核对」标注、运行日志记警告、返回值 `infoControlChecked=false`。但**手填本身没有消除**——清单该由 `chapterId` 自动编译，而不是靠人每次记得传。

用模型来补这一步也不行：

- `adhoc` 评审/编译员的工具面固定为 `read` + `report_result`（`assets/reference/agent/workflow/README.md`），它读不到 Plot 数据；
- 用一次 leader-profile 模型调用去读四个数据库字段，是拿成本与不确定性换一次确定性读取。

## 目标与非目标

### 目标

1. Workflow 能用**版本化只读查询**读取项目数据的最小面：查询引用（reference）+ 参数 + 结果 schema，由宿主 `ActivityExecutor` 执行并进入 journal。
2. 首期只服务一个已证实的消费者：`chapter-write-review-revise` 在 `infoControl` 缺省时，用 `chapterId` 自动编译信息控制清单（四字段），调用方不再必须手填。
3. 失败语义 fail-closed：查询失败时不产出"看起来干净"的结果，保持 `w00016` 的显形保证不变。
4. 复用已接受提案的既有计划，不新增第二套执行机制。

### 非目标

- 不做**可写** action：沿用已接受提案的"首期禁止可写 headless recipe"边界；本提案只加只读查询。
- 不把任意 SQL、任意文件路径或 shell 暴露给 workflow 脚本（脚本只能传类型化参数）。
- 不替换 `wf.workspace.read`（文件读取保持现状），不改变 agent 工具面与 HTTP 路由。
- 不改 `plot.chapter-writer-brief` / `plot.keyframe` 的既有合同。

## 当前行为与证据

| 现状 | 证据 |
|---|---|
| 内核已定义版本化外部能力接口 `callAction` / `query`，成功结果进 journal、命中后不重新调用宿主 | `packages/nb-workflow/src/types.ts`（`AgentWorkflowContext.callAction` / `query`）、`packages/nb-workflow/src/ports.ts`、`runtime.ts` |
| 产品宿主**未装配**生产级 `ActivityExecutor`；当前只装配 Session / Agent / 只读 Workspace | `docs/proposals/agent-model-execution-surfaces.md`「Workflow Activity 与重放」一节；宿主装配点 `server/agent/workflow/workflow-demo-service.ts` |
| 已接受提案已把「生产级 ActivityExecutor 装配 + 版本化 activity + 类型化 Workflow API」列入计划（动机是 completion / headless 调用面） | 同上，含决策记录 2026-08-21（`accepted`） |
| 本提案的缺口已登记，但尚无 `implemented` Spec | `docs/specs/README.md`「规范缺口」P1 行：Workflow 侧读取项目数据（infoControl 自动编译） |
| 漏传已显形、手填仍在 | Work `w00016-info-control-non-silent`；`chapter-write-review-revise/workflow.ts` 的 `infoControl` 参数与 `infoControlChecked` |

## 方案、备选方案与取舍

### 方案 A（推荐）：在已接受的 ActivityExecutor 计划中增加"只读数据查询"一类

1. 依赖：已接受提案的 `ActivityExecutor` 装配与类型化 Workflow API（本提案不重复设计执行、注册、授权、取消与结果持久化边界）。
2. 新增查询引用 `plot.chapter-info-control@1`，参数为 `{chapterId}`（StoryChapter 数字 id），结果为稳定的只读数据（`readerKnows` / `protagonistKnows` / `mustHide` / `hintOnly`），**不含**任何写入口。查询引用名带显式版本后缀（内核 `assertVersionedReference` 强制），参数与结果一起进入 activity 指纹与 journal。
3. 消费：`chapter-write-review-revise` 在 `infoControl` 空值时调用查询并编译清单。返回值保留既有布尔 `infoControlChecked`（语义 = 本轮是否真的做了信息边界核对），另加 `infoControlSource`：`auto` / `provided` / `missing`。选择"加字段"而非"原地改变布尔语义"，是因为 `infoControlChecked` 已被 `w00016` 的合同测试与 `phases/03-chapter-loop.md` 消费，原地改变含义会静默破坏既有合同。
4. 审计：查询参数与结果进入 journal，重放命中时返回原结果（可复现、不重复读库）。
5. 失败：区分两种情形。**能力缺席**（宿主未装配执行器，或未注册该查询引用，内核抛 `ActivityExecutorNotConfiguredError` / `ActivityDefinitionNotFoundError`）是部署状态，workflow 退回 `w00016` 的「漏传必定显形」路径（`missing`），保证同一份 workflow 资产在未装配能力的宿主（测试、demo）仍可运行；**查询本身失败**（Project 未打开、章节不存在、DB 错误）是 fail-closed，直接抛错终止 run，绝不把"查不到"说成"没有问题"。

成本：绝大部分成本落在已接受提案的 ActivityExecutor 上；本提案只增加一个查询引用与其 Spec 段落。

### 与业界 durable execution 的对照（借鉴）

本设计的"查询结果进 journal、重放返回原值、不重复读外部状态"是 durable execution 的既有共识，不是新发明：

- **Temporal**：workflow 代码必须确定性，IO / 时间 / 随机等非确定性操作一律放进 Activity，结果写入 Event History；重放时直接返回记录值，不再执行。Temporal 另有 `sideEffect` 把小额值显式记进历史——本提案的 `wf.query` 与之同构。
- **Restate**：`ctx.run(name, fn)` 把每次调用记入 Journal，崩溃后从 Journal 重放已完成步骤，不重复执行。

内核已经实现了同一语义（`runtime.ts` 的 `activity()`：命中 journal 时执行体**完全不被调用**）。因此我们**复用内核**而不是另建机制。唯一的主动分歧：durable execution 系统通常在遇到未注册的 activity 类型时**判定非确定性并失败**；我们把"能力未装配"视为部署状态并退回显形路径（见方案 A 第 5 点），因为同一份 workflow 资产必须在没有该能力的测试/demo 宿主中运行。这是一条有意的、必须写进 Spec 的差异。

### 方案 B：workflow 内加一次 leader-profile 模型调用读四字段

**取舍：拒绝。** 每章写作多一次模型调用与延迟；输出需要额外校验（模型可能改写或漏字段）；用非确定性手段读确定性数据。

### 方案 C：把清单投影成 Project Workspace 文件，再用 `wf.workspace.read` 读

**取舍：拒绝。** 写正文的 writer 有 Project 文件读取权，意图级清单一旦落成文件就有被读取的风险（宪法第五条"事后校验、不事前告知"）；同时引入需要清理的生成物。

### 方案 D：维持现状（调用方手填 + `w00016` 的显形保证）

**取舍：不采用，但作为回退形态保留。** 显形只能保证"漏了看得见"，不能保证"不漏"；每章都要人记得传，长期必然漏。宿主未装配查询能力时，workflow 自动退回这一形态。

## 数据、接口、安全、迁移、发布与回滚影响

- **接口**：新增版本化只读查询引用 `plot.chapter-info-control@1` + 结果 schema（在 Spec 中定义）；不改 HTTP 路由、不改 agent 工具签名、不改 workflow 入参的既有含义（`infoControl` 仍可用作显式覆盖，且显式覆盖优先于自动编译）。
- **权限与安全**：只读；按 Project 作用域限定，复用既有 Project 打开与 scope guard；脚本只能传类型化参数，不能传 SQL、文件路径或命令。
- **重放语义**：沿用内核语义——成功查询进 journal、命中返回原结果；失败不进 journal、可重试，不承诺 exactly-once（只读，重复执行无副作用）。
- **数据与迁移**：无新表、无新字段、无迁移。
- **发布**：宿主在 workflow 装配点注册该只读查询，并把 `ActivityExecutor` 传入 `WorkflowRunner`。宿主未装配或未注册时 workflow 自动退回现状（手填 + 显形），**不失败**；因此 workflow 侧改动可先发布，宿主能力随后落地也不破坏兼容，反之亦然。
- **回滚**：移除宿主查询注册即回到手填路径；`w00016` 的显形保证不受影响。

## 对 Spec 的预期改动

- 新增 capability `agent.workflow-data-queries` 的 `planned` Spec，并登记 `docs/specs/README.md`。
- 验收要点（Given / When / Then）：
  - **Given** 未传 `infoControl`、宿主已装配查询且章节已填四字段，**When** 运行一轮评审，**Then** 一致性评审收到清单原文，返回 `infoControlSource=auto` 且 `infoControlChecked=true`，run 中无额外模型调用用于取数。
  - **Given** 未传 `infoControl` 且宿主未装配该查询，**When** 运行，**Then** 退回 `w00016` 的显形路径（`infoControlSource=missing`、评审收到「信息边界未核对」标注），run 仍正常完成。
  - **Given** 查询失败（章节不存在 / Project 未打开），**When** 运行，**Then** run 失败，不产出"未核对但不报错"的结果（fail-closed）。
  - **Given** 同一 run 重放，**When** 命中 journal，**Then** 不重新查询宿主，返回原结果。
  - **Given** 调用方显式传入 `infoControl`，**When** 运行，**Then** 以调用方为准（`infoControlSource=provided`），自动编译不覆盖、查询不被调用。
- 关联：`plot.chapter-writer-brief`、`plot.keyframe` 合同不变；`phases/03-chapter-loop.md` 的「每次都要传」可放宽为「宿主支持时自动编译，必要时覆盖」。

## 验收

1. Proposal 状态与决策记录完整，未声称任何能力已实现（实现进度只在 Spec 与 Work 中记录）。
2. 与已接受提案 `agent-model-execution-surfaces.md` 的关系明确：**复用**其 `ActivityExecutor` 计划，不建立第二套机制、不扩大其范围（本提案只加只读查询，不加 completion / headless / 可写 action）。
3. 与写作宪法逐条对照：只读数据不进入 writer 动笔前上下文（第二条、第五条不受影响）；本能力不替作者裁决（第六条）。

## 决策记录

- 2026-09-14｜初稿｜来源：`docs/specs/README.md` P1 规范缺口「Workflow 侧读取项目数据（infoControl 自动编译）」+ Work `w00016` 的显形收口。依赖已接受提案 `agent-model-execution-surfaces.md`（2026-08-21 `accepted`）的 ActivityExecutor 装配。
- 2026-09-14｜决策者：用户（概括授权"你先按你的来吧，发挥主观能动性"）｜结论：**接受本提案**（`accepted`）。长期取舍已定：workflow 侧只读数据统一走版本化 `wf.query` + 宿主 `ActivityExecutor`，不新增第二套读取机制；首期只实现只读查询，不把 completion / headless / 可写 action 一并拉入。
- 2026-09-14｜决策者：用户｜结论：`infoControlChecked` 保持布尔语义（不原地改为枚举），新增 `infoControlSource` 记录来源。理由：既有布尔已被 `w00016` 合同测试与主链 skill 消费，原地改语义是静默破坏性变更；"来源"是新增的可观察信息，用新字段承载。
- 2026-09-14｜决策者：用户｜结论：能力缺席（宿主未装配 / 未注册）**不等同于**查询失败。前者退回 `w00016` 的显形路径并保持 run 可完成（测试与 demo 宿主必须能跑同一份资产）；后者 fail-closed。此差异是对 durable execution 惯例（未注册 activity 即判定非确定性失败）的有意偏离，必须写进 Spec。
