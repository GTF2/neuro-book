import {createQueryIndex, parseDataset, queryEntitySummaries, querySnapshot, type MemoryDataset, type MemoryNode, type Position} from "../t07-v7-schema-gold/index.ts";
import {escapeHtml as esc, filterItems, kindLabels, localNodeIds} from "./view-model.ts";
import {accessLabels, assertionLabels, epistemicFor, renderDetail, statusLabel} from "./detail.ts";
import {renderGraph, resetGraphLayout} from "./graph.ts";
import {expandedKnowledgeGraph, knowledgeGraph, propositionGraph, structuralEdges} from "./knowledge-graph.ts";
import {identityChain} from "./structure-graph.ts";
import {nodeAppearance} from "./visual-semantics.ts";

function element<T extends HTMLElement>(id: string, constructor: {new(...args: never[]): T}): T {
    const node = document.getElementById(id);
    if (!(node instanceof constructor)) throw new Error(`Missing page element: ${id}`);
    return node;
}
const ui = {
    chapter: element("chapter", HTMLSelectElement), position: element("position", HTMLInputElement), perspective: element("perspective", HTMLSelectElement),
    kind: element("kind", HTMLSelectElement), status: element("status", HTMLSelectElement), search: element("search", HTMLInputElement),
    list: element("node-list", HTMLDivElement), detail: element("detail", HTMLElement),
    file: element("import-file", HTMLInputElement), zoom: element("zoom", HTMLInputElement),
    edgeKind: element("edge-kind", HTMLSelectElement), edgeLabels: element("edge-labels", HTMLSelectElement),
};
const svg = document.getElementById("graph");
if (!(svg instanceof SVGSVGElement)) throw new Error("Missing graph SVG");
const graphSvg = svg;
let dataset: MemoryDataset;
let index: ReturnType<typeof createQueryIndex>;
let snapshot: ReturnType<typeof querySnapshot>;
let selected: string | null = null;
let readAt: Position = {chapter: 1, paragraph: 1};
let graphMode: "local" | "global" = "global";
let structure = false;
let expandKnowledge = false;
let graphLimit = 100;
let tab: "graph" | "story" = "graph";
let importGeneration = 0;
let propositions = false;
let completeStructure = false;
let propositionPage = 0;
let focusEntity: string | null = null;
let selectedEdge: string | null = null;
let showPropositionEdges = true;
let showKnowledgeEdges = true;
let displayedKnowledgeEdges: ReturnType<typeof knowledgeGraph>["edges"] = [];
interface SelectionState {id: string | null; edgeId: string | null; focusEntity: string | null; kind: string; search: string; status: string; assertion: string; propositions: boolean; structure: boolean; completeStructure: boolean; graphMode: "local" | "global"; expandKnowledge: boolean; propositionPage: number; showPropositionEdges: boolean; showKnowledgeEdges: boolean; tab: "graph" | "story"}
const selectionHistory: SelectionState[] = [];
const assertion = element("assertion", HTMLSelectElement);

function rememberSelection(): void {
    selectionHistory.push({id: selected, edgeId: selectedEdge, focusEntity, kind: ui.kind.value, search: ui.search.value, status: ui.status.value, assertion: assertion.value, propositions, structure, completeStructure, graphMode, expandKnowledge, propositionPage, showPropositionEdges, showKnowledgeEdges, tab});
}

for (const [kind, label] of Object.entries(kindLabels)) ui.kind.add(new Option(label, kind));

function report(message: string, error = false): void {
    const target = element("message", HTMLDivElement);
    target.textContent = message;
    target.classList.toggle("error", error);
    target.setAttribute("role", error ? "alert" : "status");
    target.hidden = false;
}

