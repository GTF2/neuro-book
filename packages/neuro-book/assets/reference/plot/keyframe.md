# 关键帧（Keyframe）

关键帧是写作宪法第三条「人只写关键帧」的落点：人只声明**不可逆的状态变化**，帧与帧之间的正文交给 writer 演化——人定帧，模型补间。帧是故事时间轴上的锚点，既不是章节大纲，也不是写作指令。

数据面只有帧本身（`StoryKeyframe`，Project SQLite）：`instant` 锚 World Engine 时刻，`irreversibleChanges` 是补间回撞校验的标的。补间 workflow 见 `agent/workflows/keyframe-tween-review/`，主链操作流程见产品 Skill `novel-writing/phases/05-keyframe-tween.md`。Scene 是最小剧情单位（见 [system.md](system.md)），帧是时间轴锚点，两者可互相锚定但互不替代。

## 帧的字段

| 字段 | 语义 |
|---|---|
| `name` / `title` | per-story 唯一的机器名（如 `k-list-taken`）与人读标题 |
| `instant` | World Engine 时刻（非负整数字符串，与 Scene `worldAnchor` 同形） |
| `sceneId` | 可选锚定的 Scene；为空表示帧不挂在某场戏上 |
| `irreversibleChanges` | **声明式事实**列表：谁死、什么易主、哪条誓破了、什么东西从此不能再用 |
| `source` | `author`（人声明）或 `derived`（从正文反推，宪法第六条） |
| `status` | `pending` / `confirmed` / `violated` / `overthrown` |
| `decisionRefId` | 裁决留痕：指向推翻该帧的创作决策记录（该决策必须含决定/动机/风险） |
| `note` | 作者自由文本备注 |

## 事实与意义的分界（宪法第二条、第五条）

- 帧里写的是事实：**谁要什么、什么挡着、输了会怎样、什么不可逆地变了**。这些属于 writer 可以拿到的上下文。
- 帧里**不写**意义指令：结局要求、「必须隐瞒 / 只能暗示」、推进节拍、风格要求。它们要么进事后评审核对项（`reviewChecklistMarkdown`），要么留在作者给的写作任务书里。
- `note` 不保证是事实，所以 agent 工具对 `writer` profile 不返回 `note`；leader 与评审拿到完整字段。

## 状态流转（单向）

```text
pending ──(回撞未发现冲突)──> confirmed
   │
   └──(回撞发现冲突)──> violated ──(作者裁决)──> confirmed（维持帧：改正文，重跑回撞）
                                      └──────────> overthrown + decisionRefId（推翻帧：正文说了算）
```

- 创建恒为 `pending`，回撞与裁决是唯一出口，**不存在改回 `pending`**。
- `overthrown` 必须挂 `decisionRefId`：推翻设定必须留痕（宪法第六条）。因此 agent 工具**不提供删除帧**的动作，删除只由作者在 UI / HTTP 层执行。

## 补间区间

`get_tween_keyframes(fromKeyframeId, toKeyframeId)` 返回时间窗 `(from.instant, to.instant]` 内的帧：

- 起点帧的状态是**已知输入**（编译进 `fromKeyframe`）；
- 终点帧**含在内**，它是回撞校验的标的；
- 区间中间帧是补间演化的路标（编译进 `betweenKeyframes`）；
- 终点帧 `instant` 必须晚于起点帧，否则请求失败。

## Agent 工具

| 工具 | 用途 |
|---|---|
| `get_story_keyframe` | 不带 `keyframeId` 时按故事时间列出全部帧；带 `keyframeId` 时读单帧详情 |
| `get_tween_keyframes` | 读补间区间内的帧（`fromKeyframeId` + `toKeyframeId` 必填） |
| `save_story_keyframe` | `action=create` 声明帧（需 `name` / `title` / `instant` / `irreversibleChanges`，新建恒 `pending`，可用 `source=derived`）；`action=update` 改帧并承载回撞与裁决状态（需 `keyframeId`） |

写面按 action 显式声明意图，工具层的前置校验：

- `create` 不接受 `keyframeId`、`status`、`decisionRefId`；
- `update` 不接受 `source`（来源在创建时确定）；
- 帧只存在于 Project 维度；不传 `projectRoot` 时用当前已打开的 Project。

## 主链怎么用

1. **补间**：读帧 → `get_tween_keyframes` 取路标 → 编译 `fromKeyframe` / `toKeyframe` / `betweenKeyframes` / `worldFacts` → 调 `keyframe-tween-review` workflow（章节正文的主链见 `phases/03-chapter-loop.md`）。
2. **回撞有冲突**：冲突交作者裁决。维持帧 → 改正文、重跑回撞后 `save_story_keyframe action=update + status=confirmed`；推翻帧 → 先 `save_story_decision action=decide`（决定/动机/风险必填），再 `save_story_keyframe action=update + status=overthrown + decisionRefId`。
3. **从正文反推新帧**：写到正文才发现的新不可逆变化，用人话跟作者确认后 `save_story_keyframe action=create + source=derived`；若它推翻既有设定，同第 2 步留痕。

完成标准：`irreversibleChanges` 全是事实句；帧里没有写作指令；回撞冲突全部裁决，被推翻的帧挂了 `decisionRefId`；writer 的动笔前输入只有事实（帧声明 + 世界状态截面）。
