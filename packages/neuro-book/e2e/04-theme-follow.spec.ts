import {expect, test, type Page} from "@playwright/test";
import {mkdirSync} from "node:fs";
import {resolve} from "node:path";
import type {StoryKeyframeDto} from "nbook/shared/dto/plot.dto";

/**
 * 主链路④（UI token 化护栏）：换主题 → 关键帧面板「完全跟随」。
 *
 * 为什么需要这条用例：UI token 化收敛的**唯一有效证据**是「换主题后这个页面完全跟随」，
 * 而不是「某处色值看起来像变量」。本用例把关键帧面板真正渲染出来，逐项读取它**实际渲染**出的
 * 颜色（状态 chip 的文字色、新建按钮的底色），与当前主题下同名主题变量的解析值逐一比对；
 * 再切到另一个主题，要求面板实际渲染出的颜色**全都跟着变**。任一处偷偷写死 hex，比对立刻红。
 *
 * 隔离：复用 `serve-e2e.ts` 的隔离 State Root 与独立端口，绝不触碰真实数据。
 * 面板本身是「自加载数据」（`/api/projects/plot/keyframes`），真实接口要求 projectRoot 是已就绪项目，
 * 而预览页用的是占位 projectRoot；因此在浏览器侧把这些接口桩掉，让面板渲染出覆盖全部色调的真实帧行。
 */

/** 证据落盘目录（仓库根 `deliverables/` 下，便于人眼复核）。 */
const OUT_DIR = resolve(import.meta.dirname, "../../../deliverables/theme-follow-token-pilot");

/**
 * 关键帧列表桩数据：刻意覆盖 4 种状态（待回撞/已确认/有冲突/已推翻）与 2 种来源（人声明/正文反推），
 * 从而把全部色调 chip（warning/success/danger/muted/info）都渲染出来。
 */
const STUB_KEYFRAMES: StoryKeyframeDto[] = [
    {
        id: "1",
        storyId: "1",
        sceneId: null,
        name: "k-necklace-taken",
        title: "项链易主",
        instant: "120",
        irreversibleChanges: ["项链从阿黎转到灰隼手里"],
        source: "author",
        status: "pending",
        decisionRefId: null,
        note: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
        id: "2",
        storyId: "1",
        sceneId: null,
        name: "k-system-awakened",
        title: "系统被激活",
        instant: "300",
        irreversibleChanges: ["系统能力首次可用"],
        source: "derived",
        status: "confirmed",
        decisionRefId: null,
        note: "正文反推得到。",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
        id: "3",
        storyId: "1",
        sceneId: null,
        name: "k-ritual-broken",
        title: "祭坛仪式被破坏",
        instant: "480",
        irreversibleChanges: ["祭坛封印失效", "邪教失去献祭媒介"],
        source: "author",
        status: "violated",
        decisionRefId: "12",
        note: "回撞发现与既定设定冲突。",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
        id: "4",
        storyId: "1",
        sceneId: null,
        name: "k-mentor-dead",
        title: "导师死亡",
        instant: "600",
        irreversibleChanges: ["导师退出后续所有场景"],
        source: "derived",
        status: "overthrown",
        decisionRefId: "9",
        note: "该帧已被裁决推翻。",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
    },
];

/**
 * 读取关键帧面板**实际渲染**出的颜色，以及当前主题同名变量的解析值（作为期望）。
 *
 * 变量的解析值用一个临时探针元素读回：把 `color: var(--token)` 写上去再取 computed，
 * 这样拿到的是浏览器真正解析后的 `rgb(...)`，与元素上 computed 出来的值同一口径，可直接比对。
 */
