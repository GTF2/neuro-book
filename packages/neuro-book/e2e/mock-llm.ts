import {mkdirSync, writeFileSync} from "node:fs";
import {dirname} from "node:path";
import {
    E2E_GLOBAL_CONFIG_PATH,
    E2E_MOCK_API_KEY,
    E2E_MOCK_LLM_BASE_URL,
    E2E_MOCK_LLM_HOST,
    E2E_MOCK_LLM_PORT,
    E2E_MOCK_MODEL_ID,
    E2E_MOCK_MODEL_KEY,
    E2E_MOCK_PROVIDER_ID,
    E2E_MOCK_STREAM_CHUNKS,
    E2E_MOCK_STREAM_INTERVAL_MS,
} from "./e2e-env";

/**
 * E2E 专用本地 Mock LLM（OpenAI 兼容、流式、完全离线）。
 *
 * 为什么需要它：Agent 的「发起 → 中断」只有在一个**运行中**的会话上才有意义，而运行中需要模型。
 * 隔离 State Root 里没有任何真实 Provider 密钥，也**绝不能**联网或使用用户的真实密钥，
 * 于是这里起一个本地端点：慢速流式吐字，给 UI 留出足够长的「运行中」窗口，测试才能真的点一次「停止」。
 *
 * 只实现 App 会用到的最小面：
 * - `POST /v1/chat/completions`：既支持 `stream: true`（SSE），也支持非流式。
 * - `GET /v1/models`：若干客户端会先探活，顺手满足。
 */

type MockLlmServer = {
    /** 实际监听端口（被占用时由系统随机分配，避免与别的进程撞端口）。 */
    port: number;
    /** 已收到的请求数，便于测试/日志确认 mock 真的被调用过。 */
    requestCount: () => number;
    stop: () => void;
};

/** 单条 SSE chunk 的标准外形（OpenAI Chat Completions 流式协议）。 */
function chunkFrame(id: string, model: string, delta: Record<string, unknown>, finishReason: string | null): string {
    const payload = {
        id,
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [{index: 0, delta, finish_reason: finishReason}],
    };
    return `data: ${JSON.stringify(payload)}\n\n`;
}

/**
 * 启动本地 Mock LLM。
 *
 * 用 `Bun.serve`（e2e 由 Bun 拉起，无需额外依赖）；若端口被占用则让系统随机分配，
 * 并把真实端口回传，由调用方写进模型配置。
 *
 * 额外暴露 `GET /e2e-stats`：测试据此**证明应用真的打到了这个模型端点**，
 * 而不是只看到 UI 上的「运行中」就下结论。
 */
