# 写作体验 Journey 量化指标层（冻结「体验打磨」，不新立旅程）

状态：draft

> 本文件是**尚未生效的待决策提案**（依据 [`./README.md`](./README.md) 第 3、18–27 行：Proposal 把原始需求整理成问题、目标、备选方案和影响，用来决定「应该采用什么长期行为」；`draft`/`reviewing` 只供讨论，不能被当当前行为依据）。
> 本提案不改任何代码、不改 `PROJECT-STATUS.md`、不改任何 Spec、**不改 `docs/testing/manual-eval/` 下任何文件**。文中所有目标数值都是**候选值，未经开发者（GTF）确认**。

---

## 一句话结论

`PROJECT-STATUS.md:47` 写着写作模式 v1「进入体验打磨」，但「体验打磨」**没有完成定义**——没有目标、没有判据、没有基线，因此无法验收、也无法判断何时算做完。项目**已经有一套已转正的用户旅程体系**（`docs/testing/manual-eval/`，6 条 journey），但它只有**定性判据**（通过 / 未通过 / 环境阻塞 / 发现问题），**缺「多快、几次点击、几次操作」这种可比较、可回归的数字**。

因此本提案**不新立第二套旅程**，而是**给现有旅程体系补一个量化指标层**：为 5 个关键动作（首字 / AI 首章 / 续写 / 伏笔闭环 / 扫 AI 味）定义**耗时或操作次数**指标，并尽量复用现有 journey 已定义的入口与路径（引用，不重述）。**只有现有体系没有对应旅程的动作，才新增条目**。量的部分中 3 个可用现有 Playwright E2E 全自动测，2 个（涉及真实模型耗时/产出）只能做到「链路自动 + 时限真实模型/人工测量」。**目标数值由 GTF 拍板，本提案只把它们整理成「可测量 + 可验收」的形式。**

边界（写作宪法，只有 GTF 能定）：本提案只定义**流程是否走通、要多久、要几次操作**，**不**定义「产出的是不是好小说」、**不**裁决写作流程形态（事前告知 vs 事后校验）、**不**碰 `docs/doctrine/` 里两轮实验的判词（`docs/doctrine/writing-doctrine.md:50-56` 第四条、`:58-66` 第五条、`:88-92` 否决权条款）。

---

## 问题

1. **「体验打磨」不可验收**。`PROJECT-STATUS.md:47` 的写作模式 v1 状态是「主路径阶段完成，进入体验打磨」，但全文没有给「体验打磨」定义目标、判据或基线；`PROJECT-STATUS.md:88-90` 承认「浏览器、真实 Project、真实 Provider、作者视角写作 smoke」仍是缺口。一句不可测量的状态词，让验收无法开口。
2. **现有旅程体系只有定性，没有量化**。项目已有一套**已转正**的用户旅程体系（`docs/testing/manual-eval/`：`README.md` 说「已转正到 `docs/testing/manual-eval/`」、`criteria.md` 定义定性判据、`journeys/` 下 6 条旅程）。它的判据是「通过 / 部分通过 / 未验证 / 环境阻塞 / 发现问题」（`criteria.md` 第 3 节），**没有「多快、几次点击」这类可比较的数字**——因此无法回答「这次比上次快了吗」这种回归问题。
3. **不得新立第二套旅程（否则必然漂移）**。若本提案再写一套并列的 Journey 文档与现有 6 条各自维护，两套一定会漂移（本项目在主题体系上已吃过「两套并存」的亏）。所以本提案**不是**新建旅程集合，而是**在现有旅程上补量化列**；只在现有体系确无对应旅程时才新增条目。
4. **建议数值与决策权错位**。体检报告给出的 5 条目标值（90 秒 / 10 分钟 / 20 秒 / 60 秒 / 2 点击）**未经 GTF 确认**，且报告明确标注负责方是 GTF。本提案把它们整理成可测量形式，但目标值仍**待 GTF 拍板**。

## 目标与非目标

### 目标

0. **定位**：给 `docs/testing/manual-eval/` 现有旅程体系**补一个量化指标层**（耗时 / 操作次数），**不新增并列的第二套旅程体系**。本提案**不新建旅程文档**；如最终确需新增，也只新增现有体系里确实没有对应旅程的动作（见「与 manual-eval 的分工与复用」一节的逐条映射）。
1. 为 5 个关键动作各写出**四项可测量定义**：入口（具体界面位置，基于真实代码；现有 journey 已定义的路径只引用不重述）、动作序列、计时口径、通过判据。
2. 逐条判定**可自动化性**：能用现有 Playwright E2E 全自动测的，说明怎么测；不能的（涉及真实模型耗时/产出）说明为什么不能、以及能测到哪一步。
3. 给出每条动作的**现状基线**：能测的实跑实测（附命令与真实输出）；测不了的如实标注「未测」及原因，不估数字充数。
4. 把 5 个建议数值**标注为「候选值（待 GTF 拍板）」**，并给出推荐理由（有产品能力事实支撑的才给强推荐）。
5. 逐条给出**与现有 journey 的映射**，对完全重复者明确「合并进现有 journey、只补指标」（见「与 manual-eval 的分工与复用」一节）。
6. 给出提案生效后 `PROJECT-STATUS.md:47` 那句话的**改写建议文本**（只给建议，不实际修改）。

