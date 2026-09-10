import {parseArgs} from "node:util";
import {parseRequest, QueryError, type ParsedRequest} from "./contract.ts";

export const helpText = `V7 read-only memory query

Usage: bun run query <command> [options]
       node --import tsx <path-to-cli.ts> <command> [options]

Commands:
  info                          Snapshot, coverage, counts and limitations
  entities [--query TEXT] [--category CATEGORY]
  search [--query TEXT] [--kind KIND]   Supply query, kind, or both
  facts [--entity ID] [--target ID] [--predicate ID]
        [--assertion KIND] [--epistemic STATE] [--query TEXT]
  knowledge --holder ID [--about ID] [--mode MODE]
  summaries --entity ID [--facet FACET]
  get ID
  explain ID [--depth 0..8]
  source --chapter N [--from N] [--to N] [--query TEXT]

Common: --data FILE --at CHAPTER[:PARAGRAPH] --perspective reader|ENTITY_ID
        --world ID --help
Paging: --limit 1..100 --cursor TOKEN (except info and get)
Defaults: adjacent two-chapter gold dataset, snapshot read limit, reader,
          original world, limit 20, explain depth 2.

Kinds: entity referent mention resolution predicate disclosure beat fact episode
       synthesis entitySummary argument assessment time watch knowledgeAccess
Assertions: world belief speech rule paratext hypothesis fiction
Epistemic states: accepted tentative disputed unsupported
Knowledge modes: heard read believed known unaware

Successful queries write one neurobook.memory.query.v1 JSON object to stdout.
Errors write one JSON object to stderr. Exit: 0 success/help, 2 input/scope/cursor,
3 file/data, 4 unavailable record, 1 internal failure.
No result means no matching explicit record; it does not mean unaware.
`;

const stringOptions = ["data", "at", "perspective", "world", "limit", "cursor", "query", "category", "kind", "entity", "target", "predicate", "assertion", "epistemic", "holder", "about", "mode", "facet", "depth", "chapter", "from", "to"];
const numericOptions = new Set(["limit", "depth", "chapter", "from", "to"]);

export function parseCliArguments(args: string[]): {help: true} | {help: false; data?: string; request: ParsedRequest} {
    let parsed: ReturnType<typeof parseArgs>;
    try {
        parsed = parseArgs({args, strict: true, allowPositionals: true, tokens: true, options: {...Object.fromEntries(stringOptions.map(name => [name, {type: "string" as const}])), help: {type: "boolean"}}});
    } catch {
        throw new QueryError("INVALID_ARGUMENT", "Invalid or unknown CLI option; use --help for supported arguments", 2);
    }
    const seen = new Set<string>();
    for (const token of parsed.tokens ?? []) if (token.kind === "option") {
        if (seen.has(token.name)) throw new QueryError("INVALID_ARGUMENT", `Duplicate option --${token.name}`, 2);
        seen.add(token.name);
    }
    if (parsed.values.help === true || args.length === 0) return {help: true};
    const [command, id] = parsed.positionals;
    const expected = command === "get" || command === "explain" ? 2 : 1;
    if (parsed.positionals.length !== expected) throw new QueryError("INVALID_ARGUMENT", "Unexpected or missing positional arguments; use --help", 2);
    const request: Record<string, unknown> = {command};
    if (id !== undefined) request.id = id;
    let data: string | undefined;
    for (const [key, value] of Object.entries(parsed.values)) {
        if (typeof value !== "string" || value.trim().length === 0) throw new QueryError("INVALID_ARGUMENT", `Option --${key} requires a nonempty value`, 2);
        if (key === "data") { data = value; continue; }
        if (key === "at") {
            if (!/^[1-9][0-9]*(?::[1-9][0-9]*)?$/.test(value)) throw new QueryError("INVALID_ARGUMENT", "--at requires CHAPTER[:PARAGRAPH] with positive integers", 2);
            const [chapter, paragraph] = value.split(":").map(Number);
            request.at = {chapter, ...(paragraph !== undefined ? {paragraph} : {})};
        } else if (numericOptions.has(key)) {
            if (!/^[0-9]+$/.test(value)) throw new QueryError("INVALID_ARGUMENT", `--${key} requires an integer`, 2);
            request[key] = Number(value);
        } else request[key] = value;
    }
    return {help: false, data, request: parseRequest(request)};
}
