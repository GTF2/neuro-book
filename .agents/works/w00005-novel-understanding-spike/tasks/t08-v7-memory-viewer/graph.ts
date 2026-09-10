import {forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide, forceX, forceY, select, drag, zoom, zoomIdentity, zoomTransform, type SimulationNodeDatum, type SimulationLinkDatum} from "d3";
import type {MemoryNode} from "../t07-v7-schema-gold/index.ts";
import {kindLabels} from "./view-model.ts";
import {epistemicFor, statusLabel, assertionLabels} from "./detail.ts";
import type {KnowledgeEdge} from "./knowledge-graph.ts";
import {nodeAppearance} from "./visual-semantics.ts";
import {expandedLayout, graphLabelLines} from "./expanded-layout.ts";

interface Point extends SimulationNodeDatum {id: string; node: MemoryNode}
interface Link extends SimulationLinkDatum<Point> {edge: KnowledgeEdge; offset: number}
const positions = new Map<string, {x: number; y: number}>();
const roleLabels: Record<string, string> = {actor: "行动者", subject: "主体", object: "对象", location: "地点", target: "目标", holder: "持有者", speaker: "说话者", listener: "听者", body: "身体", source: "来源", recipient: "接受者", instrument: "媒介", agent: "施事", content: "内容"};
let viewport = "";
let membership = "";
let previousScale = 100;
const relationNames: Record<string, string> = {recalls: "回忆", experiences_body: "身体感受", speaks_in_scene: "交谈", believes_reincarnation: "认为重生", repeats_prior_intro: "重复介绍", self_introduces: "自我介绍", expresses_preference: "表达偏好", believes_other_knows: "认为对方知情", worries_contract_terms: "担心契约", regrets_role: "后悔身份", self_diagnoses_past: "判断前世病情", reviews_body_memories: "审视残留记忆", funds: "资助", believes_same_death: "认为死法相同", experiences_phantom_pain: "感到幻痛", doubts_role_reality: "怀疑身份", absorbs_blood_unnoticed: "血液融入", hears_activation_notice: "听到激活提示", guesses_transformation_tool: "猜测变身道具", past_aspiration: "曾梦想变身", failed_voice_attempts: "口令尝试失败", seeks_operation_method: "寻找操作方法", revises_operation_belief: "修正操作认识", accepts_role: "接受身份", expects_difficult_task: "认为任务困难", used_as_transformation_tool: "变身媒介", takes_role: "实践身份", subclass_of: "一类身份"};

export function resetGraphLayout(): void {positions.clear();}

