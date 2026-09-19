# Agent 对话界面重设计 · 交接说明

> 基于 6 个高保真原型（见文末文件清单）整理。每个方案含：现状问题、设计决策、待确认项。
> 所有方案共用同一套设计原则与视觉语言，建议作为同一批改造实施。

---

## 方案一：编辑失败卡片重设计

**原型文件**：`edit-failure-redesign.html`（右上角可切新旧版对比）

### 现状问题
- 同一段预检报错被**重复渲染两遍**，平铺占半屏
- 报错全是开发者黑话：`Edit preflight failed`、`edits[0]`（零基索引）、`oldText was not found. It must match exactly.`
- 只说 `edits[0]` 失败，但没在 diff 里标出是哪一处，用户要自己数索引对号
- `5 edits` 徽标没有传达"批量编辑一损俱损（原子操作）"的语义
- 没有任何"下一步该干嘛"的出口

### 设计决策
1. **折叠态只占一行**：红叉行右侧加红色 pill 汇总徽标 `⚠ 1/5 处未匹配`（即"右侧汇总"），点击整行展开详情
2. **结论先行的警告条**：琥珀色 banner 一句话讲完"是什么 + 为什么 + 后果"——"5 处改动全部未写入：第 1 处找不到目标文本。为避免文件只改一半，本次批量编辑已整体取消"
3. **改动清单**：失败项红色置顶，序号从 1 开始（不用 `edits[0]`），成功项显示命中行号（第 55 行…）
4. **失败 diff 红色虚线框 + 排查提示**：框出失败改动，下方挂蓝色提示块显示"文件该区域当前内容"，高亮标出差异字符（如引号不一致），附原因猜测
5. **操作出口**：「重新尝试」（重试前应自动重读文件）/「跳过此次编辑」
6. **原始报错只渲染一次**，收进「技术详情」折叠区，默认收起——保留排查能力但不怼脸

### 待确认
- 失败条目默认展开整卡，还是只展开一行摘要
- 警告条用琥珀色还是红色系（与失败语义统一）

---

## 方案二：对话导航重设计

**原型文件**：`conversation-nav-redesign.html`（右上角可开关导航面板对比）

### 现状问题
- Agent 对话内容极长（用户一句话 → Agent 干几十步），拉进度条无法定位
- DeepSeek 式折叠不能直接照搬：DeepSeek 折叠单元是"一轮问答"，Agent 场景下回合内仍有几十步，折完还是一大坨

### 设计决策（三层）
1. **主时间线自动分组折叠**：连续同类步骤聚成"工作块"，默认收拢成一行（`📖 勘察 · 读取 14 个文件`、`✏️ 编辑 · 6 个文件 · 1 处失败`）。**成功收拢、失败展开**，运行中的块显示蓝色转圈
2. **右侧大纲面板（核心新增）**：类文档目录。用户提问为粗体锚点（带时间），Agent 每个工作块一行 = 图标 + 一句话 + 状态标记（✓ 绿 / ✕ 红 / ● 蓝）。点击平滑跳转 + 目标闪烁；滚动主时间线时大纲联动高亮当前块；顶部有「全部展开 / 收起」
3. **回合级折叠**：整个回合可再折成一行（DeepSeek 手感），用于跨回合长距离跳转

### 关键约束
- 工作块摘要**由工具元数据模板拼装**（文件名、数量、退出码），不依赖 AI 生成——准确、零延迟、零成本

### 待确认
- 大纲放右侧（当前方案）还是做成每条消息左侧的"−"折叠钮，或两者都要
- 回合很多时大纲本身是否支持按回合折叠

---

## 方案三：工具卡片人话化

**原型文件**：`tool-card-redesign.html`（右上角可切新旧版对比；「✨ AI 解释这步」按钮可点）

### 现状问题（以 execute_sql 为例）
- SQL 埋在转义 JSON 字符串里（`\"sortOrder\"`），需要人工反转义
- 结果直接展示内部字段 jargon：`mode: write`、`effects.refreshChapterTree: false`
- 整块卡片没有"这步在干嘛"的说明
- ARGUMENTS / RESULT 两节各挂一排工具图标，视觉噪音大

### 设计决策
1. **标题人化**：`执行 SQL`（`execute_sql` 降为灰色小标签），右侧直接给结论 `写入 · 224 行受影响 · 0.3s`
2. **摘要两级策略（已拍板：按需生成）**
   - 默认：灰色虚线框**模板摘要**，结构化字段直接拼装（`UPDATE "StoryChapter" · 影响 224 行 · WHERE…`），零 token、零延迟
   - 按需：点「✨ AI 解释这步」→ 加载态 → 原地替换为蓝色 AI 解释条（带 `↻` 重新生成）
   - **架构要求：解释请求是旁路调用**——只携带该工具的参数与结果，回答就地渲染，**不进入主对话上下文**（否则摘要本身成为新的噪音源、污染 Agent 流程）
