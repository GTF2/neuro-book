# 写回校验清单（Write-back Checks）

"写完正文 / 写完 canon 之后要核对什么、失败怎么办"——这份清单把它一次说清。**校验项只在这里定义一次**，别处（brief 评审视图、三维评审、`consistency-audit`、未来影响分析、canon 回读）引用项名，不再各自另述判据。

本清单是**文档级**的：它不自动执行、不自动修复，只统一"核对什么 / 判据 / 失败动作 / 谁消费"。

## 怎么读

| 字段 | 含义 |
|---|---|
| 校验项 | 该项核对什么（唯一项名） |
| 标的 | 校验对象：正文 / canon / Plot 实体 / lorebook |
| 判据 | 通过与否的条件，必须可核对 |
| 失败动作 | `block` 必须改才能收口 · `warn` 提示，由人判断 · `record` 只留痕 |
| 消费方 | 读取并执行该项的环节 |

## 清单

| 校验项 | 标的 | 判据 | 失败动作 | 消费方 |
|---|---|---|---|---|
| `goal-coverage` 目标覆盖 | 正文 | brief 的关键剧情点是否全部覆盖 | `warn` | 三维评审（一致性）、`get_chapter_writer_brief` 评审视图 |
| `info-boundary` 信息边界 | 正文 | 角色是否知道了他不该知道的；「必须隐藏」是否被直接或变相泄露；「可暗示」是否被明说 | `warn`（漏传清单时显式标注「未核对」） | `chapter-write-review-revise` 的 `infoControl` → 一致性评审 |
| `do-not-write` 禁写项 | 正文 | 是否写了 brief 明令禁写的内容 | `warn` | brief 评审视图、三维评审 |
| `style-ai-slop` 文风与 AI 味 | 正文 | 重复句式、标签化情绪、翻译腔、总结式收尾 | `warn` | 三维评审（文风） |
| `pacing-hook` 节奏与钩子 | 正文 | 开头抓力、中段推进、章末钩子 | `warn` | 三维评审（节奏） |
| `consistency-declared` 正文 vs 声明 | 正文 | 与 World Engine 状态 / 已声明事实是否冲突（位置、伤势、持有物、认知） | `block`（与已确认事实硬冲突）/ `warn`（存疑） | 三维评审（一致性）、`consistency-audit` |
| `promise-beat` 承诺兑现 | Plot 实体 | 期限正好落在本章的 open Promise，若本章没有所在 Scene 为 written/revised 的 payoff beat，则提示；本章已有 factual payoff 即视为本章兑现证据。幅度仍按 note 收住 | `warn` | brief 评审视图、`consistency-audit` |
| `keyframe-tween` 关键帧回撞 | Plot 实体 | 补间区间内，帧声明的 `irreversibleChanges` 是否被正文推翻 | `block`（推翻须走裁决留痕，宪法第六条） | `keyframe-tween-review` workflow、三维评审 |
| `canon-read-back` canon 回读 | canon | 写入的 slice / Plot 实体 / lorebook 是否与确认意图一致（已落地 / 偏离 / 未落地） | `block`（偏离 / 未落地须先处理才能收口） | `phases/02-canon-commit.md` 回读步骤 |
| `downstream-impact` 下游失效 | Plot 实体 | 本轮新事实是否让未写的 Promise / Scene / 帧失效 | `warn` | `phases/03-chapter-loop.md` 第六步（未来影响分析） |
| `world-engine-issues` 引擎 issues | canon | `execute_world` 返回的 issues | `block`（E：持久数据错误）/ `record`（A：一次性提醒） | `phases/02-canon-commit.md`、`execute_world` |
| `decision-open` 未决决策 | Plot 实体 | 未拍板的问题是否保持开放，未被写死 | `warn` | brief 评审视图 |

## 失败动作口径

- `block`：不处理完不得收口。用于**已确认事实被违反**（一致性硬冲突）、**推翻帧未留痕**、**canon 偏离 / 未落地**、**World Engine E 级错误**。
- `warn`：进评审清单，由作者 / leader 判断是否处理。用于质量向与偏好向的核对（覆盖、信息边界、节奏、文风、下游失效）。
- `record`：只留痕，不要求动作（如 World Engine 的 A 级 advisory）。

**迁移约束**：现有语义不得降级——原三维评审判 `major` 的项应映射为 `block` 语义，`minor` 映射为 `warn`。

## 与既有契约的关系

- 清单**不改变**任何既有环节的行事方式：`get_chapter_writer_brief` 的 `reviewChecklistMarkdown` 结构不变，`chapter-write-review-revise` 的 workflow 入参与返回不变，`consistency-audit` 与 `keyframe-tween-review` 编排不变。
- 清单是它们的**共同索引**：要找"某一步核对哪些项、失败怎么办"，先查这里。
- 相关：`writer-brief.md`（brief 双视图与各段分工）、`future-impact-analysis.md`（下游失效）、`../world-engine/canon-read-back.md`（回读）、`docs/specs/plot/keyframe.md`（回撞与裁决）。

## 维护

- 新增一类校验：**先在本清单登记**，再让消费方引用项名（不要在消费方里另写判据）。
- 删除 / 改名：在同一变更中同步全部消费方引用。
- 本清单稳定后，可评估把项定义下沉为代码级注册表常量（届时另立提案）。
