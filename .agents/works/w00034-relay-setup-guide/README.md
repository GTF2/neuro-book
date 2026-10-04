---
schema: nbook.work/v1
workId: w00034-relay-setup-guide
issueId: null
---

# 自建中转站接入指南

给「自己搭中转站」的 fork 用户写一份可照做的接入指南：中转站要暴露什么端点、NeuroBook 侧怎么填 Base、路径与认证的约定是什么、常见 404/401/400 怎么排障。内容来自 2026-10-04 的真实探测与故障现场（官方 Anthropic 与自建中转站双端实测）。

## 来源与授权

2026-10-04 开发者授权「继续推进本项目当前的工作」。方向来自 fork backlog #2（自建中转站接入指南）：零冲突、纯文档，直接服务开发者自己的使用画像（`my-cmdc` 中转站）。

## 范围与非目标

- 只新增 VitePress 文档站页面（中英对等）与侧栏/导航登记。
- 不写中转站实现（由 CMDC 中转站 AI 负责），不复制 `docs/specs/models/provider-discovery.md` 的行为正文，只写用户操作与排障。
- 不改产品代码。

## 当前 Task

| Task | 当前范围 |
|---|---|
| [t01](tasks/t01-relay-setup-guide/README.md) | 已交付并验证：中英对等指南 + 侧栏登记（docs:check 0 failures、docs:build 通过、两页面已构建） |

已收尾：483d55b9；待清理：`.worktree/w00034-relay-setup-guide`、`docs/w00034-relay-setup-guide`。
