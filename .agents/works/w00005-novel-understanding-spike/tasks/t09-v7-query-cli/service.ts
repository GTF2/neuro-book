import {comparePosition, createQueryIndex, parseDataset, queryEntitySummaries, querySnapshot, type MemoryNode, type QueryIndex, type QueryScope} from "../t07-v7-schema-gold/index.ts";
import {parseRequest, QueryError, responseSchemaVersion, type ParsedRequest, type QueryResponse, type RecordItem, type SourceItem} from "./contract.ts";
import {createRecordPresenter, entityMatchRank, entityNameMatches, matchesText, participates, recordOrder, searchableText} from "./content.ts";
import {fingerprint, pageItems} from "./pagination.ts";

function scopeFor(index: QueryIndex, request: ParsedRequest): QueryScope {
    const chapter = request.at?.chapter ?? index.dataset.snapshot.readAt.chapter;
    const source = index.dataset.sources.find(source => source.chapterOrder === chapter);
    if (!source) throw new QueryError("INVALID_SCOPE", "Reading chapter is outside the snapshot material", 2);
    const maximum = chapter === index.dataset.snapshot.readAt.chapter ? Math.min(source.paragraphs.length, index.dataset.snapshot.readAt.paragraph) : source.paragraphs.length;
    const paragraph = request.at?.paragraph ?? maximum;
    const readAt = {chapter, paragraph};
    if (paragraph > maximum || comparePosition(readAt, index.dataset.snapshot.readAt) > 0) throw new QueryError("INVALID_SCOPE", "Reading position is outside the snapshot coverage", 2);
    if (!index.dataset.nodes.some(node => node.scope.world === request.world && comparePosition(node.availableAt, readAt) <= 0)) throw new QueryError("INVALID_SCOPE", "Unknown world in this reading range", 2);
    const scope = {readAt, perspective: request.perspective, world: request.world};
    if (request.perspective !== "reader") {
        const reader = querySnapshot(index, {...scope, perspective: "reader"});
        if (!reader.nodes.some(node => node.kind === "entity" && node.id === request.perspective)) throw new QueryError("INVALID_SCOPE", "Perspective must be a visible entity ID", 2);
    }
    return scope;
}

