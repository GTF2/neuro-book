import {expect, openE2eProject, test} from "./fixtures";
import {E2E_MOCK_LLM_BASE_URL} from "./e2e-env";

/**
 * 主链路③：Agent 会话「发起 → 中断」。
 *
 * 这条链路此前完全没有浏览器级 smoke（「队列 UI 无浏览器 smoke」）。要验证「中断」就必须
 * 有一个真正在跑的会话，所以 e2e 起了一个本地 Mock LLM（`e2e/mock-llm.ts`）：完全离线、慢速
 * 流式吐字，让 UI 稳定停留在「运行中」，测试才能真的点一次「停止」。
 *
 * 断言口径不做假动作：发送按钮的 title 只在 `running` 时为「停止」，
 * 「停止」出现 = 应用真的起了一次运行；「停止」消失回「发送」= 中断链路真的走通了。
 */
test("主链路③：发起 Agent 会话并中断运行", async ({page}) => {
    await openE2eProject(page);

    // 打开 Agent 面板。
    await page.locator('[data-activity-id="agent-panel"]').click();

    // 白板上没有会话时 composer 是只读的，先新建一个会话。
    // 这里点的是 composer 里那条「空态」状态条上的按钮，它在整页里唯一：
    // 左侧「Agent 会话」侧栏也有个同名的「新建对话」，那是另一个面板的按钮，不能误点。
    const emptyBanner = page.locator('[role="status"]').filter({hasText: "当前项目没有可继续的主对话"});
    await expect(emptyBanner).toBeVisible({timeout: 60_000});
    await emptyBanner.getByRole("button", {name: "新建对话"}).click();

    // 会话可输入 = 隔离 Mock 模型已被解析到（composer 的 aria-label 就是发送提示语）。
    const composer = page.locator('[aria-label="输入消息... (输入 @ 引用, $ 技能, / 命令)"]').first();
    await expect(composer).toBeVisible({timeout: 60_000});
    await composer.click();
    await page.keyboard.type("E2E 冒烟：请用一句话介绍这次会话。");

    // 发起：点「发送」后，运行中按钮会变成「停止」。
    const sendButton = page.locator('button[title="发送"]').first();
    await expect(sendButton).toBeEnabled();
    await sendButton.click();
    const stopButton = page.locator('button[title="停止"]').first();
    await expect(stopButton, "发起后应进入运行中（按钮变为「停止」）").toBeVisible({timeout: 60_000});

    // 中断：点「停止」，按钮应回到「发送」，说明这次运行被中止了。
    await stopButton.click();
    await expect(sendButton, "中断后应回到可发送状态").toBeVisible({timeout: 60_000});

    // 证据链闭环：应用真的打到了隔离 Mock 端点，而不是只看到 UI 上的「运行中」。
    const stats = await page.request.get(`${E2E_MOCK_LLM_BASE_URL.replace(/\/v1$/, "")}/e2e-stats`);
    expect(stats.ok()).toBe(true);
    expect((await stats.json() as {chatCompletions: number}).chatCompletions).toBeGreaterThan(0);
});