### 非目标

- 不定义「什么叫好小说」；不定义产出质量（第四条的边界）。
- 不裁决写作流程形态（事前告知 vs 事后校验，第五条）；不碰 `docs/doctrine/` 两轮终审实验判词。
- **不新建并列的第二套旅程体系**；除「现有体系确无对应」的动作外，不新增旅程条目，不改 `docs/testing/manual-eval/` 下的任何文件（那是已转正体系，改动需单独排期）。
- 不新增功能、不改代码、不改 Spec、不改 `PROJECT-STATUS.md`。
- 不把「体验打磨」重新定义成一个更含糊的投入式说法——本提案的目的正是消除这类说法。
- 不设总分/综合评分；只保留可逐条判定的看板项（与 `docs/testing/manual-eval/README.md` 第 17 行「具体问题清单比拍脑袋分数有用，本体系不设总分」同源）。

---

## 当前行为与证据（基于真实代码）

### 通用证据（与测量无关的既成事实）

- E2E 体系：`packages/neuro-book/playwright.config.ts`（2 个隔离根、独立端口 3400/3401、`timeout: 120s`、`expect.timeout: 20s`、`retries: 0`）；用例级统一断言「`console.error` 与 `pageerror` 均为 0」的 `consoleGuard`（`packages/neuro-book/e2e/fixtures.ts:14-29`）。
- E2E 完全隔离：State/Cache 指向系统临时目录、本地 Mock LLM（`packages/neuro-book/e2e/e2e-env.ts:7-17,47-56`），绝不触碰真实数据。
- 真实模型入口：`bun run test:real-model`（`packages/neuro-book/package.json` scripts；契约见 `docs/testing/README.md:80-90`），需 `DEEPSEEK_API_KEY`，CI 默认不跑。
- 用户视角人工评测：`docs/testing/manual-eval/`（`README.md` 目的/触发/覆盖矩阵、`criteria.md` 判据与严重度、`journeys/` 6 条旅程）。

### J1 首字

- 入口（空态）：项目选择界面「我的书架」零项目空态，含「新建」（`app/components/novel-ide/ProjectPickerScreen.vue:761-764`）与**「打开示例书」**按钮（`ProjectPickerScreen.vue:765-768`；文案 `app/i18n/locales/zh-CN.ts:1707`；空态标题「还没有作品」`zh-CN.ts:1705`）。空态结构见 `ProjectPickerScreen.vue:753-771`。
- 示例书动作：点击触发 `handleOpenSampleBook`（`ProjectPickerScreen.vue:320-347`）→ 调 `openSampleBook()`（`app/stores/novel-ide.ts:1831`）→ `POST /api/projects/sample-book`（`server/api/projects/sample-book.post.ts:11-17`）→ 创建/打开示例工程并返回 `projectRoot`。
- 编辑入口：进入工程后文件树出现（`data-role="workspace-file-tree-root"`），打开章节 → 富文本编辑器（Tiptap `.nb-markdown-editor[contenteditable='true']`）。
- 既成事实（编辑器写入→落盘）：`e2e/01-editor.spec.ts` 覆盖「进入项目 → 搜索定位章节 → 编辑器输入 → `Ctrl+S` → 读隔离 State Root 里的章节文件确认落盘」(该文件 `:11,41,44-47`)。

### J2 AI 首章

- 入口：Agent 面板由 Activity Bar 的 `data-activity-id="agent-panel"` 打开（`app/components/novel-ide/NovelIdeActivityBar.vue:349`）。
- 主链（章节目录）：`docs/testing/manual-eval/journeys/chapter-writing.md`（`novel-writing` 写第一章，目标章节 `manuscript/001-volume/001-chapter/index.md`；通过判据「文件存在、可打开、有实质内容；正文不在聊天里」）。
- 前置：真实 Provider + World Engine 已初始化（`chapter-writing.md`「前置」节）。
- 既成事实（链路，非真实模型）：`e2e/03-agent.spec.ts:14` 用本地 Mock LLM 验证「发起 → 中断」，并断言真的打到了隔离 Mock 端点。

