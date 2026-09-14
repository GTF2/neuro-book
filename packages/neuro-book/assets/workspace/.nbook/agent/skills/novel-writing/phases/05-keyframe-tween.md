# 环节五：关键帧补间（写作宪法第三条）

人只写关键帧——不可逆的状态变化锚点；帧与帧之间的补间交给 writer 演化。图生视频：人定帧，模型补间。

本环节用于：两个关键帧之间的正文需要演化、或作者从正文反推出新帧（derived，宪法第六条）时。

## 前置

- 起点帧与终点帧已声明（用 `get_story_keyframe` 读，或作者口头给出后由 leader 代录）。
- 帧的 `irreversibleChanges` 是声明式事实（谁死、剑易主、誓破），不是写作提示。
- 已用 `execute_world` 预查补间区间的世界状态截面（时间窗查询，只读）。
- 帧状态（pending / violated / confirmed / overthrown）语义与工具面见 `reference/plot/keyframe.md`。

## 第一步：确认补间输入（事实，不是意义）

向作者确认，或用 `get_story_keyframe` / `get_tween_keyframes` 读取：

- 起点帧：instant 之前的状态事实（此刻横截面，不给因果链）。
- 终点帧：`name/title/instant/irreversibleChanges` 逐条列出。
- 区间中间帧（可选）：`get_tween_keyframes` 返回的 `(起点帧, 终点帧]` 路标，逐条列出。
- 世界状态截面：补间区间内会约束演化的状态事实。

**不要**给 writer：信息控制四字段、禁写项、未决决策警告——这些是意义指令，事后校验才用（宪法第五条）。

## 第二步：调用 `keyframe-tween-review` workflow

传参：

- `fromKeyframe` / `toKeyframe` / `betweenKeyframes`：第一步编译的帧声明文本。
- `worldFacts`：世界状态截面。
- `chapterPath`（可选）：补间正文落盘路径；缺省只返回。
- `writingTask`：篇幅/视角/文风要求。

workflow 内部：writer 演化补间正文 → 回撞校验员逐条撞 `irreversibleChanges` → 输出冲突清单。

## 第三步：裁决（撞错的帧）

回撞输出 `verdict=violated` 时，每条冲突由作者裁决，二选一：

- **维持帧**：修订正文后重跑回撞，帧置 `confirmed`。
- **推翻帧**（宪法第六条，正文反向推翻设定）：帧置 `overthrown` 并挂 `decisionRefId` 指向新创作决策记录（决定/动机/风险必填，推翻留痕）。随后回到 `01` 讨论新走向、`02` 落库。

workflow 不替你裁决；裁决与留痕走工具：维持帧 → `save_story_keyframe`（`action=update`、`status=confirmed`）；推翻帧 → 先 `save_story_decision`（`action=decide`，决定/动机/风险必填）再 `save_story_keyframe`（`action=update`、`status=overthrown`、`decisionRefId`）。

## 第四步：从正文反推新帧（derived）

写到正文时才发现的新不可逆变化，补录为 `source=derived` 的帧：

1. 用人话向作者确认这确实是不可逆变化。
2. `save_story_keyframe`（`action=create`、`source=derived`）。
3. 若它推翻了已有设定，同第三步走决策留痕。

## 完成标准

- 补间正文已落盘或返回，回撞 `verdict=clean`，或冲突已全部裁决。
- 被推翻的帧挂了 decisionRefId，决策记录含决定/动机/风险。
- writer 的动笔前输入只含事实切片（帧声明 + 世界状态截面），无意义指令。
