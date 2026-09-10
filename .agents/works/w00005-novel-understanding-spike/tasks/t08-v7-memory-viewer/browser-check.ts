import assert from "node:assert/strict";
import {mkdir, readFile, rm, writeFile} from "node:fs/promises";
import {dirname, resolve} from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";
import {createHash, randomUUID} from "node:crypto";
import {chromium, type BrowserContext} from "playwright-core";
import {createTestTmpRoot} from "@notnotype/neuro-book-test-support/tmp";
import {resolveAgentRunRoot} from "@notnotype/neuro-book-test-support/paths";
import {createQueryIndex, parseDataset, querySnapshot} from "../t07-v7-schema-gold/index.ts";
import {knowledgeGraph, structuralEdges} from "./knowledge-graph.ts";

const root = dirname(fileURLToPath(import.meta.url));
const artifact = resolve(root, "viewer-v7.html");
const dataText = await readFile(resolve(root, "../t07-v7-schema-gold/dataset-v7.json"), "utf8");
const dataset = parseDataset(JSON.parse(dataText));
const index = createQueryIndex(dataset);
const scope = {readAt: dataset.snapshot.readAt, world: "original", perspective: "reader"};
const snapshot = querySnapshot(index, scope);
const evidenceRoot = process.argv[2] ? resolve(process.argv[2]) : resolveAgentRunRoot("t08-v7-memory-viewer", `browser-${randomUUID().slice(0, 8)}`);
await mkdir(evidenceRoot, {recursive: true});
const scratch = await createTestTmpRoot("v7-browser", "isolated browser profile and temporary export");
let browser: BrowserContext | undefined;
const errors: string[] = [];
const requests: string[] = [];
const checks: string[] = [];
const screenshots: string[] = [];
try {
    browser = await chromium.launchPersistentContext(resolve(scratch, "profile"), {channel: "msedge", headless: true, viewport: {width: 1440, height: 1000}, acceptDownloads: true});
    const page = await browser.newPage();
    page.on("pageerror", error => errors.push(error.message));
    page.on("request", request => {if (/^https?:/u.test(request.url())) requests.push(request.url());});
    const screenshot = async (name: string, fullPage = false): Promise<void> => {const path = resolve(evidenceRoot, `${name}.png`); await page.screenshot({path, fullPage}); screenshots.push(path);};
    await page.goto(pathToFileURL(artifact).href);
    await page.locator("#graph .node").first().waitFor();
    assert.equal(await page.locator("#kind").inputValue(), "entity");
    assert.equal(await page.locator("#node-list [data-node]").count(), 24);
    assert.equal(await page.locator("#graph .node").count(), 24);
    assert.equal(await page.locator("#graph .node:not([data-kind=entity])").count(), 0);
    assert.match(await page.locator("#coverage").innerText(), /24 主体\s+58 命题\s+7 情节\s+11 摘要/u);
    assert.ok(await page.locator("#detail .entity-summary p").count() > 0);
    assert.ok(await page.locator("#detail .fact-row").count() > 0);
    assert.ok(await page.locator("#overview .overview-track button").count() > 0);
    await screenshot("viewer-default");
    checks.push("默认24主体自由图与目录，四项知识统计、叙事概览和主体摘要正文可直接读取");
    for (const category of ['person', 'body', 'artifact', 'place', 'concept', 'unresolved']) {
        const sample = snapshot.nodes.find(node => node.kind === 'entity' && node.data.category === category);
        assert.ok(sample);
        const legend = page.locator(`#graph-legend [data-legend-key="entity:${category}"]`);
        assert.equal(await legend.count(), 1);
        assert.ok((await page.locator(`#graph .node[data-node="${sample.id}"] title`).textContent())?.includes(await legend.innerText()));
        await page.locator(`#node-list [data-node="${sample.id}"]`).click();
        assert.equal(await page.locator('#detail .entity-category').innerText(), await legend.innerText());
    }
    const allEdges = await page.locator('#graph .edge').count();
    await page.locator('#show-knowledge').uncheck();
    assert.equal(await page.locator('#graph .knowledge-edge').count(), 0);
    assert.equal(await page.locator('#graph .edge').count(), 11);
    await page.locator('#show-propositions').uncheck();
    assert.equal(await page.locator('#graph .edge').count(), 0);
    assert.equal(await page.locator('#graph-empty').innerText(), '联系已隐藏');
    await page.locator('#show-knowledge').check();
    assert.equal(await page.locator('#graph .knowledge-edge').count(), 16);
    await page.locator('#show-propositions').check();
    assert.equal(await page.locator('#graph .edge').count(), allEdges);
    await page.locator('#node-list [data-node="su"]').click();
    checks.push('主体类别在图例、悬停、详情一致，灰色保留具体类别；两类连线独立开关且空状态明确');

    const creatorEdge = page.locator('#graph [data-knowledge][data-source-node="su"][data-target-node="creator"]');
    assert.equal(await creatorEdge.count(), 1);
    await page.locator('#show-propositions').uncheck();
    await creatorEdge.focus(); await page.keyboard.press("Enter");
    await page.locator('#show-knowledge').uncheck();
    assert.equal(await page.locator('#graph .relation.selected').count(), 0);
    assert.equal(await page.locator('#detail .access-entry').count(), 0);
    await page.locator('#show-knowledge').check();
    await creatorEdge.focus(); await page.keyboard.press('Enter');
    assert.match(await page.locator("#detail").innerText(), /听闻/u);
    assert.equal(await page.locator('#graph .relation.selected[data-knowledge]').count(), 1);
    assert.equal(await page.locator('#detail [data-node="f119"]').count(), 1);
    await screenshot("viewer-creator-knowledge");
    await page.locator('#detail [data-node="f119"]').click();
    assert.match(await page.locator('#detail').innerText(), /发言内容/u);
    await page.locator('#detail .source-evidence summary').click();
    assert.equal(await page.locator('#detail [data-source][data-paragraph="66"]').count(), 1);
    await page.locator('#selection-back').click();
    assert.equal(await page.locator('#show-propositions').isChecked(), false);
    await page.locator('#detail [data-node="access:su:f119"]').click();
    await page.locator('#detail [data-node="d119"]').first().click();
    await page.locator('#detail .source-evidence summary').click();
    await page.locator('#detail [data-source][data-paragraph="66"]').click();
    assert.match(await page.locator('#source-text .paragraph.highlight').innerText(), /造物主/u);
    for (let step = 0; step < 3; step++) await page.locator('#selection-back').click();
    assert.equal(await page.locator('#subject-view').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('#global').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('#graph .relation.selected[data-knowledge]').count(), 1);
    await page.locator('#selection-back').click();
    assert.equal(await page.locator('#graph .relation.selected').count(), 0);
    await page.locator('#show-propositions').check();
    assert.ok((await page.locator('#graph .edge').evaluateAll(edges => edges.map(edge => edge.getAttribute('d') ?? ''))).every(path => /^M[-\d.,]+L[-\d.,]+$/u.test(path)));
    await page.locator('#catalog-filters > summary').click();
    await page.locator('#kind').selectOption('resolution');
    await page.locator('#node-list [data-node="resolve:creator:c1"]').click();
    assert.equal(await page.locator('#graph .node').count(), 4);
    assert.deepEqual((await page.locator('#graph .node-meta').allTextContents()).sort(), ['主体 · 身份未明', '原文词语', '局部指称', '身份判断'].sort());
    assert.equal(await page.locator('#graph .node[data-kind=referent] circle').count(), 0);
    assert.equal(await page.locator('.model-views [aria-pressed="true"]').count(), 1);
    await screenshot('viewer-creator-identity-chain');
    await page.locator('#structure-complete').check();
    assert.ok(await page.locator('#graph .node').count() > 4);
    await page.locator('.graph-settings > summary').click();
    await page.locator('#edge-kind').selectOption('dependency');
    await page.locator('#structure-complete').uncheck();
    assert.equal(await page.locator('#graph .edge').count(), 3);
    await page.locator('.graph-settings > summary').click();
    await page.locator('#subject-view').click();
    checks.push('苏天晴到造物主认知边支持键盘选中、高亮、听闻限定、f119及d119原文回链和三步返回；身份溯源默认四类主链、完整引用可切换；所有边为直线');

    const graph = knowledgeGraph(snapshot.nodes, "su", false, false);
    const pair = graph.edges.find(edge => (edge.factIds?.length ?? 0) > 1);
    assert.ok(pair?.factIds);
    const pairElement = page.locator("#graph [data-pair]").filter({has: page.locator("title")}).first();
    await pairElement.focus();
    await page.keyboard.press("Enter");
    assert.equal(await page.locator("#detail .fact-row").count(), pair.factIds.length);
    await screenshot("viewer-pair");
    await page.locator("#detail .fact-row").first().click();
    assert.ok(await page.locator("#detail").innerText().then(text => /发言|世界命题|角色信念|speech|world|belief/u.test(text)));
    checks.push("同主体对聚合连接支持键盘打开，逐项保留独立命题与判断");

    await page.locator('[data-kind-tab="entity"]').click();
    await page.locator('#node-list [data-node="su"]').click();
    await page.locator("#expand-knowledge").click();
    assert.equal(await page.locator('#graph .node[data-kind="fact"]').count(), 6);
    assert.equal(await page.locator('#claim-page').innerText(), '第 1 / 7 页');
    const expandedVisited = new Set<string>();
    const assertExpandedLabels = async (): Promise<void> => {
        const result = await page.locator('#graph').evaluate(svg => {
            const labels = [...svg.querySelectorAll<SVGGraphicsElement>('.node-label')];
            const boxes = labels.map(label => {
                const node = label.parentElement;
                const transform = node?.getAttribute('transform')?.match(/translate\(([^,]+),([^\)]+)\)/u);
                const bounds = label.getBBox();
                return {left: bounds.x + Number(transform?.[1]), top: bounds.y + Number(transform?.[2]), width: bounds.width, height: bounds.height};
            });
            const width = Number(svg.getAttribute('viewBox')?.split(' ')[2]);
            const height = Number(svg.getAttribute('viewBox')?.split(' ')[3]);
            return {hidden: labels.some(label => getComputedStyle(label).visibility === 'hidden'), outside: boxes.some(box => box.left < 0 || box.left + box.width > width || box.top < 0 || box.top + box.height > height), overlap: boxes.some((a, i) => boxes.slice(i + 1).some(b => a.left < b.left + b.width && a.left + a.width > b.left && a.top < b.top + b.height && a.top + a.height > b.top)), overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1};
        });
        assert.deepEqual(result, {hidden: false, outside: false, overlap: false, overflow: false});
    };
    while (true) {
        for (const id of await page.locator('#graph .node[data-kind=fact]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-node') ?? ''))) expandedVisited.add(id);
        await assertExpandedLabels();
        if (await page.locator('#claim-next').isDisabled()) break;
        await page.locator('#claim-next').click();
    }
    assert.equal(expandedVisited.size, 42);
    const positions = await page.locator('#graph .node').evaluateAll(nodes => nodes.map(node => node.getAttribute('transform')));
    await page.locator('#graph .node[data-kind=fact]').first().focus(); await page.keyboard.press('Enter');
    assert.equal(await page.locator('#subject-view').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('#claim-page').innerText(), '第 7 / 7 页');
    assert.deepEqual(await page.locator('#graph .node').evaluateAll(nodes => nodes.map(node => node.getAttribute('transform'))), positions);
    for (const width of [1440, 768, 390, 320]) {
        await page.setViewportSize({width, height: 1000});
        await page.waitForFunction(() => {
            const svg = document.querySelector<SVGSVGElement>('#graph');
            return svg?.dataset.layout === 'expanded' && Number(svg.dataset.viewportWidth) === Math.max(280, svg.parentElement?.clientWidth ?? 0);
        });
        await assertExpandedLabels();
        await page.locator('#graph-scroll').evaluate(el => {el.scrollLeft = 0; el.scrollTop = 0;});
        if (width < 400) {
            const overlaps = await page.locator('#node-list .node-row').evaluateAll(rows => rows.some(row => {
                const title = row.querySelector('.row-title')?.getBoundingClientRect();
                const box = row.getBoundingClientRect();
                return title && (title.bottom > box.bottom || title.top < box.top);
            }));
            assert.equal(overlaps, false, 'mobile catalog title exceeds its row');
        }
        await screenshot(`viewer-expanded-last-${width}`, width < 400);
        await page.locator('#graph-scroll').evaluate(el => {el.scrollLeft = el.scrollWidth; el.scrollTop = el.scrollHeight;});
        assert.ok(await page.locator('#graph-scroll').evaluate(el => el.scrollTop > 0));
    }
    await page.setViewportSize({width: 1440, height: 1000});
    await page.locator('#reset-graph').click();
    await assertExpandedLabels();
    await page.locator('#node-list [data-node="f226"]').click();
    await page.locator('#selection-back').click();
    assert.equal(await page.locator('#claim-page').innerText(), '第 7 / 7 页');
    await screenshot("viewer-protagonist-local");
    checks.push("苏天晴42条相关命题7页全可达，末页桌面/768/390/320标签可见且无重叠，画布可滚动；选中命题保留展开状态、页码与节点位置，重排有效");
    await page.locator("#expand-knowledge").click();
    await page.locator("#global").click();

    await page.locator("#proposition-view").click();
    await page.locator("#claim-all").click();
    const allFactIds = snapshot.nodes.filter(node => node.kind === "fact").map(node => node.id);
    const visited = new Set<string>();
    while (true) {
        for (const id of await page.locator('#graph .node[data-kind="fact"]').evaluateAll(nodes => nodes.map(node => node.getAttribute("data-node") ?? ""))) visited.add(id);
        if (await page.locator("#claim-next").isDisabled()) break;
        await page.locator("#claim-next").click();
    }
    assert.deepEqual([...visited].sort(), allFactIds.sort());
    await page.locator("#assertion").selectOption("world");
    await page.locator("#claim-all").click();
    assert.ok(await page.locator("#graph .node-meta").count() > 0);
    assert.ok((await page.locator("#graph .node[data-kind=fact] .node-meta").allTextContents()).every(text => text.includes("世界命题")));
    await page.locator("#node-list [data-node]").first().click();
    assert.equal(await page.locator('#graph .node.selected[data-kind="fact"]').count(), 1);
    assert.equal(await page.locator("#node-list .selected").count(), 1);
    await screenshot("viewer-world-proposition");
    await page.locator('#global').click();
    assert.ok(await page.locator('#graph .node[data-kind="fact"]').count() > 1);
    await page.locator("#selection-back").click();
    await page.locator("#subject-view").click();
    await page.locator('#node-list [data-node="book"]').click();
    await page.locator('[data-detail-target="detail-identity"]').click();
    assert.match(await page.locator("#detail .name-history").innerText(), /黑色古书/u);
    assert.match(await page.locator("#detail .name-history").innerText(), /墨丘利秘典/u);
    await page.locator("#detail .mentions summary").click();
    assert.ok(await page.locator("#detail .mentions [data-source]").count() > 0);
    await screenshot("viewer-book-identity");
    await page.locator('#node-list [data-node="su"]').click();
    checks.push("命题分页覆盖全部58条，世界命题类别/评估常显，图与目录选择同步，古书名称沿革与原文提及可达");

    await page.locator("#detail .fact-row").first().click();
    await page.locator("#selection-back").click();
    assert.equal(await page.locator('#node-list [data-node="su"].selected').count(), 1);
    assert.equal(await page.locator('#graph .node[data-node="su"].selected').count(), 1);
    assert.equal(await page.locator("#subject-view").getAttribute("aria-pressed"), "true");
    await page.locator("#kind").selectOption("all");
    await page.locator("#search").fill("金色");
    assert.ok(await page.locator("#node-list [data-node]").count() > 0);
    await page.locator("#search").fill("no-such-proposition-753951");
    assert.equal(await page.locator("#node-list [data-node]").count(), 0);
    await page.locator("#search").fill("");
    await page.locator("#subject-view").click();
    const acceptedNodes = snapshot.nodes.filter(node => node.kind !== "fact" || snapshot.nodes.some(assessment => assessment.kind === "assessment" && assessment.data.target.id === node.id && assessment.data.epistemic === "accepted"));
    const acceptedPair = knowledgeGraph(acceptedNodes, "su", false, false).edges.find(edge => (edge.factIds?.length ?? 0) > 1);
    assert.ok(acceptedPair?.factIds);
    await page.locator("#status").selectOption("accepted");
    const filteredPair = page.locator("#graph [data-pair]").filter({has: page.locator("title")}).first();
    await filteredPair.focus(); await page.keyboard.press("Enter");
    const shownFactIds = await page.locator("#detail .fact-row").evaluateAll(nodes => nodes.map(node => node.getAttribute("data-node")));
    assert.deepEqual(shownFactIds, acceptedPair.factIds);
    await page.locator("#status").selectOption("all");
    await page.locator('#node-list [data-node="su"]').click();
    checks.push("返回恢复主体/图/目录，全文内容搜索含空结果，状态过滤后聚合连接仅包含保留的命题");

    const node = page.locator('#graph .node[data-node="su"]');
    const before = await node.getAttribute("transform");
    const box = await node.boundingBox();
    assert.ok(box);
    await page.mouse.move(box.x + box.width / 2, box.y + 10);
    await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 + 45, box.y + 35, {steps: 8}); await page.mouse.up();
    assert.notEqual(await page.locator('#graph .node[data-node="su"]').getAttribute("transform"), before);
    const sceneBefore = await page.locator("#graph .scene").getAttribute("transform");
    await page.locator("#graph").hover(); await page.mouse.wheel(0, -200);
    await page.waitForFunction(previous => document.querySelector("#graph .scene")?.getAttribute("transform") !== previous, sceneBefore);
    await page.locator("#reset-graph").click();
    checks.push("主体可拖拽，图可滚轮缩放并重排");

    await page.locator("#structure").click();
    await page.locator("#structure-complete").check();
    await page.locator('.graph-settings > summary').click();
    await page.locator('#edge-kind').selectOption('all');
    await page.locator('.graph-settings > summary').click();
    const structural = structuralEdges(snapshot.edges);
    const neighbors = new Set(["su", ...structural.filter(edge => edge.source === "su" || edge.target === "su").flatMap(edge => [edge.source, edge.target])]);
    const expected = structural.filter(edge => neighbors.has(edge.source) && neighbors.has(edge.target));
    assert.equal(await page.locator("#graph .edge").count(), expected.length);
    await screenshot("viewer-structure");
    await page.locator("#subject-view").click();
    checks.push("显式记录结构按依赖/引用去重，不重复叠加角色投影");

    const shapeStyles = new Map<string, {color: string; shape: string | null}>();
    for (const [kind, count] of [["fact", 58], ["episode", 7], ["entitySummary", 11]] as const) {
        await page.locator(`[data-kind-tab="${kind}"]`).click();
        assert.equal(await page.locator("#node-list [data-node]").count(), count);
        await page.locator("#node-list [data-node]").first().click();
        assert.ok(await page.locator("#detail h2").innerText());
        if (kind !== 'entitySummary') shapeStyles.set(kind, await page.locator(`#graph .node.selected[data-kind="${kind}"] .node-shape`).evaluate(shape => ({color: getComputedStyle(shape).stroke, shape: shape.getAttribute('d')})));
    }
    assert.notEqual(shapeStyles.get('fact')?.color, shapeStyles.get('episode')?.color);
    assert.notEqual(shapeStyles.get('fact')?.shape, shapeStyles.get('episode')?.shape);
    await page.locator('[data-kind-tab="entity"]').click();
    await page.locator('#node-list [data-node="su"]').click();
    await page.locator("#detail .entity-summary details").first().locator("summary").click();
    await page.locator("#detail .entity-summary details [data-node]").first().click();
    assert.ok(await page.locator("#detail ol li").count() > 0);
    await page.locator("#kind").selectOption("disclosure");
    await page.locator("#node-list [data-node]").first().click();
    await page.locator("#detail .source-evidence > summary").click();
    await page.locator("#detail [data-source]").first().click();
    assert.ok(await page.locator("#source-text .paragraph").count() > 0);
    checks.push("主体/命题/情节/摘要切换、摘要逐项依据与披露原文跳转均可操作");

    await page.locator("#chapter").selectOption("1");
    await page.locator("#kind").selectOption("all");
    const firstSource = dataset.sources.find(source => source.chapterOrder === 1);
    assert.ok(firstSource);
    const early = querySnapshot(index, {...scope, readAt: {chapter: 1, paragraph: firstSource.paragraphs.length}});
    assert.equal(await page.locator("#node-list [data-node]").count(), early.nodes.length);
    await page.locator("#position").fill("1"); await page.locator("#position").dispatchEvent("input");
    assert.equal(await page.locator("#source-text .paragraph").count(), 1);
    await page.locator("#chapter-end").click();
    await page.locator('[data-tab="graph"]').click();
    await page.locator("#import-file").setInputFiles({name: "bad.json", mimeType: "application/json", buffer: Buffer.from('{"schema":"wrong"}')});
    await page.locator("#message.error").waitFor();
    assert.equal(await page.locator("#node-list [data-node]").count(), early.nodes.length);
    await page.locator("#import-file").setInputFiles({name: "gold.json", mimeType: "application/json", buffer: Buffer.from(dataText)});
    await page.waitForFunction(() => document.getElementById("message")?.textContent?.startsWith("已导入"));
    const downloadPromise = page.waitForEvent("download"); await page.locator("#export-button").click();
    const exported = resolve(scratch, "export.json"); await (await downloadPromise).saveAs(exported);
    assert.deepEqual(parseDataset(JSON.parse(await readFile(exported, "utf8"))), dataset);
    checks.push("前章和段落边界有效，错误导入保留旧数据，导入导出往返完整");

    const withdrawn = structuredClone(dataset);
    withdrawn.invalidationRoots.push({id: "mention:book:c1:2", revision: 1});
    await page.locator("#import-file").setInputFiles({name: "withdrawn.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(withdrawn))});
    await page.waitForFunction(() => document.getElementById("message")?.textContent?.startsWith("已导入"));
    await page.locator('#node-list [data-node="book"]').click();
    assert.equal(await page.locator("#detail h2").innerText(), "黑色古书");
    assert.doesNotMatch(await page.locator("#detail .name-history").innerText(), /墨丘利秘典/u);
    await page.locator("#import-file").setInputFiles({name: "gold.json", mimeType: "application/json", buffer: Buffer.from(dataText)});
    await page.waitForFunction(() => document.querySelector('#node-list [data-node="book"] .row-title')?.textContent === "墨丘利秘典");
    checks.push("导入名称依据失效数据后，主体仍在而正式名称退回黑色古书");

    const access = snapshot.nodes.find(node => node.kind === "knowledgeAccess" && node.data.mode !== "unaware");
    assert.ok(access?.kind === "knowledgeAccess");
    await page.locator("#perspective").selectOption(access.data.holder.id);
    await page.locator("#kind").selectOption("all");
    assert.equal(await page.locator("#node-list [data-node]").count(), querySnapshot(index, {...scope, perspective: access.data.holder.id}).nodes.length);
    await page.locator('[data-tab="story"]').click();
    assert.equal(await page.locator("#source-text .paragraph").count(), 0);
    await page.locator("#perspective").selectOption("reader");
    await page.locator('[data-tab="graph"]').click();
    await page.locator('[data-kind-tab="entity"]').click();
    await page.locator('#node-list [data-node="su"]').click();
    checks.push("角色显式知情投影与整章原文隔离保持有效");
    await page.locator('#catalog-filters > summary').click();
    for (const [step, width] of [1440, 1024, 768, 390, 320, 1440, 320, 320].entries()) {
        await page.setViewportSize({width, height: 1000});
        if (step === 7) await page.reload();
        await page.waitForFunction(() => {
            const svg = document.querySelector<SVGSVGElement>("#graph");
            return svg && svg.viewBox.baseVal.width === Math.max(280, svg.parentElement?.clientWidth ?? 0);
        });
        await page.evaluate(() => window.scrollTo(0, 0));
        const size = await page.evaluate(() => ({width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth}));
        assert.ok(size.scroll <= size.width + 1, `${width}px overflow`);
        assert.equal(await page.locator("#graph .node").count(), 24);
        const collisions = await page.locator("#graph .node circle").evaluateAll(elements => {
            const boxes = elements.map(element => element.getBoundingClientRect());
            return boxes.flatMap((a, index) => boxes.slice(index + 1).filter(b => Math.hypot((a.left + a.right - b.left - b.right) / 2, (a.top + a.bottom - b.top - b.bottom) / 2) < (a.width + b.width) / 2 + 3));
        });
        assert.equal(collisions.length, 0, `${width}px node circles collide`);
        const coordinates = await page.locator("#graph .node").evaluateAll(elements => elements.map(element => element.getAttribute("transform")));
        await page.locator('#node-list [data-node="su"]').click();
        assert.deepEqual(await page.locator("#graph .node").evaluateAll(elements => elements.map(element => element.getAttribute("transform"))), coordinates, "selection must not shrink cached layout");
        if (width <= 390) {
            assert.equal(await page.locator("#graph .edge-label").evaluateAll(elements => elements.filter(element => element.textContent).length), 0);
            const overlaps = await page.locator("#graph .node-label").evaluateAll(elements => {
                const boxes = elements.filter(element => getComputedStyle(element).visibility !== "hidden").map(element => element.getBoundingClientRect());
                return boxes.some((a, index) => boxes.slice(index + 1).some(b => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top));
            });
            assert.equal(overlaps, false, "mobile visible labels overlap");
        }
        await page.evaluate(() => window.scrollTo(0, 0));
        await screenshot(`viewer-${width}${step > 4 ? step === 7 ? "-fresh" : "-return" : ""}`, width <= 390);
    }
    checks.push("1440/1024/768/390/320视口及桌面手机往返、320直接载入：24主体圆无碰撞，重复选择坐标不缩小，无横向溢出");
    await page.locator("#proposition-view").click();
    await page.locator("#claim-all").click();
    assert.equal(await page.locator('#graph .node[data-kind="fact"]').count(), 6);
    await screenshot("viewer-320-propositions", true);
    await page.locator("#node-list [data-node]").first().click();
    assert.equal(await page.locator('#graph .node.selected[data-kind="fact"]').count(), 1);
    const mobileClaim = await page.evaluate(() => ({width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth, meta: document.querySelector("#graph .node.selected .node-meta")?.textContent}));
    assert.ok(mobileClaim.scroll <= mobileClaim.width + 1);
    assert.ok(mobileClaim.meta);
    await screenshot("viewer-320-selected-proposition", true);
    checks.push("320窄屏可翻命题页并从目录选择命题，分类/评估可见，无横向溢出");
    await page.locator('#catalog-filters > summary').click();
    await page.locator('#kind').selectOption('resolution');
    await page.locator('#node-list [data-node="resolve:creator:c1"]').click();
    await page.locator('#structure-complete').uncheck();
    assert.equal(await page.locator('#graph .node').count(), 4);
    assert.equal(await page.locator('#graph .node-label').evaluateAll(labels => labels.filter(label => getComputedStyle(label).visibility === 'visible').length), 4);
    await screenshot('viewer-320-identity-chain', true);
    await page.locator('#subject-view').click();
    await page.locator('#node-list [data-node="creator"]').click();
    await page.locator('#local').click();
    await creatorEdge.focus(); await page.keyboard.press('Enter');
    assert.match(await page.locator('#detail').innerText(), /听闻相关说法/u);
    await screenshot('viewer-320-knowledge', true);
    assert.ok(await page.locator('#node-list').evaluate(list => list.clientHeight >= 120));
    assert.deepEqual(errors, []); assert.deepEqual(requests, []);
    const report = {schema: "neurobook.v7-viewer-browser/v2", artifact, htmlSha256: createHash("sha256").update(await readFile(artifact)).digest("hex"), engine: "isolated headless Microsoft Edge (Chromium)", checks, screenshots, pageErrors: errors, externalRequests: requests, humanAcceptance: false};
    await writeFile(resolve(evidenceRoot, "browser-result.json"), JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify(report, null, 2));
} finally {
    try {await browser?.close();} finally {await rm(scratch, {recursive: true, force: true});}
}
