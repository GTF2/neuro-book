// R5f DOM 断言（playwright 无头）：①create/invoke_agent 展开态聚合行 ②收起态不挂 ③interrupted 会话不再挂僵尸 pending 卡
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
const page = await browser.newPage({viewport: {width: 1600, height: 620}});
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(error.message));
await page.addInitScript(() => {
    // 拆书会话（xin-xiao-shuo 会话 1，status=interrupted，恢复 payload 带僵尸 pending）
    localStorage.setItem("agent:last-session:project:xin-xiao-shuo", JSON.stringify({schema: 2, sessionId: 1, sessionIdentity: "806c2928-f538-4823-a097-a29dd6429c2d"}));
    window.neuroBookDesktop = {
        status: () => Promise.resolve({version: "0.0.0-domcheck", connection: "local"}),
        onMenuCommand: () => () => {},
        menu: () => {},
        setAppearance: () => Promise.resolve(),
        window: () => Promise.resolve(),
    };
});
await page.goto("http://127.0.0.1:3000/", {waitUntil: "domcontentloaded", timeout: 60_000});

// 进书（书架卡名=xin-xiao-shuo-3 是另一本；《新小说1》才是拆书项目——书架名核对：xin-xiao-shuo 显示名可能是《新小说1》）
const bookClicked = await waitFor(async () => (await page.locator("text=新小说1").count()) > 0, 30_000, 2000)
    && await page.locator("text=新小说1").first().click({timeout: 8_000}).then(() => true).catch(() => false);
const entered = bookClicked && await waitFor(() => page.evaluate(() => Boolean(document.querySelector(".novel-ide-page"))), 60_000, 3000);
record("进入拆书项目主界面", entered && pageErrors.length === 0, entered ? `${pageErrors.length} 个页面错误` : `bookClicked=${bookClicked}`);
if (!entered) {
    await page.screenshot({path: "scripts/r5f-dom-final.png"});
    await browser.close();
    console.log(`\nSUMMARY: 0/${results.length} passed`);
    process.exit(1);
}

// 开 Agent 面板（恢复会话 1）
await page.locator('button.welcome-action-card', {hasText: "打开 Agent"}).first().click({timeout: 10_000}).catch((e) => console.log("AGENT_BTN_FAIL:", e.message.split("\n")[0]));
const chatReady = await waitFor(() => page.evaluate(() => Boolean(document.querySelector(".chat-scroll-hidden"))), 30_000, 3000);
record("Agent 面板加载", chatReady, chatReady ? "chat 容器已渲染" : "无聊天容器");
await page.waitForTimeout(3_000);

// ③ interrupted 会话不再挂僵尸 pending 卡（"待处理"红条/"已回答"计数都不应存在）
const pendingCard = await page.evaluate(() => {
    const text = document.querySelector(".chat-scroll-hidden")?.parentElement?.textContent ?? "";
    return {
        hasPendingBanner: text.includes("待处理") && text.includes("当前不可回答"),
        hasAbortedBanner: text.includes("当前等待输入状态不可回答"),
    };
});
record("R5f-③ interrupted 会话无僵尸 pending 卡", !pendingCard.hasPendingBanner && !pendingCard.hasAbortedBanner, JSON.stringify(pendingCard));

// ①② 历史分页加载到 create_agent 入窗 → 展开含子代理的轮断言聚合行 → 收起断言消失
// （真会话历史长，目标轮在"加载更早对话"分页窗口里；聚合行文案=「创建子代理 ×N」）
await page.waitForTimeout(1_000);
for (let i = 0; i < 12; i++) {
    const has = await page.evaluate(() => (document.querySelector(".chat-scroll-hidden")?.textContent ?? "").includes("create_agent"));
    if (has) break;
    const clicked = await page.evaluate(() => {
        const btn = [...document.querySelectorAll("button")].find((b) => (b.textContent ?? "").includes("加载更早对话"));
        if (!btn) return false;
        btn.click();
        return true;
    });
    if (!clicked) break;
    await page.waitForTimeout(2_500);
}
// ① 展开态：点含「子代理」的轮块头展开，断言「创建子代理 ×N」「派发子代理 ×N」聚合单行
const aggregate = await page.evaluate(() => {
    const scope = document.querySelector(".chat-scroll-hidden");
    if (!scope) return {ok: false, reason: "no chat"};
    const text0 = scope.textContent ?? "";
    if (!text0.includes("创建子代理")) {
        // 收起态看不到聚合行（②的正常行为）——找块头含「子代理」计数的轮展开
        const header = [...scope.querySelectorAll("button")].find((b) => /子代理 \d+/.test(b.textContent ?? ""));
        if (!header) return {ok: false, reason: "no round header with 子代理 count"};
        header.click();
        return new Promise((resolve) => setTimeout(() => {
            const text = scope.textContent ?? "";
            resolve({ok: true, hasCreateGroup: text.includes("创建子代理") && /创建子代理\s*×\d+/.test(text), hasInvokeGroup: text.includes("派发子代理") && /派发子代理\s*×\d+/.test(text)});
        }, 500));
    }
    return {ok: true, hasCreateGroup: /创建子代理\s*×\d+/.test(text0), hasInvokeGroup: /派发子代理\s*×\d+/.test(text0)};
});
record("R5f-① 展开态子线程调用聚合成单行", aggregate.ok && aggregate.hasCreateGroup && aggregate.hasInvokeGroup, JSON.stringify(aggregate));

// ② 收起态：从聚合行向上找它所在轮的块头（含时长文案的按钮），点击收起，断言聚合行消失
const collapse = await page.evaluate(() => {
    const scope = document.querySelector(".chat-scroll-hidden");
    if (!scope) return {ok: false};
    const groupBtn = [...scope.querySelectorAll("button")].find((b) => /创建子代理\s*×\d+/.test(b.textContent ?? ""));
    if (!groupBtn) return {ok: false, reason: "no group row"};
    let container = groupBtn.parentElement;
    let header = null;
    for (let up = 0; up < 8 && container; up += 1) {
        header = [...container.querySelectorAll("button")].find((b) => /已工作|本轮|工作中/.test(b.textContent ?? ""));
        if (header) break;
        container = container.parentElement;
    }
    if (!header) return {ok: false, reason: "no round header"};
    header.click(); // 收起
    return new Promise((resolve) => setTimeout(() => {
        const afterText = scope.textContent ?? "";
        resolve({ok: true, createGoneAfterCollapse: !/创建子代理\s*×\d+/.test(afterText)});
    }, 400));
});
record("R5f-② 收起轮块后子线程行一并收起", collapse.ok && collapse.createGoneAfterCollapse, JSON.stringify(collapse));

await page.screenshot({path: "scripts/r5f-dom-final.png"});
await browser.close();
const failed = results.filter((entry) => !entry.pass);
console.log(`\nSUMMARY: ${results.length - failed.length}/${results.length} passed` + (pageErrors.length ? ` pageErrors=${pageErrors.length}:${pageErrors[0]?.slice(0, 80)}` : ""));
process.exit(failed.length > 0 ? 1 : 0);
