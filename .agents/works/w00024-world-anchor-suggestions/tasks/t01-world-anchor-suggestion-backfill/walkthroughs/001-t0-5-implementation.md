# T0.5 实施与验收记录

## 当前状态

已完成 T0.5 的后端闭环：项目可以从 World Engine 与有效 Lorebook 条目生成待确认的 worldAnchor 建议；只有显式确认 API 才会在单条建议的事务内合并写入章节 Scene。生成、确认和拒绝均不触碰正文。

## 实际改动

- 接管并完成 `world-anchor-suggestion.service.ts`：
  - 纯词面匹配，单字排除、二字至少两次、三字及以上至少一次；
  - World subject 优先，Lorebook 只接受 `active`、无 frontmatter 错误的 `character` / `location`；
  - 生成只写 `.nbook/world-anchor-suggestions.json` 的 `pending` 队列；确认走 `pending → applying → confirmed`，Scene 已写但 confirmed 队列写失败时保留 `applying`，重试确认可幂等收口；
  - 旧项目无 `chapter:` 指针时，先按 `vol-XX-ch-YY` 与 `NNN-*/NNN-chapter` 目录键匹配；没有结构化键才按标题唯一匹配；仅把无有效指针、无 frontmatter 错误的正文纳入回退，不修改正文 frontmatter；
  - 同标题且没有结构化键时拒绝猜测关联。
- 在 `SceneService` 增加事务内合并入口：保留现有开始/结束 instant 与地点，仅添加缺失 subject、地点或开始 instant；任何 Scene 数据异常都会让整条建议事务回滚。
- 在 `PlotFacade` 串行化建议队列的读改写，并结合项目内 lockfile 覆盖多 Facade / 多进程的队列读改写竞争；每条确认建议的 Scene 合并包装为独立 SQLite transaction。
- 在 Plot API 增加：
  - `GET /world-anchor-suggestions`
  - `POST /world-anchor-suggestions/generate`
  - `POST /world-anchor-suggestions/confirm`
  - `POST /world-anchor-suggestions/reject`
- 在共享 DTO 中增加完整请求、结果和存储文件 schema；确认/拒绝要求非空、去重、上限 100 的 `suggestionIds`。

## 验证

| 检查 | 结果 |
|---|---|
| `bun run --cwd packages/neuro-book test -- server/plot/services/world-anchor-suggestion.service.test.ts 'server/api/projects/plot/[...segments].test.ts'` | 通过：30/30（服务 14/14 + API 16/16）。包含已有时间锚点保留、无效 JSON 导致事务整体回滚且建议保持 `pending`、Scene 已写但 confirmed 落盘失败时保留 `applying` 并可收口、legacy 目录键消歧且排除已绑定/损坏正文、frontmatter 名称不计入正文命中、HTTP 空/超长 ID 拒绝。 |
| `bun run --cwd packages/neuro-book typecheck` | 通过。先运行 `bun run --cwd packages/neuro-book generate` 在隔离 worktree 生成缺失 Prisma 类型。 |
| 真稿副本验收 | 通过。详见 `evidences/001-truthdata-copy-acceptance.json`。 |

## 真稿副本验收

- 原件项目只读：`xin-xiao-shuo`；原件 `manuscript/` 的 SHA-256 前后均为 `4fc5d1aca85350c5c03fe7d65ca59ff669b4a63f68c753a96d44868f97a43ae6`。
- 副本在系统临时根运行；未启动真实项目，也没有确认任何建议。
- 224 章结果：生成 222 条 `pending` 建议、跳过 2 章、失败 0，耗时 1882.5ms。
- 固定分层 20 章样本中，共 87 个候选词；每个候选词均在该章的原始正文片段中出现，词面证据命中为 87/87。
- 此准确率只表示“建议给出的名称确实在该章正文出现”，**不代表角色一定实际出场、地点一定是场景主地点，亦不替代人工确认**。例如人物被回忆、谈及或组织名被提到都可能产生候选；这正是所有结果保持 `pending` 的原因。

## 未运行项

- 未运行全量 E2E、全量单测和 `nuxt:build`：它们与并行 UI 线写盘互斥，且 `nuxt:build` 已有独立依赖锁分裂问题，不属于 T0.5。
- OpenAPI 生成器在隔离 worktree 对全部 37 个路由报告“File not found”，0 个文件更新；未手改自动生成区规避该环境问题。T0.5 的 API 路由已由集成测试覆盖。
