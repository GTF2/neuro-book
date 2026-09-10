import type {MemoryNode, Source, Span, RecordRef} from "../t07-v7-schema-gold/index.ts";
import {escapeHtml as esc, kindLabels} from "./view-model.ts";
import {entityArguments} from "./knowledge-graph.ts";
import {nodeAppearance} from "./visual-semantics.ts";

const statuses: Record<string, string> = {ready: "可用", stale: "待重算", pending: "待处理", accepted: "已采纳", tentative: "待定", disputed: "有争议", unsupported: "无支撑", usable: "可用论证", conditional: "条件未定", challenged: "受到质疑", blocked: "论证阻断"};
export function statusLabel(status: string): string {return statuses[status] ?? status;}
export const assertionLabels: Record<string, string> = {world: "世界命题", belief: "角色信念", speech: "发言内容", rule: "规则", paratext: "书外说明", hypothesis: "假设", fiction: "嵌套虚构"};
export const accessLabels: Record<string, string> = {heard: "听闻", read: "读到", believed: "相信", known: "知晓", unaware: "不知情"};

export function epistemicFor(node: MemoryNode, nodes: readonly MemoryNode[]): string | null {
    if (node.kind === "assessment") return node.data.epistemic;
    if (node.kind === "argument") return node.data.status;
    const assessment = nodes.find((item) => item.kind === "assessment" && item.data.target.id === node.id);
    return assessment?.kind === "assessment" ? assessment.data.epistemic : null;
}

