import {chromium} from "playwright-core";
const browser = await chromium.launch({headless: true, executablePath: process.env.LOCALAPPDATA + "/ms-playwright/chromium-1234/chrome-win64/chrome.exe"});
const page = await browser.newPage({viewport: {width: 1600, height: 620}});
await page.addInitScript(() => {
    localStorage.setItem("agent:last-session:project:ge-zhi-shu", JSON.stringify({schema: 2, sessionId: 64, sessionIdentity: "fbe93c1c-db9d-47a7-96e5-5cf9e3d9a995"}));
    window.neuroBookDesktop = {status: () => Promise.resolve({version: "x", connection: "local"}), onMenuCommand: () => () => {}, menu: () => {}, setAppearance: () => Promise.resolve(), window: () => Promise.resolve()};
});
await page.goto("http://127.0.0.1:3000/", {waitUntil: "domcontentloaded", timeout: 60_000});
for (let i = 0; i < 15; i++) { if (await page.locator("text=戈之书").count()) break; await page.waitForTimeout(2_000); }
await page.locator("text=戈之书").first().click({timeout: 8_000});
for (let i = 0; i < 20; i++) { if (await page.evaluate(() => Boolean(document.querySelector(".novel-ide-page"))) ) break; await page.waitForTimeout(3_000); }
await page.locator('button.welcome-action-card', {hasText: "打开 Agent"}).first().click({timeout: 10_000}).catch(() => {});
for (let i = 0; i < 10; i++) { if (await page.evaluate(() => Boolean(document.querySelector(".rail-scroll"))) ) break; await page.waitForTimeout(2_000); }
await page.waitForTimeout(2_500);
const geo = await page.evaluate(() => {
    const grids = document.querySelectorAll(".rail-scroll button");
    const r = grids[Math.floor(grids.length / 2)].getBoundingClientRect();
    return {x: r.left + r.width / 2, y: r.top + r.height / 2};
});
await page.mouse.move(geo.x, geo.y);
await page.waitForTimeout(700);
const state = await page.evaluate(() => {
    const card = document.querySelector('.pointer-events-none.fixed.z-50');
    const r = card?.getBoundingClientRect();
    const themeHost = document.querySelector('.novel-ide-theme');
    const hostBg = themeHost ? getComputedStyle(themeHost).getPropertyValue('--bg-panel').trim() : null;
    const rootBg = getComputedStyle(document.documentElement).getPropertyValue('--bg-panel').trim();
    const cardBg = card ? getComputedStyle(card).backgroundColor : null;
    return {
        cardExists: Boolean(card),
        rect: r ? {l: Math.round(r.left), t: Math.round(r.top)} : null,
        inViewport: r ? r.left >= 0 && r.left < window.innerWidth && r.top >= 0 : false,
        hostBg, rootBg, cardBg,
        themeMatchesHost: Boolean(hostBg && cardBg && cardBg.includes(hostBg.replace(' ', ''))),
        isSepiaFallback: Boolean(rootBg && cardBg && cardBg.includes(rootBg.replace(' ', ''))),
    };
});
console.log(JSON.stringify(state, null, 1));
await browser.close();
