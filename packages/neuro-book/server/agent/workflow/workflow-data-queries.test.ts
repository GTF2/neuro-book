import {describe, expect, test, vi} from "vitest";
import type {ReadyProjectSessionRef} from "nbook/server/workspace-files/project-session-types";

const mocks = vi.hoisted(() => ({
    runReadyProjectOperation: vi.fn(),
    activateReadyProjectModule: vi.fn(),
}));

vi.mock("nbook/server/workspace-files/project-session", () => ({
    runReadyProjectOperation: mocks.runReadyProjectOperation,
    activateReadyProjectModule: mocks.activateReadyProjectModule,
}));
vi.mock("nbook/server/plot", () => ({
    PROJECT_PLOT_WORLD_MODULE_TOKEN: {name: "plot-world"},
}));

import {
    PLOT_CHAPTER_INFO_CONTROL_QUERY,
    createWorkflowActivityExecutor,
    readChapterInfoControlFromPlot,
} from "nbook/server/agent/workflow/workflow-data-queries";

/**
 * 宿主只读查询 `plot.chapter-info-control@1` 的合同测试：
 * 结果形状、Project 作用域、输入校验与 fail-closed 语义（见 docs/specs/agent/workflow-data-queries.md）。
 */

const project = {generation: 9} as ReadyProjectSessionRef;

/** 构造一次 ActivityExecutionRequest（内核把 reference/input/context 一起交给执行器）。 */
function request(input: unknown, key = "k1"): never {
    return {
        reference: PLOT_CHAPTER_INFO_CONTROL_QUERY,
        input,
        options: {},
        context: {
            runId: "run-1",
            activity: {key: "root#0", path: "root", seq: 0, kind: "query", fingerprint: "fp"},
            idempotencyKey: key,
            signal: new AbortController().signal,
        },
    } as never;
}

describe("workflow 只读查询 plot.chapter-info-control@1", () => {
    test("已绑定 Project：返回四字段结果形状并带上 chapterId", async () => {
        const reader = vi.fn(async (_project: ReadyProjectSessionRef, chapterId: number) => ({
            chapterId,
            readerKnows: "项链存在",
            protagonistKnows: null,
            mustHide: null,
            hintOnly: "遗物来历",
        }));
        const executor = createWorkflowActivityExecutor({resolveProject: () => project, readChapterInfoControl: reader});

        await expect(executor.query(request({chapterId: 7}))).resolves.toEqual({
            chapterId: 7,
            readerKnows: "项链存在",
            protagonistKnows: null,
            mustHide: null,
            hintOnly: "遗物来历",
        });
        expect(reader).toHaveBeenCalledWith(project, 7);
    });

    test("未绑定 Project：fail-closed 抛错且不读取数据", async () => {
        const reader = vi.fn();
        const executor = createWorkflowActivityExecutor({resolveProject: () => null, readChapterInfoControl: reader});

        await expect(executor.query(request({chapterId: 7}))).rejects.toThrow(/未绑定 Project/u);
        expect(reader).not.toHaveBeenCalled();
    });

    test("非法 chapterId：拒绝且不读取数据", async () => {
        const reader = vi.fn();
        const executor = createWorkflowActivityExecutor({resolveProject: () => project, readChapterInfoControl: reader});

        await expect(executor.query(request({chapterId: 0}))).rejects.toThrow(/正整数/u);
        await expect(executor.query(request({chapterId: 1.5}))).rejects.toThrow(/正整数/u);
        expect(reader).not.toHaveBeenCalled();
    });

    test("读取失败原样上抛：不降级为「未提供清单」", async () => {
        const executor = createWorkflowActivityExecutor({
            resolveProject: () => project,
            readChapterInfoControl: async () => {
                throw new Error("章节不存在");
            },
        });

        await expect(executor.query(request({chapterId: 404}))).rejects.toThrow("章节不存在");
    });

    test("真实读取实现：经 Project 作用域取 StoryChapter.brief 四字段", async () => {
        mocks.runReadyProjectOperation.mockImplementation(async (
            _project: ReadyProjectSessionRef,
            operation: () => Promise<unknown>,
        ) => await operation());
        mocks.activateReadyProjectModule.mockResolvedValue({
            plot: {
                getStoryChapterDto: vi.fn(async () => ({
                    brief: {readerKnows: "项链存在", protagonistKnows: "项链发烫", mustHide: null, hintOnly: undefined},
                })),
            },
        });

        await expect(readChapterInfoControlFromPlot(project, 12)).resolves.toEqual({
            chapterId: 12,
            readerKnows: "项链存在",
            protagonistKnows: "项链发烫",
            mustHide: null,
            hintOnly: null,
        });
        expect(mocks.runReadyProjectOperation).toHaveBeenCalledWith(project, expect.any(Function));
        expect(mocks.activateReadyProjectModule).toHaveBeenCalledWith(project, {name: "plot-world"});
    });
});
