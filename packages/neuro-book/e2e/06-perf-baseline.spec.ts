import {writeFileSync} from "node:fs";
import type {Page} from "@playwright/test";
import {E2E_PROJECT_ROOT, E2E_PROJECT_TITLE, E2E_STATE_ROOT} from "./e2e-env";
import {expect, test} from "./fixtures";

/**
 * 主链路⑥：性能基线测量（体检报告「行动 14」的可落地部分）。
 *
 * 目标：把「体验变慢」从「既发现不了也证明不了」变成「有数字可比」。
 *
 * 刻意**不做硬阈值门禁**：性能数字在 CI 上波动大，设阈值只会制造一条随机红的门禁，
 * 污染「红灯 = 真问题」的语义。本用例只**测出来 + 记录成基线**——每项连跑 3 次给出
 * 最快/最慢范围，结果既 `console.log`（结构化单行）也落盘 JSON（Playwright 输出目录，gitignored）。
 * 「要不要设阈值」留给开发者拍板。
 *
 * 口径（如实，不为数字好看放宽）：
 * - 「首屏可交互」= 书架首屏的**项目卡片已可见且 enabled**（不是「页面出现了任何东西」）。
 * - 「进项目到编辑器可用」= 导航到 `?project=` 起，到编辑器 `contenteditable` 可输入为止；
 *   其中「打开种子章节」是必经步骤，故同时给出 navToFileTree / treeToEditor 两个分量。
 * - 「输入延迟」= 真正敲键 → 文本出现在 DOM（`innerText` 命中），含 Playwright 派发开销。
 * - 「工作台渲染」= 点击「进入剧本工作台」→ 承诺账本容器可见为止。
 *
 * 测量环境（见报告正文，数字离开这个环境没有意义）：
 * - 应用是 **Vite / Nuxt Dev（Source Dev）**，不是安装包/生产构建；数字偏慢属预期。
 * - Dev Server 已在 `global-setup.ts` **预热**（消掉首载 504），故首次重复项不包含冷启动。
 * - 每个用例一个**全新浏览器上下文**（无持久缓存）；`workers: 1`、`fullyParallel: false`。
 * - 每次文档导航前清空 localStorage/sessionStorage，消除跨轮持久化偏好（如活动左标签）对测量的干扰。
 * - 隔离 State Root + 本地 Mock LLM，端口 3400，绝不触碰真实数据。
 * - 浏览器：Playwright 自带 chromium（Desktop Chrome 设备档）。
 */

/** 编辑器 contenteditable 选择器（与 01-editor 同口径：Tiptap 挂载即代表富文本可用）。 */
const EDITOR_SELECTOR = ".nb-markdown-editor[contenteditable='true'], .nb-markdown-editor [contenteditable='true']";
/** 文件面板搜索框占位（工作区就绪后的稳定入口）。 */
const FILE_SEARCH_PLACEHOLDER = "搜索文件、类型、摘要...";
/** 种子项目里的示范章节（与 01-editor 一致：按标题筛，避免命中提到路径的说明文档）。 */
const SEEDED_CHAPTER_SEARCH = "001-chapter";
const SEEDED_CHAPTER_TITLE = "示范章节";
/**
 * 输入延迟探针的首字符，逐个重复用**不同大写字母**：避免后一次的首字符在前一次正文里已存在，
 * 导致「首字符已出现」被误判为 0ms。大写字母在种子中文正文里不会出现。
 */
const FIRST_CHAR_BY_RUN = ["Q", "R", "S"] as const;
/** 连跑次数：给「最快 / 最慢」范围。 */
const REPEATS = 3;

/** 读页面内 `performance.now()`（相对本文档导航起点，单位 ms）。 */
async function pageNow(page: Page): Promise<number> {
    return await page.evaluate(() => performance.now());
}

/** 毫秒取 0.1ms 精度，避免浮点噪声。 */
function round(value: number): number {
    return Math.round(value * 10) / 10;
}

/** 等待书架首屏「可交互」：项目卡片可见且 enabled。 */
async function waitForShelfInteractive(page: Page): Promise<void> {
    await expect(page.getByRole("heading", {name: "我的书架"})).toBeVisible({timeout: 60_000});
    const card = page.locator('article button[aria-label^="打开《"]').first();
    await expect(card).toBeVisible({timeout: 60_000});
    await expect(card).toBeEnabled();
}

