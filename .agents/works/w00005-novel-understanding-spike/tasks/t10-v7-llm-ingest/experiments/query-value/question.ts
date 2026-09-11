import {z} from "zod";
import {parseRequest, requestSchema, type QueryRequest, type QueryResponse} from "../../../t09-v7-query-cli/index.ts";

export const answerSchema = z.strictObject({
    text: z.string().min(1), status: z.enum(["answered", "partial", "not-found", "undetermined"]),
    recordIds: z.array(z.string()), sources: z.array(z.strictObject({chapter: z.number().int().positive(), paragraph: z.number().int().positive()})),
});
export const actionSchema = z.discriminatedUnion("action", [
    z.strictObject({action: z.literal("query"), requests: z.array(z.unknown()).min(1).max(3)}),
    z.strictObject({action: z.literal("answer"), answer: answerSchema}),
]);
export type QuestionInput = {id: string; question: string; readAt: {chapter: number; paragraph: number}};
export type EvaluationMode = "graph" | "graph-source" | "source";

export function advertisedActionSchema(mode: EvaluationMode) {
    const requests = requestSchema.options
        .filter(option => mode === "graph-source" || (option.shape.command.value === "source") === (mode === "source"))
        .map(option => {
            const object: z.ZodObject = option;
            return "limit" in object.shape ? object.safeExtend({limit: z.number().int().min(1).max(10).default(10)}) : object;
        });
    return z.union([
        z.strictObject({action: z.literal("query"), requests: z.array(z.union(requests)).min(1).max(3)}),
        z.strictObject({action: z.literal("answer"), answer: answerSchema}),
    ]);
}

type Turn = {requests: unknown[]; results: unknown[]};
export interface QuestionState {question: QuestionInput; mode: EvaluationMode; remainingQueries: number; answerRequired: boolean; history: Turn[]}

/** The evaluation owner fixes scope; a query model cannot widen it or enable another tool mode. */
export function scopedQuery(request: unknown, question: QuestionInput, mode: EvaluationMode): QueryRequest {
    const parsed = parseRequest(request);
    // The study's smaller page default must match its advertised schema, while the public CLI keeps its own default.
    if (request && typeof request === "object" && !("limit" in request) && "limit" in parsed) parsed.limit = 10;
    if (parsed.at && (parsed.at.chapter !== question.readAt.chapter || parsed.at.paragraph !== undefined && parsed.at.paragraph !== question.readAt.paragraph)) throw new Error("Evaluation readAt is fixed");
    if (parsed.perspective !== "reader" || parsed.world !== "original") throw new Error("Evaluation perspective is fixed");
    if (mode === "graph" && parsed.command === "source") throw new Error("Graph-only mode cannot read source");
    if (mode === "source" && parsed.command !== "source") throw new Error("Source-only mode cannot read graph");
    if ("limit" in parsed && parsed.limit > 10) throw new Error("Use at most 10 results per query and paginate if needed");
    return {...parsed, at: question.readAt};
}

export async function answerQuestion(options: {
    question: QuestionInput; mode: EvaluationMode;
    ask: (state: QuestionState) => Promise<unknown>;
    query: (request: QueryRequest) => QueryResponse;
}): Promise<{answer: z.infer<typeof answerSchema>; history: Turn[]; queries: number; sourceQueries: number; exhausted: boolean}> {
    const history: Turn[] = [];
    let queries = 0, sourceQueries = 0, characters = 0;
    for (let turn = 0; turn < 4; turn++) {
        const answerRequired = turn === 3 || queries >= 6;
        const action = actionSchema.parse(await options.ask({question: options.question, mode: options.mode, remainingQueries: 6 - queries, answerRequired, history}));
        if (action.action === "answer") return {answer: action.answer, history, queries, sourceQueries, exhausted: answerRequired};
        if (answerRequired) throw new Error("Query model ignored final answer requirement");
        if (queries + action.requests.length > 6) throw new Error("Query model exceeded its fixed query budget");
        const results: unknown[] = [];
        for (const request of action.requests) {
            queries++;
            try {
                const scoped = scopedQuery(request, options.question, options.mode);
                if (scoped.command === "source") sourceQueries++;
                const result = options.query(scoped);
                const size = JSON.stringify(result).length;
                if (characters + size > 100000) throw new Error("Evaluation result budget exceeded; narrow the query or reduce limit");
                characters += size;
                results.push(result);
            } catch (error) {
                results.push({ok: false, error: error instanceof Error ? error.message : "Query failed"});
            }
        }
        history.push({requests: action.requests, results});
    }
    throw new Error("Query answer was not produced");
}
