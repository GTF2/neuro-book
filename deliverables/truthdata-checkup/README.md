# 真稿规模体检（224 章真数据 · 零成本链路）

> 作者：software-engineer ｜ 任务：用 224 章真稿的**副本**跑一遍**不花钱**（零 LLM）的链路，找卡点。
> 证据目录：`evidence/`（全部为真实命令输出）。

---

## 0. 一句话结论

**没有发现真正的性能卡点**：真稿规模（224 章 / 322 场景 / 236 正文文件）下，文件索引冷建 ~0.65s、暖读 ~0ms，llmlint 全量静态扫描 236 文件仅 **1.48s**，关键 API 都在 8–63ms（含 948KB 的 322 场景树），前端「进项目→文件树」1.1–1.5s（且被 Vite dev 噪声抬高）。**唯一「卡点」是测量本身**——dev 模式数字被 Vite 重优化污染；真正该补的是「真稿规模的生产构建基线」，而不是修某段慢代码。

> ⚠️ 另有一件**必须单独汇报**的事：体检期间发现**原件 `project.sqlite` 被一个并发运行的真实数据 dev server 改动**（不是我——见 §2 证据）。真稿正文（236 个 `.md`）**字节级完全未变**。

---

## 1. 真稿规模（副本实测，4 处数据源交叉一致）

| 维度 | 数值 | 来源 |
|---|---|---|
| 项目文件数 / 体积 | **319 文件 / 12.9 MB** | 原件→副本清单 |
| manuscript 正文 | **236 个 .md**（224 章 + 12 卷/总索引） | 文件枚举 |
| 卷 / 章 | **10 卷 / 224 章** | `project.sqlite` StoryAct=10、StoryChapter=224 |
| 场景 | **322** | `project.sqlite` StoryScene=322 ｜ API `totalScenes=322` |
| 线索 / 阶段 | **9 / 3** | StoryThread=9、StoryPhase=3 |
| 关键帧 / 决策 | 4 / 1 | StoryKeyframe=4、StoryDecision=1 |
| 世界观 | Subject 22 / Slice 22 / Patch 181 | WorldSubject/WorldSlice/WorldPatch |
| 历史库 | file_snapshot 377 / operation_log 405 | `history.sqlite` |
| **用户级 `.nbook`** | **1.7 GB** | 几乎全在 `agent/`（agent 会话数据），**与真稿正文无关** |

**重要认知**：报道里说的「1.86 GB 真稿」体积，**1.7 GB 其实是用户级 agent 会话数据**，真稿正文本身只有 **12.9 MB（3.3 MB 纯正文）**。任何「按体积估算性能风险」的直觉在这里都不成立——真稿是「几百个小文件」，不是「大文件」。

---

## 2. 原件未被改动的证据（数据安全，第一约束）

### 2.1 我的测量全程只读副本（已证实）
- 所有读写对象 = 副本：`%TEMP%\nbook-truthdata\state\workspace\xin-xiao-shuo`。
- 我的 app 的 `workspace-files/tree` 响应里每个节点的 `absolutePath` 都是 **`C:\Users\Administrator\AppData\Local\Temp\nbook-truthdata\state\workspace\xin-xiao-shuo\...`**（见 `evidence/...`），`/api/projects` 只返回 1 个项目——**我的进程从未打开真实项目，不存在指向原件 project.sqlite 的句柄**。

### 2.2 清单 + sha256 对比（项目目录，319 文件）
| | 值 |
|---|---|
| 跑前：文件数 / 字节数 | 319 / 13,569,652 |
| 跑前：逐文件 sha256 列表的 sha256 | `5b7fd3ef29b57a06a2d9dca989ec0554a65b424e2eaf00c30cde23d30ebaaac3` |
| 跑前：`relpath+bytes+mtime` 列表的 sha256 | `5e5b50c7c46ff530aeea6ba84172b5a3f0afff021b3e7e39a487d775d5be1ca7` |
| 跑后：**文件清单** | **完全一致（无增删改名）** |
| 跑后：唯一内容变化的文件 | **`.nbook/project.sqlite`**（其余 318 文件字节级不变） |

（原始输出：`evidence/original-before-digest.txt`、`evidence/original-after-compare.txt`）

### 2.3 为什么我不能给出「两次 sha256 完全一致」的清白结论 —— 如实说明
体检窗口内，**原件 `project.sqlite` 被改动了多次**（content hash 与 mtime 均变）。我**没能**让它保持不动，但证据表明**不是我做的**：

