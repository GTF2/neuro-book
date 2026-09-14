# t01 实施记录：关键帧 agent 工具面与主链接线

日期：2026-09-14。分支：feat/writing-doctrine-alignment。

## 实际改动

- agent 工具面（`server/agent/tools/plot-tools.ts`）：新增 `KeyframePatchSchema`、`GetStoryKeyframeSchema`、`GetTweenKeyframesSchema`、`SaveStoryKeyframeSchema`；新增读工具 `get_story_keyframe`（列表 / 详情）与 `get_tween_keyframes`（补间区间），新增写工具 `save_story_keyframe`（`action=create|update`）。`create` 恒 `pending`，不接受 `status` / `decisionRefId` / `keyframeId`；`update` 不接受 `source`。工具总数 15 → 18（8 写 / 10 读）。
- writer 收口：新增 `keyframeDetailsForProfile`，对 `profileKey === "writer"` 走白名单剔除自由文本 `note`；leader 与评审保留完整字段。
- 测试（`plot-tools.test.ts`）：facade mock 补 5 个关键帧方法；读写元数据断言更新为 8 写 / 10 读；新增 5 个用例（列表与详情、补间区间传参、create 必填与拒绝项、create/update 透传与 `source` 拒绝、writer 白名单剔除 `note` 而 leader 保留）。
- Reference：新增 `assets/reference/plot/keyframe.md`（帧字段、事实与意义分界、状态流转、补间区间、工具面、主链用法）；`assets/reference/plot/README.md` 索引补 keyframe.md，并顺带补上此前漏登记的 writer-brief.md。
- 主链 skill：`novel-writing/phases/05-keyframe-tween.md` 的「Plot API」调用改为真实工具名（读帧、补间路标、裁决留痕、反推新帧）；`phases/03-chapter-loop.md` 的前置检查加帧读取、完成标准加帧状态收口。
- 治理：新增 Spec `docs/specs/plot/keyframe.md`（`implemented`，capability `plot.keyframe`）；`docs/specs/README.md` 登记并移除已闭合的 P0 缺口行；`docs/standards/fork-seams.md` 新增 S18（S6 转指 S18）并更新改动面计数；`PROJECT-STATUS.md` 与 `HANDOFF.md` 同步现状与未收口列表。

## 验证

- `bun run --cwd packages/neuro-book test -- plot-tools`：1 file / 28 tests passed。
- `bun run --cwd packages/neuro-book test -- server/agent/tools`：20 files / 197 passed / 1 skipped。
- `bun run --cwd packages/neuro-book scripts:typecheck`、`bun run --cwd packages/neuro-book typecheck`、`bun run docs:check`、`bun run governance:check`：见本文件末尾补充。

## 偏差与说明

- 未新建 worktree：本仓库当前主工作区就在 `feat/writing-doctrine-alignment`，且存在并行执行者同时工作；按既有实践在同分支继续，避免切换分支影响他人。
- 全部改动为加法：未改上游既有工具签名，未改 DTO / HTTP 路由 / service 语义。
- `assets/reference/plot/README.md` 顺带补上了 writer-brief.md 索引（上一轮改写该文件时漏登记），属同行修复。

## 未验证

- 真实模型下的帧驱动效果（需 Provider 授权）。
- 运行中的应用对新 Reference 的可见性：Reference 属运行期资产，需资产同步 / 重启后才在运行期生效。
