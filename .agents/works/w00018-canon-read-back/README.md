---
schema: nbook.work/v1
workId: w00018-canon-read-back
issueId: null
---

# canon 回读验证与验收回执

拍板落库把确认过的事实写进 World Engine / Plot / lorebook 之后，**立刻回读刚写入的那部分**，与确认意图逐条比对，产出验收回执（`已落地` / `偏离` / `未落地` + 证据 + 建议动作）。补上 StoryForge adopt 四段式里我们缺的「回读验证 + 验收回执」一环。

来源：[Proposal：回读验证](../../../packages/neuro-book/docs/proposals/read-back-verification.md)（`accepted`）；[Spec：canon 回读验证](../../../docs/specs/plot/canon-read-back.md)。

## 交付边界

- 运行期 Reference：新增 `assets/reference/world-engine/canon-read-back.md`（回执格式合同：字段、三类偏差、各真相源的回读手段、fail-closed 语义、与事后校验的分工、不做什么），并接入 `assets/reference/world-engine/README.md` 索引。
- 主链资产：`assets/workspace/.nbook/agent/skills/novel-writing/phases/02-canon-commit.md` 新增「回读验证」步骤（写入之后、回报之前），并把「回报当前状态」改为以回执为基础；完成标准新增一条。`phases/03-chapter-loop.md` 前置检查新增"本章相关 canon 已回读通过"。
- 规范归属：`docs/specs/plot/canon-read-back.md`（capability `plot.canon-read-back`，`implemented`）；`docs/specs/README.md` 登记。
- 接缝登记：`docs/standards/fork-seams.md`（S20）。

## 不做

- 不新增 workflow（workflow 内 `adhoc` 工具面固定 `read` + `report_result`，读不到 World Engine / Plot 数据；回读由持有工具面的 leader 执行）。
- 不新增实体、字段、HTTP 路由或 agent 工具（复用 `execute_world` 与既有 `get_story_*` 只读入口）。
- 不自动修复偏差，不引入世界版本冻结 / 派生世界。
- 不改 writer 的动笔前上下文，不改三维评审与 `consistency-audit` 语义。
- 不做 UI。