function install(next: MemoryDataset): void {
    // Commit UI state only after parsing and indexing succeed, so a failed import preserves the old book.
    const nextIndex = createQueryIndex(next);
    dataset = next;
    index = nextIndex;
    readAt = {...next.snapshot.readAt};
    selected = null;
    selectedEdge = null; focusEntity = null;
    structure = false; propositions = false; completeStructure = false;
    graphMode = "global"; expandKnowledge = false; propositionPage = 0;
    showPropositionEdges = true; showKnowledgeEdges = true;
    selectionHistory.length = 0;
    assertion.value = "all";
    ui.search.value = "";
    ui.kind.value = "entity";
    resetGraphLayout();
    ui.status.value = "all";
    ui.perspective.replaceChildren(new Option("读者", "reader"));
    const holders = new Set(next.nodes.filter((node) => node.kind === "knowledgeAccess").map((node) => node.data.holder.id));
    for (const id of holders) ui.perspective.add(new Option(next.nodes.find((node) => node.id === id)?.label ?? id, id));
    ui.chapter.replaceChildren(...[...next.sources].filter((source) => source.chapterOrder <= next.snapshot.readAt.chapter).sort((a, b) => a.chapterOrder - b.chapterOrder).map((source) => new Option(`第 ${source.chapterOrder} 章`, String(source.chapterOrder))));
    element("book-title", HTMLParagraphElement).textContent = next.book.title;
    document.title = `${next.book.title} · V7 记忆图`;
    refreshScope();
}

function refreshScope(): void {
    const source = dataset.sources.find((item) => item.chapterOrder === readAt.chapter);
    if (!source) throw new Error("阅读位置没有对应章节");
    const paragraphLimit = source.chapterOrder === dataset.snapshot.readAt.chapter ? Math.min(source.paragraphs.length, dataset.snapshot.readAt.paragraph) : source.paragraphs.length;
    readAt.paragraph = Math.min(readAt.paragraph, paragraphLimit);
    ui.chapter.value = String(readAt.chapter);
    ui.position.max = String(paragraphLimit);
    ui.position.value = String(readAt.paragraph);
    element("position-label", HTMLOutputElement).textContent = `${readAt.paragraph} / ${source.paragraphs.length} 段`;
    snapshot = querySnapshot(index, {readAt, perspective: ui.perspective.value, world: "original"});
    if (!snapshot.nodes.some((node) => node.id === selected)) selected = snapshot.nodes.find((node) => node.kind === "entity")?.id ?? snapshot.nodes[0]?.id ?? null;
    if (!snapshot.nodes.some(node => node.id === focusEntity && node.kind === "entity")) focusEntity = snapshot.nodes.find(node => node.id === selected && node.kind === "entity")?.id ?? snapshot.nodes.find(node => node.kind === "entity")?.id ?? null;
    selectedEdge = null;
    element("snapshot-label", HTMLParagraphElement).textContent = `${dataset.snapshot.sourceManifest} · 知识版本 ${dataset.snapshot.knowledgeRevision}`;
    const coverage = snapshot.coverage;
    const count = (kind: string): number => snapshot.nodes.filter(node => node.kind === kind).length;
    element("coverage", HTMLDivElement).innerHTML = `<span><strong>${count("entity")}</strong> 主体</span><span><strong>${count("fact")}</strong> 命题</span><span><strong>${count("episode")}</strong> 情节</span><span><strong>${count("entitySummary")}</strong> 摘要</span><details><summary>结构统计与覆盖</summary><p>${snapshot.nodes.length} 条记录；${snapshot.edges.filter(edge => edge.kind === "dependency").length} 条依赖，${snapshot.edges.filter(edge => edge.kind === "reference").length} 条引用，${snapshot.edges.filter(edge => edge.kind === "semantic").length} 条命题角色投影。角色投影与引用可能同端点，不是独立小说关系。</p><p>${snapshot.unavailable.length} 条未就绪；${coverage.gaps.map(esc).join("；")}</p></details>`;
    const overview = element("overview", HTMLDivElement);
    const beats = snapshot.nodes.filter(node => node.kind === "beat" && node.data.chapterId === source.chapterId);
    overview.innerHTML = `<span>叙事</span><div class="overview-track">${beats.map(node => node.kind === "beat" ? `<button data-node="${esc(node.id)}" title="${esc(node.data.gist)}" style="left:${(node.data.fromParagraph - 1) / source.paragraphs.length * 100}%;width:${(node.data.toParagraph - node.data.fromParagraph + 1) / source.paragraphs.length * 100}%"></button>` : "").join("")}</div><span>披露</span><div class="overview-track disclosures">${snapshot.nodes.filter(node => node.kind === "disclosure" && node.availableAt.chapter === readAt.chapter).map(node => `<button data-node="${esc(node.id)}" title="${esc(node.label)}" style="left:${(node.availableAt.paragraph - 1) / source.paragraphs.length * 100}%;width:${100 / source.paragraphs.length}%"></button>`).join("")}</div>`;
    render();
}

