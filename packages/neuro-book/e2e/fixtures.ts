import {test as base, expect, type Page} from "@playwright/test";
import {E2E_PROJECT_ROOT} from "./e2e-env";

/**
 * 全局 fixture：每个用例收集 `console.error` 与未捕获 `pageerror`，用例结束断言两者为空。
 *
 * 验收标准：控制台 error 与 pageerror 均为 0——这是「人写帧 UI 未经人眼确认」这类缺口
 * 最硬的兜底：只要主链路抛错或打出 console.error，冒烟就会红。`auto: true` 让每个用例
 * 默认生效，用例无需显式声明。
 *
 * 注意：Dev Server 首载的 Vite 504 噪声已在 `global-setup.ts` 预热阶段消化，
 * 不在这里放宽断言——预热与断言分离，不是降低标准。
 */
export const test = base.extend<{ consoleGuard: void }>({
    consoleGuard: [
        async ({page}, use) => {
            const consoleErrors: string[] = [];
            const pageErrors: string[] = [];
            page.on("console", (msg) => {
                if (msg.type() === "error") consoleErrors.push(msg.text());
            });
            page.on("pageerror", (err) => pageErrors.push(String(err)));
            await use();
            expect(consoleErrors, "console.error 应为 0").toEqual([]);
            expect(pageErrors, "pageerror 应为 0").toEqual([]);
        },
        {auto: true},
    ],
});

/**
 * 直接进入隔离种子项目的编辑器工作台，并等待应用真正挂载完成。
 *
 * `?project=` 让应用跳过书架选择直达工作台；等待分两层：启动遮罩消失（应用挂载）
 * → 文件树根出现（工作区数据就绪）。两层都等到，后续断言才有意义。
 */
export async function openE2eProject(page: Page): Promise<void> {
    await page.goto(`/?project=${E2E_PROJECT_ROOT}`, {waitUntil: "domcontentloaded"});
    await page.locator(".nb-boot").waitFor({state: "detached", timeout: 120_000});
    await page.locator('[data-role="workspace-file-tree-root"]').waitFor({state: "visible", timeout: 60_000});
}

export {expect};
