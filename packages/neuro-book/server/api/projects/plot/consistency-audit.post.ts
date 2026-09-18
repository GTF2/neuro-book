import {
    ChapterConsistencyAuditRequestDtoSchema,
    type ChapterConsistencyAuditRequestDto,
} from "nbook/shared/dto/plot.dto";
import {requireProjectRefQuery} from "nbook/server/api/projects/project-control-plane";
import {withProjectHttpError} from "nbook/server/api/projects/project-http-error";
import {auditChapterConsistency} from "nbook/server/consistency/chapter-consistency-audit.service";
import {PROJECT_PLOT_WORLD_MODULE_TOKEN} from "nbook/server/plot";
import {resolveLlmlintSkillRoot, runLlmlintCheck} from "nbook/server/workspace-files/llmlint-check";
import {statWorkspacePath} from "nbook/server/workspace-files/workspace-files";
import {
    activateReadyProjectModule,
    requireActiveReadyProject,
    runReadyProjectOperation,
} from "nbook/server/workspace-files/project-session";
import {runtimePathsFromEnv} from "nbook/server/runtime/paths/runtime-paths";
import {validateBody} from "nbook/server/utils/novel-chapter";


/**
 * T0.7 章节一致性审计：只读核对结算、结构化 World 切面凭据与正文 llmlint high 命中。
 * 调用方必须明确传入正文路径，避免 chapter 关联多个正文时静默猜测。
 */
export default defineEventHandler((event) => withProjectHttpError(async () => {
    const ready = requireActiveReadyProject(requireProjectRefQuery(event));
    return runReadyProjectOperation(ready, async () => {
        const body = await validateBody<ChapterConsistencyAuditRequestDto>(event, ChapterConsistencyAuditRequestDtoSchema, {maxBytes: 128 * 1024});
        const chapterId = Number(body.chapterId);
        const prose = await statWorkspacePath(ready.workspace.root, body.prosePath);
        if (prose.isDirectory || !prose.editable) {
            throw createError({statusCode: 400, message: "prosePath 必须指向可读正文文件"});
        }
        const skillRoot = await resolveLlmlintSkillRoot(runtimePathsFromEnv());
        const {plot, world} = await activateReadyProjectModule(ready, PROJECT_PLOT_WORLD_MODULE_TOKEN);
        return auditChapterConsistency({
            getChapter: async ({chapterId}) => {
                const chapter = await plot.getStoryChapterDto(chapterId);
                return {id: chapter.id, title: chapter.title, sortOrder: chapter.sortOrder};
            },
            listPromises: () => plot.listStoryPromises(),
            readWorldSliceIds: async ({sliceIds}) => {
                const slices = await Promise.all(sliceIds.map(async (sliceId) => {
                    try {
                        return await world.getSlice(sliceId);
                    } catch {
                        return null;
                    }
                }));
                return new Set(slices.flatMap((slice) => slice === null ? [] : [slice.id]));
            },
            runLint: ({prosePath}) => runLlmlintCheck({
                skillRoot,
                absoluteFilePath: prose.absolutePath,
                minLevel: "low",
            }),
        }, {
            ...body,
            chapterId,
        });
    });
}));
