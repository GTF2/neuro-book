import { z } from "zod";

const text = z.string().min(1);
const positive = z.number().int().positive();
export const refSchema = z.strictObject({ id: text, revision: positive });
export const positionSchema = z.strictObject({ chapter: positive, paragraph: positive });
export const scopeSchema = z.strictObject({ world: text, perspective: text });
export const spanSchema = z.strictObject({
    sourceId: text, sourceRevision: positive, paragraph: positive,
    start: z.number().int().nonnegative(), end: z.number().int().nonnegative(),
});
export const readinessSchema = z.enum(["ready", "stale", "pending"]);
export const entityCategorySchema = z.enum(["person", "body", "organization", "place", "object", "class", "concept", "unknown", "artifact", "world", "agreement", "role", "kind", "unresolved", "task", "resource-kind"]);
export const epistemicSchema = z.enum(["accepted", "tentative", "disputed", "unsupported"]);
const refs = z.array(refSchema);
const spans = z.array(spanSchema);
export const valueSchema = z.discriminatedUnion("type", [
    z.strictObject({ type: z.literal("ref"), ref: refSchema }),
    z.strictObject({ type: z.literal("text"), text }),
    z.strictObject({ type: z.literal("number"), number: z.number().finite(), unit: text.nullable() }),
    z.strictObject({ type: z.literal("unknown"), reason: text }),
    z.strictObject({ type: z.literal("none"), meaning: text }),
    z.strictObject({ type: z.literal("variable"), name: text }),
]);
const roleValue = z.strictObject({ role: text, value: valueSchema, anchor: spanSchema.nullable() });
const storyTime = z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("unspecified") }),
    z.strictObject({ kind: z.literal("point"), point: refSchema }),
    z.strictObject({ kind: z.literal("interval"), start: refSchema.nullable(), end: refSchema.nullable(), bounds: z.enum(["observed", "explicit", "inferred"]) }),
]);
const qualification = z.strictObject({
    quantifier: z.enum(["particular", "all", "some", "usually", "unknown"]),
    conditions: refs, textualConditions: z.array(text), exceptions: refs,
    modality: z.enum(["actual", "possible", "necessary", "permitted", "obligatory", "intended", "conditional"]),
});
const summaryItem = z.strictObject({ id: text, text, dependencies: refs.min(1), readiness: readinessSchema, assessmentBasis: z.array(z.strictObject({ target: refSchema, epistemic: epistemicSchema })) });
const coverage = z.strictObject({
    through: positionSchema, chapters: z.array(positive),
    material: z.enum(["complete", "partial"]), semantic: z.enum(["reviewed-selection", "partial"]),
    gaps: z.array(text), recordsExhausted: z.boolean(), corpusClosed: z.boolean(),
});
const envelope = {
    id: text, revision: positive, label: text, availableAt: positionSchema,
    scope: scopeSchema, spans, dependencies: refs, readiness: readinessSchema,
};
function node<K extends string, S extends z.ZodType>(kind: K, data: S) {
    return z.strictObject({ ...envelope, kind: z.literal(kind), data });
}