function filteredNodes(): MemoryNode[] {
    return filterItems(snapshot.nodes, ui.search.value, ui.kind.value).filter((node) => ui.status.value === "all"
        || node.readiness === ui.status.value || epistemicFor(node, snapshot.nodes) === ui.status.value)
        .filter(node => assertion.value === "all" || node.kind === "fact" && node.data.assertion.kind === assertion.value);
}

function accessMode(id: string): string {
    return snapshot.knowledge.filter((item) => item.target === id).map((item) => accessLabels[item.mode] ?? item.mode).join(" / ");
}

function render(): void {
    const filtered = filteredNodes();
    element("selection-back", HTMLButtonElement).disabled = !selectionHistory.some(item => item.id === null || snapshot.nodes.some(node => node.id === item.id));
    for (const button of document.querySelectorAll<HTMLButtonElement>("[data-kind-tab]")) button.setAttribute("aria-pressed", String(button.dataset.kindTab === ui.kind.value));
    element("list-count", HTMLParagraphElement).textContent = `${filtered.length} 条匹配 / ${snapshot.nodes.length} 条范围内记录`;
    ui.list.innerHTML = filtered.length ? filtered.map((node) => {
        const epistemic = epistemicFor(node, snapshot.nodes);
        const appearance = nodeAppearance(node);
        return `<button class="node-row${node.id === selected ? " selected" : ""}" data-node="${esc(node.id)}" title="${esc(`${node.label} · ${appearance.label}`)}" aria-pressed="${node.id === selected}"><i class="type-swatch" data-shape="${appearance.shape}" style="--type-color:${appearance.color}"></i><span class="row-title">${esc(node.label)}</span><span class="row-meta">${esc(node.kind === "fact" ? assertionLabels[node.data.assertion.kind] ?? node.kind : appearance.label)} · ${esc(statusLabel(epistemic ?? node.readiness))}${accessMode(node.id) ? ` · ${esc(accessMode(node.id))}` : ""} · ${node.availableAt.chapter}:${node.availableAt.paragraph}</span></button>`;
    }).join("") : '<p class="empty">当前阅读范围没有匹配记录。可调整类型、状态或搜索内容。</p>';
    if (ui.status.value === "stale" || ui.status.value === "pending") {
        const unavailable = snapshot.unavailable.filter((node) => node.reason === ui.status.value);
        ui.list.innerHTML = `<p class="notice">${unavailable.length} 条${statusLabel(ui.status.value)}记录；完成依赖复核前不提供知识内容。</p>`;
    }
    renderDiagram();
    const node = snapshot.nodes.find((item) => item.id === selected);
    const summaries = node?.kind === "entity" ? queryEntitySummaries(index, node.id, {readAt, perspective: ui.perspective.value, world: "original"}) : undefined;
    ui.detail.innerHTML = node ? renderDetail(node, snapshot.nodes, dataset.sources, summaries?.items) : '<p class="empty">当前阅读范围没有可选记录。</p>';
    if (node && accessMode(node.id)) ui.detail.insertAdjacentHTML("afterbegin", `<p class="notice">当前角色：${esc(accessMode(node.id))}</p>`);
    if (selectedEdge) renderEdgeDetail(selectedEdge);
    if (tab === "story") renderStory();
}

