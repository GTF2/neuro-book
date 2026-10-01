---
schema: nbook.work/v1
workId: w00023-model-library-reference-fill
issueId: null
---

# 相近模型参考补全

远端发现只给出模型 ID 时，用同族 Model Library 资料为缺失的能力字段提供参考值，并在界面逐字段标明参考来源，由用户确认后才进入 Provider Config。

## 来源与授权

2026-10-02 开发者在 fork（GTF2/neuro-book）用中转站（`https://opencode.ai/zen/go/v1`）发现 43 个模型，其中 7 个因 Model Library 精确 ID 未命中而显示「需要补充」。开发者问明原因后批准改进，并要求「参考的话，一定要在边上写清楚」。

根因（主工作区调查）：`server/models/discovery.ts` 的 `parseOpenAIModels` 只从中转站 `/models` 读到 `id` / `object` / `created` / `owned_by`；`provider-model-draft-factory.ts` 的 `completeModelCandidate` 只在精确 ID 命中 `modelKnowledge()` 时补全，未命中即不完整，而 `inspectModelCapability` 要求 `api` / `reasoning` / `input` / `contextWindowTokens` / `maxTokens` 齐全才能保存。

## 范围与非目标

- 只改设置页发现与模型编辑流程的补全与展示；参考值仅作预填，不自动启用、不写入未确认的配置。
- 不改 Model Library 数据源与精确匹配语义，不改远端发现协议。
- 不引入持久化的「参考来源」字段；参考标注是编辑会话内的展示事实。

## 当前 Task

| Task | 当前范围 |
|---|---|
| [t01](tasks/t01-reference-fill-and-label/README.md) | 已实现并验证：同族参考匹配、参考补全、逐字段标注与确认 |
