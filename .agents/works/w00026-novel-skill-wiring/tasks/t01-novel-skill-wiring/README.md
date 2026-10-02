---
schema: nbook.task/v2
taskId: t01-novel-skill-wiring
---

# 写作主线能力接线

## 目标与范围

- `packages/neuro-book/assets/workspace/.nbook/agent/skills/novel-writing/phases/02-canon-commit.md`：「更新 Plot Workbench」段把 `assets/reference/plot/agent-spec.md:30` 的 Promise 维护纪律落成可执行条目（规划前 `get_story_promise` 查账本 → `save_promise_beat` 按场登记推进 → 里程碑式兑现传 `autoFulfill: false` → 改道显式 `abandon`、不留假 open）。
- `packages/neuro-book/assets/workspace/.nbook/agent/skills/novel-writing/phases/03-chapter-loop.md`：第五步修订的「文风/语句」分支补 llmlint 路由（`llmlint-review` 只查；`llmlint-full-review` 查-修-复测，含人工审批）；「写完若干章后体检」脚注扩成节律（卷末 / 每 10 章左右 / 大改设定后，与 `llmlint-full-review` 组合）。
- `packages/neuro-book/assets/workspace/.nbook/agent/skills/novel-guide/SKILL.md`：workflow 表补 `llmlint-review` / `llmlint-full-review` 两行（7/9 → 9/9）。

## 非目标

- 不改 `novel-writer-execution`：writer 由 leader 编排，不自行发起 workflow；writer 润色流程保持 writer profile 的 stop-slop 既有接线。
- 不给 novel-guide 三层结构表加 llmlint / stop-slop 行（那是可见性语义，不是流程路由）。
- 不动 profile、测试与 stop-slop Import fence 文本。

## 证据

（待填）

## 未验证

（待填）

## 执行位置

`.worktree/w00026-novel-skill-wiring`，分支 `feat/w00026-novel-skill-wiring`。
