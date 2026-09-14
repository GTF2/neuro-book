---
schema: nbook.task/v2
taskId: t01-write-back-checks
role: tasker
---

# 写回校验清单：Reference 清单 + 消费方指向

## 目标

按 [Spec：写回校验注册表](../../../../docs/specs/plot/write-back-checks.md) 交付运行期清单 Reference，把现有分散的写回校验项收敛到一处，并在消费方加指向（不改语义）。

## 开发者参与

- 已确认：开发者概括授权（"你先按你的来吧"），接受 [Proposal：写回校验注册表](../../../../packages/neuro-book/docs/proposals/write-back-validation-registry.md)。
- 已确认：第一版**文档级清单**，不做运行时引擎；消费方只加指向，不改 workflow 语义与 brief 结构。
- 待开发者判定：后续是否把清单下沉为代码级注册表常量（另立提案）。

## 修改步骤

1. `assets/reference/plot/write-back-checks.md`（新增）：登记现有全部写回校验项，每项 `name` / `target` / `criterion` / `failureAction`（block/warn/record）/ `consumer`。至少覆盖：目标覆盖（brief 关键剧情点）、信息边界（`infoControl`）、禁写项（`briefDoNotWrite`）、承诺兑现（`PromiseBeat`）、关键帧回撞（`irreversibleChanges`）、正文 vs 声明一致性（三维评审 / `consistency-audit`）、canon 回读、下游失效（future-impact-analysis）、World Engine `issues`（E → block，A → record）。
2. `assets/reference/plot/README.md`：索引补该文件。
3. 消费方指向（各加一句，不改语义）：`assets/reference/plot/writer-brief.md`（第 3/6/7 段分工表后）、`phases/03-chapter-loop.md`（第四 / 五 / 六步附近）、`phases/02-canon-commit.md`（回读验证步骤）。
4. 治理：`docs/specs/plot/write-back-checks.md`（新增 `implemented` Spec）、`docs/specs/README.md`（登记）、`docs/standards/fork-seams.md`（S21）。

## 验证

- `bun run docs:check`、`bun run governance:check`。
- 结构核对：清单被索引；Spec 九节齐全、capability 唯一、证据为仓库内链接；迁移后失败动作不降级。
- 未验证项：真实模型下清单被消费方引用后的实际效果（需 Provider 授权）。