/** 打开种子项目，并等到工作区文件树就绪（与 fixtures.openE2eProject 同口径）。 */
async function openSeededProject(page: Page): Promise<void> {
    await page.goto(`/?project=${E2E_PROJECT_ROOT}`, {waitUntil: "domcontentloaded"});
    await page.locator(".nb-boot").waitFor({state: "detached", timeout: 120_000});
    await page.locator('[data-role="workspace-file-tree-root"]').waitFor({state: "visible", timeout: 60_000});
}

/** 打开种子章节并等到编辑器 contenteditable 可输入。 */
async function openSeededChapter(page: Page): Promise<void> {
    await page.getByPlaceholder(FILE_SEARCH_PLACEHOLDER).fill(SEEDED_CHAPTER_SEARCH);
    const chapterRow = page
        .locator('[data-role="workspace-file-tree-root"] [data-role="workspace-file-row"]')
        .filter({hasText: SEEDED_CHAPTER_TITLE})
        .first();
    await expect(chapterRow).toBeVisible({timeout: 30_000});
    await chapterRow.click();
    await page.locator(EDITOR_SELECTOR).first().waitFor({state: "visible", timeout: 30_000});
}

/**
 * 输入延迟：聚焦编辑器末尾 → 敲首字符 → 等它出现在 DOM → 敲其余 → 等整段出现。
 * 用 `waitForFunction`（`polling: "raf"`，约 16ms 精度）在页面内判定，比 `expect.poll` 的固定
 * 间隔更接近真实；时间戳取测试进程侧单调时钟，含 Playwright 派发/IPC 开销（如实计入）。
 */
async function measureInputLatency(page: Page, runIndex: number): Promise<{firstCharMs: number; fullStringMs: number; chars: number}> {
    const editor = page.locator(EDITOR_SELECTOR).first();
    await editor.click();
    await page.keyboard.press("Control+End");

    const firstChar = FIRST_CHAR_BY_RUN[runIndex] ?? "Z";
    const probe = `${firstChar}PERF-${String(runIndex)}-${Date.now().toString(36)}-abcdefghij`;
    const hasText = async (needle: string): Promise<void> => {
        await page.waitForFunction(
            ([selector, text]: [string, string]) => ((document.querySelector(selector) as HTMLElement | null)?.innerText ?? "").includes(text),
            [EDITOR_SELECTOR, needle] as [string, string],
            {polling: "raf", timeout: 15_000},
        );
    };

    const startedAt = performance.now();
    await page.keyboard.type(firstChar);
    await hasText(firstChar);
    const firstCharMs = performance.now() - startedAt;
    await page.keyboard.type(probe.slice(1));
    await hasText(probe);
    const fullStringMs = performance.now() - startedAt;

    return {firstCharMs: round(firstCharMs), fullStringMs: round(fullStringMs), chars: probe.length};
}

/**
 * 工作台渲染：点「进入剧本工作台」→ 承诺账本容器（`plot-promise-ledger`）可见。
 * 前提：应用已加载、工作区就绪（调用方保证）。承诺账本容器对空账本也渲染，故无需种子数据。
 */
async function measureWorkbenchRender(page: Page): Promise<number> {
    await page.locator('[data-activity-id="plot"]').click();
    const workbenchEntry = page.locator('[data-testid="plot-panel-workbench-entry"]');
    await expect(workbenchEntry).toBeVisible({timeout: 30_000});

    const startedAt = performance.now();
    await workbenchEntry.click();
    await expect(page.locator('[data-testid="plot-promise-ledger"]')).toBeVisible({timeout: 30_000});
    return round(performance.now() - startedAt);
}

