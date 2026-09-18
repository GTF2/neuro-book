import {mkdir, readFile, rename, rm, writeFile} from "node:fs/promises";
import {join} from "node:path";
import type {AbsoluteFsPath} from "nbook/server/runtime/paths/file-path";
import type {WorkspaceFileNode} from "nbook/server/workspace-files/workspace-files";
import type {WorldSubjectListItem} from "nbook/server/world-engine/types";
import type {ChapterProseNode} from "nbook/server/plot/services/chapter-prose.service";
import type {
    ChapterPlotDetailDto,
    PlotTreeDto,
    WorldAnchorSuggestion,
    WorldAnchorSuggestionAppliedScene,
    WorldAnchorSuggestionConfirmResult,
    WorldAnchorSuggestionGenerateResult,
    WorldAnchorSuggestionRejectResult,
    WorldAnchorSuggestionStore,
} from "nbook/shared/dto/plot.dto";
import {WorldAnchorSuggestionStoreDtoSchema} from "nbook/shared/dto/plot.dto";

/**
 * T0.5 存量项目 worldAnchor 半自动补齐。
 *
 * 该服务只从正文生成待确认建议。确认动作由调用方显式发起；调用方必须保证单条建议的
 * Scene 写入在同一事务中完成，任何 Scene 失败都不能把建议标为已确认。
 */

export const WORLD_ANCHOR_SUGGESTION_STORE_RELATIVE_PATH = ".nbook/world-anchor-suggestions.json";

/** 2 字名至少出现 2 次才建议；3 字及以上出现 1 次即建议；单字名不参与。 */
const MIN_OCCURRENCES_FOR_SHORT_NAME = 2;
const SHORT_NAME_MAX_LENGTH = 2;
const EXCLUDED_SUBJECT_TYPES = new Set(["world"]);
const NAME_STOP_LIST = new Set(["世界"]);

type TimeEstimate = NonNullable<WorldAnchorSuggestion["timeEstimate"]>;

export type SubjectNameRegistryEntry = {
    subjectId: string;
    type: string;
    resolved: boolean;
    source: "world-subject" | "lorebook";
    names: string[];
    display: string;
};

type RegistryReport = {
    entries: SubjectNameRegistryEntry[];
    ambiguousLorebookCandidates: Array<{subjectId: string; names: string[]}>;
};

export type WorldAnchorSuggestionPorts = {
    listWorldSubjects(): Promise<WorldSubjectListItem[]>;
    listLorebookNodes(): Promise<WorkspaceFileNode[]>;
    getPlotTree(): Promise<PlotTreeDto>;
    getChapterScenes(chapterId: number): Promise<ChapterPlotDetailDto>;
    findProseForChapter(chapterName: string): Promise<ChapterProseNode[]>;
    /** 存量正文的无指针候选；生成时只接受与章节标题精确且唯一匹配的节点。 */
    listLegacyProseNodes(): Promise<ChapterProseNode[]>;
    readProse(indexPath: string): Promise<string | null>;
    readStore(): Promise<WorldAnchorSuggestionStore>;
    writeStore(store: WorldAnchorSuggestionStore): Promise<void>;
    /** 单条建议内所有 Scene 必须原子写入；失败时抛错且不留下部分写入。 */
    applySuggestion(input: {
        chapterId: number;
        subjectIds: string[];
        locationSubjectId: string | null;
        startInstant: bigint | null;
    }): Promise<WorldAnchorSuggestionAppliedScene[]>;
    now(): Date;
};

/**
 * 构建名字→subject 注册表。World Engine subject 优先；Lorebook 只接受有效 active 的
 * character/location 条目。目录 basename 重名的 Lorebook 候选不进入自动建议，避免将
 * 两个不同设定写进同一 unresolved subjectId。
 */
export function buildSubjectNameRegistry(
    worldSubjects: WorldSubjectListItem[],
    lorebookNodes: WorkspaceFileNode[],
): SubjectNameRegistryEntry[] {
    return buildSubjectNameRegistryReport(worldSubjects, lorebookNodes).entries;
}

