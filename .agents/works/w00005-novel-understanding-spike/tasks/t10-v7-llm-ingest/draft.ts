import {z} from "zod";
import {entityCategorySchema, nodeSchema, type MemoryNode, type Source} from "../t07-v7-schema-gold/index.ts";

const text = z.string().min(1);
const id = z.string().regex(/^[A-Za-z][A-Za-z0-9_-]*$/);
const ref = z.string().regex(/^(?:[A-Za-z][A-Za-z0-9_-]*|known:[A-Za-z0-9:_-]+)$/);
const paragraph = z.number().int().positive();
const certainty = z.enum(["accepted", "tentative"]);
type SchemaFor<K extends MemoryNode["kind"]> = Extract<(typeof nodeSchema.options)[number], {shape: {kind: z.ZodLiteral<K>}}>;
function dataFor<K extends MemoryNode["kind"]>(kind: K): SchemaFor<K>["shape"]["data"] {
    const schema = nodeSchema.options.find(option => option.shape.kind.value === kind);
    if (!schema) throw new Error(`Unknown schema ${kind}`);
    return schema.shape.data as SchemaFor<K>["shape"]["data"];
}
const disclosure = dataFor("disclosure"), fact = dataFor("fact"), argument = dataFor("argument"), episode = dataFor("episode");
const proof = z.strictObject({premises: z.array(ref).min(1), method: argument.shape.method, certainty, rationale: text});
const value = z.discriminatedUnion("type", [
    z.strictObject({type: z.literal("ref"), id: ref}),
    z.strictObject({type: z.literal("text"), text}),
    z.strictObject({type: z.literal("number"), number: z.number().finite(), unit: text.nullable()}),
    z.strictObject({type: z.literal("unknown"), reason: text}),
    z.strictObject({type: z.literal("none"), meaning: text}),
    z.strictObject({type: z.literal("variable"), name: text}),
]);

const referentDraft = z.strictObject({id, mentions: z.array(z.strictObject({paragraph, text, occurrence: z.number().int().nonnegative(), name: z.boolean()})).min(1)});
export const materialSchema = z.strictObject({
    referents: z.array(referentDraft),
    disclosures: z.array(z.strictObject({id, from: paragraph, to: paragraph, text, channel: disclosure.shape.channel, mode: disclosure.shape.mode, holder: ref.nullable(), about: z.array(ref)})),
    beats: z.array(z.strictObject({id, from: paragraph, to: paragraph, gist: text, mode: dataFor("beat").shape.mode, about: z.array(ref)})).min(1),
});

export const integrationSchema = z.strictObject({
    referentAdditions: z.array(referentDraft),
    entities: z.array(z.strictObject({id, category: entityCategorySchema})),
    identities: z.array(z.strictObject({id, at: paragraph, referent: ref, entity: ref, decision: dataFor("resolution").shape.decision, certainty, rationale: text, evidence: z.array(ref).min(1)})),
    predicates: z.array(z.strictObject({id, ...dataFor("predicate").shape})),
    times: z.array(z.strictObject({id, at: paragraph, description: text, precision: dataFor("time").shape.precision, before: z.array(ref), after: z.array(ref)})),
    facts: z.array(z.strictObject({
        id, at: paragraph, text, predicate: ref, arguments: z.array(z.strictObject({role: text, value})).min(1),
        polarity: fact.shape.polarity, assertion: z.strictObject({kind: fact.shape.assertion.shape.kind, holder: ref.nullable().describe("Persistent entity ID, never a local referent ID or identity/Resolution ID. Also include this entity's Resolution in facts.identities."), opaque: z.boolean()}),
        time: ref.nullable(), quantifier: fact.shape.qualifiers.shape.quantifier, modality: fact.shape.qualifiers.shape.modality,
        conditions: z.array(ref), textualConditions: z.array(text), exceptions: z.array(ref), identities: z.array(ref).describe("Explicit Resolution IDs for every entity argument AND assertion.holder, even when the holder is not an argument."), proof,
    })),
    arguments: z.array(z.strictObject({id, at: paragraph, target: ref, polarity: argument.shape.polarity, proof})),
    access: z.array(z.strictObject({id, at: paragraph, holder: ref.describe("Persistent entity ID, never a local referent or Resolution ID."), target: ref, mode: dataFor("knowledgeAccess").shape.mode, evidence: z.array(ref).min(1)})),
    episodes: z.array(z.strictObject({
        id, at: paragraph, title: text, summary: text, scale: episode.shape.scale, participants: z.array(ref), materials: z.array(ref).min(1),
        children: z.array(ref), relations: z.array(z.strictObject({relation: episode.shape.relations.element.shape.relation, target: ref, evidence: z.array(ref).min(1)})), time: ref.nullable(), proof,
    })),
    summaries: z.array(z.strictObject({id, entity: ref, facet: text, items: z.array(z.strictObject({text, refs: z.array(ref).min(1)})).min(1)})),
    gaps: z.array(text),
});

export const reviewSchema = z.strictObject({
    judgments: z.array(z.strictObject({id: text, verdict: z.enum(["passed", "rejected"]), note: text})),
    missing: z.array(z.strictObject({
        stage: z.enum(["material", "integration"]).describe("The layer that must change: material for missing/incorrect A content or uncertain ownership, integration when A is sufficient and only B is incomplete."),
        note: text.describe("Concrete source-supported omission, never a statement that an item is already modeled or not missing."),
    })),
});