function renderDiagram(): void {
    const ownedEdges = structuralEdges(snapshot.edges);
    const neighborhood = selected ? localNodeIds(selected, ownedEdges, 1) : new Set<string>();
    const factIds = new Set(filterItems(snapshot.nodes, ui.search.value, "fact").filter(node => (assertion.value === "all" || node.kind === "fact" && node.data.assertion.kind === assertion.value) && (ui.status.value === "all" || epistemicFor(node, snapshot.nodes) === ui.status.value)).map(node => node.id));
    const graphNodes = snapshot.nodes.filter(node => node.kind !== "fact" || factIds.has(node.id));
    const claimFocus = snapshot.nodes.find(node => node.id === selected)?.kind === "fact" ? selected : graphMode === "local" ? focusEntity : null;
    const claimGraph = propositionGraph(snapshot.nodes, claimFocus, factIds, propositionPage);
    const expanded = expandKnowledge && !propositions && !structure && Boolean(focusEntity);
    const expandedGraph = expandedKnowledgeGraph(graphNodes, focusEntity, factIds, propositionPage);
    const pagedGraph = expanded ? expandedGraph : claimGraph;
    if (expanded || propositions) propositionPage = pagedGraph.page;
    const knowledge = propositions ? claimGraph : expanded ? expandedGraph : knowledgeGraph(graphNodes, focusEntity, false, graphMode === "local");
    const visibleKnowledgeEdges = knowledge.edges.filter(edge => edge.accesses ? showKnowledgeEdges : showPropositionEdges);
    displayedKnowledgeEdges = visibleKnowledgeEdges;
    if (selectedEdge && !visibleKnowledgeEdges.some(edge => edge.id === selectedEdge)) selectedEdge = null;
    const chain = structure && !completeStructure ? identityChain(snapshot.nodes, selected) : null;
    const matching = structure ? chain?.nodes ?? snapshot.nodes.filter(node => neighborhood.has(node.id)) : knowledge.nodes;
    const nodes = matching.slice(0, graphLimit);
    const ids = new Set(nodes.map((node) => node.id));
    const edges = (structure ? chain?.edges ?? ownedEdges : visibleKnowledgeEdges).filter(edge => ids.has(edge.source) && ids.has(edge.target) && (!structure || chain || ui.edgeKind.value === "all" || edge.kind === ui.edgeKind.value));
    renderGraph(graphSvg, nodes, edges, selected, Number(ui.zoom.value), ui.edgeLabels.value, snapshot.nodes, Boolean(chain), selectedEdge, {expanded: expanded || propositions, focusId: focusEntity});
    element("global", HTMLButtonElement).setAttribute("aria-pressed", String(graphMode === "global"));
    element("local", HTMLButtonElement).setAttribute("aria-pressed", String(graphMode === "local"));
    element("global", HTMLButtonElement).textContent = propositions ? "全部命题" : "全部主体";
    element("local", HTMLButtonElement).textContent = propositions ? "选中主体的命题" : "选中主体周边";
    const description = element("graph-description", HTMLParagraphElement);
    const focusName = snapshot.nodes.find(node => node.id === focusEntity)?.label;
    const pageCount = Math.min(6, Math.max(0, pagedGraph.total - pagedGraph.page * 6));
    description.textContent = structure ? `${chain ? "名称与身份链" : "直接依赖与引用"} · ${nodes.length} 条记录 / ${edges.length} 条连接` : expanded || propositions ? `${expanded ? `${focusName ?? "选中主体"}相关命题` : graphMode === "local" ? `${focusName ?? "选中主体"}的命题` : "已读命题"} · ${pagedGraph.total} 条 · 本页 ${pageCount} 条` : `${graphMode === "local" ? `${focusName ?? "选中主体"}周边` : "已读主体"} · ${nodes.filter(node => node.kind === "entity").length} 主体 · ${visibleKnowledgeEdges.filter(edge => edge.factIds).length} 组命题联系 · ${visibleKnowledgeEdges.filter(edge => edge.accesses).length} 组认知联系`;
    element("claim-pagination", HTMLDivElement).hidden = !(propositions || expanded) || structure;
    element("claim-page", HTMLOutputElement).textContent = `第 ${pagedGraph.page + 1} / ${pagedGraph.pages} 页`;
    element("claim-previous", HTMLButtonElement).disabled = pagedGraph.page === 0;
    element("claim-next", HTMLButtonElement).disabled = pagedGraph.page + 1 >= pagedGraph.pages;
    element("claim-all", HTMLButtonElement).hidden = expanded;
    element("structure", HTMLButtonElement).setAttribute("aria-pressed", String(structure));
    if (matching.length > graphLimit) {
        const more = document.createElement("button");
        more.textContent = "再显示 100 个节点";
        more.className = "more-button";
        more.addEventListener("click", () => {graphLimit += 100; renderDiagram();});
        description.append(more);
    }
    const appearances = new Map(nodes.map(node => {const appearance = nodeAppearance(node); return [appearance.key, appearance] as const;}));
    element("graph-legend", HTMLDivElement).innerHTML = [...appearances.values()].map(appearance => `<span data-legend-key="${esc(appearance.key)}" title="${esc(appearance.label)}"><i class="type-swatch" data-shape="${appearance.shape}" style="--type-color:${appearance.color}"></i>${esc(appearance.label)}</span>`).join("") + (structure && !chain ? '<span>虚线：依赖 · 实线：引用</span>' : '');
    element("edge-visibility", HTMLDivElement).hidden = structure;
    element("show-propositions", HTMLInputElement).checked = showPropositionEdges;
    element("show-knowledge", HTMLInputElement).checked = showKnowledgeEdges;
    element("show-knowledge-control", HTMLLabelElement).hidden = propositions;
    element("graph-empty", HTMLParagraphElement).hidden = structure || edges.length > 0;
    element("graph-empty", HTMLParagraphElement).textContent = !showPropositionEdges && (!showKnowledgeEdges || propositions) ? "联系已隐藏" : "当前范围没有匹配的联系";
    element("subject-view", HTMLButtonElement).setAttribute("aria-pressed", String(!propositions && !structure));
    element("proposition-view", HTMLButtonElement).setAttribute("aria-pressed", String(propositions && !structure));
    element("graph-scope", HTMLDivElement).hidden = structure || expanded;
    element("expand-control", HTMLLabelElement).hidden = structure || propositions;
    element("structure-control", HTMLLabelElement).hidden = !structure;
    element("edge-kind-control", HTMLLabelElement).hidden = !structure || Boolean(chain);
    element("local", HTMLButtonElement).disabled = !focusEntity;
    element("expand-knowledge", HTMLInputElement).checked = expandKnowledge;
    element("expand-knowledge", HTMLInputElement).disabled = !focusEntity;
    element("structure-complete", HTMLInputElement).checked = completeStructure;
}

