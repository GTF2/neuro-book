---
schema: nbook.work/v1
workId: w00022-chapter-writer-brief-two-views
issueId: null
---

# Chapter Writer Brief 事实/意义双视图改造

> 编号迁移：该 Work 曾以 `w00014-chapter-writer-brief-two-views` 登记，后发现与已在 `origin/master` 的 `w00014-issue-227-inline-ai-send-owner` 撞号。为保留历史且恢复 current Work 唯一性，迁移为 `w00022-chapter-writer-brief-two-views`；不重写已发布提交。

把 `get_chapter_writer_brief` 的交付物拆成互不重叠的两个视图：writer 只拿到事实切片，全部意图级内容改为事后评审的核对清单。这是写作宪法第二条（禁止意图级因果链）与第五条（事后校验、不事前告知）在 brief 通道上的落地，也是"事后校验"主张成立的前提——在 writer 只拿到事实之前，对照组不成立。

## 交付边界

- 编译核心：`server/plot/services/chapter-writer-brief.service.ts` 输出 `suggestedBriefMarkdown`（writer 视图）与 `reviewChecklistMarkdown`（评审视图）；废止 `needs_chapter_brief` status 门槛。
- DTO 与工具面：`shared/dto/plot.dto.ts`、`server/agent/tools/plot-tools.ts` 的文本输出只出 writer 视图。
- 评审通道：`assets/workspace/.nbook/agent/workflows/chapter-write-review-revise/workflow.ts` 不再把意图内容拼进 writer 消息；意图清单只注入评审。
- 主链资产与 Reference：`assets/reference/plot/`（writer-brief.md / system.md / agent-spec.md）、`assets/reference/agent/`（leader-default.md / novel-writing-workflow.md）、`assets/reference/world-engine/workflow.md`、`skills/novel-writing/phases/`。
- 规范归属：[Chapter Writer Brief 事实/意义双视图](../../../docs/specs/plot/chapter-writer-brief.md)。

## 不做

- 不新增 / 修改 Scene、Promise、Decision、Keyframe 实体与 schema。
- 不删除 `ChapterWriterBriefMode` 枚举值。
- 不做 `infoControl` 的自动编译（需要 Workflow 侧读取 Plot 的能力，属另一项 capability）。
- 不删除上游领地内容，不改写 `app/components/novel-ide/**` 既有定制。
