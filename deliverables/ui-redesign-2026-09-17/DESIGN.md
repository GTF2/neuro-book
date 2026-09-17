# NeuroBook 界面设计方案：纸墨（Paper & Ink）

> **读者**：GTF（项目作者，非前端背景）；后续接手实现的前端 Agent。
> **主要任务**：让 NeuroBook 的作者端界面「既美观又易用」，且**符合小说作者的既有习惯**。
> **范围**：设计语言契约 + 主题包落地方案 + 关键路径信息架构（IA）重排。**不含**代码实现。
> **证据来源**：`packages/nb-ui/`（设计系统）、`packages/neuro-book/app/utils/theme/`（主应用主题）、`D:\XingLu-reverse\original\app\dist\web\`（星炉逆向物）、`deliverables/gstack/full-review-neurobook-2026-09-17.md`（体检报告）、`deliverables/theme-follow-token-pilot/*.png`（真实界面截图）。
> **本文档状态**：`draft` —— 未经实现验证，所有「未验证」项已显式标注。

---

## 0. 结论先行

### 0.1 你头疼的那件事，真正的原因不是「架构不一样」

「星炉界面好看但搬不过来」这个判断里，藏着一个错误前提：你把**界面设计**和**界面实现**当成一回事了。拆开看：

| | 内容 | 跨技术栈？ |
|---|---|---|
| **界面设计** | 信息架构、视觉语言、交互模式、状态定义 | ✅ 完全可搬 |
| **界面实现** | 组件代码、CSS 类名、窗口机制、构建产物 | ❌ 必须重写 |

星炉那 707KB 的 `rendererApp-*.css` 和 1.19MB 的 React renderer，一个字节都不该搬。但星炉**为什么让作者觉得顺手**——那套信息架构和暖纸墨视觉语言——是平台无关的，可以 100% 落地到 NeuroBook。

### 0.2 更要紧的发现：你的问题不是「缺一套新界面」

NeuroBook 内部已经有三份暖纸墨资产，各自残缺，彼此不通：

```
                    同一个配色契约（36 变量）
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
   ① 主应用主题         ② nb-ui 设计系统      ③ 星炉（外部）
   theme-tokens.ts      themes/ + tokens.css  XingLu-reverse
   ─────────────        ────────────────       ──────────────
   ✅ 8 套内置主题       ✅ 72 组件            ✅ 商业验证过的 IA
   ✅ sepia 暖纸墨       ✅ 4 套主题包          ✅ 暖纸墨范式
   ✅ 自定义主题编辑器    ✅ 分层 token          ✅ 界面缩放三档
   ❌ 无 token 层        ❌ 配色只剩冷暗 1 套     ❌ React，代码不可用
   ❌ 382 处硬编码 hex   ❌ 主应用 0 引用        ❌ 扁平 193 变量表
```

**关键事实（已核验）**：① 和 ② 的配色契约**本来就是同源的**——
`nb-ui/src/colorway/presets.ts` 的 `dark` 与 `theme-tokens.ts` 的 `themeTokens.dark` **逐字一致**（`#18181b`/`#252529`/`#1e1e22`/`#f59e0b`…）；
nb-ui 的 33 个变量 = 主应用 36 个 − 6 个编辑器/组件层专用变量（`--editor-bg` `--source-bg` `--source-text` `--source-muted` `--toolbar-bg` `--chat-ai-bg`）+ 3 个 nb-ui 自有变量。

所以这不是「两套互不兼容的系统」，而是**同一个契约的两个投影，各自缺一半**：
- 主应用有 sepia 暖纸墨的**取值**，但没有 token 层（所以到处硬编码，换主题要改一批文件）
- nb-ui 有 token 骨架和主题包机制，但暖色/亮色配色**被下线了**（`presets.ts` 注释：「`sepia`/`light` 两套亮色，未通过观感确认」，旧 id 全部别名指向 `dark`）

**这就是「底层架构设计思路不一样」的实际结构。** 星炉的界面设计恰恰是补上这个缺口的最佳参照物——它是**已被市场验证的暖纸墨取值与 IA**。

### 0.3 方案一句话

> **不要再设计第三套界面。用星炉已验证的范式，把 nb-ui 缺的那套暖纸墨配色补齐，再把主应用从硬编码迁到 token 上。**

---

## 0.4 路由决策（设计系统路由）

| 项 | 决策 | 理由 |
|---|---|---|
| **分支** | `product`（交互产品） | 交付物是可用界面，不是品牌/平面物 |
| **模式** | **Devtool / AI workspace** 骨架 + **Editorial** 视觉重心 | 写作工具的骨架必须是工作台；但内容层的阅读节奏属编辑出版类 |
| **主视觉谱系** | **暖纸墨（Paper & Ink）** | 唯一主线。它同时解决三个问题：nb-ui 缺暖亮配色、主应用有 sepia 存量、星炉已验证 |
| **辅助谱系** | 无 | 刻意不引入第二套语言。nb-ui 现有「器械/稿面」二分本身就是纸墨谱系的一部分，不是对立面 |
| **不复制** | 星炉的多窗口系统、内嵌 OPPO Sans 字体、扁平 `--nf-*` 变量表、707KB 手写 CSS、React 组件 | 见 §7 注意事项 |

**轴线取值**（每条都能追溯到产品任务）：

| 轴 | 取值 | 依据 |
|---|---|---|
| 能量 | 安静、专注 | 长文写作是数小时连续操作，界面不能抢注意力 |
| 密度 | 紧凑偏平衡 | 操作区（大纲/检查器）紧凑，稿面（正文）放松 |
| 对比 | 中软 | 纸面底色本身低对比，靠字重与留白分层，不靠重色块 |
| 边缘语言 | 克制圆角 | 现有 10/20/26px 已不比星炉差（星炉 11/14/16px），**不需要改** |
| 字体系统 | 界面黑体 + 稿面宋体 | nb-ui 既有分工，中文出版默认 |
| 色彩行为 | 中性底 + 单一暖强调 | 赭石橙 `#d97743` 已是主应用 accent |
| 动效角色 | 仅解释状态变化，不做装饰 | 既有纪律，保持 |

---

## 1. 视觉主题

### 1.1 论点：一张书桌，两种材质

沿用并强化 nb-ui 已有的论点——**「玻璃是器械，纸不是玻璃」**：

| | 器械（chrome） | 稿面（paper） |
|---|---|---|
| 是什么 | 工具栏、侧栏、菜单、对话框、按钮、输入框 | 正文编辑区、章节内容、工作台卡片 |
| 材质 | 半透明玻璃（磨砂 + 边缘折射） | 实心纸 |
| 色温 | 冷（少量） | **暖**（主体） |
| 字体 | 黑体 `--font-ui` | 宋体 `--font-display` |
| 配色来源 | `--bg-sidebar` | `--bg-panel` |

**本轮修正**：既有实现里，器械层是**冷灰**（`presets.dark` 的 `#1e1e22` 冷中性）。纸墨主题要把冷暖关系从「冷器械 vs 暖稿面」调成「**暖器械 vs 更暖稿面**」——星炉就是这么做的（它的侧栏也是暖色 `#f6eee7`）。理由是写作场景里窗口几乎全屏被稿面占据，一块冷灰侧栏在暖纸旁边读起来像「另一个软件」。

### 1.2 层级与密度

- 三档层级不变：raised（按钮/输入/键帽）→ popover（菜单/下拉/气泡）→ dialog（对话框）。
- 密度分两区：**操作区紧凑**（列表行、树、检查器）、**稿面放松**（正文 17px / 行高 1.85，已有）。
- 稳定尺寸：所有控件在 default / hover / focus / selected / disabled / loading 之间**不得改变宽高**（既有纪律，`token-consumption.test.ts` 静态扫描）。

### 1.3 与既有品牌资产的关系

- 产品名「NeuroBook」、图标、启动屏：**本轮不动**。
- 星炉的启动屏（sigil 动画 + journey 四步进度 + spark，含 `prefers-reduced-motion` 支持）**是范式参考，不是复制对象**——NeuroBook 已有自己的启动/首屏流程，只在需要时参考它的「四步进度」表达。

---

## 2. 色彩

### 2.1 语义角色表（纸墨亮色档）

取值**直接沿用主应用已有的 `themeTokens.sepia`**（不新造），这是它作为「唯一事实源」的地位决定的：

| 角色 | CSS 变量 | 取值 | 用途 |
|---|---|---|---|
| 桌面底 | `--bg-main` | `#f4ecd8` | 页面最底层 |
| 纸面 | `--bg-panel` | `#fdf6e3` | 卡片、对话框、**稿面**（`--page-surface` 取它） |
| 侧栏 | `--bg-sidebar` | `#ebe0c8` | 目录树、分栏导航 |
| 浅分区 | `--bg-subtle` | `color-mix(in srgb, #ebe0c8 78%, #fdf6e3)` | 面板内弱分区 |
| 输入底 | `--bg-input` | `#ebe0c8` | 输入框、次级容器 |
| 悬停 | `--bg-hover` | `#e3d5b8` | 列表项 / 透明按钮 hover |
| 正文 | `--text-main` | `#433422` | 正文、标题 |
| 次要文本 | `--text-secondary` | `#786450` | 摘要、副标题 |
| 弱文本 | `--text-muted` | `#b8a896` | placeholder、序号 |
| 反色 | `--text-inverse` | `#ffffff` | accent 实底上的字 |
| 标准边框 | `--border-color` | `#d6c7a9` | 分隔线、输入框边框 |
| 加强边框 | `--border-strong` | `#cfbc96` | hover / focus |
| 强调边框 | `--border-accent` | `color-mix(in srgb, #d97743 46%, #d6c7a9)` | 选中态 |
| **主强调** | `--accent-main` | `#d97743` | 主操作、当前项、主线强调 |
| 强调软底 | `--accent-bg` | `rgba(217, 119, 67, 0.15)` | 选中块 |
| 强调文本 | `--accent-text` | `#b85a2a` | 链接、重点数字 |
| info | `--status-info` | `#4f6f73` | 运行中、引用 |
| success | `--status-success` | `#6f7f35` | 完成、已同步 |
| warning | `--status-warning` | `#b86b00` | 草稿、待审、未保存 |
| danger | `--status-danger` | `#a34d3f` | 错误、删除、冲突 |
| 阴影基色 | `--shadow-color` | `#0f172a` | 只经 `color-mix(… transparent)` 使用 |
| 选区 | `--selection-bg` | `rgba(217, 119, 67, 0.28)` | 文本选区 |

**为什么这套值值得信任**：它是 Solarized Light 的变体（`#fdf6e3`=base3、`#eee8d5`=base2、`#586e75`=base01），而 Solarized 是**为长时间阅读设计**的配色——恰好是写作工具的需求。星炉的暖纸墨（`#fffdf8`/`#956046`）与之同族但更冷更灰；NeuroBook 这套更暖、强调色更饱和。

### 2.2 暗色档

**沿用主应用 `themeTokens.dark`**（与 nb-ui `presets.dark` 逐字一致，已核验），但**把强调色从琥珀 `#f59e0b` 换成暖橙 `#e08a4f` 一系**——理由：亮色档 accent 是暖橙 `#d97743`，暗色档若用琥珀，同一个「当前项」在明暗切换时会明显偏黄，读起来像换了个产品。**此项为设计判断，未经观感验收。**

### 2.3 对比度状态

> ⚠️ **未测量**。本文档所有取值均未做 WCAG 对比度计算。
> 已有的一处风险：`--text-muted: #b8a896` 压在 `--bg-main: #f4ecd8` 上，亮度接近，用于「序号/占位」这类弱信息尚可，**但不得承载需要阅读的句子**（nb-ui `tokens.css` 对 `--text-2xs` 有同款约束，这里扩展语义）。
> 落地前须补：正文/次要/弱文本三档对 `--bg-panel` 与 `--bg-main` 的实测对比度。

### 2.4 配色三条不变量（继承 nb-ui，必须继续成立）

1. `--bg-panel` 恒亮于 `--bg-main`（纸比桌亮）——`--page-surface` 直接取 `--bg-panel`。
2. `--bg-input` 不低于 `--bg-panel`（输入框不许挖成坑）。
3. `--accent-main` 与 `--status-warning` 不许同值。

**sepia 档的核验**：① `#fdf6e3` > `#f4ecd8` ✅ ② `#ebe0c8` vs `#fdf6e3` —— **`--bg-input` 比 `--bg-panel` 暗**❗ 违反第 2 条。
→ 这是 `theme-vars.css`/`themeTokens.sepia` 的**既有问题**，也是 `.nb-ui` 里坑 #6 记的同款现象（「输入框比窗体底还暗，看起来像没上样式的原生控件」）。**本方案要求修正**：`--bg-input` 提到 `#f7efdd` 一档，或按 nb-ui 的解法改用 `--control-surface: color-mix(in srgb, var(--text-main) 7%, transparent)` 与配色解耦。
③ `#d97743` ≠ `#b86b00` ✅

---

## 3. 排版

### 3.1 字体栈

**保持现有分工，不引入内嵌字体**：

```css
--font-ui:      system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
--font-display: "Source Han Serif SC", "Noto Serif SC", "Songti SC", "SimSun", Georgia, serif;
--font-mono:    ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
```

**为什么不抄星炉的 OPPO Sans**：① 22MB TTF 内嵌，占安装包体积；② 携带许可通知（`OPPO-Sans-4.0-License-Notice`），分发受限（星炉自己的逆向 README 就把「分发（含字体/美术/商标）」列进「明确不做」）；③ 系统字体栈在三大平台各有回退，中文渲染质量已足够。

**拉丁在前、CJK 在后**：中文字体自带的拉丁字形质量普遍较差，放前面会把西文一起接管。

### 3.2 角色化字号（保持现有 6 档，不扩张）

| Token | 值 | 用途 |
|---|---|---|
| `--text-2xs` | 11px | **仅**角标、序号、计数、时间戳。不得承载句子 |
| `--text-xs` | 12px | 标签、徽标 |
| `--text-sm` | 13px | 辅助信息、树节点、检查器 |
| `--text-md` | 14px | **界面基准**：控件、菜单、列表 |
| `--text-lg` | 16px | 面板标题、对话框标题 |
| `--text-xl` | 20px | 页面级标题 |

**不跟星炉的 14 档（11→27px）**：nb-ui 的字号刻度是**中文专用**的（「中文比拉丁文占满 em 框，同样的 px 下汉字明显更挤，所以整体比 macOS 加一档」——界面 14px vs macOS 13px）。星炉的 15px 基准是为它的内嵌字体调的，两套刻度背后的约束不同，混用会破坏既有验证。

**稿面字号单列**：正文 17px / 行高 1.85 / 版心 `--reading-measure: 34em`（em 单位在 CJK 下正好等于「每行多少字」）。**保持不动**。

### 3.3 四条中文规矩（继承）

1. **字距归零**（`--tracking-ui: 0`）。负字距是给 SF 的拉丁字形调的，无依据说汉字该用。
2. **行高放松到 1.5**（界面）/ 1.85（稿面）。汉字没有升降部制造行间空隙。
3. **强调换字面不换字形**：用楷体，**禁止 `font-style: italic`**（汉字无斜体，那是字形剪切变形，看起来像渲染故障）。
4. 稿面比界面大一档。

### 3.4 换行与截断

- 长标题（章节名）在树/列表里单行截断 + `title` 提示；在稿面里完整不截断。
- 表格/表单里的中文不强制断词。
- 数值/ID 一律 `--font-mono`。

---

## 4. 组件样式

**原则：组件不新增，只做「接管」** —— 把主应用现有的手搓实现替换为 nb-ui 同名/等义组件，样式由 token 驱动。本节只列关键尺寸契约与状态要求。

### 4.1 尺寸契约

| 角色 | Token | 现值（nbook 主题） | 星炉 | 建议 | 理由 |
|---|---|---|---|---|---|
| 控件高 sm | `--control-h-sm` | 28px | 28px | **28px 不变** | 两套一致 |
| 控件高 md | `--control-h-md` | 34px | 32px | **32px** | 星炉的 toolbar 档更紧凑；34px 在密集工具栏里偏高 |
| 控件高 lg | `--control-h-lg` | 42px | 38px | **38px** | 对齐星炉 dialog 档，中文按钮不显笨 |
| 控件圆角 | `--radius-control` | 10px | 11px | **10px 不变** | 差异 1px，无收益 |
| 面板圆角 | `--radius-panel` | 20px | 14px | **20px 不变** | NeuroBook 更圆，且有出处（macOS Tahoe 20pt） |
| 对话框圆角 | `--radius-dialog` | 26px | — | **26px 不变** | 同上 |
| 菜单外圈圆角 | `--radius-menu` | 12px | — | **12px 不变** | 独立语义档，有实测理由 |

> **判断**：圆角不是本次的差距所在。NeuroBook 的圆角体系已比星炉更成熟（有同心圆角公式、有 `max()` 兜底负半径、有对话框独立档）。**不要因为「星炉好看」去动物理参数。**

### 4.2 动效契约

| Token | 现值（nbook） | 星炉 | 建议 | 理由 |
|---|---|---|---|---|
| `--motion-fast` | 90ms | 150ms | **120ms** | 星炉整体更松弛。90ms 在暖纸低对比底上偏「跳」；120ms 是既有裸基线值，不用新造数 |
| `--motion-base` | 140ms | 150ms | **180ms** | 既有裸基线 |
| `--motion-enter` | 180ms | 150ms | **220ms** | 既有裸基线 |
| `--ease-standard` | `cubic-bezier(0.25,0.1,0.25,1)` | `cubic-bezier(.2,.8,.2,1)` | **沿用星炉曲线** | 星炉的曲线起步快、收尾长，读起来更「软」，与纸墨性格一致；既有曲线偏机械 |

**合同**：`fast < base < enter` 的顺序不得打破。退场一律用 `fast` 档。

### 4.3 必须定义状态的控件

每个主要控件都需要：default / hover / active / selected / disabled / loading / success / error / locked / empty / **recovery**。

**横切要求**：状态之间**不得改变宽高**（`token-consumption.test.ts` 会扫）。

### 4.4 对话框（本轮重点修正项）

**现状问题（有截图证据）**：`deliverables/theme-follow-token-pilot/keyframe-*.png` 里的「剧本工作台 Dialog」是**三段式盒子**——标题条（带 `×`）+ tab 条 + 内容区。这恰好命中 nb-ui 设计语言文档**坑 #35** 的三条判据之一（「有没有 ×？」「标题和正文是不是同字号？」）：

> 「先看解剖，再看取值。三个可证伪的问题——头尾有没有自己的 padding？标题和正文是不是同字号？有没有 ×？三条里中一条，就还是那个盒子。」

**修正方向**（按 nb-ui 已实测的 Apple macOS 27 UI Kit 结论）：

- 留白归**面板**（`padding: 20px`），header/footer 自己不持有 padding。
- 标题与正文**同字号**，只差字重与颜色。
- 默认**没有 ×**；出口是一颗有名字的按钮。
- 按钮走胶囊（`--radius-control-lg: var(--radius-pill)` 已在 nbook 主题里）。
- 窄框（决定）按钮平分整行；宽框（表单）按钮右对齐。
- 头尾**不常驻细线**，分隔由滚动状态驱动（`scrollTop > 0`），并挂 `ResizeObserver`——否则「打开时为空、随后异步填满」的内容永远读到「不用滚」。
- 遮罩保持淡（玻璃对话框 + 重遮罩互斥）。

> 这条是**低成本高回报**：不动物理参数、不加组件，只改对话框的解剖结构。

---

## 5. 布局

### 5.1 现状与目标的差距（这是「符合用户习惯」的实质）

| | 星炉（商业验证） | NeuroBook（现状） |
|---|---|---|
| IA 组织逻辑 | **按作者的活儿**：项目 → 章节树 → 正文，AI 总编对话是一等公民 | **按能力清单**：活动栏 + 工具面板 + 文件树 + 编辑器 + 世界引擎/情节/RAG/jobs/历史等面板 |
| 首屏 | 项目列表 → 直接进写作 | 项目选择页 953 行里约 410 行服务封面管理与 Session 迁移，**服务四大能力的 0 行**（体检报告发现 #15） |
| 对话的位置 | 与正文并列的常驻区 | 折叠在 Agent 面板里 |
| 章节编辑 | 可浮动（`floating-chapter-editor`） | 固定在编辑器区 |

**结论**：NeuroBook 的骨架（IDE 式固定面板）**不要推翻**——它是 devtool 模式的正确选择，且已有大量实现。要改的是**默认落点与视觉重心**：

1. **首屏重心挪向能力**（体检报告发现 #15、#16 的方向）：项目选择页先讲「设定不吃书 / 伏笔不丢 / AI 味可控」，文件管理退为次要。
2. **工作台默认 tab 改「承诺账本」**（一行代码，体检报告行动 #9）。
3. **稿面优先**：进入章节后，正文必须是视觉上唯一「浮起」的面（`--page-surface: var(--bg-panel)`），所有 chrome 退到纸后面。

### 5.2 主路径（必须不被打断）

```
打开项目 → 选章节 → 读/写正文 → 唤 AI → 看它改了什么 → 接受/回退 → 继续写
   J1         J1        J3          J2         J4            J4
```

对应体检报告建议的 5 条 Journey 看板（J1 首字 90 秒 / J2 AI 首章 10 分钟 / J3 续写 20 秒 / J4 伏笔闭环 60 秒 / J5 扫 AI 味 2 点击）。**界面设计以这 5 条为验收对象**，不以「看起来完整」为验收对象。

### 5.3 网格与尺寸

- 根布局：`shell → 活动栏(48px) → 工具面板(可拖拽，min 220 / max 480) → 主编辑区(flex) → 右检查器(可拖拽，min 260 / max 520)`。
- 已有 `useResizablePanel` 承载拖拽，**不新增机制**。
- 面板边界用**间距与底色**分层，不用阴影（阴影只给真正浮起的元素）。
- 长内容：树/列表超长时**滚动**，不压缩行高；稿面超长时保持版心 34em 居中不拉伸。
- 空态：必须是**引导**（下一步做什么），不是空白页。← 与体检报告「空态即演示」一致。
- 密集数据（224 章 / 322 场景）：保持行高稳定，虚拟滚动是性能问题不是设计问题。

---

## 6. 深度与层级

| 档 | 用在哪 | Token |
|---|---|---|
| 平 | chrome 分区、侧栏、工具面板 | `--elevation-flat: none` |
| raised | 按钮、输入框、键帽 | `--elevation-raised` |
| popover | 菜单、下拉、气泡、时间选择器 | `--elevation-popover` |
| dialog | 对话框 | `--elevation-dialog` |

**三条硬规矩（继承 nb-ui 实测结论，不得违反）**：

1. **外阴影只有两条**：一条 blur ≤ 1px 的发丝轮廓 + 一条 blur ≥ 40px 的环境投影。出现第三条 blur 在 4–20px 之间的，就是 Material 那套多层递增投影（坑 #38）。
2. **对话框吃 `--elevation-dialog`**，不共用浮层档——Apple 实测两者环境投影差一倍。
3. **浮层的高光在边上，不在面上**：`--overlay-sheen` 喂 `none`（坑 #40：面上铺渐变会被读成「盖了一层渐变」）。

**纸墨主题的补充**：暖色底上阴影要**更淡**。冷色底上 `rgba(0,0,0,.14)` 的投影在 `#fdf6e3` 上会明显发灰，读起来脏。建议纸墨主题的 `--shadow-color` 走暖色（已有 `#0f172a` 是冷蓝黑 → **建议改为从 `--text-main` 派生**，让它随配色变暖）。**此项为设计判断，需观感验收。**

---

## 7. 注意事项

### 7.1 禁止事项（会制造不可解决的冲突）

| 禁止 | 理由 |
|---|---|
| **改 `packages/nb-ui/` 的现有文件** | nb-ui 是 **上游领地**，铁律「只记录、不删除」（`docs/standards/fork-seams.md`）。改动会产生 modify/delete 冲突——唯一难解的冲突类型 |
| **新增第三套设计系统** | 现有两套已各自残缺，第三套只会让「一个变量去哪找」变成三个答案 |
| **把星炉的 `--nf-*` 变量搬进来** | 它是扁平 193 变量、无主题/配色正交、无角色映射层。搬进来等于绕开 nb-ui 的全部机制 |
| **内嵌 OPPO Sans 或任何第三方字体** | 22MB 体积 + 授权分发限制 |
| **复刻星炉的多窗口系统** | `.nf-window`(679) / `creative-docked-panel` / `creative-window-resize-handle` 是 React 侧的完整窗口管理，与 Nuxt/Vue + 现有 `useResizablePanel` 机制冲突，重写成本远超收益 |
| **写 Tailwind 调色板类 / `dark:` 变体 / 固定 hex** | 主应用 README v2.1「禁止事项」已列；有 `scripts/checks/hardcoded-colors.ts` baseline 卡着 |
| **用 `rounded-md` 等 Tailwind 常量代替 `--radius-control`** | 坑 #44：声明了却没人消费的 token 比没有更糟 |
| **`prefers-reduced-transparency` 等媒体查询不带 `[data-nb-appearance]`** | 坑 #31：媒体查询不提升特异性，暗色分档特异性更高会把整个 `@media` 块吃掉，且不报错 |

### 7.2 未决问题

1. **`--bg-input` 违反「不低于 panel」不变量**（§2.4）——修法二选一，需观感验收。
2. **暗色 accent 是否从琥珀改暖橙**（§2.2）——需并排观感验收。
3. **`--shadow-color` 是否改为从 `--text-main` 派生**（§6）——需在暖底上实测。
4. **体检报告发现 #17**：「灵感探索」在前端 i18n 检索为空（未逐条复核）——IA 设计前必须先确认这条链路是否存在。

### 7.3 边界声明

- 本文档**不评判写作方法论**。按写作宪法，「什么叫好小说」只有作者能判。
- 本文档**不声称**做过法律清权、平台审核或观感验收。
- 所有「星炉如何如何」的观察均来自 `D:\XingLu-reverse\original\app\dist\web\` 的静态产物（CSS/HTML/JS），**未经运行态截图确认**。
- NeuroBook 界面观感仅基于 5 张 `deliverables/theme-follow-token-pilot/*.png` 与 `plot-locator-dark-viewport.png`，**不是全量界面**。

---

## 8. 响应式行为

**目标视口**：1440 / 1024 / 768（写作工具以桌面为主，375 仅作可达性兜底）。

| 视口 | 行为 |
|---|---|
| ≥1440 | 四区全开（活动栏 / 工具面板 / 编辑区 / 检查器） |
| 1024–1440 | 检查器默认收起，按需展开为覆盖层 |
| 768–1024 | 工具面板与检查器互斥（同时只开一个）；稿面版心保持 34em |
| <768 | 单栏主导：章节树 → 稿面 → 检查器**换交互模型**（不是压成三栏），触控目标 ≥44px |

- **键盘**：Tab 不拦截；焦点环可见（`--focus-ring`）；浮层打开时焦点进第一项，关闭后回触发器（点外面关闭除外）。
- **触控**：主要控件 ≥44px；hover-only 的提示必须有可见替代。
- **减少动效**：`prefers-reduced-motion` 下三档时长归零（库负责）；主题新增的动效变量**由主题自己关**。
- **加载/错误/恢复**：流式输出必须有「正在生成」的可见状态；失败必须给出可恢复动作，且**保留用户输入**（不得清空已写内容）。
- **未执行的检查**：目标视口截图、真实内容压力测试、对比度实测、200% 缩放 —— **全部待做**。

---

## 9. Agent 提示词指南

> 交给实现 Agent 的启动提示词。可直接复制使用。

```text
项目：NeuroBook（D:\MyProject\neuro-book），上游 fork，当前分支 feat/writing-doctrine-alignment。
任务：把「纸墨（Paper & Ink）」设计语言落地到 nb-ui 主题包，并接管 3 个试点页面。

硬约束（违反即失败）：
1. 不改 packages/nb-ui/ 的现有文件（上游领地）。新主题包 = 新目录，纯加法。
2. 不新增设计系统，不引入第三方字体，不写 Tailwind 调色板类 / dark: 变体 / 固定 hex。
3. 一次只做一个功能，不顺带重构。不通过测试不提交。
4. 改 docs/、.agents/、AGENTS.md 要主动通知开发者。

实施顺序：
① 新建 packages/nb-ui/themes/sepia-paper/（manifest.ts + vars.css + index.ts + colorways.ts）
   —— 自带亮暗两套配色；亮色 = themeTokens.sepia 去掉 6 个领域专用变量；
      暗色 = themeTokens.dark 派生，accent 换暖橙 #e08a4f 一系。
   —— 配色 id 加 sepia-paper- 前缀（不得与内置 dark 重名，否则 loader 以 colorway-mismatch 拒绝）。
   —— vars.css 只给 token 取值，不许出现字面颜色（theme-packages.test.ts 会扫 hex）。
② 跑 bun run --cwd packages/nb-ui test，确认主题包装载无 NbThemeInstallError。
③ 选 3 个试点页面接管（顺序即优先级）：
   ProjectPickerScreen.vue → NovelIdeSettingsDialog.vue → 关键帧面板
   先颜色 token，后间距 token。
④ 每个试点完成后跑 typecheck + 相关单测 + 在 127.0.0.1:3000 人工看一眼。

需要产出的证据：主题包装载日志、试点页面的 token 消费断言、浏览器截图（暗色档也要）。
未验证的部分必须写明「未验证」，不得声称未执行的检查通过。
```

### 验收清单

**视觉系统**
- [ ] `--bg-panel` 恒亮于 `--bg-main`；`--bg-input` 不低于 `--bg-panel`；accent ≠ warning
- [ ] 主题文件无字面颜色（纯白/纯黑低透明度叠层除外）
- [ ] 外阴影只有两条（发丝轮廓 + 环境投影）
- [ ] 圆角未被改动（10/20/26/12 保持）
- [ ] 字距为 0；强调用楷体不用 italic

**交互**
- [ ] 5 条 Journey 各跑通一次，无阻塞
- [ ] 每个主要控件有 default/hover/focus/active/selected/disabled/loading/error 状态且**不改变尺寸**
- [ ] 对话框通过「三段式盒子」三条判据（无 ×、标题同字号、留白归面板）
- [ ] 流式输出有可见状态；失败保留用户输入

**无障碍**
- [ ] 三个 media query 都写了，选择器带 `[data-nb-appearance]` 并排在分档之后
- [ ] 焦点环可见；Tab 不被拦截；触控目标 ≥44px

**验证**
- [ ] 判据读元素的计算样式，不是根上的变量
- [ ] 暗色档单独实测过，不是只看亮色
- [ ] 「一个主题都没装」这一档仍然可用

---

## 附录 A：星炉设计语言 → nb-ui token 映射（完整对照）

| 星炉 `--nf-*` | 星炉取值 | nb-ui 对应 | 处理 |
|---|---|---|---|
| `--nf-type-micro` → `--nf-type-display` | 11 → 27px（14 档） | `--text-2xs` → `--text-xl`（6 档） | **不扩张**。刻度背后的约束不同（星炉为内嵌字体调，nb-ui 为中文调） |
| `--nf-control-height-dense/compact/toolbar/prominent/standard/dialog` | 28/30/32/34/36/38 | `--control-h-sm/md/lg` | **取 28/32/38 三档**，不引入 6 档 |
| `--nf-icon-size-*` | 14/15px | 无 | 沿用现有图标尺寸，不新增 |
| `--nf-scrollbar-size` | 10px | 无 | 参考值，可在纸墨主题里定义（需带 fallback） |
| `--nf-radius-control/card/window/input` | 11/14/16/16 | `--radius-control/panel/dialog` | **不改**（nb-ui 更成熟） |
| `--nf-radius-pill` | 999px | `--radius-pill` | 已有 ✅ |
| `--nf-transition-control` | 150ms | `--motion-fast` | 取 120ms |
| `--nf-ease-standard` | `cubic-bezier(.2,.8,.2,1)` | `--ease-standard` | **采用星炉曲线** |
| `--nf-app-window-radius` | 8px | 无 | 桌面壳参数，不进主题 |
| 界面缩放 normal/medium/large | 1 / 1.1 / 1.3 | **无** | **值得吸收**：作为新变量声明（带 fallback），或走 CSS `zoom` |
| 明暗 `data-theme` | 2 档 | `data-nb-appearance` + colorway | nb-ui 机制更强（正交两轴） |
| 透明模式 | 有 | 无 | 不做（写作工具不需要） |
| 字体 OPPO Sans | 内嵌 22MB | 系统字体栈 | **不用** |

## 附录 B：星炉界面骨架的跨栈资产清单

| 星炉的类名信号 | 它实际是什么 | 跨栈可用？ | 处理 |
|---|---|---|---|
| `.nf-window`(679) / `.creative-docked-panel`(74) / `.creative-floating-window`(60) / `.creative-window-resize-handle`(39) | 自由浮动窗口系统 | ❌ 机制不可搬 | 不复制 |
| `.chief-editor-settings-dialog`(637) / `.chat-*`(大量) / `.chief-*` | **AI 总编对话是一等公民** | ✅ **IA 层可搬** | 提升 Agent 对话的视觉权重 |
| `.floating-chapter-editor-body`(41) | 可浮动的章节编辑器 | ⚠️ 概念可用 | 作为「专注写作」模式参考 |
| `.simple-project-chapter-group-*` / `.simple-project-chapter-file` | 章节树 | ✅ | 现有文件树已覆盖 |
| `.window-picker-menu` / `.workspace-preset-menu` / `.soft-select-*` | 窗口/预设选择器 | ⚠️ | 现有 Dropdown/Combobox 覆盖 |
| `.dialog-primary` / `.dialog-secondary` / `.dialog-actions` | 对话框按钮层级 | ✅ | 已知规范，见 §4.4 |
| 启动屏 sigil/journey/spark | 精致启动屏（4 步进度） | ✅ 范式 | 参考「四步进度」表达 |
| `--nf-*` 193 变量 / 707KB CSS | 扁平变量表 | ❌ | 不搬 |

---

## 附录 C：本文档的证据来源与已知局限

| 结论 | 证据 | 类型 |
|---|---|---|
| nb-ui 配色只剩 1 套 dark | `src/colorway/presets.ts` L23-35、L63-98 | 观察（代码） |
| nb-ui 的 dark 与主应用 dark 逐字一致 | 两侧取值比对 | 观察（代码） |
| 主应用有 8 套主题、36 变量、自定义编辑器 | `app/utils/theme/README.md`、`theme-tokens.ts` | 观察（文档+代码） |
| nb-ui 33 变量 = 主应用 36 − 6 + 3 | `presets.ts` 注释 + 变量清单比对 | 观察（代码） |
| 主应用 0 引用 nb-ui | `grep -r "@notnotype/nb-ui" packages/neuro-book/{app,server}` 零命中 | 观察（检索） |
| 29 个文件含硬编码 hex | `grep -rlE '#[0-9a-fA-F]{6}'` 计数 | 观察（检索） |
| 星炉的视觉取值 | `rendererApp-D_3T0x4o.css` 的 `:root` 块（193 变量） | 观察（静态产物） |
| 星炉的界面骨架 | CSS 类名频次统计 + 类名语义 | 推断（未见运行态） |
| 剧本工作台是「三段式盒子」 | `keyframe-*.png` 截图 | 观察（截图） |
| 设计系统闲置是阻塞项 | `deliverables/gstack/full-review-neurobook-2026-09-17.md` | 观察（评审报告） |
| 「符合作者习惯」的具体内容 | 星炉 IA + 体检报告的产品评审 | **推断+假设**（未做作者访谈） |
| 对比度是否达标 | — | **未测量** |
| 星炉/NeuroBook 的实际运行观感 | — | **未运行验证** |
