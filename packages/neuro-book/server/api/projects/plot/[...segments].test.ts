import fs from "node:fs/promises";
import path from "node:path";
import {PassThrough} from "node:stream";
import {createClient} from "@libsql/client";
import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi} from "vitest";
import {
    PROJECT_PLOT_WORLD_MODULE_TOKEN,
    type ProjectPlotWorldHandle,
} from "nbook/server/plot";
import {resolveProjectDatabasePath, toSqliteFileUrl} from "nbook/server/workspace-files/project-workspace";
import {resolveRuntimeWorkspaceRoot} from "nbook/server/workspace-files/workspace-runtime-root";
import {collectReleasedSqliteHandles} from "nbook/server/workspace-files/sqlite-handle-release";
import {activateReadyProjectModule, requireActiveReadyProject} from "nbook/server/workspace-files/project-session";
import {
    openProjectForTest,
    removeProjectWorkspaceForTest,
} from "nbook/server/workspace-files/project-session-test-utils";
import {projectWorkspaceRef} from "nbook/server/workspace-files/project-identity";
import {
    createIsolatedWorkspaceAssets,
    type IsolatedWorkspaceAssets,
} from "nbook/server/workspace-files/test-workspace-fixture";

vi.unmock("nbook/server/plot");

vi.mock("h3", async () => {
    const actual = await vi.importActual<typeof import("h3")>("h3");
    return {
        ...actual,
        readBody: async (event: {body?: unknown}) => event.body,
        getQuery: (event: {query?: Record<string, unknown>}) => event.query ?? {},
    };
});

const createdProjects: string[] = [];

