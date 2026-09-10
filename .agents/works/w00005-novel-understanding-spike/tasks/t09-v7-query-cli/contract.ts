import {z} from "zod";
import {entityCategorySchema, epistemicSchema, nodeSchema, type MemoryDataset, type MemoryNode, type NodeOf, type QueryScope, type RecordRef, type Span} from "../t07-v7-schema-gold/index.ts";

const text = z.string().trim().min(1);
const common = {
    at: z.strictObject({chapter: z.number().int().positive(), paragraph: z.number().int().positive().optional()}).optional(),
    perspective: text.default("reader"),
    world: text.default("original"),
};
const page = {limit: z.number().int().min(1).max(100).default(20), cursor: text.optional()};
function schemaFor<K extends MemoryNode["kind"]>(kind: K) {
    const schema = nodeSchema.options.find(option => option.shape.kind.value === kind);
    if (!schema) throw new Error(`Missing V7 node schema: ${kind}`);
    return schema as Extract<(typeof nodeSchema.options)[number], {shape: {kind: z.ZodLiteral<K>}}>;
}
const factData = schemaFor("fact").shape.data;
const knowledgeData = schemaFor("knowledgeAccess").shape.data;
const kind = z.enum(nodeSchema.options.map(option => option.shape.kind.value));

export const requestSchema = z.discriminatedUnion("command", [
    z.strictObject({command: z.literal("info"), ...common}),
    z.strictObject({command: z.literal("entities"), ...common, ...page, query: text.optional(), category: entityCategorySchema.optional()}),
    z.strictObject({command: z.literal("search"), ...common, ...page, query: text.optional(), kind: kind.optional()}).refine(request => request.query !== undefined || request.kind !== undefined, {message: "search requires query or kind"}),
    z.strictObject({command: z.literal("facts"), ...common, ...page, entity: text.optional(), target: text.optional(), predicate: text.optional(), assertion: factData.shape.assertion.shape.kind.optional(), epistemic: epistemicSchema.optional(), query: text.optional()}),
    z.strictObject({command: z.literal("knowledge"), ...common, ...page, holder: text, about: text.optional(), mode: knowledgeData.shape.mode.optional()}),
    z.strictObject({command: z.literal("summaries"), ...common, ...page, entity: text, facet: text.optional()}),
    z.strictObject({command: z.literal("get"), ...common, id: text}),
    z.strictObject({command: z.literal("explain"), ...common, ...page, id: text, depth: z.number().int().min(0).max(8).default(2)}),
    z.strictObject({command: z.literal("source"), ...common, ...page, chapter: z.number().int().positive(), from: z.number().int().positive().optional(), to: z.number().int().positive().optional(), query: text.optional()}),
]);

export type QueryRequest = z.input<typeof requestSchema>;
export type ParsedRequest = z.output<typeof requestSchema>;
export const responseSchemaVersion = "neurobook.memory.query.v1";

export class QueryError extends Error {
    constructor(public readonly code: string, message: string, public readonly exitCode: 1 | 2 | 3 | 4) {
        super(message);
        this.name = "QueryError";
    }
}

export function parseRequest(input: unknown): ParsedRequest {
    const parsed = requestSchema.safeParse(input);
    if (!parsed.success) {
        const issue = parsed.error.issues[0]!;
        throw new QueryError("INVALID_ARGUMENT", `Invalid request ${issue.path.join(".") || "fields"}: ${issue.message}`, 2);
    }
    return parsed.data;
}

export interface Handle extends RecordRef {status: "visible" | "unavailable"}
export interface Excerpt {span: Span; chapter: number; text: string}
export interface EvidenceLink {source: string; target: Handle; relation: "assessment" | "argument" | "dependency" | "reference"}
export interface RecordItem {
    type: "record";
    record: MemoryNode;
    assessment: NodeOf<"assessment"> | null;
    assessmentStatus: "visible" | "not-in-scope-or-not-applicable";
    provenance: {references: Handle[]; dependencies: Handle[]; arguments: Handle[]; excerpts: Excerpt[]};
    target?: RecordItem | Handle;
    nameMatches?: Array<{text: string; match: "exact" | "prefix" | "substring"}>;
    depth?: number;
    links?: EvidenceLink[];
    boundary?: EvidenceLink[];
}
export interface SourceItem {type: "source"; sourceId: string; revision: number; chapter: number; paragraph: number; text: string}
export interface InfoItem {
    type: "info";
    book: MemoryDataset["book"];
    counts: Partial<Record<MemoryNode["kind"], number>>;
    chapters: Array<{chapter: number; visibleParagraphs: number}>;
    capabilities: string[];
    limitations: string[];
}
export interface QueryResponse {
    schema: typeof responseSchemaVersion;
    ok: true;
    command: ParsedRequest["command"];
    snapshot: MemoryDataset["snapshot"] & {contentHash: string};
    scope: QueryScope;
    items: Array<RecordItem | SourceItem | InfoItem>;
    coverage: MemoryDataset["coverage"];
    completeness: {recordsExhausted: boolean; corpusClosed: false; matchingRecords: number; returned: number; summaryStatus?: "ready" | "missing-or-stale"};
    truncation: {page: boolean; depth: boolean; unavailableReferences: number};
    nextCursor: string | null;
}

export function errorResponse(error: unknown) {
    const failure = error instanceof QueryError ? error : new QueryError("INTERNAL_ERROR", "Unexpected query failure", 1);
    return {exitCode: failure.exitCode, body: {schema: responseSchemaVersion, ok: false, error: {code: failure.code, message: failure.message}}};
}
