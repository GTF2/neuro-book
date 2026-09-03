---
schema: nbook.task/v1
taskId: 00158-notification-contrast-fix
sequence: 4
role: leader
status: completed
createdAt: 2026-09-03T21:38:28+08:00
---

# 更正记录：Browser required 门禁未闭合

## 更正范围

本记录是 legacy Task `00158-notification-contrast-fix` 的追加式 provenance 更正。保留原 Task README 的 taskId、owner、创建时间、`status: completed`、`verification.required` 和 `verification.notRun`；不重编号、不迁移名称、不重算密封迁移 hash，也不把 legacy 记录解释为 current Task。

## 已核对事实

- 原 Task README 的 required 仍包含 `browser`，`notRun` 仍为空数组；`browser` 不是“不适用”，而是一个尚未执行的 required 检查。
- `evidences/verification-summary.json` 已记录聚焦/回归测试、typecheck、diff-check 和治理检查结果；同一证据的 residual risk 明确写明“浏览器人工验收未运行”。
- 既有 Tasker walkthrough 也明确记录：浏览器人工验收未运行，真实渲染效果（blur 叠加、backdrop 内容、字体渲染）没有证据覆盖。
- `docs/standards/code/frontend.md` 的页面证据要求覆盖用户可见样式变化；当前没有桌面与窄屏真实页面证据，不能把静态测试结果当作 browser 验收。

## 完成门禁结论

`status: completed` 在这里仅表示历史 provenance 状态，不表示全部 required 验证均已通过。当前 completion assessment 是 **未完成验证**：`browser` required 未运行，该完成门禁未闭合；不能宣称 Task 的所有 required 已闭合，也不能把 browser 写成通过或不适用。

本记录不把 Task 改为 `verifying`/`blocked`，因为这会把缺少 current Task 协作章节的 legacy 文档重新纳入活动 Task 门禁；保留原身份并追加可审计更正，避免用状态变更掩盖证据缺口。

结构化更正证据：[`browser-gate-correction.json`](../evidences/browser-gate-correction.json)。

## 继续条件

只有在获得明确的浏览器人工验收授权后，实际运行产品页面并覆盖桌面、窄屏、通知卡片渲染、键盘/焦点路径、控制台结果和可观察截图或 DOM 证据，才能重新评估 `browser` 门禁。当前主线的静态测试与文档治理通过，不替代该 required 页面证据。

## 开发者收口决定

2026-09-03，开发者明确决定 `00158` 可以通过，并接受 `browser` required 尚未运行的风险。该决定只接受未运行项的风险，不改变 Task 原有 required 合同，也不把 browser 记为通过或不适用。

因此：`00158` 按开发者决定通过；证据状态仍诚实保持 `browser` 未运行、`allRequiredClosed: false`。这里的“通过”是风险接受后的交付决定，不是“全部 required 验证已闭合”。结构化决策见 [`browser-gate-correction.json`](../evidences/browser-gate-correction.json)。
