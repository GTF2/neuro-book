---
schema: nbook.work/v1
workId: w00025-keyframe-scale-validation
issueId: null
---

# 关键帧整章尺度与裁决闭环验证

本 Work 把关键帧整章尺度实验驱动纳入可审查的 current 治理：验证关键帧补间在整章尺度的连续性，以及正文修订与推翻关键帧两条裁决路径是否可实际闭环。

## 阶段主线登记

- 开发者于 2026-09-18 明确授权以 `feat/writing-doctrine-alignment` 作为持续集成阶段主线，完成阶段 0 收敛后在该分支继续开发。
- 本 Work 的最小登记提交进入并推送该阶段主线；不在本 Work 中合并 `master`、创建 PR 或修改发布分支。

## 交付边界

- T1：提交可复用的 `smoke:keyframe-scale` 入口与实验驱动，登记真实模型、临时数据创建和清理边界。
- 本轮不运行 smoke：它会调用真实 Provider、创建/更新/删除 `k-scale-*` 关键帧和 `d-scale-tween-overturn` 决策，且会触发关键帧补间工作流。
- 后续真实执行必须在明确的 Provider/模型授权、指定测试项目和运行中开发服务器条件下进行；默认清理、`--keep` 和 `--cleanup-only` 的副作用都须在 Task 记录中披露。
- 不改变关键帧产品合同、写作宪法判词、现有 workflow 语义或正文数据。
