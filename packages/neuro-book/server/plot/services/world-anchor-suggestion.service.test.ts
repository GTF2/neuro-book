import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {afterEach, describe, expect, it} from "vitest";
import type {WorkspaceFileNode} from "nbook/server/workspace-files/workspace-files";
import type {WorldSubjectListItem} from "nbook/server/world-engine/types";
import {
    buildSubjectNameRegistry,
    confirmWorldAnchorSuggestions,
    countOccurrences,
    detectChapterAnchorEvidence,
    generateWorldAnchorSuggestions,
    readWorldAnchorSuggestionStore,
    rejectWorldAnchorSuggestions,
    type WorldAnchorSuggestionPorts,
    type SubjectNameRegistryEntry,
} from "nbook/server/plot/services/world-anchor-suggestion.service";
import type {
    ChapterPlotDetailDto,
    PlotTreeDto,
    WorldAnchorSuggestionAppliedScene,
    WorldAnchorSuggestionStore,
} from "nbook/shared/dto/plot.dto";

const temporaryRoots: string[] = [];

afterEach(async () => {
    await Promise.all(temporaryRoots.splice(0).map((root) => fs.rm(root, {recursive: true, force: true})));
});

describe("worldAnchorSuggestionService", () => {
    it("只登记有效 active 的角色与地点 Lorebook 候选，并跳过重名目录", () => {
        const registry = buildSubjectNameRegistry([
            worldSubject("hero", "主角", "character"),
            worldSubject("era", "世界", "world"),
        ], [
            lorebookNode("lorebook/character/mei/", {title: "梅（阿梅）", type: "character", status: "active", aliases: ["小梅"]}),
            lorebookNode("lorebook/location/temple/", {title: "神殿", type: "location", status: "active"}),
            lorebookNode("lorebook/character/temple/", {title: "神殿守卫", type: "character", status: "active"}),
            lorebookNode("lorebook/character/draft/", {title: "草稿角色", type: "character", status: "draft"}),
            lorebookNode("lorebook/character/bad/", {title: "损坏角色", type: "character", status: "active"}, "frontmatter 损坏"),
        ]);

        expect(registry).toEqual(expect.arrayContaining([
            expect.objectContaining({subjectId: "hero", resolved: true, names: ["主角"]}),
            expect.objectContaining({subjectId: "mei", resolved: false, names: expect.arrayContaining(["阿梅", "小梅"])}),
        ]));
        expect(registry.map((entry) => entry.subjectId)).not.toContain("era");
        expect(registry.map((entry) => entry.subjectId)).not.toContain("temple");
        expect(registry.map((entry) => entry.subjectId)).not.toContain("draft");
        expect(registry.map((entry) => entry.subjectId)).not.toContain("bad");
    });

    it("按名称长度门槛生成证据，并以单个 subject 的最佳别名作为证据", () => {
        const registry: SubjectNameRegistryEntry[] = [
            {subjectId: "mei", type: "character", resolved: false, source: "lorebook", display: "阿梅", names: ["阿梅", "小梅"]},
            {subjectId: "temple", type: "location", resolved: true, source: "world-subject", display: "荒野神殿", names: ["荒野神殿"]},
        ];

        expect(countOccurrences("阿梅阿梅阿梅", "阿梅")).toBe(3);
        expect(detectChapterAnchorEvidence("阿梅在荒野神殿等阿梅。", registry)).toEqual([
            expect.objectContaining({subjectId: "mei", name: "阿梅", occurrences: 2}),
            expect.objectContaining({subjectId: "temple", name: "荒野神殿", occurrences: 1}),
        ]);
    });

    it("生成时跳过 archived Scene 和没有任何可写锚点的章节，保留已确认历史", async () => {
        const fixture = createFixture();
        fixture.store = {
            version: "world-anchor-suggestions-v1",
            nextSeq: 8,
            suggestions: [suggestion({suggestionId: "was-7", status: "confirmed", resolvedAt: "2026-09-18T00:00:00.000Z"})],
        };
        fixture.tree = plotTree([
            chapter("1", "first", "第一章"),
            chapter("2", "second", "第二章"),
        ]);
        fixture.chapters.set(1, chapterDetail("1", [scene("11", {status: "archived"})]));
        fixture.chapters.set(2, chapterDetail("2", [scene("21")]));
        fixture.prose.set("second", "这一章没有登记名称。");

        const result = await generateWorldAnchorSuggestions(fixture.ports);

        expect(result).toMatchObject({generated: 0, skipped: 2, failed: 0});
        expect(result.store.suggestions).toEqual([expect.objectContaining({suggestionId: "was-7", status: "confirmed"})]);
    });

    it("生成缺失 subject、地点与时间的建议，并用先前 Scene 的 endInstant 作估计", async () => {
        const fixture = createFixture();
        fixture.subjects = [
            worldSubject("hero", "主角", "character"),
            worldSubject("temple", "荒野神殿", "location"),
        ];
        fixture.tree = plotTree([
            chapter("1", "first", "第一章"),
            chapter("2", "second", "第二章"),
        ]);
        fixture.chapters.set(1, chapterDetail("1", [scene("11", {subjectIds: ["hero"], startInstant: "10", endInstant: "20", locationSubjectId: "temple"})]));
        fixture.chapters.set(2, chapterDetail("2", [scene("21")]));
        fixture.prose.set("first", "主角进入荒野神殿，主角停下脚步。");
        fixture.prose.set("second", "主角再次抵达荒野神殿，主角看向祭坛。");

        const result = await generateWorldAnchorSuggestions(fixture.ports);

        expect(result.generated).toBe(1);
        expect(result.store.suggestions).toEqual([
            expect.objectContaining({
                chapterId: "2",
                subjectIds: ["hero"],
                locationSubjectId: "temple",
                timeEstimate: expect.objectContaining({startInstant: "20"}),
                status: "pending",
            }),
        ]);
    });

    it("存量正文缺少 chapter 指针时按章节标题唯一回退，不回写正文", async () => {
        const fixture = createFixture();
        fixture.subjects = [worldSubject("hero", "主角", "character")];
        fixture.tree = plotTree([chapter("1", "vol-01-ch-01", "第一章 旅行者")]);
        fixture.chapters.set(1, chapterDetail("1", [scene("11")]));
        fixture.legacyProse = [{
            path: "manuscript/001-volume/001-chapter",
            indexPath: "manuscript/001-volume/001-chapter/index.md",
            title: "第一章 旅行者",
            chapterName: "",
            words: 10,
        }];
        fixture.prose.set("001-volume", "主角赶路，主角停在路边。");

        const result = await generateWorldAnchorSuggestions(fixture.ports);

        expect(result).toMatchObject({generated: 1, failed: 0});
        expect(result.store.suggestions[0]).toMatchObject({
            chapterPath: "manuscript/001-volume/001-chapter",
            subjectIds: ["hero"],
            note: expect.stringContaining("卷/章节目录键"),
        });
    });

    it("重复标题可由卷/章节目录键精确消歧", async () => {
        const fixture = createFixture();
        fixture.subjects = [worldSubject("hero", "主角", "character")];
        fixture.tree = plotTree([chapter("1", "vol-04-ch-25", "第二十五章 战场")]);
        fixture.chapters.set(1, chapterDetail("1", [scene("11")]));
        fixture.legacyProse = [
            {path: "manuscript/004-volume/025-chapter", indexPath: "manuscript/004-volume/025-chapter/index.md", title: "第二十五章 战场", chapterName: "", words: 10},
            {path: "manuscript/009-volume/025-chapter", indexPath: "manuscript/009-volume/025-chapter/index.md", title: "第二十五章 战场", chapterName: "", words: 10},
        ];
        fixture.prose.set("004-volume", "主角冲进战场，主角没有回头。");

        const result = await generateWorldAnchorSuggestions(fixture.ports);

        expect(result).toMatchObject({generated: 1, failed: 0});
        expect(result.store.suggestions[0]).toMatchObject({chapterPath: "manuscript/004-volume/025-chapter"});
    });

    it("存量回退忽略已指向其他章节或 frontmatter 损坏的正文", async () => {
        const fixture = createFixture();
        fixture.tree = plotTree([chapter("1", "vol-04-ch-25", "第二十五章 战场")]);
        fixture.chapters.set(1, chapterDetail("1", [scene("11")]));
        fixture.legacyProse = [
            {path: "manuscript/004-volume/025-chapter", indexPath: "manuscript/004-volume/025-chapter/index.md", title: "第二十五章 战场", chapterName: "other-chapter", words: 10, hasChapterPointer: true},
            {path: "manuscript/004-volume/025-draft", indexPath: "manuscript/004-volume/025-draft/index.md", title: "第二十五章 战场", chapterName: "", words: 10, frontmatterError: true},
        ];

        const result = await generateWorldAnchorSuggestions(fixture.ports);

        expect(result).toMatchObject({generated: 0, failed: 1});
    });

    it("无结构化目录键的多个同标题正文仍拒绝猜测关联", async () => {
        const fixture = createFixture();
        fixture.tree = plotTree([chapter("1", "custom-chapter", "第一章 旅行者")]);
        fixture.chapters.set(1, chapterDetail("1", [scene("11")]));
        fixture.legacyProse = [
            {path: "manuscript/a", indexPath: "manuscript/a/index.md", title: "第一章 旅行者", chapterName: "", words: 10},
            {path: "manuscript/b", indexPath: "manuscript/b/index.md", title: "第一章 旅行者", chapterName: "", words: 10},
        ];

        const result = await generateWorldAnchorSuggestions(fixture.ports);

        expect(result).toMatchObject({generated: 0, failed: 1});
    });

    it("确认时保留已有两个时间锚点和地点，只合并缺失 subject", async () => {
        const fixture = createFixture();
        fixture.store.suggestions = [suggestion({subjectIds: ["hero", "ally"], locationSubjectId: "temple", timeEstimate: {startInstant: "20", reason: "估计"}})];
        fixture.chapters.set(1, chapterDetail("1", [scene("11", {
            subjectIds: ["hero"],
            locationSubjectId: "old-temple",
            startInstant: "100",
            endInstant: "120",
        })]));

        const result = await confirmWorldAnchorSuggestions(fixture.ports, {suggestionIds: ["was-1"]});

        expect(result.outcomes).toEqual([
            expect.objectContaining({status: "confirmed", appliedScenes: [expect.objectContaining({sceneId: "11", subjectIds: ["hero", "ally"], locationSubjectId: "old-temple", startInstantApplied: null})]}),
        ]);
        expect(fixture.applyCalls).toEqual([{
            chapterId: 1,
            subjectIds: ["hero", "ally"],
            locationSubjectId: "temple",
            startInstant: 20n,
        }]);
        expect(result.store.suggestions[0]).toMatchObject({status: "confirmed"});
    });

    it("Scene 已写入但 confirmed 队列落盘失败时保留 applying，并可重试收口", async () => {
        const fixture = createFixture();
        fixture.store.suggestions = [suggestion()];
        fixture.chapters.set(1, chapterDetail("1", [scene("11")]));
        fixture.failWriteOnAttempt = 2;

        const first = await confirmWorldAnchorSuggestions(fixture.ports, {suggestionIds: ["was-1"]});

        expect(first.outcomes).toEqual([expect.objectContaining({status: "failed", reason: expect.stringContaining("Scene 已合并")})]);
        expect(fixture.store.suggestions[0]).toMatchObject({status: "applying", resolvedAt: null});
        expect(fixture.applyCalls).toHaveLength(1);

        fixture.failWriteOnAttempt = null;
        const retry = await confirmWorldAnchorSuggestions(fixture.ports, {suggestionIds: ["was-1"]});

        expect(retry.outcomes).toEqual([expect.objectContaining({status: "confirmed"})]);
        expect(fixture.store.suggestions[0]).toMatchObject({status: "confirmed", resolvedAt: "2026-09-18T12:00:00.000Z"});
        expect(fixture.applyCalls).toHaveLength(2);
    });

    it("单条建议的 Scene 事务失败时保持 pending，可安全重试", async () => {
        const fixture = createFixture();
        fixture.store.suggestions = [suggestion()];
        fixture.applyFailure = new Error("第二个 Scene 写入失败，事务已回滚");

        const result = await confirmWorldAnchorSuggestions(fixture.ports, {suggestionIds: ["was-1"]});

        expect(result.outcomes).toEqual([expect.objectContaining({status: "failed", appliedScenes: [], reason: "第二个 Scene 写入失败，事务已回滚"})]);
        expect(result.store.suggestions[0]).toMatchObject({status: "pending"});
    });

    it("拒绝建议只更新队列，不调用 Scene 合并", async () => {
        const fixture = createFixture();
        fixture.store.suggestions = [suggestion()];

        const result = await rejectWorldAnchorSuggestions(fixture.ports, {suggestionIds: ["was-1"]});

        expect(result.outcomes).toEqual([{suggestionId: "was-1", status: "rejected"}]);
        expect(result.store.suggestions[0]).toMatchObject({status: "rejected"});
        expect(fixture.applyCalls).toEqual([]);
        expect(fixture.writes).toHaveLength(1);
    });

    it("队列拒绝重复 suggestionId 与错误的处理时间状态", async () => {
        const root = await fs.mkdtemp(path.join(os.tmpdir(), "world-anchor-suggestion-"));
        temporaryRoots.push(root);
        const typedRoot = root as never;
        await fs.mkdir(path.join(root, ".nbook"));
        const duplicateIdStore = {
            version: "world-anchor-suggestions-v1",
            nextSeq: 3,
            suggestions: [suggestion(), suggestion({createdAt: "2026-09-18T12:01:00.000Z"})],
        };
        await fs.writeFile(path.join(root, ".nbook", "world-anchor-suggestions.json"), JSON.stringify(duplicateIdStore), "utf8");
        await expect(readWorldAnchorSuggestionStore(typedRoot)).rejects.toThrow("suggestionId 不能重复");

        const invalidPendingStore = {
            version: "world-anchor-suggestions-v1",
            nextSeq: 2,
            suggestions: [suggestion({resolvedAt: "2026-09-18T12:00:00.000Z"})],
        };
        await fs.writeFile(path.join(root, ".nbook", "world-anchor-suggestions.json"), JSON.stringify(invalidPendingStore), "utf8");
        await expect(readWorldAnchorSuggestionStore(typedRoot)).rejects.toThrow("pending 或 applying 建议不能有 resolvedAt");
    });

    it("缺失队列文件返回空状态，损坏文件显式失败而不会静默覆盖", async () => {
        const root = await fs.mkdtemp(path.join(os.tmpdir(), "world-anchor-suggestion-"));
        temporaryRoots.push(root);
        const typedRoot = root as never;

        await expect(readWorldAnchorSuggestionStore(typedRoot)).resolves.toEqual({
            version: "world-anchor-suggestions-v1",
            nextSeq: 1,
            suggestions: [],
        });
        await fs.mkdir(path.join(root, ".nbook"));
        await fs.writeFile(path.join(root, ".nbook", "world-anchor-suggestions.json"), "{not json", "utf8");
        await expect(readWorldAnchorSuggestionStore(typedRoot)).rejects.toThrow("读取 worldAnchor 建议队列失败");
    });
});