function renderStory(): void {
    const source = dataset.sources.find((item) => item.chapterOrder === readAt.chapter);
    if (!source) return;
    if (ui.perspective.value !== "reader") {
        element("beat-list", HTMLDivElement).replaceChildren();
        element("source-text", HTMLDivElement).innerHTML = '<p class="notice">角色视角仅展示知情记录中的摘录。</p>';
        return;
    }
    const beats = snapshot.nodes.filter((node) => node.kind === "beat" && node.data.chapterId === source.chapterId);
    element("beat-list", HTMLDivElement).innerHTML = `<h2>当前章的叙事片段</h2>${beats.length ? beats.map((node) => `<button class="beat-row" data-node="${esc(node.id)}">${esc(node.label)}<span class="row-meta">${node.kind === "beat" ? `${node.data.fromParagraph}–${node.data.toParagraph} 段` : ""}</span></button>`).join("") : '<p class="muted">当前边界尚无完整可见的叙事片段。</p>'}`;
    const selectedNode = snapshot.nodes.find((node) => node.id === selected);
    element("source-text", HTMLDivElement).innerHTML = `<h2>${esc(source.title)}</h2><p class="muted">只显示当前阅读边界内的原文。段号可设为新的阅读边界。</p>${source.paragraphs.slice(0, readAt.paragraph).map((text, i) => `<div class="paragraph${selectedNode?.spans.some((span) => span.sourceId === source.id && span.paragraph === i + 1) ? " highlight" : ""}" id="paragraph-${i + 1}"><button data-read-paragraph="${i + 1}" aria-label="读至第 ${i + 1} 段">${i + 1}</button><p>${esc(text)}</p></div>`).join("")}`;
}

