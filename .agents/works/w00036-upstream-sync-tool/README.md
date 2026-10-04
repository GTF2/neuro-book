---
schema: nbook.work/v1
workId: w00036-upstream-sync-tool
issueId: null
---

# 上游同步工具：冲突面试算与报告

把既有同步纪律（`docs/standards/repository-workflow.md` 的「上游同步（fork）」一节）变成一条命令：fetch 上游后，用不落盘的试合并算出「上游改动 ∩ fork 改动」的真实冲突面，并按 fork 的「增量层玩家」纪律给出风险分级与建议。

## 来源与授权

2026-10-04 开发者要求继续推进计划。方向来自 fork backlog #3（fork 特性清单 + 一键同步脚本）：「fetch+merge 后输出『上游改动 ∩ 我们改动』冲突面报告，把同步纪律变成工具」。

## 范围与非目标

- 新增一个 CLI 脚本（`scripts/git/` 下）+ 聚焦测试；在根 `package.json` 注册一条命令。
- 只做只读分析：`git fetch upstream` + `git merge-tree` 试合并，**不改工作树、不落盘、不自动合并**。
- 不替代人工判断：脚本给分级与依据，合并决策仍由开发者做。
- 不改同步纪律正文（`repository-workflow.md` 保持唯一真相源，脚本读它的分级口径）。

## 当前 Task

| Task | 当前范围 |
|---|---|
| [t01](tasks/t01-sync-tool/README.md) | 当前：冲突面试算 + 分级报告 + 聚焦测试 |