### J3 续写

- 入口：编辑器选中文本 → 选区菜单「加入 AI 引用」（`app/i18n/locales/zh-CN.ts:2766`；`app/components/markdown-studio/MarkdownSelectionMenu.vue`）→ Inline AI 提示条选任务**「续写」**（任务定义 `app/components/novel-ide/NovelPromptBar.vue:82`，`id: continue_after`；文案 `zh-CN.ts:1487`，描述「在引用之后继续写」`zh-CN.ts:1494`）→ 发送。
- 既成事实：Inline AI 为独立 session，与主 Agent 会话分离（`zh-CN.ts:1479-1539`）。
- **缺口**：现有 E2E 无 Inline AI 用例（只覆盖主 Agent 会话）。

### J4 伏笔闭环

- 入口：剧情活动栏 `data-activity-id="plot"` → 剧本工作台入口「剧本工作台」（`app/components/novel-ide/plot/NovelPlotPanel.vue:1768` `data-testid="plot-panel-workbench-entry"`）。
- 默认 tab：剧本工作台默认 tab 为**「承诺账本」**（`app/stores/novel-ide.ts:250`，`plotWorkbenchTab` 初值 `"promises"`）；承诺账本组件 `PlotPromiseLedgerTab.vue`，侧栏另有计数入口「承诺 N」（`NovelPlotPanel.vue:1735-1745`）。
- 闭环语义（数据面）：承诺状态 `open=进行中 / fulfilled=已兑现 / abandoned=放弃`（`app/components/novel-ide/plot/planning/plot-planning.types.ts:57-58`）；节拍 kind `plant=埋设 / payoff=兑现`（同文件 `:85-89`）。「闭环」= 从 `open`（有 `plant` 无 `payoff`）走到 `fulfilled`（有 `payoff`）。
- 既成事实（读侧）：`e2e/05-sample-book.spec.ts:71-82` 断言账本显示「承诺账本(1)」并含伏笔标题；`:131-159` 直接断言接口 `p-rusty-gun` 为 `open`、有 `deadlineChapterId`、至少 1 个 `plant` 节拍、`payoff = 0`。
- 既成事实（写侧）：承诺/节拍有编辑 UI（`PlotPromiseEditorDialog.vue` / `PlotPromiseBeatDialog.vue`），但 **E2E 尚未覆盖写侧闭合**。

### J5 扫 AI 味

- 入口：打开章节 → 编辑器工具栏「扫 AI 味」按钮（`app/components/markdown-studio/MarkdownStudioToolbar.vue:298-308`，`data-role="prose-lint-entry"`；文案 `zh-CN.ts:2739`）。
- 结果面：右侧面板 `data-role="prose-lint-panel"`（`app/components/novel-ide/NovelProseLintPanel.vue:177`；`:6-9` 明确「只读、绝不自动改写正文」），调 `/api/workspace-files/llmlint-check`。
- 既成事实：`e2e/05-sample-book.spec.ts:93-113` 断言工具栏入口可见、面板可见、命中 `li` ≥5；`:116-128` 直接断言接口 `summary.high ≥ 5`。

---

## 与 `docs/testing/manual-eval/` 的分工与复用

> 这一节是本提案的**定位约束**：**不新立旅程体系**，只给现有旅程补量化列。

### 现有体系是什么（事实）

- **已转正**：`docs/testing/manual-eval/README.md`（状态「已转正到 `docs/testing/manual-eval/`，尚未经过真实评测轮次验证」）。
- **6 条 journey**：`startup-check.md`、`workspace-tour.md`、`project-creation.md`、`skill-bootstrap.md`、`chapter-writing.md`、`agent-session.md`（见 `README.md` 第 2 节目录结构）。
- **定性判据**：`criteria.md` 第 3 节（通过 / 部分通过 / 未验证 / 环境阻塞 / 发现问题）+ 第 2 节严重度（P0/P1/P2/观察项）。
- **扩展位**：`README.md` 第 4 节把「剧情工坊（两棵树/场景归属/**承诺账本**/决策记录）」「World Engine 工作台」「导入与用户资产」「设置主题与窄屏」列为**扩展位（本轮不跑）**。

### 逐条映射表（J1–J5 → 现有 journey）

