# T07 恢复验证交付

2026-09-09。在 Work 既有 worktree `.worktree/w00005-novel-understanding-spike`、分支 `feat/w00005-v6-ingest-viewer` 恢复检查；HEAD 为 `467d9a30251eb65d50f8270f02e52e394b64140e`。保护当前未提交的旧版和其它 Task 产物。本轮没有修改 schema、查询逻辑或语义标注；重新生成三份交付 JSON，并修正提案把 16 类节点误写成 17 类的笔误。

## 实际验证

下列命令均实际执行，退出码均为 0。除 governance 命令在 worktree 根运行，其余在本 Task 目录运行。

| 命令 | 结果 |
| --- | --- |
| `bun run governance:context -- --work w00005-novel-understanding-spike --task t07-v7-schema-gold --role tasker` | Task 身份、分支和 worktree 匹配，`failures: []` |
| `bun run typecheck` | 独立 strict TypeScript 检查通过 |
| `bun run test` | 12 项测试全部通过，无跳过；包括 12 条金标问题、引用/证据边界、角色认知、身份纠错、摘要失效与错误输入 |
| `python extract-source.py --epub "C:/Users/notnotype/Documents/CodeRepository/GithubProjects/neuro-book/.local/novels/转生反派萝莉，找茬魔法少女.epub" --verify` | 与 `sources.json` 结构完全相同，前两章 76、87 段；输入只读 |
| `bun run schema` | 两份 JSON Schema 成功导出 |
| `bun run build` | 两章 615 节点成功生成 |
| `bun run validate` | 来源 SHA-256、跨记录结构和引用检查通过；全图 615 候选/615 依赖访问；苏天晴摘要 3 候选/249 依赖访问，返回 `s-su-c2`、`s-su-attitude` |

EPUB SHA-256：`355e1feb04b01eeeaa6ffc4be07619470bc2e6507338c22b90933a68318af081`。

## 生成物确定性

首次 `schema`、`build` 后，通过 `@notnotype/neuro-book-test-support` 的 `resolveAgentRunRoot` 实际实现分配系统 Temp 的 Task 专属目录 `neuro-book/runs/t07-v7-schema-gold/determinism-1788965912787`，保存三份首次产物。随后使用 `node --import tsx export-schema.ts` 和 `node --import tsx build-gold.ts` 再次构建，逐文件用 `Buffer.equals` 比较字节，并独立比较 SHA-256；全部一致。该验证命令退出码 0，临时目录由 `finally` 清理。

| 文件 | 字节 | SHA-256 |
| --- | ---: | --- |
| `dataset-v7.json` | 947167 | `28995d9322fc262eaaa8763a9a27ff00602e48cf4f578b3e4645677eadc649b6` |
| `schema-v7.json` | 198096 | `ed4be1506ff39f85e2a86746e125423d82c93f2965d97b53a291c14d6814e2a7` |
| `management-schema-v7.json` | 236656 | `ccc64777953c5eca6f2a32144940e888b98300198e146b94860a9f706de29c44` |

Schema 支持 16 类节点。两章实际使用 14 类，共 615 节点：Entity 24、Referent 36、Mention 45、Resolution 36、Disclosure 55、Fact 58、Beat 33、Episode 7、EntitySummary 11、Time 18、KnowledgeAccess 33、Predicate 57、Argument 101、Assessment 101。Synthesis 未在样本制造实例，Watch 由故障注入测试覆盖。

## 交付边界

数据稳定时点与上述 dataset 哈希已告知 t08 owner。语义审查过程与金标限制见 [gold-review.md](gold-review.md)。本次未运行整仓测试、外部 Provider 自动抽取、数据库事务/恢复或生产规模性能测试；两章 Agent 手工金标仍待开发者认可。查看器自动验收由 t08 单独记录，不声称开发者人工验收。没有提交、push、部署或远端写入。
