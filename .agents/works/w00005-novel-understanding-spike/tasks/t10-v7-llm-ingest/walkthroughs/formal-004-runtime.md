# formal-004 运行身份

2026-09-11 14:29:56 启动，PID54960，终端session29575，主 Agent 唯一控制运行及恢复。目标为连续1..20；不能把旧formal-003的3章或smoke-007首章当作本运行完成数。

- 策略版本 `v7-ingest-2026-09-11-4`，policyHash `db2d3861ac85b2f062c3cf2fdd8e1550105c55fb4d0f72560fb312bd35f2a0cc`。
- 输入hash `4875ca2cd860109dcce836d4164b53082eec2cab791ec53b7ce7f9283a72a7c4`，EPUB/V7归一化前20章不变。
- 七份策略源码冻结，原文保存于该运行policy-source.json；实现提交为f88bd1c3。其后的3e764d60只修t09角色空知情查询，不改变本次策略。
- 运行由 `node --import tsx cli.ts` 执行，stdout重定向result.json，stderr重定向progress.log。PowerShell可能缓冲日志，运行中应以manifest、逐尝试request/response和实际进程为准，不能仅由空progress.log认定没有活动请求。
- query_cli只读逐章验证，不启动或恢复ingest。达到有限尝试/语义轮上限时，主 Agent先检查真实错误与进程退出，之后才能同策略续跑；所有尝试保留。

首轮C指出签约动机整合漏项，第二轮沿用已审A只重做B。第二轮C又发现原材料将内心疑问并入古书发言、帮助主体和摘要依据错误，因此第三轮重做A/B；第三轮A的一个精确提及位置错误由结构补丁修复。不把C的每条拒绝都当作金标真值。

运行已由主 Agent 停止，head=1，PID54960及session29575均已结束，不再恢复。首章哈希为75bc03107b7b9d60e28d29cf76703fb1634ef01759304fb6155d2077bf9d2943；1:28查询复现四条过早使用后文名称的文字。第二章round-1/review/attempt-1只有request，没有response，按未知结果保留。停止记录见../evidences/formal-004/stop.json。后续按开发者最新的质量、价格与复杂度取舍采用新策略，新目录另行运行。