3. **结构化渲染**：
   - SQL：去转义、格式化、语法高亮，仅一个复制按钮
   - 结果 → 事实块：`影响行数 224 ✓` / `UPDATE` / `返回行 0` / `章节树刷新 不需要`
   - 命令：命令行 + 退出码 + 输出仅露末尾 N 行（完整输出折叠）
4. **术语翻译表**：字段名映射人话，jargon 解释藏 ⓘ tooltip（如 refreshChapterTree：前端缓存标志，false 表示界面无需刷新）
5. **原始 JSON 收进折叠区**（「原始参数 / 原始结果」），排查时再看
6. **渲染器覆盖所有工具类型**：SQL → 格式化 + 影响行数；文件 → 路径 + diff 摘要；命令 → 命令 + 退出码 + 输出尾部；网络请求 → 方法 + URL + 状态码；**未知工具兜底** → 关键字段摘要 + 原始 JSON 折叠

### 待确认
- 失败的步骤要不要默认自动配 AI 解释（失败场景大概率需要看懂；当前统一手动）

---

## 方案四：队列投递重设计

**原型文件**：`queue-stuck-redesign.html`（右上角切新旧版对比；「情景」切换卡住 / 运行中 / 空闲；「▶ 演示自愈」「▶ 演示：重试超限」展示完整状态流转）

### 现状问题
- 队列条只渲染一行 10px 小字（`AgentComposer.vue:525-536`）：`队列 <system-reminder> agent #26 返回: {"status":"completed"}`——不显示来源、不显示原因、无任何操作
- 队列暂停后不会自愈：唯一复位入口是「会话运行中 + 用户 Ctrl+Enter 排队」（`enqueueFollowUp` 写 ready）；`enqueueDurableSystemFollowUp` 遇到 paused 会保持 paused，没有超时/重试
- 「为什么在排队」的数据前端其实已有（`followUpQueue.status` / `pausedBy.reason|message`，`useAgentSession.ts:546-551` 已同步），但 `AgentChatSurface.vue:326-329` 只取了 `.items`，状态被丢弃
- 「谁发的」数据服务端已有（`StoredFollowUpQueueItem.caller` / `messageIdentity`，`stored-types.ts:60-73`），但 `projectQueuedMessage` 未投影（`public-queue-projection.ts:17-31`）
- 界面没有任何处理队列的入口：服务端只有 abort 的 `clearQueue`（默认清空），没有单条送达/忽略/恢复接口

### 设计决策
1. **折叠条一行聚合（默认折叠）**：平时只占一行——运行中「2 条将在本轮结束后送达」（灰色低调、不抢注意力）；暂停「队列已暂停 · N 条消息没有送达」（琥珀，附原因）。**批量操作全部收在折叠条右上角**（「全部忽略 / 全部送达 / 详情·收起」），不展开也能完成处理；展开面板不再重复条数与原因（折叠条已表达），只列条目
2. **来源徽标 + 人话标题**：`你` / `后台任务`；通知标题形如「#26 子任务已完成 · 任务标题」，原始 `<system-reminder>` 收进「查看原文」折叠
3. **每条可操作，且功能集中在条目行的右上角**：空闲「立即送达」（马上投递并出现在对话里）；运行中「优先送达」（置顶，本轮结束后第一个送，不打断当前轮）；「忽略」直接生效（toast 提示），批量「全部忽略」两步确认。「原文」改为带小箭头的文字按钮，与操作按钮同排右对齐；条目保持单行紧凑（约 60px/条），四到五条滚动一下即可看完
4. **自愈规则**：暂停后会话空闲时自动重试（3 次、退避）；超限转「需人工」态（横幅说明原因 + 「手动重试」）
5. **技术详情折叠**：`status / pausedBy.reason / retryAttempt` 默认收起，排查时再看
6. **展开窗口限高 + 滚动 + 可拖拽**：面板默认限高约 240px、内容内部滚动；底部把手可拖动调整高度（120px ～ 视口 60%）、双击复位。折叠态始终只占一行，展开不挤占对话区
7. **与 Workflow 待处理面板区分**：原型同屏展示两者语义差异（队列 = 消息投递；Workflow = 等你回答），本次不改后者

