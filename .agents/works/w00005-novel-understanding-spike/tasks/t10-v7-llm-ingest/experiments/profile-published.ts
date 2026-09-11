import assert from "node:assert/strict";
import {readFile, stat} from "node:fs/promises";
import {join, resolve} from "node:path";
import {parseArgs} from "node:util";
import {parseDataset} from "../../t07-v7-schema-gold/index.ts";
import {hash} from "../compiler.ts";
import {reportIngest} from "../report.ts";
import {manifestSchema} from "../runner.ts";

const args = parseArgs({options: {"run-dir": {type: "string"}}});
assert(args.values["run-dir"], "Require --run-dir");
const root = resolve(args.values["run-dir"]);
const readManifest = async () => manifestSchema.parse(JSON.parse(await readFile(join(root, "manifest.json"), "utf8")));
const manifest = await readManifest();
const report = await reportIngest(root);
assert(manifest.head > 0, "Require a published prefix");
assert.equal(report.publishedChapters, manifest.head);
assert.equal(report.policyHash, manifest.policyHash);
const calls = report.calls.filter(call => call.chapter <= manifest.head);
type Call = typeof calls[number];

function durations(selected: readonly Call[]) {
    const knownMs = selected.reduce((sum, call) => sum + (call.durationMs ?? 0), 0);
    const unknownCalls = selected.filter(call => call.durationMs === null).length;
    return {calls: selected.length, knownMs, unknownCalls, totalMs: unknownCalls === 0 ? knownMs : null};
}

const chapters = [];
for (const source of report.sources.chapters) {
    const publication = manifest.publications.find(item => item.chapter === source.chapter)!;
    const path = join(root, publication.dataset);
    const dataset = parseDataset(JSON.parse(await readFile(path, "utf8")));
    assert.equal(hash(JSON.stringify(dataset)), publication.sha256);
    const selected = calls.filter(call => call.chapter === source.chapter);
    chapters.push({
        chapter: source.chapter, characters: source.characters,
        records: dataset.nodes.length, snapshotBytes: (await stat(path)).size,
        rounds: new Set(selected.map(call => call.round)).size,
        ...durations(selected),
        accepted: durations(selected.filter(call => call.classification === "production-accepted")),
        repair: durations(selected.filter(call => call.classification === "production-repair")),
        inputTokens: selected.every(call => call.usage !== null) ? selected.reduce((sum, call) => sum + call.usage!.inputTokens, 0) : null,
        outputTokens: selected.every(call => call.usage !== null) ? selected.reduce((sum, call) => sum + call.usage!.outputTokens, 0) : null,
    });
}

const characters = chapters.reduce((sum, chapter) => sum + chapter.characters, 0);
const duration = durations(calls);
const firstRequest = Math.min(...calls.map(call => Date.parse(call.startedAt)));
const lastKnownResponse = Math.max(...calls.flatMap(call => call.durationMs === null ? [] : [Date.parse(call.startedAt) + call.durationMs]));
assert(Number.isFinite(firstRequest) && Number.isFinite(lastKnownResponse));
assert.deepEqual(await readManifest(), manifest, "Published prefix advanced while profiling; repeat");

console.log(JSON.stringify({
    schema: "neurobook.memory.ingest-profile.v1", observedAt: new Date().toISOString(),
    head: manifest.head, inputHash: manifest.inputHash, policyHash: manifest.policyHash,
    characters, chapters, providerTime: duration,
    byStage: Object.fromEntries(["material", "integration", "review"].map(stage => [stage, durations(calls.filter(call => call.stage === stage))])),
    knownRequestResponseSpanMs: lastKnownResponse - firstRequest,
    snapshots: {latestBytes: chapters.at(-1)!.snapshotBytes, cumulativeBytes: chapters.reduce((sum, chapter) => sum + chapter.snapshotBytes, 0)},
    serialTenMillionCharacters: {
        knownProviderDays: duration.knownMs / 86_400_000 * 10_000_000 / characters,
        providerDays: duration.totalMs === null ? null : duration.totalMs / 86_400_000 * 10_000_000 / characters,
    },
    limitations: [
        "Only published calls and source characters are measured; failed calls without responses have unknown duration",
        "Provider duration includes network and provider processing, not just model computation",
        "Request-response span can include debugging pauses; only summed provider duration is projected",
        "Linear time projection assumes unchanged chapter density, provider speed, bounded context and repair rate",
        "Snapshot bytes are measured on disk; this does not establish production storage or retrieval performance",
    ],
}));
