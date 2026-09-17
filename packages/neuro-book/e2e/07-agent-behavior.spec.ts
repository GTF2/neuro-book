import {expect, openE2eProject, test} from "./fixtures";
import {
    AGENT_SELECTORS,
    AGENT_TEXT,
    agentModeButtonTitle,
    agentSurface,
    createAgentSessionFromHeader,
    cycleAgentMode,
    ensureAgentSession,
    queueFollowUpMessage,
    readLastAssistantText,
    renamePromptDialog,
    sendAgentMessage,
    sessionListDialog,
    stopAgentRunIfRunning,
    waitForAgentRunCompleted,
} from "./support/agent";

/**
 * AgentChatSurface.vue 的 E2E「行为锁」。
 *
 * 这套用例承担一个此前缺失的门禁：`AgentChatSurface.vue`（4000+ 行、无 data-testid）
 * 在此之前的浏览器级覆盖只有 `03-agent.spec.ts` 的「发起 → 中断」一条。
 * 这里按覆盖清单补齐 5 条**可观察终态**用例：
 *   1. 完整流式终态   2. 会话生命周期   3. follow-up 队列   4. 模式切换   5. 附件面板
 *
 * 约束：不改产品代码一行；只加 e2e 与 e2e 基建；断言不放宽。
 * 每个用例都通过 `ensureAgentSession` **自建会话**，因此不依赖前序用例留下的会话状态。
 *
 * mock 说明：e2e 本地 Mock LLM 会慢速流式吐 `片段1 … 片段60`（间隔 400ms，整段约 24s），
 * 最后补 `finish_reason: stop` + `[DONE]`（见 `e2e/mock-llm.ts`）。因此「最终文本含 `片段60`」
 * 是流式真的走完的硬证据。
 */

test("07-1 Agent 行为锁：完整流式终态（等流式结束 + 断言最终 assistant 文本）", async ({page}) => {
    await openE2eProject(page);
    await ensureAgentSession(page);

    await sendAgentMessage(page, "E2E-07 流式终态：请把这段回复输出完整。");
    await waitForAgentRunCompleted(page, 90_000);

    const text = await readLastAssistantText(page);
    expect(text, "最终 assistant 文本应包含 mock 流式的最后一个片段（证明流式真的走完）").toContain("片段60");
    expect(text, "不应还是非流式的兜底文案").not.toContain("e2e mock 非流式回复");
});