type Fixture = {
    ports: WorldAnchorSuggestionPorts;
    subjects: WorldSubjectListItem[];
    lorebook: WorkspaceFileNode[];
    tree: PlotTreeDto;
    chapters: Map<number, ChapterPlotDetailDto>;
    prose: Map<string, string>;
    legacyProse: Array<{path: string; indexPath: string; title: string; chapterName: string; words: number; hasChapterPointer?: boolean; frontmatterError?: boolean}>;
    store: WorldAnchorSuggestionStore;
    writes: WorldAnchorSuggestionStore[];
    applyCalls: Array<{chapterId: number; subjectIds: string[]; locationSubjectId: string | null; startInstant: bigint | null}>;
    applyFailure: Error | null;
    failWriteOnAttempt: number | null;
};

function createFixture(): Fixture {
    const fixture = {
        subjects: [] as WorldSubjectListItem[],
        lorebook: [] as WorkspaceFileNode[],
        tree: plotTree([]),
        chapters: new Map<number, ChapterPlotDetailDto>(),
        prose: new Map<string, string>(),
        legacyProse: [] as Array<{path: string; indexPath: string; title: string; chapterName: string; words: number; hasChapterPointer?: boolean; frontmatterError?: boolean}>,
        store: emptyStore(),
        writes: [] as WorldAnchorSuggestionStore[],
        applyCalls: [] as Array<{chapterId: number; subjectIds: string[]; locationSubjectId: string | null; startInstant: bigint | null}>,
        applyFailure: null as Error | null,
        failWriteOnAttempt: null as number | null,
    };
    const ports: WorldAnchorSuggestionPorts = {
        async listWorldSubjects() {
            return fixture.subjects;
        },
        async listLorebookNodes() {
            return fixture.lorebook;
        },
        async getPlotTree() {
            return fixture.tree;
        },
        async getChapterScenes(chapterId) {
            const detail = fixture.chapters.get(chapterId);
            if (!detail) throw new Error(`缺少章节 ${chapterId}`);
            return detail;
        },
        async findProseForChapter(chapterName) {
            return fixture.prose.has(chapterName) ? [{path: `manuscript/${chapterName}`, indexPath: `manuscript/${chapterName}/index.md`, title: chapterName, chapterName, words: 10}] : [];
        },
        async listLegacyProseNodes() {
            return fixture.legacyProse.filter((node) => !node.hasChapterPointer && !node.frontmatterError);
        },
        async readProse(indexPath) {
            const chapterName = indexPath.split("/")[1] ?? "";
            return fixture.prose.get(chapterName) ?? null;
        },
        async readStore() {
            return fixture.store;
        },
        async writeStore(store) {
            const attempt = fixture.writes.length + 1;
            if (fixture.failWriteOnAttempt === attempt) {
                throw new Error(`注入的队列写入失败 #${attempt}`);
            }
            fixture.store = store;
            fixture.writes.push(store);
        },
        async applySuggestion(input) {
            fixture.applyCalls.push(input);
            if (fixture.applyFailure) throw fixture.applyFailure;
            const detail = fixture.chapters.get(input.chapterId);
            if (!detail) throw new Error(`缺少章节 ${input.chapterId}`);
            return detail.scenes.filter((entry) => entry.status !== "archived").map((entry) => ({
                sceneId: entry.id,
                subjectIds: [...new Set([...entry.worldAnchor.subjectIds, ...input.subjectIds])],
                locationSubjectId: entry.worldAnchor.locationSubjectId ?? input.locationSubjectId,
                startInstantApplied: entry.worldAnchor.startInstant === null && input.startInstant !== null ? input.startInstant.toString() : null,
            })) satisfies WorldAnchorSuggestionAppliedScene[];
        },
        now() {
            return new Date("2026-09-18T12:00:00.000Z");
        },
    };
    return Object.assign(fixture, {ports}) as Fixture;
}