| 本提案动作 | 现有 journey 对应 | 关系 | 处置 |
|---|---|---|---|
| **J1 首字** | `project-creation.md`「新建项目 / 进入工作区」+ `workspace-tour.md`「打开文件 / 编辑保存」 | 高重叠（新用户建书 → 打开 → 写一个字并保存） | **复用现有路径，只补「T0 → 首字落盘」计时**。空态「打开示例书」入口是**新增入口**（现有 journey 走的是「新建项目」），补一条说明即可，不新立旅程 |
| **J2 AI 首章** | `chapter-writing.md`「writer 写第一章」 | **实质同一件事**（都是「AI 写出第一章正文并落盘」） | **合并进 `chapter-writing.md`，只补耗时指标，不新立条目** |
| **J3 续写** | 无（`agent-session.md` 只管主 Agent Composer；`README.md` 覆盖矩阵未列 Inline AI） | 现有体系无对应 | **新增指标**；归属待 GTF 定（挂在 `agent-session.md` 之后，或新建 `inline-ai.md`） |
| **J4 伏笔闭环** | 无文件；但 `README.md` 第 4 节已把「剧情工坊：承诺账本」登记为**待建扩展位** | 现有体系登记过、未建文件 | **新增文件**（建时归「剧情工坊」扩展旅程），只补耗时/操作次数 |
| **J5 扫 AI 味** | 无 | 现有体系无对应 | **新增指标**；归属待 GTF 定（挂 `workspace-tour.md`「顶栏入口」邻近项，或新建条目） |

**结论**：J2 **不新立**（并入 `chapter-writing.md`）；J1 **复用**现有路径（只加量化）；真正**新增**的是 J3、J4、J5 三条。

### 分工（同一批旅程，定性与定量两层，不是替代）

| 层 | 载体 | 回答的问题 | 产出 |
|---|---|---|---|
| 定性（现有） | `manual-eval/` 6 条 journey + `criteria.md` | 这一步**能不能走通 / 有没有问题 / 严重度多少** | 通过/未通过/环境阻塞/发现问题 + P0/P1/P2 |
| 定量（本提案补） | 本文档的指标定义（落到现有或新增 journey 的检查项上） | 这一步**要多久 / 几次点击 / 这次比上次快没有** | 数字（耗时、点击数）+ 目标值（待 GTF 拍板） |

- 量化层**不替代** `criteria.md`、**不另立**严重度体系；它只给检查项**加一列「指标」**。
- 可自动的部分进 E2E 守门（J1 / J4 读侧 / J5）；不可自动的部分（J2/J3 时限）仍由 `manual-eval/` 人工走查（或 `test:real-model`）执行，结果回填到**同一检查项**。

### 复用原则

1. **入口与动作序列尽量引用现有 journey**，格式「见 `journeys/xxx.md` 的『某检查项』」，**不重述**（重述即漂移的起点）。
2. 现有 journey **未定义的新入口**（J1 空态「打开示例书」、J3 Inline AI 工具条、J5 工具栏按钮），本文档给**代码依据（文件:行号）**；待 GTF 接受后由**单独排期的工作**写入对应 journey 文件——**本提案不改 `manual-eval/`**。
3. **不重不漏**：5 这个数字不重要，J2 该并就并，宁少勿重。

---

## 5 条 Journey 看板

> 每条给四项：**入口 / 动作序列 / 计时口径 / 通过判据**；再给**可自动化性**与**现状基线**。目标数值一律标为候选值。

### J1 首字

- **现有对应**：`journeys/project-creation.md`「新建项目 / 进入工作区」+ `journeys/workspace-tour.md`「打开文件 / 编辑保存」——**复用其路径，本文档只补计时**（新增入口：空态「打开示例书」）。
- **入口**：应用启动 → 「我的书架」；零项目空态时用**「打开示例书」**按钮（`ProjectPickerScreen.vue:765-768`）。
- **动作序列**：点「打开示例书」→ 应用创建并打开示例工程 → 文件树出现 → 打开一个章节 → 光标进入编辑器 → 敲下第一个字符 → `Ctrl+S` 落盘。
- **计时口径**（需 GTF 拍板）：
  - `T0` 候选 A＝书架标题「我的书架」可见（应用已可交互）；候选 B＝进程/窗口启动瞬间。**推荐候选 A**，因为「安装/首次迁移/Nitro 构建」是部署问题，不该计入用户写作体验。
  - `T1`＝编辑器内容**首次落盘**（章节文件内容变化，可机器判定）。用「落盘」而非「keydown」是为了排除「看起来写了其实没存」。
- **通过判据**：`T1 − T0 ≤ 目标值`（候选 90 秒，**未经 GTF 确认**）；**且**第一个字符真的落盘；**且**本用例 `console.error = 0`（`e2e/fixtures.ts:14-29`）。不判内容好坏。
- **可自动化性**：**可全自动测**。`e2e/01-editor.spec.ts` 已覆盖「进项目 → 编辑 → 落盘」主体；`e2e/05-sample-book.spec.ts` 已覆盖「空态 → 打开示例书」。需**新写一条**把两者串起来（空根上：空态点示例书 → 打开章节 → 打字 → 落盘）并在两端打时间戳断言。判定标准：**能自动测**。
- **现状基线**：见下方「实跑结果」。冷启动首字（真实安装包、真实首启）**未测**，原因见「未验证清单」。

