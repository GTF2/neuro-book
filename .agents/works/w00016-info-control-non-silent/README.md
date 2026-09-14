---
schema: nbook.work/v1
workId: w00016-info-control-non-silent
issueId: null
---

# 信息控制事后校验：漏传必定显形

写作宪法第五条把「信息控制四字段」从写作前置降级为**写完之后的核对清单**。但这条核对要靠调用方把清单编译进 `chapter-write-review-revise` 的 `infoControl` 入参——漏传时这一层校验**静默消失**，评审照常通过。本轮把静默变成显形，并把「真自动编译」正式登记为独立能力。

## 交付边界

- workflow：`assets/workspace/.nbook/agent/workflows/chapter-write-review-revise/workflow.ts` —— 清单缺失时给一致性评审显式的「信息边界未核对」标注段、运行日志记警告、返回值新增 `infoControlChecked`；`argsHint` 写明清单来源与漏传后果。
- 主链资产：`assets/workspace/.nbook/agent/skills/novel-writing/phases/03-chapter-loop.md` 把 `infoControl` 从「可选」改为「每次都要传」，并写清从 `get_story_chapter` 的四字段编译。
- 格式契约：`assets/reference/plot/writer-brief.md` 第 3 段分工表同步。
- 规范：`docs/specs/plot/chapter-writer-brief.md` 的非目标与验收场景更新；`docs/specs/README.md` 新增 P1 缺口「Workflow 侧读取项目数据（infoControl 自动编译）」。
- 测试：`server/agent/workflow/chapter-write-review-revise.workflow.test.ts` 新增漏传用例，已有用例补 `infoControlChecked=true` 断言。

## 不做

- 不做真正的自动编译：需要宿主接线 `wf.query` / `wf.callAction`，让 workflow 能确定性读取 Plot 数据（已登记为 P1 规范缺口）。
- 不在每章写作的热路径上为读一个数据库字段增加一次模型调用（成本与不确定性都不划算）。
- 不把 `infoControl` 改成必填参数：workflow 读不到 ChapterBrief，无法区分「本章没有信息控制」与「忘了传」，直接失败会误杀前者——所以选择「显式标注」而不是「直接失败」。
- 不改实验专用 workflow `contrast-write-review`，不改 UI。
