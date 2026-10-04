# 自建中转站接入

如果你自己搭了一个 API 中转站（把多个模型供应商的接口统一成一个入口），NeuroBook 可以直接接它。这一页讲清**中转站要提供什么、NeuroBook 侧怎么填、以及接不上时怎么排**。

::: tip 这是给谁看的
你已经有一个能跑的中转站（或正在搭），想把它接进 NeuroBook 当 Provider 用。中转站本身的搭建不在本文范围。
:::

## 一、最短路径

三步，全部在**设置 → 模型**里完成：

1. **新增 Provider**：填名称、接口格式、API Base、API Key。
2. **查询可用模型**（或「发现/添加模型」）：拉取中转站的模型清单，勾选要用的。
3. **设为默认模型**（可选）：让 Agent 默认用它。

下面逐项说清楚。

## 二、接口格式怎么选

NeuroBook 支持四种对话协议，选**和你中转站暴露的协议一致**的那个：

| 接口格式 | 适用 |
| --- | --- |
| `anthropic-messages` | 中转站提供 Anthropic Messages 协议（`/v1/messages`）——自建中转站最常见 |
| `openai-completions` | 中转站提供 OpenAI Chat Completions（`/v1/chat/completions`） |
| `openai-responses` | 中转站提供 OpenAI Responses API |
| `google-generative-ai` | 直接对接 Google Gemini 原生协议 |

**选错的表现**：聊天请求返回 404 或 400，且错误里能看到路径不对。改这一项随时可改，不影响已有模型自己的接口格式。

## 三、API Base 必须填协议根

这是最容易踩的一条。

**填法**：协议根地址，例如 `http://localhost:8787` 或 `https://relay.example.com`。

**不要填**：完整端点（如 `http://localhost:8787/v1/messages`）。

**为什么**：NeuroBook 的聊天客户端会在 Base 之后**自动补** `/v1/messages`。你填了完整端点，它会拼出 `/v1/messages/v1/messages`——路径重复，请求就失败了。设置页 API Base 字段下有一行提示写着这条约定。

::: warning 填错的连带影响
除了聊天，模型发现也会拼出 `/v1/messages/models` 这种畸形路径。填错之后两个功能一起坏，现象看起来像「中转站不支持」，实际是 Base 填多了。
:::

## 四、API Key 与代理

- **API Key**：中转站要求的密钥。如果中转站不校验，随便填一个非空值（例如 `local-proxy`）——留空会被当作未配置。
- **代理**：**对接 localhost / 内网中转站时留空**。填了代理，请求会绕道代理，本机地址可能因此不可达。另外模型连通性检测完全不支持代理，填了会直接报错。

## 五、中转站需要提供什么端点

| 功能 | 请求 | 说明 |
| --- | --- | --- |
| **聊天** | `{Base}/v1/messages`（Anthropic）或 `{Base}/v1/chat/completions`（OpenAI） | 必需 |
| **模型发现** | `{Base}/models`，失败时自动重试 `{Base}/v1/models` | 可选，但强烈建议 |

**模型发现端点的返回格式**（OpenAI 风格即可）：

```json
{
  "object": "list",
  "data": [
    {"id": "your-model-id", "display_name": "Your Model Name"}
  ]
}
```

`id` 必填，`display_name` 可选。NeuroBook 会按 `id` 去重、排序，并在界面上按分组展示。

::: tip 两个路径都实现最稳
NeuroBook 先打 `{Base}/models`，**首屏 404 时会自动补 `/v1/models` 再试一次**。所以：
- 只实现 `/models`：可用。
- 只实现 `/v1/models`：可用（走兜底重试）。
- 两个都实现：最稳，也最省事。
:::

::: details 为什么会有两种路径
官方 Anthropic 的模型列表在 `/v1/models`，而发现功能的默认约定是 `{Base}/models`。为了同时兼容官方 API 和各类自建部署，NeuroBook 做了 404 兜底重试。你的中转站实现哪一个都能接上。
:::

## 六、接不上怎么排

按这个顺序查，能定位到绝大多数问题：

**1. 先直接测端点**（在终端里跑，绕开 NeuroBook）：

```bash
# 模型发现端点
curl -s http://localhost:8787/models -H "x-api-key: 你的key" -H "anthropic-version: 2023-06-01"
curl -s http://localhost:8787/v1/models -H "x-api-key: 你的key" -H "anthropic-version: 2023-06-01"

# 聊天端点
curl -s -X POST http://localhost:8787/v1/messages \
  -H "content-type: application/json" \
  -H "x-api-key: 你的key" \
  -H "anthropic-version: 2023-06-01" \
  -d '{"model":"你的模型id","max_tokens":16,"messages":[{"role":"user","content":"hi"}]}'
```

哪个不通，就是中转站侧的问题。

**2. 对照常见错误**：

| 现象 | 多半是 |
| --- | --- |
| 发现报「无法连接 Provider 或读取模型列表（HTTP 404）」 | 中转站没实现模型列表端点；或 Base 填成了完整端点 |
| 发现报 401 / 403 | API Key 不对，或中转站要求不同的认证头 |
| 发现报 400，提示 Base 无效 | Base 不是合法的 HTTP(S) 地址 |
| 聊天报 404，错误里路径重复 | Base 填成了完整端点（见第三节） |
| 聊天报连接失败，但 curl 能通 | 代理字段填了值（见第四节） |
| 发现不到模型但聊天正常 | 中转站没实现列表端点——手动添加模型即可 |

**3. 手动添加模型**（列表端点缺失时的出路）：

「发现/添加模型」窗口底部有一条手工补全行：填名称、ID、接口格式、上下文窗口。填完确认即可加入，不需要中转站支持列表端点。

## 七、完整示例：本地中转站

假设你的中转站跑在 `http://localhost:8787`，提供 Anthropic 协议，密钥是 `local-proxy`：

| 字段 | 填什么 |
| --- | --- |
| 配置 ID | `my-relay`（自定义，字母数字开头） |
| 服务商名称 | 随便起，如「本地中转站」 |
| Provider 默认接口格式 | `anthropic-messages` |
| API Base | `http://localhost:8787` ← **协议根，不带 `/v1/messages`** |
| API Key | `local-proxy` |
| 代理 | 留空 |

保存后点「查询可用模型」——应该能看到中转站暴露的全部模型。勾选要用的加入白名单，然后在会话里选它。

::: tip 克隆连接复用密钥
同一个中转站想配成两个 Provider（例如一个走不同超时设置），用**复制连接**：连接身份（Base、代理）会带过去，密钥和模型引用不会自动迁移，需要单独配。
:::

## 继续阅读

- [设置中心](/guide/settings) — 模型分区与作用域
- [快速开始](/quick-start) — 第一次配置 Provider
- [运行、数据与隐私](/operations) — 密钥与配置文件落在哪