### J2 AI 首章

- **现有对应**：`journeys/chapter-writing.md`「writer 写第一章」——**同一件事；建议合并进该文件、只补耗时指标，不新立条目**。
- **入口**：Activity Bar `data-activity-id="agent-panel"`（`NovelIdeActivityBar.vue:349`）→ 新建对话 → Composer。
- **动作序列**：打开 Agent 面板 → 新建对话 → 输入「使用 `novel-writing` 写第一章，目标章节是 `manuscript/001-volume/001-chapter/index.md`」（`manual-eval/journeys/chapter-writing.md`）→ 发送 → 等 writer 写完并落盘。
- **计时口径**：`T0`＝点「发送」；`T1`＝第一章正文**落盘**（章节文件出现实质内容）或界面出现明确「已完成」状态（二者取先到，但须是同一判定，建议统一用「落盘」）。
- **通过判据**：**流程**＝文件存在、可打开、有实质内容、正文不在聊天里（`chapter-writing.md` 通过判据）；**时限**＝`T1 − T0 ≤ 目标值`（候选 10 分钟，**未经 GTF 确认**）。**不判**「写得好不好」（第四条边界）。
- **可自动化性**：**部分可自动测**。
  - 能自动测：**链路是否走通**（发起→运行→产出/中断）——`e2e/03-agent.spec.ts` 用本地 Mock LLM 已覆盖「发起→中断」。
  - **不能自动测**：**10 分钟时限**。原因：① 它取决于真实 Provider/模型与网络，Mock 的固定节奏（`e2e-env.ts:54-56`）不代表真实延迟；② 端到端产出与耗时必须在真实模型下才有意义，只能走 `bun run test:real-model`（需 `DEEPSEEK_API_KEY`，CI 不跑）或人工评测（`manual-eval/journeys/chapter-writing.md`）。
  - 结论：**链路可 mock 自动验证；时限只能真实模型/人工测量**。

### J3 续写

- **现有对应**：现有 journey **无对应**（`agent-session.md` 只管主 Agent Composer，未含 Inline AI）——**新增条目**（归属待 GTF 定）。
- **入口**：编辑器选中文本 → 选区菜单「加入 AI 引用」（`zh-CN.ts:2766`）→ Inline AI 提示条任务「续写」（`NovelPromptBar.vue:82`）。
- **动作序列**：打开章节 → 选中一段 → 加入 AI 引用 → 选「续写」→ 发送 → 等结果。
- **计时口径**：`T0`＝点发送；`T1`＝结果可见（流式结束或结果区出现）。若产品以「首字可见」为体验目标，则 `T1` 应改为「首个 token 渲染」——**这点需 GTF 拍板**。
- **通过判据**：流程走通（有结果、未报错、`console.error = 0`）；`T1 − T0 ≤ 目标值`（候选 20 秒，**未经 GTF 确认**）。不判改写质量。
- **可自动化性**：**部分可自动测**。
  - 能自动测：链路（选区→引用→选任务→发送→运行中→停止）可用 Mock LLM 测（与 `03-agent` 同法）；**目前 E2E 完全没有 Inline AI 用例，需新增**。
  - 不能自动测：20 秒是真实模型响应时间，Mock 不能代表。
- **现状基线**：**未测**（无任何 Inline AI E2E）。

### J4 伏笔闭环

- **现有对应**：现有 journey **未建文件**；`manual-eval/README.md` 第 4 节已把「剧情工坊：承诺账本」登记为**待建扩展位**——**新增条目**（建时归「剧情工坊」扩展旅程）。
- **入口**：剧情活动栏 `data-activity-id="plot"` → 「剧本工作台」（`NovelPlotPanel.vue:1768`）→ 默认 tab「承诺账本」（`novel-ide.ts:250`）。
- **动作序列**：打开剧本工作台 → 看到未兑现伏笔 → 打开该承诺 → （**闭环定义待 GTF 拍板**）：
  - 读侧闭环：看到「进度/节拍」→ 确认它未兑现；
  - 写侧闭环：登记一次 `payoff` 节拍 → 状态由 `open` 变 `fulfilled`。
