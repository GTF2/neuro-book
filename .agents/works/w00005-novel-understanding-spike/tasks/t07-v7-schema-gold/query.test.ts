import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { compileGold } from "./build-gold.ts";
import { aggregateAssessment, createQueryIndex, queryEntitySummaries, querySnapshot } from "./query.ts";
import { parseDataset, spanText } from "./validate.ts";
import type { MemoryDataset, NodeKind, NodeOf } from "./schema.ts";

const sources: unknown = JSON.parse(readFileSync(new URL("sources.json", import.meta.url), "utf8"));
const annotations: unknown = JSON.parse(readFileSync(new URL("annotations.json", import.meta.url), "utf8"));
const gold = compileGold(sources, annotations);
const scope = { readAt: gold.snapshot.readAt, perspective: "reader", world: "original" };
function get<K extends NodeKind>(dataset: MemoryDataset, id: string, kind: K): NodeOf<K> {
    const node = dataset.nodes.find(node => node.id === id);
    assert.equal(node?.kind, kind);
    return node as NodeOf<K>;
}
function ids(dataset = gold, query = scope) { return new Set(querySnapshot(createQueryIndex(dataset), query).nodes.map(node => node.id)); }

test("gold builds deterministically with all twelve curated question boundaries", () => {
    assert.deepEqual(compileGold(sources, annotations), gold);
    const cases = (annotations as { cases: Array<{ id: string; through: [number, number]; expectedRefs: string[]; forbiddenRefs: string[] }> }).cases;
    for (const item of cases) {
        const result = ids(gold, { ...scope, readAt: { chapter: item.through[0], paragraph: item.through[1] } });
        for (const id of item.expectedRefs) assert(result.has(id), `${item.id} missing ${id}`);
        for (const id of item.forbiddenRefs) assert(!result.has(id), `${item.id} leaked ${id}`);
    }
});

test("early serialized projection contains neither future names nor future predicate vocabulary", () => {
    const result = querySnapshot(createQueryIndex(gold), { ...scope, readAt: { chapter: 1, paragraph: 7 } });
    const serialized = JSON.stringify(result);
    assert(!serialized.includes("墨丘利秘典"));
    assert(!serialized.includes("successful_transformation_attempt"));
    assert.equal(get({ ...gold, nodes: result.nodes }, "book", "entity").label, "黑色古书");
    const referent = result.nodes.find(node => node.kind === "referent" && node.id === "ref:book:c1");
    assert(referent?.kind === "referent");
    assert.equal(referent.data.mentions.length, 1);
});

test("identity keeps the recipient original and local pronouns resolve to their annotated holder", () => {
    const funds = get(gold, "f207", "fact");
    assert(funds.data.arguments.some(arg => arg.value.type === "ref" && arg.value.ref.id === "original"));
    assert(!funds.data.arguments.some(arg => arg.value.type === "ref" && arg.value.ref.id === "su"));
    const pronoun = gold.nodes.find(node => node.kind === "mention" && node.data.text === "我");
    assert(pronoun?.kind === "mention");
    assert.equal(pronoun.data.referent.id, "ref:su:c1");
    const changed = structuredClone(gold);
    const resolution = get(changed, "resolve:original:c2", "resolution");
    changed.invalidationRoots.push({ id: resolution.id, revision: resolution.revision });
    assert(!ids(changed).has("f207"));
});

test("character projection distinguishes unaware, heard and believed without inheriting reader inference", () => {
    const at = { chapter: 2, paragraph: 40 };
    const reader = ids(gold, { ...scope, readAt: at });
    const character = querySnapshot(createQueryIndex(gold), { ...scope, readAt: at, perspective: "su" });
    assert(reader.has("f214") && reader.has("i203"));
    assert(!character.nodes.some(node => node.id === "f214" || node.id === "i203" || node.id === "d214"));
    assert(character.knowledge.some(item => item.target === "f214" && item.mode === "unaware"));
    assert(character.knowledge.some(item => item.target === "f215" && item.mode === "heard"));
    assert(character.knowledge.some(item => item.target === "f108" && item.mode === "believed"));
    assert.equal(character.edges.filter(edge => edge.kind === "semantic").length, 0);
});

test("independent usable support survives a stale alternative but dirty counterevidence blocks acceptance", () => {
    const dataset = structuredClone(gold), original = get(dataset, "arg:f103", "argument");
    const alternative = structuredClone(original); alternative.id = "alternate:f103"; alternative.readiness = "stale";
    dataset.nodes.push(alternative);
    get(dataset, "assess:f103", "assessment").data.arguments.push({ id: alternative.id, revision: 1 });
    const result = querySnapshot(createQueryIndex(dataset), scope);
    assert(result.nodes.some(node => node.id === "f103"));
    assert.equal(get({ ...dataset, nodes: result.nodes }, "assess:f103", "assessment").data.epistemic, "accepted");
    alternative.data.polarity = "opposes";
    assert(!ids(dataset).has("f103"));
});

