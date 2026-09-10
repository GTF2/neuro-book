# 名称与身份投影修复

2026-09-10，Tasker 按 t07 当前范围完成。EntitySummary 被开发者明确排除，本轮未修改其字段、语义标注或更新机制。

## 实际改动

- `schema.ts` 将每个 Entity 名称的 dependencies 约束为非空；两份 JSON Schema 重新导出。
- `build-gold.ts` 为所有 48 个名称条目绑定对应段落 Mention 与当前 Entity 的 Resolution；语境 Referent 使用中性 ID，避免复制实体称谓。
- `validate.ts` 检查名称材料与身份匹配、范围和阅读边界，拒绝空材料、其它实体身份及未来证据。
- `query.ts` 对名称逐字段验证材料与 `same/accepted` 身份，撤回后回退有效旧名或 ID，保留 Entity；Referent 名称随有效 Mention 投影。未确认身份不能作为 Fact 的解释性实体绑定，Resolution 和 Disclosure 仍可审查。
- `query.test.ts` 增加六项聚焦验证。`schema-and-projections.md` 补充现行合同与限制。

“墨丘利秘典”名称依据为第一章第 29 段的 Mention 和本章 Resolution。完整自我介绍 Disclosure 到第 30 段才可用，名称不依赖这条较晚记录。撤回 `mention:book:c1:2` 后显示“黑色古书”；把 `resolve:book:c1` 变为 candidate 或把其支持变为 conditional 后，两个附着名称均不返回，Entity 仍保留，相关 Fact 不再作为确定实体解释返回。`f111` 始终是 speech，accepted 不认证发言内容为世界真相。

## 验证

命令工作目录为 t07。

| 命令或检查 | 结果 |
| --- | --- |
| 新增四项缺陷测试，首次 `bun run test` | exit 1，12 通过、4 失败，复现陈旧名称与不确定身份误用 |
| 新增名称跨记录校验测试，首次 `bun run test` | exit 1，17 通过、1 失败 |
| 修复后 `bun run test` | exit 0，18 通过 |
| `bun run typecheck` | exit 0 |
| `bun run build` | exit 0，2 章、615 节点 |
| `bun run schema` | exit 0，两份 schema 导出 |
| `bun run validate` | exit 0，163 段、615 节点；全图 615，摘要候选 3、闭包访问 249 |
| EntitySummary 完整 JSON 比较 | 构建前后 11 条记录完全相同，包含 label、dependencies 和正文 |
| 再次 build/schema 并比较三份 JSON SHA-256 | 全部一致 |

最终产物 SHA-256：

```text
dataset-v7.json: C65A94D6396FFAB6DA8C03F99AD4C71A9EB73DDA607B76B961084DA5AED6ED83
schema-v7.json: 2FD4EAD8F3163FA6514EA2757D034399E9FCD531E944C267373FE13E2D8368BA
management-schema-v7.json: 7D47C1B2B08B271B261120BABE4002CB30F63390F7C024B0E80196ECDFC1FE03
```

原始 `annotations.json` 和 `sources.json` 未修改；无模型调用、提交、远端写入或生产改动。浏览器由 t08 验证，本 Task 未宣称浏览器或开发者人工验收。仍为按章人工共指金标，未实现自动身份拆分与修复执行器。
