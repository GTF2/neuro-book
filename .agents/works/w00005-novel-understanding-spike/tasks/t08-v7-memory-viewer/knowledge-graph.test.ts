import {readFileSync} from "node:fs";
import {describe, expect, it} from "vitest";
import {createQueryIndex, parseDataset, querySnapshot} from "../t07-v7-schema-gold/index.ts";
import {entityArguments, expandedKnowledgeGraph, knowledgeAccessEdges, knowledgeGraph, propositionGraph, structuralEdges} from "./knowledge-graph.ts";
import {expandedLayout, graphLabelLines} from "./expanded-layout.ts";
import {nodeAppearance} from "./visual-semantics.ts";

const dataset = parseDataset(JSON.parse(readFileSync(new URL("../t07-v7-schema-gold/dataset-v7.json", import.meta.url), "utf8")));
const snapshot = querySnapshot(createQueryIndex(dataset), {readAt: dataset.snapshot.readAt, perspective: "reader", world: "original"});

describe("subject knowledge presentation", () => {
    it("pages every related claim and scopes knowledge links to the current page", () => {
        const ids = new Set(snapshot.nodes.filter(node => node.kind === "fact").map(node => node.id));
        const expected = snapshot.nodes.filter(node => node.kind === "fact" && node.data.arguments.some(arg => arg.value.type === "ref" && arg.value.ref.id === "su")).map(node => node.id).sort();
        const first = expandedKnowledgeGraph(snapshot.nodes, "su", ids);
        expect(first.total).toBe(42);
        expect(first.pages).toBe(7);
        const reached: string[] = [];
        for (let page = 0; page < first.pages; page++) {
            const graph = expandedKnowledgeGraph(snapshot.nodes, "su", ids, page);
            const facts = graph.nodes.filter(node => node.kind === "fact").map(node => node.id);
            expect(facts.length).toBeLessThanOrEqual(6);
            reached.push(...facts);
            expect(graph.edges.every(edge => edge.accesses ? edge.accesses.every(access => facts.includes(access.factId)) : facts.includes(edge.factId ?? ""))).toBe(true);
            for (const width of [320, 768, 1440]) {
                const layout = expandedLayout(graph.nodes, graph.edges, "su", width, 360);
                expect(layout.positions.size).toBe(graph.nodes.length);
                const points = [...layout.positions.values()];
                expect(points.every(point => point.x >= 90 && point.x + 90 <= layout.width && point.y >= 10 && point.y + 65 < layout.height)).toBe(true);
                for (const [index, point] of points.entries()) {
                    expect(points.slice(index + 1).every(other => Math.abs(point.x - other.x) >= 190 || Math.abs(point.y - other.y) >= 80)).toBe(true);
                }
            }
        }
        expect(reached.sort()).toEqual(expected);
        expect(expandedKnowledgeGraph(snapshot.nodes, "su", ids, 99).page).toBe(6);
        expect(graphLabelLines("一".repeat(40), true).map(line => [...line].length)).toEqual([14, 15]);
    });
    it("distinguishes local referents from bodies and names gray categories", () => {
        const body = snapshot.nodes.find(node => node.kind === "entity" && node.data.category === "body");
        const referent = snapshot.nodes.find(node => node.kind === "referent");
        const concept = snapshot.nodes.find(node => node.kind === "entity" && node.data.category === "concept");
        expect(body && nodeAppearance(body)).toMatchObject({shape: "circle", label: "身体"});
        expect(referent && nodeAppearance(referent)).toMatchObject({shape: "diamond", label: "局部指称"});
        expect(concept && nodeAppearance(concept)).toMatchObject({label: "概念", color: "#77818e"});
    });
    it("defaults to subjects and aggregates claims without losing their identities", () => {
        const graph = knowledgeGraph(snapshot.nodes, "su", false, false);
        expect(graph.nodes.every(node => node.kind === "entity")).toBe(true);
        expect(graph.nodes).toHaveLength(24);
        const pairs = graph.edges.filter(edge => edge.factIds);
        expect(new Set(pairs.map(edge => [edge.source, edge.target].sort().join("|"))).size).toBe(pairs.length);
        const entities = new Set(graph.nodes.map(node => node.id));
        const expected = snapshot.nodes.filter(node => node.kind === "fact" && entityArguments(node, entities).length === 2).map(node => node.id).sort();
        expect(pairs.flatMap(edge => edge.factIds ?? []).sort()).toEqual(expected);
    });
    it("expands multi-party facts as claim nodes without fabricating binary connections", () => {
        const graph = knowledgeGraph(snapshot.nodes, "su", true, true);
        const entities = new Set(snapshot.nodes.filter(node => node.kind === "entity").map(node => node.id));
        const multi = snapshot.nodes.find(node => node.kind === "fact" && entityArguments(node, entities).length > 2 && entityArguments(node, entities).includes("su"));
        expect(multi).toBeDefined();
        expect(graph.nodes.some(node => node.id === multi?.id)).toBe(true);
        const incident = graph.edges.filter(edge => edge.factId === multi?.id);
        expect(incident.every(edge => edge.source === multi?.id)).toBe(true);
        expect(incident.every(edge => !edge.factIds)).toBe(true);
    });
    it("keeps dependency/reference ownership and removes duplicate semantic projections", () => {
        const edges = structuralEdges(snapshot.edges);
        expect(edges.every(edge => edge.kind !== "semantic")).toBe(true);
        expect(new Set(edges.map(edge => `${edge.source}:${edge.target}`)).size).toBe(edges.length);
        expect(edges.every(edge => snapshot.edges.some(original => original.source === edge.source && original.target === edge.target))).toBe(true);
    });
    it("projects explicit character knowledge to referenced entities without mixing story pairs", () => {
        const graph = knowledgeGraph(snapshot.nodes, "su", false, false);
        const access = knowledgeAccessEdges(snapshot.nodes);
        const creator = access.find(edge => edge.source === "su" && edge.target === "creator");
        expect(creator).toBeDefined();
        expect(creator?.accesses).toEqual([{accessId: "access:su:f119", factId: "f119", mode: "heard"}]);
        expect(creator?.factIds).toBeUndefined();
        expect(graph.edges).toContainEqual(creator);
    });
    it("shows the creator contact only at the first explicit hearing boundary", () => {
        const index = createQueryIndex(dataset);
        const before = querySnapshot(index, {readAt: {chapter: 1, paragraph: 65}, perspective: "reader", world: "original"});
        const after = querySnapshot(index, {readAt: {chapter: 1, paragraph: 66}, perspective: "reader", world: "original"});
        expect(knowledgeAccessEdges(before.nodes).some(edge => edge.target === "creator")).toBe(false);
        expect(knowledgeAccessEdges(after.nodes).find(edge => edge.target === "creator")?.accesses).toEqual([{accessId: "access:su:f119", factId: "f119", mode: "heard"}]);
    });
    it("removes knowledge contacts when their evidence or access is invalidated", () => {
        for (const id of ["d119", "access:su:f119", "resolve:creator:c1"]) {
            const dirty = structuredClone(dataset);
            dirty.invalidationRoots.push({id, revision: 1});
            const current = querySnapshot(createQueryIndex(dirty), {readAt: dirty.snapshot.readAt, perspective: "reader", world: "original"});
            const edges = knowledgeAccessEdges(current.nodes);
            expect(edges.some(edge => edge.target === "creator"), id).toBe(false);
            expect(edges.some(edge => edge.accesses?.some(access => access.accessId === "access:su:f119")), id).toBe(false);
        }
    });
    it("honors fact filters without leaking access to filtered or missing targets", () => {
        const filtered = snapshot.nodes.filter(node => node.id !== "f119");
        expect(filtered.some(node => node.id === "access:su:f119")).toBe(true);
        const graph = knowledgeGraph(filtered, "su", false, false);
        expect(graph.edges.some(edge => edge.target === "creator" && edge.accesses)).toBe(false);
        expect(graph.edges.some(edge => edge.accesses?.some(access => access.factId === "f119"))).toBe(false);
        expect(knowledgeAccessEdges(snapshot.nodes.filter(node => node.id !== "su"))).toHaveLength(0);
    });
    it("excludes unaware records and keeps the positive character projection available", () => {
        const edges = knowledgeAccessEdges(snapshot.nodes);
        expect(edges.some(edge => edge.accesses?.some(access => access.accessId === "access:su:f214"))).toBe(false);
        const character = querySnapshot(createQueryIndex(dataset), {readAt: dataset.snapshot.readAt, perspective: "su", world: "original"});
        expect(knowledgeAccessEdges(character.nodes).find(edge => edge.target === "creator")?.accesses).toEqual([{accessId: "access:su:f119", factId: "f119", mode: "heard"}]);
        expect(knowledgeAccessEdges(character.nodes).some(edge => edge.accesses?.some(access => access.factId === "f214"))).toBe(false);
    });
    it("aggregates access per directed subject pair while preserving every mode and source", () => {
        const original = snapshot.nodes.find(node => node.id === "access:su:f119");
        expect(original?.kind).toBe("knowledgeAccess");
        if (original?.kind !== "knowledgeAccess") return;
        const modes = ["heard", "read", "believed", "known"] as const;
        const variants = modes.map(mode => ({...original, id: `access:test:${mode}`, data: {...original.data, mode}}));
        const withoutAccess = snapshot.nodes.filter(node => node.kind !== "knowledgeAccess");
        const edges = knowledgeAccessEdges([...withoutAccess, ...variants]);
        const creator = edges.filter(edge => edge.source === "su" && edge.target === "creator");
        expect(creator).toHaveLength(1);
        expect(creator[0]?.accesses).toEqual(modes.map(mode => ({accessId: `access:test:${mode}`, factId: "f119", mode})));
        expect(creator[0]?.label).toBe("相关认知 · 4 条");
        expect(edges.every(edge => edge.source !== edge.target && !edge.factIds)).toBe(true);
        const names = ["听闻相关说法", "读到相关记载", "相信相关说法", "知晓相关信息"];
        for (const [i, access] of variants.entries()) expect(knowledgeAccessEdges([...withoutAccess, access]).find(edge => edge.target === "creator")?.label).toBe(names[i]);
        const local = knowledgeGraph(snapshot.nodes, "creator", false, true);
        expect(local.nodes.map(node => node.id).sort()).toEqual(["creator", "su"]);
        expect(local.edges.filter(edge => edge.accesses)).toHaveLength(1);
    });
    it("does not infer entity identity through referents or turn co-occurrence into knowledge", () => {
        const fact = snapshot.nodes.find(node => node.id === "f119");
        expect(fact?.kind).toBe("fact");
        if (fact?.kind !== "fact") return;
        const unresolved = {...fact, data: {...fact.data, arguments: fact.data.arguments.map(argument => argument.value.type === "ref" && argument.value.ref.id === "creator" ? {...argument, value: {...argument.value, ref: {id: "ref:creator:c1", revision: 1}}} : argument)}};
        const nodes = snapshot.nodes.map(node => node.id === fact.id ? unresolved : node);
        expect(knowledgeAccessEdges(nodes).some(edge => edge.target === "creator")).toBe(false);
        expect(knowledgeAccessEdges(snapshot.nodes.filter(node => node.kind !== "knowledgeAccess"))).toHaveLength(0);
    });
    it("reaches every fact through bounded pages, including facts without entity arguments", () => {
        const ids = new Set(snapshot.nodes.filter(node => node.kind === "fact").map(node => node.id));
        const first = propositionGraph(snapshot.nodes, null, ids);
        const reached = new Set<string>();
        for (let page = 0; page < first.pages; page++) {
            const graph = propositionGraph(snapshot.nodes, null, ids, page);
            const facts = graph.nodes.filter(node => node.kind === "fact" && ids.has(node.id));
            expect(facts.length).toBeLessThanOrEqual(6);
            for (const fact of facts) reached.add(fact.id);
        }
        expect(reached).toEqual(ids);
        for (const id of ids) expect(propositionGraph(snapshot.nodes, id, ids).nodes.some(node => node.id === id)).toBe(true);
    });
    it("preserves each argument role rather than converting a multi-party proposition into pairs", () => {
        const entities = new Set(snapshot.nodes.filter(node => node.kind === "entity").map(node => node.id));
        const fact = snapshot.nodes.find(node => node.kind === "fact" && entityArguments(node, entities).length > 2);
        expect(fact?.kind).toBe("fact");
        if (fact?.kind !== "fact") return;
        const graph = propositionGraph(snapshot.nodes, fact.id, new Set([fact.id]));
        expect(graph.edges.map(edge => edge.label)).toEqual(fact.data.arguments.filter(argument => argument.value.type === "ref").map(argument => argument.role));
        expect(graph.edges.every(edge => edge.source === fact.id && edge.factId === fact.id)).toBe(true);
    });
    it("cannot add a later entity or fact to an earlier query projection", () => {
        const early = querySnapshot(createQueryIndex(dataset), {readAt: {chapter: 1, paragraph: 30}, perspective: "reader", world: "original"});
        const graph = knowledgeGraph(early.nodes, "su", true, false);
        expect(graph.nodes.every(node => node.availableAt.chapter === 1 && node.availableAt.paragraph <= 30)).toBe(true);
        expect(graph.edges.flatMap(edge => edge.accesses?.flatMap(access => [access.factId, access.accessId]) ?? edge.factIds ?? [edge.factId]).every(id => early.nodes.some(node => node.id === id))).toBe(true);
    });
});
