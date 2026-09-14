# 回读验证与验收回执：canon 写入后回读核对

状态：draft

## 问题

拍板落库（canon commit）把确认过的剧情事实写进三个真相源：World Engine、Plot Workbench、lorebook。写入是"发出去就算完成"，过程中**不回读**：

- `phases/02-canon-commit.md` 写入后只检查返回的 `issues`（`severity: error` 必须修），然后回报"写了哪几段时间线"。**没有一步是"把我刚写的读回来，跟确认过的事实逐条比对"**。
- 于是三类偏差不可见：**写了但没生效**（patch 落在错误的 subject / path、被后续 op 覆盖）、**写成了另一件事**（op 选择不当，例如该 `append` 却 `replace`）、**该写的没写**（拆事件时漏掉一个状态变化，但没有任何东西提醒）。
- 也没有**回执**：用户看不到"这次提交实际用了哪些来源、落了哪些实体、哪些是新增哪些是覆盖"。事后要排查"这个设定到底是什么时候进库的"只能靠回溯会话。

结果：canon 与意图的偏差只能在很久之后、由下游冲突反推出来——而那时已经带着它写了好几章。

## 目标与非目标

### 目标

1. canon 写入之后，回读**刚刚写入**的那部分数据（World Engine 的 slice/patch、Plot 实体、lorebook 节点），与已确认的事实清单逐条比对。
2. 产出一份**验收回执**：每条 = 意图事实 + 回读结果（`已落地` / `偏离` / `未落地`）+ 证据 + 建议动作（重写 / 修正 / 保持）。
3. 回执**只核对、不自动修复**：偏差交作者 / leader 决定，写入仍走既有工具。
4. 复用既有只读工具，不新增实体、字段或工具。

### 非目标

- 不做自动修复（重写 slice / 回滚 patch 必须由人决定）。
- 不引入 StoryForge 的"不可变世界版本 / 快照隔离"（我们的 World Engine 可补写过去，模型更强，不需要版本冻结）。
- 不替代事后校验（正文 vs 声明）：本能力校验的是**写入 vs 确认意图**，发生在正文之前。
- 不改 writer 的动笔前上下文。

## 当前行为与证据

| 现状 | 证据 |
|---|---|
| 写入 World Engine 后只处理 `issues`，不回读核对 | `assets/workspace/.nbook/agent/skills/novel-writing/phases/02-canon-commit.md`「处理 issues」「回报当前状态」两节 |
| 写入 Plot 后只回报"更新了哪些实体"，不回读核对 | 同文件「更新 Plot Workbench」节 |
| 没有验收回执形状：读取来源、落地实体、新增/覆盖标记无处呈现 | 同文件「回报当前状态」节列出的是自由文本摘要，无结构化回执 |
| 调研结论：StoryForge 的 adopt 四段式（候选 → 确认 → adopt → **回读验证** → 回执）是我们缺的一环 | `docs/doctrine/prior-art-2026-09-14.md` 第一节表与第五节采纳清单 #3 |

## 方案、备选方案和取舍

### 方案 A（推荐）：skill 阶段 + 回执格式 Reference，回读在 leader 工具面内完成

1. **形态约束（沿用既有核实结论）**：workflow 内的 `adhoc` profile 工具面固定为 `read` + `report_result`，读不到 Plot / World Engine 数据（`assets/reference/agent/workflow/README.md`）。因此回读必须由持有工具面的 leader 执行，**不做 workflow**。
2. 入口：在 `phases/02-canon-commit.md` 的「写入 World Engine」与「更新 Plot Workbench」之后，新增「回读验证」步骤（写入与回读之间不插入其它写入）。
3. 回读手段，全部复用既有只读工具：
   - World Engine：`execute_world` 的 `world.slice.get` / `world.slice.list({withPatches:true})` 回读目标时间点的 slice 与 patch；
   - Plot：`get_story_chapter` / `get_story_scene_context` / `get_story_promise` / `get_story_keyframe` 回读对应实体；
   - lorebook：按内容节点 path 读回。
4. 输出：结构化回执（`intent` / `readBack` / `status` / `evidence` / `suggestedAction`）+ 人读 markdown。
5. 偏差处理：`未落地` / `偏离` 的条目交作者决定；修正走既有 `execute_world` / `save_*` 写入路径。
6. 回执格式写进运行期 Reference（`assets/reference/agent/canon-read-back.md` 或 `assets/reference/world-engine/canon-read-back.md`，落点在 Spec 定稿）；主链接入写进 `phases/02-canon-commit.md` 的完成标准与 `phases/03-chapter-loop.md` 的前置检查（写作前确认本章相关 canon 已回读通过）。

成本：一段 skill 步骤 + 一节 Reference；不新增 workflow、实体、字段或工具。

### 方案 B：写进 workflow

新增 `canon-commit` workflow 编排"写 → 回读 → 回执"。**取舍：本轮不采用**——依赖 `workflow-project-data-queries` 提案落地（workflow 能读项目数据）；在此之前 workflow 读不到 World Engine / Plot 数据，无法回读。

### 方案 C：自动修复

回读发现偏差直接重写 slice / 改写实体。**取舍：拒绝** —— 违反宪法第六条（判断力在执行层）与第四条（AI 不定义"好"）。

## 数据、接口、安全、迁移、发布与回滚影响

- **数据**：无新实体、无新字段、无迁移；全部只读回读。
- **接口**：不新增 HTTP 路由，不改 agent 工具签名。
- **安全**：只读；回执内容属小说规划数据，不含密钥或个人数据。
- **发布与回滚**：删除 Reference 与 skill 段落即回到现状，无数据遗留。
- **成本**：每次 canon commit 增加一次只读回读与一次人读回执；不增加模型调用（除非 leader 选择用 adhoc 归纳，属可选）。

## 对 Spec 的预期改动

- 新增 capability（拟定 `plot.canon-read-back` 或 `world-engine.canon-read-back`，落点 `docs/specs/plot/` 或 `docs/specs/world-engine/`，在 Spec 中定稿）的 `planned` Spec，按 `kind: behavior` 模板九节 + 实现合同 + 证据。
- 验收要点（Given / When / Then）：
  - **Given** 一组确认过的事实，**When** 写完并回读，**Then** 回执逐条给出 `已落地` / `偏离` / `未落地` 与证据；
  - **Given** 一条 patch 落在错误 path，**When** 回读，**Then** 回执标为 `偏离` 并给出实际落点；
  - **Given** 一条事实漏写，**When** 回读，**Then** 回执标为 `未落地`；
  - **Given** 任意一次回读，**When** 结束，**Then** 断言未修改任何数据。
- 失败语义：回读查询失败时 fail-closed，显式标注"未完成回读"，不把"没读到"说成"已核对"。
- 关联：`plot.keyframe`、`plot.chapter-writer-brief`、`plot.future-impact-analysis` 合同不变；`phases/02-canon-commit.md` 完成标准新增一条。

## 验收

1. Proposal 状态与决策记录完整，且未声称任何能力已实现。
2. 方案 A 的落点（skill / Reference）与现有资产不冲突，无新增实体或字段。
3. 与写作宪法逐条对照：不违反第二条（不触碰 writer 上下文）、第五条（仍是事后核对）、第六条（只标记、不裁决）。

## 决策记录

- 2026-09-14｜初稿｜来源 `docs/doctrine/prior-art-2026-09-14.md` 第五节采纳清单 #3（StoryForge adopt 四段式的「回读验证 + 验收回执」）。等待开发者决定 `accepted` / `rejected`。
