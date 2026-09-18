---
schema: nbook.task/v2
taskId: t01-keyframe-chapter-scale-and-adjudication-smoke
role: tasker
---

# 关键帧整章尺度与裁决闭环 Smoke 驱动

## 目标

把已有的整章尺度关键帧实验驱动和 `smoke:keyframe-scale` 命令入口纳入仓库治理，使后续在获真实模型授权时可以复现：

1. 同一章时间线上四帧、三区间补间的连续性；
2. 正文未兑现帧声明时，通过修订正文重新验证的裁决路径；
3. 帧声明与 World 截面冲突时，创建决策记录、推翻旧帧并以修正帧接替的裁决路径。

## 范围

- 提交 `packages/neuro-book/package.json` 的 `smoke:keyframe-scale` 入口，以及 `scripts/smoke/keyframe-scale-experiment.ts` 驱动。
- 只提交驱动与治理记录；本轮不运行真实模型实验。
- 驱动运行时会创建/更新/删除名称前缀为 `k-scale-` 的关键帧和名称为 `d-scale-tween-overturn` 的决策，可能调用 `keyframe-tween-review` workflow，并在项目 workspace 写入临时 `.contrast/keyframe-scale` 产物。
- 默认路径会在 finally 中清理临时帧、决策和正文产物；`--keep` 故意保留数据供检查，`--cleanup-only` 会删除匹配临时名称的残留，二者均属于真实数据操作。
- 不改关键帧实体合同、writer 输入边界、写作宪法的实验判词或既有 workflow 编排。

## 验收

1. `package.json` 的命令入口与脚本路径一致，静态类型检查通过。
2. Work/Task 清楚记录真实 Provider、指定项目、临时数据 CRUD 和清理边界；未运行 smoke 时不得声称实验结果。
3. `bun run --cwd packages/neuro-book typecheck`、`bun run governance:check`、`bun run docs:check` 与 `git diff --cached --check` 通过。
4. 后续获授权运行时，记录命令、模型/Provider、目标项目、保留/清理选择、报告路径、结果和未清理残留。

## 开发者参与

- 开发者于 2026-09-18 授权先把脚本与入口纳入正式治理后提交；本轮不授权真实 Provider/Model 调用，也不授权对任何项目运行该 smoke。
- 真实运行前必须再次确认目标项目和 Provider/模型授权；不得以 `--cleanup-only` 清理非本 Task 产生的数据。
