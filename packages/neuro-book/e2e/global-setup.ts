import {chromium, type ConsoleMessage, type Page} from "@playwright/test";
import {E2E_BASE_URL, E2E_EMPTY_BASE_URL, E2E_PROJECT_ROOT} from "./e2e-env";

/** Dev server（Vite）首次编译时会出现 504「Outdated Optimize Dep」与随之而来的动态导入失败。 */
const TRANSIENT_DEV_ERROR = /504|Outdated Optimize Dep|Failed to fetch dynamically imported module|ERR_ABORTED/i;

/**
 * 预热**每个**隔离根的 Dev Server。
 *
 * 为什么需要单独一步：应用是 Vite Dev 模式（按需编译 + 依赖预构建），第一次真正加载页面时
 * 常常先返回 504「Outdated Optimize Dep」，页面要重载一次才会稳定。这些瞬时错误会被
 * `consoleGuard` 如实记为 console.error，让用例「假红」。这里在用例之前先把页面加载到干净为止，
 * 之后的用例就不再受预热噪声影响——**注意这是把预热与断言分离，不是放宽断言**。
 *
 * 两个隔离根（seed 3400 / empty 3401）各有各的 Vite 实例与依赖预构建缓存，必须**分别**预热；
 * 少预热一个，落在它上面的用例就会首载吃 504。
 *
 * 为什么还要预热「重」界面：只预热 `/`（书架）只能让书架路由的依赖进入预构建缓存；而
 * **按路由懒加载**的界面（剧情定位视图 `@vue-flow/*`、剧本工作台、正文编辑器等）的依赖
 * 会在**用例窗口内**才第一次被请求，触发一次 optimizer 重打包。实测这会带来两个后果：
 *   1) 紧随其后的用例首屏出现量级尖峰（perf 基线用例首轮首屏 8.2s vs 稳态 ~1.7s）；
 *   2) 该重打包会让**另一个** dev server 的模块图失效并重启，落在它上面的用例偶发 503 假红
 *      （实测：主根在 04 用例里首次优化 `@vue-flow/*` 后，空根在 05 用例首载时短暂 503 而失败）。
 * 在更慢的 CI 机器上这不稳定源只会更频繁。于是这里在用例之前，把「重」界面也真实加载一遍，
 * 让预构建在**测量/用例窗口之前**完成。
 *
 * 做法（**只动 e2e 预热，不动产品配置**）：见 `HEAVY_ROUTES` + 种子根的 `warmSeedProject`。
 * 刻意**不**改 `nuxt.config.ts`：`optimizeDeps.include` 里虽已列了 `@vue-flow/*` 等，但实测
 * 这些包仍会在用例窗口内才被优化（include 并未让它们在启动期真正预构建），所以「真正加载一次
 * 懒加载界面」才是可靠手段；而把依赖清单或 include 逻辑搬进产品 dev 配置，会改变**日常开发**
 * 的启动行为、还需长期维护清单、并可能掩盖真正的懒加载退化——测试专属预热属于测试基建，
 * 不该让产品配置为测试买单。
 */

/**
 * 需要提前加载的**预览路由**（与应用项目数据无关，两个隔离根都能跑）。
 * - `/plot.preview`：剧情定位视图 → 懒加载 `@vue-flow/*`（实测的重打包来源）。
 * - `/plot-workbench.preview`：剧本工作台 → 承诺账本 / 关键帧等重面板。
 */
const HEAVY_ROUTES = ["/plot.preview", "/plot-workbench.preview"] as const;

/**
 * 加载「重」界面，把懒加载依赖的预构建在用例窗口之前逼出来。
 *
 * 最佳努力：界面/选择器若与预期不符，本函数静默跳过（`catch`），**绝不**因此让预热判定失败——
 * 真正驱动「是否收敛」的仍是调用方的瞬时 504 判定。
 *
 * @param page 预热页。
 * @param baseURL 隔离根基址。
 * @param warmSeedProject 是否额外打开**种子项目**并打开首个文件（只有种子根有可打开的项目；
 *   这一步覆盖「工作区 / 正文编辑器」的真实加载路径）。
 */
