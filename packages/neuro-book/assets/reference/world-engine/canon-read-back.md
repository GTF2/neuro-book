# canon 回读验证与验收回执（Canon Read-back）

拍板落库把确认过的剧情事实写进三个真相源：World Engine（时间线 / 状态）、Plot（Thread / Scene / Promise / Decision / 帧）、lorebook（稳定设定）。写入这一步是"发出去就算完成"——本 Reference 规定它之后的**回读验证**：写完立刻读回来，跟确认过的意图逐条比对，产出一份**验收回执**。

它**只核对、不自动修复**。偏差交作者 / leader 决定。

## 为什么要有这一步

三类偏差只有回读才看得见：

| 偏差 | 怎么发生 | 不回读的后果 |
|---|---|---|
| **写了但没生效** | patch 落在错误的 subject / path，或被后续 op 覆盖 | 以为记下了，其实时间线上没有 |
| **写成了另一件事** | op 选择不当（该 `append` 却 `replace`、该 `replace` 却 `increment`） | 状态含义悄悄变了 |
| **该写的没写** | 拆事件时漏掉一个状态变化 | 正文照没有这个事实来写，越写越偏 |

## 什么时候跑

拍板落库的**写入之后立即**跑，且**写入与回读之间不插入其它写入**——否则回读到的就不是"我刚写的那一版"。回读完成、偏差处理完之后，才进入下一批写入或环节三。

## 回读哪些、怎么回读

全部用**只读**入口，不新增工具。

### 1. World Engine

- `execute_world` 的 `world.slice.get(sliceId)`：按 sliceId 精确读回刚写入的切面与 patch（`get` **只接受 sliceId**）。
- `world.slice.list({subjectIds:[...], withPatches:true})`：按 subject 读回相关切面，确认 patch 落在正确 subject / path 上。
- 比对点：时间点对不对、subject 对不对、path 对不对、op 与值是否符合意图。

### 2. Plot

- `get_story_chapter` / `get_story_scene_context` / `get_story_promise` / `get_story_keyframe`：读回本批更新或创建的实体。
- 比对点：Thread / Scene / Chapter 归属对不对、Promise 状态（新建 / 已兑现）对不对、Decision 的 chosenOption 与 risk 有没有落、帧的 instant 与 `irreversibleChanges` 对不对。

### 3. lorebook

- 按内容节点 path 读回本批回填的节点。
- 比对点：新增 / 修改的稳定设定是否真的写进了目标节点，有没有把动态事实倒灌成稳定设定。

## 回执格式

结构化数组，每条五字段：

| 字段 | 含义 | 取值 |
|---|---|---|
| `intent` | 本批要确认的事实（写入前的意图） | 一句话事实描述 |
| `readBack` | 回读到的实际内容 | 实际 slice / patch / 实体字段摘要 |
| `status` | 回读结果 | `landed`（已落地）/ `deviated`（偏离）/ `missing`（未落地） |
| `evidence` | 证据 | sliceId / patchId / 实体 id / 字段路径，可被核对 |
| `suggestedAction` | 建议动作 | `保持` / `修正` / `重写` |

## 人读 Markdown 模板

```markdown
# canon 回读验收回执 · 本批 N 条

## World Engine
- [landed] 薇洛丝解除莉雅封印（slice #123）
  - 回读：/status=被解封,部分失忆；/location=subject://ruins-meteor
- [deviated] 邪教徒队长认出项链
  - 意图：在 /events 追加“认出项链”
  - 回读：实际落在 /status 且用了 replace，覆盖了原状态
  - 建议：修正 —— 改回 append 到 /events，恢复 /status

## Plot
- [missing] 新立承诺“莉雅的记忆封印”
  - 意图：记入 Promise
  - 回读：未找到对应 Promise
  - 建议：重写 —— 补建 Promise

## lorebook
- 未发现（本批未回填稳定设定）

## 结论
- 全部落地：否（1 偏离 / 1 未落地）
- 需作者裁决：2 条
```

- 每条偏差都要给**可核对证据**（id / path），不写"感觉不对"。
- 全部 `landed` 时给出明确的"全部落地"结论；**不得用空回执冒充"已核对"**。

## 逐条处理

回执交给**作者 / leader** 逐条处理：

- `deviated` / `missing`：修正（重写 slice / 改 patch / 补建实体）走既有写入路径（`execute_world` / `save_*`）；`landed` 的保持不动。
- 处理完必要时再回读一次，确认修正也落地。

## 失败语义（fail-closed）

- 回读查询失败：显式标注**"该源未完成回读"**，不产出"看起来干净"的回执——绝不把"没读到"说成"已核对"。
- 部分源成功、部分失败：整份回执标注失败源为"未完成"，要求重跑。
- 本批无写入：返回"无需回读"，这是有效结果，与"回读失败"必须可区分。

## 与其它核对的分工

| 环 | 比对什么 | 时机 |
|---|---|---|
| **回读验证（本 Reference）** | 写入 vs 确认意图 | 写入之后、正文之前 |
| 事后校验（三维评审 / `consistency-audit`） | 正文 vs 已声明 | 正文之后 |
| 未来影响分析 | 新事实 → 下游规划 | 正文采纳之后 |

三者不互相替代。

## 不做什么

- 不自动修复（重写 slice / 回滚 patch / 改写实体必须由人决定）。
- 不引入不可变世界版本 / 快照隔离。
- 不改 writer 的动笔前上下文。

## 主链用法

见 `novel-writing/phases/02-canon-commit.md` 的「回读验证」步骤：写入之后、回报之前执行，产出回执并逐条处理。写作前，`phases/03-chapter-loop.md` 的前置检查会确认本章相关 canon 已回读通过。
