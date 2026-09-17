---
schema: nbook.task/v2
taskId: t01-world-anchor-suggestion-backfill
role: tasker
---

# T0.5：worldAnchor 半自动补齐

## 目标

接管 `world-anchor-suggestion.service.ts` 草稿，完成“确定性建议生成 → 明确人工确认或拒绝 → 安全合并写入 Scene worldAnchor”的服务端闭环，面向存量项目的章节通电补齐。

## 边界

- 只改 `server/plot/`、必要的 `shared/dto/plot.dto.ts`、现有 Plot API、相邻测试与本 Task 交付记录。
- 生成只写待确认建议；不调用 LLM；只有显式 `confirm` 请求才能写 Scene。
- 确认写入必须保留已有时间、地点和 subjects；同一建议的多 Scene 写入必须原子成功或整体回滚，失败保持 `pending` 可重试。
- 只从无 frontmatter 错误且 `active` 的 lorebook `character` / `location` 条目构造未解析候选；不触碰 UI 热区、`nuxt.config.ts`、`packages/nb-ui/**` 或其他会话文件。
- 原工作区的未跟踪草稿由本 Task 接管并复制到实现 worktree，原文件不得删除或覆盖。

## 验收

1. 服务单测覆盖生成、人工确认、拒绝、数据保留、失败回滚和存储异常。
2. 现有 Plot API 测试覆盖生成、确认、拒绝、非法输入与时间锚点保留。
3. 在系统临时根的真稿副本执行全量生成；对固定 20 章样本记录命中、误报、漏报、歧义、判定规则与准确率。
4. `bun run --cwd packages/neuro-book typecheck`、受影响测试与 `git diff --cached --check` 通过。
5. 在 `walkthroughs/`、`evidences/` 和统一实施计划台账记录真实命令、结果和未运行项。

## 开发者参与

- 已确认：接管现有草稿；先登记再实现；全部 T0.5 后端闭环。
- 已确认：使用隔离 `master` worktree 恢复治理登记路径，当前脏工作区保持不动。
- 不需要真实 Provider/Model、浏览器人工验收、数据库迁移或数据删除。