test("tentative required premises cannot wash into accepted through a later inference", () => {
    const dataset = structuredClone(gold);
    get(dataset, "arg:f115", "argument").data.status = "conditional";
    const result = querySnapshot(createQueryIndex(dataset), scope);
    assert.equal(get({ ...dataset, nodes: result.nodes }, "assess:i101", "assessment").data.epistemic, "tentative");
    assert.equal(aggregateAssessment([{ polarity: "supports", status: "usable" }, { polarity: "opposes", status: "conditional" }]), "disputed");
    assert.equal(aggregateAssessment([{ polarity: "supports", status: "blocked" }]), "unsupported");
});

test("entity summary lookup matches full scan and rejects source, head, item and watermark staleness", () => {
    const index = createQueryIndex(gold), fast = queryEntitySummaries(index, "su", scope);
    const scan = querySnapshot(index, scope).nodes.filter(node => node.kind === "entitySummary" && node.data.subject.id === "su");
    assert(fast.items.length > 0);
    assert(fast.diagnostics.candidates < gold.nodes.length);
    assert(fast.items.every(node => scan.some(item => item.id === node.id)));
    for (const mutation of [
        (summary: NodeOf<"entitySummary">) => { summary.data.builtFrom.sourceManifest = "other"; },
        (summary: NodeOf<"entitySummary">) => { summary.data.builtFrom.knowledgeRevision++; },
        (summary: NodeOf<"entitySummary">) => { summary.data.items[0]!.readiness = "stale"; },
        (summary: NodeOf<"entitySummary">) => { summary.data.builtFrom.partitionWatermarks.identity = 0; },
    ]) {
        const dataset = structuredClone(gold);
        mutation(get(dataset, "s-star", "entitySummary"));
        assert.equal(queryEntitySummaries(createQueryIndex(dataset), "star", scope).status, "missing-or-stale");
    }
});

test("indirect watch invalidation reaches facts and summaries", () => {
    const dataset = structuredClone(gold), fact = get(dataset, "f115", "fact");
    dataset.nodes.push({ ...fact, id: "watch:f115", kind: "watch", spans: [], dependencies: [], data: { targets: [{ id: fact.id, revision: 1 }], partitions: ["material"], reason: "new opposing material", checkedWatermarks: { material: 0 } } });
    const result = ids(dataset);
    assert(!result.has("f115") && !result.has("i101") && !result.has("s-su-c1"));
});

test("summary pins epistemic basis, preserving intentional uncertainty and invalidating changed wording", () => {
    assert(ids().has("s-book-c1"));
    const dataset = structuredClone(gold);
    get(dataset, "arg:f115", "argument").data.status = "conditional";
    const result = ids(dataset);
    assert(result.has("i101"));
    assert(!result.has("s-su-c1"));
});

test("a later evaluation never masquerades as a verdict available at an earlier readAt", () => {
    const dataset = structuredClone(gold);
    const assessment = get(dataset, "assess:f103", "assessment");
    assessment.data.evaluatedAt = { chapter: 2, paragraph: 87 };
    assert(!ids(dataset, { ...scope, readAt: { chapter: 1, paragraph: 7 } }).has("f103"));
});

test("invalid roles, dangling refs, summary evidence roots, self-support and broken Beat coverage are rejected", () => {
    for (const mutate of [
        (dataset: MemoryDataset) => { get(dataset, "f103", "fact").data.arguments[0]!.role = "unknown"; },
        (dataset: MemoryDataset) => { get(dataset, "f103", "fact").data.predicate.revision = 99; },
        (dataset: MemoryDataset) => { get(dataset, "arg:f103", "argument").data.premises = [{ ref: { id: "s-book-c1", revision: 1 }, role: "evidence", required: true }]; },
        (dataset: MemoryDataset) => { get(dataset, "arg:f103", "argument").data.premises = [{ ref: { id: "f103", revision: 1 }, role: "evidence", required: true }]; },
        (dataset: MemoryDataset) => { dataset.nodes = dataset.nodes.filter(node => !(node.kind === "beat" && node.data.fromParagraph === 1)); },
    ]) { const dataset = structuredClone(gold); mutate(dataset); assert.throws(() => parseDataset(dataset)); }
});

