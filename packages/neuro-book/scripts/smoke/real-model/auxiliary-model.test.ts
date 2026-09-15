/**
 * 真实模型辅助任务模型 smoke：观测「解释这一步」这一次解释请求**实际打到哪台主机**、body 里的 `model` 是什么。
 *
 * 观测手段是包装 `globalThis.fetch`：记录 URL host 与请求体 `model` 后**透传**给原 fetch（真发请求，不是 mock）。
 * 运行配置里 profile 默认模型走 deepseek、指定的辅助模型走 openrouter，两者位于**不同主机**，
 * 因此 host + body.model 两项合起来就足以判定「辅助任务的指定模型是否真的生效」。
 *
 * 凭据只从真实 State Root 的 `workspace/.nbook/config.json` 读出，写进本次 run 的隔离 State Root
 * （随 run teardown 删除；POSIX 下 0600），不打印、不写进用例名或报告、不经命令行参数、不落入仓库。
 * 缺凭据/配置时整组 skip；Provider 不可达时按条件 skip，并在证据中记为「本轮未观测」。
 *
 * 运行入口：`bun run test:real-model -- auxiliary-model`。
 */

import {readFileSync} from "node:fs";
import {mkdir, rm, writeFile} from "node:fs/promises";
import {join, resolve} from "node:path";
import {afterAll, beforeAll, describe, expect, it, vi} from "vitest";
import {resolveAgentTempRoot} from "@notnotype/neuro-book-test-support/paths";
import {prepareAgentSmokeWorkspace} from "nbook/scripts/smoke/agent";
import {NeuroAgentHarness} from "nbook/server/agent/harness/neuro-agent-harness";
import {JsonlSessionRepository} from "nbook/server/agent/session/session-repo";
import {createVariableDefinitionArtifactPathContextResolver} from "nbook/server/agent/variables/definition-artifact";
import {normalizeGlobalConfig} from "nbook/server/config/normalizer";
import {runtimePathsFromEnv} from "nbook/server/runtime/paths/runtime-paths";
import {resolveUserNbookRoot} from "nbook/server/workspace-files/workspace-runtime-root";
import type {StoredProviderConfig} from "nbook/server/config/types";

const PROFILE_KEY = "leader.default";
/** 对照组模型：Profile 默认模型，走 deepseek。 */
const PROFILE_MODEL_KEY = "deepseek/deepseek-flash";
const PROFILE_HOST = "api.deepseek.com";
const PROFILE_MODEL_ID = "deepseek-flash";
/** 实验组模型：辅助任务指定模型，走 openrouter；与 Profile 模型不同主机，两者不可能混淆。 */
const AUXILIARY_MODEL_KEY = "openrouter/claude-opus-4-6";
const AUXILIARY_HOST = "kapibala.asia";
const AUXILIARY_MODEL_ID = "claude-opus-4-6";

/** 应用包根：隔离 smoke workspace 没有 runtimePaths 时，变量 artifact 仍按应用资产的编译产物解析。 */
const APPLICATION_ROOT = resolve(import.meta.dirname, "../../..");

type RealProviders = {
    deepseek: StoredProviderConfig;
    openrouter: StoredProviderConfig;
};

/**
 * 真实 State Root 的全局配置路径。
 *
 * 剥离测试期注入的 `NEURO_BOOK_*` 覆盖后按产品自身的平台约定推导
 * （Windows 为 `%LOCALAPPDATA%/NeuroBook/data/workspace/.nbook/config.json`）。
 */
function resolveRealUserNbookConfigPath(): string {
    const env: NodeJS.ProcessEnv = {...process.env};
    delete env.NEURO_BOOK_STATE_ROOT;
    delete env.NEURO_BOOK_APPLICATION_ROOT;
    delete env.NEURO_BOOK_CACHE_ROOT;
    return join(runtimePathsFromEnv(process.cwd(), env).userNbookRoot, "config.json");
}

/** Provider 必须启用、有 apiKey 与 baseURL，且登记了目标模型；否则视为不可用于本次观测。 */
function hasRunnableProvider(provider: StoredProviderConfig | undefined, modelId: string): provider is StoredProviderConfig {
    if (!provider || provider.enabled === false) return false;
    if (!provider.options?.apiKey?.trim() || !provider.options.baseURL?.trim()) return false;
    return provider.models.some((model) => model.id === modelId && model.enabled !== false);
}

