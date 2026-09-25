// 任务031 G 段真机 smoke（playwright 无头，复用 r5f-dom-check 注入法）：
// ①中断重进恢复：interrupted 会话（xin-xiao-shuo 会话 1，历史恢复 payload 带僵尸 pending）
//   重进后无「待处理」红条、无僵尸卡——统一待办库 agent_pending=0（R5f 前端门+G1 链路联合实证）。
// ②三处数字一致（空态形态）：无 waiting workflow 时徽标节整节不渲染（v-if=waitingCount||feed.error），
//   即「0 处幽灵灰行」——徽标=统一库 workflow_answer 计数（D 段 props 供给）的空态一致实证。
import {chromium} from "playwright-core";

const results = [];
const record = (name, pass, detail) => {
    results.push({name, pass, detail});
    console.log(`${pass ? "PASS" : "FAIL"} | ${name} | ${detail}`);
};
const waitFor = async (fn, timeoutMs, stepMs = 2000) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (await fn()) return true;
        await new Promise((resolve) => setTimeout(resolve, stepMs));
    }
    return await fn();
};

const browser = await chromium.launch({headless: true, executablePath: process.env.LOCALAPPDATA + "/ms-playwright/chromium-1234/chrome-win64/chrome.exe"});
const page = await browser.newPage({viewport: {width: 1600, height: 900}});
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(error.message));
await page.addInitScript(() => {
    localStorage.setItem("agent:last-session:project:xin-xiao-shuo", JSON.stringify({schema: 2, sessionId: 1, sessionIdentity: "806c2928-f538-4823-a097-a29dd6429c2d"}));
    window.neuroBookDesktop = {
        status: () => Promise.resolve({version: "0.0.0-g1-smoke", connection: "local"}),
        onMenuCommand: () => () => {},
        menu: () => {},
        setAppearance: () => Promise.resolve(),
        window: () => Promise.resolve(),
    };
});
await page.goto("http://127.0.0.1:3000/", {waitUntil: "domcontentloaded", timeout: 60_000});

const bookClicked = await waitFor(async () => (await page.locator("text=新小说1").count()) > 0, 30_000, 2000)
    && await page.locator("text=新小说1").first().click({timeout: 8_000}).then(() => true).catch(() => false);
const entered = bookClicked && await waitFor(() => page.evaluate(() => Boolean(document.querySelector(".novel-ide-page"))), 60_000, 3000);
record("进入《新小说1》主界面", Boolean(entered), entered ? `${pageErrors.length} 个页面错误` : `bookClicked=${bookClicked}`);
if (!entered) {
    await page.screenshot({path: "scripts/g1-smoke-fail.png"});
    await browser.close();
    console.log(`\nSUMMARY: ${results.filter((r) => r.pass).length}/${results.length} passed`);
    process.exit(1);
}

// 恢复会话 1（中断重进）
await page.locator('button.welcome-action-card', {hasText: "打开 Agent"}).first().click({timeout: 10_000}).catch((e) => console.log("AGENT_BTN_FAIL:", e.message.split("\n")[0]));
const chatReady = await waitFor(() => page.evaluate(() => Boolean(document.querySelector(".chat-scroll-hidden"))), 30_000, 3000);
record("中断会话重进加载", Boolean(chatReady), chatReady ? "chat 容器已渲染" : "无聊天容器");
await page.waitForTimeout(3_000);

// ① 无僵尸 pending 卡（恢复 payload 残留审批不灌卡）
const pendingCard = await page.evaluate(() => {
    const text = document.querySelector(".chat-scroll-hidden")?.parentElement?.textContent ?? "";
    return {
        hasPendingBanner: text.includes("待处理") && text.includes("当前不可回答"),
        hasAbortedBanner: text.includes("当前等待输入状态不可回答"),
    };
});
record("①中断重进无僵尸 pending 卡（统一库 agent_pending=0）", !pendingCard.hasPendingBanner && !pendingCard.hasAbortedBanner, JSON.stringify(pendingCard));

// ② 徽标-库空态一致：无 waiting workflow 时「流程等应答」节不渲染（无幽灵灰行/幽灵计数）
const badgeState = await page.evaluate(() => {
    const text = document.querySelector(".chat-scroll-hidden")?.parentElement?.textContent ?? "";
    const badgeMatches = text.match(/(\d+)\s*个流程等应答/g) ?? [];
    return {badgeTexts: badgeMatches};
});
record("②徽标与统一库计数一致（空态=无幽灵徽标）", badgeState.badgeTexts.length === 0, JSON.stringify(badgeState));

// 会话内容真实恢复（重进恢复的正面证据：历史消息树在）
const restored = await page.evaluate(() => {
    const scope = document.querySelector(".chat-scroll-hidden");
    const text = scope?.textContent ?? "";
    return {hasContent: text.length > 200, previews: text.slice(0, 80)};
});
record("会话历史消息恢复渲染", restored.hasContent, `正文长度=${restored.hasContent ? ">200" : "不足"}`);

await page.screenshot({path: "scripts/g1-smoke-1-recovery.png", fullPage: false});
const chatBox = await page.locator(".chat-scroll-hidden").boundingBox().catch(() => null);
if (chatBox) {
    await page.screenshot({path: "scripts/g1-smoke-2-badge-area.png", clip: {x: Math.max(0, chatBox.x - 20), y: Math.max(0, chatBox.y - 60), width: Math.min(1580, chatBox.width + 40), height: Math.min(880, chatBox.height + 80)}});
}
await browser.close();
const passed = results.filter((r) => r.pass).length;
console.log(`\nSUMMARY: ${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
