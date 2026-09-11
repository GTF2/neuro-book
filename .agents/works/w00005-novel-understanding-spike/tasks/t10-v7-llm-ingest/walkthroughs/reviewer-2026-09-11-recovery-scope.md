# 独立复核：候选恢复、材料复用与查询范围

2026-09-11 11:41–11:45，Reviewer 接续此前的合法 Episode 依赖审查。范围为当前 t10 compiler、runner、material-reuse、report，以及 t09 content/service 的 coverage.gaps 输出修复。实现只读，不调用模型，不改变活动运行或候选；仅更新独立 walkthrough。

## 结论

未完成验证：本次代码与确定性验证范围未发现新的阻断缺陷，前次 Fact/Argument 引用本章 Episode 的问题已关闭。完整任务仍需连续 20 章真实产物与跨章语义验收，本轮不据此宣称整个 ingest 完成。

## 构建次序

Fact、额外 Argument、Episode、KnowledgeAccess 已按显式依赖就绪顺序构建。此前两个复现已纳入并通过测试：Fact 以本章 Episode 为角色值、额外 Argument 以本章 Episode 为结论；加入反向事件材料依赖造成循环时明确拒绝，没有删掉引用或降低 schema 约束。

## 候选恢复与材料复用

raw candidate 在 JSON 解析后、schema 验证前以 `{value: ...}` 独立保存。schema 不通过时仍可向下一次模型请求提供原候选；恢复从相同文件重建 priorCandidate 和反馈，已保存的后继响应不再次调用。来源与失败反馈都作为数据进入提示词。

材料复用只发生于 C 对 A 全部逐项通过且 missing 为空时；材料被拒绝或存在未分阶段的漏项时重新执行 A。被复用的 A 内容哈希绑定本章原始模型 round；多轮复用直接指向原 round，拒绝中间复用 round、未来 round、循环和内容哈希变化。复用回执先于 accepted 副本保存，不能把半写入副本冒充新模型调用。

除现有测试外，Reviewer 在测试支持包分配的系统 Temp 中实际组合以下路径，并在 finally 清理：A/B 成功，C 第一次仅拒绝 B；第二轮复用 A，B 返回非法 scale，修正 B 的响应保存后中断；恢复解析保存响应，C 再次拒绝 B；第三轮继续复用原 A，B/C 通过。实际调用共 8 次，其中 A 1 次、B 4 次、C 3 次，恢复后 head 为 1；没有重发中断前已保存的 B 响应。

另移除第三轮的 accepted 材料副本，保留其回执，模拟回执已落盘而副本未落盘的状态。再次 `reuseMaterial` 从原始 round 1 恢复相同副本，未产生模型调用。

## 费用归属

上述 8 次组合运行由只读 report 校验后，3 次归为 production-accepted、5 次归为 production-repair；唯一 A 有效调用归于原始 round 1，未为两个复用副本制造调用，也没有把原 A 错归为废弃费用。生产外推计入全部 8 次调用，费用使用 fixture 用量计得 0.00072 美元；该数仅是 fake provider 的计费回归值，不是真实模型成本。

现有 report 回归也验证：未发布章调用和未知结果仍在总账，未发布原文不进入外推分母；development 模式不生成生产外推；缺失或矛盾的 reasoning 明细保持未知。

## 查询 coverage.gaps 范围

统一 presenter 覆盖顶层 coverage 和实体摘要/综述内部 coverage。章节/段落早于发布快照、角色视角或不能证明覆盖整个世界的查询，均使用无剧情内容的说明替换未标注位置的 gaps；完整读者范围保留原说明。返回对象不修改来源 dataset。

Reviewer 在不可变 `evidences/smoke-006/ch02/dataset-v7.json` 上复测原问题：`knowledge` 查询 `holder=c01:e_su`、`about=c01:f_codex_role_plan`、`at=1:66`，原始 20 条 coverage.gaps 均未出现在响应中；响应仅有“未提供当前阅读范围与视角专属的语义缺口说明。”完整读者 `info` 仍保留全部原始说明。角色视角的 Summary/Synthesis 和多世界边界由回归测试覆盖。

## 执行证据

- t10：`bun run test -- compiler.test.ts runner.test.ts semantic-repair.test.ts report.test.ts` 实际运行 3 个存在的测试文件、33 项通过。semantic-repair.test.ts 不存在；材料复用用例实际位于 runner.test.ts，未把不存在的过滤项算为测试。
- t09：`bun run test -- query.test.ts`，1 个文件、14 项通过。
- t10、t09 各自 `bun run typecheck` 均通过。
- 本轮独立组合恢复脚本、receipt-only 恢复和真实静态产物的范围查询均成功。没有执行真实 API 或全仓库测试。