async function warmHeavySurfaces(page: Page, baseURL: string, warmSeedProject: boolean): Promise<void> {
    for (const route of HEAVY_ROUTES) {
        await page.goto(`${baseURL}${route}`, {waitUntil: "domcontentloaded", timeout: 120_000});
        await page.locator(".nb-boot").waitFor({state: "detached", timeout: 180_000}).catch(() => undefined);
        await page.waitForTimeout(600);
    }

    if (!warmSeedProject) {
        return;
    }

    // 打开种子项目（工作区 / 文件树 / 编辑器所在 chunk 与依赖）。
    await page.goto(`${E2E_BASE_URL}/?project=${E2E_PROJECT_ROOT}`, {waitUntil: "domcontentloaded", timeout: 120_000});
    await page.locator(".nb-boot").waitFor({state: "detached", timeout: 180_000}).catch(() => undefined);
    await page.locator('[data-role="workspace-file-tree-root"]').waitFor({state: "visible", timeout: 60_000}).catch(() => undefined);

    // 打开首个文件 → 触发 Markdown 编辑器（Tiptap 等）依赖。
    const firstRow = page
        .locator('[data-role="workspace-file-tree-root"] [data-role="workspace-file-row"]')
        .first();
    if (await firstRow.count() > 0) {
        await firstRow.click().catch(() => undefined);
        await page.locator(".nb-markdown-editor").first().waitFor({state: "visible", timeout: 60_000}).catch(() => undefined);
    }
}

/**
 * @param baseURL 隔离根基址。
 * @param warmSeedProject 是否额外预热种子项目。**仅种子根**可用：空根刻意不播种，
 *   没有可打开的项目；而为了预热去空根建一个项目，会破坏「空态即演示」用例赖以成立的真实空态。
 *   预览路由（`HEAVY_ROUTES`）两个根都会预热。
 */
async function warmServer(baseURL: string, warmSeedProject: boolean): Promise<boolean> {
    const browser = await chromium.launch();

    try {
        let warm = false;
        for (let attempt = 0; attempt < 8 && !warm; attempt += 1) {
            // 每个尝试用一个**全新上下文**：重界面预热会写入 localStorage（如 activeLeftTab），
            // 复用上下文会让下一次尝试从「剧情」面板起、文件树不出现，削弱预热覆盖面。
            const context = await browser.newContext();
            const page = await context.newPage();
            const errors: string[] = [];
            const onConsole = (message: ConsoleMessage): void => {
                if (message.type() === "error") errors.push(message.text());
            };
            const onPageError = (error: Error): void => {
                errors.push(String(error));
            };
            page.on("console", onConsole);
            page.on("pageerror", onPageError);
            try {
                await page.goto(`${baseURL}/`, {waitUntil: "domcontentloaded", timeout: 120_000});
                // 启动遮罩消失 = 应用真正挂载完成（首次编译可能要几十秒）。
                await page.locator(".nb-boot").waitFor({state: "detached", timeout: 180_000}).catch(() => undefined);
                await page.waitForTimeout(1_500);
                await warmHeavySurfaces(page, baseURL, warmSeedProject).catch(() => undefined);
                warm = !errors.some((text) => TRANSIENT_DEV_ERROR.test(text));
            } catch {
                warm = false;
            } finally {
                page.off("console", onConsole);
                page.off("pageerror", onPageError);
                await page.close();
                await context.close();
            }
        }
        return warm;
    } finally {
        await browser.close();
    }
}

export default async function globalSetup(): Promise<void> {
    for (const baseURL of [E2E_BASE_URL, E2E_EMPTY_BASE_URL]) {
        const warm = await warmServer(baseURL, baseURL === E2E_BASE_URL);
        if (!warm) {
            // 预热没收敛不阻断（用例自己会如实报红），但要留下可诊断的痕迹。
            process.stderr.write(`[e2e] 预热未收敛（${baseURL}）：页面仍报 Dev Server 瞬时错误，用例结果可能受影响。\n`);
        }
    }
}