/**
 * 从真实 State Root 读出 deepseek 与 openrouter 两个 Provider（**整体原样**，含 apiKey 与 baseURL）。
 * 只做存在性/可运行性判断，不打印、不落任何仓库内文件；缺一即返回 null（由调用方 skip）。
 */
function loadRealProviders(): RealProviders | null {
    try {
        const config = JSON.parse(readFileSync(resolveRealUserNbookConfigPath(), "utf8")) as {
            models?: {providers?: StoredProviderConfig[]};
        };
        const providers = config.models?.providers ?? [];
        const deepseek = providers.find((provider) => provider.id === "deepseek");
        const openrouter = providers.find((provider) => provider.id === "openrouter");
        if (!hasRunnableProvider(deepseek, PROFILE_MODEL_ID) || !hasRunnableProvider(openrouter, AUXILIARY_MODEL_ID)) {
            return null;
        }
        return {deepseek, openrouter};
    } catch {
        return null;
    }
}

/**
 * 把凭据写进本次 run 的隔离 State Root（Harness 的 Provider 读取路径）。
 *
 * `auxiliaryModelKey` 为 null 表示该 Profile 未配置辅助任务模型，即「跟随 Profile 模型」。
 * 这里刻意不复用 `support.ts` 的 `writeRealModelGlobalConfig`：它只支持单 provider 且凭据取自环境变量，
 * 而本观测需要两个 Host 不同的 Provider。
 */
async function writeIsolatedConfig(providers: RealProviders, auxiliaryModelKey: string | null): Promise<void> {
    if (!process.env.NEURO_BOOK_STATE_ROOT?.trim()) {
        throw new Error("拒绝写入真实 State Root：本次 run 缺少 NEURO_BOOK_STATE_ROOT（vitest globalSetup 未生效？）");
    }
    const stored = normalizeGlobalConfig({
        models: {
            default: PROFILE_MODEL_KEY,
            providers: [providers.deepseek, providers.openrouter],
        },
        ...(auxiliaryModelKey === null ? {} : {
            agent: {
                profiles: {
                    [PROFILE_KEY]: {runtime: {auxiliary: {modelKey: auxiliaryModelKey}}},
                },
            },
        }),
    });
    const root = resolveUserNbookRoot();
    await mkdir(root, {recursive: true});
    // 副本含明文 Provider 密钥：POSIX 下创建即收紧为 0600；该目录随 run teardown 删除。
    await writeFile(join(root, "config.json"), `${JSON.stringify(stored, null, 2)}\n`, {encoding: "utf8", mode: 0o600});
}

/** 网络可达性探活：只有 fetch 网络/超时失败才算不可达，任何 HTTP 响应都算已监听。 */
async function probeReachable(baseURL: string): Promise<boolean> {
    try {
        await fetch(baseURL, {signal: AbortSignal.timeout(5_000)});
        return true;
    } catch {
        return false;
    }
}

/** 一次解释请求的观测记录：只留 host 与 model，不留任何密钥或正文。 */
type ObservedRequest = {
    host: string;
    model: string | null;
};

const realProviders = loadRealProviders();

