import {describe, expect, it} from "vitest";
import {scopedQuery, answerQuestion, advertisedActionSchema} from "./experiments/query-value/question.ts";

const question = {id: "q01", question: "此时知道什么？", readAt: {chapter: 1, paragraph: 5}};
describe("evaluation query isolation", () => {
    it("uses the same allowed commands and page default in the model contract and executor", () => {
        const request = {command: "facts", query: "名字"};
        const advertised = advertisedActionSchema("graph").parse({action: "query", requests: [request]});
        expect(advertised).toMatchObject({action: "query", requests: [{command: "facts", limit: 10}]});
        expect(scopedQuery(request, question, "graph")).toMatchObject({limit: 10, at: question.readAt});
        expect(advertisedActionSchema("source").safeParse({action: "query", requests: [request]}).success).toBe(false);
        expect(advertisedActionSchema("graph").safeParse({action: "query", requests: [{command: "source", chapter: 1}]}).success).toBe(false);
        expect(() => scopedQuery({...request, limit: 20}, question, "graph")).toThrow("at most 10");
        expect(advertisedActionSchema("graph").safeParse({action: "query", requests: [{...request, limit: 20}]}).success).toBe(false);
    });
    it("fixes the precise paragraph even if the model omits it", () => {
        expect(scopedQuery({command: "search", query: "名字", limit: 5}, question, "graph").at).toEqual(question.readAt);
        expect(() => scopedQuery({command: "search", query: "名字", limit: 5, at: {chapter: 1, paragraph: 6}}, question, "graph")).toThrow("readAt");
    });
    it("separates graph-only and source-only tools", () => {
        expect(() => scopedQuery({command: "source", chapter: 1, limit: 5}, question, "graph")).toThrow("cannot read source");
        expect(() => scopedQuery({command: "facts", limit: 5}, question, "source")).toThrow("cannot read graph");
    });
    it("charges rejected scope-widening queries against the same budget", async () => {
        let calls = 0;
        const result = await answerQuestion({question, mode: "graph", query: () => {throw new Error("must not reach query service");}, ask: async state => {
            calls++;
            if (state.remainingQueries === 0) return {action: "answer", answer: {text: "未找到", status: "not-found", recordIds: [], sources: []}};
            return {action: "query", requests: Array.from({length: 3}, () => ({command: "source", chapter: 1, limit: 5}))};
        }});
        expect(calls).toBe(3);
        expect(result.queries).toBe(6);
        expect(result.sourceQueries).toBe(0);
        expect(result.history).toHaveLength(2);
        expect(result.exhausted).toBe(true);
    });
    it("returns malformed query arguments as tool feedback instead of losing the question", async () => {
        const result = await answerQuestion({question, mode: "graph", query: () => {throw new Error("must not reach service");}, ask: async state => {
            if (!state.history.length) return {action: "query", requests: [{command: "search", chapter: 1, query: "名字"}]};
            expect(state.history[0]!.results).toEqual([expect.objectContaining({ok: false})]);
            return {action: "answer", answer: {text: "当前未取得证据", status: "not-found", recordIds: [], sources: []}};
        }});
        expect(result.queries).toBe(1);
    });
});
