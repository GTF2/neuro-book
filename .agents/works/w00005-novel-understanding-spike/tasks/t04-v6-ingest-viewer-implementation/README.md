---
schema: nbook.task/v2
taskId: t04-v6-ingest-viewer-implementation
role: tasker
---

# V6 前二十章 ingest 与离线查看器实现

## 目标

在已审查的 V6 数据设计与 V2 管道设计基础上，真实处理样书前 20 章，并交付单文件 `viewer-v6.html`。这是实现 Task；不把代码写入已闭合的 t02/t03 设计 Task，也不修改产品包。

## 依据

- 批准计划：`local://v6-ingest-viewer-plan.md`（执行副本在会话计划中）。
- V6 设计：`tasks/t02-novel-memory-model-design/memory-model-v6.md`。
- ingest 设计：`tasks/t03-extraction-pipeline-design/ingest-pipeline-v2.md`。
- 样书登记与归一化：`tasks/t01-novel-understanding-spike/`。
- 任务根、临时根和证据规则：Work/Task 及根 `AGENTS.md`、`docs/testing/README.md`。

## 范围

允许修改或新增：

- `.agents/works/w00005-novel-understanding-spike/tasks/t02-novel-memory-model-design/memory-model-v6.md`（原样纳入已批准设计稿，并随实际合同同步）
- `.agents/works/w00005-novel-understanding-spike/tasks/t03-extraction-pipeline-design/ingest-pipeline-v2.md`（原样纳入已批准设计稿，并随实际合同同步）
- `.agents/works/w00005-novel-understanding-spike/tasks/t02-novel-memory-model-design/schema-v6.ts`
- `.agents/works/w00005-novel-understanding-spike/tasks/t02-novel-memory-model-design/viewer-v6.template.html`
- `.agents/works/w00005-novel-understanding-spike/tasks/t02-novel-memory-model-design/viewer-v6.ts`
- `.agents/works/w00005-novel-understanding-spike/tasks/t02-novel-memory-model-design/dataset-v6.json`
- `.agents/works/w00005-novel-understanding-spike/tasks/t02-novel-memory-model-design/viewer-v6.html`
- `.agents/works/w00005-novel-understanding-spike/tasks/t02-novel-memory-model-design/scripts/build-viewer-v6.ts`
- `.agents/works/w00005-novel-understanding-spike/tasks/t02-novel-memory-model-design/scripts/smoke-viewer-v6.ts`
- `.agents/works/w00005-novel-understanding-spike/tasks/t03-extraction-pipeline-design/scripts/v6-output.ts`
- `.agents/works/w00005-novel-understanding-spike/tasks/t03-extraction-pipeline-design/scripts/ingest-v2.ts`
- `.agents/works/w00005-novel-understanding-spike/tasks/t03-extraction-pipeline-design/scripts/run-ingest-v2.ts`
- `.agents/works/w00005-novel-understanding-spike/tasks/t03-extraction-pipeline-design/tsconfig.v6.json`
- `.agents/works/w00005-novel-understanding-spike/tasks/t03-extraction-pipeline-design/evidences/v6/`
- `README.md`
- `.agents/works/w00005-novel-understanding-spike/README.md`（仅登记 t04 与实际状态）
- `docs/standards/code/README.md`（仅登记本 Task 新增路径的规范路由）

不允许修改：`packages/`、旧 v4 schema/数据/viewer、t01 样书登记、t02/t03 的历史 README 与允许文件清单、主工作区用户已有未跟踪文件 `eval-tmp.ts`。

## 受限动作授权

开发者已批准本 Task 的批准计划，因此允许：

- 使用现有配置文件中的 DeepSeek 凭据进行真实 `deepseek-v4-flash` 调用；密钥只能运行时读入 HTTP client，不写入任何文件、日志、页面或错误。
- 总费用上限 US$2（含失败调用）；每个失败阶段最多追加一次定向重试；预算门禁优先，不能为凑满 20 章超支或用假数据补齐。
- 用隔离浏览器打开最终本地 `viewer-v6.html` 做实际页面验收；不使用 relay 用户标签页，不做远端写入、push、PR、合并、发布或部署。

预算不把保守预留误记为已消费：每次请求前只为当前 attempt 记录 `1_048_576` 输入 token 按未命中价加该阶段最大输出价的临时上限；返回可信 usage 后结算公开价估算并释放差额。只有请求超时、进程中断或 usage 不可信时才保留该次预留为未知费用。下一请求的门禁计算为“已知费用 + 未知费用预留 + 当前请求预留不超过 US$2”，因此正常返回 usage 的 40 次请求可以继续；未知费用达到门限时必须停在已完成边界，不用假数据冒充 20 章。

## 完成标准

1. 前 20 章源清单、哈希和段数通过；第 1 章与已登记正文一致。
2. A/B 原始输出只经过受限 AST 解析、结构校验和程序装配；不执行模型文本，不人工改写语义结果。
3. 20 章完成时有 40 个合法已接受阶段结果；失败、重试、token、耗时、费用和预算账本可恢复且脱敏。若预算因未知费用门禁停止，必须保留已完成边界和停止原因，不得将部分结果宣称为 20 章完成。
4. `dataset-v6.json` 通过 schema 校验，恰好包含 20 章、1942 段；`viewer-v6.html` 无 CDN、无 fetch、无密钥，双击可读。
5. Node+jsdom 冒烟、定向 typecheck、确定性双构建和实际浏览器操作均记录真实结果；未完成项明确写出。

## 非目标

不实现嵌入、语义向量、问答 Agent、概念分类、固定谓词、Event 本体、数据库或产品 API。模型语义质量只做计划规定的抽查，不声称全书无错误。