### 预计改动点
- DTO：`AgentQueuedMessageDto` 增来源字段（从 caller 白名单投影，不暴露 profileKey 等内部信息）；`AgentFollowUpQueueStateDto` 增自愈状态（如 `autoRetry.attempt/exhausted`）
- Server：`projectQueuedMessage` 投影来源；`resultDeliveryMessage` 输出人话标题；harness 新增单条送达/忽略/恢复；空闲自愈重试（退避 + 上限）
- API：`POST …/followups/:itemId/deliver`、`DELETE …/followups/:itemId`、`POST …/followups/resume`
- 前端：队列面板（升级 `AgentComposer.vue:525-536`）；`AgentChatSurface.vue:326-329` 携带状态与来源；i18n 文案
- 涉及 server 行为变化，实施前按 `repo-specs` 走提案/Spec 流程

### 待确认
- 运行中「立即送达」：置顶（当前方案）还是打断当前轮注入
- 自动重试次数与间隔（原型按 3 次、10s / 30s / 2min 演示）
- 是否把队列与 Workflow 待处理统一成「待处理区」（本次不动）

### 落地状态
- 界面：**未落地**（当前仍是输入框上方的原始 chips）
- 已进入提案：`packages/neuro-book/docs/proposals/agent-followup-queue-delivery.md`（`draft`，等待确认上述三项取舍）

---

## 方案五：增强提示词按钮

**原型文件**：`prompt-enhance-redesign.html`（顶部切四种状态；点输入框右下角「✨ 增强」可走完 增强中 → 已增强 → 看原文 → 撤销 全流程）

### 现状问题
- Agent 输入框只能手打。用户随手一句「继续,场景、章节简报如果能提前的话,提到前面」这类省略句，只能靠 Agent 自己猜对象、猜顺序
- 项目里「改写/润色/扩写」只存在于 Inline AI 编辑（`NovelPromptBar.vue` 的 rewrite / polish / expand / condense），那是「改文件」的真会话；Agent 输入框没有等价能力
- 全仓搜索 `enhancePrompt` / 优化提示词 零命中，属新增能力

### 设计决策
1. **一个按钮，位置在发送键左侧**：与发送键**完全同款**（同尺寸 `26×26`、同底色 `--accent-bg`、同 hover/disabled 反馈），只把图标换成星星——不引入新控件风格、不占额外宽度
2. **按钮图标就是状态（三态）**：星星（可增强）→ 转圈（增强中，不可点）→ 返回箭头（已增强，点它还原）。空输入置灰。**没有状态条、没有弹窗、没有多余文字**，反馈全部收敛在这一个图标上
3. **直接替换 + 同按钮撤销**：增强结果替换输入框内容，补上的部分用浅色底标出（看得清改了什么）；点同一个按钮（返回箭头）即还原为原文
4. **补什么有边界（写作四要素）**：对象 / 动作 / 约束 / 产出。只用原话已有信息，条件句仍为条件句，不新增任务、不改语气
5. **旁路调用，不污染会话**：照 `tool-explanation.ts`（「AI 解释这步」）的做法做一次性调用——不建会话、不写历史、不进主对话上下文
6. **宪法边界**：增强产物只回到用户输入框（这是 leader 说给 Agent 的话），不绕过流程进入 writer 的动笔前上下文（对齐 `docs/doctrine/writing-doctrine.md` 第五条）

### 预计改动点
- Server：新增 `server/agent/harness/prompt-enhancement.ts`（系统提示 + 一次性上下文 + `tracedCompleteSimple`）、harness 方法 `enhancePrompt()`、`http.ts` 包装
- API：`server/api/agent/sessions/[sessionId]/prompt-enhance.post.ts` + 两个 DTO（对标 `AgentToolExplanation*DtoSchema`）
- 前端：`useAgentSessionApi.enhancePrompt()`；`AgentComposer.vue` 工具条加按钮与三态；`AgentComposerInput.vue` 已暴露 `getText/insertText`，需在父组件透传；i18n 中英文案
- 设计文档：Proposal 需含 writing-doctrine 第三/第五条对照答复（否决权条款要求）

### 待确认
- 还原方式：再点同一个按钮（当前原型）是否需要配一句初次说明
- 是否要「增强强度」选项（保守 / 详细）
- 增强失败时按钮的表现（保持星星 + 错误提示 / 短暂警示）

### 落地状态
- 界面：**未落地**（`prompt-enhance*` 全仓零命中，属新增能力）
- 尚未写提案：等待原型确认后按同一流程补 `docs/proposals/`

---

## 方案六：辅助任务模型设置

**原型文件**：`bypass-model-settings-redesign.html`（顶部切三种场景：跟随 Profile / 指定专用模型 / 所选模型失效）

> 状态：**已实现**（提案 `agent-auxiliary-task-model.md`）。按原型做成模型下拉，直接复用同页「默认模型」的 `NovelIdeModelSelect`：选项 =「跟随本 Profile 的模型」+ 模型设置里的全部模型，二者共用同一份 `enabledModels` 清单。

