import {parseArgs} from "node:util";
import {resolve} from "node:path";
import {captureSources} from "./source.ts";
import {createDeepSeekProvider, loadProviderConfig} from "./provider.ts";
import {runIngest} from "./runner.ts";
import {readJson} from "./storage.ts";
import {reportIngest} from "./report.ts";

try {
    const args = parseArgs({options: {epub: {type: "string"}, "run-dir": {type: "string"}, through: {type: "string"}, "provider-config": {type: "string"}, "env-key": {type: "string"}, status: {type: "boolean"}, report: {type: "boolean"}, development: {type: "boolean"}, help: {type: "boolean"}}, strict: true});
    if (args.values.help) console.log("V7 ingest: --epub FILE --run-dir DIR [--through 1..20] (--provider-config FILE | --env-key NAME)\nInspect: --run-dir DIR --status\nReport: --run-dir DIR --report [--development]\nPublished output: DIR/dataset-v7.json; immutable snapshots: DIR/chNN/dataset-v7.json");
    else {
        const root = args.values["run-dir"];
        if (!root) throw new Error("--run-dir is required");
        if (args.values.report) console.log(JSON.stringify(await reportIngest(resolve(root), args.values.development ? "development" : "production")));
        else if (args.values.status) console.log(JSON.stringify(await readJson(resolve(root, "manifest.json"))));
        else {
            if (!args.values.epub) throw new Error("--epub is required");
            const through = Number(args.values.through ?? 20);
            if (!Number.isInteger(through) || through < 1 || through > 20) throw new Error("--through must be 1..20");
            const config = await loadProviderConfig({configPath: args.values["provider-config"], envKey: args.values["env-key"]});
            const capture = await captureSources(resolve(args.values.epub), 20);
            const result = await runIngest({root: resolve(root), book: capture.book, sources: capture.sources, sourceIdentity: {archiveSha256: capture.archive.sha256, normalization: capture.normalization}, through, provider: createDeepSeekProvider(config), progress: event => process.stderr.write(`${JSON.stringify(event)}\n`)});
            console.log(JSON.stringify({ok: true, head: result.manifest.head, datasetPath: result.datasetPath}));
        }
    }
} catch (error) {
    process.stderr.write(`${JSON.stringify({ok: false, error: error instanceof Error ? error.message : "Ingest failed"})}\n`);
    process.exitCode = 1;
}