test("07-2 Agent 行为锁：会话生命周期（新建 → 列表 → 切换 → 重命名 → 归档）", async ({page}) => {
    await openE2eProject(page);
    await ensureAgentSession(page);

    const surface = agentSurface(page);
    const renamedTitle = "E2E 生命周期 Alpha";

    // 1) 重命名当前会话 —— 证明 rename 真的改了会话标题（面板头部随之更新）。
    await surface.locator(AGENT_SELECTORS.sessionListButton).first().click();
    const list = sessionListDialog(page);
    await expect(list, "会话列表弹窗应打开").toBeVisible({timeout: 30_000});

    const activeRow = list.locator(AGENT_SELECTORS.sessionRow).filter({hasText: AGENT_TEXT.sessionActiveBadge}).first();
    await expect(activeRow, "当前会话应带「活跃」徽标").toBeVisible();
    await activeRow.locator(`button[title="${AGENT_TEXT.rename}"]`).first().click();

    const renamePrompt = renamePromptDialog(page);
    await expect(renamePrompt, "重命名输入弹窗应出现").toBeVisible({timeout: 20_000});
    await renamePrompt.locator("input").fill(renamedTitle);
    await renamePrompt.getByRole("button", {name: AGENT_TEXT.confirm, exact: true}).click();

    await expect(list.getByText(renamedTitle, {exact: true}), "列表里应显示改名后的标题").toBeVisible({timeout: 30_000});
    await list.getByRole("button", {name: AGENT_TEXT.closeDialog, exact: true}).click();
    await expect(list, "会话列表弹窗应关闭").toBeHidden({timeout: 20_000});
    await expect(surface.getByText(renamedTitle, {exact: true}).first(), "面板头部标题应更新为改名后的标题").toBeVisible({timeout: 20_000});

    // 2) 新建第二个会话 —— 面板内容切换（头部不再是 Alpha）。
    await createAgentSessionFromHeader(page);
    await expect(surface.getByText(renamedTitle, {exact: true}), "新建会话后头部应不再显示上一个会话").toHaveCount(0, {timeout: 30_000});

    // 3) 打开列表：应存在多条会话；点击 Alpha 行切回 —— 面板内容再次切换。
    await surface.locator(AGENT_SELECTORS.sessionListButton).first().click();
    const switchList = sessionListDialog(page);
    await expect(switchList, "会话列表弹窗应再次打开").toBeVisible({timeout: 30_000});
    const rows = switchList.locator(AGENT_SELECTORS.sessionRow);
    expect(await rows.count(), "列表里应至少有两条会话").toBeGreaterThanOrEqual(2);
    const alphaRowInSwitch = switchList.locator(AGENT_SELECTORS.sessionRow).filter({hasText: renamedTitle}).first();
    await expect(alphaRowInSwitch, "列表里应能找到 Alpha 行").toBeVisible();
    await alphaRowInSwitch.getByText(renamedTitle, {exact: true}).click();
    await expect(switchList, "切换后弹窗应关闭").toBeHidden({timeout: 30_000});
    await expect(surface.getByText(renamedTitle, {exact: true}).first(), "切回后面板头部应显示 Alpha").toBeVisible({timeout: 20_000});

    // 4) 归档 Alpha —— 归档后该行转为「恢复」态；关弹窗再开，默认（未归档）列表里应消失。
    await surface.locator(AGENT_SELECTORS.sessionListButton).first().click();
    const archiveList = sessionListDialog(page);
    await expect(archiveList, "会话列表弹窗应打开（归档前）").toBeVisible({timeout: 30_000});
    const alphaRowForArchive = archiveList.locator(AGENT_SELECTORS.sessionRow).filter({hasText: renamedTitle}).first();
    await alphaRowForArchive.locator(`button[title="${AGENT_TEXT.archive}"]`).first().click();
    await expect(
        alphaRowForArchive.locator(`button[title="${AGENT_TEXT.restore}"]`).first(),
        "归档后该行应出现「恢复」按钮（证明归档真的执行了）",
    ).toBeVisible({timeout: 30_000});

    await archiveList.getByRole("button", {name: AGENT_TEXT.closeDialog, exact: true}).click();
    await expect(archiveList).toBeHidden({timeout: 20_000});

    await surface.locator(AGENT_SELECTORS.sessionListButton).first().click();
    const reopenList = sessionListDialog(page);
    await expect(reopenList, "会话列表弹窗应重新打开").toBeVisible({timeout: 30_000});
    await expect(
        reopenList.getByText(renamedTitle, {exact: true}),
        "归档的会话应从未归档默认列表中消失",
    ).toHaveCount(0, {timeout: 30_000});
});

