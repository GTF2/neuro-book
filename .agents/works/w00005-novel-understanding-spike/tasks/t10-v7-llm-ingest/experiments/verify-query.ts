import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {readFile, rm} from "node:fs/promises";
import {join, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {parseArgs} from "node:util";
import {createTestTmpRoot, resolveTmpRoot} from "@notnotype/neuro-book-test-support/tmp";
import {assertContained} from "@notnotype/neuro-book-test-support/paths";
import {comparePosition, parseDataset, type MemoryDataset} from "../../t07-v7-schema-gold/index.ts";
import {createQueryService, QueryError, type QueryRequest, type QueryResponse, type RecordItem} from "../../t09-v7-query-cli/index.ts";
import {hash} from "../compiler.ts";
import {manifestSchema} from "../runner.ts";

const args = parseArgs({options: {"run-dir": {type: "string"}, head: {type: "string"}}});
assert(args.values["run-dir"] && args.values.head, "Require --run-dir and --head");
const root = resolve(args.values["run-dir"]), expectedHead = Number(args.values.head);
assert(Number.isInteger(expectedHead) && expectedHead >= 1 && expectedHead <= 20);
const read = async (path: string): Promise<unknown> => JSON.parse(await readFile(path, "utf8"));
const manifest = manifestSchema.parse(await read(join(root, "manifest.json")));
assert.equal(manifest.head, expectedHead);
const chapters = [];
let totalQueries = 0;

function checkedService(dataset: MemoryDataset) {
    const query = createQueryService(dataset);
    function checkRecord(item: RecordItem, response: QueryResponse) {
        assert(comparePosition(item.record.availableAt, response.scope.readAt) <= 0);
        for (const excerpt of item.provenance.excerpts) {
            assert(comparePosition({chapter: excerpt.chapter, paragraph: excerpt.span.paragraph}, response.scope.readAt) <= 0);
            const paragraph = dataset.sources.find(source => source.id === excerpt.span.sourceId)!.paragraphs[excerpt.span.paragraph - 1]!;
            assert.equal(excerpt.text, paragraph.slice(excerpt.span.start, excerpt.span.end));
        }
        if (item.record.kind === "entity") for (const name of item.record.data.names) assert(comparePosition(name.availableAt, response.scope.readAt) <= 0);
        if (item.target && "type" in item.target) checkRecord(item.target, response);
    }
    return (request: QueryRequest) => {
        totalQueries++;
        const response = query(request);
        assert.equal(response.coverage.corpusClosed, false);
        assert.equal(response.completeness.corpusClosed, false);
        for (const item of response.items) if (item.type === "record") checkRecord(item, response);
        return response;
    };
}

function allPages(query: ReturnType<typeof checkedService>, request: Exclude<QueryRequest, {command: "info" | "get"}>) {
    const items: QueryResponse["items"] = [], cursors = new Set<string>();
    let response = query(request);
    const matching = response.completeness.matchingRecords;
    for (;;) {
        assert.equal(response.completeness.matchingRecords, matching);
        items.push(...response.items);
        if (!response.nextCursor) break;
        assert(!cursors.has(response.nextCursor), "Repeated pagination cursor");
        cursors.add(response.nextCursor);
        response = query({...request, cursor: response.nextCursor});
    }
    assert.equal(items.length, matching);
    const ids = items.map(item => item.type === "record" ? item.record.id : item.type === "source" ? `${item.chapter}:${item.paragraph}` : "info");
    assert.equal(new Set(ids).size, ids.length, "Duplicate across pages");
    return items;
}

for (const publication of manifest.publications) {
    const dataset = parseDataset(await read(join(root, publication.dataset)));
    assert.equal(hash(JSON.stringify(dataset)), publication.sha256);
    const query = checkedService(dataset), chapter = publication.chapter;
    const source = dataset.sources.find(source => source.chapterOrder === chapter)!;
    const info = query({command: "info"}).items[0]!;
    assert(info.type === "info");
    assert.equal(info.chapters.length, chapter);
    const material = allPages(query, {command: "source", chapter, limit: 17});
    assert.deepEqual(material.map(item => {assert(item.type === "source"); return item.text;}), source.paragraphs);
    const entities = allPages(query, {command: "entities", limit: 7});
    let freshSummarySubjects = 0, missingSummarySubjects = 0;
    for (const entity of entities) {
        assert(entity.type === "record" && entity.record.kind === "entity");
        const summaries = query({command: "summaries", entity: entity.record.id, limit: 100});
        if (summaries.completeness.summaryStatus === "ready") freshSummarySubjects++;
        else missingSummarySubjects++;
    }
    const positions = [...new Set([Math.ceil(source.paragraphs.length / 2), source.paragraphs.length])];
    const scopeChecks = positions.map(paragraph => {
        const at = {chapter, paragraph};
        const facts = allPages(query, {command: "facts", at, limit: 100});
        const beats = allPages(query, {command: "search", kind: "beat", at, limit: 100});
        return {at, visibleFacts: facts.length, visibleBeats: beats.length};
    });
    let explicitAccess = 0, emptyKnowledgeSubjects = 0;
    if (chapter === expectedHead) for (const entity of entities) {
        assert(entity.type === "record");
        const holder = entity.record.id;
        const accesses = allPages(query, {command: "knowledge", holder, limit: 100});
        explicitAccess += accesses.length;
        if (!accesses.length) emptyKnowledgeSubjects++;
        query({command: "info", perspective: holder});
        assert.throws(() => query({command: "source", chapter, perspective: holder}), (error: unknown) => error instanceof QueryError && error.code === "INVALID_SCOPE");
    }
    assert.throws(() => query({command: "info", at: {chapter: expectedHead + 1}}), (error: unknown) => error instanceof QueryError && error.code === "INVALID_SCOPE");
    chapters.push({chapter, sourceParagraphs: material.length, entities: entities.length, freshSummarySubjects, missingSummarySubjects, scopeChecks,
        ...(chapter === expectedHead ? {explicitAccess, emptyKnowledgeSubjects} : {})});
}

const temporary = await createTestTmpRoot("v7-query", "t10 external-working-directory CLI verification");
let cli: {outsideRepository: boolean; chapter: number; characters: number};
try {
    const output = execFileSync(process.execPath, ["--import", import.meta.resolve("tsx"), fileURLToPath(new URL("../../t09-v7-query-cli/cli.ts", import.meta.url)), "--data", join(root, "dataset-v7.json"), "info"], {cwd: temporary, encoding: "utf8", windowsHide: true, timeout: 60000});
    const response: unknown = JSON.parse(output);
    assert(response && typeof response === "object" && "ok" in response && response.ok === true && "scope" in response);
    assert.deepEqual(response.scope, {readAt: {chapter: expectedHead, paragraph: chapters.at(-1)!.sourceParagraphs}, perspective: "reader", world: "original"});
    cli = {outsideRepository: true, chapter: expectedHead, characters: output.length};
} finally {
    assert(temporary !== resolveTmpRoot());
    assertContained(resolveTmpRoot(), temporary, "query verification temporary root");
    await rm(temporary, {recursive: true, force: true});
}
assert.deepEqual(manifestSchema.parse(await read(join(root, "manifest.json"))), manifest, "Run advanced during verification");
console.log(JSON.stringify({schema: "neurobook.memory.ingest-query-verification.v1", observedAt: new Date().toISOString(), head: expectedHead,
    inputHash: manifest.inputHash, policyHash: manifest.policyHash, totalQueries, chapters, cli,
    limitations: ["Checks verify published CLI, paging, source fidelity and structural scope, not prose truth or semantic recall", "Missing summaries and empty knowledge queries are observations, not evidence of absent real-world knowledge"]}));
