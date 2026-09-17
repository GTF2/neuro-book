import {expect, type Locator, type Page} from "@playwright/test";

/**
 * Agent 行为锁的 E2E 辅助层（只读产品代码，仅封装浏览器操作）。
 *
 * 目标：把 `AgentChatSurface.vue` 这条 4000+ 行、无 data-testid 的重灾区，
 * 用一套**集中化选择器 + 语义化等待**包起来，让用例只表达「做什么」，
 * 而不是到处撒 CSS/文案魔法串。选择器一旦在产品里改名，只需要改这一个文件。
 *
 * 硬口径（与验收标准一致）：
 * - 所有等待都锚定**真实终态**（运行中的「停止」按钮消失、队列面板卸载、
 *   弹窗关闭等），不使用 `waitForTimeout` 硬等。
 * - 断言看**可观察结果**（最终 assistant 文本、面板/徽标/列表项的真实变化），
 *   不是「按钮存在」这种弱断言。
 *
 * 选择器依据（均为只读勘察所得，产品代码未改动一行）：
 * - 面板入口 `[data-activity-id="agent-panel"]`（既有 `03-agent.spec.ts` 同源）。
 * - 头部按钮用 `title` 属性（i18n 文案）定位；`title` 是产品的稳定契约，
 *   比 Tailwind 类名稳。
 * - composer 的 `aria-label` 就是发送提示语（`AgentComposerInput` 用 placeholder 兜底 aria-label）。
 */

/** 所有 Agent 场景选择器集中在此，避免散落在各用例里各写各的。 */
export const AGENT_SELECTORS = {
    /** 打开 Agent 面板的活动栏按钮。 */
    panelActivity: '[data-activity-id="agent-panel"]',
    /** AgentChatSurface 根 `<section>`：以「会话列表」按钮为锚点唯一确定（该 title 仅此组件使用）。 */
    surface: 'section:has(button[title="会话列表"])',
    /** 头部「会话列表」按钮。 */
    sessionListButton: 'button[title="会话列表"]',
    /** 头部「新建对话」按钮（canChooseCreateProfile=false 时是直建按钮）。 */
    headerNewChat: 'button[title="新建对话"]',
    /** 头部「查看当前 Session 的全部附件」按钮。 */
    attachmentToggle: 'button[title="查看当前 Session 的全部附件"]',
    /** 通用弹窗表面（`Dialog.vue` 的 `data-dialog-surface`）。 */
    dialogSurface: "[data-dialog-surface]",
    /** 会话列表弹窗内的搜索框 placeholder（比标题更唯一）。 */
    sessionSearchInput: 'input[placeholder="搜索标题、摘要、配置或 ID..."]',
    /** 会话列表弹窗里的一行（唯一带 `cursor-pointer` 的容器）。 */
    sessionRow: "div.cursor-pointer",
    /** 普通模式（idle）下的 composer；aria-label 即发送提示语。 */
    composer: '[aria-label="输入消息... (输入 @ 引用, $ 技能, / 命令)"]',
    /** idle 状态发送按钮（title = 发送）。 */
    sendButton: 'button[title="发送"]',
    /** 运行中「停止」按钮（title = 停止）。 */
    stopButton: 'button[title="停止"]',
    /** 运行中且输入框有文字时的按钮（title 以「引导」开头）。 */
    steerButtonPrefix: 'button[title^="引导"]',
} as const;

/** 用例需要直接引用的中文文案（均取自 `app/i18n/locales/zh-CN.ts`），集中一处便于随文案变更同步。 */
export const AGENT_TEXT = {
    modeNormal: "普通模式",
    modeDiscuss: "讨论模式",
    modePlan: "计划模式",
    sessionActiveBadge: "活跃",
    rename: "重命名",
    archive: "归档",
    restore: "恢复",
    closeDialog: "关闭",
    confirm: "确定",
    renamePromptHint: "输入新的会话标题",
    attachmentSearchPlaceholder: "搜索名称、MIME 或附件 ID",
    attachmentClose: "关闭附件面板",
    followUpDetail: "详情",
    followUpCollapse: "收起",
    followUpDismissTitle: "从队列移除，不再送达",
    followUpRunningHint: "条将在本轮结束后送达",
} as const;

/** 模式按钮 title 的构造口径（与 `AgentComposer.vue` 的 `cycleModeTitle` 一致）。 */
export function agentModeButtonTitle(mode: string): string {
    return `当前${mode}，点击或 Shift+Tab 切换模式`;
}

/** AgentChatSurface 根节点（作用域，避免与左侧「Agent 会话」侧栏的同名按钮混淆）。 */
export function agentSurface(page: Page): Locator {
    return page.locator(AGENT_SELECTORS.surface).first();
}

/** 会话列表弹窗表面（用搜索框锚定，避免与其它弹窗混淆）。 */
export function sessionListDialog(page: Page): Locator {
    return page
        .locator(AGENT_SELECTORS.dialogSurface)
        .filter({has: page.locator(AGENT_SELECTORS.sessionSearchInput)});
}

/** 重命名输入弹窗表面（用提示语锚定）。 */
export function renamePromptDialog(page: Page): Locator {
    return page
        .locator(AGENT_SELECTORS.dialogSurface)
        .filter({hasText: AGENT_TEXT.renamePromptHint});
}