export type MaterialDraft = z.infer<typeof materialSchema>;
export type IntegrationDraft = z.infer<typeof integrationSchema>;
export type ReviewDraft = z.infer<typeof reviewSchema>;
export type Proof = z.infer<typeof proof>;
export interface AcceptedChapter {chapter: number; material: MaterialDraft; integration: IntegrationDraft; review: ReviewDraft}

export function combinedMaterial(material: MaterialDraft, integration: IntegrationDraft): MaterialDraft {
    return {...material, referents: [...material.referents, ...integration.referentAdditions]};
}

export function validateMaterial(material: MaterialDraft, source: Source): void {
    const errors: string[] = [];
    const ids = new Set(material.referents.map(item => item.id));
    const firstMentions = new Map(material.referents.map(item => [item.id, Math.min(...item.mentions.map(mention => mention.paragraph))]));
    const allIds = [...material.referents, ...material.disclosures, ...material.beats].map(item => item.id);
    const duplicateIds = [...new Set(allIds.filter((id, index) => allIds.indexOf(id) !== index))];
    if (duplicateIds.length) errors.push(`Material IDs must be unique; duplicates: ${duplicateIds.join(", ")}`);
    function validateRefs(item: {id: string; to: number}, references: string[]): void {
        for (const id of references) {
            if (!ids.has(id)) errors.push(`${item.id} references ${id}; only current local referents are allowed`);
            else if (firstMentions.get(id)! > item.to) errors.push(`${item.id} ends at paragraph ${item.to} but references ${id}, first mentioned at ${firstMentions.get(id)}; adjust evidence range/Beat boundaries or remove unsupported attribution`);
        }
    }
    for (const item of material.disclosures) {
        if (item.from < 1 || item.to < item.from || item.to > source.paragraphs.length) errors.push(`Disclosure ${item.id} range ${item.from}..${item.to} outside 1..${source.paragraphs.length}`);
        validateRefs(item, [...item.about, ...(item.holder ? [item.holder] : [])]);
    }
    let next = 1;
    for (const beat of material.beats) {
        if (beat.from !== next || beat.to < beat.from || beat.to > source.paragraphs.length) errors.push(`Beat ${beat.id} range ${beat.from}..${beat.to}; expected from ${next}, chapter ends ${source.paragraphs.length}`);
        validateRefs(beat, beat.about);
        next = beat.to + 1;
    }
    if (next !== source.paragraphs.length + 1) errors.push("Incomplete Beat coverage");
    for (const referent of material.referents) for (const mention of referent.mentions) {
        const text = source.paragraphs[mention.paragraph - 1];
        if (!text) {errors.push(`Mention ${referent.id} paragraph ${mention.paragraph} is absent`); continue;}
        let at = -1;
        for (let occurrence = 0; occurrence <= mention.occurrence; occurrence++) {
            at = text.indexOf(mention.text, at + 1);
            if (at < 0) {errors.push(`Mention ${referent.id} text ${JSON.stringify(mention.text)} occurrence ${mention.occurrence} absent at paragraph ${mention.paragraph}`); break;}
        }
    }
    if (errors.length) throw new Error(`Material validation failed:\n${errors.join("\n")}`);
}

export function reviewUnits(material: MaterialDraft, integration: IntegrationDraft): string[] {
    return [
        ...material.referents.map(item => `material:${item.id}`), ...material.disclosures.map(item => `material:${item.id}`), ...material.beats.map(item => `material:${item.id}`),
        ...integration.referentAdditions.map(item => `semantic:${item.id}`), ...integration.entities.map(item => `semantic:${item.id}`), ...integration.identities.map(item => `semantic:${item.id}`), ...integration.predicates.map(item => `semantic:${item.id}`),
        ...integration.times.map(item => `semantic:${item.id}`), ...integration.facts.map(item => `semantic:${item.id}`), ...integration.arguments.map(item => `semantic:${item.id}`),
        ...integration.access.map(item => `semantic:${item.id}`), ...integration.episodes.map(item => `semantic:${item.id}`), ...integration.summaries.map(item => `semantic:${item.id}`),
    ];
}

export function validateReviewCoverage(material: MaterialDraft, integration: IntegrationDraft, review: ReviewDraft): void {
    const units = reviewUnits(material, integration);
    if (new Set(units).size !== units.length) throw new Error("Duplicate semantic/material unit IDs");
    if (new Set(review.judgments.map(item => item.id)).size !== review.judgments.length) throw new Error("Duplicate review judgment");
    const expected = new Set(units), received = new Set(review.judgments.map(item => item.id));
    const missing = units.filter(unit => !received.has(unit)), extra = [...received].filter(unit => !expected.has(unit));
    if (missing.length || extra.length) throw new Error(`Review must cover exactly all requested units: ${JSON.stringify({missing, extra})}`);
}

export function validateReview(material: MaterialDraft, integration: IntegrationDraft, review: ReviewDraft): void {
    validateReviewCoverage(material, integration, review);
    const rejected = review.judgments.filter(item => item.verdict !== "passed");
    if (rejected.length || review.missing.length) throw new Error(`Semantic review rejected: ${JSON.stringify({rejected, missing: review.missing})}`);
}