test("UTF-16 spans cannot split a surrogate pair", () => {
    const dataset = structuredClone(gold); dataset.sources[0]!.paragraphs[0] = "a😀b";
    const span = { sourceId: dataset.sources[0]!.id, sourceRevision: 1, paragraph: 1, start: 1, end: 3 };
    assert.equal(spanText(dataset, span), "😀");
    assert.throws(() => spanText(dataset, { ...span, end: 2 }));
});

test("retracting a name mention removes that name without erasing the persistent entity", () => {
    const dataset = structuredClone(gold);
    dataset.invalidationRoots.push({ id: "mention:book:c1:2", revision: 1 });
    const result = querySnapshot(createQueryIndex(dataset), scope);
    const book = get({ ...dataset, nodes: result.nodes }, "book", "entity");
    assert.equal(book.label, "黑色古书");
    assert(!book.data.names.some(name => name.text === "墨丘利秘典"));
    assert(result.nodes.some(node => node.id === "ref:book:c1"));
});

test("identity candidates and unsupported same decisions cannot attach names or canonical arguments", () => {
    for (const mutation of [
        (dataset: MemoryDataset) => { get(dataset, "resolve:book:c1", "resolution").data.decision = "candidate"; },
        (dataset: MemoryDataset) => { get(dataset, "arg:resolve:book:c1", "argument").data.status = "conditional"; },
    ]) {
        const dataset = structuredClone(gold); mutation(dataset);
        const result = querySnapshot(createQueryIndex(dataset), scope);
        const book = get({ ...dataset, nodes: result.nodes }, "book", "entity");
        assert.equal(book.label, "book");
        assert.deepEqual(book.data.names, []);
        assert(!result.nodes.some(node => node.id === "f111"));
        assert(result.nodes.some(node => node.id === "resolve:book:c1"));
        assert(result.nodes.some(node => node.id === "d111"));
    }
});

test("all names have scoped material and identity evidence and survive no array-order assumptions", () => {
    for (const entity of gold.nodes.filter(node => node.kind === "entity")) {
        assert(entity.data.names.every(name => name.dependencies.length > 0), entity.id);
    }
    const dataset = structuredClone(gold);
    get(dataset, "book", "entity").data.names.reverse();
    const result = querySnapshot(createQueryIndex(dataset), scope);
    assert.equal(get({ ...dataset, nodes: result.nodes }, "book", "entity").label, "墨丘利秘典");
    get(dataset, "book", "entity").data.names[0]!.dependencies = [];
    assert.throws(() => parseDataset(dataset));
});

test("invalidated first mention does not survive in local referent names", () => {
    const dataset = structuredClone(gold);
    dataset.invalidationRoots.push({ id: "mention:book:c1:1", revision: 1 });
    const result = querySnapshot(createQueryIndex(dataset), { ...scope, readAt: { chapter: 1, paragraph: 7 } });
    const local = get({ ...dataset, nodes: result.nodes }, "ref:book:c1", "referent");
    assert.equal(local.data.localName, local.id);
    assert.equal(local.label, local.id);
    assert.equal(get({ ...dataset, nodes: result.nodes }, "book", "entity").label, "book");
});

test("names reject future material, foreign identity and evidence-free dependency lists", () => {
    for (const mutate of [
        (name: NodeOf<"entity">["data"]["names"][number]) => { name.availableAt = { chapter: 1, paragraph: 7 }; },
        (name: NodeOf<"entity">["data"]["names"][number]) => { name.dependencies = [{ id: "mention:su:c1:1", revision: 1 }, { id: "resolve:su:c1", revision: 1 }]; },
        (name: NodeOf<"entity">["data"]["names"][number]) => { name.dependencies = [{ id: "resolve:book:c1", revision: 1 }]; },
    ]) {
        const dataset = structuredClone(gold); mutate(get(dataset, "book", "entity").data.names[1]!);
        assert.throws(() => parseDataset(dataset));
    }
});

test("display names never promote accepted self-report content into a world assertion", () => {
    const result = querySnapshot(createQueryIndex(gold), scope);
    assert.equal(get({ ...gold, nodes: result.nodes }, "book", "entity").label, "墨丘利秘典");
    const report = get({ ...gold, nodes: result.nodes }, "f111", "fact");
    assert.equal(report.data.assertion.kind, "speech");
    assert.equal(report.data.assertion.holder?.id, "book");
    assert.equal(report.data.assertion.opaque, true);
    assert.equal(get({ ...gold, nodes: result.nodes }, "assess:f111", "assessment").data.epistemic, "accepted");
    assert(!result.nodes.some(node => node.kind === "fact" && node.data.assertion.kind === "world" && node.data.predicate.id === report.data.predicate.id));
});
