---
schema: nbook.task/v2
taskId: t01-reference-fill-and-label
---

# 同族参考补全与来源标注

## 目标与范围

Model Library 精确 ID 未命中时，按模型族（族名一致 + 版本接近度 + 变体后缀重合）从内置资料中选出唯一参考模型，用它的 `reasoning` / `input` / `contextWindowTokens` / `maxTokens` / `thinkingLevelMap` 预填仍缺失的字段，并在发现列表与模型编辑窗口逐字段标注「参考 <modelId>」，由用户确认后才可保存。

已实现：

- `shared/models/model-library-reference.ts`：`selectModelLibraryReference` 纯函数。族名取最后一段 slug 的首个非版本词；版本词最多三位数字（`2601`、`0711` 这类日期戳不算版本）；只有版本距离 ≤ 1.0 或共享至少一个变体后缀才算同族参考，否则返回 null；并列时依次比较变体后缀重合数、额外词数、命名空间深度、ID。解析结果按资料数组实例缓存。
- `provider-model-draft-factory.ts`：新增 `model-library-reference` 来源与 `reference` 状态。精确资料优先；参考只补仍然缺失的字段，不覆盖远端值与 Provider 配置；必填字段靠参考补齐的候选不会自动启用。
- 发现列表新增 `remote-reference`（参考待确认）状态；点击后把候选与参考来源一起交给编辑窗口。
- 模型编辑窗口：摘要栏「N 项参考值待确认」、基本信息页参考块（模型 / 来源 / 已填入字段 / 填入按钮）、能力页四个字段的「参考 <modelId>」标注；值被改掉后该字段标注自动消失（`referenceFieldsStillMatching`）。
- `reapply-library` 与新增的 `apply-reference` 对已保存模型安排写回，避免改动随窗口关闭丢失。

## 非目标

- 没有同族候选时保持现状（「需要补充」，字段留空），不做跨族猜测。
- 不改变精确命中路径与远端字段优先级；参考值不覆盖任何已有来源的值。
- 不持久化「参考来源」：标注是编辑会话内的事实，保存后不再声称值的来源。

## 证据

- 单测：`shared/models/model-library-reference.test.ts`（9）、`provider-model-draft-factory.test.ts`（8）、`useModelDiscoverySession.test.ts`（9，含参考状态与点击传递）、`provider-settings-draft.test.ts`（18，含 4 条参考失效判定）。受影响套件 25 文件 / 171 测试通过（`bun run --cwd packages/neuro-book test model-library-reference provider-model-draft-factory useModelDiscoverySession useProviderTemplateSession provider-settings-draft component-lab`）。
- 真实资料核对：用内置 730 条资料对中转站实际模型 ID 逐一匹配——`glm-5.3`/`glm-5.3-flash` → `glm-5.2`（1,000,000 / 131,072）、`deepseek-flash`/`deepseek-v4.1-flash`/`deepseek-v4-flash-vision-exp` → `deepseek-v4-flash`、`kimi-k3` → `kimi-k2.7-code`；`longcat-2.0` 因只有带日期戳的 `longcat-flash-thinking-2601` 而拒绝匹配。
- 浏览器实测（worktree dev server，端口 3000，真实中转站 Provider）：发现列表把 glm-5.3、glm-5.3-flash、deepseek-flash 等标为「参考待确认」，longcat-2.0、qwen3.8-flash 等仍为「需要补充」；打开 glm-5.3 后摘要栏「5 项参考值待确认」、基本信息页「相近参考：glm-5.2（来源：zai）」、能力页 4 个字段标注「参考 glm-5.2」（实测计算样式 color `rgb(154, 91, 0)`、background `rgba(154, 91, 0, 0.12)`、border `rgba(154, 91, 0, 0.28)`，与 `--status-warning` 语义变量一致）；把上下文窗口改成 900000 后标注 4→3、摘要 5→4。
- Component Lab 场景 `reference-pending` / `reference-applied` 实测：前者显示参考块与「填入参考值（2 项）」按钮，后者按钮消失、参考块保留；`missing-fields` 场景仍显示原「Model Library 没有该模型的标准资料」提示。
- typecheck：与 master 基线一致（30 条既有错误，分布在 `tracked-workspace-files.ts`、`AgentExtraPanels.scenes.ts`、`batch.post.ts`、`fixtures/index.ts`），本次改动零新增。

## 未验证

- 未在 390px 窄屏与另一套主题下复核参考块与标注的换行表现。
- 「填入参考值」按钮只在 Lab 场景与类型层面验证过；真实数据里同 Provider 的参考候选都能被参考补全，按钮在真机流程中不会出现（已保存模型缺字段时才会）。

## 执行位置

`.worktree/w00023-model-library-reference-fill`，分支 `feat/w00023-model-library-reference-fill`。
