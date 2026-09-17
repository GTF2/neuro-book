import path from "node:path";
import fs from "node:fs/promises";
import {createHash} from "node:crypto";
import type {OperationActor} from "@notnotype/nb-history";
import type {SliceInput, SliceWriteResult} from "nbook/server/world-engine/types";
import type {AbsoluteFsPath} from "nbook/server/runtime/paths/file-path";
import type {WorkspaceFileTarget} from "nbook/server/workspace-files/workspace-file-target";
import type {ProjectHistoryHandle} from "nbook/server/workspace-history/project-history";
import {
    deleteWorkspacePathTracked,
    writeWorkspaceTextFileTracked,
} from "nbook/server/workspace-history/tracked-workspace-files";
import {readWorkspaceTextFile} from "nbook/server/workspace-files/workspace-files";
import type {PlotFacade} from "nbook/server/plot/facade/plot.facade";
import type {WorldEngineFacade} from "nbook/server/world-engine/world-engine.facade";

/**
 * 定稿原子提交服务（T0.2）。
 *
 * 把「正文落盘 + World Patch 应用 + Promise beat 更新」组织为一个原子单元：
 * - 检查点：正文写入走 nb-history 记账（writeWorkspaceTextFileTracked），
 *   before/after 内容快照即持久检查点；内存中同时保留写前内容用于回滚。
 * - 任一步失败 → 逆序回滚（beats → world slices → 正文），并把失败与回滚结果
 *   记成一条 rolled-back 事件；回滚自身失败不吞错，逐项记入 rollbackFailures。
 * - 全部成功 → 记一条 committed 事件（结算凭据：正文内容 hash + 切面 id + beat 清单）。
 *
 * 设计取舍（如实记录）：
 * - World 侧只支持**新增切面**（writeSlice），不支持编辑既有切面——editSlice 的
 *   逆操作无法用公开 API 精确表达；编辑既有切面留在原子单元之外，由调用方走常规路径。
 * - 回滚是「补偿事务」而非数据库事务：三个存储（文件系统、project.sqlite 的 world 表、
 *   plot 表）没有共享事务边界，nb-history 的事件快照保证正文侧可恢复，world/plot 侧
 *   用逆操作补偿。回滚失败会被显式上报（rollbackFailures），绝不静默。
 * - 事件落在 `<projectRoot>/.nbook/chapter-finalize-events.jsonl`（append-only JSONL），
 *   不动 Prisma schema（避免并发生成 client 的已知崩溃风险）。
 */

/** finalize 事件日志在 Project Workspace 内的相对路径（与 history.sqlite 同级，属运行时数据）。 */
export const CHAPTER_FINALIZE_EVENT_LOG_RELATIVE_PATH = ".nbook/chapter-finalize-events.jsonl";

/** Promise beat 的原子单元输入（route DTO 转成数字 id 后的形态）。 */
export type ChapterFinalizePromiseBeatInput = {
    promiseId: number;
    sceneId: number;
    kind: "plant" | "advance" | "setback" | "payoff";
    /** undefined = 沿用既有指示；null = 显式清空（与 SetPromiseBeatRequestDto 同语义）。 */
    note?: string | null;
};

/** finalize 的完整输入。 */
export type ChapterFinalizeInput = {
    /** 正文落盘目标：Project Workspace 相对 Markdown 路径（章节 index.md）。 */
    chapterPath: string;
    /** 要写入的正文内容。 */
    content: string;
    /** World Patch 应用：本章新事实切面（只支持新增切面）。 */
    worldSlices: SliceInput[];
    /** Promise beat 更新。 */
    promiseBeats: ChapterFinalizePromiseBeatInput[];
    /** 正文落盘记账归因；回滚写固定用 system/chapter-finalize。 */
    actor: OperationActor;
};

/** 原子单元中的步骤代号（失败定位用）。 */
export type ChapterFinalizeStep = "prose" | "world" | "promise-beat";

