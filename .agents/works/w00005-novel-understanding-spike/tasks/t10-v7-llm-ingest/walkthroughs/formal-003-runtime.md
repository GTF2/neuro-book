# formal-003 运行接续

主 Agent 唯一控制正式运行和恢复，query_cli 只读检查已发布前缀。最新真实状态读取 `evidences/formal-003/manifest.json` 与 `progress.log`；不要因为旧 PID 消失而另行启动第二个写入者。

- 原 PID 58704、终端 session 66038 从第1章运行到第4章第2语义轮 B attempt-3 后退出，退出码1；已发布 head=3。不是 API 认证、输入或策略错误，而是单次 B 三次自动尝试耗尽。
- 最后错误是 `i_bailing` 引用了不存在的身份，实际候选为 `i_bailin`，影响三条事实及其持有者依据。原始错误位于 `ch04/round-2/integration/attempt-3/failed.json`；此前 A 已通过，全部原始响应已保存。
- 确认原 PID 已退出后，主 Agent 用相同源码、EPUB、配置和目录再次运行 `--through 20`。新 PID **64300**、终端 session **64096**，实际从 `ch04/round-2/integration/attempt-4` 开始；未重新调用前3章或已通过 A，未手工修正候选。
- 策略仍为 v7-ingest-2026-09-11-3，policyHash `9ab683a523cfad3f0e1618a50f9c0bf3a1e192a43c6f302b5c1d4f85c87ec569`。六份策略源码冻结；新增只读测量脚本和文档不属于运行策略。

完整20章尚未完成。第3章任务目标与风信子断开的语义缺口见 [逐章复查](query-cli-formal-003.md)；这不是已被修复的问题，最终报告需保留。

## 第二次恢复

PID 64300、session 64096 在第4章第4语义轮 C 后退出1，达到本次调用的语义轮数上限，head仍为3。第4轮 A/B的全部原始响应已保存。主 Agent 核对原文和被拒材料，确认真错误与误判同时存在：d21将白灵写为“她”，原文4:20明确用“他”；但d34“苏天晴想质问秘典：给她的强化药该不会是假的吧”中的“她”仍指苏天晴，C以它不同于原文“你给我的强化药”为由判为受事改变，这一条是转述人称的误判。不能把全部 rejected 都当成独立真值金标。

确认旧进程退出后，同目录同策略恢复到第4章第5轮 A。最新进程为 **PID 57288、终端 session 10563**。没有改写候选或复核回执；错误与正常修复都计入本次正式生产实验。第4章已表现出较差的语义收敛，最终报告须披露，而不是只列成功链的费用。

## 第三次恢复

PID57288、session10563在第4章第5轮B attempt-3后退出1。实际候选的 `p_meets.roles` 重复定义两个 `person`，`f_007_meets_bailin.arguments` 也把相遇双方写成同名角色，触发 `Invalid argument role`；不是恢复身份或源文变化。主 Agent 确认进程退出后按原策略继续 B attempt-4。最新进程为 **PID61672、终端session75615**，head仍为3，材料A复用。

## 停止于已保存检查点

PID61672、session75615已自然退出1，停止在第4章第6轮B attempt-3，错误为 `Invalid argument kind c04:f_fox_cross_star:item:referent`。第4章未发布，head=3，所有响应已保存，没有因本次停止新增未知服务端结果。此后不再恢复formal-003；Leader正根据独立按记录修复对照接入新的结构重试策略，见Task README与实施计划。旧3章产物和全部失败仍可只读查询与审计。
