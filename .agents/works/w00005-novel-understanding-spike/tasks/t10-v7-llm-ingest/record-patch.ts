import {z} from "zod";
import {integrationSchema, materialSchema} from "./draft.ts";

export type RepairStage = "material" | "integration";
export const responseModeSchema = z.enum(["complete", "record-patch"]);
export type ResponseMode = z.infer<typeof responseModeSchema>;
const recordId = z.object({id: z.string().regex(/^[A-Za-z][A-Za-z0-9_-]*$/)}).passthrough();
const records: Record<RepairStage, Record<string, z.ZodType>> = {
    material: {
        referents: materialSchema.shape.referents.element,
        disclosures: materialSchema.shape.disclosures.element,
        beats: materialSchema.shape.beats.element,
    },
    integration: {
        referentAdditions: integrationSchema.shape.referentAdditions.element,
        entities: integrationSchema.shape.entities.element,
        identities: integrationSchema.shape.identities.element,
        predicates: integrationSchema.shape.predicates.element,
        times: integrationSchema.shape.times.element,
        facts: integrationSchema.shape.facts.element,
        arguments: integrationSchema.shape.arguments.element,
        access: integrationSchema.shape.access.element,
        episodes: integrationSchema.shape.episodes.element,
        summaries: integrationSchema.shape.summaries.element,
    },
};

export function patchSchema(stage: RepairStage) {
    return z.strictObject({replacements: z.array(z.strictObject({
        collection: z.enum(Object.keys(records[stage])),
        record: z.record(z.string(), z.unknown()).describe("Complete replacement record, including its unchanged id; follow the supplied candidateContract for this collection."),
    })).min(1)});
}

export function repairResponseSchema(stage: RepairStage) {
    return z.union([patchSchema(stage), z.strictObject({regenerate: z.string().min(1)})]);
}

function addressableCandidate(stage: RepairStage, base: unknown) {
    const candidate = z.record(z.string(), z.unknown()).parse(base);
    const schemas = records[stage];
    const expectedKeys = [...Object.keys(schemas), ...(stage === "integration" ? ["gaps"] : [])];
    if (Object.keys(candidate).length !== expectedKeys.length || expectedKeys.some(key => !Object.hasOwn(candidate, key))) {
        throw new Error("Candidate is not addressable by the expected collections");
    }
    const ids = new Set<string>();
    for (const collection of Object.keys(schemas)) {
        const entries = z.array(recordId).parse(candidate[collection]);
        for (const record of entries) {
            if (ids.has(record.id)) throw new Error(`Ambiguous candidate ID: ${record.id}`);
            ids.add(record.id);
        }
    }
    if (stage === "integration") z.array(z.string()).parse(candidate.gaps);
    return candidate;
}

export function canPatchCandidate(stage: RepairStage, base: unknown): boolean {
    try { addressableCandidate(stage, base); return true; }
    catch { return false; }
}

/** Only applies model-authored replacements; the caller must still validate the entire resulting candidate. */
export function applyRecordPatch(stage: RepairStage, base: unknown, patch: unknown) {
    const candidate = structuredClone(addressableCandidate(stage, base));
    const schemas = records[stage];
    const changed = new Set<string>();
    for (const operation of patchSchema(stage).parse(patch).replacements) {
        const schema = schemas[operation.collection];
        if (!schema) throw new Error("Unknown replacement collection");
        const replacement = recordId.parse(schema.parse(operation.record));
        const key = `${operation.collection}/${replacement.id}`;
        if (changed.has(key)) throw new Error(`Repeated replacement: ${key}`);
        const entries = z.array(recordId).parse(candidate[operation.collection]);
        const index = entries.findIndex(record => record.id === replacement.id);
        if (index < 0) throw new Error(`Replacement cannot create or rename a record: ${key}`);
        entries[index] = replacement;
        candidate[operation.collection] = entries;
        changed.add(key);
    }
    return {candidate, changed: [...changed]};
}
