# 独立复核：策略 -5 部分发布与恢复

2026-09-11，Reviewer 接续 [设计复核](2026-09-11-bounded-publication-design-review.md)，只读核查 review-publication、compiler、runner、report 和对应测试。未调用真实模型、未修改实现、未恢复旧正式运行；仅新增本 walkthrough。

## 结论

未完成验证：本次有限语义修复、部分发布与恢复范围未发现阻断缺陷，可以继续真实 smoke。设计复核中的生成片段与摘要复活问题已处理。完整 20 章质量和实际性价比仍待正式产物，C 通过数不能解释为金标准确率。

## 实现复核

- 完整结构编译、原文提及、引用、时间及当前记录可见性校验先于状态应用；被拒节点不能靠 pending 绕过结构错误。完整 C 单元覆盖仍是发布前置条件。
- publication 重放整个章节前缀。直接被拒单元及其生成 Argument/Assessment 标 pending；被拒 Referent 的自有 Mention 同样退出投影。生成 Argument 保留真实 rejected 和 blocked，不用 placeholder passed 伪装发布结果。
- C 的逐项详细评语留在审计，图节点仅保存不含剧情的审查说明。rejected 和 missing 详情仍进入完整范围 coverage.gaps，受限查询沿既有 t09 边界隐藏。
- compiler 的自动摘要复用跳过被拒 Summary，并阻止同 facet 回退到旧候选复用。摘要既有 assessmentBasis 不被改写以恢复可见。
- runner 按持久 round 编号限制到 2。第二轮完整 C 的残余问题进入部分发布；最后一轮不写成需要第三轮的语义失败。结构/C 输出合同失败仍阻止发布。
- report 将部分发布章纳入正常生产分母与全部调用成本；quality 分别列出 C 拒绝/遗漏、pending 和投影不可用数量，明确不可用还包含历史摘要失效等原因，未标为准确率。

## 独立执行证据

`bun run test -- review-publication.test.ts runner.test.ts -t 'publication with bounded|publishes residual semantic rejection'`：2 个文件，9 项通过、17 项明确跳过。包含最后 C 响应保存后中断的新增回归；不将主 Agent 的完整 80 项结果算作本 Reviewer 再次执行。

另在测试支持包的系统 Temp 中独立组合：第一章两轮 C 均拒绝 Summary 并报告 integration 漏项；第二轮 C 原始响应落盘后中断；恢复后在章节快照落盘、manifest 尚未推进时再次中断；第二次恢复完成发布，再导入一个未更新该主体的第二章，最后重复运行。finally 清理全部测试产物。

实际共 8 次调用：第一章 5 次、第二章 3 次。第一章只有 round-1/round-2，两个恢复点没有新调用或第三轮；重复已完成前缀同样没有调用。第二章 snapshot 中 `c01:summary` 仍为 pending，没有 summary-reuse 节点复活其文本；节点 JSON 不含 C 的详细评语。报告第一章 reviewedUnits=9、rejectedUnits=1、missingItems=1，第二章分别为 1/0/0；生产外推包含全部 8 次调用。

## 普通引用与依赖边界

独立内存 fixture 将 A Referent 判为 rejected：Referent、自有 Mention、依赖其身份的 Fact 不可见；C 独立通过的 Disclosure 和 Beat 仍可见。该结果与本次设计接受的边界一致：普通引用不等于失效依赖，不做全图级联抹除。

由依赖间接不可见的 Fact，其另一路原始披露生成的论证也可能仍存在；本次没有宣称任何包含相关主体文字的记录都被隔离。这属于已明确的质量取舍，不应在交付说明中扩大成全面语义防泄漏或 100% 正确性保证。

## 复核源码身份

| 文件 | SHA-256 |
| --- | --- |
| review-publication.ts | `9dc1bcdf5fbb91e9293b37b69ab302afbaa03c2881629fe4eb1c3d978120524e` |
| compiler.ts | `6a389fc44b12ded7a024e51f10210818e736c08a0eaa80278823aa7ba8a4697f` |
| runner.ts | `30899d70ec0d145c8233582cf8d77cc4b703e02046ed1728ba3bb54f0f4574fd` |
| report.ts | `6118f0a460e74c0a5c1f8d851b5cedd786b09039ae7c00983b8bb36e2da50dce` |
