---
schema: nbook.task/v2
taskId: t01-chapter-writer-brief-two-views
role: tasker
---

# brief 双视图改造：事实进 writer、意图进评审

## 目标

按 [Spec：Chapter Writer Brief 事实/意义双视图](../../../../docs/specs/plot/chapter-writer-brief.md) 实现双视图，使 `suggestedBriefMarkdown` 只含事实级内容，全部意图级内容移入 `reviewChecklistMarkdown`；并补上"writer 视图不含意图级内容"的断言。

## 开发者参与

- 已确认：全量实现（brief 双视图 + workflow/leader 评审通道一起改），先治理后代码。
- 已确认：保留三个 mode 枚举值，只废 `needs_chapter_brief` 门槛；`suggestedBriefMarkdown` 保留字段名。
- 待开发者判定：改完的"效果好坏"（需真实模型对照实验，另行授权）。

## 修改步骤

1. `shared/dto/plot.dto.ts`：`ChapterWriterBriefStatusSchema` 去掉 `needs_chapter_brief`；`ChapterWriterBriefDtoSchema` 新增 `reviewChecklistMarkdown`。
2. `server/plot/services/chapter-writer-brief.service.ts`：拆出 `renderWriterBriefMarkdown` 与 `renderReviewChecklistMarkdown`；`chooseStatus` 去掉信息控制门槛；三模式统一只输出事实。
3. `server/agent/tools/plot-tools.ts`：工具文本输出改用 writer 视图，更新参数与工具描述。
4. `assets/reference/plot/writer-brief.md`：格式契约改为双视图，删除三模式下的旧段落说明。
5. `chapter-write-review-revise/workflow.ts`：`brief` 不再作为 writer 消息内容下发；新增/复用评审清单入参，只注入评审。
6. 主链资产与 Reference 同步：leader-default / novel-writing-workflow / system / agent-spec / world-engine workflow / novel-writing phases。
7. 测试：`chapter-writer-brief.service.test.ts`、`plot-tools.test.ts`、`[...segments].test.ts` 补双视图与否定断言。
8. 用户文档中英对等改写（README、vitepress core/plot-workbench、profile/writer、profile/leader、tutorials/04）。
9. 登记接缝与规范：`docs/standards/fork-seams.md`、`docs/specs/README.md` 成熟度迁移。
10. 终审实验链路重建（双视图改造的连带影响）：新增实验专用 workflow `contrast-write-review`（调用方显式给定 writer 提示原样下发 + 三维评审一轮、不修订）与其回归测试；重写 `scripts/smoke/slice-vs-told-contrast.ts` 为单变量对照；同步 workflow 文档与接缝登记 S17。

## 验证

- 目标测试：`chapter-writer-brief`、`segments`、`plot-tools`（vitest，按 HANDOFF 的本机命令；过滤词不用带方括号的路径）。
- `bun run typecheck`；改 `docs/` 后 `bun run docs:check`。
- 未验证项：真实模型对照实验（需 Provider 与开发者授权）。