async function samplePanelColors(page: Page): Promise<Record<string, string>> {
    return await page.evaluate(() => {
        const host = document.querySelector(".novel-ide-theme");
        if (!(host instanceof HTMLElement)) {
            throw new Error("未找到 .novel-ide-theme 主题宿主");
        }

        const resolveToken = (token: string): string => {
            const probe = document.createElement("span");
            probe.style.color = `var(${token})`;
            host.appendChild(probe);
            const resolved = getComputedStyle(probe).color;
            probe.remove();
            return resolved;
        };

        const chipColor = (label: string): string => {
            const spans = Array.from(document.querySelectorAll<HTMLElement>('[data-testid="plot-keyframe-ledger"] span'));
            const chip = spans.find((span) => span.textContent?.trim() === label);
            if (!chip) {
                throw new Error(`关键帧面板中未找到「${label}」标签`);
            }
            return getComputedStyle(chip).color;
        };

        const createButton = document.querySelector<HTMLElement>('[data-testid="plot-keyframe-create"]');
        if (!createButton) {
            throw new Error("未找到关键帧面板的「新建帧」按钮");
        }

        return {
            pageRootBg: getComputedStyle(host).backgroundColor,
            createButtonBg: getComputedStyle(createButton).backgroundColor,
            chipWarning: chipColor("待回撞"),
            chipSuccess: chipColor("已确认"),
            chipDanger: chipColor("有冲突"),
            chipInfo: chipColor("人声明"),
            chipOverthrown: chipColor("已推翻"),
            tokenBgMain: resolveToken("--bg-main"),
            tokenBgInput: resolveToken("--bg-input"),
            tokenStatusWarning: resolveToken("--status-warning"),
            tokenStatusSuccess: resolveToken("--status-success"),
            tokenStatusDanger: resolveToken("--status-danger"),
            tokenStatusInfo: resolveToken("--status-info"),
            tokenTextMuted: resolveToken("--text-muted"),
        };
    });
}

/** 当前主题下，面板实际渲染出的每个色都必须等于同名主题变量的解析值（= 完全跟随主题）。 */
function assertPanelFollowsTokens(sample: Record<string, string>): void {
    expect(sample.pageRootBg, "页面根底色应取 --bg-main").toBe(sample.tokenBgMain);
    expect(sample.chipWarning, "「待回撞」chip 文字色应取 --status-warning").toBe(sample.tokenStatusWarning);
    expect(sample.chipSuccess, "「已确认」chip 文字色应取 --status-success").toBe(sample.tokenStatusSuccess);
    expect(sample.chipDanger, "「有冲突」chip 文字色应取 --status-danger").toBe(sample.tokenStatusDanger);
    expect(sample.chipInfo, "「人声明」chip 文字色应取 --status-info").toBe(sample.tokenStatusInfo);
    expect(sample.chipOverthrown, "「已推翻」chip 文字色应取 --text-muted").toBe(sample.tokenTextMuted);
    expect(sample.createButtonBg, "「新建帧」按钮底色应取 --bg-input").toBe(sample.tokenBgInput);
}