function selectNode(id: string, focusDetail = false): void {
    const next = snapshot.nodes.find(node => node.id === id);
    if (!next) return;
    if (selected !== id || selectedEdge) rememberSelection();
    const onExpandedPage = expandKnowledge && !propositions && !structure && next.kind === "fact" && [...graphSvg.querySelectorAll(".node")].some(node => node.getAttribute("data-node") === id);
    const sameFocus = focusEntity === id;
    selected = id;
    selectedEdge = null;
    if (next.kind === "entity") focusEntity = id;
    if (!onExpandedPage && !sameFocus) propositionPage = 0;
    if (!structure) {
        if (next.kind === "fact") {if (!onExpandedPage) propositions = true;}
        else if (next.kind !== "entity") {structure = true; propositions = false;}
    }
    if (onExpandedPage) ui.kind.value = "fact";
    else if (!filteredNodes().some(node => node.id === id)) {ui.kind.value = next.kind; ui.search.value = ""; ui.status.value = "all"; assertion.value = "all";}
    render();
    ui.list.querySelector<HTMLElement>(".selected")?.scrollIntoView({block: "nearest"});
    ui.detail.scrollTop = 0;
    if (focusDetail) ui.detail.querySelector<HTMLElement>("h2")?.focus();
}

function renderEdgeDetail(id: string): void {
    const edge = displayedKnowledgeEdges.find(item => item.id === id);
    if (!edge) {selectedEdge = null; return;}
    if (edge.accesses) {
        const names = [edge.source, edge.target].map(value => snapshot.nodes.find(node => node.id === value)?.label ?? value);
        ui.detail.innerHTML = `<span class="tag">认知联系</span><h2 tabindex="-1">${names.map(esc).join(" · ")}</h2><p class="notice">${esc(edge.label)}</p>${edge.accesses.map(access => {
            const fact = snapshot.nodes.find(node => node.id === access.factId);
            const record = snapshot.nodes.find(node => node.id === access.accessId);
            return `<section class="access-entry"><h3>${esc(accessLabels[access.mode] ?? access.mode)}<span class="muted"> · 第 ${record?.availableAt.chapter} 章第 ${record?.availableAt.paragraph} 段</span></h3>${fact ? `<button class="fact-row" data-node="${esc(fact.id)}"><span>${esc(fact.label)}</span><small>${fact.kind === "fact" ? esc(assertionLabels[fact.data.assertion.kind] ?? "") : ""} · ${esc(statusLabel(epistemicFor(fact, snapshot.nodes) ?? fact.readiness))}</small></button>` : ""}<button class="ref" data-node="${esc(access.accessId)}">知情记录与取得依据</button></section>`;
        }).join("")}`;
        return;
    }
    if (!edge.factIds) return;
    const facts = snapshot.nodes.filter(node => edge.factIds?.includes(node.id));
    const names = [edge.source, edge.target].map(value => snapshot.nodes.find(node => node.id === value)?.label ?? value);
    ui.detail.innerHTML = `<span class="tag">命题联系 · ${facts.length} 条独立命题</span><h2 tabindex="-1">${names.map(esc).join(" · ")}</h2>${facts.map(fact => `<button class="fact-row" data-node="${esc(fact.id)}"><span>${esc(fact.label)}</span><small>${fact.kind === "fact" ? esc(({world: "世界命题", belief: "角色信念", speech: "发言内容", rule: "规则", paratext: "书外说明", hypothesis: "假设", fiction: "嵌套虚构"})[fact.data.assertion.kind]) : ""} · ${esc(statusLabel(epistemicFor(fact, snapshot.nodes) ?? fact.readiness))}</small></button>`).join("")}`;
}

function selectEdge(id: string): void {
    if (!displayedKnowledgeEdges.some(edge => edge.id === id)) return;
    if (selectedEdge !== id) rememberSelection();
    selectedEdge = id;
    renderDiagram();
    renderEdgeDetail(id);
    ui.detail.scrollTop = 0;
    element("selection-back", HTMLButtonElement).disabled = false;
    ui.detail.querySelector<HTMLElement>("h2")?.focus();
}

function switchTab(next: "graph" | "story"): void {
    tab = next;
    element("graph-view", HTMLDivElement).hidden = next !== "graph";
    element("story-view", HTMLDivElement).hidden = next !== "story";
    for (const button of document.querySelectorAll<HTMLButtonElement>("[data-tab]")) button.setAttribute("aria-pressed", String(button.dataset.tab === next));
    if (next === "story") renderStory();
}