1. **它在我完全停手时也会动**：`evidence/zz_watch.txt` 记录，在我的 app 已停、我未做任何操作时，`project.sqlite` 于 20:09:26 自行从 `04df08…` 变为 `e2d083…`。
2. **现场有一个并发运行的真实数据 dev server**：端口 **3000** 上常驻一个 `node …/node_modules/@nuxt/cli/bin/nuxi.mjs dev --no-fork`（`evidence/zz_p3000.txt`），**PID 反复更换**（30596 → 29756 → 31620 → 1568 …），说明它在**反复重启**；它用的是默认端口 = 默认（真实）State Root。
3. **因果链（最可能）**：并发会话在共享仓库里反复 **重新生成 Prisma 客户端**（`server/generated/project-prisma/internal/prismaNamespace.ts` 本体检期间 mtime 多次刷新）；这会击崩正在运行的 dev server（我的 app 也因此崩过一次，见 §5）。那台 3000 的 app 每次重启都会**重新打开真实项目 → 写 `project.sqlite`**。我的 app 启动/活动恰好会触发热重生成与系统负载，时间上与之重叠——所以写入时点与我的活动相关，但**执行写入的是那台真实数据 app，不是我的**。

**结论**：真稿**正文与全部内容文件字节级未变**；变化的只有一个运行时数据库 `project.sqlite`（真实 app 的正常运行态写入）。我无法单方面冻结一个**别人正在运行的 app**，故此项**未能给出干净的双哈希一致**——如实标注为**偏差**，不作「一致」的假结论。

> 建议：若要严格做「原件只读」dogfooding，应先请**所有并发会话停掉 port 3000 的真实 dev server**，再复跑本体检。

---

## 3. 卡点清单

> 口径：服务器侧为「进程内直调 + 本机磁盘已缓存」；API 为「dev server 预热路由后 warm」；前端为「Vite dev、无预热、含 504 噪声」。
> 判断标准：与「224 章该有的量级」对比，并区分「真问题」与「大文件/dev 本来就这样」。

| # | 测什么 | 怎么测 | 实测 | 对比 / 判断 | 结论 |
|---|---|---|---|---|---|
| 1 | **文件索引冷建** | 进程内 `openProject`→`fileIndex.read()`（首次） | **623–691 ms**（583 节点） | 319 文件全树扫描；亚秒级符合预期 | ✅ 正常 |
| 2 | 文件索引**暖读** | 第二次 `fileIndex.read()` | **~0 ms** | 缓存命中 | ✅ 正常 |
| 3 | 打开项目（控制面） | `openProject` / `POST /api/projects/open` | 进程内 227–245ms；HTTP 冷 401ms、暖 8–10ms | 索引在后台异步预热，open 本身极快 | ✅ 正常 |
| 4 | **有无超线性** | 连续两轮「开→冷建→关」 | run1≈run2（690/623、245/227ms） | 两轮几乎相同 → **无越用越慢迹象** | ✅ 正常 |
| 5 | 工作区文件树 API | `GET /api/workspace-files/tree` | 冷（含建索引）**992ms**；暖 **34ms**；payload **820KB / 583 节点** | 一次性的冷建；暖态极快 | ✅ 正常 |
| 6 | **llmlint 全量静态扫描** | `llmlint check <manuscript> --review all`（**纯本地规则，零 LLM**） | **1.48 / 1.48 / 1.46 s**（236 文件 / 812K 可见字） | app 单文件超时是 **60s**，238 倍余量 | ✅ 正常 |
| 7 | llmlint 单文件 | 单章 10.6KB | **72 ms** | 编辑器按文件调用，远低于超时 | ✅ 正常 |
| 8 | llmlint 命中分布 | 解析 JSON | **3936 命中**（high 48 / medium 3266 / low 622），**91 条规则**命中（库里 360 条，启用 266） | 单章最高 70 命中；正文中位 3260 字 | ✅ 分布合理，未见异常 |
| 9 | 剧情数据 API（322 场景树） | `GET /api/projects/plot/tree` | **63 ms / 948KB** | 322 场景 + 224 章 + 10 卷序列化 | ✅ 正常 |
| 10 | 剧本工作台 API | `GET /api/projects/plot/workbench` | **54 ms / 669KB** | | ✅ 正常 |
| 11 | llmlint HTTP 端点 | `POST /api/workspace-files/llmlint-check`（单文件） | **86–109 ms** | 含 spawn 一个 CLI 进程 | ✅ 正常 |
| 12 | **前端：进项目→文件树就绪** | Playwright，`?project=xin-xiao-shuo`，3 轮 | **1114 / 1542 / 3559 ms**（中位 1542） | 有多次 `504 Outdated Optimize Dep` → **数字被 Vite dev 重优化抬高** | ⚠️ 噪声污染，非数据规模问题 |
| 13 | 前端：文件树→打开 10.6KB 章 | Playwright | **339 / 359 / 360 ms** | 稳定 | ✅ 正常 |
| 14 | 前端：工作台渲染（承诺账本） | Playwright | **108 / 244 / 250 ms** | 首轮偏低（缓存）；稳定 ~244ms | ✅ 正常 |
| 15 | 正确性：规模与预期一致 | DB 计数 vs API 计数 | Chapter 224=224、Scene 322=322、Act 10=10、Thread 9=9 | 全部一致 | ✅ 无数据不一致 |
| 16 | 正确性：响应错误 | 全部 API | 全 200（我故意打的 `/plot/chapters` 404 属预期，因无该列表路由） | 无 5xx | ✅ 无报错 |

