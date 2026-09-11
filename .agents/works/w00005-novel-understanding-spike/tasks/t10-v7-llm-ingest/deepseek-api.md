# DeepSeek API 核验

2026-09-10 独立 Reviewer 查阅官方文档确认：`deepseek-flash` 对应 DeepSeek-V4.1-Flash，旧 `deepseek-v4-flash` 当日退役并路由至新模型。本轮显式使用新 ID。

| 项目 | 合同 |
| --- | --- |
| 入口 | POST `https://api.deepseek.com/chat/completions`，Bearer 认证 |
| JSON | `response_format: {type: "json_object"}`；提示词明确 json 和输出形状；仍需本地校验 |
| 模式 | 显式 thinking enabled/disabled；默认 enabled/high；思考时 temperature 无效 |
| 限制 | max_tokens 1..393216，总输入和输出受 1M 上下文限制；不得依赖默认输出 8K/64K |
| 完成 | 非空 content 且 finish_reason=stop 才进入本地验证；空输出、length、content_filter、insufficient_system_resource、aborted 不发布 |
| 错误 | 400/422 修请求，401 修认证，402 余额；429/500/503 有限退避；超时结果可能已经计费 |
| 记录 | 实际 response.model、system_fingerprint、prompt/cache-hit/cache-miss/completion/total tokens 及 reasoning 明细 |
| 低峰美元价格 | 每百万 token：输入命中 0.003、未命中 0.15、输出 0.6 |
| 高峰美元价格 | 每百万 token：输入命中 0.006、未命中 0.3、输出 1.2 |
| 高峰 | 周一至周五 UTC 01:00-04:00、06:00-10:00；其它低峰，估价必须注明并非账单 |

来源：[发布公告](https://api-docs.deepseek.com/news/news260910)、[请求与响应](https://api-docs.deepseek.com/api/create-chat-completion)、[JSON 输出](https://api-docs.deepseek.com/guides/json_mode)、[思考模式](https://api-docs.deepseek.com/guides/thinking_mode)、[价格](https://api-docs.deepseek.com/quick_start/pricing)、[错误码](https://api-docs.deepseek.com/quick_start/error_codes)、[连接与限流](https://api-docs.deepseek.com/quick_start/rate_limit)。

后续官方合同变化时核对并更新请求策略身份，不把旧价格或模型行为硬编码成永不变化的事实。