test("07-3 Agent 行为锁：follow-up 队列（运行中排队 → 忽略 → 队列项消失）", async ({page}) => {
    await openE2eProject(page);
    await ensureAgentSession(page);

    const surface = agentSurface(page);
    const queuedText = "E2E-07 排队第二条";

    // 第一条消息触发一段约 24s 的运行，制造稳定的「运行中」窗口。
    await sendAgentMessage(page, "E2E-07 首条运行消息");

    // 运行中再发一条（Ctrl+点击 = followup）→ 进入待投递队列。
    await queueFollowUpMessage(page, queuedText);

    // 队列条出现 = 运行中消息确实进了「待投递队列」（而不是被 steer 掉）。
    await expect(
        surface.getByRole("button", {name: AGENT_TEXT.followUpDetail}).first(),
        "运行中排队后应出现待投递队列条",
    ).toBeVisible({timeout: 30_000});
    await expect(surface.getByText(AGENT_TEXT.followUpRunningHint).first(), "队列条应说明「本轮结束后送达」").toBeVisible();

    // 展开详情，断言队列项内容就是刚排队的那条消息。
    await surface.getByRole("button", {name: AGENT_TEXT.followUpDetail}).first().click();
    await expect(surface.getByText(queuedText).first(), "队列项应展示刚排队的消息文本").toBeVisible({timeout: 20_000});

    // 忽略这条 → 队列项消失；count 归零后面板整体卸载。
    await surface.locator(`button[title="${AGENT_TEXT.followUpDismissTitle}"]`).first().click();
    await expect(surface.getByText(queuedText), "忽略后该队列项应消失").toHaveCount(0, {timeout: 30_000});
    await expect(
        surface.getByRole("button", {name: AGENT_TEXT.followUpCollapse}),
        "忽略最后一条队列项后，队列面板应卸载",
    ).toHaveCount(0, {timeout: 30_000});

    // 收尾：停掉这次运行，避免把长流带进后续用例。
    await stopAgentRunIfRunning(page);
});

test("07-4 Agent 行为锁：模式切换（点击模式按钮 → 模式徽标随之变化）", async ({page}) => {
    await openE2eProject(page);
    await ensureAgentSession(page);

    const surface = agentSurface(page);

    // normal → discuss：按钮 title 变化 + 出现「讨论模式」徽标。
    await cycleAgentMode(page, AGENT_TEXT.modeNormal);
    await expect(
        surface.locator(`button[title="${agentModeButtonTitle(AGENT_TEXT.modeDiscuss)}"]`).first(),
        "点击后模式按钮 title 应变为讨论模式",
    ).toBeVisible({timeout: 20_000});
    const discussBadge = surface.locator(`div[title="${agentModeButtonTitle(AGENT_TEXT.modeDiscuss)}"]`);
    await expect(discussBadge, "讨论模式徽标应出现").toBeVisible({timeout: 20_000});
    await expect(discussBadge).toContainText(AGENT_TEXT.modeDiscuss);

    // discuss → plan：徽标内容随之变为「计划模式」。
    await cycleAgentMode(page, AGENT_TEXT.modeDiscuss);
    const planBadge = surface.locator(`div[title="${agentModeButtonTitle(AGENT_TEXT.modePlan)}"]`);
    await expect(planBadge, "计划模式徽标应出现").toBeVisible({timeout: 20_000});
    await expect(planBadge).toContainText(AGENT_TEXT.modePlan);
});

test("07-5 Agent 行为锁：附件面板（点击附件按钮 → 面板渲染并可关闭）", async ({page}) => {
    await openE2eProject(page);
    await ensureAgentSession(page);

    const surface = agentSurface(page);
    const attachmentSearch = surface.locator(`input[placeholder="${AGENT_TEXT.attachmentSearchPlaceholder}"]`).first();
    const attachmentClose = surface.locator(`[aria-label="${AGENT_TEXT.attachmentClose}"]`).first();

    // 打开附件面板：能渲染出搜索框与关闭按钮即为「面板已渲染」。
    await surface.locator(AGENT_SELECTORS.attachmentToggle).first().click();
    await expect(attachmentSearch, "附件面板应渲染出搜索框").toBeVisible({timeout: 20_000});
    await expect(attachmentClose, "附件面板应渲染出关闭按钮").toBeVisible();

    // 关闭按钮收起面板。
    await attachmentClose.click();
    await expect(surface.locator(`input[placeholder="${AGENT_TEXT.attachmentSearchPlaceholder}"]`), "关闭后附件面板应卸载").toHaveCount(0, {timeout: 20_000});
});
