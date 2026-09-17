import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {expect, test} from "./fixtures";

/** 示例书资产 manifest（示例工程根、伏笔等元数据的唯一真相源）。 */
const SAMPLE_BOOK_MANIFEST_FILE = fileURLToPath(
    new URL("../assets/workspace/.nbook/templates/sample-book/manifest.json", import.meta.url),
);
const SAMPLE_BOOK_MANIFEST = JSON.parse(readFileSync(SAMPLE_BOOK_MANIFEST_FILE, "utf8")) as {
    projectRoot: string;
    promise: {title: string};
};
const SAMPLE_BOOK_PROJECT_ROOT = SAMPLE_BOOK_MANIFEST.projectRoot;

/**
 * 主链路⑤：新用户的「第一印象」——空态即演示。
 *
 * 一次跑通整条能力可见链路：
 *   空态出现「打开示例书」→ 点开示例工程
 *   → 剧本工作台默认 tab「承诺账本」里躺着 1 个**未兑现伏笔**
 *   → 打开第 3 章 → 工具栏「扫 AI 味」扫出 ≥5 处命中。
 *
 * 独立性与顺序（重要）：本用例要看到「零项目空态」，但**不靠删除制造空态**——
 * 它跑在第二个**从不播种**的隔离根上（见 `playwright.config.ts` 的 `chromium-empty` 项目，
 * baseURL 指向 `E2E_EMPTY_BASE_URL`）。空态由**构造**保证：那个根启动时就是空书架，
 * 与 01~04 在**另一个**根上留下什么彻底无关。因此本用例可单跑、可整套跑、可倒序跑，
 * 结果都一样——不依赖「前一条用例留下了什么」。
 *
 * 为什么不删项目：实测（Windows + Bun dev server）删除一个「本进程内被打开/写过」的项目会因
 * 目录句柄未释放而 500（PROJECT_PUBLISH_FAILED / operation=delete / phase=publish-root）。
 * 主根里 01~03 会打开并写入 `e2e-smoke`，于是「先清空书架」的写法在整套里必红、单跑却绿——
 * 这就是「测试隔离不彻底」。改用第二个空根后该隐患从根上消失。
 */

/** 空态入口按钮文案（zh-CN）。 */
const SAMPLE_BOOK_ENTRY = "打开示例书";
/** 第 3 章相对项目根的路径（示例书里刻意留了 AI 味的那一章）。 */
const CHAPTER_THREE_RELATIVE = "manuscript/001-volume/003-chapter/index.md";
/** 第 3 章的标题（文件树搜索后按标题定位行，避免命中正文里提到路径的说明文档）。 */
const CHAPTER_THREE_TITLE = "第三章 回声";
/** 示例书里埋下的未兑现伏笔标题（取自 manifest，避免与资产漂移）。 */
const PROMISE_TITLE = SAMPLE_BOOK_MANIFEST.promise.title;

