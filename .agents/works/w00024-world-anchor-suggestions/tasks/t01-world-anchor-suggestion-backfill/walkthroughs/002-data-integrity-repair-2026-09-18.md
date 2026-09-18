# T0.5 数据完整性修复记录（2026-09-18）

## 修复原因

初版验收后复核发现两条队列合同没有真正闭合：

1. 已进入 `applying` 的建议重试确认时，如果 Scene 合并再次失败，catch 分支会把它退回 `pending`。这会让已经可能写入 Scene 的建议重新可拒绝，丢失恢复线索。
2. 重新生成会替换全部 `pending` 项，人工已经审阅但未确认的建议会被静默清空、重新编号。

另有可诊断性缺口：生成结果只给 `skipped` / `failed` 计数，无法定位章节与原因。

## 实际改动

- `world-anchor-suggestion.service.ts`
  - `applying` 建议重试写 Scene 失败时保持 `applying`，只在首次 `pending` 确认失败时恢复 `pending`；因此可能已写入 Scene 的建议不能被 reject。
  - 生成改为追加合并：历史以及 `pending` / `applying` 建议都保留；以章节、建议主体、地点、时间与证据构成稳定指纹去重。重复生成不改既有 suggestionId 或状态，只有新候选才追加并递增序号。
  - 生成结果新增跳过/失败明细，明确返回 chapterId、chapterTitle、原因枚举与中文说明。
- `shared/dto/plot.dto.ts`
  - 为生成结果增加向后兼容的 `skippedDetails` / `failedDetails` 加法字段。
- 相邻服务/API 测试增加：applying 重试失败不可拒绝、重复生成幂等与新增候选追加、诊断明细序列化。

## 验证

| 检查 | 结果 |
|---|---|
| `bun run --cwd packages/neuro-book test -- server/plot/services/world-anchor-suggestion.service.test.ts 'server/api/projects/plot/[...segments].test.ts'` | 通过：36/36（服务 17/17、API 19/19）。 |
| 本轮相关服务/API 测试（含 T0.7、Promise、workspace archive） | 通过：5 个文件、63/63。 |
| `bun run --cwd packages/neuro-book typecheck` | 通过。 |
| `git diff --check` | 通过。 |

## 边界与未运行项

- 未改变匹配阈值、正文 Markdown 标题处理、正文路径回退正则或目录扫描策略；这些属于已登记但未纳入本轮的工程债。
- 未调用 LLM、未修改正文；仍只有明确 `confirm` 才写 Scene。
- 全量测试、E2E 与 `nuxt:build` 留给 M0 / M1 收口，不能据此记录为通过。