/** finalize / 回滚结果事件（JSONL 一行一个）。 */
export type ChapterFinalizeEvent = {
    type: "chapter-finalize.committed" | "chapter-finalize.rolled-back";
    /** ISO-8601 UTC。 */
    occurredAt: string;
    chapterPath: string;
    /** 本次尝试写入的正文内容 sha256（hex）。 */
    chapterContentHash: string;
    /** 提交前正文内容 sha256；提交前文件不存在为 null。 */
    chapterBeforeHash: string | null;
    /** 已应用的 World 切面 id（committed = 全部；rolled-back = 回滚补偿过的）。 */
    worldSliceIds: string[];
    /** 本次尝试的 beat 清单。 */
    promiseBeats: Array<{promiseId: number; sceneId: number; kind: string}>;
    /** 仅 rolled-back：失败步骤与原因。 */
    failure?: {step: ChapterFinalizeStep; message: string};
    /** 仅 rolled-back：回滚补偿中失败的项（非空 = 有残留，需人工介入）。 */
    rollbackFailures?: string[];
};

/** 成功提交的结算凭据。 */
export type ChapterFinalizeResult = {
    status: "committed";
    chapterPath: string;
    chapterContentHash: string;
    chapterBeforeHash: string | null;
    worldSliceIds: string[];
    promiseBeats: ChapterFinalizePromiseBeatInput[];
};

/** finalize 失败（已进入回滚流程后抛出）。rollbackFailures 非空表示回滚有残留。 */
export class ChapterFinalizeError extends Error {
    readonly step: ChapterFinalizeStep;
    readonly rollbackFailures: readonly string[];

    constructor(step: ChapterFinalizeStep, message: string, rollbackFailures: readonly string[] = []) {
        super(message);
        this.name = "ChapterFinalizeError";
        this.step = step;
        this.rollbackFailures = rollbackFailures;
    }
}

/**
 * 原子单元依赖的操作端口。生产环境由 {@link createChapterFinalizePorts} 装配；
 * 单测注入内存实现即可验证回滚语义，不需要真实 Project。
 */
export type ChapterFinalizePorts = {
    /** 读正文当前内容；文件不存在返回 null（检查点）。 */
    readChapterFile(chapterPath: string): Promise<string | null>;
    /** 正文落盘 + nb-history 记账；before 为写前内容（记账复用，省一次读盘）。 */
    writeChapterFile(input: {chapterPath: string; content: string; before: string | null; actor: OperationActor}): Promise<void>;
    /** 删除正文文件 + 记账（回滚「提交前不存在」的 create 用）。 */
    deleteChapterFile(chapterPath: string, actor: OperationActor): Promise<void>;
    /** 写入 World 新切面。 */
    writeWorldSlice(slice: SliceInput): Promise<SliceWriteResult>;
    /** 删除 World 切面（回滚补偿）。 */
    deleteWorldSlice(sliceId: string): Promise<void>;
    /** 查某 (promise, scene) 上的既有 beat；无则 null（回滚恢复用）。 */
    findPromiseBeat(promiseId: number, sceneId: number): Promise<{kind: string; note: string | null} | null>;
    /** upsert 一条 beat。 */
    setPromiseBeat(beat: ChapterFinalizePromiseBeatInput): Promise<void>;
    /** 删除一条 beat（回滚「此前无 beat」的 upsert 用）。 */
    removePromiseBeat(promiseId: number, sceneId: number): Promise<void>;
    /** finalize 事件落账（JSONL append）。 */
    appendEvent(event: ChapterFinalizeEvent): Promise<void>;
};

/** 回滚补偿写盘的固定归因。 */
const ROLLBACK_ACTOR: OperationActor = {kind: "system", source: "chapter-finalize"};

/** 单个原子单元允许携带的最大切面 / beat 数量（防误传巨型载荷）。 */
const MAX_WORLD_SLICES = 64;
const MAX_PROMISE_BEATS = 64;

