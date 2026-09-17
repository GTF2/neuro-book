import {z} from "zod";
import {ProjectRootDtoSchema} from "nbook/shared/dto/project.dto";
import {requireProjectRefQuery} from "nbook/server/api/projects/project-control-plane";
import {validateBody} from "nbook/server/utils/novel-chapter";
import {
    activateReadyProjectModule,
    requireActiveReadyProject,
    requireReadyModuleHandle,
    runReadyProjectOperation,
} from "nbook/server/workspace-files/project-session";
import {withProjectHttpError} from "nbook/server/api/projects/project-http-error";
import {PROJECT_HISTORY_MODULE_TOKEN} from "nbook/server/workspace-history/project-history";
import {USER_LOCAL_ACTOR} from "nbook/server/workspace-history/tracked-workspace-files";
import {PROJECT_PLOT_WORLD_MODULE_TOKEN} from "nbook/server/plot";
import {
    ChapterFinalizeError,
    createChapterFinalizePorts,
    finalizeChapter,
    type ChapterFinalizePromiseBeatInput,
} from "nbook/server/plot/services/chapter-finalize.service";
import type {JsonValue, SliceInput} from "nbook/server/world-engine/types";

/**
 * T0.2 定稿原子提交 API：POST /api/projects/plot/finalize?projectRoot=<name>
 *
 * 把「正文落盘 + World Patch 应用 + Promise beat 更新」作为一个原子单元执行：
 * 任一步失败整体回滚（补偿事务），成功返回结算凭据并落一条 finalize 事件。
 * 失败时 HTTP 500 + `data.code = CHAPTER_FINALIZE_FAILED`，`data.rollbackFailures`
 * 非空表示回滚有残留（需人工介入）；为空表示已完全回到提交前状态，可安全重试。
 *
 * 注意：worldSlices.instant 是**数字字符串**（raw instant）；日历字符串请先用
 * world-engine API 的 parseTime 转换。World 侧只接受新增切面。
 */

const FinalizeChapterPatchSchema = z.object({
    subjectId: z.string().trim().min(1, "subjectId 不能为空"),
    op: z.enum(["replace", "increment", "remove", "append"]),
    path: z.string().trim().min(1, "path 不能为空"),
    /** JSON wire 值（与 WorldPatch.value 同构）；深层结构由 World Engine 写入校验兜底。 */
    value: z.unknown().optional(),
    summary: z.string().optional(),
    type: z.string().optional(),
    name: z.string().optional(),
});

const FinalizeChapterWorldSliceSchema = z.object({
    /** raw instant 的数字字符串（JSON 无法承载 bigint）。 */
    instant: z.string().regex(/^\d+$/, "instant 必须是数字字符串（raw instant）"),
    title: z.string().optional(),
    summary: z.string().optional(),
    kind: z.string().optional(),
    patches: z.array(FinalizeChapterPatchSchema).min(1, "patches 不能为空").max(64),
});

const FinalizeChapterBeatSchema = z.object({
    promiseId: z.number().int().positive(),
    sceneId: z.number().int().positive(),
    kind: z.enum(["plant", "advance", "setback", "payoff"]),
    note: z.string().nullable().optional(),
});

const FinalizeChapterBodySchema = z.object({
    /** 正文落盘目标：Project Workspace 相对 Markdown 路径（章节 index.md）。 */
    chapterPath: z.string().trim().min(1, "chapterPath 不能为空").max(1024, "chapterPath 过长"),
    content: z.string(),
    worldSlices: z.array(FinalizeChapterWorldSliceSchema).max(64).default([]),
    promiseBeats: z.array(FinalizeChapterBeatSchema).max(64).default([]),
});

export default defineEventHandler((event) => withProjectHttpError(async () => {
    const ready = requireActiveReadyProject(requireProjectRefQuery(event));
    return runReadyProjectOperation(ready, async () => {
        const {plot, world} = await activateReadyProjectModule(ready, PROJECT_PLOT_WORLD_MODULE_TOKEN);
        const history = requireReadyModuleHandle(ready, PROJECT_HISTORY_MODULE_TOKEN);
        const body = await validateBody(event, FinalizeChapterBodySchema);

        const worldSlices: SliceInput[] = body.worldSlices.map((slice) => ({
            instant: BigInt(slice.instant),
            ...(slice.title === undefined ? {} : {title: slice.title}),
            ...(slice.summary === undefined ? {} : {summary: slice.summary}),
            ...(slice.kind === undefined ? {} : {kind: slice.kind}),
            patches: slice.patches.map((patch) => ({
                subjectId: patch.subjectId,
                op: patch.op,
                path: patch.path,
                ...(patch.value === undefined ? {} : {value: patch.value as JsonValue}),
                ...(patch.summary === undefined ? {} : {summary: patch.summary}),
                ...(patch.type === undefined ? {} : {type: patch.type}),
                ...(patch.name === undefined ? {} : {name: patch.name}),
            })),
        }));
        const promiseBeats: ChapterFinalizePromiseBeatInput[] = body.promiseBeats.map((beat) => ({
            promiseId: beat.promiseId,
            sceneId: beat.sceneId,
            kind: beat.kind,
            ...(beat.note === undefined ? {} : {note: beat.note}),
        }));

        const ports = createChapterFinalizePorts({
            plot,
            world,
            target: {
                kind: "project-workspace",
                root: ready.workspace.root,
                projectRoot: ready.workspace.ref.projectRoot,
            },
            history,
        });

        try {
            return await finalizeChapter(ports, {
                chapterPath: body.chapterPath,
                content: body.content,
                worldSlices,
                promiseBeats,
                actor: USER_LOCAL_ACTOR,
            });
        } catch (error) {
            if (error instanceof ChapterFinalizeError) {
                throw createError({
                    statusCode: 500,
                    statusMessage: "Chapter finalize failed",
                    message: `定稿原子提交失败（已回滚）: ${error.message}`,
                    data: {
                        code: "CHAPTER_FINALIZE_FAILED",
                        step: error.step,
                        rollbackFailures: [...error.rollbackFailures],
                    },
                });
            }
            throw error;
        }
    });
}));
