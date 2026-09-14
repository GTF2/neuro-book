import {MemoryActivityExecutor} from "@notnotype/nb-workflow";
import {PROJECT_PLOT_WORLD_MODULE_TOKEN} from "nbook/server/plot";
import {
    activateReadyProjectModule,
    runReadyProjectOperation,
} from "nbook/server/workspace-files/project-session";
import type {ReadyProjectSessionRef} from "nbook/server/workspace-files/project-session-types";

/**
 * Workflow 版本化只读数据查询（首期消费者 = `infoControl` 自动编译）。
 *
 * 见 Spec：`docs/specs/agent/workflow-data-queries.md`。
 * 只读：不写库、不写文件、无外部副作用；成功结果由内核写进 journal，重放返回原值、不重复读库。
 */

/** 查询引用（内核强制显式版本后缀）。 */
export const PLOT_CHAPTER_INFO_CONTROL_QUERY = "plot.chapter-info-control@1";

/** `plot.chapter-info-control@1` 的结果形状；四字段为 `null` 表示该章未声明。 */
export type ChapterInfoControlFields = {
    chapterId: number;
    readerKnows: string | null;
    protagonistKnows: string | null;
    mustHide: string | null;
    hintOnly: string | null;
};

/**
 * 按 chapterId 读取信息控制四字段。
 * 失败（Project 未打开 / 章节不存在 / 不属于当前 Story / DB 错误）必须抛出，由脚本按 fail-closed 处理。
 */
export type ChapterInfoControlReader = (
    project: ReadyProjectSessionRef,
    chapterId: number,
) => Promise<ChapterInfoControlFields>;

/**
 * 真实读取实现：在 run 绑定的 Project 作用域内，经 PlotFacade 读 `StoryChapter.brief`。
 * 复用既有 Project 作用域登记与 scope guard，不接受调用方传入的路径 / SQL。
 */
export const readChapterInfoControlFromPlot: ChapterInfoControlReader = async (project, chapterId) => {
    return await runReadyProjectOperation(project, async () => {
        const {plot} = await activateReadyProjectModule(project, PROJECT_PLOT_WORLD_MODULE_TOKEN);
        const chapter = await plot.getStoryChapterDto(chapterId);
        return {
            chapterId,
            readerKnows: chapter.brief.readerKnows ?? null,
            protagonistKnows: chapter.brief.protagonistKnows ?? null,
            mustHide: chapter.brief.mustHide ?? null,
            hintOnly: chapter.brief.hintOnly ?? null,
        };
    });
};

/**
 * 组装宿主 `ActivityExecutor`：本能力只注册只读查询，不提供任何 action。
 *
 * - `resolveProject` 读取当前 run 的 Project 上下文（返回 `null` = 该 run 未绑定 Project Workspace，查询 fail-closed）。
 * - `readChapterInfoControl` 可注入，便于在不打开真实 Project 的情况下做合同测试。
 */
export function createWorkflowActivityExecutor(options: {
    resolveProject: () => ReadyProjectSessionRef | null;
    readChapterInfoControl?: ChapterInfoControlReader;
}): MemoryActivityExecutor {
    const read = options.readChapterInfoControl ?? readChapterInfoControlFromPlot;
    const executor = new MemoryActivityExecutor();
    executor.registerQuery<{chapterId: number}, ChapterInfoControlFields>(
        PLOT_CHAPTER_INFO_CONTROL_QUERY,
        async (input) => {
            const project = options.resolveProject();
            if (!project) {
                throw new Error("workflow 只读查询需要已打开的 Project：当前 run 未绑定 Project Workspace。");
            }
            const chapterId = input?.chapterId;
            if (typeof chapterId !== "number" || !Number.isSafeInteger(chapterId) || chapterId <= 0) {
                throw new Error("workflow 只读查询 plot.chapter-info-control@1 的 chapterId 必须是正整数。");
            }
            return await read(project, chapterId);
        },
    );
    return executor;
}
