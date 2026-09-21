# 任务009C1F-Flash三组件+i18n

> **状态：已生效（2026-09-21 参谋部确认批次1 规格包通过，可立即开工）。**
> 规格源：`docs/design/009-单C-批次1-规格包.md` 第 4 节（本任务书是其裁发件，冲突时以规格包为准）。

## 运行配置（开工前设置，本节由前线填写完整）

- **本会话模型**：`account:bigmodel-individual-coding-plan/GLM-5.3-Flash` + 推理档位 **high**（新组件=读契约+照规格实现，分析+实现混合；非纯机械替换故不降 low）。
- **模式**：目标模式 + 完全访问（边界窄：只许新建三文件+i18n 块尾追加，规格已定死）。
- **给用户的现成命令**（直接粘贴）：
  - `/goal 任务009C1F：按 docs/tasks/任务009C1F-Flash三组件+i18n.md 完成 AgentCacheRing/AgentThinkingLevelSelect/AgentSessionScaleBar 三组件与 i18n 追加，交付报告填任务书`
- **工作流子代理模型**：本任务非工作流模式，无。
- **对口技能与命令**：
  - `impeccable`——组件视觉自检（`npx impeccable detect` 必须在仓库目录**外**运行，本仓库 npm overrides 会报 EOVERRIDE）
  - dev server 页面验证不适用本任务（三组件未挂载，真机效果归前线批次1 统一验收）

## 目标

新建 009 单C 批次1 的三个独立 UI 组件（缓存环/思考档快捷下拉/会话刻度条）+ i18n 键块尾追加，为前线 5.3 巨石施工提供挂载件。

## 开工前置

1. 读 `D:\MyProject\neuro-book\AGENTS.md` 的"本 Fork 工作规矩"节（绝对路径）
2. 读本任务书全文 + 规格包 `docs/design/009-单C-批次1-规格包.md` 第 3、4 节
3. 确认工作位置：**worktree 模式**（与前线 5.3 并行施工，避免争用主仓库工作区）——在 `D:\MyProject\worktrees\task-009c-f1` 目录内，`git rev-parse --show-toplevel` 验证；**注意：worktree 内操作一律用绝对路径或先 cd 到 worktree 目录**（worktree 场景下向上搜索可能读不到主仓库根的 AGENTS.md，用绝对路径读）
4. 读一个现成组件学约定：`packages/neuro-book/app/components/novel-ide/agent/AgentSessionModelControls.vue`（同目录 props/emits/Tailwind 主题变量写法）

## 范围与边界

- **允许改动（完整清单，一项不多）**：
  - 新建 `packages/neuro-book/app/components/novel-ide/agent/AgentCacheRing.vue`
  - 新建 `packages/neuro-book/app/components/novel-ide/agent/AgentThinkingLevelSelect.vue`
  - 新建 `packages/neuro-book/app/components/novel-ide/agent/AgentSessionScaleBar.vue`
  - `packages/neuro-book/app/i18n/locales/zh-CN.ts` 与 `en-US.ts`：**仅块尾追加**本任务新键（提交标注 `[i18n-add]`），禁改任何既有值
  - 三组件同名 `.test.ts`（可选但建议：mount 冒烟+props/emits 契约）
- **禁止改动**：上述五文件之外的一切文件；一切既有组件（AgentChatSurface/AgentComposer/AgentSessionModelControls 等归前线 5.3 串行独占）；master 提交；既有 i18n 值
- 不确定时：停下，在本任务书"疑问区"登记，待前线答复

## 组件契约（照规格包 §4，逐字执行）

### AgentCacheRing.vue
- Props：`hitRateLabel: string`（空串=整体隐藏）、`compactLabel: string`（hover title 全文）
- Emits：`open-context-inspector`
- 形态：绿色环形 SVG（按命中率比例描边填充），12-14px，hover 变亮；title=`compactLabel`+i18n 键 `agent.composer.cacheRingTitle`（zh"缓存命中概览"）

### AgentThinkingLevelSelect.vue
- Props：`modelValue: 'low' | 'mid' | 'high' | null`（对齐 ThinkingLevelDto 现有枚举，开工前 grep `ThinkingLevelDto` 核对实际值集）、`disabled: boolean`
- Emits：`update:modelValue`
- 形态：当前档位字标+下拉；选项 i18n 键 `agent.composer.thinkingLevel.low/mid/high`（低/中/高）

### AgentSessionScaleBar.vue
- Props：`segments: Array<{id: string; summary: string; anchorIndex: number}>`、`activeIndex: number`
- Emits：`seek(index)`（点击+拖动，拖动节流）、`expand()`（「查看全部」入口）
- 形态（规格包 §3 全条款）：右缘宽约 24px、高度固定；格数封顶 50（超出由调用方聚合，组件只渲染收到的 segments）；格高下限保证可点击；hover 预览卡显示该格 summary；点击=中面板（本组件只发 expand 由调用方定形态）；点外部即收
- **不做**：数据聚合（归挂载侧）、完整树内容

## 步骤建议

1. 三组件逐个建（建议顺序：CacheRing→ThinkingLevelSelect→ScaleBar，由简到繁）
2. i18n 两文件块尾追加全部新键（zh/en 同步）
3. typecheck + 新组件测试（若写）+ `bun run --cwd packages/neuro-book test -- app/components/novel-ide/agent/` 目录回归
4. 交付报告填本任务书末尾，状态改"待审"

## 验收标准

- `bun run --cwd packages/neuro-book typecheck` 零错
- agent 目录 vitest 全绿（对比基线：主包全量 3320过/17败/3跳，17败=NEURO_BOOK_REPOSITORY_ROOT 环境性，agent 目录不含这些）
- diff 审查：只有四类改动=三新文件+i18n 块尾追加（+可选三测试文件）；i18n 零既有值改动
- 组件与规格包 §4 契约逐条对得上（props 名/类型/emit 名一字不差——前线按此挂载）
- 交付报告含：改动文件清单、关键决策理由、自测证据（命令输出）、遗留问题、本窗口会话 ID

## 参考材料

- `docs/design/009-单C-批次1-规格包.md`（唯一规格源）
- `packages/neuro-book/app/components/novel-ide/agent/AgentSessionModelControls.vue`（组件写法约定样例）
- 旧库图纸只读参考（刻度条 hover 预览行为）：`D:\MyProject\neuro-book失败fork开发但可以学习经验\neuro-book`（commit `0f92cc9a`，禁 cherry-pick 禁照抄，按新库重写）

## 疑问区（工程队填写）

（空）

## 交付报告（工程队填写）

（空。格式：做了什么/为什么/自测结果/遗留问题/本窗口会话 ID）
