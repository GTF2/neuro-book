// 任务031 备料单② v1.2 前线独立复验（真实时钟逐帧抽查，不依赖工程队自报）：
// ①收起编排：60ms 内容已走/盒未动 → 200ms 容器合拢中 → 400ms 终态 hidden-ready
// ②同刻收尾：容器 opacity 过渡 end=340ms，合拢段不被 settle 掐断（400ms computed max-height=0）
// ③展开编排：100ms 盒开中/内容未归位 → 400ms 全归位
// ④inert：hide 后内部按钮不可聚焦
// ⑤确认层：纯淡出单段 240ms 终态落位
import {chromium} from "playwright-core";

const results = [];
const record = (name, pass, detail) => {
    results.push({name, pass});
    console.log(`${pass ? "PASS" : "FAIL"} | ${name} | ${detail}`);
};
const browser = await chromium.launch({headless: true, executablePath: process.env.LOCALAPPDATA + "/ms-playwright/chromium-1234/chrome-win64/chrome.exe"});
const page = await browser.newPage({viewport: {width: 1280, height: 900}});
await page.goto("file:///D:/ProgramData/.zcode/workspace/default/out/%E5%9B%BE%E7%BA%B8/%E5%8D%95D-showhide-helper%E6%A0%B7%E5%BC%A0.html", {waitUntil: "load", timeout: 30_000});
await page.waitForTimeout(400);

const style = (sel, prop) => page.evaluate(([s, p]) => getComputedStyle(document.querySelector(s))[p], [sel, prop]);
const cls = (sel) => page.evaluate((s) => document.querySelector(s).className, sel);

// ---- ①② 收起编排（t=0 点收起）----
await page.click("#panel-toggle");
await page.waitForTimeout(60);
const t60 = {contentOpacity: await style("#demo-panel h3", "opacity"), contentTransform: await style("#demo-panel h3", "transform"), boxMaxH: parseFloat(await style("#demo-panel", "max-height"))};
record("①a 收起 60ms：内容已开走（opacity<1 且上移中）", parseFloat(t60.contentOpacity) < 1 && parseFloat(t60.contentTransform.split(",").pop()) < 0, JSON.stringify(t60));
record("①b 收起 60ms：盒子尚未合拢（max-height 仍≈实高）", t60.boxMaxH > 100, `max-height=${t60.boxMaxH}`);
await page.waitForTimeout(140); // t≈200ms：容器合拢段中
const t200 = {boxMaxH: parseFloat(await style("#demo-panel", "max-height")), boxOpacity: parseFloat(await style("#demo-panel", "opacity"))};
record("①c 收起 200ms：容器合拢进行中（120-340ms 段）", t200.boxMaxH > 0 && t200.boxOpacity > 0, JSON.stringify(t200));
await page.waitForTimeout(260); // t≈460ms > 340ms：终态
const t460 = {boxMaxH: parseFloat(await style("#demo-panel", "max-height")), boxOpacity: parseFloat(await style("#demo-panel", "opacity")), className: await cls("#demo-panel"), inert: await page.evaluate(() => document.querySelector("#panel-inner").inert)};
record("②收起 460ms 终态：合拢完成不被掐断（max-height=0）+hidden-ready+inert", t460.boxMaxH === 0 && t460.boxOpacity === 0 && String(t460.className).includes("p0-hidden-ready") && !String(t460.className).includes("p0-out") && t460.inert === true, JSON.stringify(t460));

// ---- ③ 展开编排 ----
await page.click("#panel-toggle");
await page.waitForTimeout(100);
const o100 = {boxMaxH: parseFloat(await style("#demo-panel", "max-height")), contentOpacity: parseFloat(await style("#demo-panel h3", "opacity"))};
record("③a 展开 100ms：盒先开（max-height 已>0）内容未归位（opacity<1）", o100.boxMaxH > 0 && o100.contentOpacity < 1, JSON.stringify(o100));
await page.waitForTimeout(400);
const o500 = {contentOpacity: parseFloat(await style("#demo-panel h3", "opacity")), boxMaxH: parseFloat(await style("#demo-panel", "max-height"))};
record("③b 展开 500ms：内容归位+盒全开", o500.contentOpacity === 1 && o500.boxMaxH > 150, JSON.stringify(o500));

// ---- ⑤ 确认层纯淡出单段 ----
await page.click("#cf-trigger");
await page.waitForTimeout(300);
const cfOpen = parseFloat(await style("#cf-layer", "opacity"));
await page.click("#cf-cancel");
await page.waitForTimeout(130);
const cfMid = parseFloat(await style("#cf-layer", "opacity"));
await page.waitForTimeout(300);
const cfEnd = {opacity: parseFloat(await style("#cf-layer", "opacity")), className: await cls("#cf-layer")};
record("⑤确认层：打开全显→关闭 130ms 淡出中→终态 hidden-ready（单段 240ms）", cfOpen === 1 && cfMid > 0 && cfMid < 1 && cfEnd.opacity === 0 && String(cfEnd.className).includes("p0-hidden-ready"), `open=${cfOpen} mid=${cfMid} end=${JSON.stringify(cfEnd)}`);

await browser.close();
const passed = results.filter((r) => r.pass).length;
console.log(`\nSUMMARY: ${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
