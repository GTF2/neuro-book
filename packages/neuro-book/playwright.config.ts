import {defineConfig, devices} from "@playwright/test";
import {E2E_BASE_URL, E2E_EMPTY_BASE_URL, E2E_EMPTY_PORT, E2E_HOST, E2E_PORT} from "./e2e/e2e-env";

/**
 * 主应用 E2E 冒烟配置。
 *
 * 与 packages/nb-ui 的配置保持同一约定：`bun` 下直接跑 playwright 会 CDP 握手超时，
 * 因此 `test:e2e` 走 `.bin` shim（由 Node 执行 playwright CLI），配置里不写死包内 node_modules。
 *
 * 隔离（红线）：每个 webServer 由 `e2e/serve-e2e.ts` 负责「清空并重建临时 State Root →（主根）播种项目 →
 * 起应用」，并用独立端口与本地 Mock LLM，绝不触碰本机真实 State Root。
 *
 * 两个隔离根（为什么需要）：
 * - `chromium`（端口 3400，`serve-e2e.ts` 默认 `seed` 模式）跑 01~04 主链路，书架里有播种项目 `e2e-smoke`。
 * - `chromium-empty`（端口 3401，`NEURO_BOOK_E2E_SERVE_MODE=empty`，**从不播种**）只跑 05「空态即演示」用例。
 *
 * 「空态即演示」用例要看到「一本书都没有」的真实空态，而它绝不能靠删除主根里的项目来制造空态：
 * 实测（Windows + Bun dev server）删除一个「本进程内被打开/写过」的项目会因目录句柄未释放而 500
 * （PROJECT_PUBLISH_FAILED / operation=delete / phase=publish-root）——这正是「单跑通过 ≠ 整套通过」
 * 的顺序依赖。改用第二个「从不播种」的根后，空态由**构造**保证，与前面用例留下什么彻底无关，
 * 干净环境跑整套也成立。
 */

/** 应用首启要装依赖、跑迁移、编译 Nitro（首次实测十几到几十秒），给足 5 分钟。 */
const WEB_SERVER_TIMEOUT_MS = 300_000;

export default defineConfig({
    testDir: "./e2e",
    timeout: 120_000,
    expect: {timeout: 20_000},
    retries: 0,
    workers: 1,
    fullyParallel: false,
    reporter: [["list"]],
    // 预热 Dev Server（消除 Vite 首载 504 噪声）→ 用例 → 清理隔离根。
    globalSetup: "./e2e/global-setup.ts",
    globalTeardown: "./e2e/global-teardown.ts",
    use: {
        baseURL: E2E_BASE_URL,
        // 只对首次 CDP 连接与导航放宽；断言仍受 expect.timeout 约束。
        actionTimeout: 30_000,
        navigationTimeout: 60_000,
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
        video: "off",
    },
    projects: [
        {
            name: "chromium",
            // 主根（有播种项目）只跑 01~04；05 需要空态，交给下面的 chromium-empty。
            testIgnore: /05-sample-book\.spec\.ts$/u,
            use: {...devices["Desktop Chrome"], baseURL: E2E_BASE_URL},
        },
        {
            name: "chromium-empty",
            // 空根（从不播种）只跑 05；baseURL 指向空根端口，页面与 request API 都打到空书架。
            testMatch: /05-sample-book\.spec\.ts$/u,
            use: {...devices["Desktop Chrome"], baseURL: E2E_EMPTY_BASE_URL},
        },
    ],
    webServer: [
        {
            command: "bun e2e/serve-e2e.ts",
            url: `http://${E2E_HOST}:${E2E_PORT}/api/auth/me`,
            timeout: WEB_SERVER_TIMEOUT_MS,
            reuseExistingServer: false,
            stdout: "pipe",
            stderr: "pipe",
        },
        {
            command: "bun e2e/serve-e2e.ts",
            // `empty` 模式：用第二个隔离根、独立端口，且**不播种**，保证书架初始为空。
            env: {NEURO_BOOK_E2E_SERVE_MODE: "empty"},
            url: `http://${E2E_HOST}:${E2E_EMPTY_PORT}/api/auth/me`,
            timeout: WEB_SERVER_TIMEOUT_MS,
            reuseExistingServer: false,
            stdout: "pipe",
            stderr: "pipe",
        },
    ],
});