/**
 * 执行一次定稿原子提交。
 *
 * 顺序：检查点（读正文）→ ① 正文落盘 → ② World 切面逐条写入（error 级 issue 视为失败）
 * → ③ Promise beat 逐条 upsert → ④ committed 事件落账。
 * 任一步失败：逆序补偿（③ beats → ② slices → ① 正文），落 rolled-back 事件，
 * 抛 {@link ChapterFinalizeError}。
 */
export async function finalizeChapter(ports: ChapterFinalizePorts, input: ChapterFinalizeInput): Promise<ChapterFinalizeResult> {
    if (input.worldSlices.length > MAX_WORLD_SLICES) {
        throw new ChapterFinalizeError("world", `worldSlices 超过单次上限 ${MAX_WORLD_SLICES}`);
    }
    if (input.promiseBeats.length > MAX_PROMISE_BEATS) {
        throw new ChapterFinalizeError("promise-beat", `promiseBeats 超过单次上限 ${MAX_PROMISE_BEATS}`);
    }

    // 检查点：任何写入开始前先捕获正文现状（在 try 外——失败时尚无任何副作用，直接抛）。
    const before = await ports.readChapterFile(input.chapterPath);
    const chapterContentHash = sha256Hex(input.content);
    const chapterBeforeHash = before === null ? null : sha256Hex(before);

    const appliedSliceIds: string[] = [];
    const appliedBeats: Array<{beat: ChapterFinalizePromiseBeatInput; previous: {kind: string; note: string | null} | null}> = [];

    try {
        // ① 正文落盘（tracked 写入：落盘 + nb-history 记账，before/after 快照即持久检查点）。
        await ports.writeChapterFile({chapterPath: input.chapterPath, content: input.content, before, actor: input.actor});

        // ② World Patch 应用：逐条写新切面；severity=error 的 issue 是数据错误，视为失败触发回滚。
        // 注意：writeSlice 是「先提交再返回 issues」——error 级 issue 的切面已入库，必须先记入
        // appliedSliceIds 再判定失败，否则回滚会漏删它。
        for (const slice of input.worldSlices) {
            let result: SliceWriteResult;
            try {
                result = await ports.writeWorldSlice(slice);
            } catch (error) {
                throw tagFailure("world", error);
            }
            appliedSliceIds.push(result.sliceId);
            const errors = result.issues.filter((issue) => issue.severity === "error");
            if (errors.length > 0) {
                throw new ChapterFinalizeError(
                    "world",
                    `World 切面写入产生 ${errors.length} 条 error 级问题: ${errors.map((issue) => `${issue.label}(${issue.code})`).join(", ")}`,
                );
            }
        }

        // ③ Promise beat 更新：先捕获既有 beat（回滚恢复用），再 upsert。
        for (const beat of input.promiseBeats) {
            let previous: {kind: string; note: string | null} | null;
            try {
                previous = await ports.findPromiseBeat(beat.promiseId, beat.sceneId);
            } catch (error) {
                throw tagFailure("promise-beat", error);
            }
            try {
                await ports.setPromiseBeat(beat);
            } catch (error) {
                throw tagFailure("promise-beat", error);
            }
            appliedBeats.push({beat, previous});
        }
    } catch (error) {
        const failure = error instanceof ChapterFinalizeError
            ? error
            : new ChapterFinalizeError("prose", errorMessage(error));
        const rollbackFailures = await rollbackFinalize(ports, input, before, appliedSliceIds, appliedBeats);
        await appendRolledBackEvent(ports, input, chapterContentHash, chapterBeforeHash, appliedSliceIds, failure, rollbackFailures);
        throw new ChapterFinalizeError(failure.step, failure.message, rollbackFailures);
    }

    // ④ committed 事件落账（结算凭据）。
    await ports.appendEvent({
        type: "chapter-finalize.committed",
        occurredAt: new Date().toISOString(),
        chapterPath: input.chapterPath,
        chapterContentHash,
        chapterBeforeHash,
        worldSliceIds: [...appliedSliceIds],
        promiseBeats: input.promiseBeats.map((beat) => ({promiseId: beat.promiseId, sceneId: beat.sceneId, kind: beat.kind})),
    });

    return {
        status: "committed",
        chapterPath: input.chapterPath,
        chapterContentHash,
        chapterBeforeHash,
        worldSliceIds: [...appliedSliceIds],
        promiseBeats: [...input.promiseBeats],
    };
}