/** Pin and validate one snapshot. Returned requests and results never share mutable dataset objects. */
export function createQueryService(input: unknown): (request: unknown) => QueryResponse {
    let index: QueryIndex;
    try {
        index = createQueryIndex(parseDataset(input));
    } catch {
        throw new QueryError("INVALID_DATA", "Dataset failed the V7 schema or reference validation", 3);
    }
    const contentHash = fingerprint(index.dataset);
    return (inputRequest: unknown): QueryResponse => {
        const request = parseRequest(inputRequest);
        const scope = scopeFor(index, request);
        const snapshot = querySnapshot(index, scope);
        const presenter = createRecordPresenter(index.dataset, scope, snapshot.nodes);
        const nodes = [...snapshot.nodes].sort(recordOrder);
        const requireEntity = (id: string) => {
            // scopeFor already validated this subject; an empty knowledge projection can omit the subject itself.
            if (scope.perspective !== "reader" && id === scope.perspective) return;
            if (presenter.visible.get(id)?.kind !== "entity") throw new QueryError("INVALID_ARGUMENT", "Expected a visible entity ID", 2);
        };
        const requireRecord = (id: string) => {
            const node = presenter.visible.get(id);
            if (!node) throw new QueryError("RECORD_UNAVAILABLE", "Record is unavailable in this snapshot and scope", 4);
            return node;
        };
        let items: QueryResponse["items"] = [];
        let depthTruncated = false;
        let summaryStatus: "ready" | "missing-or-stale" | undefined;
        switch (request.command) {
            case "info": {
                const counts: Partial<Record<MemoryNode["kind"], number>> = {};
                for (const node of nodes) counts[node.kind] = (counts[node.kind] ?? 0) + 1;
                items = [{
                    type: "info", book: index.dataset.book, counts,
                    chapters: index.dataset.sources.filter(source => source.chapterOrder <= scope.readAt.chapter).map(source => ({chapter: source.chapterOrder, visibleParagraphs: source.chapterOrder === scope.readAt.chapter ? scope.readAt.paragraph : source.paragraphs.length})),
                    capabilities: ["scoped-substring-search", "explicit-argument-filters", "knowledge-access", "current-summaries", "bounded-provenance", "stable-pagination"],
                    limitations: ["No semantic or vector search", "No inferred negative knowledge", "No natural-language answers or model calls", "No story-time filtering", "Semantic coverage is a reviewed selection, never a closed corpus"],
                }];
                break;
            }
            case "entities": {
                items = nodes.filter(node => node.kind === "entity" && (request.category === undefined || node.data.category === request.category) && matchesText(searchableText(node), request.query))
                    .map(node => ({...presenter.present(node), nameMatches: node.kind === "entity" ? entityNameMatches(node, request.query) : []}))
                    .sort((a, b) => entityMatchRank(a.nameMatches) - entityMatchRank(b.nameMatches) || recordOrder(a.record, b.record));
                break;
            }
            case "search": {
                items = nodes.filter(node => (request.kind === undefined || node.kind === request.kind) && matchesText(searchableText(node), request.query)).map(presenter.present);
                break;
            }
            case "facts": {
                items = nodes.filter(node => node.kind === "fact"
                    && (request.entity === undefined || participates(node, request.entity))
                    && (request.target === undefined || participates(node, request.target))
                    && (request.predicate === undefined || node.data.predicate.id === request.predicate)
                    && (request.assertion === undefined || node.data.assertion.kind === request.assertion)
                    && (request.epistemic === undefined || presenter.assessments.get(node.id)?.data.epistemic === request.epistemic)
                    && matchesText(searchableText(node), request.query)).map(presenter.present);
                break;
            }
            case "knowledge": {
                requireEntity(request.holder);
                items = nodes.filter(node => {
                    if (node.kind !== "knowledgeAccess" || node.data.holder.id !== request.holder || (request.mode !== undefined && node.data.mode !== request.mode)) return false;
                    const target = presenter.visible.get(node.data.target.id);
                    return request.about === undefined || node.data.target.id === request.about || (target?.kind === "fact" && presenter.visible.get(request.about)?.kind === "entity" && participates(target, request.about));
                }).map(node => {
                    const item = presenter.present(node);
                    if (node.kind === "knowledgeAccess") {
                        const target = presenter.visible.get(node.data.target.id);
                        item.target = target ? presenter.present(target) : presenter.handle(node.data.target);
                    }
                    return item;
                });
                break;
            }
            case "summaries": {
                requireEntity(request.entity);
                const summaries = queryEntitySummaries(index, request.entity, scope);
                const current = summaries.items.filter(node => presenter.visible.has(node.id) && (request.facet === undefined || node.data.facet === request.facet));
                summaryStatus = current.length ? "ready" : "missing-or-stale";
                items = current.sort(recordOrder).map(presenter.present);
                break;
            }
            case "get": items = [presenter.present(requireRecord(request.id))]; break;
            case "explain": {
                const pending = [{node: requireRecord(request.id), depth: 0}];
                const visited = new Set([request.id]);
                const result: RecordItem[] = [];
                for (let position = 0; position < pending.length; position++) {
                    const current = pending[position]!;
                    const links = presenter.links(current.node);
                    const boundary = links.filter(link => link.target.status === "unavailable" || (current.depth === request.depth && !visited.has(link.target.id)));
                    if (boundary.some(link => link.target.status === "visible")) depthTruncated = true;
                    result.push({...presenter.present(current.node), depth: current.depth, links, boundary});
                    if (current.depth === request.depth) continue;
                    for (const link of links) {
                        const target = presenter.visible.get(link.target.id);
                        if (!target || visited.has(target.id)) continue;
                        visited.add(target.id);
                        pending.push({node: target, depth: current.depth + 1});
                    }
                }
                items = result;
                break;
            }
            case "source": {
                if (scope.perspective !== "reader") throw new QueryError("INVALID_SCOPE", "The source command requires reader perspective", 2);
                const source = index.dataset.sources.find(source => source.chapterOrder === request.chapter);
                if (!source || source.chapterOrder > scope.readAt.chapter) throw new QueryError("INVALID_SCOPE", "Source chapter is outside the reading range", 2);
                const maximum = source.chapterOrder === scope.readAt.chapter ? scope.readAt.paragraph : source.paragraphs.length;
                const from = request.from ?? 1, to = request.to ?? maximum;
                if (from > to || to > maximum) throw new QueryError("INVALID_SCOPE", "Source paragraph range is outside the reading range", 2);
                items = source.paragraphs.slice(from - 1, to).map((text, offset): SourceItem => ({type: "source", sourceId: source.id, revision: source.revision, chapter: source.chapterOrder, paragraph: from + offset, text})).filter(item => matchesText([item.text], request.query));
                break;
            }
        }
        const matchingRecords = items.length;
        const queryHash = fingerprint({contentHash, scope, request: {...request, cursor: undefined, at: undefined}, order: "name-rank-availableAt-id-v1"});
        const page = "limit" in request ? pageItems(items, request.limit, queryHash, request.cursor) : {items, nextCursor: null};
        const referenceItems = request.command === "explain" ? items : page.items;
        const unavailableReferences = new Set(referenceItems.flatMap(item => item.type === "record" ? [...item.provenance.references, ...item.provenance.dependencies].filter(ref => ref.status === "unavailable").map(ref => `${ref.id}@${ref.revision}`) : [])).size;
        // Paging exhaustion cannot erase an earlier invisible or depth-limited evidence path.
        const recordsExhausted = page.nextCursor === null && (request.command !== "explain" || (!depthTruncated && unavailableReferences === 0));
        return structuredClone({
            schema: responseSchemaVersion, ok: true, command: request.command,
            snapshot: {...index.dataset.snapshot, contentHash}, scope, items: page.items,
            coverage: {...presenter.presentCoverage(snapshot.coverage), recordsExhausted, corpusClosed: false},
            completeness: {recordsExhausted, corpusClosed: false, matchingRecords, returned: page.items.length, ...(summaryStatus ? {summaryStatus} : {})},
            truncation: {page: page.nextCursor !== null, depth: depthTruncated, unavailableReferences},
            nextCursor: page.nextCursor,
        });
    };
}