/** 打开 Agent 面板，并等到 AgentChatSurface 真正挂载。 */
export async function openAgentPanel(page: Page): Promise<void> {
    await page.locator(AGENT_SELECTORS.panelActivity).first().click();
    await expect(agentSurface(page), "Agent 面板应打开").toBeVisible({timeout: 30_000});
}

/**
 * 从头部「新建对话」按钮新建一个会话。
 *
 * 说明：e2e 隔离配置把 `agent.defaultProfileKey.novel` 设为 `leader.default`，
 * `createProfileOptions` 去重后只剩一项，`canChooseCreateProfile` 为 false，
 * 于是头部按钮是**直建**按钮（不会先弹出 profile 下拉）。
 */
export async function createAgentSessionFromHeader(page: Page, timeoutMs = 60_000): Promise<void> {
    const newChat = agentSurface(page).locator(AGENT_SELECTORS.headerNewChat).first();
    await expect(newChat).toBeEnabled({timeout: timeoutMs});
    await newChat.click();
}

/** 等到 composer 进入「可输入」终态（idle + 已解析到模型），返回该 composer locator。 */
export async function waitForComposerReady(page: Page, timeoutMs = 60_000): Promise<Locator> {
    const composer = agentSurface(page).locator(AGENT_SELECTORS.composer).first();
    await expect(composer, "composer 应进入可输入状态").toBeVisible({timeout: timeoutMs});
    return composer;
}

/** 打开面板 + 新建会话 + 等到可输入。每个用例的第一步，保证不依赖前序用例留下的会话。 */
export async function ensureAgentSession(page: Page): Promise<Locator> {
    await openAgentPanel(page);
    await createAgentSessionFromHeader(page);
    return waitForComposerReady(page);
}

/** 向 composer 输入文本（ProseMirror 富文本：点击聚焦后键盘输入，与既有 03 用例同法）。 */
export async function typeComposerText(page: Page, text: string): Promise<Locator> {
    const composer = await waitForComposerReady(page);
    await composer.click();
    await page.keyboard.type(text);
    return composer;
}

/** 等到运行真正开始（发送按钮变为「停止」）。 */
export async function waitForAgentRunStarted(page: Page, timeoutMs = 30_000): Promise<void> {
    await expect(
        agentSurface(page).locator(AGENT_SELECTORS.stopButton).first(),
        "发起后应进入运行中（发送按钮变为「停止」）",
    ).toBeVisible({timeout: timeoutMs});
}

/** 等到运行真正结束（「停止」按钮消失 = 回到可发送状态，这是流式终态的真实同步点）。 */
export async function waitForAgentRunCompleted(page: Page, timeoutMs = 90_000): Promise<void> {
    await expect(
        agentSurface(page).locator(AGENT_SELECTORS.stopButton).first(),
        "流式结束后运行中按钮应消失（回到可发送状态）",
    ).toBeHidden({timeout: timeoutMs});
}

/** 发送一条消息，并等到运行真正开始。 */
export async function sendAgentMessage(page: Page, text: string): Promise<void> {
    await typeComposerText(page, text);
    const send = agentSurface(page).locator(AGENT_SELECTORS.sendButton).first();
    await expect(send).toBeEnabled();
    await send.click();
    await waitForAgentRunStarted(page);
}

/**
 * 运行中再发一条消息，并**排队**（非 steer）。
 *
 * 口径：`AgentComposer.submitButton` 在 running 且输入框有文字时，
 * 普通点击 → `steer`（引导当前 loop），Ctrl/Cmd+点击 → `followup`（排到本轮结束后）。
 * 本轮结束后送达的队列面板（`AgentFollowUpQueuePanel`）读的是 `followUpQueue`，
 * 因此这里必须带修饰键点击，才会落到「待投递队列」而不是「引导」。
 */
export async function queueFollowUpMessage(page: Page, text: string): Promise<void> {
    await typeComposerText(page, text);
    const steerButton = agentSurface(page).locator(AGENT_SELECTORS.steerButtonPrefix).first();
    await expect(steerButton, "运行中且有文字时发送按钮应变为「引导」").toBeVisible();
    await steerButton.click({modifiers: ["Control"]});
}

/** 读取「最后一条 assistant 气泡」的文本（用于断言流式终态的实际内容）。 */
export async function readLastAssistantText(page: Page): Promise<string> {
    const bubble = agentSurface(page)
        .locator("[data-anchor]")
        .filter({hasText: "Assistant"})
        .last();
    await expect(bubble, "应存在 assistant 气泡").toBeVisible({timeout: 30_000});
    return (await bubble.innerText()).trim();
}

/** 点击一次模式切换按钮（当前模式由调用方以文案声明，兼顾「按钮 title 真的变了」）。 */
export async function cycleAgentMode(page: Page, currentMode: string): Promise<void> {
    const button = agentSurface(page)
        .locator(`button[title="${agentModeButtonTitle(currentMode)}"]`)
        .first();
    await expect(button, `应处于「${currentMode}」`).toBeVisible();
    await button.click();
}

/** 若正在运行则停止；用于收尾，避免把长流带进后续用例。 */
export async function stopAgentRunIfRunning(page: Page): Promise<void> {
    const stop = agentSurface(page).locator(AGENT_SELECTORS.stopButton).first();
    if (await stop.isVisible().catch(() => false)) {
        await stop.click();
        await expect(stop).toBeHidden({timeout: 30_000});
    }
}
