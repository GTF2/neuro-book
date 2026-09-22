// R4 DOM 断言（playwright 无头）：desktop stub → 书架点书 → 主界面 → 开 Agent 面板 → 全链断言
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
    localStorage.setItem("agent:last-session:project:ge-zhi-shu", JSON.stringify({schema: 2, sessionId: 64, sessionIdentity: "fbe93c1c-db9d-47a7-96e5-5cf9e3d9a995"}));
    // desktop stub：agent-panel 按钮（Agent 面板唯一入口）仅 desktop 渲染。
    window.neuroBookDesktop = {
        status: () => Promise.resolve({version: "0.0.0-domcheck", connection: "local"}),
        onMenuCommand: () => () => {},
        menu: () => {},
        setAppearance: () => Promise.resolve(),
        window: () => Promise.resolve(),
    };
});
await page.goto("http://127.0.0.1:3000/", {waitUntil: "domcontentloaded", timeout: 60_000});

// 1) 等书卡 → 点书
const bookClicked = await waitFor(async () => (await page.locator("text=戈之书").count()) > 0, 30_000, 2000)
    && await page.locator("text=戈之书").first().click({timeout: 8_000}).then(() => true).catch(() => false);
// 2) 等主界面（novel-ide-page 挂载，非书架文案误判）
const entered = bookClicked && await waitFor(() => page.evaluate(() => Boolean(document.querySelector(".novel-ide-page"))), 60_000, 3000);
record("进入主界面（6/6 卡点已修）", entered && pageErrors.length === 0, entered ? `${pageErrors.length} 个页面错误` : `bookClicked=${bookClicked}，pageErrors=${pageErrors.slice(0, 2).join("；")}`);
if (!entered) {
    await page.screenshot({path: "scripts/r4-dom-final.png"});
    await browser.close();
    console.log(`\nSUMMARY: 0/6 passed`);
    process.exit(1);
}

// 3) 开 Agent 面板：欢迎页「打开 Agent」卡片（ActivityBar 按钮仅 desktop 渲染且 SSR 固化 false，不可用）
await page.locator('button.welcome-action-card', {hasText: "打开 Agent"}).first().click({timeout: 10_000}).catch((e) => console.log("AGENT_BTN_FAIL:", e.message.split("\n")[0]));
const chatReady = await waitFor(() => page.evaluate(() => Boolean(document.querySelector(".chat-scroll-hidden"))), 30_000, 3000);
record("Agent 面板聊天流加载", chatReady, chatReady ? "chat 容器已渲染" : "面板开后无聊天容器");
await page.waitForTimeout(3_000);

if (chatReady) {
    // 件1：块头时长
    const headerText = await page.locator("button:has(span.font-medium)", {hasText: /已工作|本轮/}).first().textContent().catch(() => null);
    record("件1 块头时长显示", Boolean(headerText), headerText ? headerText.trim().slice(0, 40) : "未找到");

    // 件5：气泡上限 480（30rem）
    const bubbleInfo = await page.evaluate(() => {
        const bubbles = [...document.querySelectorAll("[class*='max-w-[30rem]']")];
        const widths = bubbles.slice(0, 10).map((el) => el.getBoundingClientRect().width);
        return {count: bubbles.length, max: widths.length ? Math.round(Math.max(...widths)) : 0};
    });
    record("件5 气泡 30rem 上限", bubbleInfo.count > 0 && bubbleInfo.max <= 480, `命中 ${bubbleInfo.count} 个，最宽 ${bubbleInfo.max}px`);

    // 件3⑤：滚动条隐藏
    const scrollHidden = await page.evaluate(() => {
        const el = document.querySelector(".chat-scroll-hidden");
        return el ? getComputedStyle(el).scrollbarWidth : null;
    });
    record("件3⑤ 消息区滚动条隐藏", scrollHidden === "none", `scrollbarWidth=${scrollHidden}`);

    // R5 件1：刻度条加宽+鱼骨形态（横向短条右对齐、宽度百分比、当前条满宽）
    const barInfo = await page.evaluate(() => {
        const rail = document.querySelector(".rail-scroll");
        const bar = rail?.parentElement;
        const bars = rail ? [...rail.querySelectorAll("button > span")] : [];
        const widths = bars.map((el) => Math.round(el.getBoundingClientRect().width));
        return {
            barWidth: bar ? Math.round(parseFloat(getComputedStyle(bar).width)) : null,
            count: bars.length,
            maxW: widths.length ? Math.max(...widths) : 0,
            minW: widths.length ? Math.min(...widths) : 0,
        };
    });
    record("R5 件1 刻度条鱼骨形态", barInfo.barWidth === 36 && barInfo.count > 0 && barInfo.minW < barInfo.maxW, JSON.stringify(barInfo));

    // R5 件2：块头不再出现「已工作 1 秒」
    const oneSec = await page.evaluate(() => [...document.querySelectorAll("button")].some((el) => /已工作 1 秒|工作中 1 秒/.test(el.textContent ?? "")));
    record("R5 件2 无假 1 秒块头", !oneSec, oneSec ? "仍存在 1 秒块头" : "无「已工作 1 秒」形态");

    // 件3①：点格直滚端到端（先滚到底，点前段格，验证 scrollTop 位移）
    const seek = await page.evaluate(() => {
        const container = document.querySelector(".chat-scroll-hidden");
        const track = document.querySelector(".rail-scroll");
        if (!container || !track) return {ok: false, reason: "容器缺失"};
        container.scrollTop = container.scrollHeight;
        const bottom = container.scrollTop;
        const grids = track.querySelectorAll("button");
        if (grids.length < 3) return {ok: false, reason: `格数 ${grids.length}`};
        const target = grids[Math.floor(grids.length / 4)];
        target.dispatchEvent(new MouseEvent("click", {bubbles: true}));
        return new Promise((resolve) => setTimeout(() => {
            const after = container.scrollTop;
            resolve({ok: true, bottom: Math.round(bottom), after: Math.round(after), moved: Math.abs(bottom - after) > 50});
        }, 700));
    });
    record("件3① 点格跳转滚动（端到端）", seek.ok && seek.moved, JSON.stringify(seek));
} else {
    for (const name of ["件1 块头时长显示", "件5 气泡 30rem 上限", "件3⑤ 消息区滚动条隐藏", "件3④ 刻度条加宽 w-9", "件3① 点格跳转滚动（端到端）"]) {
        record(name, false, "前置失败：聊天流未加载");
    }
}

await page.screenshot({path: "scripts/r4-dom-final.png"});
await browser.close();
const failed = results.filter((entry) => !entry.pass);
console.log(`\nSUMMARY: ${results.length - failed.length}/${results.length} passed` + (pageErrors.length ? ` pageErrors=${pageErrors.length}:${pageErrors[0]?.slice(0, 80)}` : ""));
process.exit(failed.length > 0 ? 1 : 0);