- **计时口径**（需 GTF 拍板闭环含义后固定）：`T0`＝打开剧本工作台；`T1`＝或「承诺可见」或「完成一次兑现登记」。若取写侧，建议同时记录**交互次数**（点击/输入次数）作为与机器无关的补充指标。
- **通过判据**：账本渲染正确（含目标伏笔、状态、节拍）；时限或交互次数 ≤ 目标值（候选 60 秒 / 未定交互次数，**未经 GTF 确认**）。不判伏笔埋得好不好。
- **可自动化性**：**读侧可全自动测；写侧可扩展为自动测**。
  - 读侧：`e2e/05-sample-book.spec.ts:71-82,131-159` 已断言账本与接口数据（`open` + 有 `plant` + `payoff = 0`）。
  - 写侧：承诺/节拍有 UI（`PlotPromiseEditorDialog.vue`/`PlotPromiseBeatDialog.vue`）与接口，**可补 e2e 断言「登记 payoff 后状态变 fulfilled」**，属可自动测范围。
- **现状基线**：读侧已绿（见实跑结果）；写侧闭合**未测**。

### J5 扫 AI 味

- **现有对应**：现有 journey **无对应**——**新增条目**（归属待 GTF 定：挂 `workspace-tour.md`「顶栏入口」邻近项，或新建条目）。
- **入口**：打开章节 → 编辑器工具栏「扫 AI 味」按钮（`MarkdownStudioToolbar.vue:298-308`）。
- **动作序列**：打开章节（第 3 章）→ 点「扫 AI 味」→ 右侧抽屉列出命中（`NovelProseLintPanel.vue:177`）。
- **计时口径**：报告给的是**点击次数**（不是秒）。定义为「章节已打开 → 命中列表可见」所需的点击次数（章节打开本身计 1 次）。
- **通过判据**：**点击次数 ≤ 目标值（候选 2 点击，未经 GTF 确认）**，且命中列表可见、命中 ≥1（示例书第 3 章 ≥5）。不判「是否真的没有 AI 味」。
- **可自动化性**：**可全自动测**（含点击计数）。`e2e/05-sample-book.spec.ts:93-128` 已断言「章节打开 → 点工具栏入口 → 面板可见 → 命中 ≥5 → 接口 `summary.high ≥5`」。可再加「点击计数」断言使其等价于「2 点击」指标。
- **现状基线**：已绿（见实跑结果）。

### 看板摘要表

| 编号 | Journey | 现有 journey 对应 | 入口（代码依据） | 计时口径 | 通过判据 | 能否自动测 | 现状基线 |
|---|---|---|---|---|---|---|---|
| J1 | 首字 | `project-creation.md` + `workspace-tour.md`（复用，只补量化） | 书架空态「打开示例书」`ProjectPickerScreen.vue:765-768` | 书架可交互 → 首字符落盘 | ≤候选 90s + 落盘 + console.error=0 | ✅ 可（需补一条串起空态→首字） | 主体已覆盖，冷启动未测 |
| J2 | AI 首章 | `chapter-writing.md`（**合并，只补指标**） | Agent 面板 `NovelIdeActivityBar.vue:349` | 发送 → 章节落盘 | ≤候选 10min + 流程走通 | ⚠️ 链路可（mock）；时限不可 | 链路已绿；真实时限未测 |
| J3 | 续写 | **无（新增）** | Inline AI「续写」`NovelPromptBar.vue:82` | 发送 → 结果可见 | ≤候选 20s + 有结果 | ⚠️ 链路可；时限不可 | **未测**（无 Inline AI e2e） |
| J4 | 伏笔闭环 | **无文件（README 扩展位，新增）** | 剧本工作台→承诺账本 `NovelPlotPanel.vue:1768`、`novel-ide.ts:250` | 打开工作台 → 闭环动作完成 | ≤候选 60s + 数据正确（闭环定义待定） | ✅ 读侧可；写侧可扩展 | 读侧已绿；写侧未测 |
| J5 | 扫 AI 味 | **无（新增）** | 工具栏「扫 AI 味」`MarkdownStudioToolbar.vue:298-308` | 章节已打开 → 面板可见的点击次数 | ≤候选 2 点击 + 命中≥5 | ✅ 完全可 | 已绿 |

---

## 实跑结果（真实命令与输出）

**命令**：`bun run test:e2e`（等价 `bun run --cwd packages/neuro-book test:e2e`）
**结果**：`6 passed (2.2m)`（Playwright list reporter，含服务启动约 2m15s 挂钟）。

各用例耗时（测试体，Dev Server 已预热后）：