export const nodeSchema = z.discriminatedUnion("kind", [
    node("entity", z.strictObject({ category: entityCategorySchema, identityNote: text, names: z.array(z.strictObject({ text, availableAt: positionSchema, dependencies: refs.min(1) })) })),
    node("referent", z.strictObject({ localName: text, mentions: refs, splitFrom: refSchema.nullable() })),
    node("mention", z.strictObject({ referent: refSchema, text, span: spanSchema })),
    node("resolution", z.strictObject({ referent: refSchema, entity: refSchema, decision: z.enum(["same", "candidate", "unresolved"]), replaces: refs })),
    node("predicate", z.strictObject({ name: text, definition: text, roles: z.array(z.strictObject({ name: text, valueKinds: z.array(z.enum(["entity", "referent", "fact", "episode", "text", "number", "unknown", "none", "variable"])) })).min(1), symmetric: z.boolean(), family: text })),
    node("disclosure", z.strictObject({
        text, channel: z.enum(["narrator", "thought", "speech", "document", "voice", "author", "in-world-system"]),
        mode: z.enum(["assertion", "question", "request", "conjecture", "promise", "plan", "denial", "condition"]),
        attribution: z.array(z.strictObject({ channel: text, holder: refSchema.nullable() })),
        referents: refs, mentionedTime: storyTime,
    })),
    node("beat", z.strictObject({
        gist: text, chapterId: text, fromParagraph: positive, toParagraph: positive,
        mode: z.enum(["paratext", "narrative", "description", "exposition", "reflection"]), referents: refs, disclosures: refs,
    })),
    node("fact", z.strictObject({
        proposition: text, predicate: refSchema, arguments: z.array(roleValue).min(1),
        polarity: z.enum(["affirmative", "negative"]),
        assertion: z.strictObject({ kind: z.enum(["world", "belief", "speech", "rule", "paratext", "hypothesis", "fiction"]), holder: refSchema.nullable(), opaque: z.boolean() }),
        time: storyTime, qualifiers: qualification, interpretationDependencies: refs,
    })),
    node("episode", z.strictObject({
        summary: text, scale: z.enum(["event", "sequence", "arc"]), participants: z.array(roleValue),
        materials: refs, components: z.array(z.strictObject({ role: z.enum(["title", "participant", "step", "result"]), text, dependencies: refs.min(1) })),
        children: refs, relations: z.array(z.strictObject({ relation: z.enum(["before", "continues", "retells", "motivates", "causes", "enables"]), target: refSchema, dependencies: refs.min(1) })), time: storyTime,
    })),
    node("synthesis", z.strictObject({ topic: text, items: z.array(summaryItem).min(1), children: refs, coverage, interpretation: z.literal(true) })),
    node("entitySummary", z.strictObject({
        subject: refSchema, facet: text, readAt: positionSchema, story: storyTime,
        items: z.array(summaryItem).min(1), coverage,
        builtFrom: z.strictObject({ sourceManifest: text, knowledgeRevision: positive, partitionWatermarks: z.record(text, z.number().int().nonnegative()) }),
    })),
    node("argument", z.strictObject({
        conclusion: refSchema, polarity: z.enum(["supports", "opposes", "challenges"]),
        method: z.enum(["direct", "identity", "inference", "aggregation", "rule"]),
        premises: z.array(z.strictObject({ ref: refSchema, role: text, required: z.boolean() })).min(1),
        assumptions: z.array(text), rationale: text, sourceRoots: spans,
        applicability: z.enum(["satisfied", "unknown", "impossible"]),
        bindings: z.array(z.strictObject({ variable: text, value: valueSchema })),
        jointScope: scopeSchema, jointTime: storyTime,
        review: z.strictObject({ verdict: z.enum(["passed", "pending", "rejected"]), reviewer: text, note: text }),
        status: z.enum(["usable", "conditional", "challenged", "blocked"]),
    })),
    node("assessment", z.strictObject({ target: refSchema, arguments: refs, epistemic: epistemicSchema, note: text, unresolved: z.array(text), evaluatedAt: positionSchema })),
    node("time", z.strictObject({ description: text, precision: z.enum(["point", "interval", "relative", "unknown"]), constraints: z.array(z.strictObject({ relation: z.enum(["before", "after", "during", "overlap", "equal"]), other: refSchema, dependencies: refs })) })),
    node("watch", z.strictObject({ targets: refs.min(1), partitions: z.array(text).min(1), reason: text, checkedWatermarks: z.record(text, z.number().int().nonnegative()) })),
    node("knowledgeAccess", z.strictObject({ target: refSchema, holder: refSchema, mode: z.enum(["heard", "read", "believed", "known", "unaware"]), establishedAt: storyTime, evidence: refs.min(1) })),
]);

export const sourceSchema = z.strictObject({
    id: text, revision: positive, chapterId: text, chapterOrder: positive, title: text,
    paragraphs: z.array(text).min(1), sha256: z.string().regex(/^[a-f0-9]{64}$/),
});
export const datasetSchema = z.strictObject({
    schema: z.literal("neurobook.memory.v7"),
    book: z.strictObject({ id: text, title: text }),
    snapshot: z.strictObject({ id: text, sourceManifest: text, knowledgeRevision: positive, readAt: positionSchema }),
    sources: z.array(sourceSchema).min(1), nodes: z.array(nodeSchema), coverage,
    partitionWatermarks: z.record(text, z.number().int().nonnegative()),
    invalidationRoots: refs,
});

// Published snapshots contain effective members; mutation history is a separate contract.
export const managementSchema = z.strictObject({
    schema: z.literal("neurobook.memory.management.v7"),
    manifests: z.array(z.strictObject({ id: text, bookId: text, sources: refs, parent: text.nullable(), head: positive })),
    memberships: z.array(z.strictObject({ sourceManifest: text, knowledgeRevision: positive, record: refSchema, lifecycle: z.enum(["active", "superseded", "retracted"]), reason: text })),
    changes: z.array(z.strictObject({
        id: text, operationKey: text, sourceManifest: text, baseKnowledgeRevision: positive,
        executionGeneration: positive, readSet: refs, creates: z.array(nodeSchema),
        supersedes: z.array(z.strictObject({ old: refSchema, replacement: refSchema.nullable(), reason: text })),
        invalidationRoots: refs, partitionWatermarks: z.record(text, z.number().int().nonnegative()),
        validation: z.enum(["pending", "passed", "rejected"]), status: z.enum(["candidate", "committed", "conflict", "cancelled"]),
        committedKnowledgeRevision: positive.nullable(),
    })),
    operations: z.array(z.strictObject({ id: text, operationKey: text, executionGeneration: positive, stage: z.enum(["ingest", "integrate", "dream", "repair"]), status: z.enum(["queued", "running", "cancelled", "committed", "failed", "unknown-provider-outcome"]), cursor: text.nullable(), callBudget: z.number().int().nonnegative(), callsUsed: z.number().int().nonnegative(), outputChangeSet: text.nullable() })),
});

export type MemoryDataset = z.infer<typeof datasetSchema>;
export type MemoryNode = z.infer<typeof nodeSchema>;
export type NodeKind = MemoryNode["kind"];
export type RecordRef = z.infer<typeof refSchema>;
export type Position = z.infer<typeof positionSchema>;
export type Span = z.infer<typeof spanSchema>;
export type Source = z.infer<typeof sourceSchema>;
export type Epistemic = z.infer<typeof epistemicSchema>;
export type NodeOf<K extends NodeKind> = Extract<MemoryNode, { kind: K }>;