/** 从正文识别建议锚点证据。 */
export function detectChapterAnchorEvidence(
    prose: string,
    registry: SubjectNameRegistryEntry[],
): WorldAnchorSuggestion["evidence"] {
    const evidenceBySubject = new Map<string, WorldAnchorSuggestion["evidence"][number]>();
    for (const entry of registry) {
        let best: {name: string; occurrences: number} | null = null;
        for (const name of entry.names) {
            const occurrences = countOccurrences(prose, name);
            if (occurrences === 0) {
                continue;
            }
            if (passesOccurrenceThreshold(name, occurrences) && (!best || occurrences > best.occurrences)) {
                best = {name, occurrences};
            }
        }
        if (!best) {
            continue;
        }
        const existing = evidenceBySubject.get(entry.subjectId);
        if (!existing || best.occurrences > existing.occurrences) {
            evidenceBySubject.set(entry.subjectId, {
                subjectId: entry.subjectId,
                name: best.name,
                type: entry.type,
                occurrences: best.occurrences,
                resolved: entry.resolved,
                source: entry.source,
            });
        }
    }
    return [...evidenceBySubject.values()].sort((left, right) => {
        if (left.occurrences !== right.occurrences) {
            return right.occurrences - left.occurrences;
        }
        return left.subjectId.localeCompare(right.subjectId);
    });
}

/**
 * 重新生成 pending 建议。既有队列历史和未决建议均保留；只追加未与未决建议重复的新候选。
 */
