---
schema: nbook.work/v1
workId: w00019-write-back-checks
issueId: null
---

# 写回校验注册表：把"写完核对什么"收敛成声明式清单

把散落在四处以上的"写完正文 / 写完 canon 之后要核对什么、失败怎么办"收敛成**一份声明式清单**（`name` / `target` / `criterion` / `failureAction` / `consumer`），成为 `reviewChecklistMarkdown`、三维评审、`consistency-audit`、未来影响分析、canon 回读的共同索引入口。

来源：[Proposal：写回校验注册表](../../../packages/neuro-book/docs/proposals/write-back-validation-registry.md)（`accepted`）；[Spec：写回校验注册表](../../../docs/specs/plot/write-back-checks.md)。

## 交付边界

- 运行期 Reference：新增 `assets/reference/plot/write-back-checks.md`（登记现有全部写回校验项及五要素），并接入 `assets/reference/plot/README.md` 索引。
- 消费方指向（**只加指向、不改语义**）：`assets/reference/plot/writer-brief.md` 的分工表、`phases/03-chapter-loop.md` 的评审 / 收口步骤、`phases/02-canon-commit.md` 的回读步骤，各加一句"完整清单见 `write-back-checks.md`"。
- 规范归属：`docs/specs/plot/write-back-checks.md`（capability `plot.write-back-checks`，`implemented`）；`docs/specs/README.md` 登记。
- 接缝登记：`docs/standards/fork-seams.md`（S21）。

## 不做

- 不引入运行时注册表引擎（StoryForge 的 `FIELD_REGISTRY` / `AdoptionSchema`）；第一版是**文档级**清单。
- 不改 `chapter-write-review-revise` 的 workflow 语义、入参与返回结构；不改 `reviewChecklistMarkdown` 的段落结构；不改任何 agent 工具签名。
- 不自动执行校验、不自动修复。
- 不新增实体、字段、HTTP 路由或工具。
- 不做 UI。
