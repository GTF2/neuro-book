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

## 开发者浏览器报告

2026-09-03，开发者报告已自行检查 browser 并确认可以通过。本会话未获得该检查的可观察页面证据，未独立复核，因此此处只记录为开发者报告/风险接受，不把 browser 改写成已由本会话验证通过。

开发者未提供具体检查时间、所用 revision、桌面/窄屏范围、通知渲染、主题/布局、键盘/焦点、控制台或截图/DOM 证据位置。当前本地收口记录对应合并后 master `3d54933e488cb3a61f5e40bb61443b9fb78e875f`，不据此推断为开发者检查 revision。

结构化记录见 [`browser-gate-correction.json`](../evidences/browser-gate-correction.json)。
