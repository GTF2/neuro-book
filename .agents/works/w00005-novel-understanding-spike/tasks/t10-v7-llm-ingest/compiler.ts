import {createHash} from "node:crypto";
import {aggregateAssessment, collectReferences, comparePosition, createQueryIndex, nodeSchema, parseDataset, querySnapshot, type MemoryDataset, type MemoryNode, type NodeKind, type NodeOf, type Position, type RecordRef, type Source, type Span} from "../t07-v7-schema-gold/index.ts";
import {combinedMaterial, integrationSchema, materialSchema, reviewSchema, validateMaterial, validateReviewCoverage, type AcceptedChapter, type Proof} from "./draft.ts";
import {applyPublicationReview} from "./review-publication.ts";

const scope = {world: "original", perspective: "reader"};
const unspecified = {kind: "unspecified"} as const;
export const hash = (value: string) => createHash("sha256").update(value).digest("hex");

export function compileSnapshot(book: MemoryDataset["book"], sources: Source[], chapters: AcceptedChapter[], purpose: "publish" | "candidate-validation" = "publish"): MemoryDataset {
    if (!chapters.length || chapters.some((chapter, index) => chapter.chapter !== index + 1)) throw new Error("Chapters must form a nonempty consecutive prefix");
    const selectedSources = sources.filter(source => source.chapterOrder <= chapters.length);
    if (selectedSources.length !== chapters.length) throw new Error("Missing source chapter");
    const nodes: MemoryNode[] = [], byId = new Map<string, MemoryNode>();
    const ref = (id: string): RecordRef => ({id, revision: 1});
    function add<K extends NodeKind>(kind: K, id: string, label: string, at: Position, spans: Span[], dependencies: RecordRef[], data: NodeOf<K>["data"]): NodeOf<K> {
        if (byId.has(id)) throw new Error(`Duplicate record ${id}`);
        const node = nodeSchema.parse({id, kind, revision: 1, label, availableAt: at, scope, spans, dependencies, readiness: "ready", data});
        byId.set(id, node); nodes.push(node);
        return node as NodeOf<K>;
    }
    function requireNode(id: string): MemoryNode {
        const node = byId.get(id); if (!node) throw new Error(`Unknown reference ${id}`); return node;
    }
    function latest(refs: RecordRef[]): Position {
        return refs.reduce((at, item) => comparePosition(requireNode(item.id).availableAt, at) > 0 ? requireNode(item.id).availableAt : at, {chapter: 1, paragraph: 1});
    }
    function support(target: MemoryNode, id: string, premises: RecordRef[], proof: Proof, note: string, polarity: NodeOf<"argument">["data"]["polarity"] = "supports", at = target.availableAt) {
        if (comparePosition(target.availableAt, at) > 0) throw new Error(`Argument precedes its conclusion ${id}`);
        if (comparePosition(latest(premises), at) > 0) throw new Error(`Future proof ${target.id}`);
        if (premises.some(premise => requireNode(premise.id).kind === "entitySummary")) throw new Error("Summary cannot be an evidence premise");
        const argument = add("argument", id, `依据：${target.label}`, at, [], premises, {
            conclusion: ref(target.id), polarity, method: proof.method, premises: premises.map(item => ({ref: item, role: "evidence", required: true})),
            assumptions: proof.certainty === "tentative" ? [proof.rationale] : [], rationale: proof.rationale,
            sourceRoots: [...new Map(premises.flatMap(item => requireNode(item.id).spans).map(span => [JSON.stringify(span), span])).values()],
            applicability: proof.certainty === "accepted" ? "satisfied" : "unknown", bindings: [], jointScope: scope, jointTime: unspecified,
            review: {verdict: "passed", reviewer: "deepseek-flash-independent-review", note}, status: proof.certainty === "accepted" ? "usable" : "conditional",
        });
        return argument;
    }
    for (const accepted of chapters) {
        const originalMaterial = materialSchema.parse(accepted.material), integration = integrationSchema.parse(accepted.integration), review = reviewSchema.parse(accepted.review);
        const locations = new Map<string, string[]>();
        for (const [origin, draft] of [["material", originalMaterial], ["integration", integration]] as const) for (const [kind, items] of Object.entries(draft)) {
            if (kind === "gaps") continue;
            for (const item of items) if (typeof item === "object" && "id" in item) locations.set(item.id, [...(locations.get(item.id) ?? []), `${origin}.${kind}`]);
        }
        const duplicates = [...locations].filter(([, origins]) => origins.length > 1).map(([id, origins]) => ({id, origins}));
        if (duplicates.length) throw new Error(`Duplicate local IDs: ${JSON.stringify(duplicates)}. integration.referentAdditions must only contain additions absent from material; do not repeat A records.`);
        if (purpose === "publish") validateReviewCoverage(originalMaterial, integration, review);
        const material = combinedMaterial(originalMaterial, integration);
        const source = selectedSources.find(source => source.chapterOrder === accepted.chapter)!;
        validateMaterial(material, source);
        const at = (paragraph: number): Position => {
            if (paragraph < 1 || paragraph > source.paragraphs.length) throw new Error(`Paragraph outside chapter ${accepted.chapter}:${paragraph}`);
            return {chapter: accepted.chapter, paragraph};
        };
        const spans = (from: number, to: number): Span[] => {
            at(from); at(to); if (to < from) throw new Error("Reversed evidence range");
            return source.paragraphs.slice(from - 1, to).map((text, offset) => ({sourceId: source.id, sourceRevision: source.revision, paragraph: from + offset, start: 0, end: text.length}));
        };
        const prefix = `c${String(accepted.chapter).padStart(2, "0")}:`;
        const localIds = [...material.referents, ...material.disclosures, ...material.beats, ...integration.entities, ...integration.identities, ...integration.predicates, ...integration.times, ...integration.facts, ...integration.arguments, ...integration.access, ...integration.episodes, ...integration.summaries].map(item => item.id);
        const declared = new Set(localIds);
        const existing = new Set(byId.keys());
        const resolve = (value: string): string => {
            if (value.startsWith("known:")) {
                const id = value.slice(6); if (!existing.has(id)) throw new Error(`Unknown previous-prefix reference ${value}`); return id;
            }
            if (!declared.has(value)) throw new Error(`Undeclared local reference ${value}`);
            return prefix + value;
        };
        const references = (ids: string[]) => ids.map(value => ref(resolve(value)));
        const candidateReviewNote = "结构候选；语义复核在完整编译后应用。";

        const positions = new Map<string, Position>([
            ...material.referents.map(item => [item.id, at(Math.min(...item.mentions.map(mention => mention.paragraph)))] as const),
            ...material.disclosures.map(item => [item.id, at(item.to)] as const),
            ...material.beats.map(item => [item.id, at(item.to)] as const),
            ...[...integration.identities, ...integration.times, ...integration.facts, ...integration.arguments, ...integration.access, ...integration.episodes].map(item => [item.id, at(item.at)] as const),
            ...integration.summaries.map(item => [item.id, at(source.paragraphs.length)] as const),
            ...integration.predicates.map(item => [item.id, at(Math.min(source.paragraphs.length, ...integration.facts.filter(fact => fact.predicate === item.id).map(fact => fact.at)))] as const),
        ]);
        for (const entity of integration.entities) {
            const identity = integration.identities.find(item => item.entity === entity.id);
            const position = identity && positions.get(identity.referent);
            if (position) positions.set(entity.id, position);
        }
        const referenceErrors: string[] = [];
        function checkReferences(owner: string, field: string, ids: string[], position: Position) {
            for (const id of ids) {
                const referencedAt = id.startsWith("known:") ? byId.get(id.slice(6))?.availableAt : positions.get(id);
                if (!referencedAt) referenceErrors.push(`${owner}.${field}: reference ${id} is missing or has no valid local identity`);
                else if (comparePosition(referencedAt, position) > 0) referenceErrors.push(`${owner}.${field} at ${position.chapter}:${position.paragraph} references ${id}, available only at ${referencedAt.chapter}:${referencedAt.paragraph}`);
            }
        }
        for (const item of integration.identities) checkReferences(item.id, "identity/evidence", [item.referent, item.entity, ...item.evidence], at(item.at));
        for (const item of integration.times) checkReferences(item.id, "time constraints", [...item.before, ...item.after], at(item.at));
        for (const item of integration.facts) {
            checkReferences(item.id, "fact dependencies", [item.predicate, ...item.arguments.flatMap(argument => argument.value.type === "ref" ? [argument.value.id] : []), ...(item.assertion.holder ? [item.assertion.holder] : []), ...(item.time ? [item.time] : []), ...item.conditions, ...item.exceptions, ...item.identities, ...item.proof.premises], at(item.at));
            const identityCandidates = [
                ...integration.identities.map(identity => ({id: identity.id, entity: identity.entity, decision: identity.decision, availableAt: at(identity.at)})),
                ...[...byId.values()].flatMap(node => node.kind === "resolution" ? [{id: `known:${node.id}`, entity: `known:${node.data.entity.id}`, decision: node.data.decision, availableAt: node.availableAt}] : []),
            ];
            const roles = item.arguments.flatMap(argument => {
                if (argument.value.type !== "ref") return [];
                const id = argument.value.id;
                const entity = id.startsWith("known:") ? byId.get(id.slice(6))?.kind === "entity" : integration.entities.some(entity => entity.id === id);
                return entity ? [{role: `arguments.${argument.role}`, entity: id}] : [];
            });
            if (item.assertion.holder) {
                const holder = item.assertion.holder;
                const holderIsEntity = holder.startsWith("known:") ? byId.get(holder.slice(6))?.kind === "entity" : integration.entities.some(entity => entity.id === holder);
                if (!holderIsEntity) referenceErrors.push(`${item.id}.assertion.holder=${holder} must be a persistent entity ID, not a referent or identity ID; candidate local mappings=${JSON.stringify(integration.identities.filter(identity => identity.referent === holder).map(identity => ({identity: identity.id, entity: identity.entity})))}.`);
                else roles.push({role: "assertion.holder", entity: holder});
            }
            for (const role of roles) {
                const eligible = identityCandidates.filter(identity => identity.entity === role.entity && identity.decision === "same" && comparePosition(identity.availableAt, at(item.at)) <= 0);
                if (!eligible.some(identity => item.identities.includes(identity.id))) referenceErrors.push(`${item.id}.identities lacks explicit identity for ${role.role}=${role.entity} at ${accepted.chapter}:${item.at}; provided=${JSON.stringify(item.identities)}; local eligible IDs=${JSON.stringify(eligible.filter(identity => !identity.id.startsWith("known:")).map(identity => identity.id))}. Include the holder identity as well as every entity argument identity.`);
            }
        }
        for (const item of integration.arguments) checkReferences(item.id, "argument target/premises", [item.target, ...item.proof.premises], at(item.at));
        for (const item of integration.access) checkReferences(item.id, "access target/evidence", [item.target, item.holder, ...item.evidence], at(item.at));
        for (const item of integration.episodes) checkReferences(item.id, "episode dependencies", [...item.participants, ...item.materials, ...item.children, ...item.relations.flatMap(relation => [relation.target, ...relation.evidence]), ...(item.time ? [item.time] : []), ...item.proof.premises], at(item.at));
        for (const item of integration.summaries) checkReferences(item.id, "summary evidence", [item.entity, ...item.items.flatMap(entry => entry.refs)], at(source.paragraphs.length));
        if (referenceErrors.length) throw new Error(`Integration references invalid:\n${referenceErrors.join("\n")}`);

        for (const item of material.referents) {
            const ordered = [...item.mentions].sort((a, b) => a.paragraph - b.paragraph || a.occurrence - b.occurrence);
            const mentionRefs = ordered.map((_, index) => ref(`${prefix}${item.id}:mention:${index + 1}`));
            add("referent", resolve(item.id), ordered[0]!.text, at(ordered[0]!.paragraph), [], [], {localName: ordered[0]!.text, mentions: mentionRefs, splitFrom: null});
            ordered.forEach((mention, index) => {
                const text = source.paragraphs[mention.paragraph - 1];
                if (!text) throw new Error(`Mention paragraph missing ${item.id}`);
                let start = -1;
                for (let occurrence = 0; occurrence <= mention.occurrence; occurrence++) {
                    start = text.indexOf(mention.text, start + 1);
                    if (start < 0) throw new Error(`Exact mention missing ${item.id}:${mention.paragraph}:${mention.text}`);
                }
                const span = {sourceId: source.id, sourceRevision: source.revision, paragraph: mention.paragraph, start, end: start + mention.text.length};
                add("mention", mentionRefs[index]!.id, mention.text, at(mention.paragraph), [span], [], {referent: ref(resolve(item.id)), text: mention.text, span});
            });
        }
        for (const item of integration.entities) {
            const identity = integration.identities.find(identity => identity.entity === item.id);
            if (!identity) throw new Error(`Entity lacks local identity ${item.id}`);
            const local = requireNode(resolve(identity.referent));
            if (local.kind !== "referent") throw new Error(`Identity requires referent ${item.id}`);
            const mention = requireNode(local.data.mentions[0]!.id);
            add("entity", resolve(item.id), local.label, local.availableAt, mention.spans, [], {category: item.category, identityNote: "持续指称入口；属性与身份以有依据记录为准。", names: []});
        }
        for (const item of material.disclosures) add("disclosure", resolve(item.id), item.text, at(item.to), spans(item.from, item.to), [], {text: item.text, channel: item.channel, mode: item.mode, attribution: [{channel: item.channel, holder: item.holder ? ref(resolve(item.holder)) : null}], referents: references(item.about), mentionedTime: unspecified});
        for (const item of material.beats) add("beat", resolve(item.id), item.gist, at(item.to), spans(item.from, item.to), [], {gist: item.gist, chapterId: source.chapterId, fromParagraph: item.from, toParagraph: item.to, mode: item.mode, referents: references(item.about), disclosures: material.disclosures.filter(disclosure => disclosure.from >= item.from && disclosure.to <= item.to).map(disclosure => ref(resolve(disclosure.id)))});
        for (const item of integration.identities) {
            const local = requireNode(resolve(item.referent)), entity = requireNode(resolve(item.entity));
            if (local.kind !== "referent" || entity.kind !== "entity") throw new Error(`Invalid identity kinds ${item.id}`);
            const mentions = local.data.mentions.filter(mention => comparePosition(requireNode(mention.id).availableAt, at(item.at)) <= 0);
            if (!mentions.length) throw new Error(`Identity lacks visible mentions ${item.id}`);
            const evidence = [...new Map([...mentions, ...references(item.evidence)].map(ref => [ref.id, ref])).values()];
            const resolution = add("resolution", resolve(item.id), `局部指称归属：${local.label}`, at(item.at), spans(item.at, item.at), evidence, {referent: ref(local.id), entity: ref(entity.id), decision: item.decision, replaces: []});
            support(resolution, `argument:${resolution.id}`, evidence, {premises: [], method: "identity", certainty: item.certainty, rationale: item.rationale}, candidateReviewNote);
            if (item.decision === "same" && item.certainty === "accepted") for (const mentionRef of local.data.mentions) {
                const mention = requireNode(mentionRef.id);
                if (mention.kind !== "mention") throw new Error("Invalid mention kind");
                const draftReferent = material.referents.find(referent => resolve(referent.id) === local.id);
                if (!draftReferent?.mentions.some(item => item.name && item.text === mention.data.text && item.paragraph === mention.availableAt.paragraph)) continue;
                const availableAt = comparePosition(mention.availableAt, resolution.availableAt) > 0 ? mention.availableAt : resolution.availableAt;
                if (!entity.data.names.some(name => name.text === mention.data.text)) entity.data.names.push({text: mention.data.text, availableAt, dependencies: [ref(mention.id), ref(resolution.id)]});
            }
        }
        for (const item of integration.predicates) {
            const firstUse = Math.min(source.paragraphs.length, ...integration.facts.filter(fact => fact.predicate === item.id).map(fact => fact.at));
            add("predicate", resolve(item.id), item.name, at(firstUse), [], [], {name: item.name, definition: item.definition, roles: item.roles, symmetric: item.symmetric, family: item.family});
        }
        for (const item of integration.times) add("time", resolve(item.id), item.description, at(item.at), spans(item.at, item.at), [], {description: item.description, precision: item.precision, constraints: [...item.before.map(id => ({relation: "before" as const, other: ref(resolve(id)), dependencies: []})), ...item.after.map(id => ({relation: "after" as const, other: ref(resolve(id)), dependencies: []}))]});
        const interpretationFor = (entityIds: string[], ids: string[], position: Position): RecordRef[] => {
            const chosen = references(ids);
            const identities = chosen.map(reference => requireNode(reference.id));
            for (const identity of identities) if (identity.kind !== "resolution" || identity.data.decision !== "same" || comparePosition(identity.availableAt, position) > 0) throw new Error(`Invalid interpretation identity ${identity.id}`);
            for (const entityId of new Set(entityIds)) if (!identities.some(identity => identity.kind === "resolution" && identity.data.entity.id === entityId)) throw new Error(`Missing explicit identity for ${entityId}`);
            return chosen;
        };
        const pendingSemantic = [
            ...integration.facts.map(item => ({kind: "fact" as const, item, dependencies: [item.predicate, ...item.arguments.flatMap(argument => argument.value.type === "ref" ? [argument.value.id] : []), ...(item.assertion.holder ? [item.assertion.holder] : []), ...(item.time ? [item.time] : []), ...item.conditions, ...item.exceptions, ...item.identities, ...item.proof.premises]})),
            ...integration.arguments.map(item => ({kind: "argument" as const, item, dependencies: [item.target, ...item.proof.premises]})),
            ...integration.episodes.map(item => ({kind: "episode" as const, item, dependencies: [...item.materials, ...item.participants, ...item.children, ...item.relations.flatMap(relation => [relation.target, ...relation.evidence]), ...(item.time ? [item.time] : []), ...item.proof.premises]})),
            ...integration.access.map(item => ({kind: "access" as const, item, dependencies: [item.holder, item.target, ...item.evidence]})),
        ];
        while (pendingSemantic.length) {
            const index = pendingSemantic.findIndex(record => record.dependencies.every(id => byId.has(resolve(id))));
            if (index < 0) throw new Error(`Semantic dependencies unresolved or cyclic: ${JSON.stringify(pendingSemantic.map(record => ({id: record.item.id, kind: record.kind, missing: record.dependencies.filter(id => !byId.has(resolve(id)))})))}`);
            const record = pendingSemantic.splice(index, 1)[0]!;
            if (record.kind === "fact") {
                const item = record.item;
                const values = item.arguments.map(argument => ({role: argument.role, value: argument.value.type === "ref" ? {type: "ref" as const, ref: ref(resolve(argument.value.id))} : argument.value, anchor: null}));
                for (const argument of values) if (argument.value.type === "ref" && comparePosition(requireNode(argument.value.ref.id).availableAt, at(item.at)) > 0) throw new Error(`Future fact argument ${item.id}:${argument.role}`);
                const entityIds = values.flatMap(argument => argument.value.type === "ref" && requireNode(argument.value.ref.id).kind === "entity" ? [argument.value.ref.id] : []);
                if (item.assertion.holder) {
                    const holder = requireNode(resolve(item.assertion.holder));
                    if (holder.kind !== "entity" || comparePosition(holder.availableAt, at(item.at)) > 0) throw new Error(`Invalid assertion holder ${item.id}`);
                    entityIds.push(holder.id);
                }
                const evidence = references(item.proof.premises);
                const node = add("fact", resolve(item.id), item.text, at(item.at), [], [], {proposition: item.text, predicate: ref(resolve(item.predicate)), arguments: values, polarity: item.polarity, assertion: {...item.assertion, holder: item.assertion.holder ? ref(resolve(item.assertion.holder)) : null}, time: item.time ? {kind: "point", point: ref(resolve(item.time))} : unspecified, qualifiers: {quantifier: item.quantifier, modality: item.modality, conditions: references(item.conditions), textualConditions: item.textualConditions, exceptions: references(item.exceptions)}, interpretationDependencies: interpretationFor(entityIds, item.identities, at(item.at))});
                support(node, `argument:${node.id}`, evidence, item.proof, candidateReviewNote);
            } else if (record.kind === "argument") {
                const item = record.item;
                support(requireNode(resolve(item.target)), resolve(item.id), references(item.proof.premises), item.proof, candidateReviewNote, item.polarity, at(item.at));
            } else if (record.kind === "episode") {
                const item = record.item;
                const materials = references(item.materials);
                const node = add("episode", resolve(item.id), item.title, at(item.at), [], materials, {summary: item.summary, scale: item.scale, participants: item.participants.map(id => ({role: "participant", value: {type: "ref", ref: ref(resolve(id))}, anchor: null})), materials, components: [{role: "title", text: item.title, dependencies: materials}, {role: "step", text: item.summary, dependencies: materials}], children: references(item.children), relations: item.relations.map(relation => ({relation: relation.relation, target: ref(resolve(relation.target)), dependencies: references(relation.evidence)})), time: item.time ? {kind: "point", point: ref(resolve(item.time))} : unspecified});
                support(node, `argument:${node.id}`, references(item.proof.premises), item.proof, candidateReviewNote);
            } else {
                const item = record.item;
                const evidence = references(item.evidence), target = requireNode(resolve(item.target)), holder = requireNode(resolve(item.holder));
                if (holder.kind !== "entity") throw new Error(`Access holder must be entity ${item.id}`);
                if (comparePosition(latest([...evidence, ref(target.id), ref(holder.id)]), at(item.at)) > 0) throw new Error(`Access has future evidence ${item.id}`);
                add("knowledgeAccess", resolve(item.id), `认知依据：${item.mode}`, at(item.at), [], evidence, {target: ref(target.id), holder: ref(holder.id), mode: item.mode, establishedAt: unspecified, evidence});
            }
        }
        const readAt = at(source.paragraphs.length);
        const sourceManifest = `manifest:${hash(JSON.stringify(selectedSources.filter(source => source.chapterOrder <= accepted.chapter).map(source => [source.id, source.sha256]))).slice(0, 16)}`;
        const coverage: MemoryDataset["coverage"] = {through: readAt, chapters: Array.from({length: accepted.chapter}, (_, index) => index + 1), material: "complete", semantic: "partial", gaps: ["LLM 提取与独立复核不保证语义穷尽。", ...chapters.slice(0, accepted.chapter).flatMap(chapter => chapter.integration.gaps)], recordsExhausted: false, corpusClosed: false};
        const arguments_ = nodes.filter((node): node is NodeOf<"argument"> => node.kind === "argument");
        const evaluationPoints = new Map(arguments_.filter(node => node.availableAt.chapter === accepted.chapter).map(node => [`${node.data.conclusion.id}:${node.availableAt.paragraph}`, {target: node.data.conclusion.id, at: node.availableAt}]));
        for (const point of evaluationPoints.values()) {
            const supporting = arguments_.filter(argument => argument.data.conclusion.id === point.target && comparePosition(argument.availableAt, point.at) <= 0);
            const epistemic = aggregateAssessment(supporting.map(argument => argument.data));
            add("assessment", `assessment:${point.target}:at:${point.at.chapter}:${point.at.paragraph}`, `评估：${requireNode(point.target).label}`, point.at, [], [], {target: ref(point.target), arguments: supporting.map(argument => ref(argument.id)), epistemic, note: supporting.map(argument => argument.data.review.note).join("；"), unresolved: epistemic === "accepted" ? [] : supporting.map(argument => argument.data.rationale), evaluatedAt: point.at});
        }
        const partial = {schema: "neurobook.memory.v7" as const, book, snapshot: {id: `compile-${accepted.chapter}`, sourceManifest, knowledgeRevision: accepted.chapter, readAt}, sources: selectedSources.filter(source => source.chapterOrder <= accepted.chapter), nodes, coverage, partitionWatermarks: {material: accepted.chapter, identity: accepted.chapter, interpretation: accepted.chapter}, invalidationRoots: []};
        const evaluated = querySnapshot(createQueryIndex(partial), {...scope, readAt});
        const currentAssessments = new Map(evaluated.nodes.filter((node): node is NodeOf<"assessment"> => node.kind === "assessment").sort((a, b) => comparePosition(a.data.evaluatedAt, b.data.evaluatedAt)).map(node => [node.data.target.id, node]));
        const updatedFacets = new Set<string>();
        for (const item of integration.summaries) {
            const subject = requireNode(resolve(item.entity));
            if (subject.kind !== "entity") throw new Error("Summary subject must be entity");
            const facetKey = `${subject.id}\0${item.facet}`;
            if (updatedFacets.has(facetKey)) throw new Error("Duplicate current summary facet");
            updatedFacets.add(facetKey);
            const dependencies = references([...new Set(item.items.flatMap(item => item.refs))]);
            if (dependencies.some(dependency => requireNode(dependency.id).kind === "entitySummary")) throw new Error("Summary cannot cite another summary as evidence");
            const summaryItems = item.items.map((entry, index) => ({id: `${prefix}${item.id}:item:${index + 1}`, text: entry.text, dependencies: references(entry.refs), readiness: "ready" as const, assessmentBasis: references(entry.refs).flatMap(target => {
                const assessment = currentAssessments.get(target.id);
                return assessment ? [{target, epistemic: assessment.data.epistemic}] : [];
            })}));
            add("entitySummary", resolve(item.id), `${subject.label} · ${item.facet}`, readAt, [], dependencies, {subject: ref(subject.id), facet: item.facet, readAt, story: unspecified, items: summaryItems, coverage, builtFrom: {sourceManifest, knowledgeRevision: accepted.chapter, partitionWatermarks: {material: accepted.chapter, identity: accepted.chapter, interpretation: accepted.chapter}}});
        }
        const changedEntities = new Set(integration.identities.map(identity => resolve(identity.entity)));
        for (const fact of integration.facts) for (const argument of fact.arguments) if (argument.value.type === "ref" && byId.get(resolve(argument.value.id))?.kind === "entity") changedEntities.add(resolve(argument.value.id));
        const priorSummaries = nodes.filter((node): node is NodeOf<"entitySummary"> => node.kind === "entitySummary" && node.availableAt.chapter < accepted.chapter).sort((a, b) => comparePosition(b.availableAt, a.availableAt));
        const rejectedSummaries = new Set(chapters.flatMap(chapter => chapter.integration.summaries
            .filter(summary => chapter.review.judgments.some(judgment => judgment.id === `semantic:${summary.id}` && judgment.verdict === "rejected"))
            .map(summary => `c${String(chapter.chapter).padStart(2, "0")}:${summary.id}`)));
        const visibleIds = new Set(evaluated.nodes.map(node => node.id));
        for (const prior of priorSummaries) {
            const key = `${prior.data.subject.id}\0${prior.data.facet}`;
            if (updatedFacets.has(key) || changedEntities.has(prior.data.subject.id)) continue;
            updatedFacets.add(key);
            if (rejectedSummaries.has(prior.id)) continue;
            const unchanged = prior.data.items.every(item => item.dependencies.every(dependency => visibleIds.has(dependency.id)) && item.assessmentBasis.every(basis => currentAssessments.get(basis.target.id)?.data.epistemic === basis.epistemic));
            if (!unchanged) continue;
            add("entitySummary", `${prefix}summary-reuse-${hash(key).slice(0, 16)}`, prior.label, readAt, [], prior.dependencies, {...prior.data, readAt, coverage, builtFrom: {sourceManifest, knowledgeRevision: accepted.chapter, partitionWatermarks: {material: accepted.chapter, identity: accepted.chapter, interpretation: accepted.chapter}}});
        }
    }
    const revision = chapters.length;
    // Each immutable published snapshot owns one coherent record generation, including cyclic references.
    for (const node of nodes) {
        node.revision = revision;
        function updateRefs(value: unknown): void {
            if (!value || typeof value !== "object") return;
            if ("id" in value && "revision" in value && Object.keys(value).length === 2) { value.revision = revision; return; }
            for (const child of Object.values(value)) updateRefs(child);
        }
        updateRefs(node.data); updateRefs(node.dependencies);
    }
    const finalSource = selectedSources.at(-1)!;
    const readAt = {chapter: revision, paragraph: finalSource.paragraphs.length};
    const sourceManifest = `manifest:${hash(JSON.stringify(selectedSources.map(source => [source.id, source.sha256]))).slice(0, 16)}`;
    const dataset = parseDataset({schema: "neurobook.memory.v7", book, snapshot: {id: `llm-through-${revision}`, sourceManifest, knowledgeRevision: revision, readAt}, sources: selectedSources, nodes, coverage: {through: readAt, chapters: chapters.map(chapter => chapter.chapter), material: "complete", semantic: "partial", gaps: ["LLM 提取与独立复核不保证语义穷尽。", ...chapters.flatMap(chapter => chapter.integration.gaps)], recordsExhausted: false, corpusClosed: false}, partitionWatermarks: {material: revision, identity: revision, interpretation: revision}, invalidationRoots: []});
    const projection = querySnapshot(createQueryIndex(dataset), {...scope, readAt});
    const visible = new Set(projection.nodes.map(node => node.id));
    const currentIds = new Set(nodes.filter(node => node.availableAt.chapter === revision).map(node => node.id));
    const hidden = [...currentIds].filter(id => !visible.has(id));
    if (hidden.length) throw new Error(`Compiled current records unexpectedly unavailable: ${hidden.join(", ")}`);
    for (const node of dataset.nodes) for (const target of collectReferences(node.data)) if (!byId.has(target.id)) throw new Error(`Unknown compiled reference ${target.id}`);
    return purpose === "publish" ? applyPublicationReview(dataset, chapters) : dataset;
}