export async function generateWorldAnchorSuggestions(ports: WorldAnchorSuggestionPorts): Promise<WorldAnchorSuggestionGenerateResult> {
    const [worldSubjects, lorebookNodes, tree, store] = await Promise.all([
        ports.listWorldSubjects(),
        ports.listLorebookNodes(),
        ports.getPlotTree(),
        ports.readStore(),
    ]);
    const registryReport = buildSubjectNameRegistryReport(worldSubjects, lorebookNodes);
    const chapters = orderedChapters(tree);
    const legacyProseNodes = await ports.listLegacyProseNodes();
    const legacyProseByChapterName = groupLegacyProseByChapterName(legacyProseNodes);
    const legacyProseByTitle = groupLegacyProseByTitle(legacyProseNodes);
    const existingUnresolved = new Set(store.suggestions
        .filter((suggestion) => suggestion.status === "pending" || suggestion.status === "applying")
        .map(suggestionFingerprint));
    const pending: WorldAnchorSuggestion[] = [];
    const createdAt = ports.now().toISOString();
    const skippedDetails: WorldAnchorSuggestionGenerateResult["skippedDetails"] = [];
    const failedDetails: WorldAnchorSuggestionGenerateResult["failedDetails"] = [];
    let lastKnownInstant: {instant: string; chapterTitle: string} | null = null;

    for (const {chapter} of chapters) {
        const detail = await ports.getChapterScenes(Number(chapter.id));
        const activeScenes = detail.scenes.filter((scene) => scene.status !== "archived");
        if (activeScenes.length === 0) {
            skippedDetails.push(generateIssue(chapter, "no_active_scene", "该章节没有可写入的 active Scene。"));
            continue;
        }

        const pointedProseNodes = await ports.findProseForChapter(chapter.name);
        const structuredLegacyProseNodes = legacyProseByChapterName.get(chapter.name) ?? [];
        const proseNodes = pointedProseNodes.length > 0
            ? pointedProseNodes
            : structuredLegacyProseNodes.length > 0
                ? structuredLegacyProseNodes
                : legacyProseByTitle.get(chapter.title) ?? [];
        if (proseNodes.length === 0) {
            failedDetails.push(generateIssue(chapter, "no_matching_prose", "未找到与该章节匹配的正文。"));
            lastKnownInstant = advanceLastKnownInstant(activeScenes, chapter.title, lastKnownInstant);
            continue;
        }
        if (proseNodes.length > 1) {
            failedDetails.push(generateIssue(chapter, "ambiguous_prose_candidates", "匹配到多个正文候选，无法安全消歧。"));
            lastKnownInstant = advanceLastKnownInstant(activeScenes, chapter.title, lastKnownInstant);
            continue;
        }
        const proseNode = proseNodes[0];
        if (!proseNode) {
            failedDetails.push(generateIssue(chapter, "no_matching_prose", "未找到与该章节匹配的正文。"));
            lastKnownInstant = advanceLastKnownInstant(activeScenes, chapter.title, lastKnownInstant);
            continue;
        }
        const prose = await ports.readProse(proseNode.indexPath);
        if (prose === null) {
            failedDetails.push(generateIssue(chapter, "no_matching_prose", "匹配的正文无法读取。"));
            lastKnownInstant = advanceLastKnownInstant(activeScenes, chapter.title, lastKnownInstant);
            continue;
        }
        if (prose.trim().length === 0) {
            failedDetails.push(generateIssue(chapter, "empty_prose", "匹配的正文为空。"));
            lastKnownInstant = advanceLastKnownInstant(activeScenes, chapter.title, lastKnownInstant);
            continue;
        }

        const evidence = detectChapterAnchorEvidence(prose, registryReport.entries);
        const subjectIds = evidence
            .filter((item) => item.type !== "location")
            .map((item) => item.subjectId);
        const locationSubjectId = evidence.find((item) => item.type === "location")?.subjectId ?? null;
        const timeEstimate = lastKnownInstant === null
            ? null
            : {
                startInstant: lastKnownInstant.instant,
                reason: `沿用《${lastKnownInstant.chapterTitle}》已确认锚点的最晚时刻；仅供人工复核。`,
            } satisfies TimeEstimate;

        if (!hasMissingAnchorField(activeScenes, subjectIds, locationSubjectId, timeEstimate)) {
            skippedDetails.push(generateIssue(chapter, "anchor_complete", "该章节的 active Scene 锚点已完整。"));
            lastKnownInstant = advanceLastKnownInstant(activeScenes, chapter.title, lastKnownInstant);
            continue;
        }
        if (evidence.length === 0 && timeEstimate === null) {
            skippedDetails.push(generateIssue(chapter, "no_anchor_evidence", "正文中没有可用于补齐 worldAnchor 的主体或时间证据。"));
            lastKnownInstant = advanceLastKnownInstant(activeScenes, chapter.title, lastKnownInstant);
            continue;
        }

        const notes: string[] = [];
        if (evidence.some((item) => !item.resolved)) {
            notes.push("部分建议是尚未接入 World Engine 的 Lorebook 占位 subject；确认后会以 unresolved 占位写入。");
        }
        if (pointedProseNodes.length === 0 && structuredLegacyProseNodes.length > 0) {
            notes.push("该章未配置 chapter 指针，按卷/章节目录键精确匹配到唯一存量正文；未回写正文元数据。");
        } else if (pointedProseNodes.length === 0) {
            notes.push("该章未配置 chapter 指针，按章节标题精确匹配到唯一存量正文；未回写正文元数据。");
        }
        const ambiguousIds = registryReport.ambiguousLorebookCandidates
            .filter((candidate) => candidate.names.some((name) => prose.includes(name)))
            .map((candidate) => candidate.subjectId);
        if (ambiguousIds.length > 0) {
            notes.push(`已跳过 ${ambiguousIds.join("、")} 等重名 Lorebook 目录候选，需人工补全 World subject 后再确认。`);
        }

        const candidate: WorldAnchorSuggestion = {
            suggestionId: `was-${String(store.nextSeq + pending.length)}`,
            chapterId: chapter.id,
            chapterName: chapter.name,
            chapterTitle: chapter.title,
            chapterPath: proseNode.path,
            sceneCount: activeScenes.length,
            subjectIds,
            locationSubjectId,
            timeEstimate,
            evidence,
            note: notes.length === 0 ? null : notes.join(" "),
            status: "pending",
            createdAt,
            resolvedAt: null,
        };
        const fingerprint = suggestionFingerprint(candidate);
        if (!existingUnresolved.has(fingerprint)) {
            existingUnresolved.add(fingerprint);
            pending.push(candidate);
        }
        lastKnownInstant = advanceLastKnownInstant(activeScenes, chapter.title, lastKnownInstant);
    }

    const nextStore: WorldAnchorSuggestionStore = {
        version: "world-anchor-suggestions-v1",
        nextSeq: store.nextSeq + pending.length,
        suggestions: [...store.suggestions, ...pending],
    };
    await ports.writeStore(nextStore);
    return {
        generated: pending.length,
        skipped: skippedDetails.length,
        failed: failedDetails.length,
        skippedDetails,
        failedDetails,
        store: nextStore,
    };
}

