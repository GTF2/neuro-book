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

- 改动提交：`18a68478`（3 个 canonical Skill 文件，+9/-4）。
- 结构校验：`skill-creator/scripts/quick_validate.py` 对 `novel-writing`、`novel-guide` 均输出 `Skill is valid.`（exit 0）。
- 受影响既有测试（worktree，`bun run --cwd packages/neuro-book test server/agent/skills server/agent/profiles/{leader-assets-profile,profile-dsl,rp-profiles,writer-profile-contract}.test.ts server/workspace-files/{system-asset-installation,system-assets-preflight}.test.ts`）：10 文件 / 176 测试，174 通过；`rp-profiles.test.ts` 2 条失败（`NEURO_BOOK_REPOSITORY_ROOT` 缺失），在未改动 master 上同样失败（2 failed / 7 passed），属既有基线。
- 装机实测（worktree dev server 启动触发 `seedSystemAssets`）：State Root 三个文件与 worktree 字节一致；`installed.json` 中 novel-guide `e0dd6182→85ee77d1`、novel-writing `a23a69eb→ddf77741`、`nbookHash 8f2ce0d8→371783fc`；启动无 fail-closed 报错（`assertBundledPackagesClean` 通过），HTTP 200。
- 升级前预检：`installed.json` 无 dirtyAt、无异常 bundled 条目（唯一 `removed` 项是既有的 llmlint 账本墓碑，磁盘副本与 `packages/llmlint/skill/` 逐文件一致）。

## 未验证

- 未跑真实模型 Agent 会话验证行为（Provider 未配置模型）：`get_story_promise` 前置查询与 llmlint 路由的实际触发未实测；开发者配置模型后可补测。
- 未跑全量测试套件：改动为 markdown 资产，按验证门禁只跑直接受影响测试。

## 执行位置

`.worktree/w00026-novel-skill-wiring`，分支 `feat/w00026-novel-skill-wiring`。
