# Connecting a Self-Hosted Relay

If you run your own API relay (a single endpoint that unifies several model providers behind one interface), NeuroBook can connect to it directly. This page covers **what the relay must expose, what to enter in NeuroBook, and how to troubleshoot a failed connection**.

::: tip Who this is for
You already have a working relay (or are building one) and want to use it in NeuroBook as a provider. Building the relay itself is out of scope here.
:::

## 1. The Shortest Path

Three steps, all in **Settings → Models**:

1. **Add a provider**: name, API format, API Base, API key.
2. **Query available models** (or "Discover / Add models"): pull the relay's model list and check the ones you want.
3. **Set a default model** (optional): make the Agent use it by default.

## 2. Choosing the API Format

NeuroBook supports four chat protocols. Pick the one **your relay actually exposes**:

| API format | Use when |
| --- | --- |
| `anthropic-messages` | Your relay speaks Anthropic Messages (`/v1/messages`) — the most common choice for self-hosted relays |
| `openai-completions` | Your relay speaks OpenAI Chat Completions (`/v1/chat/completions`) |
| `openai-responses` | Your relay speaks the OpenAI Responses API |
| `google-generative-ai` | You connect straight to Google Gemini's native protocol |

**If you pick the wrong one**: chat requests come back 404 or 400 with a path that clearly does not match. You can change this field at any time; it does not rewrite the API format already set on individual models.

## 3. API Base Must Be the Protocol Root

This is the easiest mistake to make.

**Enter**: the protocol root, e.g. `http://localhost:8787` or `https://relay.example.com`.

**Do not enter**: a full endpoint such as `http://localhost:8787/v1/messages`.

**Why**: NeuroBook's chat client **appends** `/v1/messages` to the base URL itself. If you entered the full endpoint, it builds `/v1/messages/v1/messages` — a duplicated path, and the request fails. The API Base field in Settings shows this rule as a hint underneath it.

::: warning The knock-on effect
Besides chat, model discovery also builds a malformed path like `/v1/messages/models`. Both features break together, which can look like "the relay doesn't support this" when the real cause is an over-specified base URL.
:::

## 4. API Key and Proxy

- **API key**: whatever the relay requires. If your relay does not check it, enter any non-empty value (e.g. `local-proxy`) — leaving it empty counts as "not configured".
- **Proxy**: **leave it empty when the relay is on localhost or an internal network.** With a proxy set, requests detour through it and a local address may become unreachable. Model connectivity checks do not support proxies at all and will fail outright.

## 5. What Endpoints the Relay Should Expose

| Feature | Request | Required? |
| --- | --- | --- |
| **Chat** | `{Base}/v1/messages` (Anthropic) or `{Base}/v1/chat/completions` (OpenAI) | Yes |
| **Model discovery** | `{Base}/models`, falling back to `{Base}/v1/models` | Optional, but strongly recommended |

**Response format for the discovery endpoint** (OpenAI style is enough):

```json
{
  "object": "list",
  "data": [
    {"id": "your-model-id", "display_name": "Your Model Name"}
  ]
}
```

`id` is required, `display_name` optional. NeuroBook deduplicates by `id`, sorts the list, and groups it in the UI.

::: tip Implementing both paths is safest
NeuroBook first requests `{Base}/models`, and **retries `{Base}/v1/models` once if the first request returns 404**. So:
- Only `/models`: works.
- Only `/v1/models`: works (via the fallback retry).
- Both: safest, and the least thinking required.
:::

::: details Why two paths exist
The official Anthropic model list lives at `/v1/models`, while the discovery convention is `{Base}/models`. To support both the official API and self-hosted deployments, NeuroBook retries with `/v1` on a 404. Your relay works with either path.
:::

## 6. Troubleshooting

Check in this order — it locates most problems:

**1. Test the endpoint directly** (from a terminal, bypassing NeuroBook):

```bash
# Model discovery endpoints
curl -s http://localhost:8787/models -H "x-api-key: YOUR_KEY" -H "anthropic-version: 2023-06-01"
curl -s http://localhost:8787/v1/models -H "x-api-key: YOUR_KEY" -H "anthropic-version: 2023-06-01"

# Chat endpoint
curl -s -X POST http://localhost:8787/v1/messages \
  -H "content-type: application/json" \
  -H "x-api-key: YOUR_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -d '{"model":"YOUR_MODEL_ID","max_tokens":16,"messages":[{"role":"user","content":"hi"}]}'
```

Whichever fails is a relay-side problem.

**2. Match against common errors**:

| Symptom | Likely cause |
| --- | --- |
| Discovery: "cannot reach the provider or read the model list (HTTP 404)" | The relay has no model-list endpoint; or API Base was set to a full endpoint |
| Discovery: 401 / 403 | Wrong API key, or the relay expects different auth headers |
| Discovery: 400, invalid base URL | API Base is not a valid HTTP(S) address |
| Chat: 404 with a duplicated path in the error | API Base was set to a full endpoint (section 3) |
| Chat: connection fails although curl works | The proxy field has a value (section 4) |
| Chat works but discovery finds nothing | The relay has no list endpoint — add models manually |

**3. Add models manually** (the way out when there is no list endpoint):

The "Discover / Add models" dialog has a manual row at the bottom: name, ID, API format, context window. Confirm it and the model joins the provider — no list endpoint required.

## 7. Full Example: A Local Relay

Say your relay runs at `http://localhost:8787`, speaks Anthropic Messages, and uses the key `local-proxy`:

| Field | Value |
| --- | --- |
| Config ID | `my-relay` (your choice; must start with a letter or digit) |
| Provider name | Anything, e.g. "Local Relay" |
| Provider default API format | `anthropic-messages` |
| API Base | `http://localhost:8787` ← **the protocol root, no `/v1/messages`** |
| API key | `local-proxy` |
| Proxy | empty |

Save, then click "Query available models" — you should see every model the relay exposes. Check the ones you want, then select them in a session.

::: tip Reusing keys via clone
To configure the same relay twice (e.g. with different timeout settings), use **Clone connection**: the connection identity (base URL, proxy) is carried over, while the key and model references are not migrated and must be set separately.
:::

## Keep Reading

- [Settings](/en/guide/settings) — the Models section and scopes
- [Quick Start](/en/quick-start) — configuring a provider for the first time
- [Operations, Data and Privacy](/en/operations) — where keys and config files live
