# Workflow 只读数据查询：首期消费者 infoControl 自动编译

状态：draft

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
2. 新增查询引用（名称在 Spec 中定稿，示意 `plot.chapter-brief@1`），参数为 `{projectRoot, chapterId}`，结果为稳定的只读数据（`readerKnows` / `protagonistKnows` / `mustHide` / `hintOnly` 与必要的章节身份），**不含**任何写入口。
3. 消费：`chapter-write-review-revise` 在 `infoControl` 空值时调用查询并编译清单；`infoControlChecked` 语义升级为"清单来源"：`auto` / `provided` / `missing`。
4. 审计：查询参数与结果进入 journal，重放命中时返回原结果（可复现、不重复读库）。
5. 失败：查询抛错时**不降级为"未提供"**，而是让 run 失败或按 Spec 明确的 fail-closed 语义处理，避免把"查不到"说成"没有问题"。

成本：绝大部分成本落在已接受提案的 ActivityExecutor 上；本提案只增加一个查询引用与其 Spec 段落。

### 方案 B：workflow 内加一次 leader-profile 模型调用读四字段

**取舍：拒绝。** 每章写作多一次模型调用与延迟；输出需要额外校验（模型可能改写或漏字段）；用非确定性手段读确定性数据。

### 方案 C：把清单投影成 Project Workspace 文件，再用 `wf.workspace.read` 读

**取舍：拒绝。** 写正文的 writer 有 Project 文件读取权，意图级清单一旦落成文件就有被读取的风险（宪法第五条"事后校验、不事前告知"）；同时引入需要清理的生成物。

### 方案 D：维持现状（调用方手填 + `w00016` 的显形保证）

**取舍：不采用，但作为回退形态保留。** 显形只能保证"漏了看得见"，不能保证"不漏"；每章都要人记得传，长期必然漏。

## 数据、接口、安全、迁移、发布与回滚影响

- **接口**：新增版本化只读查询引用 + 结果 schema（在 Spec 中定义）；不改 HTTP 路由、不改 agent 工具签名、不改 workflow 入参的既有含义（`infoControl` 仍可用作显式覆盖）。
- **权限与安全**：只读；按 Project 作用域限定，复用既有 Project 打开与 scope guard；脚本只能传类型化参数，不能传 SQL、文件路径或命令。
- **重放语义**：沿用内核语义——成功查询进 journal、命中返回原结果；失败不进 journal、可重试，不承诺 exactly-once（只读，重复执行无副作用）。
- **数据与迁移**：无新表、无新字段、无迁移。
- **发布**：随宿主执行能力一起发布；宿主未装配前，workflow 保持现状（手填 + 显形）。
- **回滚**：workflow 退回手填路径；`w00016` 的显形保证不受影响。

## 对 Spec 的预期改动

- 依赖已接受提案的 "Workflow model activities" planned Spec；建议在该 Spec 内增加「只读数据查询」小节，或另立 capability（如 `agent.workflow-data-queries`）的 `planned` Spec。
- 验收要点（Given / When / Then）：
  - **Given** 未传 `infoControl` 且章节已填四字段，**When** 运行一轮评审，**Then** 一致性评审收到清单原文，返回 `infoControlChecked=auto`，且 run 中无额外模型调用用于取数。
  - **Given** 查询失败，**When** 运行，**Then** 不产出"未核对但不报错"的结果（fail-closed），错误可见。
  - **Given** 同一 run 重放，**When** 命中 journal，**Then** 不重新查询宿主，返回原结果。
  - **Given** 调用方显式传入 `infoControl`，**When** 运行，**Then** 以调用方为准（`provided`），自动编译不覆盖。
- 关联：`plot.chapter-writer-brief`、`plot.keyframe` 合同不变；`phases/03-chapter-loop.md` 的「每次都要传」可放宽为「优先自动编译，必要时覆盖」。

## 验收

1. Proposal 状态与决策记录完整，未声称任何能力已实现。
2. 与已接受提案 `agent-model-execution-surfaces.md` 的关系明确：**复用**其 `ActivityExecutor` 计划，不建立第二套机制、不扩大其范围。
3. 与写作宪法逐条对照：只读数据不进入 writer 动笔前上下文（第二条、第五条不受影响）；本能力不替作者裁决（第六条）。

## 决策记录

- 2026-09-14｜初稿｜来源：`docs/specs/README.md` P1 规范缺口「Workflow 侧读取项目数据（infoControl 自动编译）」+ Work `w00016` 的显形收口。依赖已接受提案 `agent-model-execution-surfaces.md`（2026-08-21 `accepted`）的 ActivityExecutor 装配；等待开发者决定 `accepted` / `rejected`。
