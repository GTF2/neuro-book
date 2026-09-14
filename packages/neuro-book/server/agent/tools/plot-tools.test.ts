import {testHostPath} from "@notnotype/neuro-book-test-support/test-path";
import {describe, expect, it, vi} from "vitest";
import path from "node:path";
import {Value} from "typebox/value";
import {PLOT_SELECTION_STATE_KEY} from "nbook/server/agent/session/custom-state-keys";
import {createPlotTools} from "nbook/server/agent/tools/plot-tools";
import type {NeuroAgentHarness} from "nbook/server/agent/harness/neuro-agent-harness";
import {absoluteFsPath} from "nbook/server/runtime/paths/file-path";
import { testAbsoluteFsPath } from "@notnotype/neuro-book-test-support/test-path"
import type {ToolExecutionContext} from "nbook/server/agent/tools/types";
import type {ReadyProjectSessionRef} from "nbook/server/workspace-files/project-session-types";

const {
    plotFacade,
    currentReady,
    overrideReady,
    requireActiveReadyProjectMock,
    activateReadyProjectModuleMock,
    runReadyProjectOperationMock,
} = vi.hoisted(() => {
    const facade = {
        getChapterWriterBrief: vi.fn(),
        getSceneWorldContext: vi.fn(),
        getStorySceneDetailDto: vi.fn(),
        getStoryThreadDetailDto: vi.fn(),
        updateStoryChapter: vi.fn(),
        updateStoryScene: vi.fn(),
        listStoryPromises: vi.fn(),
        getStoryPromiseDetailDto: vi.fn(),
        createStoryPromise: vi.fn(),
        updateStoryPromise: vi.fn(),
        setPromiseBeat: vi.fn(),
        removePromiseBeat: vi.fn(),
        listStoryDecisions: vi.fn(),
        getStoryDecisionDto: vi.fn(),
        createStoryDecision: vi.fn(),
        updateStoryDecision: vi.fn(),
        listStoryKeyframes: vi.fn(),
        getStoryKeyframeDto: vi.fn(),
        createStoryKeyframe: vi.fn(),
        updateStoryKeyframe: vi.fn(),
        findTweenKeyframes: vi.fn(),
    };
    const current = {generation: 1, workspace: {ref: {projectRoot: "novel-1"}}} as ReadyProjectSessionRef;
    const override = {generation: 2, workspace: {ref: {projectRoot: "novel-2"}}} as ReadyProjectSessionRef;
    return {
        plotFacade: facade,
        currentReady: current,
        overrideReady: override,
        requireActiveReadyProjectMock: vi.fn(() => override),
        activateReadyProjectModuleMock: vi.fn(async () => ({plot: facade})),
        runReadyProjectOperationMock: vi.fn(async (_ready, operation) => operation(new AbortController().signal)),
    };
});

vi.mock("nbook/server/plot", () => {
    return {
        PROJECT_PLOT_WORLD_MODULE_TOKEN: {name: "plot-world", kind: "lazy"},
    };
});

vi.mock("nbook/server/workspace-files/project-session", () => ({
    requireActiveReadyProject: requireActiveReadyProjectMock,
    activateReadyProjectModule: activateReadyProjectModuleMock,
    runReadyProjectOperation: runReadyProjectOperationMock,
}));

