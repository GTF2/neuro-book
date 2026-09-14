# 未来影响分析：正文采纳后标记受影响的下游规划

状态：accepted

## 问题

正文写作会产生计划外的事实：某个角色受伤、某样东西易主、某条线提前收束。事实一旦被确认为 canon（写入 World Engine / 更新 Scene），**下游规划可能已经失效**，而现在没有任何机制把它指出来：

- 一条承诺的兑现场景变得不可能（人或物已经不在），`PromiseBeat` 计划还挂着；
- 后续 Scene 的描述与已确认事实冲突（同一个时间窗里角色出现在两处）；
- 已声明关键帧的不可逆变化被正文推翻（宪法第六条允许推翻，但推翻必须留痕）；
- 承诺的期限/节奏已经落空（`Promise.deadlineChapterId` / `cadenceChapters`）。

结果：这些"失效"只能靠作者或 leader 事后自己想起来。想不起来就带着矛盾往下写，越写越难收。

## 目标与非目标

### 目标

1. 正文采纳之后，产出一份**受影响下游清单**：每条 = 目标（Promise / Scene / 关键帧 / 章）+ 影响类型 + 证据 + 建议动作（改计划 / 保持 / 待裁决）。
2. 清单**只标记待处理**，不修改任何规划；判断权留在作者与 leader（宪法第六条：判断力在执行层）。
3. 可逐项确认：作者 / leader 对每条确认"改"或"保持"；确认改的项进入既有流程（改 Scene / 改 Promise / 推翻帧 + `decisionRefId`）。
4. 复用既有数据与工具，不新增实体、不新增字段。

### 非目标

- 不做自动改规划、自动改帧、自动删 beat。
- 不做"全文一致性证明"：三维评审与 `consistency-audit` 做的是**正文 vs 声明**的反向核对，本能力做的是**新事实 → 下游规划**的正向扩散，两者不互相替代。
- 不引入 StoryForge 的"世界版本冻结 / 派生世界"概念。
- 不改 writer 的动笔前上下文（与宪法第二条无关）。

## 当前行为与证据

| 现状 | 证据 |
|---|---|
| 正文写完后只做反向核对（正文 vs 声明）：三维评审 + `consistency-audit`；新事实靠人记得回补 | `assets/workspace/.nbook/agent/skills/novel-writing/phases/03-chapter-loop.md` 第四 / 五步与完成标准；`consistency-audit` workflow（需 leader 手工整理 worldFacts） |
| Promise 有期限与节奏字段，但没有消费方做"落空检测" | `shared/dto/plot.dto.ts` 的 `Promise.deadlineChapterId` / `cadenceChapters`；`get_story_promise` 已能列出 beat 与派生阶段 |
| 帧有 `instant` 与单向状态机，但"正文推翻帧"只在人工裁决时才被发现 | `docs/specs/plot/keyframe.md`、`phases/05-keyframe-tween.md` |
| 调研结论：StoryForge 的"章后整理 → 未来影响分析"是我们缺的那一环 | `docs/doctrine/prior-art-2026-09-14.md` 第一节 1 与第五节采纳清单 #2 |

## 方案、备选方案与取舍

### 方案 A（推荐）：skill 阶段 + Reference 清单格式，扫描在 leader 工具面内完成

1. **形态约束（本轮核实的技术事实）**：workflow 内的 `adhoc` profile 工具面固定为 `read` + `report_result`，**读不到 Plot 数据**（`assets/reference/agent/workflow/README.md`：「adhoc 工具固定为 `read` + `report_result`。V1 没有 `initial.tools` 字段」）；`consistency-audit` 之所以要求 leader 预先整理 `worldFacts` 传入，正是同一约束。因此**扫描不能放进 workflow 内部执行**，只能由持有 Plot 工具面的 leader 完成。
2. 入口：在 `phases/03-chapter-loop.md` 新增「未来影响分析」步骤（置于修订之后、完成标准之前），输入 = 本章落点（`chapterPath` / `chapterId`）与本轮已确认的新事实（修改型：改结果 / 物品状态 / 角色位置 / 伤势 / 信息披露时产生）。
3. 三个只读扫描，全部由 leader 用既有工具完成，**不新增工具**：
   - **Promise 面**：`get_story_promise` —— 本章 Scene 上的 beats、未兑现且期限/节奏已过或临近的 Promise；
   - **Scene 面**：`get_story_thread` / `get_story_scene_context` —— 本章之后同 Thread 的 Scene、相邻章的 Scene 是否与新事实冲突；
   - **帧面**：`get_story_keyframe` / `get_tween_keyframes` —— 本章是否落在补间区间内、帧声明的不可逆变化是否被正文推翻。
