---
schema: nbook.task/v2
taskId: t09-v7-query-cli
role: tasker
---

# V7 只读检索 CLI

2026-09-10 开发者接受当前查看器作为阶段检查点，授权先提交，再为 V7 schema 提供 CLI 查询入口，后续可接 MCP/SDK。已有检查点 commit 为 `7bfdb19e`。在 Work `w00005-novel-understanding-spike` 和既有 `feat/w00005-v6-ingest-viewer` worktree 执行。

本 Task 拥有本目录 CLI、独立于进程输入输出的查询服务、参数合同、聚焦与实际进程测试、使用示例和 walkthrough；消费 [t07 唯一 schema 与查询](../t07-v7-schema-gold/index.ts)。t07 数据与模型、EntitySummary 和 t08 只读。Leader 维护 [查询规范](../../../../../docs/specs/memory/v7-query-cli.md)、Work 入口和面向用户的解释；Tasker 实现本目录全部代码与测试。

当前目标是让开发者能用 Agent 查询两章金标并复核正确性。行为真相源为上述 Spec；仅查询，不提供写入、任意代码/SQL、模型调用、自动推断、网络、MCP 或生产包接入。真正的 LLM ingest 与 20 章试跑在开发者验证查询接口后再推进，本轮不预建实现 Task。

开始使用见 [CLI 指南](USAGE.md)，局部指称、身份判断及披露/论证/评估的实际例子见 [记录用例](model-notes.md)。

接口以宿主无关的查询请求/响应为核心，CLI 只负责参数、文件读取、输出和退出码。默认载入相邻 t07 金标，也支持显式 `--data` 文件。使用已有依赖与 strict TypeScript，运行时校验输入；stdout 成功 JSON、stderr 错误 JSON，help 为文本。完整命题保留 assertion、角色、时间、评估及证据，不将听闻转换为世界事实。分页先限定可见范围再匹配，游标绑定数据和查询。

执行顺序：读取规范与 t07 合同；实现最小可用查询服务与 CLI；补充语义边界、游标、输入拒绝和真实子进程测试；生成可直接交给 Agent 的命令示例；运行 typecheck、测试、实际 CLI smoke 与 docs:check；记录结果和未实现能力。无额外提交或远端写入。

验收覆盖：名称/别名歧义；苏天晴到造物主的 1:65/1:66 听闻边界；阅读范围和角色视角不绕过；完整多元命题；摘要及缺失状态；依据深度截断和原文；所有分页可达且游标不能跨查询/快照重用；JSON stdout/错误 stderr/退出码；坏数据和未知参数拒绝。临时目录使用仓库测试支持包，保留用户文件。

2026-09-10 实现与验收完成：两份测试共 16 项通过，strict 类型检查通过；Leader 从系统临时目录执行 8 条实际 Bun CLI，确认默认数据定位、同名主体候选、听闻边界、未来名称不可检索、情节枚举、原文、越界退出码 2 及深度截断。独立 Reviewer 复核输入、投影、分页、依据和错误合同，无剩余阻断项。规范已晋升 implemented；实际 Agent 查询质量与 20 章规模仍待下一阶段验证。详细证据见 [CLI 验收记录](walkthroughs/2026-09-10-cli-verification.md)。

## 本地交付

入口为 [cli.ts](cli.ts)，程序接口由 [index.ts](index.ts) 导出；可直接交给 Agent 的命令与验证任务见 [USAGE.md](USAGE.md)。当前实现 9 个只读命令，复用 t07 投影；`search --kind` 可枚举情节/材料。16 项语义与真实进程测试、strict 类型检查通过；完整证据与限制见 [实现验证](walkthroughs/2026-09-10-cli-verification.md)。此轮未提交 CLI、未推送、未运行模型 ingest。