/**
 * 显式确认建议。每条建议先持久化为 applying，再写入 Scene，最后收口为 confirmed。
 *
 * 建议队列与 SQLite 不能共用事务；如果 Scene 已提交而最终队列写入失败，持久化的 applying
 * 状态会保留恢复线索。下一次确认会幂等重新合并并尝试收口，而不会把已写入结果伪装为 pending。
 */
export async function confirmWorldAnchorSuggestions(
    ports: WorldAnchorSuggestionPorts,
    input: {suggestionIds: string[]},
): Promise<WorldAnchorSuggestionConfirmResult> {
    let store = await ports.readStore();
    const missingSuggestionIds: string[] = [];
    const outcomes: WorldAnchorSuggestionConfirmResult["outcomes"] = [];

    for (const suggestionId of new Set(input.suggestionIds)) {
        const suggestion = store.suggestions.find((item) => item.suggestionId === suggestionId);
        if (!suggestion) {
            missingSuggestionIds.push(suggestionId);
            continue;
        }
        if (suggestion.status === "confirmed" || suggestion.status === "rejected") {
            outcomes.push({
                suggestionId,
                status: "skipped",
                reason: `建议当前状态是 ${suggestion.status}，不能再次确认。`,
                appliedScenes: [],
            });
            continue;
        }

        const enteredAsApplying = suggestion.status === "applying";
        if (suggestion.status === "pending") {
            const applyingStore = replaceSuggestion(store, suggestionId, {
                ...suggestion,
                status: "applying",
                resolvedAt: null,
            });
            try {
                await ports.writeStore(applyingStore);
                store = applyingStore;
            } catch (error) {
                outcomes.push({
                    suggestionId,
                    status: "failed",
                    reason: `确认前无法写入 applying 状态：${errorMessage(error)}`,
                    appliedScenes: [],
                });
                continue;
            }
        }

        const applyingSuggestion = store.suggestions.find((item) => item.suggestionId === suggestionId);
        if (!applyingSuggestion || applyingSuggestion.status !== "applying") {
            outcomes.push({
                suggestionId,
                status: "failed",
                reason: "建议队列状态在确认过程中发生变化，请重新读取后再确认。",
                appliedScenes: [],
            });
            continue;
        }

        let appliedScenes: WorldAnchorSuggestionAppliedScene[];
        try {
            appliedScenes = await ports.applySuggestion({
                chapterId: Number(applyingSuggestion.chapterId),
                subjectIds: applyingSuggestion.subjectIds,
                locationSubjectId: applyingSuggestion.locationSubjectId,
                startInstant: applyingSuggestion.timeEstimate === null ? null : BigInt(applyingSuggestion.timeEstimate.startInstant),
            });
        } catch (error) {
            if (enteredAsApplying) {
                outcomes.push({
                    suggestionId,
                    status: "failed",
                    reason: `${errorMessage(error)}；建议已处于 applying，保留恢复线索，请重试确认。`,
                    appliedScenes: [],
                });
                continue;
            }
            const pendingStore = replaceSuggestion(store, suggestionId, {
                ...applyingSuggestion,
                status: "pending",
                resolvedAt: null,
            });
            try {
                await ports.writeStore(pendingStore);
                store = pendingStore;
                outcomes.push({suggestionId, status: "failed", reason: errorMessage(error), appliedScenes: []});
            } catch (restoreError) {
                outcomes.push({
                    suggestionId,
                    status: "failed",
                    reason: `${errorMessage(error)}；恢复 pending 状态失败，建议保持 applying，请重试确认。${errorMessage(restoreError)}`,
                    appliedScenes: [],
                });
            }
            continue;
        }

        const confirmedStore = replaceSuggestion(store, suggestionId, {
            ...applyingSuggestion,
            status: "confirmed",
            resolvedAt: ports.now().toISOString(),
        });
        try {
            await ports.writeStore(confirmedStore);
            store = confirmedStore;
            outcomes.push({suggestionId, status: "confirmed", appliedScenes});
        } catch (error) {
            outcomes.push({
                suggestionId,
                status: "failed",
                reason: `Scene 已合并，但无法写入 confirmed 状态；建议保持 applying，请重试确认完成收口。${errorMessage(error)}`,
                appliedScenes: [],
            });
        }
    }

    return {outcomes, missingSuggestionIds, store};
}

