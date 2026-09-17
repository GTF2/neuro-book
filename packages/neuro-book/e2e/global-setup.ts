import {chromium, type ConsoleMessage} from "@playwright/test";
import {E2E_BASE_URL, E2E_EMPTY_BASE_URL} from "./e2e-env";

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
 */
async function warmServer(baseURL: string): Promise<boolean> {
    const browser = await chromium.launch();
    const context = await browser.newContext();

    try {
        let warm = false;
        for (let attempt = 0; attempt < 8 && !warm; attempt += 1) {
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
                warm = !errors.some((text) => TRANSIENT_DEV_ERROR.test(text));
            } catch {
                warm = false;
            } finally {
                page.off("console", onConsole);
                page.off("pageerror", onPageError);
                await page.close();
            }
        }
        return warm;
    } finally {
        await context.close();
        await browser.close();
    }
}

export default async function globalSetup(): Promise<void> {
    for (const baseURL of [E2E_BASE_URL, E2E_EMPTY_BASE_URL]) {
        const warm = await warmServer(baseURL);
        if (!warm) {
            // 预热没收敛不阻断（用例自己会如实报红），但要留下可诊断的痕迹。
            process.stderr.write(`[e2e] 预热未收敛（${baseURL}）：页面仍报 Dev Server 瞬时错误，用例结果可能受影响。\n`);
        }
    }
}