export function renderGraph(svg: SVGSVGElement, nodes: readonly MemoryNode[], edges: readonly KnowledgeEdge[], selected: string | null, scale: number, labels: string, scopeNodes: readonly MemoryNode[] = nodes, identity = false, selectedEdge: string | null = null, options: {expanded?: boolean; focusId?: string | null} = {}): void {
    const containerWidth = Math.max(280, svg.parentElement?.clientWidth ?? 700);
    const containerHeight = Math.max(360, svg.parentElement?.clientHeight ?? 650);
    const layout = options.expanded ? expandedLayout(nodes, edges, options.focusId ?? null, containerWidth, containerHeight) : null;
    const width = layout?.width ?? containerWidth;
    const height = layout?.height ?? containerHeight;
    const nextViewport = `${containerWidth}:${containerHeight}:${width}:${height}`;
    const nextMembership = `${identity}:${Boolean(layout)}:${layout ? options.focusId : ""}:` + nodes.map(node => node.id).sort().join("\n");
    const changed = viewport !== nextViewport || membership !== nextMembership || positions.size === 0;
    const previousTransform = zoomTransform(svg);
    // Cached coordinates belong to one viewport; fitting them again compounds compression on resize.
    if (changed) {positions.clear(); viewport = nextViewport; membership = nextMembership;}
    svg.style.width = layout ? `${width}px` : "100%";
    svg.style.height = layout ? `${height}px` : "100%";
    svg.dataset.layout = layout ? "expanded" : "free";
    svg.dataset.viewportWidth = String(containerWidth);
    if (changed && svg.parentElement) {svg.parentElement.scrollTop = 0; svg.parentElement.scrollLeft = 0;}
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.innerHTML = '<defs><marker id="arrow" viewBox="0 -4 8 8" refX="8" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,-4L8,0L0,4" fill="#8a969a"/></marker><marker id="knowledge-arrow" viewBox="0 -4 8 8" refX="8" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,-4L8,0L0,4" fill="#b35375"/></marker></defs><g class="scene"></g>';
    const root = select(svg);
    const scene = root.select<SVGGElement>(".scene");
    const points: Point[] = nodes.map(node => ({id: node.id, node, ...positions.get(node.id)}));
    const pairCounts = new Map<string, number>();
    for (const edge of edges) {const key = [edge.source, edge.target].sort().join("|"); pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);}
    const pairIndices = new Map<string, number>();
    const links: Link[] = edges.map(edge => {
        const key = [edge.source, edge.target].sort().join("|");
        const index = pairIndices.get(key) ?? 0;
        pairIndices.set(key, index + 1);
        return {source: edge.source, target: edge.target, edge, offset: (index - ((pairCounts.get(key) ?? 1) - 1) / 2) * 9};
    });
    const byId = new Map(scopeNodes.map(node => [node.id, node]));
    const lines = scene.append("g").selectAll<SVGGElement, Link>("g").data(links).join("g").attr("class", link => `relation${link.edge.id === selectedEdge ? " selected" : ""}`)
        .attr("data-source-node", link => link.edge.source).attr("data-target-node", link => link.edge.target)
        .attr("data-node", link => link.edge.accesses || (link.edge.factIds?.length ?? 0) > 1 ? null : link.edge.factId ?? link.edge.source)
        .attr("data-knowledge", link => link.edge.accesses ? link.edge.id : null)
        .attr("data-pair", link => (link.edge.factIds?.length ?? 0) > 1 ? link.edge.id : null).attr("tabindex", 0).attr("role", "button");
    lines.append("path").attr("class", "edge-hit");
    lines.append("path").attr("class", link => `edge${link.edge.accesses ? " knowledge-edge" : ""}`).attr("marker-end", link => link.edge.accesses ? "url(#knowledge-arrow)" : link.edge.kind === "semantic" ? null : "url(#arrow)").attr("stroke-dasharray", link => {
        const facts = (link.edge.factIds ?? [link.edge.factId ?? ""]).flatMap(id => {const fact = byId.get(id); return fact ? [fact] : [];});
        return link.edge.kind === "dependency" || facts.some(fact => epistemicFor(fact, scopeNodes) !== "accepted") ? "5 4" : null;
    });
    lines.append("title").text(link => {
        if (link.edge.accesses) return `认知联系：${link.edge.label}`;
        if ((link.edge.factIds?.length ?? 0) > 1) return "命题联系\n" + (link.edge.factIds ?? []).map(id => {const fact = byId.get(id); return fact ? `${fact.label} · ${statusLabel(epistemicFor(fact, scopeNodes) ?? fact.readiness)}` : id;}).join("\n");
        const fact = byId.get(link.edge.factId ?? "");
        return `${fact ? "命题联系：" : ""}${link.edge.label}${fact?.kind === "fact" ? ` · ${assertionLabels[fact.data.assertion.kind]} · ${statusLabel(epistemicFor(fact, scopeNodes) ?? fact.readiness)} · ${fact.scope.world}/${fact.scope.perspective}` : ""}`;
    });
    lines.attr("aria-label", link => link.edge.label);
    const captions = lines.append("text").attr("class", "edge-label").attr("text-anchor", "middle").text(link => {
        if ((width < 500 && !identity && link.edge.id !== selectedEdge) || labels === "none" || (labels !== "all" && !identity && link.edge.id !== selectedEdge && ![link.edge.source, link.edge.target, link.edge.factId].includes(selected ?? ""))) return "";
        const fact = byId.get(link.edge.factId ?? "");
        const predicate = fact?.kind === "fact" ? byId.get(fact.data.predicate.id) : undefined;
        const name = !link.edge.factIds ? roleLabels[link.edge.label] ?? link.edge.label : (link.edge.factIds.length > 1 ? link.edge.label : predicate?.kind === "predicate" ? relationNames[predicate.data.name] : undefined);
        const text = [...(name ?? link.edge.label)];
        return text.slice(0, 9).join("") + (text.length > 9 ? "…" : "");
    });
    const cards = scene.append("g").selectAll<SVGGElement, Point>("g").data(points).join("g")
        .attr("class", point => `node${point.id === selected ? " selected" : ""}`)
        .attr("data-node", point => point.id).attr("data-kind", point => point.node.kind).attr("tabindex", 0).attr("role", "button")
        .attr("aria-label", point => `${kindLabels[point.node.kind]} · ${nodeAppearance(point.node).label}：${point.node.label}`);
    const color = (point: Point): string => nodeAppearance(point.node).color;
    cards.filter(point => nodeAppearance(point.node).shape === "circle").append("circle").attr("class", "node-shape").attr("r", 10).style("stroke", color);
    cards.filter(point => nodeAppearance(point.node).shape !== "circle").append("path").attr("class", "node-shape").attr("d", point => {
        if (nodeAppearance(point.node).shape === "diamond") return "M0,-9L9,0L0,9L-9,0Z";
        if (nodeAppearance(point.node).shape === "flag") return "M-9,-7L5,-7L10,0L5,7L-9,7Z";
        return "M-7,-7H7V7H-7Z";
    }).style("stroke", color).style("fill", point => ["fact", "episode", "beat"].includes(point.node.kind) ? color(point) : "white");
    cards.append("title").text(point => point.node.kind === "fact" ? `${point.node.data.proposition}\n${assertionLabels[point.node.data.assertion.kind]} · ${statusLabel(epistemicFor(point.node, scopeNodes) ?? point.node.readiness)}` : `${point.node.label}\n${kindLabels[point.node.kind]} · ${nodeAppearance(point.node).label}`);
    const nodeLabels = cards.append("text").attr("class", "node-label").attr("y", 25).attr("text-anchor", "middle");
    nodeLabels.each(function(point) {
        graphLabelLines(point.node.label, Boolean(layout)).forEach((line, index) => select(this).append("tspan").attr("x", 0).attr("dy", index ? 15 : 0).text(line));
    });
    nodeLabels.filter(point => point.node.kind !== "entity" || identity || Boolean(layout)).append("tspan").attr("class", "node-meta").attr("x", 0).attr("dy", 15)
        .text(point => point.node.kind === "fact" ? `${assertionLabels[point.node.data.assertion.kind]} · ${statusLabel(epistemicFor(point.node, scopeNodes) ?? point.node.readiness)}` : `${kindLabels[point.node.kind]}${point.node.kind === "entity" ? ` · ${nodeAppearance(point.node).label}` : ""}`);
    const simulation = forceSimulation(points)
        .force("link", forceLink<Point, Link>(links).id(point => point.id).distance(240).strength(link => .12 / (pairCounts.get([link.edge.source, link.edge.target].sort().join("|")) ?? 1)))
        .force("charge", forceManyBody().strength(-1100).distanceMax(350)).force("collide", forceCollide(58))
        .force("x", forceX(width / 2).strength(.045)).force("y", forceY(height / 2).strength(.045))
        .force("center", forceCenter(width / 2, height / 2)).stop();
    const update = (): void => {
        for (const point of points) {
            point.x = Math.max(55, Math.min(width - 55, point.x ?? width / 2));
            point.y = Math.max(45, Math.min(height - 45, point.y ?? height / 2));
            positions.set(point.id, {x: point.x, y: point.y});
        }
        cards.attr("transform", point => `translate(${point.x},${point.y})`);
        const endpoints = (link: Link): {x1: number; y1: number; x2: number; y2: number} | null => {
            const from = typeof link.source === "object" ? link.source : undefined;
            const to = typeof link.target === "object" ? link.target : undefined;
            if (!from || !to) return null;
            const dx = (to.x ?? 0) - (from.x ?? 0); const dy = (to.y ?? 0) - (from.y ?? 0);
            const length = Math.max(1, Math.hypot(dx, dy));
            const sign = link.edge.source < link.edge.target ? 1 : -1;
            const ox = -dy / length * link.offset * sign; const oy = dx / length * link.offset * sign;
            return {x1: (from.x ?? 0) + ox + dx / length * 12, y1: (from.y ?? 0) + oy + dy / length * 12, x2: (to.x ?? 0) + ox - dx / length * 14, y2: (to.y ?? 0) + oy - dy / length * 14};
        };
        lines.selectAll<SVGPathElement, Link>("path").attr("d", link => {
            const line = endpoints(link);
            return line ? `M${line.x1},${line.y1}L${line.x2},${line.y2}` : "";
        });
        captions.attr("x", link => {const line = endpoints(link); return line ? (line.x1 + line.x2) / 2 : 0;})
            .attr("y", link => {const line = endpoints(link); return line ? (line.y1 + line.y2) / 2 - 5 : 0;});
        const occupied: {left: number; right: number; top: number; bottom: number}[] = [];
        const ordered = [...cards.nodes()].sort((a, b) => Number(b.getAttribute("data-node") === selected) - Number(a.getAttribute("data-node") === selected));
        for (const card of ordered) {
            const point = points.find(item => item.id === card.getAttribute("data-node"));
            const label = card.querySelector("text");
            if (!point || !label) continue;
            label.style.visibility = "visible";
            const bounds = label.getBBox();
            const box = {left: (point.x ?? 0) + bounds.x - 4, right: (point.x ?? 0) + bounds.x + bounds.width + 4, top: (point.y ?? 0) + bounds.y - 3, bottom: (point.y ?? 0) + bounds.y + bounds.height + 3};
            const overlaps = occupied.some(other => box.left < other.right && box.right > other.left && box.top < other.bottom && box.bottom > other.top);
            if (!layout && (overlaps || box.left < 0 || box.right > width) && point.id !== selected) label.style.visibility = "hidden";
            else occupied.push(box);
        }
        for (const caption of [...captions.nodes()].sort((a, b) => Number(b.parentElement?.classList.contains("selected")) - Number(a.parentElement?.classList.contains("selected")))) {
            caption.style.visibility = "visible";
            const bounds = caption.getBBox();
            const box = {left: bounds.x - 3, right: bounds.x + bounds.width + 3, top: bounds.y - 2, bottom: bounds.y + bounds.height + 2};
            const overlaps = occupied.some(other => box.left < other.right && box.right > other.left && box.top < other.bottom && box.bottom > other.top);
            if (overlaps || box.left < 0 || box.right > width) caption.style.visibility = "hidden";
            else occupied.push(box);
        }
    };
    if (layout && changed) {
        for (const point of points) Object.assign(point, layout.positions.get(point.id));
    } else if (points.some(point => !positions.has(point.id))) {
        simulation.tick(180);
        const extentX = Math.max(1, ...points.map(point => Math.abs((point.x ?? width / 2) - width / 2)));
        const extentY = Math.max(1, ...points.map(point => Math.abs((point.y ?? height / 2) - height / 2)));
        const fitX = Math.min(1, (width / 2 - 65) / extentX);
        const fitY = Math.min(1, (height / 2 - 50) / extentY);
        for (const point of points) {
            point.x = width / 2 + ((point.x ?? 0) - width / 2) * fitX;
            point.y = height / 2 + ((point.y ?? 0) - height / 2) * fitY;
            point.vx = 0; point.vy = 0;
        }
        // Collision must be resolved in displayed pixels, after fitting the free layout.
        const separation = forceSimulation(points).force("collide", forceCollide<Point>(20).iterations(4)).stop();
        for (let tick = 0; tick < 120; tick++) {
            separation.tick();
            for (const point of points) {
                point.x = Math.max(55, Math.min(width - 55, point.x ?? width / 2));
                point.y = Math.max(45, Math.min(height - 45, point.y ?? height / 2));
            }
        }
        if (identity && points.length <= 12) {
            const stages = ["mention", "referent", "resolution", "entity"];
            for (const point of points) {
                const stage = Math.max(0, stages.indexOf(point.node.kind));
                const peers = points.filter(other => other.node.kind === point.node.kind);
                const offset = peers.indexOf(point) + 1;
                point.x = width < 600 ? width / 2 + (offset - (peers.length + 1) / 2) * 110 : 85 + stage / 3 * (width - 170);
                point.y = width < 600 ? 55 + stage / 3 * (height - 120) : height / 2 + (offset - (peers.length + 1) / 2) * 100;
            }
        }
    }
    update();
    cards.call(drag<SVGGElement, Point>().on("start", (event, point) => {event.sourceEvent.stopPropagation(); point.fx = point.x; point.fy = point.y;})
        .on("drag", (event, point) => {point.fx = event.x; point.fy = event.y; point.x = event.x; point.y = event.y; update();})
        .on("end", (_event, point) => {point.fx = null; point.fy = null;}));
    const zoomer = zoom<SVGSVGElement, unknown>().scaleExtent([.35, 3]).on("zoom", event => scene.attr("transform", event.transform.toString()));
    root.call(zoomer).call(zoomer.transform, !changed && scale === previousScale ? previousTransform : zoomIdentity.translate(containerWidth * (1 - scale / 100) / 2, containerHeight * (1 - scale / 100) / 2).scale(scale / 100));
    previousScale = scale;
}
