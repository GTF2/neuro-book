import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDeepSeekProvider, loadProviderConfig, type ModelRequest, ProviderError } from "./provider.ts";

const directories: string[] = [];
afterEach(async () => {
    vi.unstubAllEnvs();
    await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true })));
});

const request: ModelRequest = { model: "deepseek-flash", system: "Return json", user: "{\"ok\":true}", maxTokens: 400, timeoutMs: 1000, thinking: "disabled" };
const responseBody = {
    id: "completion-1", model: "deepseek-flash", system_fingerprint: "fingerprint-1",
    choices: [{ index: 0, message: { role: "assistant", content: "{\"ok\":true}" }, finish_reason: "stop" }],
    usage: { prompt_tokens: 50, completion_tokens: 10, prompt_cache_hit_tokens: 20, prompt_cache_miss_tokens: 30, total_tokens: 60, completion_tokens_details: { reasoning_tokens: 4 } },
};

function fakeFetch(body: unknown, status = 200): typeof globalThis.fetch {
    return vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(JSON.stringify(body), { status }));
}

async function configFile(data: unknown): Promise<string> {
    const directory = await mkdtemp(join(tmpdir(), "v7-provider-"));
    directories.push(directory);
    const path = join(directory, "config.json");
    await writeFile(path, typeof data === "string" ? data : JSON.stringify(data));
    return path;
}

