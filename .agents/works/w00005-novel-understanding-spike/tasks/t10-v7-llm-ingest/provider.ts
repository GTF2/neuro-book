import { readFile } from "node:fs/promises";
import { z } from "zod";

export interface ModelRequest {
    model: "deepseek-flash";
    system: string;
    user: string;
    maxTokens: number;
    timeoutMs: number;
    thinking?: "enabled" | "disabled";
}

export interface ModelResponse {
    text: string;
    model: string;
    finishReason: string;
    usage: {
        inputTokens: number;
        outputTokens: number;
        cacheHitTokens: number | null;
        cacheMissTokens: number | null;
    } | null;
    responseId: string;
    durationMs: number;
    startedAt?: string;
    raw?: unknown;
}

export type ModelProvider = (request: ModelRequest) => Promise<ModelResponse>;
export type ProviderErrorCategory = "configuration" | "request" | "authentication" | "balance"
    | "rate-limit" | "server" | "http" | "timeout" | "network" | "invalid-response"
    | "empty-output" | "incomplete-output";

export class ProviderError extends Error {
    readonly raw?: unknown;
    readonly startedAt?: string;
    readonly durationMs?: number;

    constructor(
        message: string,
        readonly category: ProviderErrorCategory,
        readonly status: number | null,
        readonly retryable: boolean,
        readonly response?: ModelResponse,
        audit?: { raw?: unknown; startedAt: string; durationMs: number },
    ) {
        super(message);
        this.name = "ProviderError";
        this.raw = audit?.raw ?? response?.raw;
        this.startedAt = audit?.startedAt ?? response?.startedAt;
        this.durationMs = audit?.durationMs ?? response?.durationMs;
    }
}

const requestSchema = z.strictObject({
    model: z.literal("deepseek-flash"),
    system: z.string().min(1),
    user: z.string().min(1),
    maxTokens: z.number().int().min(1).max(393216),
    timeoutMs: z.number().int().min(1).max(2147483647),
    thinking: z.enum(["enabled", "disabled"]).optional(),
});
const tokenCount = z.number().int().nonnegative();
const responseSchema = z.object({
    id: z.string().min(1),
    model: z.string().min(1),
    choices: z.array(z.object({
        index: z.number().int(),
        message: z.object({ content: z.string().nullable() }),
        finish_reason: z.string(),
    })).min(1),
    usage: z.object({
        prompt_tokens: tokenCount,
        completion_tokens: tokenCount,
        prompt_cache_hit_tokens: tokenCount.optional(),
        prompt_cache_miss_tokens: tokenCount.optional(),
    }).nullish(),
});
const providerConfigSchema = z.object({
    models: z.object({
        providers: z.array(z.object({
            id: z.string(),
            enabled: z.boolean().optional(),
            options: z.unknown().optional(),
        })),
    }),
});
const deepSeekOptionsSchema = z.object({ apiKey: z.string().trim().min(1), baseURL: z.string().optional() });

function endpointFor(baseUrl = "https://api.deepseek.com"): string {
    let url: URL;
    try {
        url = new URL(baseUrl);
    } catch {
        throw new ProviderError("DeepSeek base URL is invalid", "configuration", null, false);
    }
    if (url.protocol !== "https:" || url.hostname !== "api.deepseek.com" || url.port
        || url.username || url.password || url.search || url.hash || !["/", "/v1", "/v1/"].includes(url.pathname)) {
        throw new ProviderError("This ingest requires the official DeepSeek HTTPS endpoint", "configuration", null, false);
    }
    url.pathname = `${url.pathname.replace(/\/$/, "")}/chat/completions`;
    return url.href;
}

/** Read exactly one explicit credential source; the returned key belongs only to the runtime. */
export async function loadProviderConfig(options: { envKey?: string; configPath?: string }): Promise<{ apiKey: string; baseUrl: string }> {
    if (Boolean(options.envKey) === Boolean(options.configPath)) {
        throw new ProviderError("Select exactly one provider config file or environment variable", "configuration", null, false);
    }
    if (options.envKey) {
        const apiKey = process.env[options.envKey]?.trim();
        if (!apiKey) throw new ProviderError("The selected credential environment variable is empty", "configuration", null, false);
        return { apiKey, baseUrl: "https://api.deepseek.com" };
    }
    try {
        const config = providerConfigSchema.parse(JSON.parse(await readFile(options.configPath!, "utf8")));
        const candidates = config.models.providers.filter(provider => provider.id === "deepseek");
        const selected = candidates[0];
        if (candidates.length !== 1 || !selected || selected.enabled !== true) {
            throw new ProviderError("The config must contain exactly one enabled deepseek provider", "configuration", null, false);
        }
        const provider = deepSeekOptionsSchema.parse(selected.options);
        const baseUrl = provider.baseURL ?? "https://api.deepseek.com";
        endpointFor(baseUrl);
        return { apiKey: provider.apiKey, baseUrl };
    } catch (error) {
        if (error instanceof ProviderError) throw error;
        // Parser and I/O errors may include excerpts from the credential file.
        throw new ProviderError("Cannot read a valid DeepSeek provider from the selected config", "configuration", null, false);
    }
}