/** 拒绝建议只更新建议状态，不触碰任何 Scene。 */
export async function rejectWorldAnchorSuggestions(
    ports: WorldAnchorSuggestionPorts,
    input: {suggestionIds: string[]},
): Promise<WorldAnchorSuggestionRejectResult> {
    const store = await ports.readStore();
    const requested = new Set(input.suggestionIds);
    const known = new Set(store.suggestions.map((suggestion) => suggestion.suggestionId));
    const resolvedAt = ports.now().toISOString();
    const outcomes: WorldAnchorSuggestionRejectResult["outcomes"] = [];
    const suggestions = store.suggestions.map((suggestion) => {
        if (!requested.has(suggestion.suggestionId)) {
            return suggestion;
        }
        if (suggestion.status !== "pending") {
            outcomes.push({suggestionId: suggestion.suggestionId, status: "skipped", reason: `建议当前状态是 ${suggestion.status}。`});
            return suggestion;
        }
        outcomes.push({suggestionId: suggestion.suggestionId, status: "rejected"});
        return {...suggestion, status: "rejected" as const, resolvedAt};
    });
    const nextStore: WorldAnchorSuggestionStore = {...store, suggestions};
    await ports.writeStore(nextStore);
    return {
        outcomes,
        missingSuggestionIds: [...requested].filter((suggestionId) => !known.has(suggestionId)),
        store: nextStore,
    };
}

/** 读取建议队列；只有文件不存在才返回空队列，损坏或 I/O 失败必须显式上抛。 */
export async function readWorldAnchorSuggestionStore(projectRoot: AbsoluteFsPath): Promise<WorldAnchorSuggestionStore> {
    try {
        const text = await readFile(join(projectRoot, WORLD_ANCHOR_SUGGESTION_STORE_RELATIVE_PATH), "utf-8");
        return WorldAnchorSuggestionStoreDtoSchema.parse(JSON.parse(text));
    } catch (error) {
        if (isErrorWithCode(error, "ENOENT")) {
            return emptyStore();
        }
        throw new Error(`读取 worldAnchor 建议队列失败：${errorMessage(error)}`, {cause: error});
    }
}

/** 原子写建议队列；写入前再次校验，避免损坏文件进入项目状态。 */
export async function writeWorldAnchorSuggestionStore(projectRoot: AbsoluteFsPath, store: WorldAnchorSuggestionStore): Promise<void> {
    const validated = WorldAnchorSuggestionStoreDtoSchema.parse(store);
    const targetPath = join(projectRoot, WORLD_ANCHOR_SUGGESTION_STORE_RELATIVE_PATH);
    const temporaryPath = join(projectRoot, ".nbook", `.world-anchor-suggestions.${String(process.pid)}.${String(Date.now())}.tmp`);
    await mkdir(join(projectRoot, ".nbook"), {recursive: true});
    try {
        await writeFile(temporaryPath, `${JSON.stringify(validated, null, 2)}\n`, "utf-8");
        await rename(temporaryPath, targetPath);
    } finally {
        await rm(temporaryPath, {force: true}).catch(() => undefined);
    }
}

