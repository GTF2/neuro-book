---
schema: nbook.work/v1
workId: w00015-keyframe-agent-toolface
issueId: null
---

# 关键帧 agent 工具面与主链接线

把已实现的帧能力（帧实体、回撞流转、裁决留痕、补间 workflow）接到产品 Agent 工具面与主链上：agent 能读帧与补间区间、能声明与更新帧，Reference 有了关键帧正文，正文循环知道帧的存在。这是写作宪法第三条（人定帧、模型补间）与第六条（推翻留痕）在 agent 侧的最后一段接线。

## 交付边界

- agent 工具面：`server/agent/tools/plot-tools.ts` 新增 `get_story_keyframe` / `get_tween_keyframes` / `save_story_keyframe`；读工具按 `profileKey=writer` 白名单剔除 `note`（自由文本不保证是事实）。
- Reference：新增 `assets/reference/plot/keyframe.md`（帧字段、事实与意义分界、状态流转、补间区间语义、工具面、主链用法），并接入 `assets/reference/plot/README.md` 索引。
- 主链资产：`assets/workspace/.nbook/agent/skills/novel-writing/phases/05-keyframe-tween.md` 的裁决留痕与反推新帧改用真实工具名；`phases/03-chapter-loop.md` 的前置检查与完成标准补关键帧收口。
- 规范归属：[Plot 关键帧写作](../../../docs/specs/plot/keyframe.md)（本轮由规范缺口晋升为 `implemented`）。

## 不做

- 不改 `StoryKeyframe` 实体、DTO、HTTP 路由与服务层语义（只做 agent 侧投影）。
- 不提供删除帧的 agent 动作（推翻必须留痕，删除留给作者的人工维护通道）。
- 不改 `keyframe-tween-review` workflow 的编排与参数。
- 不做 UI 面板（属并行执行者）与 vitepress 用户文档（按既有 P2 计划单列）。