function httpError(status: number): ProviderError {
    const category: ProviderErrorCategory = status === 401 ? "authentication" : status === 402 ? "balance"
        : status === 429 ? "rate-limit" : status >= 500 ? "server" : status === 400 || status === 422 ? "request" : "http";
    return new ProviderError(`DeepSeek request returned HTTP ${status}`, category, status, status === 429 || status >= 500);
}

/** One bounded request. The runner owns attempts, retry delays, persistence and publication. */
export function createDeepSeekProvider(options: {
    apiKey: string;
    baseUrl?: string;
    fetch?: typeof globalThis.fetch;
}): ModelProvider {
    const apiKey = options.apiKey.trim();
    if (!apiKey) throw new ProviderError("DeepSeek API key is empty", "configuration", null, false);
    const endpoint = endpointFor(options.baseUrl);
    const fetchRequest = options.fetch ?? globalThis.fetch;
    return async input => {
        const parsedRequest = requestSchema.safeParse(input);
        if (!parsedRequest.success) throw new ProviderError("Invalid DeepSeek request parameters", "request", null, false);
        const request = parsedRequest.data;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), request.timeoutMs);
        const started = performance.now();
        const startedAt = new Date().toISOString();
        const audit = (raw?: unknown) => ({ raw, startedAt, durationMs: Math.round(performance.now() - started) });
        try {
            const response = await fetchRequest(endpoint, {
                method: "POST",
                redirect: "error",
                signal: controller.signal,
                headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: request.model,
                    messages: [{ role: "system", content: request.system }, { role: "user", content: request.user }],
                    max_tokens: request.maxTokens,
                    stream: false,
                    response_format: { type: "json_object" },
                    thinking: { type: request.thinking ?? "disabled" },
                }),
            });
            if (!response.ok) {
                await response.body?.cancel();
                throw httpError(response.status);
            }
            let raw: unknown;
            let rawText: string | undefined;
            try {
                rawText = (await response.text()).replaceAll(apiKey, "[REDACTED]");
                raw = JSON.parse(rawText);
            } catch {
                if (controller.signal.aborted) throw new ProviderError("DeepSeek request timed out; provider outcome is unknown", "timeout", null, true, undefined, audit(rawText));
                throw new ProviderError("DeepSeek returned invalid JSON", "invalid-response", response.status, true, undefined, audit(rawText));
            }
            const parsed = responseSchema.safeParse(raw);
            const first = parsed.success ? parsed.data.choices.find(choice => choice.index === 0) : undefined;
            if (!parsed.success || !first) throw new ProviderError("DeepSeek response does not match its response contract", "invalid-response", response.status, true, undefined, audit(raw));
            const usage = parsed.data.usage;
            const result: ModelResponse = {
                text: first.message.content ?? "",
                model: parsed.data.model,
                finishReason: first.finish_reason,
                usage: usage ? {
                    inputTokens: usage.prompt_tokens,
                    outputTokens: usage.completion_tokens,
                    cacheHitTokens: usage.prompt_cache_hit_tokens ?? null,
                    cacheMissTokens: usage.prompt_cache_miss_tokens ?? null,
                } : null,
                responseId: parsed.data.id,
                durationMs: Math.round(performance.now() - started),
                startedAt,
                raw,
            };
            if (result.finishReason !== "stop") throw new ProviderError(`DeepSeek output is incomplete (${result.finishReason})`, "incomplete-output", response.status, true, result);
            if (!result.text.trim()) throw new ProviderError("DeepSeek returned empty content", "empty-output", response.status, true, result);
            return result;
        } catch (error) {
            if (error instanceof ProviderError) throw error;
            if (controller.signal.aborted) throw new ProviderError("DeepSeek request timed out; provider outcome is unknown", "timeout", null, true, undefined, audit());
            throw new ProviderError("DeepSeek network request failed; provider outcome is unknown", "network", null, true, undefined, audit());
        } finally {
            clearTimeout(timeout);
        }
    };
}