function buildSubjectNameRegistryReport(
    worldSubjects: WorldSubjectListItem[],
    lorebookNodes: WorkspaceFileNode[],
): RegistryReport {
    const byId = new Map<string, SubjectNameRegistryEntry>();
    for (const subject of worldSubjects) {
        if (EXCLUDED_SUBJECT_TYPES.has(subject.type)) {
            continue;
        }
        const names = collectNames([subject.name]);
        if (names.length === 0) {
            continue;
        }
        byId.set(subject.id, {
            subjectId: subject.id,
            type: subject.type,
            resolved: true,
            source: "world-subject",
            names,
            display: subject.name || subject.id,
        });
    }

    const lorebookCandidates = new Map<string, Array<{type: "character" | "location"; names: string[]; display: string}>>();
    for (const node of lorebookNodes) {
        if (!isActiveLorebookAnchorCandidate(node)) {
            continue;
        }
        const subjectId = node.path.replace(/\/+$/, "").split("/").at(-1) ?? "";
        const rawNames = [
            typeof node.frontmatter.title === "string" ? node.frontmatter.title : "",
            ...(Array.isArray(node.frontmatter.aliases) ? node.frontmatter.aliases.filter((alias): alias is string => typeof alias === "string") : []),
        ];
        const names = collectNames(rawNames);
        if (!subjectId || names.length === 0) {
            continue;
        }
        const type = (typeof node.frontmatter.type === "string" ? node.frontmatter.type : node.entryType) as "character" | "location";
        const candidates = lorebookCandidates.get(subjectId) ?? [];
        candidates.push({
            type,
            names,
            display: rawNames.find((name) => name.trim().length > 0)?.trim() || subjectId,
        });
        lorebookCandidates.set(subjectId, candidates);
    }

    const ambiguousLorebookCandidates: Array<{subjectId: string; names: string[]}> = [];
    for (const [subjectId, candidates] of lorebookCandidates) {
        if (byId.has(subjectId)) {
            continue;
        }
        if (candidates.length !== 1) {
            ambiguousLorebookCandidates.push({
                subjectId,
                names: candidates.flatMap((candidate) => candidate.names),
            });
            continue;
        }
        const candidate = candidates[0];
        if (!candidate) {
            continue;
        }
        byId.set(subjectId, {
            subjectId,
            type: candidate.type,
            resolved: false,
            source: "lorebook",
            names: candidate.names,
            display: candidate.display,
        });
    }
    return {
        entries: [...byId.values()],
        ambiguousLorebookCandidates: ambiguousLorebookCandidates.sort((left, right) => left.subjectId.localeCompare(right.subjectId)),
    };
}

function isActiveLorebookAnchorCandidate(node: WorkspaceFileNode): boolean {
    if (!node.isDirectory || !node.contentNode || node.frontmatterError !== null || node.status !== "active" || !node.path.startsWith("lorebook/")) {
        return false;
    }
    if (node.frontmatter.subtype === "directory-index") {
        return false;
    }
    const type = typeof node.frontmatter.type === "string" ? node.frontmatter.type : node.entryType;
    return type === "character" || type === "location";
}

function orderedChapters(tree: PlotTreeDto): Array<{chapter: PlotTreeDto["acts"][number]["chapters"][number]; actSortOrder: number}> {
    return [
        ...tree.acts.flatMap((act) => act.chapters.map((chapter) => ({chapter, actSortOrder: act.sortOrder}))),
        ...tree.ungroupedChapters.map((chapter) => ({chapter, actSortOrder: Number.MAX_SAFE_INTEGER})),
    ].sort((left, right) => {
        if (left.actSortOrder !== right.actSortOrder) {
            return left.actSortOrder - right.actSortOrder;
        }
        if (left.chapter.sortOrder !== right.chapter.sortOrder) {
            return left.chapter.sortOrder - right.chapter.sortOrder;
        }
        return left.chapter.name.localeCompare(right.chapter.name);
    });
}

function groupLegacyProseByChapterName(nodes: ChapterProseNode[]): Map<string, ChapterProseNode[]> {
    const byChapterName = new Map<string, ChapterProseNode[]>();
    for (const node of nodes) {
        const match = node.path.match(/^manuscript\/(\d{3})-[^/]+\/(\d{3})-chapter$/u);
        if (!match) {
            continue;
        }
        const volume = Number(match[1]);
        const chapter = Number(match[2]);
        if (!Number.isSafeInteger(volume) || !Number.isSafeInteger(chapter) || volume <= 0 || chapter <= 0) {
            continue;
        }
        const chapterName = `vol-${String(volume).padStart(2, "0")}-ch-${String(chapter).padStart(2, "0")}`;
        const entries = byChapterName.get(chapterName) ?? [];
        entries.push(node);
        byChapterName.set(chapterName, entries);
    }
    return byChapterName;
}

function groupLegacyProseByTitle(nodes: ChapterProseNode[]): Map<string, ChapterProseNode[]> {
    const byTitle = new Map<string, ChapterProseNode[]>();
    for (const node of nodes) {
        const title = node.title.trim();
        if (!title) {
            continue;
        }
        const entries = byTitle.get(title) ?? [];
        entries.push(node);
        byTitle.set(title, entries);
    }
    return byTitle;
}

