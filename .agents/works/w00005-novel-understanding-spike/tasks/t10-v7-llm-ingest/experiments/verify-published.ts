import assert from "node:assert/strict";
import {readFile, readdir} from "node:fs/promises";
import {join, resolve} from "node:path";
import {parseArgs} from "node:util";
import {parseDataset} from "../../t07-v7-schema-gold/index.ts";
import {compileSnapshot, hash} from "../compiler.ts";
import {validateMaterial, validateReview} from "../draft.ts";
import {manifestSchema, parseAccepted, runIngest} from "../runner.ts";
import {captureSources} from "../source.ts";

const args = parseArgs({options: {"run-dir": {type: "string"}, epub: {type: "string"}, head: {type: "string"}, "check-rerun": {type: "boolean"}}});
assert(args.values["run-dir"] && args.values.epub && args.values.head, "Require --run-dir, --epub and --head");
const root = resolve(args.values["run-dir"]);
const expectedHead = Number(args.values.head);
assert(Number.isInteger(expectedHead) && expectedHead >= 1 && expectedHead <= 20);
const read = async (path: string): Promise<unknown> => JSON.parse(await readFile(path, "utf8"));
const manifest = manifestSchema.parse(await read(join(root, "manifest.json")));
assert.equal(manifest.head, expectedHead, "Observed head must match the declared verification scope");
assert.equal(manifest.publications.length, expectedHead);
const capture = await captureSources(resolve(args.values.epub), 20);
const sourceIdentity = {archiveSha256: capture.archive.sha256, normalization: capture.normalization};
assert.equal(hash(JSON.stringify({book: capture.book, sources: capture.sources, sourceIdentity})), manifest.inputHash);
const accepted = [];
const snapshots = [];
const immutableHashes = new Map<string, string>();
for (const publication of manifest.publications) {
    assert.equal(publication.chapter, accepted.length + 1);
    const datasetPath = join(root, publication.dataset);
    const acceptedPath = join(root, publication.accepted);
    const dataset = parseDataset(await read(datasetPath));
    const candidate = parseAccepted(await read(acceptedPath));
    assert.equal(hash(JSON.stringify(dataset)), publication.sha256);
    assert.equal(hash(JSON.stringify(candidate)), publication.acceptedHash);
    assert.equal(candidate.chapter, publication.chapter);
    assert.equal(dataset.snapshot.readAt.chapter, publication.chapter);
    assert.deepEqual(dataset.sources, capture.sources.slice(0, publication.chapter));
    validateMaterial(candidate.material, capture.sources[publication.chapter - 1]!);
    validateReview(candidate.material, candidate.integration, candidate.review);
    accepted.push(candidate);
    snapshots.push({chapter: publication.chapter, records: dataset.nodes.length,
        paragraphs: dataset.sources.reduce((n, source) => n + source.paragraphs.length, 0),
        reviewedUnits: candidate.review.judgments.length, sha256: publication.sha256});
    for (const path of [datasetPath, acceptedPath]) immutableHashes.set(path, hash(await readFile(path, "utf8")));
}
const replay = compileSnapshot(capture.book, capture.sources, accepted);
assert.equal(hash(JSON.stringify(replay)), manifest.publications.at(-1)!.sha256, "Deterministic replay must reproduce the published snapshot");
const latest = parseDataset(await read(join(root, "dataset-v7.json")));
assert.deepEqual(latest, replay);

let rerun: {calls: number; requestsBefore: number; requestsAfter: number; immutableFiles: number} | null = null;
if (args.values["check-rerun"]) {
    const requestCount = async () => (await readdir(root, {recursive: true})).filter(path => /(?:^|[\\/])request\.json$/.test(path)).length;
    const requestsBefore = await requestCount();
    let calls = 0;
    const result = await runIngest({root, book: capture.book, sources: capture.sources, sourceIdentity, through: expectedHead,
        provider: async () => { calls++; throw new Error("Published rerun unexpectedly requested a model call"); }});
    assert.equal(calls, 0);
    assert.deepEqual(result.manifest, manifest);
    const requestsAfter = await requestCount();
    assert.equal(requestsAfter, requestsBefore);
    for (const [path, before] of immutableHashes) assert.equal(hash(await readFile(path, "utf8")), before);
    assert.deepEqual(parseDataset(await read(result.datasetPath)), latest);
    rerun = {calls, requestsBefore, requestsAfter, immutableFiles: immutableHashes.size};
}
assert.deepEqual(manifestSchema.parse(await read(join(root, "manifest.json"))), manifest, "Manifest advanced during verification; repeat for a coherent prefix");
console.log(JSON.stringify({schema: "neurobook.memory.ingest-verification.v1", observedAt: new Date().toISOString(),
    inputHash: manifest.inputHash, policyHash: manifest.policyHash, head: expectedHead,
    sourceParagraphs: replay.sources.reduce((n, source) => n + source.paragraphs.length, 0),
    sourceCharacters: replay.sources.reduce((n, source) => n + source.paragraphs.reduce((sum, p) => sum + [...p].length, 0), 0),
    snapshots, deterministicReplay: true, latestMatches: true, rerun,
    limitations: ["Complete Beat coverage and model review do not establish exhaustive semantic extraction"]}));