test.describe("主链路④：UI token 化护栏", () => {
    test.use({viewport: {width: 1440, height: 900}});

    test("换主题 → 关键帧面板完全跟随", async ({page}) => {
        await page.route("**/api/projects/plot/keyframes**", async (route) => {
            await route.fulfill({status: 200, contentType: "application/json", body: JSON.stringify(STUB_KEYFRAMES)});
        });
        await page.route("**/api/projects/plot/decisions**", async (route) => {
            await route.fulfill({status: 200, contentType: "application/json", body: "[]"});
        });

        await page.goto("/plot-workbench.preview", {waitUntil: "domcontentloaded"});
        await page.locator(".nb-boot").waitFor({state: "detached", timeout: 120_000}).catch(() => undefined);

        // 切到「关键帧」tab（预览页默认打开剧本工作台 Dialog）。
        const keyframeTab = page.getByRole("button", {name: "关键帧", exact: true});
        await keyframeTab.waitFor({state: "visible", timeout: 60_000});
        await keyframeTab.click();

        const ledger = page.locator('[data-testid="plot-keyframe-ledger"]');
        await expect(ledger).toBeVisible();
        await expect(page.locator('[data-testid^="plot-keyframe-row-"]')).toHaveCount(STUB_KEYFRAMES.length);

        mkdirSync(OUT_DIR, {recursive: true});

        // ── 主题 A：羊皮纸（sepia，预览页默认）──
        const sepia = await samplePanelColors(page);
        assertPanelFollowsTokens(sepia);

        await ledger.screenshot({path: resolve(OUT_DIR, "keyframe-sepia.png")});
        await page.screenshot({path: resolve(OUT_DIR, "keyframe-sepia-viewport.png")});

        // ── 切换主题 B：暗色 ──
        // 主题切换按钮在预览页头部，会被剧本工作台 Dialog 的遮罩层挡住；
        // 先用工作台头部自己的关闭按钮收起 Dialog，切完主题再重新打开——全程走应用自己的控件，不直接改 CSS 变量。
        const darkThemeButton = page.getByRole("button", {name: "暗色", exact: true});
        const reopenButton = page.getByRole("button", {name: "打开剧本工作台"});
        const workbenchCloseButton = page.locator('[data-dialog-surface] button:has(.i-lucide-x)').first();

        await workbenchCloseButton.click();
        await expect(page.locator('[data-testid="plot-keyframe-ledger"]')).toBeHidden();
        await expect(darkThemeButton).toBeVisible();
        await darkThemeButton.click();

        await reopenButton.click();
        await keyframeTab.click();
        await expect(ledger).toBeVisible();
        await expect(page.locator('[data-testid^="plot-keyframe-row-"]')).toHaveCount(STUB_KEYFRAMES.length);

        const dark = await samplePanelColors(page);
        assertPanelFollowsTokens(dark);

        await ledger.screenshot({path: resolve(OUT_DIR, "keyframe-dark.png")});
        await page.screenshot({path: resolve(OUT_DIR, "keyframe-dark-viewport.png")});

        // ── 跨主题：面板实际渲染出的每个色都必须跟着主题变 ──
        const followKeys = ["pageRootBg", "createButtonBg", "chipWarning", "chipSuccess", "chipDanger", "chipInfo", "chipOverthrown"] as const;
        for (const key of followKeys) {
            expect(dark[key], `${key} 在两个主题间应不同（证明完全跟随主题，而非写死）`).not.toBe(sepia[key]);
        }
    });

    /**
     * 存量收敛的运行时证据：剧情定位视图里那个「未分组线程」计数徽标，
     * 本轮把 `bg-black/5` 换成了 `bg-[var(--bg-subtle)]`；这里证明它换主题后跟着走。
     * `/plot.preview` 默认就是 locator 视图、且没有 Dialog 遮罩，主题按钮可直接点。
     */
    test("换主题 → 剧情定位视图计数徽标跟随（--bg-subtle）", async ({page}) => {
        await page.goto("/plot.preview", {waitUntil: "domcontentloaded"});
        await page.locator(".nb-boot").waitFor({state: "detached", timeout: 120_000}).catch(() => undefined);

        const badge = page.locator("button", {hasText: "未分组线程"}).locator("span.rounded-full").first();
        await expect(badge).toBeVisible();

        const readBadge = async (): Promise<{rendered: string; token: string}> =>
            await badge.evaluate((el) => {
                const host = el.closest(".novel-ide-theme") ?? document.querySelector(".novel-ide-theme");
                if (!(host instanceof HTMLElement)) {
                    throw new Error("未找到 .novel-ide-theme 主题宿主");
                }
                const probe = document.createElement("span");
                probe.style.color = "var(--bg-subtle)";
                host.appendChild(probe);
                const token = getComputedStyle(probe).color;
                probe.remove();
                return {rendered: getComputedStyle(el).backgroundColor, token};
            });

        const sepia = await readBadge();
        expect(sepia.rendered, "计数徽标底色应取 --bg-subtle").toBe(sepia.token);

        await page.getByRole("button", {name: "暗色", exact: true}).click();
        await expect.poll(async () => (await readBadge()).rendered, {message: "切到暗色后徽标底色应变化"}).not.toBe(sepia.rendered);

        const dark = await readBadge();
        expect(dark.rendered, "暗色下同样应取 --bg-subtle").toBe(dark.token);
        expect(dark.rendered).not.toBe(sepia.rendered);

        mkdirSync(OUT_DIR, {recursive: true});
        await page.screenshot({path: resolve(OUT_DIR, "plot-locator-dark-viewport.png")});
    });
});