function emptyStore(): WorldAnchorSuggestionStore {
    return {version: "world-anchor-suggestions-v1", nextSeq: 1, suggestions: []};
}

function suggestion(overrides: Partial<WorldAnchorSuggestionStore["suggestions"][number]> = {}): WorldAnchorSuggestionStore["suggestions"][number] {
    return {
        suggestionId: "was-1",
        chapterId: "1",
        chapterName: "first",
        chapterTitle: "第一章",
        chapterPath: "manuscript/first",
        sceneCount: 1,
        subjectIds: ["hero"],
        locationSubjectId: "temple",
        timeEstimate: null,
        evidence: [],
        note: null,
        status: "pending",
        createdAt: "2026-09-18T12:00:00.000Z",
        resolvedAt: null,
        ...overrides,
    };
}

function worldSubject(id: string, name: string, type: string): WorldSubjectListItem {
    return {id, name, type, createdAt: "2026-09-18T00:00:00.000Z", updatedAt: "2026-09-18T00:00:00.000Z"};
}

function lorebookNode(pathname: string, frontmatter: Record<string, unknown>, frontmatterError: string | null = null): WorkspaceFileNode {
    return {
        mode: "drwxr-xr-x",
        entryType: typeof frontmatter.type === "string" ? frontmatter.type : null,
        icon: null,
        status: typeof frontmatter.status === "string" ? frontmatter.status : null,
        words: 0,
        refs: [],
        path: pathname,
        absolutePath: pathname,
        isDirectory: true,
        hasIndex: true,
        contentNode: true,
        summary: "",
        title: typeof frontmatter.title === "string" ? frontmatter.title : "",
        frontmatter,
        frontmatterError,
        state: null,
        size: 0,
        mtimeMs: 0,
        editable: false,
    } as WorkspaceFileNode;
}

