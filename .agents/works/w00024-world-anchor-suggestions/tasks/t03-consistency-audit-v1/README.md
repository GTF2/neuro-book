---
schema: nbook.task/v2
taskId: t03-consistency-audit-v1
role: tasker
---

# T0.7：定稿一致性审计 v1

## 目标

提供只读、确定性的章节定稿审计：针对结算表、结构化承诺与 World 写入证据、单章 llmlint 结果，生成可由后续确认卡直接展示的中文三源报告。

## 范围

- 新建 `server/consistency/` 服务，采用可注入 ports；HTTP 只处理参数、授权、调用和结果投影。
- 只报告，不写正文、World、Promise、Scene、worldAnchor 队列或 finalize 事件。
- 结算表是自由文本且无结构化事实映射；缺少结算块或不存在可靠对应证据时，返回 `unavailable` / `unknown`，不把它表述为通过或失败。
- Promise 仅按结构化 deadline / beat / Chapter 关系审计；`cadenceChapters` 仅作提示，不能伪装成硬期限。
- World 只核对本次 finalize 已提供的 `worldSliceIds` 与结构化 patch 证据；不由当前 World 状态反推自由文本结算是否已经入账。
- llmlint 只投影确定正文文件的 `high` 命中；正文路径歧义必须显式返回，不能猜测。
- 中文正文文案以 `deliverables/copywriting-pack-2026-09/README.md` 的定稿模板为准；不把审计结论回灌 writer 的动笔前上下文。

## 验收

1. 覆盖到期且无有效兑现证据、结算事实缺少结构化 World patch 对照、缺失结算块、正文路径歧义、llmlint high 投影和只读无写入。
2. API 输入经运行期校验，错误与不可核对状态可诊断。
3. 受影响服务/API 测试、`bun run --cwd packages/neuro-book typecheck`、`bun run governance:check`、`bun run docs:check` 与 `git diff --cached --check` 通过。
4. 在 `walkthroughs/`、必要时 `evidences/` 和统一实施台账记录真实结果与未运行项。

## 前置与开发者参与

- 前置能力 T0.1、T0.2、T0.4 与 T0.8 均已完成。
- 已确认：审计只提供事后证据、风险和下一步，作者仍决定是否修改或定稿。
- 不需要真实 Provider/Model、浏览器人工验收、数据库 migration 或真实项目写入。