/**
 * 逆序补偿：③ beats → ② world slices → ① 正文。
 * 每项独立 try/catch——单项补偿失败不影响其余项，失败明细收集后由调用方落事件并上报。
 */
async function rollbackFinalize(
    ports: ChapterFinalizePorts,
    input: ChapterFinalizeInput,
    before: string | null,
    appliedSliceIds: readonly string[],
    appliedBeats: ReadonlyArray<{beat: ChapterFinalizePromiseBeatInput; previous: {kind: string; note: string | null} | null}>,
): Promise<string[]> {
    const failures: string[] = [];

    // ③ beats：此前无 beat → 删除；此前有 → 恢复原 kind/note。
    for (const {beat, previous} of [...appliedBeats].reverse()) {
        try {
            if (previous === null) {
                await ports.removePromiseBeat(beat.promiseId, beat.sceneId);
            } else {
                await ports.setPromiseBeat({
                    promiseId: beat.promiseId,
                    sceneId: beat.sceneId,
                    kind: previous.kind as ChapterFinalizePromiseBeatInput["kind"],
                    note: previous.note,
                });
            }
        } catch (error) {
            failures.push(`promise-beat(${beat.promiseId},${beat.sceneId}): ${errorMessage(error)}`);
        }
    }

    // ② world slices：逆序物理删除已应用的新切面。
    for (const sliceId of [...appliedSliceIds].reverse()) {
        try {
            await ports.deleteWorldSlice(sliceId);
        } catch (error) {
            failures.push(`world-slice(${sliceId}): ${errorMessage(error)}`);
        }
    }

    // ① 正文：恢复检查点内容；磁盘已等于检查点时跳过（避免无意义的幂等记账）。
    try {
        const current = await ports.readChapterFile(input.chapterPath);
        if (current !== before) {
            if (before === null) {
                await ports.deleteChapterFile(input.chapterPath, ROLLBACK_ACTOR);
            } else {
                await ports.writeChapterFile({chapterPath: input.chapterPath, content: before, before: current, actor: ROLLBACK_ACTOR});
            }
        }
    } catch (error) {
        failures.push(`prose(${input.chapterPath}): ${errorMessage(error)}`);
    }

    return failures;
}

/** 落 rolled-back 事件（事件落账自身失败不再触发二次回滚，只把原始失败抛出——事件可由日志补查）。 */
async function appendRolledBackEvent(
    ports: ChapterFinalizePorts,
    input: ChapterFinalizeInput,
    chapterContentHash: string,
    chapterBeforeHash: string | null,
    appliedSliceIds: readonly string[],
    failure: ChapterFinalizeError,
    rollbackFailures: readonly string[],
): Promise<void> {
    try {
        await ports.appendEvent({
            type: "chapter-finalize.rolled-back",
            occurredAt: new Date().toISOString(),
            chapterPath: input.chapterPath,
            chapterContentHash,
            chapterBeforeHash,
            worldSliceIds: [...appliedSliceIds],
            promiseBeats: input.promiseBeats.map((beat) => ({promiseId: beat.promiseId, sceneId: beat.sceneId, kind: beat.kind})),
            failure: {step: failure.step, message: failure.message},
            rollbackFailures: [...rollbackFailures],
        });
    } catch {
        // 事件落账失败时保留原始业务错误；JSONL 缺行由后续对账/人工补查。
    }
}

