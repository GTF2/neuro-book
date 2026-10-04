---
schema: nbook.spec/v1
kind: behavior
status: implemented
capability: models.provider-discovery
owners:
  - server
  - app
---

# Provider 远程模型发现

> 本规范覆盖 Provider 设置页的「查询可用模型 / 发现-添加模型」：从用户配置的 Provider 拉取远端模型清单，供勾选加入 Provider Config。它不覆盖 Provider 连接身份编辑（w00021）、模型检测（provider-check）与 Model Library 补全。

## 目标与非目标

目标：用一份确定的请求约定，把「远端有哪些模型」变成设置页可勾选的结果，并在部分成功时如实报告诊断。

非目标：

- 不承诺发现结果与 Provider 实际可调用模型一致（远端目录可能滞后或超集）。
- 不承诺识别 Provider 的全部部署形态；只覆盖两种已确认的路径约定（见「失败与恢复」）。
- 不为「API Base 误填完整端点」做自动改写：连接身份按不可变语义处理，只给填写提示。

## 术语与参与者

- **API Base**：Provider 的协议根地址（如 `https://api.anthropic.com`、`http://localhost:8787`）。聊天客户端在它之后自动补 `/v1/messages`，因此 Base 不是完整端点。
- **发现路径**：`{Base}/models`；首屏 404 时按适配器规则改走 `{Base}/v1/models`。
- **适配器**：按 Provider 的 `modelApi` 与主机名选择的解析约定（`openai-models` / `openrouter-models` / `anthropic-models` / `google-models`）。同一时刻只用其一，不轮换 API key 的认证形式。
- **诊断**：`fetchedCount` / `returnedCount` / `skippedCount` / `duplicateCount` / `pageCount` / `truncated` / `partial`，不包含远端 URL、Header 或 Secret。

## 输入与前置条件

- 入口：设置页「查询可用模型」（只发现）与「发现/添加模型」（开窗后发现）。
- 请求体：Provider 草稿（`id`、`name`、`modelApi`、`options.baseURL` / `apiKey` / `proxy` / `timeoutMs` / `requestOptions`）与凭据来源。
- 前置：`baseURL` 为非空 HTTP(S) URL；`modelApi` 为受支持的协议。`bedrock-converse-stream` 不支持发现。
- 认证：`anthropic-messages` 用 `x-api-key` + `anthropic-version: 2023-06-01`；其余按协议注入 `Authorization: Bearer` 或 query key；用户配置的 `requestOptions.headers` 可覆盖非保护头。

## 输出与可观察行为

- 成功：返回去重并按 `id` 排序的模型清单；每项含 `id`、`name`，以及远端提供时的分组、接口格式、能力、上下文窗口与价格元数据。界面展示为按分组折叠的勾选列表；`partial` 为真时同时显示诊断条。
- 首屏 404 且 Base 路径不以 `/v1` 结尾：自动改走 `{Base}/v1/models` 重试一次；成功后结果与首次命中无差别，用户不需要知道重试发生过。
- 失败：抛出稳定错误码（见「失败与恢复」），界面显示可读提示，不显示远端响应体。

## 状态与转换

- 发现是无状态请求：不写 Provider Config，不产生持久状态；勾选加入由宿主草稿与自动保存完成（见 `models.provider-settings` 域的行为）。
- 幂等：同一 Provider 与同一配置重复发现，结果集与诊断一致（远端不变时）。
- 并发：同一 Provider 的进行中发现按界面禁用处理；不同 Provider 互不影响。

## 副作用与数据

- 网络：向 Provider 发 GET；`redirect: "error"`，响应体上限 5 MiB，超时取 `options.timeoutMs` 或默认 30 秒；配置了代理时经代理发出。
- 无文件与数据库写入。诊断只回传统计，不回传远端原文。

## 失败与恢复

错误码与界面提示一一对应：

| 码 | 触发 |
|---|---|
| `missing-base-url` / `invalid-base-url` | Base 或代理不是有效 HTTP(S) URL（网络调用前拒绝） |
| `unsupported-discovery` | `bedrock-converse-stream` |
| `unauthorized` / `forbidden` / `rate-limited` | 上游 401 / 403 / 429 |
| `timeout` | 请求超时或中断 |
| `upstream-error` | 其余非 2xx（含 404 且无可用兜底路径） |
| `invalid-response` / `empty-result` | 响应不是预期结构 / 无可用条目 |
| `response-too-large` | 响应体超过上限 |

- 404 兜底只对首屏生效一次；Base 路径已含 `/v1`（或更深）时不再猜测。Google 分页与 OpenRouter 主机不走兜底。
- 不自动重试 5xx，不使用 `maxRetries`。

## 边界与兼容

- owner：`server`（发现实现与端点）与 `app`（设置页入口与展示）。
- 兼容：兜底是附加行为，首次命中路径与既有实现一致；Base 已含 `/v1` 的配置行为不变。
- 安全：请求头保护名单阻止用户头覆盖认证头；错误与诊断不携带 Secret 或远端原文。
- 依赖：不新增运行时依赖；中转站侧行为不属本规范（由中转站自行实现）。

## 验收与 Smoke

- Given Base 为协议根且 `/models` 返回 404、`/v1/models` 返回模型清单，When 触发发现，Then 返回该清单且诊断 `pageCount` 为 1（404 不计入）。
- Given Base 已含 `/v1`，When `/v1/models` 返回 404，Then 直接报 `upstream-error` 且只发一次请求。
- Given `/models` 返回 401，Then 报 `unauthorized` 且不重试。
- Given `anthropic-messages`，Then 请求带 `x-api-key` 与 `anthropic-version`，不带 `authorization`。
- Given `bedrock-converse-stream`，Then 报 `unsupported-discovery` 且不发请求。
- 可执行入口见「证据」的合同测试；设置页真实交互按 UI 验收分档在浏览器探针中核对。

## 实现合同

- owner 与入口：发现实现 `discoverProviderModelMetadata`（`packages/neuro-book/server/models/discovery.ts`），HTTP 端点 `POST /api/config/models/provider-discover`（`packages/neuro-book/server/api/config/models/provider-discover.post.ts`）；前端入口 `useModelDiscoverySession.discoverModels`（`packages/neuro-book/app/components/novel-ide/settings/useModelDiscoverySession.ts`）。
- 适配器按 `modelApi` 与主机名选择；兜底路径由适配器可选的 `fallbackUrl` 提供，仅 `openai-models` 与 `anthropic-models` 实现。
- 关键不变量：兜底只在首屏 404 触发一次；Base 路径以 `/v1` 结尾时不提供兜底；诊断 `pageCount` 只统计成功响应；错误与诊断不携带 Secret。
- 事务边界：无持久化写入；发现的唯一副作用是网络读取。

## 证据

- 实现入口：[`discovery.ts`](../../../packages/neuro-book/server/models/discovery.ts)
- 合同测试：[`discovery.test.ts`](../../../packages/neuro-book/server/models/discovery.test.ts)
- Smoke：不适用——发现行为由合同测试覆盖请求路径与错误映射，界面侧在设置页真实交互中验收，仓库内没有单独的可执行 smoke 入口。
