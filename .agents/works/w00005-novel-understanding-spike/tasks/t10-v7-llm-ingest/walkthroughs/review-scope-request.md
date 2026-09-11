# 独立审查请求

以 Reviewer 角色只读复核 t10 策略 v7-ingest-2026-09-11-3 的窄范围变更。Work 为 w00005-novel-understanding-spike，Task 为当前父目录 t10-v7-llm-ingest；适用角色合同见仓库 `.agents/roles/reviewer/AGENTS.md`。不要修改文件、调用小说模型 API、联网搜索、读取任何凭据或停止活动进程。仅审查并输出最终结论，执行宿主会保存报告。

本次主 Agent 已运行完整59项测试和typecheck。当前 formal-003 正在用固定源码处理20章，不得动主线。对比依据是 `evidences/formal-002/policy-source.json` 保存的旧源码；检查当前 `draft.ts`、`runner.ts`、`prompts.ts`、`runner.test.ts`、`compiler.test.ts` 及必要的 `material-reuse.ts`、`report.ts`。

变更有三项：C missing 从未分层字符串变为 `{stage: material|integration, note}`；全部A通过且只有integration漏项时继续复用A并保持来源和计费；每轮C不带前一语义轮拒绝反馈，自己的格式/覆盖错误仍保留恢复反馈。C合同另澄清身份判断可以晚于首次提及，但不能早于依据可用位置。已有数据与t07/schema不变。

重点检查是否可能错复用有误的A、恢复后丢失反馈或重复付费、意外绕过C、漏项误当通过、旧已发布报告无法读取、当前候选被旧错误污染、测试没有覆盖关键路径。只报告可复现或有明确代码路径的缺陷；没有阻断时明确说明本次范围无阻断，真实20章仍待验收。用中文给出结论、文件/行号、理由、建议及未验证项。
