# 写回校验注册表：把"写完核对什么"收敛成声明式清单

状态：accepted

## 问题

"写完正文 / 写完 canon 之后要核对什么、失败怎么办"这件事，如今**散落在至少四处**，各自为政：

- `chapter-write-review-revise` 的三维评审（一致性 / 节奏 / 文风）；
- `consistency-audit` workflow（需 leader 预先整理 `worldFacts`）；
- `infoControl`（信息控制四字段，只进一致性评审）；
- `get_chapter_writer_brief` 的 `reviewChecklistMarkdown`（意图级评审视图）；
- 以及本 fork 新增的 `plot.future-impact-analysis`（下游失效扫描）。

后果：

- 新增一类校验（例如"承诺兑现""视角越界"）要在多处分别描述，容易漏；
- 作者 / 评审看不到**一张完整清单**：本章到底核对哪几项、每项的判据是什么、失败动作是"必须改"还是"仅提示"；
- 同一件事（如"信息边界"）在不同地方的措辞与失败语义不一致。

StoryForge 的做法是把写回校验收敛成**声明式注册表**（`FIELD_REGISTRY` + `AdoptionSchema`：声明校验什么、失败怎么办），由统一入口消费。我们缺这一形状。

## 目标与非目标

### 目标

1. 把现有的"写回校验项"收敛成**一个声明式清单**：每项 = 校验名 + 标的（正文 / canon / Plot 实体）+ 判据 + 失败动作（`block` 必须改 / `warn` 仅提示 / `record` 只留痕）+ 消费方（哪些评审 / 步骤读它）。
2. 该清单成为 `reviewChecklistMarkdown`、三维评审、`consistency-audit`、`future-impact-analysis` 的**共同来源**（各自仍是独立执行，只是共享"校验项的定义"）。
3. 第一版以**运行期 Reference 正文**承载（文档级），不引入运行时引擎；先统一描述，再谈自动化。
4. 不新增实体、字段或工具。

### 非目标

- 不引入 StoryForge 的 `FIELD_REGISTRY` / `AdoptionSchema` 运行时机制（我们只需要"声明的形状"，不是它的执行引擎）。
- 不自动执行校验、不自动修复。
- 不改 writer 的动笔前上下文（校验项只进评审 / 核对侧）。
- 不做 UI（若需要清单可视化，按 UI 侧单独提案）。

## 当前行为与证据

| 现状 | 证据 |
|---|---|
| 校验项分散：三维评审 + `consistency-audit` + `infoControl` + brief 评审视图 + future-impact-analysis | `assets/reference/plot/writer-brief.md` 第 3/6/7 段分工表；`phases/03-chapter-loop.md` 第四 / 五 / 六步；`chapter-write-review-revise` workflow |
| 失败语义不统一：有的"必须改"（major）、有的"仅提示"（minor / advisory） | `chapter-write-review-revise` 的 `ReviewSchema`（major/minor）；`execute_world` 的 `issues`（error/advisory） |
| 没有单一清单可回答"本章核对哪几项、判据是什么" | 无对应文件 |
| 调研结论：StoryForge 用 `FIELD_REGISTRY` + `AdoptionSchema` 统一写回校验 | `docs/doctrine/prior-art-2026-09-14.md` 第一节表与第五节采纳清单 #4 |

## 方案、备选方案和取舍

### 方案 A（推荐）：运行期 Reference 声明式清单（文档级），消费方引用它

1. 新增 `assets/reference/plot/write-back-checks.md`：登记全部写回校验项，每项给出 `name` / `target` / `criterion` / `failureAction`（`block` / `warn` / `record`）/ `consumer`。
2. 把现有条目迁入：信息边界（`infoControl` → `warn` + 记录）、承诺兑现（`PromiseBeat` → `warn`）、关键帧回撞（`irreversibleChanges` → `block` 需裁决）、下游失效（future-impact-analysis → `warn`）、canon 回读（回读验证提案 → `block`）、World Engine `issues`（`error` → `block`，`advisory` → `record`）。
3. 消费方改为**引用清单里的项名**，不再各自另述判据；`reviewChecklistMarkdown` 的段落与三维评审的提示词指向对应项。
4. 主链接入：`phases/03-chapter-loop.md`（评审 / 后处理）与 `phases/02-canon-commit.md`（canon 回读）引用清单。

成本：一节 Reference + 若干引用改写；不新增代码。

### 方案 B：代码级注册表

在 TS 里定义注册表常量，供 workflow / brief service 消费。**取舍：本轮不采用**——一旦进代码就要定义 schema、做迁移与兼容，成本远高于"先把现有校验项统一描述清楚"；等清单稳定后再评估是否下沉为代码常量（那时另立提案）。

### 方案 C：保持现状

**取舍：拒绝** —— 校验项继续分散，每加一项都要在多处重复，且作者看不到完整清单。

## 数据、接口、安全、迁移、发布与回滚影响

- **数据**：无新实体、无新字段、无迁移。
- **接口**：不新增 HTTP 路由，不改 agent 工具签名；`reviewChecklistMarkdown` 的**段落结构可微调**（改为引用清单项名），需同步 Spec 与测试断言。
- **安全**：清单只描述校验规则，不含数据；不引入新的数据读写。
- **发布与回滚**：删除 Reference 并回退引用即回到现状。

## 对 Spec 的预期改动

- 新增 capability `plot.write-back-checks` 的 `planned` Spec（`docs/specs/plot/write-back-checks.md`）。
- 验收要点（Given / When / Then）：
  - **Given** 一个章节，**When** 查看写回校验清单，**Then** 能看到本章涉及的校验项、判据与失败动作；
  - **Given** 新增一类校验，**When** 只改清单，**Then** 消费方（brief 评审视图 / 评审提示词）无需重复定义即引用到；
  - **Given** 清单与 `chapter-write-review-revise`、`consistency-audit` 的既有语义，**When** 迁移，**Then** 失败动作不降级（原 `major` 不得变成 `warn`）。
- 关联：`plot.chapter-writer-brief`、`plot.keyframe`、`plot.future-impact-analysis` 合同不变；`assets/reference/plot/writer-brief.md` 的分工表改为引用清单项名。
- 与「回读验证」提案的关系：后者是清单里的一个项（canon 回读），本提案是承载这些项的注册表。

## 验收

1. Proposal 状态与决策记录完整，且未声称任何能力已实现。
2. 方案 A 的落点（Reference + 引用改写）与现有资产不冲突，无新增实体或字段。
3. 与写作宪法逐条对照：不违反第二条（不触碰 writer 上下文）、第五条（仍是事后核对）、第六条（只标记、不裁决）。

## 决策记录

- 2026-09-14｜初稿｜来源 `docs/doctrine/prior-art-2026-09-14.md` 第五节采纳清单 #4（StoryForge `FIELD_REGISTRY` / `AdoptionSchema` 形状）。
- 2026-09-14｜接受｜决策者：开发者（概括授权"你先按你的来吧"）。接受方案 A（运行期 Reference 声明式清单，文档级，先统一描述现有校验项，不引入运行时引擎）；清单落点 `assets/reference/plot/write-back-checks.md`。**第一版保守实现**：清单作为单一索引入口，消费方（`writer-brief.md` / `03-chapter-loop.md`）只加"完整清单见 X"的指向，不改 workflow 语义与 brief 结构。接受后创建 Spec `docs/specs/plot/write-back-checks.md`（capability `plot.write-back-checks`）与 Work `w00019-write-back-checks`。
