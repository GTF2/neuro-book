import { z } from "zod";
import { entityCategorySchema } from "./schema.ts";

const text = z.string().min(1);
const coordinate = z.tuple([z.number().int().positive(), z.number().int().positive()]);
const literal = z.union([text, z.strictObject({ text }), z.strictObject({ number: z.number(), unit: text.nullable() })]);
const fact = z.strictObject({
    id: text, text: text.optional(), predicate: text, args: z.record(text, literal),
    scope: z.enum(["world", "belief", "speech", "rule", "paratext"]), holder: text.optional(),
    status: z.enum(["accepted", "tentative"]), note: z.string(), time: text.optional(),
});
export const annotationsSchema = z.object({
    entities: z.array(z.strictObject({ id: text, label: text, category: entityCategorySchema, at: coordinate, labelAt: coordinate.optional(), description: text, mentions: z.array(z.strictObject({ at: coordinate, text })).min(1) })),
    beats: z.array(z.strictObject({ id: text, chapter: z.number().int().positive(), from: z.number().int().positive(), to: z.number().int().positive(), label: text, mode: z.enum(["paratext", "narrative", "description", "exposition", "reflection"]), entities: z.array(text) })),
    claims: z.array(z.strictObject({ id: text, at: z.tuple([z.number().int().positive(), z.number().int().positive(), z.number().int().positive()]), text, channel: z.enum(["narrator", "thought", "speech", "document", "voice", "author"]), holder: text.nullable(), mode: z.enum(["assertion", "question", "request", "conjecture", "promise", "plan", "denial", "condition"]), about: z.array(text), mentionedTime: text.optional(), fact: fact.nullable() })),
    inferences: z.array(fact.extend({ text, premises: z.array(text).min(1) })),
    episodes: z.array(z.strictObject({ id: text, label: text, beats: z.array(text).min(1), entities: z.array(text), summary: text })),
    summaries: z.array(z.strictObject({ id: text, entity: text, through: coordinate, facet: text, items: z.array(z.strictObject({ text, refs: z.array(text).min(1) })).min(1) })),
    cases: z.array(z.strictObject({ id: text, question: text, through: coordinate, expectedRefs: z.array(text), forbiddenRefs: z.array(text), note: text })),
    times: z.array(z.strictObject({ id: text, label: text, at: coordinate, before: z.array(text), after: z.array(text).optional() })).optional(),
    access: z.array(z.strictObject({ target: text, holder: text, at: coordinate, premises: z.array(text).min(1), mode: z.enum(["heard", "read", "believed", "known", "unaware"]) })).optional(),
});
export type Annotations = z.infer<typeof annotationsSchema>;
