import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { parseDataset } from "./validate.ts";
import { createQueryIndex, queryEntitySummaries, querySnapshot } from "./query.ts";

const data = parseDataset(JSON.parse(await readFile(new URL("dataset-v7.json", import.meta.url), "utf8")));
for (const source of data.sources) {
    if (createHash("sha256").update(source.paragraphs.join("\n"), "utf8").digest("hex") !== source.sha256) throw new Error(`Source hash mismatch ${source.id}`);
}
const index = createQueryIndex(data), scope = { readAt: data.snapshot.readAt, perspective: "reader", world: "original" };
const full = querySnapshot(index, scope), summary = queryEntitySummaries(index, "su", scope);
console.log(JSON.stringify({ schema: "v7.gold-validation/v1", sources: data.sources.length, paragraphs: data.sources.reduce((sum, source) => sum + source.paragraphs.length, 0), nodes: data.nodes.length, byKind: Object.fromEntries([...index.byKind].map(([kind, nodes]) => [kind, nodes.length])), fullQuery: { nodes: full.nodes.length, ...full.diagnostics }, entitySummaryQuery: { items: summary.items.map(item => item.id), ...summary.diagnostics }, limitations: ["review candidate, not developer-approved gold", "lookup counts on two chapters, not production benchmarks"] }, null, 2));
