---
schema: nbook.task/v2
taskId: t01-discovery-fallback-and-base-hint
---

# 发现兜底与 API Base 提示

行为合同见 [`docs/specs/models/provider-discovery.md`](../../../../../docs/specs/models/provider-discovery.md)（本 Task 同时把该 Spec 从新建推进到 `implemented`）。

## 目标与范围

让 Anthropic 协议的自动发现不再固定打错路径，并让 API Base 字段的填写约定在界面上可见。

两个缺口（2026-10-04 实测）：

1. **发现路径错位**：发现一律打 `{Base}/models`。官方 `api.anthropic.com/models` 返回 404，真实端点在 `/v1/models`（401，需鉴权）；自建中转站若只实现 `/v1/models` 同样发现不到。发现 404 后当前直接报 `upstream-error`，不重试任何变体。
2. **Base 填写约定不可见**：聊天走官方 SDK，会在 Base 后自动补 `/v1/messages`，因此 Base 必须填协议根；填成完整端点（如 `http://localhost:8787/v1/messages`）会让发现拼出 `/v1/messages/models`。设置页 API Base 只有占位符「可留空，使用 Pi Model 默认 baseUrl」，没有这条约定。

## 非目标

- 不改中转站侧实现（由 CMDC 中转站 AI 负责）；不为其缺陷写兼容分支。
- 不为「Base 误填完整端点」做自动改写：已保存 Provider 的连接身份按既有语义不可变（w00021）。
- 不改 Google / Bedrock 的发现路径约定，不改 `openrouter.ai` 主机的扩展字段解析。
- 不轮换 API key 的认证形式（既有纪律：只按已知协议选 adapter）。

## 证据

- 修复前基线（2026-10-04）：`GET https://api.anthropic.com/models` → 404；`GET https://api.anthropic.com/v1/models` → 401（端点存在）。中转站 `http://localhost:8787` 两个路径均 200（其实现兼容两种）。
- 修复后：见「验证」。

## 验证

- 合同测试：`bun run --cwd packages/neuro-book test -- server/models/discovery.test.ts server/api/config/models` → 4 files / 47 tests 通过；同命令在暂存实现后的基线为 42 通过（新增 5 例，无回归）。
- 真实端点（worktree dev server，`POST /api/config/models/provider-discover`）：
  - Base = `https://api.anthropic.com`（协议根，key 无效）：修复前报 404 `upstream-error`，修复后报 401 `unauthorized` —— 证明请求已落到真实的 `/v1/models`。
  - Base = `http://localhost:8787`（中转站）：200，112 个模型，`pageCount: 1`（首屏命中，未触发兜底）。
- UI 探针（`.local/w00033-probe.mjs`）：API Base 字段下提示文案可见；「发现/添加模型」打开窗口、226 行结果、单次请求（`.local/w00033-probe2.mjs` 复核 `POST` 计数 = 1）；0 报错。
- `bun run docs:check`：0 failures；本 Work 与 Spec 零警告。

## 执行位置

`.worktree/w00033-provider-discovery-fallback`，分支 `feat/w00033-provider-discovery-fallback`。