export function startMockLlmServer(options: {port?: number} = {}): MockLlmServer {
    let chatCompletions = 0;

    const server = Bun.serve({
        hostname: E2E_MOCK_LLM_HOST,
        // 每个隔离根用各自端口（主根 3499 / 空根 3500）：两个 webServer 同时起时不会撞端口。
        port: options.port ?? E2E_MOCK_LLM_PORT,
        // 慢速流可能持续数十秒，别让默认 idle 超时掐断。
        idleTimeout: 255,
        async fetch(request: Request): Promise<Response> {
            const url = new URL(request.url);

            if (url.pathname === "/e2e-stats") {
                return Response.json({chatCompletions});
            }

            if (url.pathname === "/v1/models") {
                return Response.json({
                    object: "list",
                    data: [{id: E2E_MOCK_MODEL_ID, object: "model", owned_by: E2E_MOCK_PROVIDER_ID}],
                });
            }

            if (url.pathname !== "/v1/chat/completions") {
                return new Response("Not Found", {status: 404});
            }

            chatCompletions += 1;
            const body = await request.json().catch(() => ({})) as {stream?: boolean; model?: string};
            const model = typeof body.model === "string" ? body.model : E2E_MOCK_MODEL_ID;

            if (body.stream === false) {
                return Response.json({
                    id: "chatcmpl-e2e-mock",
                    object: "chat.completion",
                    created: Math.floor(Date.now() / 1000),
                    model,
                    choices: [{
                        index: 0,
                        message: {role: "assistant", content: "e2e mock 非流式回复"},
                        finish_reason: "stop",
                    }],
                    usage: {prompt_tokens: 1, completion_tokens: 1, total_tokens: 2},
                });
            }

            const encoder = new TextEncoder();
            const id = "chatcmpl-e2e-mock";
            // 只注册一次 abort 监听：客户端断开（用户点「停止」）时立刻收尾，不留悬挂定时器。
            const aborted = new Promise<boolean>((resolvePromise) => {
                if (request.signal.aborted) {
                    resolvePromise(true);
                    return;
                }
                request.signal.addEventListener("abort", () => resolvePromise(true), {once: true});
            });
            const waitTick = (): Promise<boolean> => Promise.race([
                new Promise<boolean>((resolvePromise) => setTimeout(() => resolvePromise(false), E2E_MOCK_STREAM_INTERVAL_MS)),
                aborted,
            ]);

            const stream = new ReadableStream<Uint8Array>({
                async start(controller): Promise<void> {
                    controller.enqueue(encoder.encode(chunkFrame(id, model, {role: "assistant"}, null)));
                    // 慢速逐片吐字：每片之间留 E2E_MOCK_STREAM_INTERVAL_MS，UI 会一直处于「运行中」。
                    for (let index = 0; index < E2E_MOCK_STREAM_CHUNKS; index += 1) {
                        if (await waitTick()) {
                            controller.close();
                            return;
                        }
                        controller.enqueue(encoder.encode(chunkFrame(id, model, {content: `片段${String(index + 1)} `}, null)));
                    }
                    controller.enqueue(encoder.encode(chunkFrame(id, model, {}, "stop")));
                    controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                    controller.close();
                },
            });

            return new Response(stream, {
                headers: {
                    "content-type": "text/event-stream; charset=utf-8",
                    "cache-control": "no-cache",
                    connection: "keep-alive",
                },
            });
        },
    });

    return {
        // Bun.serve 的类型上 port 可空，但这里已显式指定具体端口，启动后必已绑定；
        // 用请求端口兜底仅为满足 MockLlmServer.port: number 的类型契约（不改变实际值）。
        port: server.port ?? E2E_MOCK_LLM_PORT,
        requestCount: () => chatCompletions,
        stop: () => {
            void server.stop(true);
        },
    };
}

/**
 * 把 Mock Provider 写进隔离全局配置（`<workspace>/.nbook/config.json`）。
 *
 * 关键点：
 * - 只在隔离根内写，绝不碰真实 State Root（调用方已把 NEURO_BOOK_STATE_ROOT 指到临时目录）。
 * - `baseURL` 指向本地 Mock；`apiKey` 是假值，runtime 的密钥解密对明文原样透传。
 * - `agent.defaultProfileKey.novel = leader.default`（系统默认 profile），保证会话能解析到模型。
 * - `models.default` 指向 Mock 模型 key，`resolvePiModelFromConfig` 才会选中它。
 */
export function writeE2eGlobalConfig(options: {configPath?: string; baseUrl?: string} = {}): void {
    const configPath = options.configPath ?? E2E_GLOBAL_CONFIG_PATH;
    const mockBaseUrl = options.baseUrl ?? E2E_MOCK_LLM_BASE_URL;
    const config = {
        models: {
            default: E2E_MOCK_MODEL_KEY,
            providers: [
                {
                    id: E2E_MOCK_PROVIDER_ID,
                    name: "E2E 本地 Mock Provider",
                    enabled: true,
                    modelApi: "openai-completions",
                    options: {
                        apiKey: E2E_MOCK_API_KEY,
                        baseURL: mockBaseUrl,
                        proxy: "",
                        timeoutMs: null,
                        requestOptions: {},
                    },
                    models: [
                        {
                            name: "E2E Mock Model",
                            id: E2E_MOCK_MODEL_ID,
                            group: null,
                            enabled: true,
                            api: "openai-completions",
                            reasoning: false,
                            input: ["text"],
                            maxTokens: 4096,
                            cost: null,
                            compat: null,
                            // 显式带上 Authorization：pi-ai 的 getClientApiKey 在有 authorization 头时不再要求密钥，
                            // 使得「无真实密钥」的隔离环境也能跑通请求。
                            headers: {authorization: `Bearer ${E2E_MOCK_API_KEY}`},
                            thinkingLevelMap: null,
                            contextWindowTokens: 128000,
                        },
                    ],
                },
            ],
        },
        agent: {
            defaultProfileKey: {novel: "leader.default", userAssets: "leader.assets"},
        },
    };

    mkdirSync(dirname(configPath), {recursive: true});
    writeFileSync(configPath, `${JSON.stringify(config, null, 4)}\n`, "utf8");
    process.stdout.write(`[e2e] 已写入隔离全局配置（Mock Provider）: ${configPath}\n`);
}
