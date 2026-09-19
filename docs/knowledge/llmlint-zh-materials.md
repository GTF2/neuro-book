# llmlint 中文素材（任务012 产出）

> 生成：2026-09-20，工程队常驻窗口。定位：llmlint（`packages/llmlint/`）的中文一页通 + 仓库内中文素材索引 + 外部中文参考。包本身为第三方素材，本文只读不改。事实以包内文档为准，可对照复核。

## ① llmlint 一页说明（中文）

**是什么**：llmlint 是**面向 LLM 输出的中文文本 lint 工具**——用规则稳定定位「AI 味」候选，再交给人/Agent 结合语境判断修复。核心资产是一个中文正文规则库（engine 3.0.0：**245 条 regex 规则、7 条 density 规则、6 条 handler 规则、8 条 semantic 规则，266/360 active**，另有 creative-writing@1 profile；数字来自规则注册表构建输出，复核命令 `bun run registry:build` 于 `packages/llmlint/`）。

**解决什么问题**：AI 生成的中文文本有可复现的模板特征（八股词、句式套路）。静态命中是**候选证据而非修改命令**；目标不是清零命中，而是在守住事实、剧情功能、角色声音和文体意图的前提下减少无功能的模板负担（`skill/SKILL.md` 原则段）。

**两个消费时机**（`skill/SKILL.md`，别只用后一个）：
- **写之前**：`guide` 把规则投影成动笔前的写作约束，可注入系统提示词或存成文风预设。语义规则静态工具永远定位不到，模型读过是它们唯一执行路径。档位 `--tier`：`core < standard < wide < full`（缺省 standard）。
- **写之后**：`check`/`fix`/`detect` 在成稿上做稳定定位与外部 AIGC 热力图；Agent 复核语境→制定修复计划→**用户审批后**改写→疑难判断沉淀为本地学习出口（五步循环：install 依赖门 → status → lint_check → repair → 记录）。

**怎么用**（开发仓 `packages/llmlint/README.md`）：
- 作为 Skill 安装：`npx skills add notnotype/llmlint --skill llmlint --full-depth`，或复制 `skill/` 目录；首次使用先 `bun install --frozen-lockfile`（依赖门）。
- CLI：`bun "<skill-root>/bin/llmlint.ts" check <file>`（或 `npx tsx`）；参数与 JSON schema 见 `skill/references/cli-usage.md`。
- 检测网站 `web/`：浏览器本地检测 + 判定标签采集；Web 只做 regex+handler 的 span 扫描，**density 规则不进 Web 结果**，完整检查用 CLI。
- 隐私边界：`contribute` 只写本机发件箱不上传；`detect` 会把未缓存正文块发到配置服务（默认 HF Space），不发文件名/路径（README"数据与隐私"节）。

**在本仓库的位置**：`packages/llmlint/skill/` 是 Skill 单一源（package name `llmlint`，唯一真相源），产品投影由 system assets projection 生成（根 AGENTS.md"仓库结构"节；PROJECT-STATUS.md"llmlint 3.0.0 收编"条目）。

## ② 仓库内中文素材清单（均在 `packages/llmlint/` 内，只读）

| 文件 | 内容 | 中文密度 |
|---|---|---|
| `README.md` | 开发仓主文档（三工作面/安装/隐私/启动） | 全文中文 |
| `CONTEXT.md` | **领域语言与硬不变量唯一真相源**：一句话领域、体系四环、术语表（key+中文+含义+代码锚点） | 全文中文，术语表价值最高 |
| `PROJECT-STATUS.md` | 包现状 | 全文中文 |
| `skill/SKILL.md` | Agent Skill 定义：两消费时机、五步循环、档位说明 | 主体中文（frontmatter 英文） |
| `skill/README.md` | Skill 使用文档 | 全文中文（另有 `README.en.md` 英文版） |
| `skill/references/patterns.md` | 模式参考 | 中文 |
| `skill/references/repair-guide.md` | 修复指南 | 中文 |
| `skill/references/rule-model.md` | 规则模型 | 中文 |
| `skill/references/workflow.md` | 工作流 | 中文 |
| `skill/references/cli-usage.md` | CLI 用法与 JSON schema | 中文（参数名为英文） |
| `docs/README.md` | docs 索引（specs/adr/promo/proposed/drafts） | 中文 |
| `evals/README.md` + `evals/METHODOLOGY.md` | 评测方法论（配对语料/lift 量化） | 中文 |
| `web/README.md` | 检测网站文档 | 中文 |
| 源码注释 | 规则与引擎内大量中文注释（含规则说明） | 混合 |