export function renderDetail(node: MemoryNode, nodes: readonly MemoryNode[], sources: readonly Source[], entitySummaries?: readonly MemoryNode[]): string {
    const byId = new Map(nodes.map((item) => [item.id, item]));
    const link = (ref: RecordRef): string => {
        const target = byId.get(ref.id);
        return target ? `<button class="ref" data-node="${esc(ref.id)}">${esc(target.label)}</button> <span class="muted">${esc(kindLabels[target.kind] ?? target.kind)}</span>` : `<span class="muted">此引用在当前阅读范围不可用</span>`;
    };
    const refs = (items: readonly RecordRef[]): string => items.length ? `<ul>${items.map((ref) => `<li>${link(ref)}</li>`).join("")}</ul>` : `<p class="muted">无记录</p>`;
    const time = (value: Extract<MemoryNode, {kind: "fact"}>["data"]["time"]): string => value.kind === "unspecified" ? "未确定" : value.kind === "point" ? link(value.point) : `${value.start ? link(value.start) : "起点未定"} 至 ${value.end ? link(value.end) : "终点未定"}（${esc(value.bounds)}）`;
    const spans = (items: readonly Span[]): string => items.map((span) => {
        const source = sources.find((item) => item.id === span.sourceId && item.revision === span.sourceRevision);
        const paragraph = source?.paragraphs[span.paragraph - 1];
        if (!source || paragraph === undefined) return "";
        const quote = paragraph.slice(span.start, span.end);
        return `<blockquote class="evidence"><button class="ref source-link" data-source="${esc(source.id)}" data-paragraph="${span.paragraph}">第 ${source.chapterOrder} 章 · 第 ${span.paragraph} 段</button><p>${esc(quote)}</p></blockquote>`;
    }).join("");
    let content = "";
    switch (node.kind) {
        case "entity": {
            const summaries = entitySummaries ?? nodes.filter((item) => item.kind === "entitySummary" && item.data.subject.id === node.id);
            const entities = new Set(nodes.filter(item => item.kind === "entity").map(item => item.id));
            const facts = nodes.filter(item => item.kind === "fact" && entityArguments(item, entities).includes(node.id));
            const resolutions = nodes.filter(item => item.kind === "resolution" && item.data.entity.id === node.id);
            const referentIds = new Set(resolutions.flatMap(item => item.kind === "resolution" ? [item.data.referent.id] : []));
            const mentions = nodes.filter(item => item.kind === "mention" && referentIds.has(item.data.referent.id));
            content = `<h3>当前认识</h3>${summaries.length ? summaries.map(summary => summary.kind === "entitySummary" ? `<section class="entity-summary"><h4>${esc(({overview: "主体概况", development: "态度与变化", abilities: "能力", relationships: "关系"})[summary.data.facet] ?? "主体摘要")}</h4>${summary.data.items.map(item => `<p>${esc(item.text)}</p>`).join("")}<details><summary>摘要依据</summary>${link(summary)}${summary.data.items.map(item => refs(item.dependencies)).join("")}</details></section>` : "").join("") : '<p class="muted">当前边界尚无主体摘要。</p>'}<h3>相关命题 <span class="muted">${facts.length}</span></h3>${facts.map(fact => `<button class="fact-row" data-node="${esc(fact.id)}"><span>${esc(fact.label)}</span><small>${fact.kind === "fact" ? esc(assertionLabels[fact.data.assertion.kind] ?? fact.data.assertion.kind) : ""} · ${esc(statusLabel(epistemicFor(fact, nodes) ?? fact.readiness))}</small></button>`).join("")}`;
            content += `<h3>名称沿革</h3><p>${esc(node.data.identityNote)}</p><ol class="name-history">${node.data.names.map(name => `<li><strong>${esc(name.text)}</strong><span class="row-meta">第 ${name.availableAt.chapter} 章 · 第 ${name.availableAt.paragraph} 段起</span>${name.dependencies.length ? `<details><summary>命名依据</summary>${refs(name.dependencies)}</details>` : '<span class="muted">无独立命名依据</span>'}</li>`).join("")}</ol><h3>身份归属 <span class="muted">${resolutions.length}</span></h3>${resolutions.map(item => item.kind === "resolution" ? `<p>${link(item.data.referent)} · ${esc(({same: "同一对象", candidate: "候选对象", unresolved: "尚未确认"})[item.data.decision])}</p><p>${link(item)}</p>` : "").join("") || '<p class="muted">当前范围没有身份归属记录。</p>'}<details class="mentions"><summary>原文出现位置 · ${mentions.length} 处</summary>${mentions.map(item => item.kind === "mention" ? `<div class="mention-entry"><p>原文词语：${link(item)}</p>${spans([item.data.span])}</div>` : "").join("")}</details>`;
            content = `<nav class="detail-nav"><button data-detail-target="detail-knowledge">当前认识</button><button data-detail-target="detail-identity">名称与身份</button></nav><div id="detail-knowledge"></div>${content.replace("<h3>名称沿革</h3>", '<h3 id="detail-identity" tabindex="-1">名称沿革</h3>')}`;
            break;
        }
        case "entitySummary":
        case "synthesis":
            content = `${node.kind === "entitySummary" ? `<p>${link(node.data.subject)} · ${esc(node.data.facet)}</p>` : `<p>${esc(node.data.topic)}</p>`}<ol>${node.data.items.map((item) => `<li><p>${esc(item.text)}</p><span class="tag">${statusLabel(item.readiness)}</span>${refs(item.dependencies)}</li>`).join("")}</ol><p class="notice">摘要是可重建的阅读入口。${node.data.coverage.corpusClosed ? "数据声明了封闭范围。" : "当前记录不能保证穷尽作品中的全部知识。"}${node.data.coverage.gaps.map(esc).join("；")}</p>`;
            break;
        case "fact":
            content = `<p>${esc(node.data.proposition)}</p><div class="notice">${esc(assertionLabels[node.data.assertion.kind] ?? node.data.assertion.kind)}${node.data.assertion.holder ? ` · 持有者 ${link(node.data.assertion.holder)}` : ""} · ${node.data.polarity === "negative" ? "否定" : "肯定"}${node.data.assertion.opaque ? " · 保留认知中的原始指称" : ""}</div><p class="muted">${node.scope.world === "original" ? "原作" : esc(node.scope.world)} · ${node.scope.perspective === "reader" ? "读者范围" : esc(node.scope.perspective)}</p><details><summary>命题结构与限定</summary><dl><dt>谓词</dt><dd>${link(node.data.predicate)}</dd>${node.data.arguments.map((item) => `<dt>${esc(item.role)}</dt><dd>${item.value.type === "ref" ? link(item.value.ref) : item.value.type === "text" ? esc(item.value.text) : item.value.type === "number" ? `${item.value.number} ${esc(item.value.unit ?? "")}` : item.value.type === "unknown" ? `未知：${esc(item.value.reason)}` : item.value.type === "none" ? `无：${esc(item.value.meaning)}` : esc(item.value.name)}</dd>`).join("")}</dl><p class="muted">模态：${esc(node.data.qualifiers.modality)}；量词：${esc(node.data.qualifiers.quantifier)}</p>${node.data.qualifiers.textualConditions.length ? `<p>条件：${node.data.qualifiers.textualConditions.map(esc).join("；")}</p>` : ""}</details>`;
            break;
        case "disclosure":
            content = `<p>${esc(node.data.text)}</p><p class="notice">${esc(node.data.channel)} · ${esc(node.data.mode)}。披露保存叙述、言语或认知材料；材料内容不自动成为世界事实。</p>${node.data.attribution.map((item) => `<p>${esc(item.channel)}${item.holder ? `：${link(item.holder)}` : ""}</p>`).join("")}`;
            break;
        case "beat":
            content = `<p>${esc(node.data.gist)}</p><p class="muted">第 ${node.data.fromParagraph}–${node.data.toParagraph} 段 · ${esc(node.data.mode)}</p><h3>包含的披露</h3>${refs(node.data.disclosures)}`;
            break;
        case "episode":
            content = `<p>${esc(node.data.summary)}</p><ol>${node.data.components.map((item) => `<li>${esc(item.text)}${refs(item.dependencies)}</li>`).join("")}</ol>${node.data.relations.length ? `<h3>情节关系</h3>${node.data.relations.map((item) => `<p>${esc(item.relation)} → ${link(item.target)}</p>`).join("")}` : ""}`;
            break;
        case "argument":
            content = `<p>${esc(node.data.rationale)}</p><p class="notice">${esc(node.data.polarity)} · ${esc(node.data.method)} · ${statusLabel(node.data.status)}</p><h3>结论</h3>${link(node.data.conclusion)}<h3>前提</h3><ul>${node.data.premises.map((item) => `<li>${link(item.ref)}<p class="muted">${esc(item.role)} · ${item.required ? "必要前提" : "辅助前提"}</p></li>`).join("")}</ul>${node.data.assumptions.length ? `<p>假设：${node.data.assumptions.map(esc).join("；")}</p>` : ""}<p class="muted">复核：${esc(node.data.review.verdict)} · ${esc(node.data.review.note)}</p>${spans(node.data.sourceRoots)}`;
            break;
        case "assessment":
            content = `<p>${esc(node.data.note)}</p><h3>评估对象</h3>${link(node.data.target)}<h3>依据的论证</h3>${refs(node.data.arguments)}${node.data.unresolved.length ? `<p class="notice">未解决：${node.data.unresolved.map(esc).join("；")}</p>` : ""}`;
            break;
        case "time":
            content = `<p>${esc(node.data.description)}</p><p class="muted">精度：${esc(node.data.precision)}</p><h3>时间约束</h3>${node.data.constraints.map((item) => `<p>${esc(({before: "早于", after: "晚于", during: "处于", overlap: "重叠", equal: "同一时间"})[item.relation])} ${link(item.other)}</p>${refs(item.dependencies)}`).join("") || '<p class="muted">没有更细的时间约束</p>'}`;
            break;
        case "knowledgeAccess":
            content = `<p>${link(node.data.holder)} · ${esc(accessLabels[node.data.mode] ?? node.data.mode)}</p><h3>接触的命题或内容</h3>${link(node.data.target)}<h3>取得时间</h3><p>${time(node.data.establishedAt)}</p><h3>知情依据</h3>${refs(node.data.evidence)}`;
            break;
        case "resolution":
            content = `<p class="notice">${esc(node.data.decision === "same" && epistemicFor(node, nodes) !== "accepted" ? "同一对象判断待确认" : ({same: "已归属为同一对象", candidate: "候选身份，尚未合并", unresolved: "身份尚未确认"})[node.data.decision])}</p><h3>局部指称</h3>${link(node.data.referent)}<h3>对应主体</h3>${link(node.data.entity)}<h3>身份依据</h3>${refs(node.dependencies)}${node.data.replaces.length ? `<h3>替代的旧判断</h3>${refs(node.data.replaces)}` : ""}`;
            break;
        case "referent":
            content = `<p>${esc(node.data.localName)}</p><h3>指向此对象的原文词语</h3>${refs(node.data.mentions)}<h3>身份判断</h3>${refs(nodes.filter(item => item.kind === "resolution" && item.data.referent.id === node.id))}${node.data.splitFrom ? `<h3>拆分来源</h3>${link(node.data.splitFrom)}` : ""}`;
            break;
        case "mention":
            content = `<p>${esc(node.data.text)}</p><h3>所属指称</h3>${link(node.data.referent)}${spans([node.data.span])}`;
            break;
        default:
            content = `<dl>${Object.entries(node.data).map(([key, value]) => `<dt>${esc(key)}</dt><dd>${typeof value === "string" ? esc(value) : `<pre>${esc(JSON.stringify(value, null, 2))}</pre>`}</dd>`).join("")}</dl>`;
    }
    if (node.kind === "fact" || node.kind === "episode") content += `<h3>故事时间</h3><p>${time(node.data.time)}</p>`;
    if (node.kind === "disclosure") content += `<h3>材料提及时间</h3><p>${time(node.data.mentionedTime)}</p>`;
    if (node.kind === "entitySummary") content += `<h3>摘要故事范围</h3><p>${time(node.data.story)}</p>`;
    const argumentsFor = nodes.filter((item) => item.kind === "argument" && item.data.conclusion.id === node.id);
    const assessments = nodes.filter((item) => item.kind === "assessment" && item.data.target.id === node.id);
    const epistemic = epistemicFor(node, nodes);
    if (node.kind === "entity") {
        const appearance = nodeAppearance(node);
        content = `<p class="entity-category"><i class="type-swatch" data-shape="${appearance.shape}" style="--type-color:${appearance.color}"></i>${esc(appearance.label)}</p>${content}`;
    }
    const sourceEvidence = node.kind === "mention" ? "" : `<details class="source-evidence"><summary>${node.kind === "entity" ? "主体建立时的原文" : "本记录的原文摘录"}</summary>${node.spans.length ? spans(node.spans) : '<p class="muted">无直接摘录</p>'}</details>`;
    return `<span class="tag type-tag" data-kind="${node.kind}">${esc(kindLabels[node.kind] ?? node.kind)}</span> <span class="tag">${statusLabel(node.readiness)}</span>${epistemic ? ` <span class="tag">${statusLabel(epistemic)}</span>` : ""}<h2 tabindex="-1">${esc(node.label)}</h2><p class="muted">第 ${node.availableAt.chapter} 章 · 第 ${node.availableAt.paragraph} 段起可见</p>${content}${argumentsFor.length ? `<h3>支持、反对与质疑</h3>${refs(argumentsFor)}` : ""}${assessments.length ? `<h3>当前评估</h3>${refs(assessments)}` : ""}${sourceEvidence}<details class="record-dependencies"><summary>建模依据 · ${node.dependencies.length} 条依赖记录</summary>${refs(node.dependencies)}</details><details><summary>记录元数据与 JSON</summary><p class="identity">${esc(node.id)} · revision ${node.revision} · ${esc(node.scope.world)} / ${esc(node.scope.perspective)}</p><pre>${esc(JSON.stringify(node, null, 2))}</pre></details>`;
}
