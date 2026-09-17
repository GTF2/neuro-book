import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {createHash} from "node:crypto";
import {afterAll, beforeAll, describe, expect, it, vi} from "vitest";
import type {OperationActor} from "@notnotype/nb-history";
import type {SliceInput, SliceWriteResult} from "nbook/server/world-engine/types";
import {
    appendChapterFinalizeEvent,
    CHAPTER_FINALIZE_EVENT_LOG_RELATIVE_PATH,
    ChapterFinalizeError,
    finalizeChapter,
    type ChapterFinalizeEvent,
    type ChapterFinalizePorts,
    type ChapterFinalizePromiseBeatInput,
} from "nbook/server/plot/services/chapter-finalize.service";

/**
 * T0.2 定稿原子提交服务的单元测试。
 *
 * 验收口径：
 * ① 构造三步中第二步（World）失败 → 断言正文与 World / beat 状态全部回滚到提交前；
 * ② 成功路径 → 断言三处写入一致且产生一条 committed finalize 事件；
 * ③ 回滚补偿自身失败 → rollbackFailures 显式上报，不静默；
 * ④ JSONL 事件落账可追加、可逐行解析。
 *
 * 端口全部用内存实现：回滚语义不依赖真实 Project / SQLite，真实装配由
 * createChapterFinalizePorts 的类型约束与既有 facade 契约保证。
 */

/** 内存正文存储 + 调用记录。 */
type MemoryFileStore = {
    files: Map<string, string>;
    writes: Array<{chapterPath: string; content: string}>;
    deletes: string[];
};

/** 内存 World 存储：sliceId → 切面；可注入写失败。 */
type MemoryWorldStore = {
    slices: Map<string, SliceInput>;
    deletedSliceIds: string[];
    nextSliceId: number;
    /** 返回 true 表示第 n 次 writeSlice（1 起）应失败。 */
    failWriteOnAttempt?: number;
    /** 返回给第 n 次 writeSlice（1 起）的 error 级 issues。 */
    errorIssuesOnAttempt?: number;
};

/** 内存 beat 存储：`${promiseId}:${sceneId}` → beat 快照。 */
type MemoryBeatStore = {
    beats: Map<string, {kind: string; note: string | null}>;
    setCalls: Array<{promiseId: number; sceneId: number; kind: string; note?: string | null}>;
    removedKeys: string[];
};

type Fixture = {
    ports: ChapterFinalizePorts;
    fileStore: MemoryFileStore;
    worldStore: MemoryWorldStore;
    beatStore: MemoryBeatStore;
    events: ChapterFinalizeEvent[];
};

function createFixture(): Fixture {
    const fileStore: MemoryFileStore = {files: new Map(), writes: [], deletes: []};
    const worldStore: MemoryWorldStore = {slices: new Map(), deletedSliceIds: [], nextSliceId: 1};
    const beatStore: MemoryBeatStore = {beats: new Map(), setCalls: [], removedKeys: []};
    const events: ChapterFinalizeEvent[] = [];

    const ports: ChapterFinalizePorts = {
        async readChapterFile(chapterPath) {
            return fileStore.files.get(chapterPath) ?? null;
        },
        async writeChapterFile(input) {
            fileStore.files.set(input.chapterPath, input.content);
            fileStore.writes.push({chapterPath: input.chapterPath, content: input.content});
        },
        async deleteChapterFile(chapterPath) {
            if (!fileStore.files.has(chapterPath)) {
                throw new Error(`文件不存在: ${chapterPath}`);
            }
            fileStore.files.delete(chapterPath);
            fileStore.deletes.push(chapterPath);
        },
        async writeWorldSlice(slice) {
            const attempt = worldStore.nextSliceId;
            if (worldStore.failWriteOnAttempt === attempt) {
                throw new Error(`注入的 World 写入失败 #${attempt}`);
            }
            const sliceId = `slice-${attempt}`;
            worldStore.nextSliceId += 1;
            worldStore.slices.set(sliceId, slice);
            const issues = worldStore.errorIssuesOnAttempt === attempt
                ? [{code: "dangling-ref" as const, label: "E2" as const, severity: "error" as const, subjectId: "hero", attr: "/equipment/head"}]
                : [];
            const result: SliceWriteResult = {sliceId, issues};
            return result;
        },
        async deleteWorldSlice(sliceId) {
            if (!worldStore.slices.has(sliceId)) {
                throw new Error(`切面不存在: ${sliceId}`);
            }
            worldStore.slices.delete(sliceId);
            worldStore.deletedSliceIds.push(sliceId);
        },
        async findPromiseBeat(promiseId, sceneId) {
            return beatStore.beats.get(`${promiseId}:${sceneId}`) ?? null;
        },
        async setPromiseBeat(beat) {
            beatStore.beats.set(`${beat.promiseId}:${beat.sceneId}`, {kind: beat.kind, note: beat.note ?? null});
            beatStore.setCalls.push({promiseId: beat.promiseId, sceneId: beat.sceneId, kind: beat.kind, note: beat.note});
        },
        async removePromiseBeat(promiseId, sceneId) {
            const key = `${promiseId}:${sceneId}`;
            if (!beatStore.beats.has(key)) {
                throw new Error(`beat 不存在: ${key}`);
            }
            beatStore.beats.delete(key);
            beatStore.removedKeys.push(key);
        },
        async appendEvent(event) {
            events.push(event);
        },
    };

    return {ports, fileStore, worldStore, beatStore, events};
}