describe("/api/projects/plot", {timeout: 30_000}, () => {
    let assets: IsolatedWorkspaceAssets;

    beforeAll(async () => {
        assets = await createIsolatedWorkspaceAssets({purpose: "plot-api-tests"});
    });

    beforeEach(() => {
        Object.assign(globalThis, {
            defineEventHandler: (handler: unknown) => handler,
            defineRouteMeta: () => undefined,
            readBody: (event: {body?: unknown}) => event.body,
            getQuery: (event: {query?: Record<string, unknown>}) => event.query ?? {},
            createError: (input: {statusCode?: number; message?: string}) => {
                const error = new Error(input.message ?? "未知错误") as Error & {statusCode?: number};
                error.statusCode = input.statusCode;
                return error;
            },
        });
    }, 30_000);

    afterEach(async () => {
        for (const projectRootName of createdProjects.splice(0)) {
            await removeProjectWorkspaceForTest(projectRootName);
        }
    });

    afterAll(async () => {
        await assets.dispose();
    });

    it("GET /scenes/:sceneId/world-context 返回已解析 subject 上下文和 unresolved 占位", async () => {
        const projectRootName = await createProject();
        const {world: worldEngineFacade} = await plotWorldForProject(projectRootName);
        const handler = (await import("nbook/server/api/projects/plot/[...segments]")).default;
        const thread = await callApi(handler, projectRootName, "POST", "threads", {
            name: "main",
            title: "主线",
        });
        await worldEngineFacade.writeSlice({
            instant: 120n,
            title: "抵达神殿",
            summary: "主角进入神殿，发现灯火昏暗。",
            patches: [
                {subjectId: "hero", type: "character", name: "主角", path: "/hp", op: "replace", value: 8},
                {subjectId: "temple", type: "location", name: "荒野神殿", path: "/light", op: "replace", value: "dim"},
            ],
        });
        await worldEngineFacade.writeSlice({
            instant: 140n,
            title: "远方商队",
            patches: [{subjectId: "merchant", type: "character", name: "商人", path: "/hp", op: "replace", value: 10}],
        });

        const scene = await callApi(handler, projectRootName, "POST", "scenes", {
            threadId: readId(thread),
            title: "神殿相遇",
            worldAnchor: {
                startTime: "复兴纪元1日 00:01:40",
                endTime: "复兴纪元1日 00:03:20",
                startInstant: null,
                endInstant: null,
                subjectIds: ["hero", "future-ally"],
                locationSubjectId: "temple",
            },
        });

        const context = await callApi(handler, projectRootName, "GET", `scenes/${readId(scene)}/world-context`);

        expect(context).toMatchObject({
            unresolvedSubjectIds: ["future-ally"],
            slices: [
                {
                    title: "抵达神殿",
                    summary: "主角进入神殿，发现灯火昏暗。",
                    patchCount: expect.any(Number),
                },
            ],
            subjectStates: [
                {subjectId: "hero", type: "character", name: "主角", attrs: {hp: 8}},
                {subjectId: "temple", type: "location", name: "荒野神殿", attrs: {light: "dim"}},
            ],
        });
    });

    it("GET /chapter-writer-brief 返回章节 Scene / World Context brief", async () => {
        const projectRootName = await createProject();
        const {world: worldEngineFacade} = await plotWorldForProject(projectRootName);
        const handler = (await import("nbook/server/api/projects/plot/[...segments]")).default;
        const chapter = await callApi(handler, projectRootName, "POST", "chapters", {
            name: "001-opening",
            title: "开篇",
            brief: {mustHide: "薇洛丝不知道项链是前作遗物"},
        });
        const thread = await callApi(handler, projectRootName, "POST", "threads", {
            name: "main",
            title: "主线",
            summary: "主线推进到神殿。",
            writingTip: "保持紧张。",
        });
        await worldEngineFacade.writeSlice({
            instant: 120n,
            title: "神殿灯火",
            summary: "神殿灯火变暗。",
            patches: [
                {subjectId: "hero", type: "character", name: "主角", path: "/hp", op: "replace", value: 8},
                {subjectId: "temple", type: "location", name: "荒野神殿", path: "/light", op: "replace", value: "dim"},
            ],
        });
        await callApi(handler, projectRootName, "POST", "scenes", {
            threadId: readId(thread),
            chapterId: readId(chapter),
            title: "神殿相遇",
            summary: "主角在神殿遇到未来盟友。",
            purpose: "建立同盟关系。",
            writingTip: "突出压迫感。",
            worldAnchor: {
                startTime: "复兴纪元1日 00:01:40",
                endTime: "复兴纪元1日 00:03:20",
                startInstant: null,
                endInstant: null,
                subjectIds: ["hero"],
                locationSubjectId: "temple",
            },
        });

        const brief = await callApi(handler, projectRootName, "GET", "chapter-writer-brief", undefined, {chapterId: readId(chapter)});

        expect(brief).toMatchObject({
            chapter: {
                name: "001-opening",
                title: "开篇",
            },
            mode: "autonomous",
            status: "ready",
            totalScenes: 1,
            scenes: [
                {
                    title: "神殿相遇",
                    threadSummary: "主线推进到神殿。",
                    writingTip: "突出压迫感。",
                    worldContext: {
                        slices: [
                            {
                                title: "神殿灯火",
                            },
                        ],
                    },
                },
            ],
            suggestedBriefMarkdown: expect.stringContaining("神殿相遇"),
        });
        // autonomous 默认:writer 视图只给查询提示,不展开状态切面,也不含任何意图级内容。
        const autonomousMd = (brief as {suggestedBriefMarkdown: string}).suggestedBriefMarkdown;
        expect(autonomousMd).toContain("World 查询提示");
        expect(autonomousMd).not.toContain("神殿灯火");
        expect(autonomousMd).not.toContain("## 信息控制");
        expect(autonomousMd).not.toContain("- 本场目的:");
        expect(autonomousMd).not.toContain("- 线索脉络:");
        // 意图级内容改由评审清单承载。
        const autonomousChecklist = (brief as {reviewChecklistMarkdown: string}).reviewChecklistMarkdown;
        expect(autonomousChecklist).toContain("必须隐藏：薇洛丝不知道项链是前作遗物");
        expect(autonomousChecklist).toContain("- 本场目的: 建立同盟关系。");
        expect(autonomousChecklist).toContain("- 线索脉络: 主线推进到神殿。");

        // curated:同一章展开 World Context 状态摘要,writer 视图仍只有事实。
        const curated = await callApi(handler, projectRootName, "GET", "chapter-writer-brief", undefined, {chapterId: readId(chapter), mode: "curated"});
        expect((curated as {mode: string}).mode).toBe("curated");
        const curatedMd = (curated as {suggestedBriefMarkdown: string}).suggestedBriefMarkdown;
        expect(curatedMd).toContain("神殿灯火");
        expect(curatedMd).not.toContain("\"hp\"");
        expect(curatedMd).not.toContain("## 信息控制");

        // slice-only:展开事实截面,writer 视图同样只有事实。
        const sliceOnly = await callApi(handler, projectRootName, "GET", "chapter-writer-brief", undefined, {chapterId: readId(chapter), mode: "slice-only"});
        expect((sliceOnly as {mode: string}).mode).toBe("slice-only");
        const sliceOnlyMd = (sliceOnly as {suggestedBriefMarkdown: string}).suggestedBriefMarkdown;
        expect(sliceOnlyMd).toContain("神殿灯火");
        expect(sliceOnlyMd).not.toContain("## 信息控制");
        expect(sliceOnlyMd).not.toContain("## 禁写");
    });

    it("缺 projectRoot query 时返回 400", async () => {
        const handler = (await import("nbook/server/api/projects/plot/[...segments]")).default;

        await expect(handler({
            method: "GET",
            path: "/api/projects/plot/story",
            query: {},
            context: {params: {segments: "story"}},
        })).rejects.toMatchObject({
            statusCode: 400,
            data: {code: "INVALID_PROJECT_ROOT"},
        });
    });

    it("未 open 的 Project 返回 PROJECT_NOT_OPEN", async () => {
        const projectRootName = await createProject({open: false});
        const handler = (await import("nbook/server/api/projects/plot/[...segments]")).default;

        await expect(callApi(handler, projectRootName, "GET", "story")).rejects.toMatchObject({
            statusCode: 409,
            data: {
                code: "PROJECT_NOT_OPEN",
                projectRoot: projectRootName,
            },
        });
    });

    it("非法 sceneId 返回 400", async () => {
        const projectRootName = await createProject();
        const handler = (await import("nbook/server/api/projects/plot/[...segments]")).default;

        await expect(callApi(handler, projectRootName, "GET", "scenes/not-a-number/world-context")).rejects.toMatchObject({
            statusCode: 400,
            message: "sceneId 必须是正整数",
        });
    });

    it("Scene 不存在时返回 404", async () => {
        const projectRootName = await createProject();
        const handler = (await import("nbook/server/api/projects/plot/[...segments]")).default;

        await expect(callApi(handler, projectRootName, "GET", "scenes/999/world-context")).rejects.toMatchObject({
            statusCode: 404,
            message: "剧情场景不存在",
        });
    });

    it("Scene 时间未连接时返回 400", async () => {
        const projectRootName = await createProject();
        const handler = (await import("nbook/server/api/projects/plot/[...segments]")).default;
        const thread = await callApi(handler, projectRootName, "POST", "threads", {
            name: "main",
            title: "主线",
        });
        const scene = await callApi(handler, projectRootName, "POST", "scenes", {
            threadId: readId(thread),
            title: "未定时间",
            worldAnchor: {
                startTime: null,
                endTime: null,
                startInstant: null,
                endInstant: null,
                subjectIds: ["future-hero"],
                locationSubjectId: null,
            },
        });

        await expect(callApi(handler, projectRootName, "GET", `scenes/${readId(scene)}/world-context`)).rejects.toMatchObject({
            statusCode: 400,
            message: "Scene 尚未设置完整 World Engine 时间范围",
        });
    });

    it("全部 subject 都是占位时返回空上下文和 unresolved 列表", async () => {
        const projectRootName = await createProject();
        const handler = (await import("nbook/server/api/projects/plot/[...segments]")).default;
        const thread = await callApi(handler, projectRootName, "POST", "threads", {
            name: "main",
            title: "主线",
        });
        const scene = await callApi(handler, projectRootName, "POST", "scenes", {
            threadId: readId(thread),
            title: "未来伏笔",
            worldAnchor: {
                startTime: "复兴纪元1日 00:01:40",
                endTime: "复兴纪元1日 00:03:20",
                startInstant: null,
                endInstant: null,
                subjectIds: ["future-hero"],
                locationSubjectId: "future-place",
            },
        });

        await expect(callApi(handler, projectRootName, "GET", `scenes/${readId(scene)}/world-context`)).resolves.toEqual({
            slices: [],
            subjectStates: [],
            unresolvedSubjectIds: ["future-hero", "future-place"],
        });
    });

    it("Project 缺少 calendar.ts 时 GET tree 和 workbench 仍可读取 Plot", async () => {
        const projectRootName = await createProject({withCalendar: false});
        const handler = (await import("nbook/server/api/projects/plot/[...segments]")).default;
        const thread = await callApi(handler, projectRootName, "POST", "threads", {
            name: "main",
            title: "主线",
        });
        const scene = await callApi(handler, projectRootName, "POST", "scenes", {
            threadId: readId(thread),
            title: "未来伏笔",
            worldAnchor: {
                startTime: null,
                endTime: null,
                startInstant: null,
                endInstant: null,
                subjectIds: ["future-hero"],
                locationSubjectId: "future-place",
            },
        });

        await expect(callApi(handler, projectRootName, "GET", "tree")).resolves.toMatchObject({
            ungroupedThreads: [
                {
                    scenes: [
                        {
                            id: readId(scene),
                            worldAnchor: {
                                subjects: [{id: "future-hero", name: "future-hero", type: "unknown", resolved: false}],
                                locationSubject: {id: "future-place", name: "future-place", type: "unknown", resolved: false},
                                unresolvedSubjectIds: ["future-hero", "future-place"],
                            },
                        },
                    ],
                },
            ],
        });
        await expect(callApi(handler, projectRootName, "GET", "workbench")).resolves.toMatchObject({
            ungroupedThreads: [
                {
                    scenes: [
                        {
                            id: readId(scene),
                            worldAnchor: {
                                unresolvedSubjectIds: ["future-hero", "future-place"],
                            },
                        },
                    ],
                },
            ],
        });
    });

    it("Project 缺少 calendar.ts 且 Scene 已有 raw instant 时保留 raw 时间并降级 formatted time", async () => {
        const projectRootName = await createProject({withCalendar: false});
        const handler = (await import("nbook/server/api/projects/plot/[...segments]")).default;
        const thread = await callApi(handler, projectRootName, "POST", "threads", {
            name: "main",
            title: "主线",
        });
        const scene = await callApi(handler, projectRootName, "POST", "scenes", {
            threadId: readId(thread),
            title: "旧数据 Scene",
        });
        await updateSceneRawInstants(projectRootName, readId(scene), 100n, 200n);

        await expect(callApi(handler, projectRootName, "GET", "tree")).resolves.toMatchObject({
            ungroupedThreads: [
                {
                    scenes: [
                        {
                            id: readId(scene),
                            worldAnchor: {
                                startInstant: "100",
                                endInstant: "200",
                                startTime: null,
                                endTime: null,
                            },
                        },
                    ],
                },
            ],
        });
    });

    it("calendar.ts 损坏且 Scene 需要格式化 raw instant 时继续返回配置错误", async () => {
        const projectRootName = await createProject({calendarSource: brokenCalendarSource()});
        const handler = (await import("nbook/server/api/projects/plot/[...segments]")).default;
        const thread = await callApi(handler, projectRootName, "POST", "threads", {
            name: "main",
            title: "主线",
        });
        const scene = await callApi(handler, projectRootName, "POST", "scenes", {
            threadId: readId(thread),
            title: "坏日历 Scene",
        });
        await updateSceneRawInstants(projectRootName, readId(scene), 100n, 200n);

        await expect(callApi(handler, projectRootName, "GET", "tree")).rejects.toThrow("calendar.ts 加载失败");
    });

    it("worldAnchor 建议生成、拒绝和确认会保留已有时间锚点", async () => {
        const projectRootName = await createProject();
        const root = projectDirectory(projectRootName);
        const handler = (await import("nbook/server/api/projects/plot/[...segments]")).default;
        await fs.mkdir(path.join(root, "lorebook", "character", "hero"), {recursive: true});
        await fs.mkdir(path.join(root, "lorebook", "location", "temple"), {recursive: true});
        await fs.writeFile(path.join(root, "lorebook", "character", "hero", "index.md"), [
            "---",
            "title: 主角",
            "type: character",
            "status: active",
            "aliases:",
            "  - 阿主",
            "---",
            "",
        ].join("\n"), "utf8");
        await fs.writeFile(path.join(root, "lorebook", "location", "temple", "index.md"), [
            "---",
            "title: 荒野神殿",
            "type: location",
            "status: active",
            "---",
            "",
        ].join("\n"), "utf8");

        const chapter = await callApi(handler, projectRootName, "POST", "chapters", {
            name: "opening",
            title: "开篇",
        });
        const thread = await callApi(handler, projectRootName, "POST", "threads", {
            name: "main",
            title: "主线",
        });
        const scene = await callApi(handler, projectRootName, "POST", "scenes", {
            threadId: readId(thread),
            chapterId: readId(chapter),
            title: "神殿相遇",
            worldAnchor: {
                startTime: "复兴纪元1日 00:01:40",
                endTime: "复兴纪元1日 00:03:20",
                startInstant: null,
                endInstant: null,
                subjectIds: [],
                locationSubjectId: null,
            },
        });
        await fs.writeFile(path.join(root, "manuscript", "001", "001-opening", "index.md"), [
            "---",
            "title: 开篇",
            "chapter: opening",
            "---",
            "",
            "主角走入荒野神殿。主角看见阿主留下的火光。",
        ].join("\n"), "utf8");

        const generated = await callApi(handler, projectRootName, "POST", "world-anchor-suggestions/generate") as {
            generated: number;
            store: {suggestions: Array<{suggestionId: string; subjectIds: string[]; locationSubjectId: string | null}>};
        };
        expect(generated.generated).toBe(1);
        const firstSuggestion = generated.store.suggestions[0];
        expect(firstSuggestion).toMatchObject({subjectIds: ["hero"], locationSubjectId: "temple"});
        if (!firstSuggestion) throw new Error("测试没有生成 worldAnchor 建议");

        const rejected = await callApi(handler, projectRootName, "POST", "world-anchor-suggestions/reject", {
            suggestionIds: [firstSuggestion.suggestionId],
        });
        expect(rejected).toMatchObject({outcomes: [{suggestionId: firstSuggestion.suggestionId, status: "rejected"}]});
        const afterReject = await callApi(handler, projectRootName, "GET", "world-anchor-suggestions") as {suggestions: Array<{status: string}>};
        expect(afterReject.suggestions).toHaveLength(1);
        expect(afterReject.suggestions[0]).toMatchObject({status: "rejected"});

        const regenerated = await callApi(handler, projectRootName, "POST", "world-anchor-suggestions/generate") as {
            store: {suggestions: Array<{suggestionId: string; status: string}>};
        };
        const pendingSuggestion = regenerated.store.suggestions.find((suggestion) => suggestion.status === "pending");
        if (!pendingSuggestion) throw new Error("测试没有重新生成 pending 建议");
        await expect(callApi(handler, projectRootName, "POST", "world-anchor-suggestions/confirm", {suggestionIds: []}))
            .rejects.toThrow("suggestionIds");
        await expect(callApi(handler, projectRootName, "POST", "world-anchor-suggestions/confirm", {suggestionIds: ["x".repeat(161)]}))
            .rejects.toThrow("suggestionId 过长");
        await expect(callApi(handler, projectRootName, "POST", "world-anchor-suggestions/confirm", {suggestionIds: ["x".repeat(16 * 1024)]}))
            .rejects.toThrow("请求体超过允许大小");

        const confirmed = await callApi(handler, projectRootName, "POST", "world-anchor-suggestions/confirm", {
            suggestionIds: [pendingSuggestion.suggestionId],
        });
        expect(confirmed).toMatchObject({outcomes: [{suggestionId: pendingSuggestion.suggestionId, status: "confirmed"}]});

        const updated = await callApi(handler, projectRootName, "GET", `scenes/${readId(scene)}`) as {worldAnchor: {subjectIds: string[]; locationSubjectId: string | null; startInstant: string | null; endInstant: string | null}};
        expect(updated.worldAnchor).toMatchObject({
            subjectIds: ["hero"],
            locationSubjectId: "temple",
            startInstant: "100",
            endInstant: "200",
        });
    });

    it("worldAnchor 建议只匹配正文主体，不把 frontmatter 名称当作出场证据", async () => {
        const projectRootName = await createProject();
        const root = projectDirectory(projectRootName);
        const handler = (await import("nbook/server/api/projects/plot/[...segments]")).default;
        await fs.mkdir(path.join(root, "lorebook", "character", "hero"), {recursive: true});
        await fs.writeFile(path.join(root, "lorebook", "character", "hero", "index.md"), [
            "---",
            "title: 主角",
            "type: character",
            "status: active",
            "---",
            "",
        ].join("\n"), "utf8");
        const chapter = await callApi(handler, projectRootName, "POST", "chapters", {name: "opening", title: "开篇"});
        const thread = await callApi(handler, projectRootName, "POST", "threads", {name: "main", title: "主线"});
        await callApi(handler, projectRootName, "POST", "scenes", {
            threadId: readId(thread), chapterId: readId(chapter), title: "空场",
        });
        await fs.writeFile(path.join(root, "manuscript", "001", "001-opening", "index.md"), [
            "---",
            "title: 主角",
            "chapter: opening",
            "---",
            "",
            "这一章正文没有登记角色姓名。",
        ].join("\n"), "utf8");

        const generated = await callApi(handler, projectRootName, "POST", "world-anchor-suggestions/generate") as {generated: number; failed: number};
        expect(generated).toEqual(expect.objectContaining({generated: 0, failed: 0}));
    });

    it("worldAnchor legacy 回退不读取已明确绑定给其他章节的正文", async () => {
        const projectRootName = await createProject();
        const root = projectDirectory(projectRootName);
        const handler = (await import("nbook/server/api/projects/plot/[...segments]")).default;
        await fs.mkdir(path.join(root, "lorebook", "character", "hero"), {recursive: true});
        await fs.writeFile(path.join(root, "lorebook", "character", "hero", "index.md"), [
            "---",
            "title: 主角",
            "type: character",
            "status: active",
            "---",
            "",
        ].join("\n"), "utf8");
        const target = await callApi(handler, projectRootName, "POST", "chapters", {name: "target", title: "开篇"});
        await callApi(handler, projectRootName, "POST", "chapters", {name: "other", title: "其他章"});
        const thread = await callApi(handler, projectRootName, "POST", "threads", {name: "main", title: "主线"});
        await callApi(handler, projectRootName, "POST", "scenes", {
            threadId: readId(thread), chapterId: readId(target), title: "目标场",
        });
        await fs.writeFile(path.join(root, "manuscript", "001", "001-opening", "index.md"), [
            "---",
            "title: 开篇",
            "chapter: other",
            "---",
            "",
            "主角只属于其他章节的正文。",
        ].join("\n"), "utf8");

        const generated = await callApi(handler, projectRootName, "POST", "world-anchor-suggestions/generate") as {generated: number; failed: number};
        expect(generated).toEqual(expect.objectContaining({generated: 0, failed: 1}));
    });

    it("worldAnchor 确认遇到章节内损坏 Scene 时整体回滚并保留 pending", async () => {
        const projectRootName = await createProject();
        const root = projectDirectory(projectRootName);
        const handler = (await import("nbook/server/api/projects/plot/[...segments]")).default;
        await fs.mkdir(path.join(root, "lorebook", "character", "hero"), {recursive: true});
        await fs.writeFile(path.join(root, "lorebook", "character", "hero", "index.md"), [
            "---",
            "title: 主角",
            "type: character",
            "status: active",
            "---",
            "",
        ].join("\n"), "utf8");
        const chapter = await callApi(handler, projectRootName, "POST", "chapters", {name: "opening", title: "开篇"});
        const thread = await callApi(handler, projectRootName, "POST", "threads", {name: "main", title: "主线"});
        const firstScene = await callApi(handler, projectRootName, "POST", "scenes", {
            threadId: readId(thread), chapterId: readId(chapter), title: "第一场",
        });
        const secondScene = await callApi(handler, projectRootName, "POST", "scenes", {
            threadId: readId(thread), chapterId: readId(chapter), title: "第二场",
        });
        await fs.writeFile(path.join(root, "manuscript", "001", "001-opening", "index.md"), [
            "---",
            "title: 开篇",
            "chapter: opening",
            "---",
            "",
            "主角赶到门前，主角推开石门。",
        ].join("\n"), "utf8");
        const generated = await callApi(handler, projectRootName, "POST", "world-anchor-suggestions/generate") as {
            store: {suggestions: Array<{suggestionId: string}>};
        };
        const suggestion = generated.store.suggestions[0];
        if (!suggestion) throw new Error("测试没有生成 worldAnchor 建议");
        await updateSceneRawSubjectIds(projectRootName, readId(secondScene), "{损坏的 JSON");

        const confirmation = await callApi(handler, projectRootName, "POST", "world-anchor-suggestions/confirm", {
            suggestionIds: [suggestion.suggestionId],
        });
        expect(confirmation).toMatchObject({
            outcomes: [{suggestionId: suggestion.suggestionId, status: "failed", appliedScenes: []}],
            store: {suggestions: [{suggestionId: suggestion.suggestionId, status: "pending"}]},
        });
        const firstAfterFailure = await callApi(handler, projectRootName, "GET", `scenes/${readId(firstScene)}`) as {worldAnchor: {subjectIds: string[]}};
        expect(firstAfterFailure.worldAnchor.subjectIds).toEqual([]);
    });

    it("Keyframe CRUD + 补间区间 + 裁决留痕(写作宪法第三条/第六条)", async () => {
        const handler = (await import("nbook/server/api/projects/plot/[...segments]")).default;
        const projectRootName = await createProject();

        // 创建两帧(恒 pending)。
        const first = await callApi(handler, projectRootName, "POST", "keyframes", {
            name: "k-necklace-lost",
            title: "薇洛丝失去项链",
            instant: "100",
            irreversibleChanges: ["薇洛丝失去项链"],
        });
        expect(first).toMatchObject({status: "pending", instant: "100", source: "author"});
        const second = await callApi(handler, projectRootName, "POST", "keyframes", {
            name: "k-grisha-dead",
            title: "格里沙之死",
            instant: "300",
            irreversibleChanges: ["格里沙死亡"],
        });

        // 列表按 instant 升序。
        const list = await callApi(handler, projectRootName, "GET", "keyframes") as Array<{name: string}>;
        expect(list.map((keyframe) => keyframe.name)).toEqual(["k-necklace-lost", "k-grisha-dead"]);

        // 补间区间 (起点, 终点]。
        const tween = await callApi(handler, projectRootName, "GET", "keyframes/tween", undefined, {
            fromKeyframeId: readId(first),
            toKeyframeId: readId(second),
        }) as Array<{name: string}>;
        expect(tween.map((keyframe) => keyframe.name)).toEqual(["k-grisha-dead"]);

        // 裁决推翻必须挂 decisionRefId(宪法第六条推翻留痕)。
        await expect(callApi(handler, projectRootName, "PATCH", `keyframes/${readId(first)}`, {status: "overthrown"}))
            .rejects.toThrow("decisionRefId");

        const decision = await callApi(handler, projectRootName, "POST", "decisions", {
            name: "d-necklace-ruling",
            title: "项链去向裁决",
            question: "薇洛丝是否真的失去项链?",
        });
        const ruled = await callApi(handler, projectRootName, "PATCH", `keyframes/${readId(first)}`, {
            status: "overthrown",
            decisionRefId: readId(decision),
        });
        expect(ruled).toMatchObject({status: "overthrown"});
        expect((ruled as {decisionRefId: string}).decisionRefId).toBe(readId(decision));
    });
    it("POST /consistency-audit 对明确正文生成只读三源报告", async () => {
        const projectRootName = await createProject();
        const handler = (await import("nbook/server/api/projects/plot/consistency-audit.post")).default;
        const plotHandler = (await import("nbook/server/api/projects/plot/[...segments]")).default;
        const chapter = await callApi(plotHandler, projectRootName, "POST", "chapters", {name: "opening", title: "开篇"});

        const report = await callApi(handler, projectRootName, "POST", "", {
            chapterId: readId(chapter),
            settlementText: ["## 本章结算", "### 新增事实", "- 无"].join("\n"),
            prosePath: "manuscript/001/001-opening/index.md",
            finalizedWorldSliceIds: [],
        }) as {chapterId: string; promise: {ok: boolean}; world: {availability: string}; text: {availability: string}};

        expect(report).toMatchObject({
            chapterId: readId(chapter),
            promise: {ok: true},
            world: {availability: "ok"},
            text: {availability: "ok"},
        });
    });

    it("GET /promises/overdue 按章节 sortOrder 返回到期未兑现承诺及去重计数", async () => {
        const projectRootName = await createProject();
        const handler = (await import("nbook/server/api/projects/plot/[...segments]")).default;
        const thread = await callApi(handler, projectRootName, "POST", "threads", {name: "main", title: "主线"});
        const deadlineChapter = await callApi(handler, projectRootName, "POST", "chapters", {
            name: "deadline", title: "期限章",
        });
        const latestChapter = await callApi(handler, projectRootName, "POST", "chapters", {
            name: "latest", title: "已写章",
        });
        // 有意令后建的 deadlineChapter 排序更晚，证明比较基于 sortOrder 而非数据库 id。
        await callApi(handler, projectRootName, "PATCH", `chapters/${readId(deadlineChapter)}`, {sortOrder: 20});
        await callApi(handler, projectRootName, "PATCH", `chapters/${readId(latestChapter)}`, {sortOrder: 30});
        await callApi(handler, projectRootName, "POST", "scenes", {
            threadId: readId(thread), chapterId: readId(latestChapter), title: "已完成场", status: "written",
        });
        const overdueFirst = await callApi(handler, projectRootName, "POST", "promises", {
            name: "old-debt", title: "旧债", deadlineChapterId: readId(deadlineChapter), importance: "low",
        });
        const overdueSecond = await callApi(handler, projectRootName, "POST", "promises", {
            name: "same-deadline", title: "同期限", deadlineChapterId: readId(deadlineChapter), importance: "high",
        });
        const futureChapter = await callApi(handler, projectRootName, "POST", "chapters", {
            name: "future", title: "未来章",
        });
        await callApi(handler, projectRootName, "PATCH", `chapters/${readId(futureChapter)}`, {sortOrder: 40});
        await callApi(handler, projectRootName, "POST", "promises", {
            name: "future-debt", title: "未来债", deadlineChapterId: readId(futureChapter),
        });
        const fulfilled = await callApi(handler, projectRootName, "POST", "promises", {
            name: "paid-debt", title: "已还债", deadlineChapterId: readId(deadlineChapter),
        });
        await callApi(handler, projectRootName, "PATCH", `promises/${readId(fulfilled)}`, {status: "fulfilled"});

        const overdue = await callApi(handler, projectRootName, "GET", "promises/overdue") as {
            promises: Array<{id: string}>;
            overduePromiseCount: number;
            overdueChapterCount: number;
            latestWrittenChapterOrder: number | null;
        };

        expect(overdue).toMatchObject({
            overduePromiseCount: 2,
            overdueChapterCount: 1,
            latestWrittenChapterOrder: 30,
        });
        expect(overdue.promises.map((promise) => promise.id)).toEqual([readId(overdueSecond), readId(overdueFirst)]);
    });

    it("GET /promises/overdue 没有已写 Scene 时返回空结果", async () => {
        const projectRootName = await createProject();
        const handler = (await import("nbook/server/api/projects/plot/[...segments]")).default;
        const chapter = await callApi(handler, projectRootName, "POST", "chapters", {name: "deadline", title: "期限章"});
        await callApi(handler, projectRootName, "POST", "promises", {
            name: "unverified-debt", title: "未验证债", deadlineChapterId: readId(chapter),
        });

        await expect(callApi(handler, projectRootName, "GET", "promises/overdue")).resolves.toEqual({
            promises: [],
            overduePromiseCount: 0,
            overdueChapterCount: 0,
            latestWrittenChapterOrder: null,
        });
    });
});