/** 汇总一组重复测量：保留原始 runs，并给最快 / 最慢 / 中位数。 */
function summarize(runs: number[]): {runs: number[]; min: number; max: number; median: number} {
    const sorted = [...runs].sort((left, right) => left - right);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 === 0
        ? round(((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2)
        : (sorted[mid] ?? 0);
    return {runs, min: sorted[0] ?? 0, max: sorted[sorted.length - 1] ?? 0, median};
}

test("主链路⑥：性能基线——首屏 / 进项目到编辑器 / 输入延迟 / 工作台渲染", async ({page}, testInfo) => {
    // 9 次导航 + 交互，Dev 模式下可能上百秒，单独放宽本用例超时。
    test.setTimeout(600_000);

    // 每次文档导航前清空浏览器存储，令每一轮「进项目」都从**全新上下文**语义开始。
    // 必要性：Playwright 每个用例虽是新上下文（初始存储为空），但**同一用例内的多次导航共享
    // localStorage**；本用例第 4 项「工作台渲染」会点顶部「剧情」活动，把活动左标签
    // 持久化进 localStorage（`novel.ide.local` → `activeLeftTab="plot"`），从而污染下一轮
    // 「进项目」——工作区恢复到「剧情」面板而非默认「文件」面板，文件树根不出现。
    // 清空后每轮都与既有 `openE2eProject` 同口径（默认「文件」面板），保证三轮测量可比。
    await page.addInitScript(() => {
        try {
            window.localStorage.clear();
            window.sessionStorage.clear();
        } catch {
            // 存储不可用（如极端隐私策略）时忽略：默认左标签本就是「文件」，不影响口径。
        }
    });

    const firstPaintRuns: number[] = [];
    const navToFileTreeRuns: number[] = [];
    const navToEditorRuns: number[] = [];
    const firstCharRuns: number[] = [];
    const fullStringRuns: number[] = [];
    const workbenchRuns: number[] = [];
    let probeChars = 0;

    for (let runIndex = 0; runIndex < REPEATS; runIndex += 1) {
        // ── 指标 1：首屏可交互 ──
        await page.goto("/", {waitUntil: "domcontentloaded"});
        await waitForShelfInteractive(page);
        firstPaintRuns.push(round(await pageNow(page)));

        // ── 指标 2 + 3：进项目到编辑器可用，随后在同一编辑器测输入延迟 ──
        await openSeededProject(page);
        navToFileTreeRuns.push(round(await pageNow(page)));
        await openSeededChapter(page);
        navToEditorRuns.push(round(await pageNow(page)));

        const latency = await measureInputLatency(page, runIndex);
        firstCharRuns.push(latency.firstCharMs);
        fullStringRuns.push(latency.fullStringMs);
        probeChars = latency.chars;

        // ── 指标 4：工作台渲染（重新进入项目，保证工作区干净就绪）──
        await openSeededProject(page);
        workbenchRuns.push(await measureWorkbenchRender(page));
    }

    const treeToEditorRuns = navToEditorRuns.map((value, index) => round(value - (navToFileTreeRuns[index] ?? 0)));

    const result = {
        generatedAt: new Date().toISOString(),
        environment: {
            appMode: "vite-nuxt-dev (Source Dev)",
            productionBuild: false,
            devServerPreWarmed: true,
            baseUrl: new URL(page.url()).origin,
            projectName: testInfo.project.name,
            browserName: testInfo.project.use.browserName ?? "chromium",
            viewport: page.viewportSize(),
            workers: 1,
            fullyParallel: false,
            freshContextPerTest: true,
            mockLlm: true,
            isolatedStateRoot: E2E_STATE_ROOT,
            seededProject: {projectRoot: E2E_PROJECT_ROOT, title: E2E_PROJECT_TITLE},
            repeats: REPEATS,
        },
        metrics: {
            firstPaintInteractiveMs: summarize(firstPaintRuns),
            projectToEditorMs: {
                navToFileTree: summarize(navToFileTreeRuns),
                treeToEditor: summarize(treeToEditorRuns),
                navToEditor: summarize(navToEditorRuns),
            },
            inputLatencyMs: {
                firstChar: summarize(firstCharRuns),
                fullString: summarize(fullStringRuns),
                probeChars,
            },
            workbenchRenderMs: summarize(workbenchRuns),
        },
    };

    const outputPath = testInfo.outputPath("perf-baseline.json");
    writeFileSync(outputPath, JSON.stringify(result, null, 2), "utf8");
    // 结构化单行：便于在 CI 日志里直接比对，不依赖打开 JSON。
    console.log(`[perf-baseline] ${JSON.stringify(result)}`);
    console.log(`[perf-baseline] written: ${outputPath}`);

    // 不做阈值门禁：只断言测量确实成功完成（每项都拿到 3 个有限正数）。
    for (const [name, runs] of Object.entries({
        firstPaintInteractiveMs: firstPaintRuns,
        navToFileTree: navToFileTreeRuns,
        navToEditor: navToEditorRuns,
        inputFirstChar: firstCharRuns,
        inputFullString: fullStringRuns,
        workbenchRenderMs: workbenchRuns,
    })) {
        expect(runs, `${name} 应完成 ${String(REPEATS)} 次测量`).toHaveLength(REPEATS);
        for (const value of runs) {
            expect(Number.isFinite(value) && value >= 0, `${name} 的测量值应为有限非负数，实际 ${String(value)}`).toBe(true);
        }
    }
});
