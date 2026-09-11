import {describe, expect, it} from "vitest";
import {createQueryService} from "../t09-v7-query-cli/index.ts";
import {collectReferences} from "../t07-v7-schema-gold/index.ts";
import {compileSnapshot} from "./compiler.ts";
import {fixtureBook, fixtureChapter, fixtureSources} from "./fixture.ts";
import {reviewUnits, validateMaterial} from "./draft.ts";

describe("candidate to immutable V7 snapshot", () => {
    it("preserves speech scope, evidence and deterministic output", () => {
        const chapter = fixtureChapter();
        const dataset = compileSnapshot(fixtureBook, fixtureSources, [chapter]);
        expect(compileSnapshot(fixtureBook, fixtureSources, [chapter])).toEqual(dataset);
        const query = createQueryService(dataset);
        expect(query({command: "get", id: "c01:claim"}).items[0]).toMatchObject({record: {data: {assertion: {kind: "speech", opaque: true}}}, assessment: {data: {epistemic: "accepted"}}});
        expect(query({command: "explain", id: "c01:claim", depth: 3, limit: 100}).items.some(item => item.type === "record" && item.record.id === "c01:dclaim")).toBe(true);
    });

    it("appends names with new coherent revisions and keeps historical summaries in old snapshots", () => {
        const first = compileSnapshot(fixtureBook, fixtureSources, [fixtureChapter()]);
        const second = compileSnapshot(fixtureBook, fixtureSources, [fixtureChapter(), fixtureChapter(2)]);
        expect(first.nodes.every(node => node.revision === 1)).toBe(true);
        expect(second.nodes.every(node => node.revision === 2 && collectReferences(node).every(ref => ref.revision === 2))).toBe(true);
        const query = createQueryService(second);
        expect(query({command: "entities", query: "林青", at: {chapter: 1}}).items).toEqual([]);
        expect(query({command: "entities", query: "林青"}).items).toHaveLength(1);
        expect(query({command: "summaries", entity: "c01:person"}).completeness.summaryStatus).toBe("ready");
        expect(query({command: "summaries", entity: "c01:person", at: {chapter: 1}}).completeness.summaryStatus).toBe("missing-or-stale");
        expect(createQueryService(first)({command: "summaries", entity: "c01:person"}).completeness.summaryStatus).toBe("ready");
    });

    it("rejects review omissions, fake mentions, future proof and Beat gaps", () => {
        const mutations = [
            (chapter: ReturnType<typeof fixtureChapter>) => {chapter.review.judgments.pop();},
            (chapter: ReturnType<typeof fixtureChapter>) => {chapter.material.referents[0]!.mentions[0]!.text = "不存在";},
            (chapter: ReturnType<typeof fixtureChapter>) => {chapter.integration.facts[0]!.at = 1;},
            (chapter: ReturnType<typeof fixtureChapter>) => {chapter.material.beats[0]!.from = 2;},
            (chapter: ReturnType<typeof fixtureChapter>) => {chapter.integration.identities[0]!.entity = "known:future";},
            (chapter: ReturnType<typeof fixtureChapter>) => {chapter.material.disclosures[0]!.about = ["known:c01:person"];},
            (chapter: ReturnType<typeof fixtureChapter>) => {chapter.material.beats[0]!.about = ["dclaim"];},
            (chapter: ReturnType<typeof fixtureChapter>) => {chapter.integration.facts[0]!.identities = [];},
            (chapter: ReturnType<typeof fixtureChapter>) => {chapter.integration.arguments.push({id: "early", at: 1, target: "claim", polarity: "supports", proof: {premises: ["rperson"], method: "direct", certainty: "accepted", rationale: "Future conclusion"}}); chapter.review.judgments.push({id: "semantic:early", verdict: "passed", note: "Fixture"});},
        ];
        for (const mutate of mutations) {
            const chapter = fixtureChapter(); mutate(chapter);
            expect(() => compileSnapshot(fixtureBook, fixtureSources, [chapter])).toThrow();
        }
    });

    it("aggregates same-position opposing arguments once before summary assessment bases", () => {
        const chapter = fixtureChapter();
        chapter.integration.arguments.push({id: "opposition", at: 2, target: "claim", polarity: "opposes", proof: {premises: ["dclaim"], method: "direct", certainty: "accepted", rationale: "Contradictory source fixture"}});
        chapter.integration.summaries[0]!.items[0]!.refs = ["claim"];
        chapter.review.judgments = reviewUnits(chapter.material, chapter.integration).map(id => ({id, verdict: "passed", note: "Fixture independent review"}));
        const dataset = compileSnapshot(fixtureBook, fixtureSources, [chapter]);
        expect(dataset.nodes.filter(node => node.kind === "assessment" && node.data.target.id === "c01:claim")).toHaveLength(1);
        const query = createQueryService(dataset);
        expect(query({command: "get", id: "c01:claim"}).items[0]).toMatchObject({assessment: {data: {epistemic: "disputed"}}});
        expect(query({command: "summaries", entity: "c01:person"}).items[0]).toMatchObject({record: {data: {items: [{assessmentBasis: [{epistemic: "disputed"}]}]}}});
    });

    it("allows identity evidence after the first mention without backdating that evidence", () => {
        const chapter = fixtureChapter();
        chapter.integration.identities[0]!.at = 2;
        chapter.integration.identities[0]!.evidence = ["rperson", "dclaim"];
        const dataset = compileSnapshot(fixtureBook, fixtureSources, [chapter]);
        const query = createQueryService(dataset);
        expect(query({command: "get", id: "c01:identity"}).items[0]).toMatchObject({record: {availableAt: {chapter: 1, paragraph: 2}}});
        expect(() => query({command: "get", id: "c01:identity", at: {chapter: 1, paragraph: 1}})).toThrow();
        chapter.integration.identities[0]!.at = 1;
        expect(() => compileSnapshot(fixtureBook, fixtureSources, [chapter])).toThrow(/available only at 1:2/);
    });

    it("merges integration referent additions without changing the material audit input", () => {
        const chapter = fixtureChapter();
        const added = chapter.material.referents.pop()!;
        chapter.integration.referentAdditions.push(added);
        chapter.review.judgments = reviewUnits(chapter.material, chapter.integration).map(id => ({id, verdict: "passed", note: "Fixture independent review"}));
        const before = JSON.stringify(chapter.material);
        const dataset = compileSnapshot(fixtureBook, fixtureSources, [chapter]);
        expect(dataset.nodes.some(node => node.id === `c01:${added.id}` && node.kind === "referent")).toBe(true);
        expect(JSON.stringify(chapter.material)).toBe(before);
        chapter.review.judgments = [];
        expect(() => compileSnapshot(fixtureBook, fixtureSources, [chapter], "candidate-validation")).not.toThrow();
        expect(() => compileSnapshot(fixtureBook, fixtureSources, [chapter])).toThrow();
    });

    it("reports all material problems with record IDs and paragraph boundaries", () => {
        const material = fixtureChapter().material;
        material.disclosures[0]!.about = ["missing"];
        material.referents[0]!.mentions[0]!.paragraph = 2;
        material.beats[0]!.to = 1;
        try {validateMaterial(material, fixtureSources[0]!); throw new Error("Expected invalid material");}
        catch (error) {
            expect(String(error)).toMatch(/missing/);
            expect(String(error)).toMatch(/first mentioned at 2/);
        }
    });

    it("accepts Beat identity evidence and explicit knowledge of an Episode", () => {
        const chapter = fixtureChapter();
        chapter.integration.identities[0]!.at = 2;
        chapter.integration.identities[0]!.evidence = ["beat"];
        chapter.integration.access.push({id: "witness", at: 2, holder: "person", target: "event", mode: "known", evidence: ["beat"]});
        chapter.review.judgments = reviewUnits(chapter.material, chapter.integration).map(id => ({id, verdict: "passed", note: "Fixture independent review"}));
        const query = createQueryService(compileSnapshot(fixtureBook, fixtureSources, [chapter]));
        expect(query({command: "knowledge", holder: "c01:person", about: "c01:event"}).items).toHaveLength(1);
        expect(query({command: "get", id: "c01:identity"}).items).toHaveLength(1);
    });

    it("accepts an Episode based on knowledge access and rejects circular event access", () => {
        const chapter = fixtureChapter();
        chapter.integration.access.push({id: "heard", at: 2, holder: "person", target: "claim", mode: "heard", evidence: ["dclaim"]});
        chapter.integration.episodes[0]!.materials = ["heard"];
        chapter.integration.episodes[0]!.proof.premises = ["heard"];
        chapter.review.judgments = reviewUnits(chapter.material, chapter.integration).map(id => ({id, verdict: "passed", note: "Fixture independent review"}));
        expect(() => compileSnapshot(fixtureBook, fixtureSources, [chapter])).not.toThrow();
        chapter.integration.access[0]!.target = "event";
        expect(() => compileSnapshot(fixtureBook, fixtureSources, [chapter])).toThrow(/Semantic dependencies unresolved or cyclic/);
    });

    it("reports independent invalid integration references together without editing the candidate", () => {
        const chapter = fixtureChapter();
        chapter.integration.identities[0]!.evidence = ["dclaim"];
        chapter.integration.facts[0]!.proof.premises = ["absent"];
        const before = JSON.stringify(chapter);
        try {compileSnapshot(fixtureBook, fixtureSources, [chapter]); throw new Error("Expected invalid references");}
        catch (error) {
            expect(String(error)).toContain("identity.identity/evidence at 1:1 references dclaim, available only at 1:2");
            expect(String(error)).toContain("claim.fact dependencies: reference absent is missing");
        }
        expect(JSON.stringify(chapter)).toBe(before);
    });

    it("identifies missing assertion-holder identity even when the holder is not an argument", () => {
        const chapter = fixtureChapter();
        chapter.integration.predicates[0]!.roles = [{name: "content", valueKinds: ["text"]}];
        chapter.integration.facts[0]!.arguments = [{role: "content", value: {type: "text", text: "城里有塔"}}];
        chapter.integration.facts[0]!.identities = [];
        expect(() => compileSnapshot(fixtureBook, fixtureSources, [chapter])).toThrow('claim.identities lacks explicit identity for assertion.holder=person');
        chapter.integration.facts[0]!.identities = ["identity"];
        expect(() => compileSnapshot(fixtureBook, fixtureSources, [chapter])).not.toThrow();
        chapter.integration.facts[0]!.assertion.holder = "rperson";
        expect(() => compileSnapshot(fixtureBook, fixtureSources, [chapter])).toThrow("claim.assertion.holder=rperson must be a persistent entity ID");
    });

    it("builds Fact and Argument references to a same-chapter Episode by dependency order", () => {
        const chapter = fixtureChapter();
        chapter.integration.predicates.push({id: "participates", name: "参与", definition: "人物参与事件", symmetric: false, family: "event", roles: [{name: "person", valueKinds: ["entity"]}, {name: "event", valueKinds: ["episode"]}]});
        chapter.integration.facts.push({...chapter.integration.facts[0]!, id: "participation", predicate: "participates", arguments: [{role: "person", value: {type: "ref", id: "person"}}, {role: "event", value: {type: "ref", id: "event"}}], assertion: {kind: "world", holder: null, opaque: false}});
        chapter.integration.arguments.push({id: "event_support", at: 2, target: "event", polarity: "supports", proof: {premises: ["dclaim"], method: "direct", certainty: "accepted", rationale: "Independent source corroborates the event"}});
        chapter.review.judgments = reviewUnits(chapter.material, chapter.integration).map(id => ({id, verdict: "passed", note: "Fixture independent review"}));
        const dataset = compileSnapshot(fixtureBook, fixtureSources, [chapter]);
        expect(dataset.nodes.some(node => node.id === "c01:participation")).toBe(true);
        expect(dataset.nodes.some(node => node.id === "c01:event_support")).toBe(true);
        chapter.integration.episodes[0]!.materials = ["participation"];
        expect(() => compileSnapshot(fixtureBook, fixtureSources, [chapter])).toThrow(/Semantic dependencies unresolved or cyclic/);
    });
});