function sliceInput(overrides: Partial<SliceInput> = {}): SliceInput {
    return {
        instant: 1000n,
        title: "星陨遗迹解封",
        summary: "薇洛丝解开莉雅的封印",
        kind: "event",
        patches: [{subjectId: "liya", op: "replace", path: "/status", value: "awake"}],
        ...overrides,
    };
}

function beatInput(overrides: Partial<ChapterFinalizePromiseBeatInput> = {}): ChapterFinalizePromiseBeatInput {
    return {promiseId: 5, sceneId: 20, kind: "payoff", ...overrides};
}

const ACTOR: OperationActor = {kind: "user", userId: "local"};
const CHAPTER_PATH = "manuscript/001-volume/001-chapter/index.md";
const BEFORE_CONTENT = "# 第一章\n旧正文\n";
const NEW_CONTENT = "# 第一章\n新正文：薇洛丝解开莉雅的封印。\n";

function sha256Hex(text: string): string {
    return createHash("sha256").update(text, "utf8").digest("hex");
}

describe("chapter-finalize.service", () => {
    it("① 第二步（World）失败 → 正文与全部状态回滚到提交前，并落一条 rolled-back 事件", async () => {
        const fixture = createFixture();
        fixture.fileStore.files.set(CHAPTER_PATH, BEFORE_CONTENT);
        fixture.worldStore.failWriteOnAttempt = 2; // 两条切面，第二条失败 → 第一条也必须被补偿删除。

        const promise = finalizeChapter(fixture.ports, {
            chapterPath: CHAPTER_PATH,
            content: NEW_CONTENT,
            worldSlices: [sliceInput(), sliceInput({title: "第二条切面"})],
            promiseBeats: [beatInput()],
            actor: ACTOR,
        });

        await expect(promise).rejects.toBeInstanceOf(ChapterFinalizeError);
        const error = await promise.catch((caught: unknown) => caught as ChapterFinalizeError);
        expect(error.step).toBe("world");
        expect(error.rollbackFailures).toEqual([]);

        // 正文回滚到提交前内容。
        expect(fixture.fileStore.files.get(CHAPTER_PATH)).toBe(BEFORE_CONTENT);
        // 回滚写发生过（写回了 BEFORE_CONTENT）。
        expect(fixture.fileStore.writes.map((write) => write.content)).toEqual([NEW_CONTENT, BEFORE_CONTENT]);

        // World 状态回滚：已应用的第一条切面被补偿删除。
        expect(fixture.worldStore.slices.size).toBe(0);
        expect(fixture.worldStore.deletedSliceIds).toEqual(["slice-1"]);

        // beat 从未生效（第三步未执行），也无需补偿。
        expect(fixture.beatStore.beats.size).toBe(0);
        expect(fixture.beatStore.setCalls).toEqual([]);

        // 一条 rolled-back 事件：失败步骤 world、无回滚残留。
        expect(fixture.events).toHaveLength(1);
        const event = fixture.events[0]!;
        expect(event.type).toBe("chapter-finalize.rolled-back");
        expect(event.failure?.step).toBe("world");
        expect(event.rollbackFailures).toEqual([]);
        expect(event.chapterPath).toBe(CHAPTER_PATH);
        expect(event.chapterContentHash).toBe(sha256Hex(NEW_CONTENT));
        expect(event.chapterBeforeHash).toBe(sha256Hex(BEFORE_CONTENT));
        expect(event.worldSliceIds).toEqual(["slice-1"]);
    });

    it("① 变体：World 写入返回 error 级 issue 同样触发回滚（不抛异常的失败）", async () => {
        const fixture = createFixture();
        fixture.fileStore.files.set(CHAPTER_PATH, BEFORE_CONTENT);
        fixture.worldStore.errorIssuesOnAttempt = 1;

        await expect(finalizeChapter(fixture.ports, {
            chapterPath: CHAPTER_PATH,
            content: NEW_CONTENT,
            worldSlices: [sliceInput()],
            promiseBeats: [],
            actor: ACTOR,
        })).rejects.toThrow(/error 级问题/);

        expect(fixture.fileStore.files.get(CHAPTER_PATH)).toBe(BEFORE_CONTENT);
        expect(fixture.worldStore.slices.size).toBe(0);
    });

    it("① 变体：第三步（beat）失败 → 已写入的 World 切面与正文全部回滚；既有 beat 恢复原值", async () => {
        const fixture = createFixture();
        fixture.fileStore.files.set(CHAPTER_PATH, BEFORE_CONTENT);
        // 该 (promise, scene) 上已有 beat：finalize 试图覆盖为 payoff，失败后必须恢复 plant。
        fixture.beatStore.beats.set("5:20", {kind: "plant", note: "旧指示"});
        const setSpy = vi.spyOn(fixture.ports, "setPromiseBeat");
        setSpy.mockImplementationOnce(async () => {
            throw new Error("注入的 beat 写入失败");
        });

        await expect(finalizeChapter(fixture.ports, {
            chapterPath: CHAPTER_PATH,
            content: NEW_CONTENT,
            worldSlices: [sliceInput()],
            promiseBeats: [beatInput({kind: "payoff", note: "兑现封印承诺"})],
            actor: ACTOR,
        })).rejects.toMatchObject({step: "promise-beat"});

        // 正文回滚；World 切面补偿删除；beat 恢复原值。
        expect(fixture.fileStore.files.get(CHAPTER_PATH)).toBe(BEFORE_CONTENT);
        expect(fixture.worldStore.slices.size).toBe(0);
        expect(fixture.beatStore.beats.get("5:20")).toEqual({kind: "plant", note: "旧指示"});

        const event = fixture.events[0]!;
        expect(event.type).toBe("chapter-finalize.rolled-back");
        expect(event.failure?.step).toBe("promise-beat");
    });

    it("① 变体：提交前正文不存在 + 失败 → 回滚把新建文件删除", async () => {
        const fixture = createFixture();
        fixture.worldStore.failWriteOnAttempt = 1;

        await expect(finalizeChapter(fixture.ports, {
            chapterPath: CHAPTER_PATH,
            content: NEW_CONTENT,
            worldSlices: [sliceInput()],
            promiseBeats: [],
            actor: ACTOR,
        })).rejects.toBeInstanceOf(ChapterFinalizeError);

        expect(fixture.fileStore.files.has(CHAPTER_PATH)).toBe(false);
        expect(fixture.fileStore.deletes).toEqual([CHAPTER_PATH]);
        const event = fixture.events[0]!;
        expect(event.chapterBeforeHash).toBeNull();
    });

    it("② 成功路径 → 三处写入一致 + 恰好一条 committed 事件（结算凭据字段齐全）", async () => {
        const fixture = createFixture();
        fixture.fileStore.files.set(CHAPTER_PATH, BEFORE_CONTENT);
        const existingBeat = beatInput({promiseId: 7, sceneId: 30, kind: "plant", note: "先埋下"});

        const result = await finalizeChapter(fixture.ports, {
            chapterPath: CHAPTER_PATH,
            content: NEW_CONTENT,
            worldSlices: [sliceInput(), sliceInput({title: "第二条切面", instant: 2000n})],
            promiseBeats: [existingBeat, beatInput()],
            actor: ACTOR,
        });

        // 结果即结算凭据。
        expect(result.status).toBe("committed");
        expect(result.chapterPath).toBe(CHAPTER_PATH);
        expect(result.chapterContentHash).toBe(sha256Hex(NEW_CONTENT));
        expect(result.chapterBeforeHash).toBe(sha256Hex(BEFORE_CONTENT));
        expect(result.worldSliceIds).toEqual(["slice-1", "slice-2"]);
        expect(result.promiseBeats).toHaveLength(2);

        // 三处写入一致：正文 = 新内容；World 两条切面在库；beats 两条在库。
        expect(fixture.fileStore.files.get(CHAPTER_PATH)).toBe(NEW_CONTENT);
        expect([...fixture.worldStore.slices.keys()]).toEqual(["slice-1", "slice-2"]);
        expect(fixture.beatStore.beats.get("7:30")).toEqual({kind: "plant", note: "先埋下"});
        expect(fixture.beatStore.beats.get("5:20")).toEqual({kind: "payoff", note: null});

        // 恰好一条 committed 事件，字段与写入一致。
        expect(fixture.events).toHaveLength(1);
        const event = fixture.events[0]!;
        expect(event.type).toBe("chapter-finalize.committed");
        expect(event.chapterContentHash).toBe(result.chapterContentHash);
        expect(event.worldSliceIds).toEqual(["slice-1", "slice-2"]);
        expect(event.promiseBeats).toEqual([
            {promiseId: 7, sceneId: 30, kind: "plant"},
            {promiseId: 5, sceneId: 20, kind: "payoff"},
        ]);
        expect(event.failure).toBeUndefined();
        expect(event.rollbackFailures).toBeUndefined();
    });

    it("③ 回滚补偿自身失败 → rollbackFailures 显式上报（不静默、不中断其余补偿）", async () => {
        const fixture = createFixture();
        fixture.fileStore.files.set(CHAPTER_PATH, BEFORE_CONTENT);
        // World 写入成功（切面入库）；失败注入在第三步 beat，让回滚走到切面删除。
        const setSpy = vi.spyOn(fixture.ports, "setPromiseBeat");
        setSpy.mockImplementationOnce(async () => {
            throw new Error("注入的 beat 写入失败");
        });
        // 补偿删除切面也失败 → 留下残留，必须上报。
        const deleteSpy = vi.spyOn(fixture.ports, "deleteWorldSlice");
        deleteSpy.mockImplementationOnce(async () => {
            throw new Error("注入的切面删除失败");
        });

        const promise = finalizeChapter(fixture.ports, {
            chapterPath: CHAPTER_PATH,
            content: NEW_CONTENT,
            worldSlices: [sliceInput()],
            promiseBeats: [beatInput()],
            actor: ACTOR,
        });
        await expect(promise).rejects.toBeInstanceOf(ChapterFinalizeError);
        const error = await promise.catch((caught: unknown) => caught as ChapterFinalizeError);
        expect(error.step).toBe("promise-beat");

        // 正文照常回滚（其余补偿不受单点失败影响），World 留残留并被上报。
        expect(fixture.fileStore.files.get(CHAPTER_PATH)).toBe(BEFORE_CONTENT);
        expect(fixture.worldStore.slices.size).toBe(1);
        expect(error.rollbackFailures).toHaveLength(1);
        expect(error.rollbackFailures[0]).toContain("world-slice(slice-1)");
        expect(error.rollbackFailures[0]).toContain("注入的切面删除失败");

        const event = fixture.events[0]!;
        expect(event.rollbackFailures).toEqual(error.rollbackFailures);
    });

    it("④ JSONL 事件落账：append-only、逐行可解析", async () => {
        const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "chapter-finalize-test-"));
        try {
            const base = {
                occurredAt: "2026-09-18T00:00:00.000Z",
                chapterPath: CHAPTER_PATH,
                chapterContentHash: sha256Hex(NEW_CONTENT),
                chapterBeforeHash: null,
                worldSliceIds: ["slice-1"],
                promiseBeats: [{promiseId: 5, sceneId: 20, kind: "payoff"}],
            };
            await appendChapterFinalizeEvent(tempRoot as never, {type: "chapter-finalize.committed", ...base});
            await appendChapterFinalizeEvent(tempRoot as never, {
                type: "chapter-finalize.rolled-back",
                ...base,
                failure: {step: "world", message: "注入失败"},
                rollbackFailures: [],
            });

            const logPath = path.join(tempRoot, ...CHAPTER_FINALIZE_EVENT_LOG_RELATIVE_PATH.split("/"));
            const lines = (await fs.readFile(logPath, "utf8")).trim().split("\n");
            expect(lines).toHaveLength(2);
            const first = JSON.parse(lines[0]!) as ChapterFinalizeEvent;
            const second = JSON.parse(lines[1]!) as ChapterFinalizeEvent;
            expect(first.type).toBe("chapter-finalize.committed");
            expect(second.type).toBe("chapter-finalize.rolled-back");
            expect(second.failure?.step).toBe("world");
        } finally {
            await fs.rm(tempRoot, {recursive: true, force: true});
        }
    });
});
