# V7 Ingest CLI

在本 Task 目录运行。实测 Node.js 24.13.0，package 声明最低 22.13，但未在最低版本运行验收。使用已有 workspace 依赖。`bun run ingest` 调用 Node 执行器；不要直接 `bun cli.ts`，因为耐久写入锁使用 `node:sqlite`。

```powershell
bun run ingest -- --epub 'C:/path/to/novel.epub' --run-dir 'evidences/run-001' --through 20 --provider-config 'C:/path/to/config.json'
```

也可以通过 `--env-key DEEPSEEK_API_KEY` 指定已有环境变量名。密钥只在运行时读取，不将密钥放到命令行、请求审计或导出文件。配置文件路径使用产品配置的 `models.providers`，选中唯一启用的 `deepseek` provider；实际请求模型固定为 `deepseek-flash`。

`--through` 允许 1..20。每次都锁定同一本 EPUB 的前 20 章规范化输入，先运行 1 章、再将参数改为 20 可续跑。相同目录重复执行不会重发已经持久化的有效响应。源码、提示词、schema 或输入改变时必须选择新目录，旧失败证据保留。

```powershell
bun run ingest -- --run-dir 'evidences/run-001' --status
bun run ingest -- --run-dir 'evidences/run-001' --report
bun run ingest -- --run-dir 'evidences/smoke-003' --report --development
```

标准输出只有结果 JSON，进度和错误写到标准错误。Node 当前可能在标准错误显示 SQLite 实验特性警告，不影响 JSON 输出。`--report` 默认将本目录视为生产实验；开发 smoke 必须加 `--development`，避免把调试成本当作成品单位成本。未知用量、缓存或中断后服务端结果用未知值或区间表示。

只读吞吐与快照体积测量可运行 `node --import tsx experiments/profile-published.ts --run-dir evidences/formal-003`。它只计入已发布前缀，给出各章有效/修复调用耗时、快照实际字节及当前串行调用时间的千万字外推；未知耗时保留未知。与价格报告一起读取，不能把原始请求首末跨度当作纯模型工作时间。

## 导出与查询

`manifest.json` 的 `head` 是唯一发布进度。`dataset-v7.json` 是最新已发布前缀，`chNN/dataset-v7.json` 是对应章末的不可变快照，均可交给 t09 CLI。历史姓名可在最新快照使用 `--at` 检查；历史摘要使用当时的章末快照。

```powershell
node --import tsx ../t09-v7-query-cli/cli.ts --help
```

具体命令与范围语义见 [t09 使用文档](../t09-v7-query-cli/USAGE.md)。先发现实际主体 ID，再做事实、认知、事件和证据查询；自动抽取 ID 不等于手工金标 ID。

## 审计与恢复

每章保留 `input.json`、A 材料抽取、B 增量整合、C 独立复核的每次 `request.json`、`response.json`、`parsed.json` 和成功或失败记录。B 的 `referentAdditions` 可以追加 A 漏掉的局部指称，原 A 原样保留；只有编译消费时合并。摘要引用非摘要证据，不能将上一版摘要当作新证据。

结构、时间依据和引用校验失败会在本阶段修复，下一请求收到候选及具体错误。阶段单次执行三次尝试耗尽后保留当前阶段，下次续跑时继续，不重做已经有效的 A/B。C 覆盖不完整也在 C 内修复；C 真正拒绝语义候选则阻止发布并触发新语义轮，每次执行最多三轮。若全部 A 单元通过且没有遗漏，保留 A，以前一 B 候选和拒绝理由修复整合，之后重新复核全部 A/B；材料有拒绝或缺项时重新抽取。复用阶段的 `reuse.json` 指向同章原始模型轮和内容哈希，费用仍记在真实调用，不新增虚构调用。达到上限后检查失败原因再续跑。输出截断提高下一次输出容量，超时随容量有界增长。请求已写入但没有响应的尝试标为结果未知，恢复后使用新尝试。

同目录只能有一个写入者。SQLite 事务锁由操作系统在进程退出后释放；输出 JSON 使用临时文件、同步落盘和原子替换。发布中断后重复执行会补齐章末快照或发布指针。不能手工篡改已发布快照或已接受候选；恢复时会验证散列。

策略 -3 的 C 漏项显式分为 material/integration：只有整合层漏项且全部 A 单元通过时沿用 A；材料漏项仍重新提取。每轮独立 C 不带上一语义轮的拒绝反馈，格式或覆盖错误仍在 C 内修复。身份判断可晚于首次提及，但不得早于其证据可用边界。新旧策略必须用不同运行目录，旧章末 dataset 的 t09 查询不受影响。

策略 -4 在 A/B 结构错误重试中使用按记录替换。请求的 `responseMode` 明确为 `complete` 或 `record-patch`；补丁原文保存在 `response.json`/`repair.json`，合成的完整数据保存在 `candidate.json`/`parsed.json`，成功阶段仍是完整 `accepted.json`。非法补丁保留上一基底；合成后仍有错误时继续修复最新候选。需要增删或拆分时模型显式返回 `regenerate`，下一次完整重建。模式和容量进入失败检查点，恢复不会把补丁当完整候选，也不重发已保存响应。语义返工的首次输出及 C 始终为完整数据。

当前实验不保证语义穷尽，导出明确标记 `semantic: partial`、`corpusClosed: false`；没有检索到关系不等于小说明确否认该关系。单本千万字的生产边界与成本口径见 [规模与成本](scale-and-cost.md)。