### 现状问题
- 「AI 解释这步」用的是**会话所属 Profile 配置的模型**：`explainToolCall` 走 `modelResolver(config, snapshot.metadata.profileKey)`（`neuro-agent-harness.ts:968-987`），设置里没有任何入口能单独指定。
- 会话用 `/model` 临时切过的模型**不会**作用于解释：解释仍取 Profile 配置值，两者不一致且用户无从知晓。
- 说明文案与费用都不可控：解释/增强这类「一句话小任务」和正文写作共用同一个贵模型。

### 设计决策
1. **只加一行选择**：在「Agent Profile 模型 → 运行策略」新增分组「辅助任务」，一项「解释这一步、增强提示词」共用一个模型选择器；默认 `跟随本 Profile 的模型`，与现有「自动摘要」同一套继承/覆盖语义（同款 `inheritSource` 提示）
2. **复用已有机制**：不新增分区、不新增开关，沿用 `ProfileRuntimeSettingsPatch` 的「留空即继承」模式；不改动自动摘要 / 上下文压缩 / 文件变更通知三组
3. **失效可回退**：所选模型被删除或缺密钥时，选择器显示 `不可运行 · <key>`，并给一行「回退为跟随 Profile」按钮，不让功能静默失败
4. **说明生效位置**：设置页同屏给出两个实际入口（工具卡片的「AI 解释这步」、输入框的「✨ 增强」），避免用户不知道这个设置管什么
5. **边界说明**：两项功能都是旁路调用——不建会话、不写历史、不影响 Agent 决策（对齐 `tool-explanation.ts` 既有契约）

### 预计改动点
- 配置：`shared/agent/profile-runtime-settings.ts` 增 `auxiliary`（如 `{model: "follow" | {kind: "model", modelKey}}`）+ `config.dto.ts` 对应 DTO/patch schema
- Server：`explainToolCall` 与后续 `enhancePrompt` 统一走一个「解析辅助任务模型」的私有方法（现值为 Profile 模型，配置后取指定模型）
- 前端：`ProfileRuntimeSettingsFields.vue` 增一行选择器；`profile-runtime-settings.ts` 草稿/校验；中英文案
- 涉及新配置字段，实施前按 `repo-specs` 走提案 + Spec

### 待确认
- 「解释这一步」与「增强提示词」共用一个选择还是各配一个（原型按共用）
- 放在「Agent Profile 模型 → 运行策略」内，还是单开「模型 → 辅助任务」分区
- 是否提供「关闭」选项（原型未提供）

---

## 通用设计原则（各方案共用）

1. **渐进式披露**：默认层必须是人话；机器格式（转义 JSON、原始报错）一律退到折叠层
2. **摘要元数据化**：能用工具元数据拼的摘要不要用 AI；AI 只用于按需解释，且走旁路
3. **失败可见、成功收拢**：失败信息不折叠、不降级，成功信息尽量压缩
4. **复用现有视觉语言**：pill 徽标、红绿 diff 卡片、圆角浅底警告条、折叠 chevron——不引入第二种视觉组件风格
5. **索引从 1 开始、说人话**：消灭 `edits[0]` 式零基索引和 `oldText was not found` 式报错直出

## 原型文件清单（本机路径）

| 文件 | 内容 |
|---|---|
| `c:\Users\Administrator\CodeBuddy\NeuroBook\edit-failure-redesign.html` | 方案一：编辑失败卡片 |
| `c:\Users\Administrator\CodeBuddy\NeuroBook\conversation-nav-redesign.html` | 方案二：对话导航 + 右侧大纲 |
| `c:\Users\Administrator\CodeBuddy\NeuroBook\tool-card-redesign.html` | 方案三：工具卡片人话化 |
| `c:\Users\Administrator\CodeBuddy\NeuroBook\queue-stuck-redesign.html` | 方案四：队列投递重设计 |
| `c:\Users\Administrator\CodeBuddy\NeuroBook\prompt-enhance-redesign.html` | 方案五：增强提示词按钮 |
| `c:\Users\Administrator\CodeBuddy\NeuroBook\bypass-model-settings-redesign.html` | 方案六：辅助任务模型设置 |

六个文件均为自包含单文件（无外部依赖），浏览器直接打开即可；也可通过本地静态服务访问（`serve.js`，端口 8089）。交互点：新旧版切换、分组折叠、大纲跳转/滚动联动、「✨ AI 解释这步」模拟请求、队列情景切换与「演示自愈 / 演示：重试超限」、增强提示词的四态演示与撤销、辅助任务模型的三场景切换与失效回退。
