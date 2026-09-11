import type {Source} from "../t07-v7-schema-gold/index.ts";
import {hash} from "./compiler.ts";
import {reviewUnits, type AcceptedChapter, type IntegrationDraft, type MaterialDraft} from "./draft.ts";

export const fixtureBook = {id: "fixture-book", title: "Fixture"};
export const fixtureSources: Source[] = [
    {id: "src1", revision: 1, chapterId: "ch1", chapterOrder: 1, title: "One", paragraphs: ["小林来到城门。", "小林说：城里有一座塔。"], sha256: hash("小林来到城门。\n小林说：城里有一座塔。")},
    {id: "src2", revision: 1, chapterId: "ch2", chapterOrder: 2, title: "Two", paragraphs: ["小林说：我叫林青。", "林青走进城门。"], sha256: hash("小林说：我叫林青。\n林青走进城门。")},
];

export function fixtureChapter(chapter = 1): AcceptedChapter {
    const material: MaterialDraft = {
        referents: [{id: "rperson", mentions: chapter === 1 ? [{paragraph: 1, text: "小林", occurrence: 0, name: true}] : [{paragraph: 1, text: "小林", occurrence: 0, name: true}, {paragraph: 1, text: "林青", occurrence: 0, name: true}]}],
        disclosures: [{id: "dclaim", from: 2, to: 2, text: chapter === 1 ? "小林说城里有塔。" : "林青走进城门。", channel: chapter === 1 ? "speech" : "narrator", mode: "assertion", holder: chapter === 1 ? "rperson" : null, about: ["rperson"]}],
        beats: [{id: "beat", from: 1, to: 2, gist: "抵达城门并交谈。", mode: "narrative", about: ["rperson"]}],
    };
    const entity = chapter === 1 ? "person" : "known:c01:person";
    const integration: IntegrationDraft = {
        referentAdditions: [],
        entities: chapter === 1 ? [{id: "person", category: "person"}] : [],
        identities: [{id: "identity", at: 1, referent: "rperson", entity, decision: "same", certainty: "accepted", rationale: "文本使用该人物的称呼。", evidence: chapter === 1 ? ["rperson"] : ["rperson", "known:c01:identity"]}],
        predicates: chapter === 1 ? [{id: "predicate", name: "states", definition: "主体表达一句内容", roles: [{name: "speaker", valueKinds: ["entity"]}, {name: "content", valueKinds: ["text"]}], symmetric: false, family: "communication"}] : [],
        times: [],
        facts: chapter === 1 ? [{id: "claim", at: 2, text: "小林声称城里有一座塔。", predicate: "predicate", arguments: [{role: "speaker", value: {type: "ref", id: entity}}, {role: "content", value: {type: "text", text: "城里有一座塔"}}], polarity: "affirmative", assertion: {kind: "speech", holder: entity, opaque: true}, time: null, quantifier: "particular", modality: "actual", conditions: [], textualConditions: [], exceptions: [], identities: ["identity"], proof: {premises: ["dclaim"], method: "direct", certainty: "accepted", rationale: "原文明确发言。"}}] : [],
        arguments: [], access: [],
        episodes: [{id: "event", at: 2, title: "抵达城门", summary: "小林抵达城门。", scale: "event", participants: [entity], materials: ["beat"], children: [], relations: [], time: null, proof: {premises: ["beat"], method: "aggregation", certainty: "accepted", rationale: "依据本章推进。"}}],
        summaries: [{id: "summary", entity, facet: "situation", items: [{text: "抵达城门。", refs: ["event"]}]}], gaps: [],
    };
    return {chapter, material, integration, review: {judgments: reviewUnits(material, integration).map(id => ({id, verdict: "passed", note: "独立核对原文通过。"})), missing: []}};
}