/** 把任意异常包装成带步骤代号的 ChapterFinalizeError（已是该类型的原样返回）。 */
function tagFailure(step: ChapterFinalizeStep, error: unknown): ChapterFinalizeError {
    if (error instanceof ChapterFinalizeError) {
        return error;
    }
    const wrapped = new ChapterFinalizeError(step, `${step} 步骤失败: ${errorMessage(error)}`);
    wrapped.cause = error;
    return wrapped;
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function sha256Hex(text: string): string {
    return createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * 把事件 append 到 Project 的 finalize 事件日志（JSONL，一行一事件）。
 * 目录不存在则创建；与 history.sqlite 同在 `.nbook/` 运行时数据区。
 */
export async function appendChapterFinalizeEvent(projectRoot: AbsoluteFsPath, event: ChapterFinalizeEvent): Promise<void> {
    const logPath = path.join(projectRoot, ...CHAPTER_FINALIZE_EVENT_LOG_RELATIVE_PATH.split("/"));
    await fs.mkdir(path.dirname(logPath), {recursive: true});
    await fs.appendFile(logPath, `${JSON.stringify(event)}\n`, "utf8");
}

/**
 * 生产环境端口装配：正文走 tracked 写入（落盘 + nb-history 记账），
 * World / Promise beat 走当前 ready generation 的 Plot / World Engine facade。
 */
export function createChapterFinalizePorts(deps: {
    plot: Pick<PlotFacade, "getStoryPromiseDetailDto" | "setPromiseBeat" | "removePromiseBeat">;
    world: Pick<WorldEngineFacade, "writeSlice" | "deleteSlice">;
    target: WorkspaceFileTarget;
    history: ProjectHistoryHandle;
}): ChapterFinalizePorts {
    const {plot, world, target, history} = deps;
    return {
        async readChapterFile(chapterPath: string): Promise<string | null> {
            try {
                return await readWorkspaceTextFile(target.root, chapterPath);
            } catch (error) {
                if (typeof error === "object" && error !== null && "code" in error && (error as {code?: string}).code === "ENOENT") {
                    return null;
                }
                throw error;
            }
        },
        async writeChapterFile(input: {chapterPath: string; content: string; before: string | null; actor: OperationActor}): Promise<void> {
            await writeWorkspaceTextFileTracked({
                target,
                history,
                filePath: input.chapterPath,
                content: input.content,
                actor: input.actor,
                knownBefore: input.before,
            });
        },
        async deleteChapterFile(chapterPath: string, actor: OperationActor): Promise<void> {
            await deleteWorkspacePathTracked({target, history, filePath: chapterPath, recursive: false, actor});
        },
        async writeWorldSlice(slice: SliceInput): Promise<SliceWriteResult> {
            return world.writeSlice(slice);
        },
        async deleteWorldSlice(sliceId: string): Promise<void> {
            await world.deleteSlice(sliceId);
        },
        async findPromiseBeat(promiseId: number, sceneId: number): Promise<{kind: string; note: string | null} | null> {
            const detail = await plot.getStoryPromiseDetailDto(promiseId);
            const beat = detail.beats.find((item) => Number(item.sceneId) === sceneId);
            return beat === undefined ? null : {kind: beat.kind, note: beat.note};
        },
        async setPromiseBeat(beat: ChapterFinalizePromiseBeatInput): Promise<void> {
            await plot.setPromiseBeat(beat.promiseId, {
                sceneId: String(beat.sceneId),
                kind: beat.kind,
                ...(beat.note === undefined ? {} : {note: beat.note}),
            });
        },
        async removePromiseBeat(promiseId: number, sceneId: number): Promise<void> {
            await plot.removePromiseBeat(promiseId, sceneId);
        },
        async appendEvent(event: ChapterFinalizeEvent): Promise<void> {
            if (target.kind !== "project-workspace") {
                throw new Error("chapter-finalize 只支持 Project Workspace 目标");
            }
            await appendChapterFinalizeEvent(target.root, event);
        },
    };
}
