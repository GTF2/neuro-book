import {readFileSync} from "node:fs";
import {describe, expect, it} from "vitest";
import {createQueryService} from "./service.ts";
import {parseDataset, type NodeKind, type NodeOf} from "../t07-v7-schema-gold/index.ts";
import type {QueryResponse} from "./contract.ts";

const gold: unknown = JSON.parse(readFileSync(new URL("../t07-v7-schema-gold/dataset-v7.json", import.meta.url), "utf8"));
const ids = (result: QueryResponse) => result.items.flatMap(item => item.type === "record" ? [item.record.id] : []);
function mutableNode<K extends NodeKind>(dataset: ReturnType<typeof parseDataset>, id: string, kind: K): NodeOf<K> {
    const node = dataset.nodes.find(node => node.id === id);
    if (!node || node.kind !== kind) throw new Error(`Missing ${kind}: ${id}`);
    return node as NodeOf<K>;
}

describe("V7 read-only query contract", () => {
    it("allows the validated perspective subject to query its own empty knowledge without exposing reader records", () => {
        const query = createQueryService(gold);
        const scope = {perspective: "su", at: {chapter: 1, paragraph: 7}};
        const result = query({command: "knowledge", holder: "su", ...scope});
        expect(result.items).toEqual([]);
        expect(result.completeness).toMatchObject({returned: 0, corpusClosed: false});
        expect(query({command: "summaries", entity: "su", ...scope}).completeness.summaryStatus).toBe("missing-or-stale");
        expect(() => query({command: "knowledge", holder: "book", ...scope})).toThrow(/visible entity/);
        expect(() => query({command: "get", id: "su", ...scope})).toThrow(/unavailable/);
        expect(() => query({command: "knowledge", holder: "missing", perspective: "missing", at: scope.at})).toThrow(/Perspective/);
    });

    it("keeps the first explicit hearing boundary and full speech proposition", () => {
        const query = createQueryService(gold);
        expect(query({command: "knowledge", holder: "su", about: "creator", at: {chapter: 1, paragraph: 65}}).items).toEqual([]);
        const result = query({command: "knowledge", holder: "su", about: "creator", at: {chapter: 1, paragraph: 66}});
        expect(result.items).toHaveLength(1);
        expect(result.items[0]).toMatchObject({record: {kind: "knowledgeAccess", data: {mode: "heard"}}, target: {record: {id: "f119", data: {assertion: {kind: "speech", opaque: true}}}}});
        const facts = query({command: "facts", entity: "su", target: "creator"});
        expect(facts.items).toHaveLength(1);
        expect(facts.items[0]).toMatchObject({record: {id: "f119", data: {arguments: expect.arrayContaining([expect.objectContaining({role: "taskAuthor"})])}}});
    });

    it("paginates every fact exactly once and rejects cross-query cursors", () => {
        const query = createQueryService(gold);
        const first = query({command: "facts", limit: 7});
        const items = [...first.items];
        let cursor = first.nextCursor;
        while (cursor) {
            const page = query({command: "facts", limit: 7, cursor});
            items.push(...page.items);
            cursor = page.nextCursor;
        }
        expect(items).toHaveLength(58);
        expect(new Set(items.map(item => "record" in item ? item.record.id : null)).size).toBe(58);
        expect(() => query({command: "facts", limit: 8, cursor: first.nextCursor!})).toThrow(/cursor/i);
        expect(() => query({command: "facts", limit: 7, at: {chapter: 1}, cursor: first.nextCursor!})).toThrow(/cursor/i);
    });

    it("does not retrieve future names or reader evidence through a character perspective", () => {
        const query = createQueryService(gold);
        expect(query({command: "entities", query: "墨丘利秘典", at: {chapter: 1, paragraph: 7}}).items).toEqual([]);
        expect(query({command: "search", query: "墨丘利秘典", at: {chapter: 1, paragraph: 7}}).items).toEqual([]);
        expect(() => query({command: "get", id: "f119", at: {chapter: 1, paragraph: 65}})).toThrow(/unavailable/i);
        const character = query({command: "explain", id: "f119", perspective: "su", depth: 8, limit: 100});
        expect(JSON.stringify(character)).not.toContain('"kind":"assessment"');
        expect(JSON.stringify(character)).not.toContain('"kind":"argument"');
        expect(() => query({command: "source", chapter: 1, perspective: "su"})).toThrow(/reader/i);
    });

    it("preserves ambiguous names and can enumerate episodes without inventing a text query", () => {
        const query = createQueryService(gold);
        const candidates = query({command: "entities", query: "苏天晴"});
        expect(ids(candidates)[0]).toBe("su");
        expect(ids(candidates)).toEqual(expect.arrayContaining(["su", "original", "contract"]));
        expect(candidates.items[0]).toMatchObject({nameMatches: expect.arrayContaining([{text: "苏天晴", match: "exact"}])});
        expect(ids(query({command: "entities", query: "苏天晴", category: "person"}))).toEqual(["su", "original"]);
        expect(ids(query({command: "entities", query: "苏天晴", at: {chapter: 1}, category: "person"}))).toEqual(["su"]);
        const episodes = query({command: "search", kind: "episode", limit: 100});
        expect(episodes.items.length).toBeGreaterThan(0);
        expect(episodes.items.every(item => item.type === "record" && item.record.kind === "episode")).toBe(true);
        expect(query({command: "search", kind: "synthesis"}).items).toEqual([]);
        expect(query({command: "search", query: "ref:book:c1"}).items).toEqual([]);
    });

    it("does not reveal unscoped coverage notes through early or character queries", () => {
        const changed = parseDataset(gold);
        const detail = "未来章节才揭示的剧情缺口";
        changed.coverage.gaps = [detail];
        const query = createQueryService(changed);
        const early = query({command: "entities", query: "墨丘利秘典", at: {chapter: 1, paragraph: 7}});
        expect(early.items).toEqual([]);
        expect(JSON.stringify(early)).not.toContain(detail);
        expect(early.coverage.gaps.length).toBeGreaterThan(0);
        expect(JSON.stringify(query({command: "info", perspective: "su"}))).not.toContain(detail);
        expect(query({command: "info"}).coverage.gaps).toEqual([detail]);
        expect(changed.coverage.gaps).toEqual([detail]);
        const otherWorld = mutableNode(changed, "su", "entity");
        changed.nodes.push({...otherWorld, id: "other-world-subject", scope: {world: "parallel", perspective: "reader"}, data: {...otherWorld.data, names: []}});
        expect(JSON.stringify(createQueryService(changed)({command: "info"}))).not.toContain(detail);
    });

    it("applies the same coverage boundary to visible summaries and syntheses", () => {
        const changed = parseDataset(gold);
        const detail = "仅完整读者范围可见的覆盖说明";
        const summary = mutableNode(changed, "s-star", "entitySummary");
        summary.data.coverage.gaps = [detail];
        const synthesis: NodeOf<"synthesis"> = {
            ...summary, id: "test-synthesis", kind: "synthesis",
            data: {topic: "已有记录的综述", items: summary.data.items, children: [], coverage: summary.data.coverage, interpretation: true},
        };
        changed.nodes.push(synthesis);
        const access = changed.nodes.find(node => node.kind === "knowledgeAccess");
        if (!access) throw new Error("Fixture has no knowledge access");
        for (const node of [summary, synthesis]) changed.nodes.push({
            ...access, id: `test-read-${node.id}`, availableAt: changed.snapshot.readAt,
            data: {...access.data, holder: {id: "su", revision: 1}, target: {id: node.id, revision: node.revision}, mode: "read"},
        });
        const before = JSON.stringify(changed);
        const query = createQueryService(changed);
        for (const node of [summary, synthesis]) {
            const character = query({command: "get", id: node.id, perspective: "su"});
            expect(ids(character)).toEqual([node.id]);
            expect(JSON.stringify(character)).not.toContain(detail);
            expect(JSON.stringify(query({command: "get", id: node.id}))).toContain(detail);
        }
        expect(JSON.stringify(changed)).toBe(before);
    });

    it("returns explicit unaware without disclosing its unavailable target or inventing absence", () => {
        const query = createQueryService(gold);
        const result = query({command: "knowledge", holder: "su", about: "f214", perspective: "su", mode: "unaware"});
        expect(result.items).toHaveLength(1);
        expect(result.items[0]).toMatchObject({target: {id: "f214", status: "unavailable"}});
        expect(query({command: "knowledge", holder: "su", about: "unmentioned-entity"}).items).toEqual([]);
        expect(query({command: "knowledge", holder: "su", about: "unmentioned-entity"}).completeness.corpusClosed).toBe(false);
    });

    it("returns latest summaries, facet misses and stale snapshots explicitly", () => {
        const query = createQueryService(gold);
        const current = query({command: "summaries", entity: "su"});
        expect(current.completeness.summaryStatus).toBe("ready");
        const facets = current.items.flatMap(item => item.type === "record" && item.record.kind === "entitySummary" ? [item.record.data.facet] : []);
        expect(new Set(facets).size).toBe(facets.length);
        expect(query({command: "summaries", entity: "su", facet: "not-present"}).completeness.summaryStatus).toBe("missing-or-stale");
        const changed = parseDataset(gold);
        mutableNode(changed, "s-star", "entitySummary").data.builtFrom.knowledgeRevision++;
        expect(createQueryService(changed)({command: "summaries", entity: "star"}).completeness.summaryStatus).toBe("missing-or-stale");
        expect(() => query({command: "summaries", entity: "original", at: {chapter: 1}})).toThrow(/visible entity/);
    });

    it("keeps tentative assessments by default and filters only when requested", () => {
        const changed = parseDataset(gold);
        mutableNode(changed, "arg:f103", "argument").data.status = "conditional";
        const query = createQueryService(changed);
        expect(ids(query({command: "facts", limit: 100}))).toContain("f103");
        expect(ids(query({command: "facts", epistemic: "tentative", limit: 100}))).toContain("f103");
        expect(ids(query({command: "facts", epistemic: "accepted", limit: 100}))).not.toContain("f103");
        changed.invalidationRoots.push({id: "arg:f103", revision: 1});
        expect(() => createQueryService(changed)({command: "get", id: "f103"})).toThrow(/unavailable/);
    });

    it("bounds evidence depth and paginates the same deduplicated traversal", () => {
        const query = createQueryService(gold);
        const shallow = query({command: "explain", id: "f119", depth: 0});
        expect(ids(shallow)).toEqual(["f119"]);
        expect(shallow.truncation.depth).toBe(true);
        expect(shallow.nextCursor).toBeNull();
        expect(shallow.completeness.recordsExhausted).toBe(false);
        expect(shallow.coverage.recordsExhausted).toBe(false);
        expect(shallow.items[0]).toMatchObject({boundary: expect.arrayContaining([expect.objectContaining({relation: "assessment"})])});
        const full = query({command: "explain", id: "f119", depth: 4, limit: 100});
        expect(ids(full)).toEqual(expect.arrayContaining(["f119", "arg:f119", "assess:f119", "d119"]));
        expect(new Set(ids(full)).size).toBe(ids(full).length);
        expect(full.items.some(item => item.type === "record" && item.provenance.excerpts.some(excerpt => excerpt.chapter === 1 && excerpt.span.paragraph === 66))).toBe(true);
        const paged: string[] = [];
        let cursor: string | undefined;
        do {
            const page = query({command: "explain", id: "f119", depth: 4, limit: 3, cursor});
            paged.push(...ids(page));
            cursor = page.nextCursor ?? undefined;
        } while (cursor);
        expect(paged).toEqual(ids(full));
        for (const item of full.items) if (item.type === "record") {
            const handles = [...item.provenance.arguments, ...(item.links ?? []).map(link => link.target)];
            for (const handle of handles) expect(Object.keys(handle).sort()).toEqual(["id", "revision", "status"]);
        }
    });

    it("retains an earlier unavailable evidence path on the final explain page", () => {
        const query = createQueryService(gold);
        let result = query({command: "explain", id: "access:su:f214", perspective: "su", depth: 8, limit: 1});
        const unavailable = result.truncation.unavailableReferences;
        expect(unavailable).toBeGreaterThan(0);
        expect(result.nextCursor).not.toBeNull();
        while (result.nextCursor) result = query({command: "explain", id: "access:su:f214", perspective: "su", depth: 8, limit: 1, cursor: result.nextCursor});
        expect(result.truncation.unavailableReferences).toBe(unavailable);
        expect(result.completeness.recordsExhausted).toBe(false);
        expect(result.coverage.recordsExhausted).toBe(false);
    });

    it("ranks exact names before prefixes and substrings across page boundaries", () => {
        const changed = parseDataset(gold);
        mutableNode(changed, "su", "entity").data.names[0]!.text = "Needle prefix";
        mutableNode(changed, "original", "entity").data.names[0]!.text = "Needle";
        mutableNode(changed, "contract", "entity").data.names[0]!.text = "other Needle";
        const query = createQueryService(changed);
        const first = query({command: "entities", query: "needle", limit: 1});
        expect(ids(first)).toEqual(["original"]);
        const second = query({command: "entities", query: "needle", limit: 1, cursor: first.nextCursor});
        expect(ids(second)).toEqual(["su"]);
        const third = query({command: "entities", query: "needle", limit: 1, cursor: second.nextCursor});
        expect(ids(third)).toEqual(["contract"]);
        expect(third.nextCursor).toBeNull();
    });

    it("confines numbered source paragraphs and reports requested reading coverage", () => {
        const query = createQueryService(gold);
        const source = query({command: "source", chapter: 1, from: 5, at: {chapter: 1, paragraph: 7}});
        expect(source.items.map(item => item.type === "source" ? item.paragraph : null)).toEqual([5, 6, 7]);
        expect(source.coverage.through).toEqual({chapter: 1, paragraph: 7});
        expect(query({command: "info", at: {chapter: 1}}).scope.readAt).toEqual({chapter: 1, paragraph: 76});
        expect(() => query({command: "source", chapter: 1, to: 8, at: {chapter: 1, paragraph: 7}})).toThrow(/range/);
        expect(() => query({command: "source", chapter: 2, at: {chapter: 1}})).toThrow(/range/);
    });

    it("rejects malformed scopes, unsupported filters and changed-snapshot cursors", () => {
        const query = createQueryService(gold);
        for (const request of [
            {command: "search"}, {command: "facts", limit: 101}, {command: "facts", ignored: true},
            {command: "get", id: "su", limit: 1}, {command: "facts", assertion: "true"},
            {command: "info", at: {chapter: 3}}, {command: "info", at: {chapter: 1, paragraph: 77}},
            {command: "info", world: "missing"}, {command: "info", perspective: "f119"},
            {command: "facts", cursor: "not-a-cursor"},
        ]) expect(() => query(request)).toThrow();
        const first = query({command: "facts", limit: 7});
        const changed = parseDataset(gold);
        changed.book.title += " changed";
        expect(() => createQueryService(changed)({command: "facts", limit: 7, cursor: first.nextCursor})).toThrow(/cursor/i);
        first.items.splice(0);
        expect(query({command: "facts", limit: 7}).items).toHaveLength(7);
    });
});