describe.skipIf(!realProviders)("真实模型：辅助任务指定模型（解释这一步）", () => {
    const observed: ObservedRequest[] = [];
    const workspaceRoot = join(
        resolveAgentTempRoot(),
        "auxiliary-model",
        new Date().toISOString().replace(/[:.]/g, "-"),
    );
    let harness: NeuroAgentHarness | null = null;
    let sessionId = 0;
    let fetchSpy: {mockRestore: () => void} | null = null;
    let reachable = false;

    beforeAll(async () => {
        const providers = realProviders!;
        reachable = await probeReachable(providers.deepseek.options.baseURL)
            && await probeReachable(providers.openrouter.options.baseURL);
        if (!reachable) return;

        // 观测层：包装 globalThis.fetch，记录后透传给原 fetch（真发请求）。
        const originalFetch = globalThis.fetch;
        fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((async (
            input: RequestInfo | URL,
            init?: RequestInit,
        ) => {
            observed.push({host: requestHost(input), model: requestBodyModel(input, init)});
            return originalFetch(input, init);
        }) as typeof globalThis.fetch);

        await mkdir(workspaceRoot, {recursive: true});
        await writeIsolatedConfig(providers, null);
        await prepareAgentSmokeWorkspace(workspaceRoot);
        harness = new NeuroAgentHarness({
            repo: new JsonlSessionRepository(workspaceRoot),
            definitionArtifactPathContextResolver: createVariableDefinitionArtifactPathContextResolver(APPLICATION_ROOT),
        });
        const agent = await harness.createAgent({profileKey: PROFILE_KEY, initial: {role: "smoke"}});
        sessionId = agent.sessionId;
    });

    afterAll(async () => {
        try {
            fetchSpy?.mockRestore();
        } finally {
            try {
                await harness?.dispose();
            } finally {
                await rm(workspaceRoot, {recursive: true, force: true});
            }
        }
    });

    /**
     * 只计一次解释调用：清空观测、刷新运行配置、真实调用 explainToolCall。
     *
     * 只打印观测到的 host 与 model（公开事实），不打印任何密钥或配置正文。
     */
    async function explainOnce(label: string, auxiliaryModelKey: string | null): Promise<{explanation: string; hits: ObservedRequest[]}> {
        observed.length = 0;
        await writeIsolatedConfig(realProviders!, auxiliaryModelKey);
        await prepareAgentSmokeWorkspace(workspaceRoot);
        const result = await harness!.explainToolCall(sessionId, {
            toolName: "file.read",
            argsText: JSON.stringify({path: "chapters/001.md"}),
            resultText: "读取成功，返回 42 行正文。",
            locale: "zh-CN",
        });
        const hits = [...observed];
        console.info(`[auxiliary-model] ${label}: requests=${String(hits.length)} ${JSON.stringify(hits)}`);
        return {explanation: result.explanation, hits};
    }

    it("指定 auxiliary.modelKey 时，解释请求打到该模型所属 Provider", async (context) => {
        if (!reachable) context.skip("deepseek 或 openrouter 不可达；本轮未观测");

        const {explanation, hits} = await explainOnce("experiment", AUXILIARY_MODEL_KEY);

        expect(explanation.trim().length).toBeGreaterThan(0);
        expect(hits.length).toBeGreaterThan(0);
        const last = hits.at(-1)!;
        expect(last.host).toBe(AUXILIARY_HOST);
        expect(last.model).toBe(AUXILIARY_MODEL_ID);
    }, 120_000);

    it("未配置 auxiliary 时，解释请求跟随 Profile 模型", async (context) => {
        if (!reachable) context.skip("deepseek 或 openrouter 不可达；本轮未观测");

        const {explanation, hits} = await explainOnce("control", null);

        expect(explanation.trim().length).toBeGreaterThan(0);
        expect(hits.length).toBeGreaterThan(0);
        const last = hits.at(-1)!;
        expect(last.host).toBe(PROFILE_HOST);
        expect(last.model).toBe(PROFILE_MODEL_ID);
    }, 120_000);
});

/** 请求 URL 的 host；解析失败时记为 `(unparsable)`，避免观测层自身抛错影响真实调用。 */
function requestHost(input: RequestInfo | URL): string {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    try {
        return new URL(url).host;
    } catch {
        return "(unparsable)";
    }
}

/** 从请求体里取 `model` 字段；取不到时返回 null（观测精度只到「本次请求没有可读的 model」）。 */
function requestBodyModel(input: RequestInfo | URL, init?: RequestInit): string | null {
    const body = init?.body
        ?? (typeof input === "object" && !(input instanceof URL) ? (input as Request).body : null);
    if (typeof body === "string") return parseModel(body);
    if (body instanceof Uint8Array) return parseModel(new TextDecoder().decode(body));
    if (body instanceof ArrayBuffer) return parseModel(new TextDecoder().decode(new Uint8Array(body)));
    return null;
}

function parseModel(text: string): string | null {
    try {
        const parsed = JSON.parse(text) as {model?: unknown};
        return typeof parsed.model === "string" ? parsed.model : null;
    } catch {
        return null;
    }
}
