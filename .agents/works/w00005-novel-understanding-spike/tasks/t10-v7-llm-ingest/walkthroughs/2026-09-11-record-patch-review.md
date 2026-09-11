# 独立复核：策略 -4 的结构补丁接入

2026-09-11，Reviewer 只读审查 `record-patch.ts`、`prompts.ts`、`runner.ts`、`runner-patch.test.ts`、`runner.test.ts` 及 report 的调用来源归属。没有修改实现、模型候选或正式运行，没有调用真实 API；只新增本 walkthrough。formal-003 保持停止状态。

## 结论

未完成验证：本次确定性合同、恢复和计费范围未发现阻断缺陷，可以继续由主 Agent 进行真实 smoke。策略 -4 的真实模型行为和连续 20 章尚未在本轮 Reviewer 范围内验证；本结论不是整个 ingest 的完成验收。

## 实现边界

- A/B 首次生成和 C 语义拒绝后的新轮始终请求完整候选。只有当前阶段已有可按唯一 ID 定位的候选、并在确定性校验失败后，才进入 record-patch。重复 ID、缺少集合或无法定位的顶层结构继续完整生成。
- 补丁只能替换同一集合内已有记录，替换记录仍过该集合完整 schema；不能新增、删除、改名或重复替换。多项补丁先操作隔离副本，某一操作失败不会更新当前基底。
- 合法补丁合成的候选即使还有其他错误，也完整保存为下一次修复基底；补丁格式非法、JSON 无效、网络失败等没有成功合成候选时保留旧基底。
- failed.json 持久化 nextResponseMode 与 nextMaxTokens；恢复从相同失败序列、candidate 和请求哈希重建模式与输入。regenerate 显式请求下一次完整生成，保留旧候选与具体原因。
- 每次调用仍保存原 request/response；补丁另存 repair.json，candidate/parsed 保存合成的完整候选。record-patch.ts 已纳入 policyHash，不允许新策略继续旧运行。
- C 明确禁止 record-patch，始终接收完整 A/B 和全部 reviewUnits；其结构错误也要求完整 C 响应。C 漏项、重复判定、语义拒绝仍阻止发布。语义新轮不会把上一轮 C 的错误反馈直接注入新 C。

## 独立组合复现

Reviewer 使用测试支持包分配的系统 Temp，通过 fake provider 执行以下组合路径；finally 清理全部临时产物。

1. A 首次返回 disclosure 枚举错误，下一次请求进入 record-patch。
2. 模型返回两项补丁：第一项能修正 disclosure，第二项试图创建不存在的 Beat。保存该响应后中断。
3. 恢复后补丁明确失败；下一次请求仍保留原非法 disclosure，证明先前那项合法替换没有部分写入基底。第三次 A 返回合法补丁，完整材料验证通过。
4. B 完整候选通过，C 完整审查返回 integration 漏项。下一轮复用完整 A，但 B 仍用 complete 模式修复，而不是结构补丁。
5. 新 B 的完整响应保存后再次中断；恢复不重新调用它。最终 C 以 complete 模式收到全部 reviewUnits，通过后发布。

实测输出：head=1；总调用 7 次，A 3 次、B 2 次、C 2 次。两次已保存响应均未重发。完整 C 的 reviewUnits 与合成 A/B 的实际单元逐项一致。

## report 来源与计费

同一复现实测 report 共 7 次调用：production-accepted 3 次，production-repair 4 次。材料的有效调用指向原始 round 1 的 attempt 3，即实际返回成功补丁的调用；后续材料复用不制造新调用。原完整候选及失败补丁仍计入修复，生产外推包含全部 7 次调用，不能仅用最终 3 次有效调用估算成本。

本轮同时检查了现有回归对尝试耗尽、无响应请求、显式 regenerate、非法补丁保留基底及只发布通过 C 的完整候选的覆盖。完整测试由主 Agent 运行，本 Reviewer 不重复声明其执行结果；上述独立组合脚本已实际运行通过。

## 复核源码身份

| 文件 | SHA-256 |
| --- | --- |
| record-patch.ts | `9ee0880d8ded0e20beb671768a3f49ee580bfac01a5c3e73d7a1ad87a8047ec6` |
| prompts.ts | `cc68cc762034251077fe2d7387cafcfd6b5e2c011d833dc3210d98184b51d161` |
| runner.ts | `2ff4cb7673f78d0d26db027e70e9c68c1393b2ddf32614288f27252f21b1b3fd` |

源码若继续变更，需要针对实际差异更新复核证据。记录替换不能处理需要新增、拆分或删除记录的语义调整；这类情况由显式 regenerate 或新的完整语义轮处理，属于设计边界。