4. 输出：结构化清单（`target` / `impactType` / `evidence` / `suggestedAction`）+ 一份人读 markdown 清单。
5. 人逐项确认；确认"改"的项走既有写入路径（`save_story_scene` / `save_story_promise` / `save_story_keyframe` + `save_story_decision`）。
6. 清单格式写进运行期 Reference（`assets/reference/plot/future-impact-analysis.md`），主链接入写进 `phases/03-chapter-loop.md` 的完成标准。

成本：一段 skill 步骤 + 一节 Reference；**不新增 workflow、不新增实体 / 字段 / 工具**。判断仍由人 / leader 做。

演进（非本轮）：当 `workflow-project-data-queries` 提案落地（workflow 能确定性读项目数据）后，可把扫描编排成 `impact-scan` workflow；本方案不依赖它，先以 skill 形态交付。

### 方案 B：写进 brief 编译

让 `get_chapter_writer_brief` 顺带输出"受影响"信息。**取舍：拒绝** —— brief 是**动笔前**输入，本能力的时机是**采纳之后**；混在一起还会让 brief 承担它不该承担的状态。

### 方案 C：自动修复

扫描后直接改 Scene / Promise / 帧。**取舍：拒绝** —— 违反宪法第六条（正文可以推翻设定，但推翻要留痕、由人裁决）与第四条（AI 不定义"好"）。

### 方案 D：只做人读提示，不出结构化清单

**取舍：可作为方案 A 的降级形态**（先只给 markdown），但不单独采用：结构化清单才能被后续 Task 与 UI 消费。

## 数据、接口、安全、迁移、发布与回滚影响

- **数据**：无新实体、无新字段、无迁移；只读既有 Promise / Scene / 帧数据。
- **接口**：不新增 HTTP 路由，不改既有 agent 工具签名；若后续需要 UI 呈现，按 UI 侧单独提案处理。
- **安全**：只读扫描；清单内容属小说规划数据，按根 `AGENTS.md`「真实模型调用与样本数据」一节属可入库内容，不含密钥或个人数据。
- **成本**：一次只读查询 +（可选）一次 adhoc 归纳；不影响 writer 的 token 预算结构。
- **回滚**：删除 Reference 与 skill 段落即回到现状，无数据遗留。

## 对 Spec 的预期改动

- 新增 capability `plot.future-impact-analysis` 的 `planned` Spec（目标落点 `docs/specs/plot/future-impact-analysis.md`），按 `kind: behavior` 模板九节 + 实现合同 + 证据。
- 验收要点（Given / When / Then）：给一章与一组新事实，清单须包含"被新事实破坏的 Promise 兑现场景"、"与事实冲突的后续 Scene"、"被正文推翻的帧"三类各至少一条；同时断言**清单过程未修改任何规划数据**。
- 失败语义：扫描查询失败时 fail-closed 报告，不产出"看起来干净"的空清单（不把"没查到"说成"没有问题"）。
- 关联：`plot.chapter-writer-brief`、`plot.keyframe` 合同不变；`phases/03-chapter-loop.md` 完成标准新增一条。

## 验收

1. Proposal 状态与决策记录完整，且未声称任何能力已实现。
2. 方案 A 的落点（skill / Reference）与现有资产不冲突，无新增实体或字段。
3. 与写作宪法逐条对照：不违反第二条（不触碰 writer 动笔前上下文）、第五条（仍是事后校验）、第六条（只标记、不裁决）、第七条（不承诺"更自由"）。

## 决策记录

- 2026-09-14｜初稿｜来源 `docs/doctrine/prior-art-2026-09-14.md` 第五节采纳清单 #2（StoryForge「章后整理 → 未来影响分析」）。
- 2026-09-14｜接受｜决策者：开发者（概括授权"你要做的你就做，需要我同意的我一概同意"）。接受时**修正方案 A 的落地形态**：扫描必须由持有 Plot 工具面的 leader 执行（workflow 内 `adhoc` 工具面固定为 `read` + `report_result`），因此以 **skill 阶段 + Reference** 交付，不新增 workflow；`impact-scan` workflow 形态待 `workflow-project-data-queries` 能力落地后作为可选演进。接受后创建 `planned` Spec `docs/specs/plot/future-impact-analysis.md` 与 Work `w00017-future-impact-analysis`。
