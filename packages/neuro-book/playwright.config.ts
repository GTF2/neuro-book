import {defineConfig, devices} from "@playwright/test";
import {E2E_BASE_URL, E2E_HOST, E2E_PORT} from "./e2e/e2e-env";

/**
 * 主应用 E2E 冒烟配置。
 *
 * 与 packages/nb-ui 的配置保持同一约定：`bun` 下直接跑 playwright 会 CDP 握手超时，
 * 因此 `test:e2e` 走 `.bin` shim（由 Node 执行 playwright CLI），配置里不写死包内 node_modules。
 *
 * 隔离（红线）：webServer 由 `e2e/serve-e2e.ts` 负责「清空并重建临时 State Root → 播种项目 →
 * 起应用」，并用独立端口与本地 Mock LLM，绝不触碰本机真实 State Root。
 */
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
    projects: [{name: "chromium", use: {...devices["Desktop Chrome"]}}],
    webServer: {
        command: "bun e2e/serve-e2e.ts",
        // 应用首启要装依赖、跑迁移、编译 Nitro（首次实测十几到几十秒），给足 5 分钟。
        url: `http://${E2E_HOST}:${E2E_PORT}/api/auth/me`,
        timeout: 300_000,
        reuseExistingServer: false,
        stdout: "pipe",
        stderr: "pipe",
    },
});
