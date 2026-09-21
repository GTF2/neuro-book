# 任务009C1F-Flash三组件+i18n

> **状态：已审合（2026-09-21 前线并入 510f7c48，271 绿复跑+两裁决采纳；worktree 已清理）**
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

（空——任务书与规格包的 modelValue 值集出入已按"冲突以规格包为准"解决，见交付报告偏差 1，未形成阻塞疑问）

## 交付报告（工程队填写）

**做了什么**（2026-09-21，单 commit `555aa210`，8 文件 +341 行）：

1. **AgentCacheRing.vue**：`hitRateLabel`/`compactLabel` props + `open-context-inspector` emit，与规格 §4.1 逐字一致。绿环 SVG（stroke-dasharray 比例描边，比例从 hitRateLabel 文本解析百分比、失败按 0，不造数），14px，hover `brightness-125` 变亮，空串 `v-if` 整体隐藏，title=`cacheRingTitle` 译文 + compactLabel 以 ` · ` 拼接。
2. **AgentThinkingLevelSelect.vue**：`modelValue: ThinkingLevelDto | null` + `disabled` + `update:modelValue`。字标（当前档中文）+chevron 图标+透明原生 select 叠加（点击即原生下拉，可达性零成本）。只露低/中/高三档（DTO 值 low/medium/high），null 显示 "—" 占位；档位不在三档内（off/minimal/xhigh/max）时字标回退显示原值。
3. **AgentSessionScaleBar.vue**：`segments`/`activeIndex` + `seek(index)`/`expand()`。右缘 24px（w-6）、高度随容器（h-full）、格 `min-h-[4px]` flex 均分保证可点击、活跃格 accent 高亮、hover 格变亮+右侧浮出预览卡（显示该格 summary）、点击/拖动定位、拖动 `setPointerCapture` + 80ms 节流；条底部「查看全部」图标按钮 emit `expand`。聚合与完整树归挂载侧，组件只渲染收到的 segments（未做 50 封顶裁剪）。
4. **i18n**：zh-CN/en-US 的 `agent.composer` 块尾追加 `cacheRingTitle` / `thinkingLevel.low|mid|high` / `scaleBarViewAll`（各 +7 行，零既有值改动，commit 标注 `[i18n-add]`）。
5. **三同名测试**（AgentCacheRing/AgentThinkingLevelSelect/AgentSessionScaleBar `.test.ts`）：契约断言（props/emits 字面量+关键实现特征）+ i18n 键双语齐备断言，仓库既有 readFile 源码断言模式（无 @vue/test-utils，mount 冒烟不可行）。

**关键决策理由**：

- **modelValue 值集以规格包为准**：任务书写 `'low'|'mid'|'high'|null`，但规格包 §4.2 与真实 `ThinkingLevelDto`（`shared/dto/app-settings.dto.ts:17`）都是七档枚举 `off/minimal/low/medium/high/xhigh/max`，且弹层内既有下拉就是七档。按"冲突以规格包为准"取 DTO 真实类型；UI 露三档（口径裁定 #5"外置快捷档位"），DTO 值 `medium` 映射 i18n 键 `thinkingLevel.mid`（键名照规格、值用 DTO 真实值）。
- **seek 发 anchorIndex 而非格下标**：规格给 segments 带 `anchorIndex` 而组件要把 seek 变成"挂载侧可直接定位"，发锚点消息序号最省挂载侧一跳；相应地 activeIndex 口径=**anchorIndex ≤ activeIndex 的最后一格高亮**（对话滚动落在两格之间时仍有正确高亮）。**此口径规格未明说，请前线核对**。
- **ScaleBar 未做 50 封顶裁剪**：任务书明文"格数封顶 50（超出由调用方聚合，组件只渲染收到的 segments）"——封顶是挂载侧义务，组件全量渲染。
- **三键新建而非复用既有 `agent.composer.low/medium/high`**：规格契约逐字执行（验收第 4 条），键路径 `thinkingLevel.*` 是契约一部分；与既有键的语义重叠留给前线定夺是否收敛。

**自测结果**：

- 新测试 7 用例全绿（`bun run test -- app/components/novel-ide/agent/AgentCacheRing.test.ts AgentThinkingLevelSelect.test.ts AgentSessionScaleBar.test.ts`）
- agent 目录回归：**29 文件 271 用例全绿**
- `bun run --cwd packages/neuro-book typecheck`：**零错**（026 时登记的那条 master 基线错误已被前线在 814482b1 收尾时修复）
- `npx impeccable detect`（worktree 外运行）：三组件**零发现**；全 agent 目录仅 2 条既有文件发现（AgentMarkdownContent.vue:181 side-tab、AgentWorkspaceChanges.vue:327 height transition），均属 5.3 独占的既有组件，与本任务无关
- diff 审查：改动恰好=三新组件+三新测试+i18n 两文件各 +7 行纯块尾追加，无第五类改动
- dev server 页面验证按任务书不适用（三组件未挂载，真机效果归前线批次1 统一验收）

**遗留问题**：

1. seek/activeIndex 的 anchorIndex 口径请前线核对（上文关键决策第 2 条）；若前线要格下标口径，改动只在两处 emit 与一处 computed。
2. `thinkingLevel.low/mid/high` 与既有 `agent.composer.low/medium/high` 语义重叠，是否收敛归前线。
3. CacheRing 的 title 拼接符（` · `）与 ScaleBar 预览卡样式（w-56/max-h-40）是规格留白处的自由裁量，前线挂载后不满意可直接改。
4. worktree 环境新坑登记：新 worktree 需 `bun install` + `nuxt prepare` + `bun run generate`（prisma 生成物）三步后才可跑测试/typecheck，缺前者报 TSCONFIG_ERROR、缺后者报 prisma client 5 条 TS2307。

**本窗口会话 ID**：`sess_f7630ad3-9078-4e74-b751-945479569d6e`