### 「真问题」vs「本来就这样」的判断依据
- **索引/扫描慢不慢**：224 章=236 文件，冷建 0.65s、暖读 0ms——**这是「几百个小文件」的正常量级**，不是慢。所谓「1.86GB 真稿」的 1.7GB 是 agent 会话数据，跟正文索引无关。
- **前端 1.5s 是慢吗**：e2e 空环境基线（同一 dev 模式）首屏稳态约 **~1.7s**；真稿 3 章→224 章，进项目耗时**没有量级变化**，那 1.1–3.6s 的抖动来自 Vite dev 的重优化（504），**不是 224 章数据造成的**。故**判定为正常，但测量口径不干净**。

---

## 4. 最值得先修的一项

**不是去优化某段慢代码（没有），而是把「真稿规模」从一次性探针固化成常规 dogfooding 基线——并且必须在「生产构建 + 真稿副本 + 无并发」三条约束下跑。**

理由：
1. 本次唯一测出的「卡点」就是**测量本身**：dev 模式的 Vite 重优化（504）把前端数字污染到 1.1–3.6s 的不可比区间；只有生产构建才能给出可比的真稿性能数字。
2. 这恰好补的是体检**发现 #11（224 章规模下零性能预算/基线）**与**发现 #12（真稿沉睡、无 dogfooding 机制）**——缺的不是优化，是**可重复的观测闭环**。本次已把方法（隔离 State Root 副本 + 零成本链路 + 口径定义）跑通，可直接固化成脚本/CI 任务。
3. 附带一条**运维级卡点**：并发会话的真实 dev server 会因共享仓库的 Prisma 重生成而**反复崩溃重启**（连带改动真实 `project.sqlite`）。要 dogfooding 真稿，先得让「一台、且只有一台」app 独占真实数据；否则连「原件只读」都保证不了。

---

## 5. 未能覆盖 / 偏差（如实）

1. **原件双哈希「完全一致」未能达成（偏差）**：并发运行的真实 dev server 持续写真实 `project.sqlite`；已定位为外部进程（见 §2），**正文未变**，但无法给出干净一致结论。
2. **前端数字被 dev 噪声污染**：测量跑在 Vite dev（无预热），出现 `504 Outdated Optimize Dep`；能给出**量级与稳定性**，但**不能作为生产性能数字**。且我的 app 有一次因**并发 Prisma 重生成**在运行中被击崩（`project-prisma/internal/prismaNamespace.ts` ENOENT，exit 5），首轮前端测量因此失败，后重跑成功。
3. **未做 LLM/Agent 链路**（按零成本原则刻意排除）：`detect`（P(AI) 神经检测）、任何 Provider 调用都不在本次范围。
4. **未做「全量扫描」产品路径**：app 的 llmlint 入口是**单文件**（编辑器按文件调用）；「236 文件 1.48s」是 **CLI 能力**，不是 app 的既有路径——app 目前**没有**「整本项目一键扫描」入口，故无对应产品耗时。
5. **未覆盖写路径/并发写**：只读体检；未测 224 章规模下的保存、rename、大规模 mutate、并发编辑。
6. **未覆盖真稿的 agent 数据（1.7GB）**：会话/向量检索等 agent 面未测。
7. **未覆盖内存**：除一次崩溃外未系统采内存；那台外部 app 常驻 **3.8GB**，值得后续单看。

---

## 6. 方法与复现（零成本、只读）

1. **隔离 State Root**：`mkdir %TEMP%\nbook-truthdata\state\workspace` → `cp -a <原件项目> …\xin-xiao-shuo`（排除 1.7GB 的用户级 `.nbook\agent`）。全程 `NEURO_BOOK_STATE_ROOT/CACHE_ROOT` 指向 temp。
2. **服务端索引/扫描**：进程内直调 `openProject/listProjects/fileIndex.read`（`listProjects` 显式传副本 workspaceRoot）。
3. **llmlint**：`bun packages/llmlint/skill/bin/llmlint.ts check <副本>\manuscript --review all --format json`（`check` 为纯静态规则）。
4. **API**：`e2e 同款 serve`（隔离根 + 独立端口 3460 + 本地 mock LLM，**不播种**），`curl` 逐路由「先预热再计时 3 次」。
5. **前端**：`node + playwright-core`，`?project=xin-xiao-shuo`，先预热一轮再计 3 轮。

原始证据：`evidence/` 全目录。临时副本与探针脚本体检结束后清理。