function hasMissingAnchorField(
    scenes: ChapterPlotDetailDto["scenes"],
    subjectIds: string[],
    locationSubjectId: string | null,
    timeEstimate: TimeEstimate | null,
): boolean {
    return scenes.some((scene) => (
        subjectIds.some((subjectId) => !scene.worldAnchor.subjectIds.includes(subjectId))
        || (scene.worldAnchor.locationSubjectId === null && locationSubjectId !== null)
        || (scene.worldAnchor.startInstant === null && timeEstimate !== null)
    ));
}

function suggestionFingerprint(suggestion: WorldAnchorSuggestion): string {
    return JSON.stringify({
        chapterId: suggestion.chapterId,
        subjectIds: [...suggestion.subjectIds].sort(),
        locationSubjectId: suggestion.locationSubjectId,
        startInstant: suggestion.timeEstimate?.startInstant ?? null,
        evidence: suggestion.evidence.map((item) => ({
            subjectId: item.subjectId,
            name: item.name,
            type: item.type,
            occurrences: item.occurrences,
            resolved: item.resolved,
            source: item.source,
        })),
    });
}

function generateIssue(
    chapter: {id: string; title: string},
    reason: WorldAnchorSuggestionGenerateResult["failedDetails"][number]["reason"],
    message: string,
): WorldAnchorSuggestionGenerateResult["failedDetails"][number] {
    return {chapterId: chapter.id, chapterTitle: chapter.title, reason, message};
}

function replaceSuggestion(
    store: WorldAnchorSuggestionStore,
    suggestionId: string,
    replacement: WorldAnchorSuggestion,
): WorldAnchorSuggestionStore {
    return {
        ...store,
        suggestions: store.suggestions.map((suggestion) => suggestion.suggestionId === suggestionId ? replacement : suggestion),
    };
}

function emptyStore(): WorldAnchorSuggestionStore {
    return {version: "world-anchor-suggestions-v1", nextSeq: 1, suggestions: []};
}

function collectNames(rawNames: string[]): string[] {
    const names = new Set<string>();
    for (const raw of rawNames) {
        const trimmed = raw.trim();
        if (trimmed.length >= 2 && !NAME_STOP_LIST.has(trimmed)) {
            names.add(trimmed);
        }
        for (const alias of extractParenNames(trimmed)) {
            if (alias.length >= 2 && !NAME_STOP_LIST.has(alias)) {
                names.add(alias);
            }
        }
    }
    return [...names];
}

/** 拆出全角/半角括号内别名，例如“芥末（郭紫莉）”。 */
export function extractParenNames(name: string): string[] {
    const results: string[] = [];
    const parentheses = /[（(]([^（()）]+)[)）]/gu;
    for (const match of name.matchAll(parentheses)) {
        const inner = (match[1] ?? "").trim();
        if (inner.length > 0) {
            results.push(inner);
        }
    }
    const outer = name.replace(/[（(][^（()）]+[)）]/gu, "").trim();
    if (outer.length > 0) {
        results.push(outer);
    }
    return results;
}

/** 非重叠出现次数。 */
export function countOccurrences(text: string, name: string): number {
    if (!name) {
        return 0;
    }
    let count = 0;
    let index = text.indexOf(name);
    while (index >= 0) {
        count += 1;
        index = text.indexOf(name, index + name.length);
    }
    return count;
}

function passesOccurrenceThreshold(name: string, occurrences: number): boolean {
    return name.length <= SHORT_NAME_MAX_LENGTH
        ? occurrences >= MIN_OCCURRENCES_FOR_SHORT_NAME
        : occurrences >= 1;
}

/** 优先沿用较早章节的 endInstant；没有结束时刻才使用 startInstant。 */
function advanceLastKnownInstant(
    scenes: ChapterPlotDetailDto["scenes"],
    chapterTitle: string,
    current: {instant: string; chapterTitle: string} | null,
): {instant: string; chapterTitle: string} | null {
    let best = current;
    for (const scene of scenes) {
        for (const instant of [scene.worldAnchor.endInstant, scene.worldAnchor.startInstant]) {
            if (instant !== null && (best === null || BigInt(instant) > BigInt(best.instant))) {
                best = {instant, chapterTitle};
            }
        }
    }
    return best;
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function isErrorWithCode(error: unknown, code: string): boolean {
    return typeof error === "object" && error !== null && "code" in error && error.code === code;
}