| # | 用例 | 耗时 | 对应 Journey |
|---|---|---|---|
| 1 | 主链路①：进入项目并在编辑器中写入正文 | 4.6s | J1 主体（进项目→编辑→落盘） |
| 2 | 主链路②：剧本工作台切换关键帧 tab 并新建一个帧 | 3.6s | （J4 相关工作台交互） |
| 3 | 主链路③：发起 Agent 会话并中断运行 | 3.8s | J2 链路（mock，非真实模型） |
| 4 | 主链路④：换主题 → 关键帧面板完全跟随 | 4.7s | （token 化护栏，非本看板） |
| 5 | 主链路④：剧情定位视图计数徽标跟随 | 8.1s | （token 化护栏，非本看板） |
| 6 | 主链路⑤：空态即演示（示例书 + 伏笔 + 扫 AI 味 ≥5） | 6.9s | J4 读侧 + J5 + J1 空态入口 |

**结论**：现有 E2E 全绿。**J5 现状达标（面板可达、命中 ≥5）；J4 读侧达标（未兑现伏笔可见）；J1 主体链路通**。

**重要限定**：以上是**开发服务器（Vite Dev，已预热）+ 本地 Mock LLM + 隔离根**环境的耗时，**不等于**「安装包冷启动 → 用户首字」或「真实模型 → AI 首章」的真实耗时。它只能证明**链路走通**，不能作为 J1/J2/J3 时限指标的最终基线。

---

## 目标值的性质标注（待 GTF 拍板）

报告给出的 5 个数值**均为建议值、未经 GTF 确认**。下表把它们呈现为候选值 + 推荐理由。

| 编号 | 报告建议值 | 性质 | 我的推荐/依据 |
|---|---|---|---|
| J1 | 90 秒 | 候选，**未确认** | 取决于 `T0` 定义。若 `T0`＝书架已可交互（推荐），90s 可作为候选；若含首次安装/迁移/构建，90s 在 Dev/首启下不现实，应单向拆开。**建议：先冻结 `T0`，再定数值。** |
| J2 | 10 分钟 | 候选，**未确认** | 无依据支撑具体数值；它取决于模型、章节字数、是否含 World Engine 初始化。**建议：先冻结「一章多少字 / 是否含初始化」，再定上限。** |
| J3 | 20 秒 | 候选，**未确认** | 取决于 Provider 首字延迟；Mock 不能代表。**建议：明确 `T1` 是「首字」还是「完成」。** |
| J4 | 60 秒 | 候选，**未确认** | 秒数与人手速强相关。**建议：同时记录交互次数，二者取一或并用。** |
| J5 | 2 点击 | 候选，**未确认（但强关联事实）** | **有产品事实支撑**：入口就在编辑器工具栏（`MarkdownStudioToolbar.vue:298-308`），「章节已打开 → 点 1 次按钮 → 面板可见」是确定路径。**推荐保留「2 点击」并以点击计数自动断言**（机器可判、与延迟无关）。 |

## 方案、备选方案与取舍

### 方案 A（推荐）：冻结「体验打磨」，给现有 manual-eval 旅程体系补一个量化层

- 给 5 个关键动作各定义**耗时 / 操作次数**指标；`PROJECT-STATUS.md` 改为指向这些指标（见「文档挂接」）。
- **不新立旅程体系**：J2 并入 `chapter-writing.md`（只补指标）；J1 复用 `project-creation.md`+`workspace-tour.md` 的路径；仅 J3/J4/J5 新增条目。
- 可自动测的（J1/J4 读侧/J5）进 E2E 守门；涉及真实模型的（J2/J3 时限）用「链路自动化 + 时限真实模型/人工」双轨，人工部分即现有 `manual-eval/`。

### 方案 B：给「体验打磨」补一句完成定义

- 保留「体验打磨」字样，追加一句「当 5 项指标全部达标即完成」。
- 取舍：改动最小，但保留了易被误读的投入式措辞，且没有把判据落到可执行层。

### 方案 C：只做人工评测，不进 E2E

- 完全依赖 `docs/testing/manual-eval/`，每轮人工走查。
- 取舍：覆盖真实模型体验较好，但不可回归、不可自动守门，无法作为持续验收基线。

### 方案 D：另起一套并列的 5 条 Journey 文档

- 在 `docs/testing/manual-eval/` 之外或并列再维护 5 条新 journey。
- 取舍：**否决**。它会与现有 6 条 journey 各自维护、必然漂移；本项目已吃过「两套并存」的亏。

**取舍结论**：采用**方案 A**——**在现有旅程上补量化列**，可自动测的自动化、不可自动测的走真实模型/人工；不采用方案 B（判据不落地）与方案 D（两套并存）。方案 C 的人工评测体系作为 J2/J3 时限测量的执行场。

## 数据、接口、安全、迁移、发布与回滚影响

