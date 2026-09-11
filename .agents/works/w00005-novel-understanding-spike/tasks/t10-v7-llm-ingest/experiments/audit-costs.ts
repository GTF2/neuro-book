import assert from "node:assert/strict";
import {readFile, readdir} from "node:fs/promises";
import {join, resolve} from "node:path";
import {parseArgs} from "node:util";
import {z} from "zod";
import {modelResponseSchema} from "../runner.ts";
import {summarizeCallCosts, type CostCall} from "../cost.ts";
import {reportIngest} from "../report.ts";

const args = parseArgs({options: {"evidence-root": {type: "string"}, formal: {type: "string"}}});
assert(args.values["evidence-root"] && args.values.formal, "Require --evidence-root and --formal (a direct run directory name)");
const root = resolve(args.values["evidence-root"]), formal = args.values.formal;
assert(formal !== "." && formal !== ".." && !/[\\/]/.test(formal));
const requestSchema = z.object({startedAt: z.string().datetime(), request: z.object({model: z.literal("deepseek-flash")})});
const read = async (path: string): Promise<unknown> => JSON.parse(await readFile(path, "utf8"));
const allDevelopment: CostCall[] = [], runs = [], responseIds = new Set<string>();
for (const directory of (await readdir(root, {withFileTypes: true})).filter(item => item.isDirectory()).sort((a, b) => a.name.localeCompare(b.name, "en"))) {
    const path = join(root, directory.name);
    const requestPaths = (await readdir(path, {recursive: true})).filter(name => /(?:^|[\\/])request\.json$/.test(name)).sort();
    if (!requestPaths.length || directory.name === formal) continue;
    const calls: CostCall[] = [];
    const unknownRequests = [];
    for (const name of requestPaths) {
        const requestPath = join(path, name), request = requestSchema.parse(await read(requestPath));
        let response: z.infer<typeof modelResponseSchema> | null = null;
        try { response = modelResponseSchema.parse(await read(requestPath.replace(/request\.json$/, "response.json"))); }
        catch (error) {
            if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) throw error;
        }
        if (response?.responseId) {
            assert(!responseIds.has(response.responseId), `Duplicate provider response ID in the development ledger: ${directory.name}/${name}`);
            responseIds.add(response.responseId);
        }
        if (!response) unknownRequests.push(name.replaceAll("\\", "/"));
        calls.push({chapter: 1, stage: directory.name, classification: "development", startedAt: response?.startedAt ?? request.startedAt, response});
    }
    allDevelopment.push(...calls);
    runs.push({name: directory.name, requests: calls.length, unknownRequests, costs: summarizeCallCosts(calls)});
}
const production = await reportIngest(join(root, formal));
console.log(JSON.stringify({schema: "neurobook.memory.development-cost-audit.v2", observedAt: new Date().toISOString(),
    evidenceRoot: root, formal: {name: formal, head: production.publishedChapters, policyHash: production.policyHash, costs: production.costs},
    development: {runs, total: summarizeCallCosts(allDevelopment)},
    limitations: ["The selected formal run alone supplies the product ingest projection; prior formal attempts, density studies, query studies and label preparation are development costs", "Only persisted real request.json entries are counted; captured baseline requests nested in experiment metadata are not additional calls", "Absent responses may have incurred charges and remain unknown, including interrupted and transport-error attempts", "Public-price estimates exclude the development agent's tokens, human diagnosis, storage, indexing and infrastructure"]}));