test("主链路⑤：空态即演示——打开示例书，承诺账本有未兑现伏笔，扫 AI 味 ≥5", async ({page, request}) => {
    // 1) 前置自证：本用例跑在空根上，书架**天然为空**，无需任何清理动作。
    //    断言「还没开始点，书架上就已经没有项目」，把「空态前提」本身也纳入用例的自证范围。
    await test.step("前置：本根书架为空（空态由构造保证，不做删除）", async () => {
        const listResponse = await request.get("/api/projects");
        expect(listResponse.ok(), `读取书架失败：${listResponse.status()} ${await listResponse.text()}`).toBeTruthy();
        const snapshot = await listResponse.json() as {projects: Array<{projectRoot: string}>};
        expect(snapshot.projects.map((project) => project.projectRoot), "空根启动时书架应为空").toEqual([]);
    });

    // 2) 打开书架 → 应看到「还没有作品」空态与「打开示例书」入口。
    await test.step("书架空态露出示例书入口", async () => {
        await page.goto("/", {waitUntil: "domcontentloaded"});
        await expect(page.getByRole("heading", {name: "我的书架"})).toBeVisible({timeout: 60_000});
        await expect(page.getByRole("heading", {name: "还没有作品"})).toBeVisible();
        await expect(page.getByRole("button", {name: SAMPLE_BOOK_ENTRY})).toBeVisible();
    });

    // 3) 点「打开示例书」→ 应用创建并打开示例工程。
    await test.step("点击示例书入口，进入示例工程", async () => {
        await page.getByRole("button", {name: SAMPLE_BOOK_ENTRY}).click();
        await expect(page).toHaveURL(new RegExp(`project=${SAMPLE_BOOK_PROJECT_ROOT}`), {timeout: 60_000});
        // 工作区就绪：文件树根出现（说明示例工程真的被打开、正文已落盘可读）。
        await page.locator('[data-role="workspace-file-tree-root"]').waitFor({state: "visible", timeout: 60_000});
    });

    // 4) 承诺账本：打开剧本工作台（默认 tab 就是承诺账本）→ 伏笔可见。
    await test.step("承诺账本里能看到那 1 个未兑现伏笔", async () => {
        await page.locator('[data-activity-id="plot"]').click();
        const workbenchEntry = page.locator('[data-testid="plot-panel-workbench-entry"]');
        await expect(workbenchEntry).toBeVisible({timeout: 30_000});
        await workbenchEntry.click();

        const ledger = page.locator('[data-testid="plot-promise-ledger"]');
        await expect(ledger).toBeVisible({timeout: 30_000});
        // 账本头部会显示 / 承诺账本(N)，N 即账本里的承诺数——这里恰好是 1。
        await expect(ledger.getByText("承诺账本(1)")).toBeVisible({timeout: 30_000});
        await expect(ledger).toContainText(PROMISE_TITLE);
    });

    // 5) 收起工作台、把侧栏切回文件树——真实用户看完账本就会回到正文。
    await test.step("关闭工作台并回到文件树", async () => {
        await page.keyboard.press("Escape");
        await expect(page.locator('[data-testid="plot-promise-ledger"]')).toBeHidden({timeout: 15_000});
        await page.locator('[data-activity-id="files"]').click();
        await expect(page.getByPlaceholder("搜索文件、类型、摘要...")).toBeVisible({timeout: 30_000});
    });

    // 6) 扫 AI 味：打开第 3 章，工具栏入口跑真实 llmlint，逐条命中。
    await test.step("第 3 章扫 AI 味，真实命中 ≥5", async () => {
        await page.getByPlaceholder("搜索文件、类型、摘要...").fill("003-chapter");
        const chapterRow = page
            .locator('[data-role="workspace-file-tree-root"] [data-role="workspace-file-row"]')
            .filter({hasText: CHAPTER_THREE_TITLE})
            .first();
        await expect(chapterRow).toBeVisible({timeout: 30_000});
        await chapterRow.click();

        const lintEntry = page.locator('[data-role="prose-lint-entry"]');
        await expect(lintEntry).toBeVisible({timeout: 30_000});
        await lintEntry.click();

        const panel = page.locator('[data-role="prose-lint-panel"]');
        await expect(panel).toBeVisible({timeout: 30_000});
        // 面板逐条渲染命中：等真实扫描结果回来，断言 ≥5 条。
        await expect.poll(
            () => panel.locator("li").count(),
            {message: "第 3 章应扫出 ≥5 处 AI 味命中", timeout: 60_000},
        ).toBeGreaterThanOrEqual(5);
    });

    // 7) 同一接口的原始输出：直接断言服务端 summary.high ≥ 5（不依赖 UI 渲染细节）。
    await test.step("llmlint 接口原始输出：high ≥ 5", async () => {
        const response = await request.post("/api/workspace-files/llmlint-check", {
            data: {
                projectRoot: SAMPLE_BOOK_PROJECT_ROOT,
                path: CHAPTER_THREE_RELATIVE,
                review: "all",
                minLevel: "low",
            },
        });
        expect(response.ok()).toBeTruthy();
        const report = await response.json() as {summary: {total: number; high: number}};
        expect(report.summary.high).toBeGreaterThanOrEqual(5);
    });

    // 8) 剧情数据原始输出：伏笔真的落在项目库里（走正常剧情写入口，不是伪造文件）。
    await test.step("剧情接口原始输出：伏笔 open + 已埋设 + 有兑现期限", async () => {
        const listResponse = await request.get("/api/projects/plot/promises", {
            params: {projectRoot: SAMPLE_BOOK_PROJECT_ROOT},
        });
        expect(listResponse.ok()).toBeTruthy();
        const promises = await listResponse.json() as Array<{
            id: string;
            name: string;
            status: string;
            deadlineChapterId: string | null;
        }>;
        const planted = promises.find((promise) => promise.name === "p-rusty-gun");
        expect(planted, "示例书应写入名为 p-rusty-gun 的伏笔").toBeTruthy();
        expect(planted!.status).toBe("open");
        expect(planted!.deadlineChapterId).not.toBeNull();

        const detailResponse = await request.get(`/api/projects/plot/promises/${planted!.id}`, {
            params: {projectRoot: SAMPLE_BOOK_PROJECT_ROOT},
        });
        expect(detailResponse.ok()).toBeTruthy();
        const detail = await detailResponse.json() as {
            beats: Array<{kind: string}>;
            beatStats: {plant: number; payoff: number};
        };
        expect(detail.beats.some((beat) => beat.kind === "plant")).toBe(true);
        expect(detail.beatStats.plant).toBeGreaterThanOrEqual(1);
        // 未兑现：没有 payoff 节拍。
        expect(detail.beatStats.payoff).toBe(0);
    });
});
