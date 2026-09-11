import assert from "node:assert/strict";
import {readFile, readdir} from "node:fs/promises";
import {join, resolve} from "node:path";
import {parseArgs} from "node:util";
import {z} from "zod";
import {modelResponseSchema} from "../../runner.ts";
import {summarizeCallCosts, type CostCall} from "../../cost.ts";

const args = parseArgs({options: {root: {type: "string", multiple: true}}});
assert(args.values.root?.length);
const resultSchema = z.object({
    suiteHash: z.string(), mode: z.string(),
    results: z.array(z.object({id: z.string(), group: z.string(), category: z.string(), verdict: z.string(), evidence: z.string(),
        criticalError: z.string().nullable(), queries: z.number(), sourceQueries: z.number()})),
    failures: z.array(z.object({id: z.string(), error: z.string()})),
});
const read = async (path: string): Promise<unknown> => JSON.parse(await readFile(path, "utf8"));
const reports = [];
for (const root_ of args.values.root) {
    const root = resolve(root_), result = resultSchema.parse(await read(join(root, "results.json")));
    let excluded = false;
    try { excluded = z.object({includeInQualityComparison: z.boolean()}).parse(await read(join(root, "exclusion.json"))).includeInQualityComparison === false; }
    catch (error) { if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) throw error; }
    const calls: CostCall[] = [];
    for (const name of (await readdir(root, {recursive: true})).filter(path => /(?:^|[\\/])request\.json$/.test(path)).sort()) {
        const requestPath = join(root, name), request = z.object({startedAt: z.string()}).parse(await read(requestPath));
        let response = null;
        try { response = modelResponseSchema.parse(await read(requestPath.replace(/request\.json$/, "response.json"))); }
        catch (error) { if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) throw error; }
        calls.push({chapter: 1, stage: name.includes("judge") ? "judge" : "query", classification: "development", startedAt: response?.startedAt ?? request.startedAt, response});
    }
    const questionIds = new Set([...result.results.map(item => item.id), ...result.failures.map(item => item.id)]);
    const summarize = (items: typeof result.results) => ({
        scored: items.length,
        verdicts: Object.fromEntries(["correct", "partial", "wrong", "not-found", "undetermined"].map(verdict => [verdict, items.filter(item => item.verdict === verdict).length])),
        correctWithSupportingEvidence: items.filter(item => item.verdict === "correct" && item.evidence === "supported").length,
        criticalErrors: items.filter(item => item.criticalError !== null).length,
        toolQueries: items.reduce((sum, item) => sum + item.queries, 0),
        sourceQueries: items.reduce((sum, item) => sum + item.sourceQueries, 0),
    });
    const queryCost = summarizeCallCosts(calls.filter(call => call.stage === "query"));
    reports.push({
        root, suiteHash: result.suiteHash, mode: result.mode, excluded, attemptedQuestions: questionIds.size,
        failures: result.failures,
        quality: excluded ? null : summarize(result.results),
        byGroup: excluded ? null : Object.fromEntries([...new Set(result.results.map(item => item.group))].sort().map(group => [group, summarize(result.results.filter(item => item.group === group))])),
        cost: {allDevelopment: summarizeCallCosts(calls), query: queryCost, judge: summarizeCallCosts(calls.filter(call => call.stage === "judge")),
            queryUsdPerAttemptedQuestion: queryCost.estimatedUsd === null || questionIds.size === 0 ? null : queryCost.estimatedUsd / questionIds.size},
    });
}
console.log(JSON.stringify({schema: "neurobook.memory.query-evaluation-report.v1", reports,
    limitations: ["Rates are estimated at request start and may differ from invoices", "Model-assisted labels and judging require source checks", "Failure questions remain in the denominator; excluded controls contribute no quality scores", "Question sets concentrate on their reading checkpoints and do not establish ten-million-character retrieval quality"]}));