英文对照版：`README.en.md`（根）、`skill/README.en.md`（skill）——需要对外推广时以中文版为真相源、英文版为投影。

## ③ 外部中文参考资料（web 检索，2026-09-20；未逐条验证内容质量）

**同类/相关工具**
- [Humanizer-zh（GitHub, op7418）](https://github.com/op7418/humanizer-zh) — 中文 AI 写作去痕工具，改写 AI 生成内容使其更自然；与 llmlint 的 `fix` 目标相似但无规则库定位。
- [中文AI去痕工具（腾讯 SkillHub）](https://skillhub.cloud.tencent.com/skills/humanizer-zh-pro) — 基于维基百科"AI写作特征"指南检测修复 24 种 AI 写作模式。
- [AI检测（aijiance.org）](https://www.aijiance.org)、[isgen.ai 中文版](https://isgen.ai/zh-CN) — 中文 AI 率检测器（对应 llmlint 的外部 `detect` 链路生态，llmlint 默认对接 HF Space）。

**原理/方法论文章**
- [8 个特征识别和消除 AI 味（香芋工作流）](https://xiangyugongzuoliu.com/ai-style-writing-8-common-giveaways) — 句长方差低、困惑度/突发性（perplexity/burstiness）判别原理。
- [AI 检测工具如何识别"AI味"（ailv.run）](https://www.ailv.run/cn/blog/aijiancegongjvruheshibieaiwei) — 二分类模型学习人机文本微观特征差异。
- [国内 5 大中文 AI 生成内容检测利器（知乎）](https://zhuanlan.zhihu.com/p/1985855532163150426) — 国内检测工具汇总。

**结论**：中文社区对"AI 味检测/去痕"讨论活跃，但**公开的"规则库+可复现定位+人审闭环"工程化实现未见同类**（检索到的多为检测器或提示词去痕方案）——llmlint 的差异化（规则 lift 量化、双消费时机、审批制修复）在中文公开资料里没有直接对标，可作推广话术。

## ④ 术语对照表（英→中，源自 `CONTEXT.md` 术语表与 SKILL.md）

| 英文 key | 中文 | 一句话说明 |
|---|---|---|
| reference | 基准正文 | 人类原文，评测标准 |
| rule / regex rule | 规则 / 正则规则 | 确定性定位候选的静态规则 |
| density rule | 密度规则 | 按词频/密度判定的规则类 |
| handler rule | 处理器规则 | 需代码逻辑处理的规则类 |
| semantic rule | 语义规则 | 静态不可定位、靠模型读执行的规则 |
| lift | 判别力（提升度） | 规则区分 AI vs 人类的量化指标 |
| task profile | 任务画像/规则子集 | 某任务语料训出的规则子集+权重（如 creative-writing@1） |
| eval harness | 评测装置/体检仪 | 配对语料量化规则判别力的设施 |
| AI tell | AI 味 | AI 生成文本的可复现模板特征 |
| guide | 写作约束投影 | 写前把规则投影为提示词/文风预设的命令 |
| check / fix / detect | 检查 / 修复 / 检测 | 成稿期三命令 |
| repair plan | 修复计划 | Agent 结合语境制定、用户审批后执行 |
| learning notes | 学习记录 | 疑难判断的本地沉淀出口 |
| dependency gate | 依赖门 | 首次使用必须先装依赖的硬约束 |
| contribute | 投稿/采集 | 本机发件箱式判定数据采集（当前不上传） |
| blind review (wantReadOn) | 盲评（想读意愿） | 体系四环中的人类在环评价信号 |

> 完整术语以 `packages/llmlint/CONTEXT.md` 为唯一真相源；本表是节选投影，冲突时以 CONTEXT.md 为准。
