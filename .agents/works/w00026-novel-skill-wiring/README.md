---
schema: nbook.work/v1
workId: w00026-novel-skill-wiring
issueId: null
---

# 写作主线能力接线

把已存在但未接线的旗舰能力接进写作 Skill 的相位文档与路由表：承诺账本维护纪律、llmlint 审稿路由、一致性体检节律。

## 来源与授权

2026-10-01 开发者提供外部调查报告（产品 Skill 风险与缺口）并要求判断与推进。核实结论：上游冲突低（`upstream/master` 是本仓库 master 的严格祖先，目标路径分叉度 0、上游 3～6 周未动）；报告的三个接线口令（承诺账本 / llmlint / 一致性体检）成立，合并为一个 Work 执行。

口令 1（skill-creator-zh 归档 / RP模式 改名）不在本 Work：Task 135 Open Item 4 原文要求「需要用户确认这个时机」，外部报告「开发者已批准」的说法不属实，待开发者单独拍板。

开发者批准的执行范围：只做写作主线能力接线，只改 canonical 源。

## 范围与非目标

- 只改 `packages/neuro-book/assets/workspace/.nbook/agent/` 下的 Skill markdown（novel-writing 两个相位文档、novel-guide 路由表）。
- 不碰 State Root（`%LOCALAPPDATA%\NeuroBook\data`）：改动内置包任意字节都会让 `assertBundledPackagesClean` fail-closed 且无恢复入口。
- 不改 profile、不改测试、不新建 Skill、不动 `packages/llmlint/skill/`（单一源；产品侧 `skills/llmlint/` 是生成投影）。
- 不把 llmlint 写作期 `guide` 接进 brief 约束段——本次只做成稿后路由，避免扩大改动面。

## 当前 Task

| Task | 当前范围 |
|---|---|
| [t01](tasks/t01-novel-skill-wiring/README.md) | 承诺账本纪律补全 + llmlint 路由 + 一致性体检节律 |

已收尾：b1e96fbe；待清理：`.worktree/w00026-novel-skill-wiring`、`feat/w00026-novel-skill-wiring`。
