# 独立复核：上下文依据与事件依赖

2026-09-11，Reviewer 对 `37ef4bf1` 之上的当前 t10 未提交实现做窄范围只读复核。未修改实现、候选或原文，未调用真实 API；下述本地 fixture 仅用于确定性验证，不进入模型输入。

## 结论

需要修复：上下文依据组和 Access/Episode 双向依赖修复已通过复核，但当前构建顺序仍拒绝两种合法的本章 Episode 引用。此结论不代表完整 ingest 或真实 20 章已验收。

后续状态：上述构建次序问题已在同日修复并独立复测关闭，当前结论与新增恢复/查询范围验证见 [后续独立复核](reviewer-2026-09-11-recovery-scope.md)。本记录保留发现时的复现证据。

## 已关闭的本轮检查

- `bun run test -- prompts.test.ts compiler.test.ts runner.test.ts`：3 个文件、26 项测试通过。
- 从合法 fixture 删除 `c01:claim` 的 Assessment 后，`priorContext` 的 records 和 allowedIds 均不包含该无评估 Fact；没有把无评估命题作为可引用知识输出。
- 在只读 t07 图上测量当前上下文：142 条记录、89,847 字符、5 个 Fact，5 个均为 `direct-complete` 且附有投影后的 Assessment；其它记录存在 1 项显式 `partial`。66 个未提供引用继续在 missingReferences 中报告，未授予引用权限。这里的完整仅表示直接依据组，不表示递归全证据闭包或语义真值无条件成立。
- 独立 fixture 构建 `heard Access → Episode → known-event Access` 的交替依赖链成功，支持前后两种方向；已有循环拒绝测试通过。
- 同一候选移除所有 C judgments 后，默认发布编译明确失败于 `Review must cover exactly all requested units`。B 预编译没有使该候选获得发布资格。

## 需要修复：本章 Episode 引用被构建顺序拒绝

位置为 `compiler.ts` 中 facts 和额外 arguments 的构建循环；二者均在 `pendingEvents` 创建本章 Episode 之前运行。

复现一：以 `fixtureChapter()` 为基线，追加一个 Predicate，其第二角色 `valueKinds: ["episode"]`；追加 Fact，实体角色引用 `person`、事件角色引用 `event`，at 为 2，身份为 `identity`，依据为 `dclaim`；更新 fixture reviewUnits 为全通过。模型候选 schema 和前置位置检查通过，但编译报 `Unknown reference c01:event`。

复现二：同一基线上向 `integration.arguments` 追加 `{id: "event_support", at: 2, target: "event", polarity: "supports", proof: {premises: ["dclaim"], method: "direct", certainty: "accepted", rationale: "Independent source corroborates the event"}}`，更新 fixture reviewUnits。编译同样报 `Unknown reference c01:event`。

t07 Predicate 合同明确允许 Episode 作为 Fact 角色值；t10 的引用合同也接受本章局部 ID。上述引用没有未来依赖或循环，拒绝来自构建次序。实际模型可能因此被迫反复改写已有合法候选。应由实现者统一安排这几类语义记录的就绪次序，保留明确循环失败；不能通过删除 Episode 引用或降低校验消除报错。

## 仍未验证

真实模型的语义覆盖、跨章主体复用和连续 20 章产物尚未由本轮 Reviewer 验收。当前 smoke 的修复与运行由主线 Tasker 负责。
