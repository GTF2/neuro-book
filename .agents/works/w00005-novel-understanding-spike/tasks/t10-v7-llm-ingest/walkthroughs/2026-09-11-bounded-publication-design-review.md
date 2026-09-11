# 有限语义修复与部分发布：独立设计复核

2026-09-11，按最新的性价比与简单模型目标，只读检查 proposed publication 边界。未修改主线、未调用模型、未恢复 formal-004。以下 fixture 检查为内存构造，不改变任何正式候选。

## 设计建议

方案可行，不必修改 t07 schema、添加节点类别或评分系统。建议小型 publication 模块承担完整 C 覆盖检查、真实审查结果应用、被拒单元的发布状态和诊断；runner 只负责全生命周期最多两轮语义候选和发布时机。仍保持原有结构/原文坐标/引用/可见性硬校验，不能将结构错误作为 pending 掩盖。

但只在最终 dataset 上把 C 对应的一个节点改为 pending，不能直接宣称“相关内容全部被 t07 原生投影隐藏”。两个确定性边界需要补齐，另一个传播边界应明确保留为质量取舍。

## 必须补齐的两个小边界

1. **确定性生成的同一单元片段也要退出可见投影。** 内存 fixture 将 Fact `c01:claim` 标为 pending、对应生成 Argument 的 review 改为 rejected 后，Argument 和 Assessment 仍可见；将 Resolution 标为 pending 后，其生成的 Argument、Assessment 也仍可见。原因是 t07 为避免结论/评估循环，故意没有将 argument.conclusion 和 assessment.target 纳入有效依赖。publication 应用明确的所有权映射：被拒 Fact/Resolution/Episode，以及对应生成 Argument 和 Assessment 一起 pending；Argument 的真实 C verdict/note 保留，不将其他独立模型单元的 passed 伪改为 rejected。被拒 Referent 的自有 Mention 也一起 pending。
2. **被拒摘要不能在下一章被自动复用成新 ID。** 已实际复现：两章完整重编译后，将 `c01:summary` 标 pending；`c02:summary-reuse-df8c775c878c5fca` 仍 ready，摘要查询继续返回同一文本。因为复用记录只依赖原始证据，不依赖旧 Summary。最简单的改动是在 compiler 自动摘要复用入口跳过被 C 拒绝的摘要及其后续复用链。可由 publication 提供被拒摘要 ID 集合给编译器，或显式返回复用来源映射；不要以修改旧 builtFrom 或改写摘要文字处理。若当前切片要更小，也可以暂时关闭自动摘要复用，明确无变化主体可能没有当前范围摘要。

publication 每次必须重放前缀所有章节的 C 状态，不能只处理当前章，否则完整重编译会恢复旧节点的 ready 状态。

## 原生传播的实际范围

内存 fixture 已验证：被拒 Disclosure 作为事实 Argument 的必需依据时，Fact/Access 随依赖不可见；被拒 Resolution 会使引用它的 Fact 和对应名称不可见；被拒 Episode 会使直接依赖它的 Summary 不可见。这些可沿用 t07，不需要再造传递算法。

但 t07 区分“引用”和“依赖”：Disclosure/Beat 的 referents、Episode 的 participants、KnowledgeAccess 的 holder、Summary 的 subject 等不是统一硬依赖。实际将 Entity 标 pending 后，指向它的 Episode 和 Summary 仍能通过通用 search/get 出现；将 Referent 标 pending 后，Disclosure/Beat 仍存在。被拒身份也不会自动清除所有提到该主体的独立通过单元。

建议本次明确只保证“被拒单元、自有生成片段和显式依赖路径不可见”，继续接受其它经 C 独立通过的单元可能存在错误。这个边界符合不追求 100% 正确的目标。不要用 collectReferences 全图级联 pending：名称与身份、Mention 与 Referent 存在正常双向引用，一次身份问题可能抹掉整条人物历史。若要求拒绝主体后的所有关联文本也退出，应另加少量按字段的规则与对应测试，而不能声称当前原生投影已提供这个保证。

## runner 的最小调整

- 轮数按持久 round 编号判断，仅 round 1/2；不能继续使用每次 invocation 重置的 rounds 计数。round 2 有完整 C 且结构合格后，保存最终候选并进入部分发布，不把它再次写成等待 round 3 的语义失败。
- round 1 有问题时只修一次；round 2 的 rejected 和 missing 均保留审计并在发布诊断中计数。missing 没有对应节点，不发明节点或支持证据，coverage 保持 partial。
- C 截断、覆盖缺项和重复 judgments 仍是合同失败，不能当成语义允许误差直接发布。结构尝试次数与语义轮数是两件事；“最多两轮语义”不等于总调用只有六次，价格报告仍需包含结构补丁与网络重试。
- 生成依据上的 verdict/note 必须来自实际完整 C。不能把 candidate-validation 模式的占位评语或临时 passed 留入最终审计图。
- 最终轮应作为发布轮记录；report 目前按发布轮与原材料来源匹配实际调用，不能因为 C 中存在 rejected 就把整章成本丢出正式生产样本。

## 最小验证集

1. round 1 失败后中断，恢复执行 round 2；round 2 仍有 rejected/missing 后部分发布，重复启动不生成 round 3 或新增 API 调用。
2. 修改 readiness 前完整结构校验仍拒绝假 mention、悬空引用、未来证据；C 少判单元不能部分发布。
3. 分别拒绝 Fact、Resolution、Episode、Referent，直接记录和自有生成片段不经 get/search/explain 泄漏；其它独立通过记录保留。
4. 被拒 Disclosure 的事实/知情路径、被拒 Resolution 的名称与 Fact、被拒 Episode 的摘要沿原生依赖隐藏；摘要不通过修改 assessmentBasis 恢复可见。
5. 旧章拒绝状态在新章和重启后保持；被拒 Summary 不能由新 summary-reuse ID 复活。具有独立通过新摘要时允许正常替代。
6. 原始 C rejected/missing 与调用来源保留，部分发布章所有有效和修复调用都进入生产成本，未发布章仍不进入外推分母。

结论：可以采用这个方向；上述所有权和摘要复用边界修好后，不需要复杂状态机或额外语义评分。真实 C 未发现问题仍只代表本次模型判定，不能作为金标保证。
