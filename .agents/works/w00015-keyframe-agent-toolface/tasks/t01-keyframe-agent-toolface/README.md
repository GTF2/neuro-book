---
schema: nbook.task/v2
taskId: t01-keyframe-agent-toolface
role: tasker
---

# 关键帧工具面：读帧、读补间区间、声明与更新帧

## 目标

按 [Spec：Plot 关键帧写作](../../../../docs/specs/plot/keyframe.md) 把帧能力投影到 agent 工具面，并让运行期 Reference 与主链 Skill 指向真实工具，使「人定帧、模型补间」在 agent 侧可执行。

## 开发者参与

- 已确认：开工 P0-2（关键帧工具面），范围取「工具 + Reference 正文 + 主链接帧」，UI 面板留给并行执行者。
- 已确认：对照实验素材本轮只做核对，不在作品上新增数据（`xin-xiao-shuo` 现有 294 个场景、224 章中 213 章有 `briefGoal`；帧与决策记录为 0，关键帧链路的实测材料另行准备）。
- 待开发者判定：真实模型下「帧驱动 + 工具面」的写作效果（需 Provider 授权，另行进行）。

## 修改步骤

1. `server/agent/tools/plot-tools.ts`：新增 `KeyframePatchSchema` 与三个工具的 schema；`create` 恒 `pending`、不接受 `status`/`decisionRefId`/`keyframeId`，`update` 不接受 `source`，中文诊断沿用既有 action 校验写法。
2. 同文件：新增 `keyframeDetailsForProfile`，对 `writer` profile 白名单剔除 `note`。
3. `server/agent/tools/plot-tools.test.ts`：facade mock 补关键帧方法；读写元数据断言更新为 8 写 / 10 读；补列表与详情、补间区间、create/update 校验、writer 收口用例。
4. `assets/reference/plot/keyframe.md`（新增）+ `assets/reference/plot/README.md` 索引（顺带补上此前漏登记的 `writer-brief.md`）。
5. `assets/workspace/.nbook/agent/skills/novel-writing/phases/05-keyframe-tween.md`：裁决留痕与反推新帧改用工具名，补间路标改用 `get_tween_keyframes`。
6. `phases/03-chapter-loop.md`：前置检查加帧读取，完成标准加帧状态收口。
7. 治理：`docs/specs/plot/keyframe.md`（新增 `implemented` Spec）、`docs/specs/README.md`（登记 + 移除已闭合缺口）、`docs/standards/fork-seams.md`（S18 与改动面计数）。

## 验证

- 目标测试：`bun run --cwd packages/neuro-book test -- plot-tools`，以及 `-- server/agent/tools` 全目录。
- `bun run --cwd packages/neuro-book scripts:typecheck`、`bun run --cwd packages/neuro-book typecheck`。
- `bun run docs:check`、`bun run governance:check`。
- 未验证项：真实模型下的帧驱动效果；运行中的应用对新 Reference 的同步（需资产同步/重启后才在运行期可见）。