function plotTree(chapters: Array<{id: string; name: string; title: string; sortOrder: number}>): PlotTreeDto {
    return {
        story: {id: "1", novelId: "1", title: "测试小说", summary: "", note: null, createdAt: "", updatedAt: ""},
        phases: [],
        ungroupedThreads: [],
        acts: [{id: "1", storyId: "1", sortOrder: 0, name: "act", title: "第一卷", summary: "", note: null, chapters, createdAt: "", updatedAt: ""}],
        ungroupedChapters: [],
        totalPhases: 0,
        totalThreads: 0,
        totalScenes: 0,
        totalActs: 1,
        totalChapters: chapters.length,
    };
}

function chapter(id: string, name: string, title: string) {
    return {id, name, title, sortOrder: Number(id), storyId: "1", actId: "1", note: null, brief: emptyBrief(), authorOnly: null, createdAt: "", updatedAt: ""};
}

function chapterDetail(chapterId: string, scenes: ChapterPlotDetailDto["scenes"]): ChapterPlotDetailDto {
    return {chapter: chapter(chapterId, `chapter-${chapterId}`, `第${chapterId}章`), scenes};
}

function scene(id: string, overrides: Partial<{status: "draft" | "active" | "written" | "revised" | "archived"; subjectIds: string[]; locationSubjectId: string | null; startInstant: string | null; endInstant: string | null}> = {}): ChapterPlotDetailDto["scenes"][number] {
    return {
        id,
        storyId: "1",
        threadId: "1",
        chapterId: "1",
        chapter: {id: "1", name: "first", title: "第一章", sortOrder: 0},
        threadSortOrder: 0,
        chapterSortOrder: 0,
        title: `Scene ${id}`,
        status: overrides.status ?? "draft",
        outcomeType: null,
        pacingRole: null,
        summary: "",
        purpose: null,
        writingTip: null,
        note: null,
        worldAnchor: {
            startTime: null,
            endTime: null,
            startInstant: overrides.startInstant ?? null,
            endInstant: overrides.endInstant ?? null,
            subjectIds: overrides.subjectIds ?? [],
            locationSubjectId: overrides.locationSubjectId ?? null,
            subjects: [],
            locationSubject: null,
            unresolvedSubjectIds: [],
        },
        createdAt: "",
        updatedAt: "",
    };
}

function emptyBrief() {
    return {
        goal: null,
        pov: null,
        tone: null,
        pacing: null,
        readerKnows: null,
        protagonistKnows: null,
        mustHide: null,
        hintOnly: null,
        opening: null,
        ending: null,
        doNotWrite: null,
        constraintNegative: null,
        stateShift: null,
    };
}
