import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { z } from "zod";
import { annotationsSchema, type Annotations } from "./annotations-schema.ts";
import { nodeSchema, sourceSchema, type MemoryDataset, type MemoryNode, type NodeKind, type NodeOf, type RecordRef, type Span, type Position } from "./schema.ts";
import { comparePosition, parseDataset } from "./validate.ts";
import { aggregateAssessment } from "./query.ts";

const captureSchema = z.object({ book: z.strictObject({ id: z.string(), title: z.string() }), sources: z.array(sourceSchema.extend({ member: z.string(), memberSha256: z.string() })) });
const ref = (id: string): RecordRef => ({ id, revision: 1 });
const position = (at: [number, number]): Position => ({ chapter: at[0], paragraph: at[1] });
const scope = { world: "original", perspective: "reader" };
const unspecified = { kind: "unspecified" } as const;

export function compileGold(rawSources: unknown, rawAnnotations: unknown): MemoryDataset {
    const capture = captureSchema.parse(rawSources), annotations = annotationsSchema.parse(rawAnnotations);
    const sources = capture.sources.map(({ member: _member, memberSha256: _memberSha256, ...source }) => source);
    for (const source of sources) if (createHash("sha256").update(source.paragraphs.join("\n"), "utf8").digest("hex") !== source.sha256) throw new Error(`Source hash mismatch ${source.id}`);
    const nodes: MemoryNode[] = [], byId = new Map<string, MemoryNode>();
    function add<K extends NodeKind>(kind: K, id: string, label: string, at: Position, evidence: Span[], dependencies: RecordRef[], data: NodeOf<K>["data"]): NodeOf<K> {
        const parsed = nodeSchema.parse({ id, revision: 1, kind, label, availableAt: at, scope, spans: evidence, dependencies, readiness: "ready", data });
        if (byId.has(id)) throw new Error(`Duplicate generated record ${id}`);
        nodes.push(parsed); byId.set(id, parsed);
        // The strict discriminated parser has validated the supplied literal kind and payload.
        return parsed as NodeOf<K>;
    }
    function sourceAt(chapter: number) {
        const source = sources.find(source => source.chapterOrder === chapter);
        if (!source) throw new Error(`Unknown chapter ${chapter}`);
        return source;
    }
    function spanRange(chapter: number, from: number, to: number): Span[] {
        const source = sourceAt(chapter), result: Span[] = [];
        for (let paragraph = from; paragraph <= to; paragraph++) {
            const text = source.paragraphs[paragraph - 1];
            if (!text) throw new Error(`Unknown paragraph ${chapter}:${paragraph}`);
            result.push({ sourceId: source.id, sourceRevision: source.revision, paragraph, start: 0, end: text.length });
        }
        if (!result.length) throw new Error("Empty source range");
        return result;
    }
    function latest(refs: RecordRef[]): Position {
        return refs.reduce<Position>((at, item) => {
            const node = byId.get(item.id); if (!node) throw new Error(`Unbuilt premise ${item.id}`);
            return comparePosition(node.availableAt, at) > 0 ? node.availableAt : at;
        }, { chapter: 1, paragraph: 1 });
    }
    function support(target: MemoryNode, premises: RecordRef[], method: NodeOf<"argument">["data"]["method"], status: "accepted" | "tentative", note: string): void {
        const argument = add("argument", `arg:${target.id}`, `依据：${target.label}`, target.availableAt, [], premises, {
            conclusion: ref(target.id), polarity: "supports", method, premises: premises.map(item => ({ ref: item, role: "evidence", required: true })),
            assumptions: status === "tentative" ? [note] : [], rationale: note,
            sourceRoots: [...new Map(premises.flatMap(item => byId.get(item.id)!.spans).map(span => [JSON.stringify(span), span])).values()],
            applicability: status === "accepted" ? "satisfied" : "unknown", bindings: [], jointScope: scope, jointTime: unspecified,
            review: { verdict: "passed", reviewer: "agent-curated-pending-developer-review", note }, status: status === "accepted" ? "usable" : "conditional",
        });
        add("assessment", `assess:${target.id}`, `评估：${target.label}`, target.availableAt, [], [], {
            target: ref(target.id), arguments: [ref(argument.id)], epistemic: aggregateAssessment([argument.data]), note,
            unresolved: status === "tentative" ? [note] : [], evaluatedAt: target.availableAt,
        });
    }
    const localRefs = new Map<string, string>();
    for (const time of annotations.times ?? []) add("time", time.id, time.label, position(time.at), spanRange(...time.at, time.at[1]), [], {
        description: time.label, precision: "relative", constraints: [...time.before.map(id => ({ relation: "before" as const, other: ref(id), dependencies: [] })), ...(time.after ?? []).map(id => ({ relation: "after" as const, other: ref(id), dependencies: [] }))],
    });
    for (const entity of annotations.entities) {
        const first = [...entity.mentions].sort((a, b) => comparePosition(position(a.at), position(b.at)))[0]!;
        const initialSpans = spanRange(...entity.at, entity.at[1]);
        const record = add("entity", entity.id, first.text, position(entity.at), initialSpans, [], {
            category: entity.category, identityNote: "实体入口仅用于持续指称；属性和身份判断以有依据记录为准。",
            names: [],
        });
        for (const chapter of [...new Set(entity.mentions.map(mention => mention.at[0]))]) {
            const mentions = entity.mentions.filter(mention => mention.at[0] === chapter).sort((a, b) => a.at[1] - b.at[1]);
            const localId = `ref:${entity.id}:c${chapter}`; localRefs.set(`${entity.id}:${chapter}`, localId);
            const mentionIds = mentions.map((_, index) => `mention:${entity.id}:c${chapter}:${index + 1}`);
            add("referent", localId, mentions[0]!.text, position(mentions[0]!.at), [], [], { localName: mentions[0]!.text, mentions: mentionIds.map(ref), splitFrom: null });
            for (const [index, mention] of mentions.entries()) {
                const source = sourceAt(chapter), paragraph = source.paragraphs[mention.at[1] - 1]!;
                const start = paragraph.indexOf(mention.text);
                if (start < 0) throw new Error(`Mention not found ${entity.id} ${mention.at}: ${mention.text}`);
                const span = { sourceId: source.id, sourceRevision: source.revision, paragraph: mention.at[1], start, end: start + mention.text.length };
                add("mention", mentionIds[index]!, mention.text, position(mention.at), [span], [], { referent: ref(localId), text: mention.text, span });
            }
            const at = position(mentions[0]!.at), spans = spanRange(chapter, at.paragraph, at.paragraph);
            const resolution = add("resolution", `resolve:${entity.id}:c${chapter}`, `局部指称归属：${mentions[0]!.text}`, at, spans, [ref(mentionIds[0]!)], { referent: ref(localId), entity: ref(entity.id), decision: "same", replaces: [] });
            support(resolution, [ref(mentionIds[0]!)], "identity", "accepted", "人工金标按该处上下文分配指称；同名意识、身体和原主人保持分离。");
        }
        for (const name of [{ text: first.text, at: entity.at }, { text: entity.label, at: entity.labelAt ?? entity.at }]) {
            const mention = nodes.find(node => node.kind === "mention" && node.data.referent.id === localRefs.get(`${entity.id}:${name.at[0]}`) && comparePosition(node.availableAt, position(name.at)) === 0);
            if (!mention) throw new Error(`Name lacks an annotated material anchor ${entity.id}:${name.text}`);
            record.data.names.push({ text: name.text, availableAt: position(name.at), dependencies: [ref(mention.id), ref(`resolve:${entity.id}:c${name.at[0]}`)] });
        }
    }
    function local(entityId: string, at: Position): RecordRef {
        const id = localRefs.get(`${entityId}:${at.chapter}`);
        if (id && comparePosition(byId.get(id)!.availableAt, at) <= 0) return ref(id);
        const entity = byId.get(entityId);
        if (!entity || entity.kind !== "entity") throw new Error(`Unknown entity ${entityId}`);
        const fallback = `ref:${entityId}:at${at.chapter}-${at.paragraph}`;
        if (!byId.has(fallback)) {
            const evidence = spanRange(at.chapter, at.paragraph, at.paragraph);
            add("referent", fallback, `语境指称：${entityId}`, at, evidence, [], { localName: `语境指称：${entityId}`, mentions: [], splitFrom: null });
            const resolution = add("resolution", `resolve:${fallback}`, `上下文归属：${entityId}`, at, evidence, [], { referent: ref(fallback), entity: ref(entityId), decision: "same", replaces: [] });
            support(resolution, [ref(fallback)], "identity", "accepted", "人工标注通过该段语境确认对象；完整段落保留为重新消歧锚点。");
        }
        return ref(fallback);
    }
    function createFact(spec: Annotations["inferences"][number] | NonNullable<Annotations["claims"][number]["fact"]>, proposition: string, at: Position, evidence: Span[], premises: RecordRef[], method: "direct" | "inference") {
        const predicateId = `predicate:${spec.predicate}`;
        if (!byId.has(predicateId)) add("predicate", predicateId, spec.predicate, at, [], [], {
            name: spec.predicate, definition: `金标关系词：${spec.predicate}；不含未声明推理规则。`, roles: Object.keys(spec.args).map(name => ({ name, valueKinds: ["entity", "text", "number"] })), symmetric: false, family: spec.predicate,
        });
        const interpretationDependencies: RecordRef[] = [];
        const arguments_ = Object.entries(spec.args).map(([role, value]) => {
            if (typeof value === "string") {
                if (byId.get(value)?.kind !== "entity") throw new Error(`Unknown fact entity ${spec.id}:${value}`);
                const localRef = local(value, at);
                const resolution = nodes.find(node => node.kind === "resolution" && node.data.referent.id === localRef.id);
                if (!resolution) throw new Error(`Missing resolution ${spec.id}:${value}`);
                interpretationDependencies.push(ref(resolution.id));
                return { role, value: { type: "ref" as const, ref: ref(value) }, anchor: evidence[0] ?? null };
            }
            return { role, value: "text" in value ? { type: "text" as const, text: value.text } : { type: "number" as const, number: value.number, unit: value.unit }, anchor: evidence[0] ?? null };
        });
        const fact = add("fact", spec.id, proposition, at, evidence, [], {
            proposition, predicate: ref(predicateId), arguments: arguments_, polarity: "affirmative",
            assertion: { kind: spec.scope, holder: spec.holder ? ref(spec.holder) : null, opaque: spec.scope === "belief" || spec.scope === "speech" },
            time: spec.time ? { kind: "point", point: ref(spec.time) } : unspecified, qualifiers: { quantifier: "particular", conditions: [], textualConditions: [], exceptions: [], modality: "actual" }, interpretationDependencies,
        });
        support(fact, premises, method, spec.status, spec.note || "原文直接表达；以金标语义审查为准。");
    }
    for (const claim of annotations.claims) {
        const at = { chapter: claim.at[0], paragraph: claim.at[2] }, evidence = spanRange(...claim.at);
        const referents = claim.about.map(entity => local(entity, at));
        add("disclosure", claim.id, claim.text, at, evidence, [], {
            text: claim.text, channel: claim.channel, mode: claim.mode,
            attribution: [{ channel: claim.channel, holder: claim.holder ? local(claim.holder, at) : null }], referents, mentionedTime: claim.mentionedTime ? { kind: "point", point: ref(claim.mentionedTime) } : unspecified,
        });
        if (claim.fact) createFact({ ...claim.fact, holder: claim.fact.holder ?? claim.holder ?? undefined }, claim.fact.text ?? claim.text, at, evidence, [ref(claim.id)], "direct");
    }
    for (const beat of annotations.beats) {
        const at = { chapter: beat.chapter, paragraph: beat.to }, evidence = spanRange(beat.chapter, beat.from, beat.to);
        add("beat", beat.id, beat.label, at, evidence, [], { gist: beat.label, chapterId: sourceAt(beat.chapter).chapterId, fromParagraph: beat.from, toParagraph: beat.to, mode: beat.mode, referents: beat.entities.map(id => local(id, at)), disclosures: annotations.claims.filter(claim => claim.at[0] === beat.chapter && claim.at[1] >= beat.from && claim.at[2] <= beat.to).map(claim => ref(claim.id)) });
    }
    for (const inference of annotations.inferences) {
        const premises = inference.premises.map(ref);
        createFact(inference, inference.text, latest(premises), [], premises, "inference");
    }
    for (const access of annotations.access ?? []) add("knowledgeAccess", `access:${access.holder}:${access.target}`, `认知依据：${access.mode}`, position(access.at), [], access.premises.map(ref), {
        target: ref(access.target), holder: ref(access.holder), mode: access.mode, establishedAt: unspecified, evidence: access.premises.map(ref),
    });
    for (const episode of annotations.episodes) {
        const materials = episode.beats.map(ref), at = latest(materials);
        const node = add("episode", episode.id, episode.label, at, [], materials, {
            summary: episode.summary, scale: episode.beats.length > 1 ? "sequence" : "event", participants: episode.entities.map(id => ({ role: "participant", value: { type: "ref", ref: ref(id) }, anchor: null })), materials,
            components: [{ role: "title", text: episode.label, dependencies: materials }, { role: "step", text: episode.summary, dependencies: materials }], children: [], relations: [], time: unspecified,
        });
        support(node, materials, "aggregation", "accepted", "人工金标依据指定 Beat 组织事件；没有从叙述邻接自动推断因果。");
    }
    const last = [...sources].sort((a, b) => a.chapterOrder - b.chapterOrder).at(-1)!;
    const readAt = { chapter: last.chapterOrder, paragraph: last.paragraphs.length };
    const sourceManifest = `manifest:${createHash("sha256").update(sources.map(source => `${source.id}:${source.sha256}`).join("\n")).digest("hex").slice(0, 16)}`;
    const coverage: MemoryDataset["coverage"] = { through: readAt, chapters: sources.map(source => source.chapterOrder), material: "complete", semantic: "reviewed-selection", gaps: ["金标是人工选定的命题与事件集合，不宣称穷尽全部可推导知识。"], recordsExhausted: false, corpusClosed: false };
    const partitionWatermarks = { material: 1, identity: 1, interpretation: 1 };
    for (const summary of annotations.summaries) {
        const at = position(summary.through), dependencies = [...new Set(summary.items.flatMap(item => item.refs))].map(ref);
        add("entitySummary", summary.id, `${byId.get(summary.entity)?.label ?? summary.entity} · ${summary.facet}`, at, [], dependencies, {
            subject: ref(summary.entity), facet: summary.facet, readAt: at, story: unspecified,
            items: summary.items.map((item, index) => ({ id: `${summary.id}:item${index + 1}`, text: item.text, dependencies: item.refs.map(ref), readiness: "ready", assessmentBasis: item.refs.flatMap(id => {
                const assessment = byId.get(`assess:${id}`);
                return assessment?.kind === "assessment" ? [{ target: ref(id), epistemic: assessment.data.epistemic }] : [];
            }) })),
            coverage: { ...coverage, through: at, chapters: coverage.chapters.filter(chapter => chapter <= at.chapter) },
            builtFrom: { sourceManifest, knowledgeRevision: 1, partitionWatermarks },
        });
    }
    const dataset: MemoryDataset = { schema: "neurobook.memory.v7", book: capture.book, snapshot: { id: "gold-first-two-chapters-v1", sourceManifest, knowledgeRevision: 1, readAt }, sources, nodes, coverage, partitionWatermarks, invalidationRoots: [] };
    return parseDataset(dataset);
}

if (import.meta.main) {
    const dataset = compileGold(JSON.parse(await readFile(new URL("sources.json", import.meta.url), "utf8")), JSON.parse(await readFile(new URL("annotations.json", import.meta.url), "utf8")));
    await writeFile(new URL("dataset-v7.json", import.meta.url), `${JSON.stringify(dataset, null, 2)}\n`);
    console.log(JSON.stringify({ schema: "v7.gold-build/v1", sources: dataset.sources.length, nodes: dataset.nodes.length }));
}
