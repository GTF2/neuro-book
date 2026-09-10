# V7 只读检索 CLI 验证

## 结果

在既有 `feat/w00005-v6-ingest-viewer` worktree 实现本 Task 的 `cli.ts`、独立查询服务与 [使用说明](../USAGE.md)。t07 模型/金标、EntitySummary 和 t08 查看器只读，没有额外提交、远端写入、网络或模型调用。

9 个命令覆盖 info、主体、结构内容检索、命题、显式认知、摘要、单条读取、依据解释、原文段落。请求使用 strict Zod 合同并复用 t07 枚举；默认金标按 CLI 相对路径读取，显式文件按调用 cwd 读取。查询服务固定校验后的快照，不访问 argv、文件或输出流；结果做结构化克隆，避免调用者修改后污染后续查询。

命题保留所有角色、assertion、时间和评估；角色视角通过 t07 投影后解引用，无法读到 reader 论证/评估。名称搜索只消费投影后的名字，按 exact/prefix/substring 排序并报告命中；其它集合以 availableAt 和 ID 排序。游标绑定快照内容、范围、筛选、命令、顺序及页大小。`explain` 有深度或不可见引用时 recordsExhausted 为 false，即使当前分页结束也不声明证据穷尽。

## 已运行

工作目录为本 Task。以下命令实际执行并退出 0：

- `bun run typecheck`：strict TypeScript 通过。
- `bun run test`：2 个文件、16 项测试通过，包含真实 Node 子进程调用。
- `bun cli.ts entities --query 苏天晴`：返回当前意识、原主人与名称含苏天晴的契约，精确名称排前；加 `--category person` 返回两个独立人物候选。
- `bun cli.ts get book --at 1:7`：名称仅“黑色古书”，没有未来“墨丘利秘典”。
- `git diff --check -- .agents/works/w00005-novel-understanding-spike/tasks/t09-v7-query-cli`：无 whitespace 报告。新文件尚未跟踪，该命令本身不覆盖新文件，另由 Leader 最终验收检查。
- `bun run docs:check`：6185 个文件，无 failures。Leader 晋升 Spec 后补齐固定命名的“实现合同”章节，最终复验通过。

Leader 独立从系统 Temp cwd 运行 8 条真实 Bun CLI，验证同名候选、1:65/1:66、未来名称、episode、原文、越界退出 2 和深度 0，确认 stdout/stderr 合同。独立 Reviewer 确认最终修改无阻断问题。检查点提交中已验证的生成 HTML 有 4 行空白提醒，原样保留；本 Task 新文件与新 Spec 经 `rg` 尾部空白检查无命中，已跟踪的 Task 范围文档经 `git diff --check` 通过，不重写旧产物消除格式提醒。t07 数据、schema、annotations 及 t08 生成查看器 SHA-256 均与检查点一致；暂存区为空。

测试实际覆盖：

- 1:65 知情查询空集合，1:66 返回 heard / f119，并保留 speech/opaque 与多元角色。
- 全部 58 条 Fact 以 limit 7 翻页，无重复遗漏，拒绝不同 limit、范围或快照游标。
- 早期名称不泄露、角色证据隔离、未来/失效记录不可读、unaware 只返回显式记录。
- 摘要 facet 最新投影、缺失 facet、失效构建来源及不可见主体拒绝。
- tentative 默认保留，明确 epistemic 筛选才排除。
- explain 深度 0 边界、深度 4 原文回溯、去重、跨页遍历及不可见引用在末页保留。
- exact/prefix/substring 排序跨页稳定；名称歧义保留，episode 可枚举，当前无 synthesis 返回空。
- 原文段号与阅读位置限制，未知字段/枚举/范围/选项拒绝。
- 真子进程在仓库外 cwd 读取默认数据，单行 JSON stdout，错误 JSON stderr 与退出码 2/3/4。
- 显式含空格文件路径、坏 JSON、无效 V7、缺失文件，以及输入文件字节不变。

## 调查与限制

初始合同测试因服务尚未存在失败，最小实现后 3 项通过。后续测试纠正了“当前金标包含 synthesis”的错误假设，保持真实空集合。Leader 独立 smoke 发现句柄展开整个论证记录，已改为仅 ID/revision/status 并补结构断言。

`explain` 沿记录出边和当前结论的评估/论证展开，不枚举主体所有入边。完整跨章身份归属可先列举 resolution，再按 entity ID 筛选/get。深度限定遍历记录，记录项仍带可见当前 assessment 元数据与自身摘录。

尚未做向量/语义检索、自然语言回答、故事时点筛选、MCP、发布 SDK、LLM ingest 或 20 章试跑。真实 Agent 查询质量仍待开发者验证。未运行全仓测试和 t07/t08 的未改动测试。

Vitest 缓存已配置到测试支持包的系统 Temp cache 根；初次运行生成的 Task `node_modules/.vite` / `.vite-temp` 保留原处，其中 `.vite/vitest/.../results.json` 为未跟踪缓存文件，不纳入交付或暂存。尝试以限定绝对路径的 PowerShell 清理被自动审批策略拒绝，未改用其它删除途径。测试 fixture 自身由测试支持包创建并在 afterEach 清理。
