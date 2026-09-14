---
schema: nbook.work/v1
workId: w00017-future-impact-analysis
issueId: null
---

# 未来影响分析：正文采纳后标记受影响的下游规划

把 §宪法第六条「判断力在执行层」缺的那一环补上：正文被采纳为 canon 之后，主动扫描「本轮新事实 → 下游规划」的正向扩散，产出一份**只标记、不改动**的受影响清单（受影响的 Promise / 后续 Scene / 被推翻的关键帧 / 落空的期限），由作者与 leader 逐项裁决。

来源：[Proposal：未来影响分析](../../../packages/neuro-book/docs/proposals/future-impact-analysis.md)（`accepted`）；[Spec：未来影响分析](../../../docs/specs/plot/future-impact-analysis.md)。

## 交付边界

- 运行期 Reference：新增 `assets/reference/plot/future-impact-analysis.md`（清单格式合同：字段、三类扫描面、判据、示例、fail-closed 语义、不做什么），并接入 `assets/reference/plot/README.md` 索引。
- 主链资产：`assets/workspace/.nbook/agent/skills/novel-writing/phases/03-chapter-loop.md` 新增「未来影响分析」步骤（修订之后、完成标准之前），并把"新事实回补"一条指向该步骤；完成标准新增"受影响清单已产出并逐项确认"。
- 规范归属：`docs/specs/plot/future-impact-analysis.md`（本轮由 `planned` 晋升 `implemented`）；`docs/specs/README.md` 登记。
- 接缝登记：`docs/standards/fork-seams.md`（`03-chapter-loop.md` 的改动并入既有 skill 接缝范围，新增 Reference 属加法）。

## 不做

- 不新增 workflow（workflow 内 `adhoc` 工具面固定为 `read` + `report_result`，读不到 Plot 数据；扫描必须由持有 Plot 工具面的 leader 执行）。见 Proposal 方案 A 的形态约束。
- 不新增实体、字段、HTTP 路由或 agent 工具（复用 `get_story_promise` / `get_story_thread` / `get_story_scene_context` / `get_story_keyframe` / `get_tween_keyframes`）。
- 不自动修改任何规划，不替作者裁决（只标记）。
- 不改 writer 的动笔前上下文，不改三维评审与 `consistency-audit`。
- 不做 UI 面板（若需要，按 UI 侧单独立项）。