describe("plot tools", () => {
    it("save_story_scene 的 refs.note 可以省略", () => {
        const tool = createPlotTools().find((item) => item.key === "save_story_scene");

        expect(tool).toBeDefined();
        expect(Value.Check(tool!.parameters, {
            projectRoot: "novel-1",
            action: "create",
            threadId: "2",
            title: "Scene",
            refs: [{
                relation: "mentions",
                target: "lorebook/character/foo/",
                visibility: "author",
            }],
        })).toBe(true);
    });

    it("save_story_scene action=create 接受 World Anchor", () => {
        const tool = createPlotTools().find((item) => item.key === "save_story_scene");

        expect(tool).toBeDefined();
        expect(Value.Check(tool!.parameters, {
            projectRoot: "novel-1",
            action: "create",
            threadId: "2",
            title: "Scene",
            worldAnchor: {
                startTime: null,
                endTime: null,
                startInstant: null,
                endInstant: null,
                subjectIds: ["hero"],
                locationSubjectId: "temple",
            },
        })).toBe(true);
    });

    it("save_* 工具的 action 必填", () => {
        const tool = createPlotTools().find((item) => item.key === "save_story_scene");

        expect(tool).toBeDefined();
        expect(Value.Check(tool!.parameters, {
            projectRoot: "novel-1",
            threadId: "2",
            title: "Scene",
        })).toBe(false);
    });

    it("读写元数据：8 个 save_* 标注 mutatesWorkspace、10 个 get_* 不标（只读模式硬门控依据，Task 97 D8）", () => {
        const tools = createPlotTools();
        const mutating = tools.filter((item) => item.mutatesWorkspace).map((item) => item.key).sort();
        const readonly = tools.filter((item) => !item.mutatesWorkspace).map((item) => item.key).sort();

        expect(mutating).toEqual([
            "save_promise_beat",
            "save_story_act",
            "save_story_chapter",
            "save_story_decision",
            "save_story_keyframe",
            "save_story_promise",
            "save_story_scene",
            "save_story_thread",
        ]);
        expect(readonly).toEqual([
            "get_chapter_writer_brief",
            "get_scene_world_context",
            "get_story_chapter",
            "get_story_decision",
            "get_story_keyframe",
            "get_story_promise",
            "get_story_scene_context",
            "get_story_thread",
            "get_story_tree",
            "get_tween_keyframes",
        ]);
    });

    it("save_story_act action=update 缺少 actId 时返回可读中文诊断", async () => {
        const tool = createPlotTools().find((item) => item.key === "save_story_act");

        await expect(tool?.executeWithContext?.(testContext(emptyHarness()), "plot-1", {
            projectRoot: "novel-1",
            action: "update",
            title: "第一卷",
        })).rejects.toThrow("action=update 必须提供 actId");
    });

    it("save_story_chapter action=create 缺少 name/title 时返回可读中文诊断", async () => {
        const tool = createPlotTools().find((item) => item.key === "save_story_chapter");

        await expect(tool?.executeWithContext?.(testContext(emptyHarness()), "plot-1", {
            projectRoot: "novel-1",
            action: "create",
            title: "开篇",
        })).rejects.toThrow("action=create 必须提供 name 和 title");
    });

    it("save_story_chapter action=update 透传 ChapterBrief 信息控制字段（F1 修复链路）", async () => {
        const plotFacadeMock = plotFacade as {
            updateStoryChapter: ReturnType<typeof vi.fn>;
        };
        plotFacadeMock.updateStoryChapter.mockResolvedValueOnce({
            id: "7",
            name: "001-opening",
            title: "开篇",
            brief: {mustHide: "薇洛丝不知道项链是前作遗物"},
        });
        const tool = createPlotTools().find((item) => item.key === "save_story_chapter");

        const result = await tool!.executeWithContext!(testContext(emptyHarness()), "plot-1", {
            projectRoot: "novel-1",
            action: "update",
            chapterId: "7",
            brief: {
                readerKnows: "读者已知封印松动",
                mustHide: "薇洛丝不知道项链是前作遗物",
            },
        });

        expect(plotFacadeMock.updateStoryChapter).toHaveBeenCalledWith(7, {
            brief: {
                readerKnows: "读者已知封印松动",
                mustHide: "薇洛丝不知道项链是前作遗物",
            },
        });
        expect(result.details).toMatchObject({id: "7", brief: {mustHide: "薇洛丝不知道项链是前作遗物"}});
    });

    it("save_story_scene action=archive 把 status 置为 archived", async () => {
        const plotFacadeMock = plotFacade as {
            updateStoryScene: ReturnType<typeof vi.fn>;
        };
        plotFacadeMock.updateStoryScene.mockResolvedValueOnce({id: "20", threadId: "2", status: "archived"});
        const tool = createPlotTools().find((item) => item.key === "save_story_scene");

        await tool!.executeWithContext!(testContext(emptyHarness()), "plot-1", {
            projectRoot: "novel-1",
            action: "archive",
            sceneId: "20",
        });

        expect(plotFacadeMock.updateStoryScene).toHaveBeenCalledWith(20, {status: "archived"});
    });

    it("save_story_thread action=archive 与显式 status 冲突时返回可读中文诊断", async () => {
        const tool = createPlotTools().find((item) => item.key === "save_story_thread");

        await expect(tool?.executeWithContext?.(testContext(emptyHarness()), "plot-1", {
            projectRoot: "novel-1",
            action: "archive",
            threadId: "2",
            status: "active",
        })).rejects.toThrow("action=archive 会把 status 置为 archived");
    });

    it("save_story_promise action=create 缺少 name/title 时返回可读中文诊断", async () => {
        const tool = createPlotTools().find((item) => item.key === "save_story_promise");

        await expect(tool?.executeWithContext?.(testContext(emptyHarness()), "plot-1", {
            projectRoot: "novel-1",
            action: "create",
            title: "银钥匙之谜",
        })).rejects.toThrow("action=create 必须提供 name 和 title");
    });

    it("save_story_promise action=abandon 置 status=abandoned;与显式 status 冲突时报诊断", async () => {
        const plotFacadeMock = plotFacade as {
            updateStoryPromise: ReturnType<typeof vi.fn>;
        };
        plotFacadeMock.updateStoryPromise.mockResolvedValueOnce({id: "5", status: "abandoned"});
        const tool = createPlotTools().find((item) => item.key === "save_story_promise");

        await tool!.executeWithContext!(testContext(emptyHarness()), "plot-1", {
            projectRoot: "novel-1",
            action: "abandon",
            promiseId: "5",
        });
        expect(plotFacadeMock.updateStoryPromise).toHaveBeenCalledWith(5, {status: "abandoned"});

        await expect(tool?.executeWithContext?.(testContext(emptyHarness()), "plot-1", {
            projectRoot: "novel-1",
            action: "fulfill",
            promiseId: "5",
            status: "open",
        })).rejects.toThrow("action=fulfill 会把 status 置为 fulfilled");
    });

    it("save_promise_beat action=set 缺少 kind 时返回可读中文诊断;action=remove 拒绝多余字段", async () => {
        const tool = createPlotTools().find((item) => item.key === "save_promise_beat");

        await expect(tool?.executeWithContext?.(testContext(emptyHarness()), "plot-1", {
            projectRoot: "novel-1",
            action: "set",
            promiseId: "5",
            sceneId: "20",
        })).rejects.toThrow("action=set 必须提供 kind");

        await expect(tool?.executeWithContext?.(testContext(emptyHarness()), "plot-1", {
            projectRoot: "novel-1",
            action: "remove",
            promiseId: "5",
            sceneId: "20",
            kind: "payoff",
        })).rejects.toThrow("action=remove 只需要 promiseId 与 sceneId");
    });

    it("get_story_promise 无 promiseId 走列表模式,有 promiseId 走详情", async () => {
        const plotFacadeMock = plotFacade as {
            listStoryPromises: ReturnType<typeof vi.fn>;
            getStoryPromiseDetailDto: ReturnType<typeof vi.fn>;
        };
        plotFacadeMock.listStoryPromises.mockResolvedValueOnce([{id: "5", status: "open"}]);
        plotFacadeMock.getStoryPromiseDetailDto.mockResolvedValueOnce({id: "5", beats: []});
        const tool = createPlotTools().find((item) => item.key === "get_story_promise");

        const listResult = await tool!.executeWithContext!(testContext(emptyHarness()), "plot-1", {
            projectRoot: "novel-1",
        });
        expect(plotFacadeMock.listStoryPromises).toHaveBeenCalledWith();
        expect(listResult.details).toMatchObject([{id: "5"}]);

        await tool!.executeWithContext!(testContext(emptyHarness()), "plot-1", {
            projectRoot: "novel-1",
            promiseId: "5",
        });
        expect(plotFacadeMock.getStoryPromiseDetailDto).toHaveBeenCalledWith(5);
    });

    it("get_story_decision 无 decisionId 走列表模式,有 decisionId 走详情", async () => {
        const plotFacadeMock = plotFacade as {
            listStoryDecisions: ReturnType<typeof vi.fn>;
            getStoryDecisionDto: ReturnType<typeof vi.fn>;
        };
        plotFacadeMock.listStoryDecisions.mockResolvedValueOnce([{id: "8", status: "open"}]);
        plotFacadeMock.getStoryDecisionDto.mockResolvedValueOnce({id: "8", options: []});
        const tool = createPlotTools().find((item) => item.key === "get_story_decision");

        const listResult = await tool!.executeWithContext!(testContext(emptyHarness()), "plot-1", {
            projectRoot: "novel-1",
        });
        expect(plotFacadeMock.listStoryDecisions).toHaveBeenCalledWith();
        expect(listResult.details).toMatchObject([{id: "8"}]);

        await tool!.executeWithContext!(testContext(emptyHarness()), "plot-1", {
            projectRoot: "novel-1",
            decisionId: "8",
        });
        expect(plotFacadeMock.getStoryDecisionDto).toHaveBeenCalledWith(8);
    });

    it("save_story_decision action=create 拒绝 decided 态字段并要求 name/title/question", async () => {
        const tool = createPlotTools().find((item) => item.key === "save_story_decision");

        await expect(tool?.executeWithContext?.(testContext(emptyHarness()), "plot-1", {
            projectRoot: "novel-1",
            action: "create",
            name: "d-liya-truth",
            title: "莉雅误召真相",
            question: "何时揭示?",
            risk: "提前写死",
        })).rejects.toThrow("action=create 建立 open 态决策");

        await expect(tool?.executeWithContext?.(testContext(emptyHarness()), "plot-1", {
            projectRoot: "novel-1",
            action: "create",
            name: "d-liya-truth",
            title: "莉雅误召真相",
        })).rejects.toThrow("必须提供 name、title 和 question");
    });

    it("save_story_decision action=decide 置 status=decided;与显式 status 冲突时报诊断;action=drop 置 dropped", async () => {
        const plotFacadeMock = plotFacade as {
            updateStoryDecision: ReturnType<typeof vi.fn>;
        };
        plotFacadeMock.updateStoryDecision.mockResolvedValue({id: "8", status: "decided"});
        const tool = createPlotTools().find((item) => item.key === "save_story_decision");

        await tool!.executeWithContext!(testContext(emptyHarness()), "plot-1", {
            projectRoot: "novel-1",
            action: "decide",
            decisionId: "8",
            decision: "第15章揭示",
            motivation: "同场收束",
            risk: "前置章需微量提示",
            chosenOption: "第15章揭示",
        });
        expect(plotFacadeMock.updateStoryDecision).toHaveBeenCalledWith(8, expect.objectContaining({
            status: "decided",
            decision: "第15章揭示",
            risk: "前置章需微量提示",
            chosenOption: "第15章揭示",
        }));

        await expect(tool?.executeWithContext?.(testContext(emptyHarness()), "plot-1", {
            projectRoot: "novel-1",
            action: "decide",
            decisionId: "8",
            status: "open",
        })).rejects.toThrow("action=decide 会把 status 置为 decided");

        await tool!.executeWithContext!(testContext(emptyHarness()), "plot-1", {
            projectRoot: "novel-1",
            action: "drop",
            decisionId: "8",
            note: "子情节删除,问题失效",
        });
        expect(plotFacadeMock.updateStoryDecision).toHaveBeenLastCalledWith(8, expect.objectContaining({
            status: "dropped",
            note: "子情节删除,问题失效",
        }));
    });

    it("省略 threadId/sceneId 时不会跨 Project 复用 plot.selection", async () => {
        const harness = {
            async readSessionContext() {
                return {
                    customState: {
                        [PLOT_SELECTION_STATE_KEY]: {
                            projectRoot: "novel-1",
                            threadId: "10",
                            sceneId: "20",
                        },
                    },
                };
            },
        } as unknown as NeuroAgentHarness;
        const tool = createPlotTools().find((item) => item.key === "save_story_thread");

        await expect(tool?.executeWithContext?.(testContext(harness), "plot-1", {
            projectRoot: "novel-2",
            action: "update",
            title: "Other novel thread",
        })).rejects.toThrow("plot.selection 属于 projectRoot=novel-1");
    });

    it("get_scene_world_context 返回 Scene 的 World Engine 上下文并更新 selection", async () => {
        const appended: unknown[] = [];
        const plotFacadeMock = plotFacade as {
            getSceneWorldContext: ReturnType<typeof vi.fn>;
            getStorySceneDetailDto: ReturnType<typeof vi.fn>;
            getStoryThreadDetailDto: ReturnType<typeof vi.fn>;
        };
        plotFacadeMock.getSceneWorldContext.mockResolvedValueOnce({
            slices: [{id: "slice-1", time: "第1日", title: "祭坛苏醒", summary: "火焰亮起。", kind: "scene", patchCount: 2}],
            subjectStates: [{subjectId: "hero", type: "character", name: "主角", attrs: {hp: 8}}],
            unresolvedSubjectIds: ["future-subject"],
        });
        const harness = {
            async readSessionContext() {
                return {customState: {}};
            },
            async appendCustomState(_sessionId: number, key: string, value: unknown) {
                appended.push({key, value});
                return {};
            },
        } as unknown as NeuroAgentHarness;
        const tool = createPlotTools().find((item) => item.key === "get_scene_world_context");

        expect(tool).toBeDefined();
        expect(Value.Check(tool!.parameters, {
            projectRoot: "novel-1",
            sceneId: "20",
        })).toBe(true);
        const result = await tool!.executeWithContext!(testContext(harness, "writer"), "plot-1", {
            projectRoot: "novel-1",
            sceneId: "20",
        });

        expect(plotFacadeMock.getSceneWorldContext).toHaveBeenCalledWith(20);
        expect(result.details).toEqual({
            slices: [expect.objectContaining({id: "slice-1"})],
            subjectStates: [expect.objectContaining({subjectId: "hero"})],
            unresolvedSubjectIds: ["future-subject"],
        });
        expect(appended).toEqual([{
            key: PLOT_SELECTION_STATE_KEY,
            value: expect.objectContaining({
                projectRoot: "novel-1",
                sceneId: "20",
            }),
        }]);
    });

    it("get_chapter_writer_brief 返回 markdown text 和完整 details，且不读写 plot.selection", async () => {
        const plotFacadeMock = plotFacade as {
            getChapterWriterBrief: ReturnType<typeof vi.fn>;
        };
        plotFacadeMock.getChapterWriterBrief.mockResolvedValueOnce({
            chapter: {id: "7", name: "001-opening", title: "开篇"},
            mode: "autonomous",
            status: "ready",
            scenes: [],
            totalScenes: 0,
            suggestedReading: [],
            warnings: [],
            suggestedBriefMarkdown: "# Brief\n\n写作交接。",
        });
        const harness = {
            readSessionContext: vi.fn(async () => ({customState: {}})),
            appendCustomState: vi.fn(async () => ({})),
        } as unknown as NeuroAgentHarness & {
            readSessionContext: ReturnType<typeof vi.fn>;
            appendCustomState: ReturnType<typeof vi.fn>;
        };
        const tool = createPlotTools().find((item) => item.key === "get_chapter_writer_brief");

        expect(tool).toBeDefined();
        expect(Value.Check(tool!.parameters, {
            projectRoot: "novel-1",
            chapterId: "7",
        })).toBe(true);
        const result = await tool!.executeWithContext!(testContext(harness), "plot-brief-1", {
            projectRoot: "novel-1",
            chapterId: "7",
        });

        expect(plotFacadeMock.getChapterWriterBrief).toHaveBeenCalledWith(7, "autonomous");
        expect(result.content).toEqual([{type: "text", text: "# Brief\n\n写作交接。"}]);
        expect(result.details).toMatchObject({
            chapter: {id: "7", name: "001-opening"},
            status: "ready",
            suggestedBriefMarkdown: "# Brief\n\n写作交接。",
        });
        expect(harness.readSessionContext).not.toHaveBeenCalled();
        expect(harness.appendCustomState).not.toHaveBeenCalled();
    });

    it("同路径 reopen 后拒绝旧 invocation generation，不查询 latest", async () => {
        const staleReady = {generation: 1, workspace: {ref: {projectRoot: "novel-1"}}} as ReadyProjectSessionRef;
        const harness = emptyHarness() as NeuroAgentHarness & {
            projectForInvocation: ReturnType<typeof vi.fn>;
        };
        harness.projectForInvocation = vi.fn(() => staleReady);
        requireActiveReadyProjectMock.mockClear();
        runReadyProjectOperationMock.mockImplementationOnce(async (ready) => {
            if (ready === staleReady) {
                throw new Error("stale Project generation");
            }
            throw new Error("unexpected generation");
        });
        const tool = createPlotTools().find((item) => item.key === "get_chapter_writer_brief");

        await expect(tool!.executeWithContext!({
            ...testContext(harness),
            currentProject: staleReady,
        }, "plot-stale-generation", {
            projectRoot: "novel-1",
            chapterId: "7",
        })).rejects.toThrow("stale Project generation");
        expect(requireActiveReadyProjectMock).not.toHaveBeenCalled();
    });

    it("省略 projectRoot 时复用当前 exact generation，不查询全局 ready session", async () => {
        const plotFacadeMock = plotFacade as {
            getChapterWriterBrief: ReturnType<typeof vi.fn>;
        };
        plotFacadeMock.getChapterWriterBrief.mockResolvedValueOnce({
            suggestedBriefMarkdown: "# Current",
        });
        requireActiveReadyProjectMock.mockClear();
        runReadyProjectOperationMock.mockClear();
        const tool = createPlotTools().find((item) => item.key === "get_chapter_writer_brief");

        expect(Value.Check(tool!.parameters, {chapterId: "7"})).toBe(true);
        await tool!.executeWithContext!(testContext(emptyHarness()), "plot-current-project", {
            chapterId: "7",
        });

        expect(requireActiveReadyProjectMock).not.toHaveBeenCalled();
        expect(runReadyProjectOperationMock).toHaveBeenCalledWith(currentReady, expect.any(Function));
        expect(activateReadyProjectModuleMock).toHaveBeenCalledWith(currentReady, expect.anything());
    });

    it("显式跨 Project override 在目标 generation operation 内执行", async () => {
        const plotFacadeMock = plotFacade as {
            getChapterWriterBrief: ReturnType<typeof vi.fn>;
        };
        plotFacadeMock.getChapterWriterBrief.mockResolvedValueOnce({
            suggestedBriefMarkdown: "# Override",
        });
        requireActiveReadyProjectMock.mockClear();
        runReadyProjectOperationMock.mockClear();
        const tool = createPlotTools().find((item) => item.key === "get_chapter_writer_brief");

        await tool!.executeWithContext!(testContext(emptyHarness()), "plot-cross-project", {
            projectRoot: "novel-2",
            chapterId: "7",
        });

        expect(requireActiveReadyProjectMock).toHaveBeenCalledWith({projectRoot: "novel-2"});
        expect(runReadyProjectOperationMock).toHaveBeenCalledWith(overrideReady, expect.any(Function));
        expect(activateReadyProjectModuleMock).toHaveBeenCalledWith(overrideReady, expect.anything());
    });

    it("writer profile 调用:details 收口为事实字段,不带任何意图级结构化数据", async () => {
        const plotFacadeMock = plotFacade as {
            getChapterWriterBrief: ReturnType<typeof vi.fn>;
        };
        plotFacadeMock.getChapterWriterBrief.mockResolvedValueOnce({
            chapter: {id: "7", name: "001-opening", title: "开篇"},
            mode: "autonomous",
            status: "ready",
            scenes: [{
                id: "10",
                threadId: "2",
                threadTitle: "主线",
                threadIsMain: true,
                threadSummary: "主线推进到神殿。",
                threadWritingTip: "保持悬念。",
                chapterId: "7",
                chapterSortOrder: 0,
                threadSortOrder: 0,
                title: "神殿相遇",
                status: "draft",
                summary: "主角在神殿遇到未来盟友。",
                purpose: "建立同盟关系。",
                writingTip: "突出压迫感。",
                worldAnchor: {},
                worldContext: null,
                warnings: [],
            }],
            totalScenes: 1,
            suggestedReading: [],
            promiseTasks: [{
                sceneId: "10",
                sceneTitle: "神殿相遇",
                promiseId: "31",
                promiseName: "f-necklace",
                promiseTitle: "项链伏笔",
                kind: "plant",
                note: "只写到项链发烫。",
                payoffExpectation: null,
            }],
            openDecisions: [],
            warnings: [],
            suggestedBriefMarkdown: "# Brief\n\n事实切片。",
            reviewChecklistMarkdown: "# Checklist\n\n必须隐藏：薇洛丝不知道项链是前作遗物",
        });
        const tool = createPlotTools().find((item) => item.key === "get_chapter_writer_brief");

        const result = await tool!.executeWithContext!(testContext(emptyHarness(), "writer"), "plot-brief-writer", {
            chapterId: "7",
        });

        // writer 只拿到事实视图文本。
        expect(result.content).toEqual([{type: "text", text: "# Brief\n\n事实切片。"}]);
        const details = result.details as Record<string, unknown>;
        expect(details).toMatchObject({status: "ready", suggestedBriefMarkdown: "# Brief\n\n事实切片。"});
        expect(details).not.toHaveProperty("promiseTasks");
        expect(details).not.toHaveProperty("openDecisions");
        expect(details).not.toHaveProperty("reviewChecklistMarkdown");
        const scenes = details.scenes as Array<Record<string, unknown>>;
        expect(scenes[0]).not.toHaveProperty("purpose");
        expect(scenes[0]).not.toHaveProperty("writingTip");
        expect(scenes[0]).not.toHaveProperty("threadSummary");
        expect(scenes[0]).not.toHaveProperty("threadWritingTip");
        expect(JSON.stringify(details)).not.toContain("必须隐藏");
    });

    it("get_story_keyframe 无 keyframeId 走列表模式,有 keyframeId 走详情", async () => {
        const plotFacadeMock = plotFacade as {
            listStoryKeyframes: ReturnType<typeof vi.fn>;
            getStoryKeyframeDto: ReturnType<typeof vi.fn>;
        };
        plotFacadeMock.listStoryKeyframes.mockResolvedValueOnce([{id: "3", status: "pending"}]);
        plotFacadeMock.getStoryKeyframeDto.mockResolvedValueOnce({id: "3", status: "pending"});
        const tool = createPlotTools().find((item) => item.key === "get_story_keyframe");

        expect(tool).toBeDefined();
        const listResult = await tool!.executeWithContext!(testContext(emptyHarness()), "plot-kf-list", {
            projectRoot: "novel-1",
        });
        expect(plotFacadeMock.listStoryKeyframes).toHaveBeenCalledWith();
        expect(listResult.details).toMatchObject([{id: "3"}]);

        const detailResult = await tool!.executeWithContext!(testContext(emptyHarness()), "plot-kf-detail", {
            projectRoot: "novel-1",
            keyframeId: "3",
        });
        expect(plotFacadeMock.getStoryKeyframeDto).toHaveBeenCalledWith(3);
        expect(detailResult.details).toMatchObject({id: "3"});
    });

    it("get_tween_keyframes 用解析后的数值 id 查询补间区间", async () => {
        const plotFacadeMock = plotFacade as {
            findTweenKeyframes: ReturnType<typeof vi.fn>;
        };
        plotFacadeMock.findTweenKeyframes.mockResolvedValueOnce([{id: "4", name: "k-mid"}]);
        const tool = createPlotTools().find((item) => item.key === "get_tween_keyframes");

        expect(tool).toBeDefined();
        expect(Value.Check(tool!.parameters, {fromKeyframeId: "3", toKeyframeId: "5"})).toBe(true);
        expect(Value.Check(tool!.parameters, {fromKeyframeId: "3"})).toBe(false);
        const result = await tool!.executeWithContext!(testContext(emptyHarness()), "plot-kf-tween", {
            projectRoot: "novel-1",
            fromKeyframeId: "3",
            toKeyframeId: "5",
        });

        expect(plotFacadeMock.findTweenKeyframes).toHaveBeenCalledWith(3, 5);
        expect(result.details).toMatchObject([{id: "4", name: "k-mid"}]);
    });

    it("save_story_keyframe action=create 要求 name/title/instant/irreversibleChanges,并拒绝 status/keyframeId", async () => {
        const tool = createPlotTools().find((item) => item.key === "save_story_keyframe");

        expect(tool).toBeDefined();
        await expect(tool?.executeWithContext?.(testContext(emptyHarness()), "plot-kf-create-missing", {
            projectRoot: "novel-1",
            action: "create",
            name: "k-tide-wait",
            title: "堤上守望",
            instant: "63172942200",
        })).rejects.toThrow("必须提供 name、title、instant 和 irreversibleChanges");

        await expect(tool?.executeWithContext?.(testContext(emptyHarness()), "plot-kf-create-status", {
            projectRoot: "novel-1",
            action: "create",
            name: "k-tide-wait",
            title: "堤上守望",
            instant: "63172942200",
            irreversibleChanges: ["郭莹立下军令状"],
            status: "confirmed",
        })).rejects.toThrow("action=create 不接受 status");

        await expect(tool?.executeWithContext?.(testContext(emptyHarness()), "plot-kf-create-id", {
            projectRoot: "novel-1",
            action: "create",
            keyframeId: "3",
            name: "k-tide-wait",
            title: "堤上守望",
            instant: "63172942200",
            irreversibleChanges: ["郭莹立下军令状"],
        })).rejects.toThrow("action=create 不接受 keyframeId");
    });

    it("save_story_keyframe action=create 透传 sceneId/source/note;action=update 拒绝 source 并透传裁决字段", async () => {
        const plotFacadeMock = plotFacade as {
            createStoryKeyframe: ReturnType<typeof vi.fn>;
            updateStoryKeyframe: ReturnType<typeof vi.fn>;
        };
        plotFacadeMock.createStoryKeyframe.mockResolvedValueOnce({id: "3", status: "pending"});
        plotFacadeMock.updateStoryKeyframe.mockResolvedValueOnce({id: "3", status: "overthrown"});
        const tool = createPlotTools().find((item) => item.key === "save_story_keyframe");

        await tool!.executeWithContext!(testContext(emptyHarness()), "plot-kf-create-ok", {
            projectRoot: "novel-1",
            action: "create",
            sceneId: "20",
            name: "k-list-taken",
            title: "名单到手",
            instant: "63172954800",
            irreversibleChanges: ["郭莹拿到假名单"],
            source: "derived",
            note: "从正文反推",
        });
        expect(plotFacadeMock.createStoryKeyframe).toHaveBeenCalledWith({
            name: "k-list-taken",
            title: "名单到手",
            instant: "63172954800",
            irreversibleChanges: ["郭莹拿到假名单"],
            sceneId: "20",
            source: "derived",
            note: "从正文反推",
        });

        await tool!.executeWithContext!(testContext(emptyHarness()), "plot-kf-update-ok", {
            projectRoot: "novel-1",
            action: "update",
            keyframeId: "3",
            status: "overthrown",
            decisionRefId: "8",
        });
        expect(plotFacadeMock.updateStoryKeyframe).toHaveBeenCalledWith(3, {status: "overthrown", decisionRefId: "8"});

        await expect(tool?.executeWithContext?.(testContext(emptyHarness()), "plot-kf-update-source", {
            projectRoot: "novel-1",
            action: "update",
            keyframeId: "3",
            source: "derived",
        })).rejects.toThrow("action=update 不接受 source");
    });

    it("writer 读关键帧:details 白名单剔除 note,leader 保留", async () => {
        const plotFacadeMock = plotFacade as {
            getStoryKeyframeDto: ReturnType<typeof vi.fn>;
        };
        plotFacadeMock.getStoryKeyframeDto.mockResolvedValue({
            id: "3",
            storyId: "1",
            sceneId: null,
            name: "k-tide-wait",
            title: "堤上守望",
            instant: "63172942200",
            irreversibleChanges: ["郭莹立下军令状"],
            source: "author",
            status: "pending",
            decisionRefId: null,
            note: "必须隐瞒芥末在场",
            createdAt: "2026-09-14T00:00:00.000Z",
            updatedAt: "2026-09-14T00:00:00.000Z",
        });
        const tool = createPlotTools().find((item) => item.key === "get_story_keyframe");

        const writerResult = await tool!.executeWithContext!(testContext(emptyHarness(), "writer"), "plot-kf-writer", {
            projectRoot: "novel-1",
            keyframeId: "3",
        });
        const writerDetails = writerResult.details as Record<string, unknown>;
        expect(writerDetails).toMatchObject({id: "3", irreversibleChanges: ["郭莹立下军令状"]});
        expect(writerDetails).not.toHaveProperty("note");
        expect(JSON.stringify(writerDetails)).not.toContain("必须隐瞒");

        const leaderResult = await tool!.executeWithContext!(testContext(emptyHarness()), "plot-kf-leader", {
            projectRoot: "novel-1",
            keyframeId: "3",
        });
        expect((leaderResult.details as Record<string, unknown>).note).toBe("必须隐瞒芥末在场");
    });
});

/**
 * 构造工具执行上下文。
 */
function testContext(harness: NeuroAgentHarness, profileKey = "leader.default"): ToolExecutionContext {
    if (!("projectForInvocation" in harness)) {
        Object.assign(harness, {
            projectForInvocation: vi.fn(() => currentReady),
        });
    }
    return {
        harness,
        sessionId: 1,
        profileKey,
        workspaceRoot: absoluteFsPath(testHostPath("plot-tools-test")),
        currentProject: currentReady,
        invocationId: "plot-tools-test-invocation",
    };
}

/**
 * 空 plot.selection 的最小 harness mock；appendCustomState 静默吞掉 selection 写入。
 */
function emptyHarness(): NeuroAgentHarness {
    return {
        async readSessionContext() {
            return {customState: {}};
        },
        async appendCustomState() {
            return {};
        },
    } as unknown as NeuroAgentHarness;
}
