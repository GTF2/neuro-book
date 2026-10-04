---
schema: nbook.work/v1
workId: w00033-provider-discovery-fallback
issueId: null
---

# 中转站接入体验：发现兜底与 Base 提示

修复两个让自建中转站「接得上但用不顺」的体验缺口：Anthropic 协议的自动发现打错路径（`{Base}/models`，官方 API 与多数中转站实际在 `/v1/models`，404 后不再重试）；API Base 输入框没有「填协议根还是完整端点」的提示，填错后聊天拼出双路径、发现拼出 `/v1/messages/models`。

## 来源与授权

2026-10-04 开发者授权「继续推进本项目当前的工作」。方向来自 `.local/PLAN.md` 与 fork backlog #1（中转站能力画像 + Base 规范化 + 发现兜底），是既有排序中的最推荐项；证据：中转站 `my-cmdc` 与官方 `api.anthropic.com` 双端实测（`/models` 404、`/v1/models` 401/200）。

## 范围与非目标

- 改 `packages/neuro-book/server/models/discovery.ts`：发现请求 404 时补 `/v1` 前缀重试一次（仅对 `anthropic-models` 与普通 OpenAI-compatible 的默认路径；不猜第三、第四种形态）。
- 改 Provider 详情页 API Base 字段：补一行协议根提示（中英双语），不改字段语义与只读规则。
- 新增 `docs/specs/...` 发现行为 Spec 并在注册表登记。
- 不改中转站侧实现（由 CMDC 中转站 AI 负责）；不为「API Base 误填端点」做自动改写（用户已保存的连接身份不可变）。

## 当前 Task

| Task | 当前范围 |
|---|---|
| [t01](tasks/t01-discovery-fallback-and-base-hint/README.md) | 已实现并验证：404 兜底 + Base 提示 + Spec（合同测试 47 通过、真实端点与 UI 探针实测） |

已收尾：be6849ba；待清理：`.worktree/w00033-provider-discovery-fallback`、`feat/w00033-provider-discovery-fallback`。