describe("DeepSeek single request adapter", () => {
    it("uses the new model, explicit JSON mode and audited raw usage", async () => {
        const fetch = fakeFetch(responseBody);
        const provider = createDeepSeekProvider({ apiKey: "test-key-only", baseUrl: "https://api.deepseek.com/v1/", fetch });
        const result = await provider(request);
        const call = vi.mocked(fetch).mock.calls[0];
        expect(call?.[0]).toBe("https://api.deepseek.com/v1/chat/completions");
        const options = call?.[1];
        expect(options?.redirect).toBe("error");
        expect(new Headers(options?.headers).get("authorization")).toBe("Bearer test-key-only");
        expect(JSON.parse(String(options?.body))).toEqual({
            model: "deepseek-flash", messages: [{ role: "system", content: request.system }, { role: "user", content: request.user }],
            max_tokens: 400, stream: false, response_format: { type: "json_object" }, thinking: { type: "disabled" },
        });
        expect(result).toMatchObject({
            text: "{\"ok\":true}", model: "deepseek-flash", finishReason: "stop", responseId: "completion-1",
            usage: { inputTokens: 50, outputTokens: 10, cacheHitTokens: 20, cacheMissTokens: 30 }, raw: responseBody,
        });
        expect(result.startedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it("keeps unknown cache usage unknown and redacts any echoed credential", async () => {
        const body = { ...responseBody, system_fingerprint: "echo-test-key-only", usage: { prompt_tokens: 50, completion_tokens: 10 } };
        const result = await createDeepSeekProvider({ apiKey: "test-key-only", fetch: fakeFetch(body) })(request);
        expect(result.usage).toEqual({ inputTokens: 50, outputTokens: 10, cacheHitTokens: null, cacheMissTokens: null });
        expect(JSON.stringify(result)).not.toContain("test-key-only");
    });

    it("retains billed responses for incomplete or empty content", async () => {
        for (const [finish, content, category] of [["length", "{", "incomplete-output"], ["stop", "  ", "empty-output"]]) {
            const body = { ...responseBody, choices: [{ index: 0, message: { content }, finish_reason: finish }] };
            const provider = createDeepSeekProvider({ apiKey: "test-key-only", fetch: fakeFetch(body) });
            await expect(provider(request)).rejects.toMatchObject({ category, retryable: true, response: { usage: { outputTokens: 10 }, raw: body } });
        }
    });

    it("classifies HTTP failures without copying response bodies or retrying internally", async () => {
        for (const [status, category, retryable] of [[401, "authentication", false], [402, "balance", false], [422, "request", false], [429, "rate-limit", true], [503, "server", true]] as const) {
            const fetch = fakeFetch({ error: "test-key-only" }, status);
            const provider = createDeepSeekProvider({ apiKey: "test-key-only", fetch });
            const error = await provider(request).catch((value: unknown) => value);
            expect(error).toBeInstanceOf(ProviderError);
            expect(error).toMatchObject({ status, category, retryable });
            expect(String(error)).not.toContain("test-key-only");
            expect(fetch).toHaveBeenCalledTimes(1);
        }
    });

    it("rejects malformed success data, off-provider endpoints and invalid request limits", async () => {
        const malformedBody = { ...responseBody, usage: { prompt_tokens: -1, completion_tokens: 10 } };
        const fetch = fakeFetch(malformedBody);
        await expect(createDeepSeekProvider({ apiKey: "test-key-only", fetch })(request)).rejects.toMatchObject({ category: "invalid-response", raw: malformedBody, startedAt: expect.any(String), durationMs: expect.any(Number) });
        expect(() => createDeepSeekProvider({ apiKey: "test-key-only", baseUrl: "https://other.example/" })).toThrow(ProviderError);
        expect(() => createDeepSeekProvider({ apiKey: "test-key-only", baseUrl: "https://test-key-only@api.deepseek.com/" })).toThrow(ProviderError);
        const unusedFetch = fakeFetch(responseBody);
        await expect(createDeepSeekProvider({ apiKey: "test-key-only", fetch: unusedFetch })({ ...request, maxTokens: 0 })).rejects.toMatchObject({ category: "request", retryable: false });
        expect(unusedFetch).not.toHaveBeenCalled();
    });

    it("preserves malformed JSON as redacted audit text", async () => {
        const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response("{broken test-key-only"));
        const error = await createDeepSeekProvider({ apiKey: "test-key-only", fetch })(request).catch((value: unknown) => value);
        expect(error).toMatchObject({ category: "invalid-response", raw: "{broken [REDACTED]", startedAt: expect.any(String), durationMs: expect.any(Number) });
        expect(JSON.stringify(error)).not.toContain("test-key-only");
    });

    it("aborts a timed out request and preserves unknown provider outcome", async () => {
        const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(async (_input, options) => new Promise<Response>((_resolve, reject) => {
            options?.signal?.addEventListener("abort", () => reject(new Error("test-key-only")), { once: true });
        }));
        await expect(createDeepSeekProvider({ apiKey: "test-key-only", fetch })({ ...request, timeoutMs: 5 })).rejects.toMatchObject({ category: "timeout", status: null, retryable: true });
        expect(fetch).toHaveBeenCalledTimes(1);
    });
});

describe("explicit provider configuration", () => {
    it("reads only the selected DeepSeek provider, allowing an old local model list", async () => {
        const path = await configFile({ models: { providers: [
            { id: "other", options: { apiKey: "not-selected" } },
            { id: "deepseek", enabled: true, options: { apiKey: "selected-test-key", baseURL: "https://api.deepseek.com" }, models: ["deepseek-chat"] },
        ] } });
        expect(await loadProviderConfig({ configPath: path })).toEqual({ apiKey: "selected-test-key", baseUrl: "https://api.deepseek.com" });
        vi.stubEnv("V7_PROVIDER_TEST_KEY", "env-test-key");
        expect(await loadProviderConfig({ envKey: "V7_PROVIDER_TEST_KEY" })).toEqual({ apiKey: "env-test-key", baseUrl: "https://api.deepseek.com" });
        await expect(loadProviderConfig({ envKey: "V7_PROVIDER_TEST_KEY", configPath: path })).rejects.toMatchObject({ category: "configuration" });
    });

    it("does not leak malformed, disabled or ambiguous credential configuration", async () => {
        for (const data of ["invalid selected-test-key", { models: { providers: [{ id: "deepseek", enabled: false, options: { apiKey: "selected-test-key" } }] } },
            { models: { providers: [{ id: "deepseek", enabled: true }, { id: "deepseek", enabled: true }] } }]) {
            const path = await configFile(data);
            const error = await loadProviderConfig({ configPath: path }).catch((value: unknown) => value);
            expect(error).toBeInstanceOf(ProviderError);
            expect(String(error)).not.toContain("selected-test-key");
        }
    });
});
