---
schema: nbook.task/v2
taskId: t01-relay-setup-guide
---

# 自建中转站接入指南

行为合同未变：本 Task 只新增文档站页面，不改产品行为；所描述的行为以 [`docs/specs/models/provider-discovery.md`](../../../../../docs/specs/models/provider-discovery.md)（发现路径与兜底）与设置页既有合同为准。

## 目标与范围

给「自己搭中转站」的读者一份可照做的接入指南（VitePress 文档站，中英对等）：中转站要暴露什么端点、NeuroBook 侧怎么填（接口格式 / API Base / 密钥 / 代理）、路径与认证约定、常见 404/401/400 的排查表、无列表端点时的手动添加出路、一个完整的本地中转站示例。

内容取自 2026-10-04 的真实探测与故障现场：官方 `api.anthropic.com`（`/models` 404、`/v1/models` 401）与自建中转站 `localhost:8787`（两路径均 200）双端实测；Base 误填完整端点导致路径重复的现场；发现 404 兜底重试的产品行为。

## 非目标

- 不写中转站实现（由 CMDC 中转站 AI 负责），不涉及中转站内部细节。
- 不复制 `docs/specs/models/provider-discovery.md` 的行为正文，只写用户操作与排障；行为合同以该 Spec 为准。
- 不改产品代码与文案。

## 证据

- 新增页面：`vitepress/locales/zh-Hans/guide/relay.md`、`vitepress/locales/en-US/guide/relay.md`（英文 locale 对等页面为 `docs:check` 强制）。
- 侧栏登记：`vitepress/.vitepress/locales/{zh-Hans,en-US}.ts` 的「使用指南 / Guides」组。
- 事实来源：`.local/relay-handoff.md`（本轮转交文档）、w00033 的探测记录与 `docs/specs/models/provider-discovery.md`。

## 验证

- 待补：`docs:check` 与 `docs:build`。

## 执行位置

`.worktree/w00034-relay-setup-guide`，分支 `docs/w00034-relay-setup-guide`。