document.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const section = event.target.closest<HTMLElement>("[data-detail-target]")?.dataset.detailTarget;
    if (section) {document.getElementById(section)?.scrollIntoView({block: "start"}); return;}
    const target = event.target.closest<HTMLElement>("[data-node], [data-pair], [data-knowledge], [data-source], [data-tab], [data-read-paragraph]");
    if (!target) return;
    if (target.dataset.knowledge) selectEdge(target.dataset.knowledge);
    else if (target.dataset.pair) selectEdge(target.dataset.pair);
    else if (target.dataset.node) selectNode(target.dataset.node, target.closest("#detail") !== null);
    else if (target.dataset.tab) switchTab(target.dataset.tab === "story" ? "story" : "graph");
    else if (target.dataset.source) {
        const source = dataset.sources.find((item) => item.id === target.dataset.source);
        const paragraph = Number(target.dataset.paragraph);
        if (!source) return;
        if (source.chapterOrder > readAt.chapter || (source.chapterOrder === readAt.chapter && paragraph > readAt.paragraph)) return;
        if (ui.perspective.value !== "reader") {
            report("角色视角的可用原文摘录保留在记录详情中。");
            return;
        }
        // Evidence navigation changes the displayed chapter only when it is already readable.
        rememberSelection();
        switchTab("story");
        if (source.chapterOrder !== readAt.chapter) {
            element("source-text", HTMLDivElement).innerHTML = `<h2>${esc(source.title)}</h2>${source.paragraphs.map((text, i) => `<div class="paragraph${i + 1 === paragraph ? " highlight" : ""}" id="paragraph-${i + 1}"><span class="muted">${i + 1}</span><p>${esc(text)}</p></div>`).join("")}`;
        }
        document.getElementById(`paragraph-${paragraph}`)?.scrollIntoView({block: "center"});
    } else if (target.dataset.readParagraph) {readAt.paragraph = Number(target.dataset.readParagraph); refreshScope();}
});
graphSvg.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    if (!(event.target instanceof Element)) return;
    const pair = event.target.closest("[data-pair], [data-knowledge]");
    const edgeId = pair?.getAttribute("data-pair") ?? pair?.getAttribute("data-knowledge");
    if (edgeId) {event.preventDefault(); selectEdge(edgeId); return;}
    const id = event.target.closest("[data-node]")?.getAttribute("data-node");
    if (id) {event.preventDefault(); selectNode(id, true);}
});
ui.chapter.addEventListener("change", () => {readAt.chapter = Number(ui.chapter.value); readAt.paragraph = dataset.sources.find((source) => source.chapterOrder === readAt.chapter)?.paragraphs.length ?? 1; refreshScope();});
ui.position.addEventListener("input", () => {readAt.paragraph = Number(ui.position.value); refreshScope();});
ui.perspective.addEventListener("change", refreshScope);
element("chapter-end", HTMLButtonElement).addEventListener("click", () => {readAt.paragraph = Number(ui.position.max); refreshScope();});
function refreshFilters(): void {
    propositionPage = 0;
    selectedEdge = null;
    const node = snapshot.nodes.find(item => item.id === selected);
    if (node?.kind === "fact" && !filteredNodes().some(item => item.id === selected)) selected = null;
    render();
}
for (const input of [ui.search, ui.kind, ui.status]) input.addEventListener(input === ui.search ? "input" : "change", refreshFilters);
assertion.addEventListener("change", () => {ui.kind.value = "fact"; propositions = true; structure = false; refreshFilters();});
element("subject-view", HTMLButtonElement).addEventListener("click", () => {propositions = false; structure = false; selectedEdge = null; ui.kind.value = "entity"; assertion.value = "all"; render();});
element("proposition-view", HTMLButtonElement).addEventListener("click", () => {propositions = true; structure = false; selectedEdge = null; ui.kind.value = "fact"; render();});
function changePage(delta: number): void {
    propositionPage += delta;
    selectedEdge = null;
    if (expandKnowledge && !propositions) selected = focusEntity;
    render();
}
element("claim-previous", HTMLButtonElement).addEventListener("click", () => changePage(-1));
element("claim-next", HTMLButtonElement).addEventListener("click", () => changePage(1));
element("claim-all", HTMLButtonElement).addEventListener("click", () => {selected = null; graphMode = "global"; propositionPage = 0; render();});
element("selection-back", HTMLButtonElement).addEventListener("click", () => {
    let previous = selectionHistory.pop();
    while (previous && previous.id !== null && !snapshot.nodes.some(node => node.id === previous?.id)) previous = selectionHistory.pop();
    if (!previous) return;
    selected = previous.id;
    selectedEdge = previous.edgeId; focusEntity = previous.focusEntity;
    ui.kind.value = previous.kind; ui.search.value = previous.search; ui.status.value = previous.status; assertion.value = previous.assertion;
    propositions = previous.propositions; structure = previous.structure;
    completeStructure = previous.completeStructure; graphMode = previous.graphMode;
    expandKnowledge = previous.expandKnowledge; propositionPage = previous.propositionPage;
    showPropositionEdges = previous.showPropositionEdges; showKnowledgeEdges = previous.showKnowledgeEdges;
    switchTab(previous.tab);
    render();
    ui.detail.scrollTop = 0;
});
for (const button of document.querySelectorAll<HTMLButtonElement>("[data-kind-tab]")) button.addEventListener("click", () => {
    ui.kind.value = button.dataset.kindTab ?? "entity"; assertion.value = "all";
    if (ui.kind.value === "fact") {propositions = true; structure = false;}
    if (ui.kind.value === "entity") {propositions = false; structure = false;}
    render();
});
ui.zoom.addEventListener("input", () => renderDiagram());
ui.edgeKind.addEventListener("change", () => renderDiagram());
ui.edgeLabels.addEventListener("change", () => renderDiagram());
element("global", HTMLButtonElement).addEventListener("click", () => {graphMode = "global"; graphLimit = 100; if (propositions) {selected = null; propositionPage = 0;} render();});
element("local", HTMLButtonElement).addEventListener("click", () => {graphMode = "local"; graphLimit = 100; renderDiagram();});
element("reset-graph", HTMLButtonElement).addEventListener("click", () => {ui.zoom.value = "100"; resetGraphLayout(); renderDiagram();});
element("structure", HTMLButtonElement).addEventListener("click", () => {structure = true; propositions = false; selectedEdge = null; render();});
element("expand-knowledge", HTMLInputElement).addEventListener("change", event => {expandKnowledge = (event.target as HTMLInputElement).checked; propositionPage = 0; selectedEdge = null; selected = focusEntity; render();});
element("show-propositions", HTMLInputElement).addEventListener("change", event => {showPropositionEdges = (event.target as HTMLInputElement).checked; render();});
element("show-knowledge", HTMLInputElement).addEventListener("change", event => {showKnowledgeEdges = (event.target as HTMLInputElement).checked; render();});
element("structure-complete", HTMLInputElement).addEventListener("change", event => {completeStructure = (event.target as HTMLInputElement).checked; renderDiagram();});
new ResizeObserver(() => renderDiagram()).observe(element("graph-scroll", HTMLDivElement));
element("import-button", HTMLButtonElement).addEventListener("click", () => ui.file.click());
ui.file.addEventListener("change", async () => {
    const file = ui.file.files?.[0];
    if (!file) return;
    const generation = ++importGeneration;
    try {
        if (file.size > 40 * 1024 * 1024) throw new Error("文件超过此离线查看器的 40 MB 导入限制");
        const text = await file.text();
        if (generation !== importGeneration) return;
        const next = parseDataset(JSON.parse(text));
        install(next);
        report(`已导入 ${next.book.title}，共 ${next.nodes.length} 条记录。`);
    } catch (error) {
        if (generation === importGeneration) report(`导入失败，仍保留原数据。${error instanceof Error ? error.message : String(error)}`, true);
    } finally {
        if (generation === importGeneration) ui.file.value = "";
    }
});
element("export-button", HTMLButtonElement).addEventListener("click", () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(dataset, null, 2) + "\n"], {type: "application/json"}));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "memory-v7.json";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
});

try {
    const embedded = document.getElementById("dataset")?.textContent;
    if (!embedded) throw new Error("未找到内嵌数据");
    install(parseDataset(JSON.parse(embedded)));
} catch (error) {
    report(`内嵌数据无法加载：${error instanceof Error ? error.message : String(error)}`, true);
}