async function createProject(options: {withCalendar?: boolean; calendarSource?: string; open?: boolean} = {}): Promise<string> {
    const slug = `plot-api-test-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const projectRootName = slug;
    const root = projectDirectory(projectRootName);
    await fs.mkdir(path.join(root, "world-engine", "schema"), {recursive: true});
    await fs.mkdir(path.join(root, "manuscript", "001", "001-opening"), {recursive: true});
    await fs.writeFile(path.join(root, "project.yaml"), "kind: novel\ntitle: Plot API Test\nsummary: ''\n", "utf-8");
    await fs.writeFile(path.join(root, "manuscript", "001", "001-opening", "index.md"), "---\ntitle: 开篇\n---\n", "utf-8");
    await fs.writeFile(path.join(root, "world-engine", "schema", "index.ts"), schemaSource(), "utf-8");
    if (options.withCalendar !== false) {
        await fs.writeFile(path.join(root, "world-engine", "calendar.ts"), options.calendarSource ?? calendarSource(), "utf-8");
    }
    createdProjects.push(projectRootName);
    if (options.open !== false) {
        await openProjectForTest(projectRootName);
    }
    return projectRootName;
}

/** 取得测试Project当前generation的Plot/World lazy handle。 */
async function plotWorldForProject(projectRootName: string): Promise<ProjectPlotWorldHandle> {
    const ready = requireActiveReadyProject(projectWorkspaceRef(projectRootName));
    return activateReadyProjectModule(
        ready,
        PROJECT_PLOT_WORLD_MODULE_TOKEN,
    );
}

async function callApi(
    handler: (event: unknown) => Promise<unknown>,
    projectRootName: string,
    method: string,
    segments: string,
    body?: unknown,
    query: Record<string, unknown> = {},
): Promise<unknown> {
    const rawBody = body === undefined ? "" : JSON.stringify(body);
    const request = new PassThrough();
    request.end(rawBody);
    Object.assign(request, {
        headers: {
            "content-length": String(Buffer.byteLength(rawBody, "utf8")),
            "content-type": "application/json",
        },
    });
    return handler({
        method,
        path: `/api/projects/plot/${segments}`,
        query: {projectRoot: projectRootName, ...query},
        body,
        node: {req: request},
        context: {params: {segments}},
    });
}

function readId(input: unknown): string {
    if (typeof input === "object" && input !== null && "id" in input && typeof input.id === "string") {
        return input.id;
    }
    throw new Error("测试没有拿到 id");
}

async function updateSceneRawInstants(projectRootName: string, sceneId: string, startInstant: bigint, endInstant: bigint): Promise<void> {
    const client = createClient({
        url: toSqliteFileUrl(resolveProjectDatabasePath(
            resolveRuntimeWorkspaceRoot(),
            projectWorkspaceRef(projectRootName),
        )),
    });
    try {
        await client.execute({
            sql: `UPDATE "StoryScene" SET "startInstant" = ?, "endInstant" = ? WHERE "id" = ?`,
            args: [startInstant, endInstant, Number(sceneId)],
        });
    } finally {
        client.close();
        collectReleasedSqliteHandles();
    }
}

async function updateSceneRawSubjectIds(projectRootName: string, sceneId: string, subjectIdsJson: string): Promise<void> {
    const client = createClient({
        url: toSqliteFileUrl(resolveProjectDatabasePath(
            resolveRuntimeWorkspaceRoot(),
            projectWorkspaceRef(projectRootName),
        )),
    });
    try {
        await client.execute({
            sql: `UPDATE "StoryScene" SET "subjectIdsJson" = ? WHERE "id" = ?`,
            args: [subjectIdsJson, Number(sceneId)],
        });
    } finally {
        client.close();
        collectReleasedSqliteHandles();
    }
}

function projectDirectory(projectRootName: string): string {
    return path.join(resolveRuntimeWorkspaceRoot(), projectRootName);
}

function schemaSource(): string {
    return [
        'import {z} from "zod";',
        "",
        'declare module "zod" {',
        '    interface ZodArray<T extends z.ZodTypeAny, Cardinality extends z.ArrayCardinality = "many"> {',
        "        unique(): this;",
        "    }",
        "}",
        "z.ZodArray.prototype.unique = function() {",
        "    (this as any)._def.unique = true;",
        "    return this;",
        "};",
        "export const WorldSchema = {",
        "    character: z.object({",
        "        hp: z.number().int().default(10).describe('生命值'),",
        "    }),",
        "    location: z.object({",
        "        light: z.string().default('normal').describe('光线'),",
        "    }),",
        "} as const;",
        "",
    ].join("\n");
}

function calendarSource(): string {
    return [
        "export default {",
        "  type: 'simple',",
        "  eraBefore: '复兴纪元',",
        "  eraAfter: '复兴纪元',",
        "  baseUnit: 'second',",
        "  units: [",
        "    {name: 'minute', parent: 'second', ratio: 60},",
        "    {name: 'hour', parent: 'minute', ratio: 60},",
        "    {name: 'day', parent: 'hour', ratio: 24},",
        "  ],",
        "  format: '{eraName}{day}日 {hour:02}:{minute:02}:{second:02}',",
        "};",
        "",
    ].join("\n");
}

function brokenCalendarSource(): string {
    return [
        "export default {",
        "  type: 'broken',",
        "};",
        "",
    ].join("\n");
}