- **数据/接口**：无新增持久化、无 schema 变更、无公开接口变更。J1–J5 复用的既有接口：`/api/projects/sample-book`（`server/api/projects/sample-book.post.ts`）、`/api/workspace-files/llmlint-check`、`/api/projects/plot/promises`。
- **安全/权限**：无变化。E2E 继续在隔离 State/Cache Root 与独立端口上跑（`e2e/e2e-env.ts`），不触碰真实数据。
- **迁移/发布**：无迁移。本提案只新增一个文档与（生效后）E2E 用例与 `PROJECT-STATUS.md` 一处措辞。
- **回滚**：删除本提案文件、回退 E2E 用例、还原 `PROJECT-STATUS.md` 一句即可，无数据影响。

## 对 Spec 的预期改动

- 本提案本身**不产生** `planned` Spec。依据 `docs/specs/AGENTS.md:6`：`planned` 必须有 accepted Proposal 或明确人类批准——本提案当前为 `draft`，待 GTF 决策后才可能进入 `planned`。
- 若 GTF 接受，预期改动（供后续 Task 参考，本次不改）：
  1. `PROJECT-STATUS.md:47` 的写作模式 v1 状态措辞改为指向本指标（见下）。
  2. 新增/扩展 E2E 用例：J1「空态→首字→落盘」打点、J3 Inline AI「引用→续写→结果」、J4 写侧「登记 payoff → 状态 fulfilled」、J5「点击计数」断言。
  3. **给现有 journey 补量化列**（属 `docs/testing/manual-eval/` 的改动，**单独排期，不在本次**）：`chapter-writing.md` 补 J2 耗时、`project-creation.md`/`workspace-tour.md` 补 J1 计时；新增 J3/J4/J5 对应 journey 文件（J4 归「剧情工坊」扩展旅程）。
  4. J2/J3 真实模型时限的测量方法登记到 `docs/testing/manual-eval/`（或在 `test:real-model` 下加测量）。
- **不涉及**写入 `docs/doctrine/`、不改写作宪法、本次不改 `docs/testing/manual-eval/` 任何文件。

## 与现有文档的挂接

1. **`PROJECT-STATUS.md:47` 改写建议**（只给建议，**不实际修改**）：
   - 现状：`| 写作模式 v1 | 主路径阶段完成，进入体验打磨 | ... |`
   - 建议改为：`| 写作模式 v1 | 主路径阶段完成；体验目标改用 5 条 Journey 看板（J1 首字 / J2 AI 首章 / J3 续写 / J4 伏笔闭环 / J5 扫 AI 味）验收，目标值待 GTF 拍板，见 docs/proposals/writing-experience-journey-metrics.md | ... |`
   - 要点：删掉无定义的「进入体验打磨」，换成**可指认的看板 + 明确「待拍板」状态**。
2. **注册到 Proposals 索引**（建议由 GTF/Leader 执行，本次不改）：在 `docs/proposals/README.md`「当前活跃提案」列表中追加一行：
   - `[`writing-experience-journey-metrics.md`](./writing-experience-journey-metrics.md)：冻结「体验打磨」，给 `docs/testing/manual-eval/` 现有旅程体系补量化指标层，状态为 `draft`。`
3. **与 `docs/testing/manual-eval/` 的关系（重要）**：本提案是现有旅程体系的**量化层**，不是替代：
   - 定性 = 现有 6 条 journey + `criteria.md`（走查、找问题、判定类别/严重度）；
   - 定量 = 本文档的指标（耗时/操作次数 + 目标值），**落在现有或新增 journey 的检查项上**。
   - 归属处置：**J2 并入 `chapter-writing.md`**；**J1 复用** `project-creation.md`+`workspace-tour.md`；**J3/J4/J5 新增**（J4 归「剧情工坊」扩展旅程，`README.md` 第 4 节已登记该扩展位）。
   - 本次**不改** `manual-eval/` 任何文件；把指标写进 journey 属**单独排期的工作**。

## 决策记录

| 日期 | 决策者 | 结论 |
|---|---|---|
| 2026-09-17 | software-product-manager（提案） | 提出冻结「体验打磨」、改用 5 条 Journey 指标；状态 `draft`。 |
| 2026-09-17 | software-product-manager（依 team-lead 复核修正） | **定位改为「给 `docs/testing/manual-eval/` 现有旅程体系补量化层」，不新立第二套旅程**；逐条映射：J2 并入 `chapter-writing.md`、J1 复用现有路径、仅 J3/J4/J5 新增。 |
| 待定 | GTF | **待拍板**：5 个目标数值（90s/10min/20s/60s/2 点击）；`T0` 定义；J2/J3 时限是否纳入本届验收；J4「闭环」取值侧还是写侧；J3/J5 归入哪条/是否新建 journey。 |
