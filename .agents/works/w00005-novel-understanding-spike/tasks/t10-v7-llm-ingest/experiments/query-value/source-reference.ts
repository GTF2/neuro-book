import assert from "node:assert/strict";
import {join, resolve} from "node:path";
import {parseArgs} from "node:util";
import {captureSources} from "../../source.ts";
import {hash} from "../../compiler.ts";
import {parseDataset} from "../../../t07-v7-schema-gold/index.ts";
import {writeJson} from "../../storage.ts";

const args = parseArgs({options: {epub: {type: "string"}, root: {type: "string"}}});
assert(args.values.epub && args.values.root);
const capture = await captureSources(resolve(args.values.epub), 20);
const root = resolve(args.values.root);
const manifests = [];
for (let chapter = 1; chapter <= 20; chapter++) {
    const sources = capture.sources.slice(0, chapter);
    const source = sources.at(-1)!;
    const readAt = {chapter, paragraph: source.paragraphs.length};
    const sourceManifest = `source-reference:${hash(JSON.stringify(sources.map(item => item.sha256)))}`;
    const dataset = parseDataset({
        schema: "neurobook.memory.v7", book: capture.book,
        snapshot: {id: `source-only-${chapter}`, sourceManifest, knowledgeRevision: chapter, readAt},
        sources, nodes: [], partitionWatermarks: {}, invalidationRoots: [],
        coverage: {through: readAt, chapters: sources.map(item => item.chapterOrder), material: "partial", semantic: "partial",
            gaps: ["Source-only evaluation reference; no graph or ingest output"], recordsExhausted: false, corpusClosed: false},
    });
    const path = `ch${String(chapter).padStart(2, "0")}/dataset-v7.json`;
    await writeJson(join(root, path), dataset, true);
    manifests.push({chapter, path, sha256: hash(JSON.stringify(dataset))});
}
await writeJson(join(root, "reference.json"), {schema: "neurobook.memory.source-query-reference.v1", archive: capture.archive, normalization: capture.normalization, graphRecords: 0, manifests}, true);
console.log(JSON.stringify({root, chapters: manifests.length, graphRecords: 0}));
