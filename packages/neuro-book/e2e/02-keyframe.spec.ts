import {expect, openE2eProject, test} from "./fixtures";

/**
 * 主链路②：剧情面板 → 剧本工作台 → tab 切换 → 新建一个关键帧。
 *
 * 为什么这条最有价值：「关键帧面板」此前只有单元/接口测试，UI 从来没有过浏览器级验证
 * （即「人写帧 UI 未经人眼确认」）。本用例覆盖 tab 切换与新建帧的完整交互，并断言新帧
 * 真的出现在帧列表里。
 */
test("主链路②：剧本工作台切换关键帧 tab 并新建一个帧", async ({page}) => {
    await openE2eProject(page);

    // 剧情活动栏 → 打开剧本工作台。默认 tab 是「承诺账本」。
    await page.locator('[data-activity-id="plot"]').click();
    await page.locator('[data-testid="plot-panel-workbench-entry"]').click();
    await expect(page.locator('[data-testid="plot-promise-ledger"]')).toBeVisible();

    // tab 切换：关键帧 ⇄ 决策记录 ⇄ 关键帧，证明切换真的在换主体而不是只改高亮。
    const keyframeTab = page.getByRole("button", {name: "关键帧", exact: true});
    await keyframeTab.click();
    await expect(page.locator('[data-testid="plot-keyframe-ledger"]')).toBeVisible();

    await page.getByRole("button", {name: "决策记录", exact: true}).click();
    await expect(page.locator('[data-testid="plot-keyframe-ledger"]')).toBeHidden();

    await keyframeTab.click();
    await expect(page.locator('[data-testid="plot-keyframe-ledger"]')).toBeVisible();

    // 起始态：干净项目里还没有任何帧。
    await expect(page.locator('[data-testid^="plot-keyframe-row-"]')).toHaveCount(0);

    // 新建帧：标题 / instant / name / 至少一条不可逆变化（创建帧的必填项）。
    const title = `E2E 帧：项链易主 ${Date.now().toString(36)}`;
    const name = `k-e2e-necklace-${Date.now().toString(36)}`;
    await page.locator('[data-testid="plot-keyframe-create"]').click();
    await page.getByPlaceholder("如 项链易主").fill(title);
    await page.getByPlaceholder("如 600").fill("600");
    await page.getByPlaceholder("如 k-necklace-taken(小写字母/数字/连字符)").fill(name);
    await page.getByPlaceholder("如 项链从阿黎转到灰隼手里").fill("项链从阿黎转到灰隼手里");
    await page.getByRole("button", {name: "确定", exact: true}).click();

    // 断言：帧列表出现且就是刚建的那一条（标题可见、name 可见）。
    const rows = page.locator('[data-testid^="plot-keyframe-row-"]');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText(title);
    await expect(rows.first()).toContainText(name);
});
