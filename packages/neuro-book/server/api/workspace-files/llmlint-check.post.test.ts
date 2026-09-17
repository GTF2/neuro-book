import {beforeEach, describe, expect, it, vi} from "vitest";

const mocks = {
    resolveLlmlintSkillRoot: vi.fn(async () => "C:/app/../llmlint/skill"),
    runLlmlintCheck: vi.fn(async () => ({
        kind: "check" as const,
        filePath: "manuscript/chapter.md",
        summary: {total: 1, high: 1, medium: 0, low: 0, visibleChars: 20},
        filter: {review: "agent", hiddenByReview: 0, minLevel: "low", hiddenByLevel: 0},
        registry: {rulesets: ["builtin/default"], totalRules: 1, activeRules: 1, disabledRules: 0},
        diagnostics: [],
        issues: [{
            ruleId: "firstly-secondly",
            ruleTitle: "机械过渡",
            namespace: "transition",
            level: "high" as const,
            review: "agent" as const,
            fixability: "manual",
            line: 1, column: 1, endLine: 1, endColumn: 2,
            match: "首先",
            context: {before: "", current: "首先", after: ""},
            suggestion: null,
        }],
    })),
    runLlmlintScan: vi.fn(async () => ({
        kind: "check-scan" as const,
        rootPath: "C:/app/workspace/p/manuscript",
        fileCount: 3,
        filesWithIssues: 2,
        summary: {total: 5, high: 2, medium: 3, low: 0, visibleChars: 1200},
        filter: {review: "all", hiddenByReview: 0, minLevel: "low", hiddenByLevel: 0},
        registry: {rulesets: ["builtin/default"], totalRules: 1, activeRules: 1, disabledRules: 0},
        diagnostics: [],
        files: [],
        rules: [],
        topIssues: [],
        durationMs: 42,
    })),
};

type StatResult = {
    isDirectory: boolean;
    editable: boolean;
    absolutePath: string;
};

const DEFAULT_STAT: StatResult = {
    isDirectory: false,
    editable: true,
    absolutePath: "C:/app/workspace/p/manuscript/chapter.md",
};

// 可变返回值：各用例通过覆盖 `statResult` 改变 statWorkspacePath 的结果，而不是在同一
// 文件里对 `workspace-files` 重复调用 `vi.doMock`。后者在整套测试运行时会因 mock 注册
// 顺序问题失效（用例读到 beforeEach 的默认 mock 而非自身覆盖），造成“单文件绿、整套红”
// 的假红。改用一个稳定 `vi.fn` + 可变结果彻底消除该模式。
let statResult: StatResult = {...DEFAULT_STAT};
const statWorkspacePath = vi.fn(async () => statResult);

let requestBody: unknown = {path: "manuscript/chapter.md", projectRoot: "p"};

describe("POST /api/workspace-files/llmlint-check", () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        requestBody = {path: "manuscript/chapter.md", projectRoot: "p"};
        statResult = {...DEFAULT_STAT};
        vi.stubGlobal("defineEventHandler", (handler: unknown) => handler);
        vi.stubGlobal("defineRouteMeta", () => undefined);
        vi.stubGlobal("readBody", async () => requestBody);

        vi.doMock("nbook/server/runtime/paths/runtime-paths", () => ({
            runtimePathsFromEnv: () => ({
                applicationRoot: "C:/app",
                stateRoot: "C:/app",
                workspaceRoot: "C:/app/workspace",
                userNbookRoot: "C:/app/workspace/.nbook",
            }),
        }));
        vi.doMock("nbook/server/workspace-files/novel-workspace", () => ({
            resolveWorkspaceFileTarget: vi.fn(async () => ({
                kind: "project-workspace",
                root: "C:/app/workspace/p",
                projectRoot: "p",
            })),
        }));
        vi.doMock("nbook/server/workspace-files/project-open-guard", () => ({
            withProjectTargetOperation: (_target: unknown, handler: (handles: undefined) => unknown) => handler(undefined),
        }));
        vi.doMock("nbook/server/workspace-files/workspace-files", () => ({
            statWorkspacePath,
        }));
        vi.doMock("nbook/server/workspace-files/llmlint-check", () => ({
            resolveLlmlintSkillRoot: mocks.resolveLlmlintSkillRoot,
            runLlmlintCheck: mocks.runLlmlintCheck,
            runLlmlintScan: mocks.runLlmlintScan,
        }));
    });

    it("解析文件绝对路径并在默认过滤器下调用 runner", async () => {
        const handler = (await import("nbook/server/api/workspace-files/llmlint-check.post")).default;
        const result = await handler({} as never);

        expect(mocks.runLlmlintCheck).toHaveBeenCalledWith({
            skillRoot: "C:/app/../llmlint/skill",
            absoluteFilePath: "C:/app/workspace/p/manuscript/chapter.md",
            review: "all",
            minLevel: "low",
            scanAll: false,
        });
        expect(result).toMatchObject({kind: "check", summary: {high: 1}});
    });

    it("目录目标走 scan runner 并返回聚合结果（T0.4）", async () => {
        statResult = {isDirectory: true, editable: false, absolutePath: "C:/app/workspace/p/manuscript"};
        const handler = (await import("nbook/server/api/workspace-files/llmlint-check.post")).default;
        const result = await handler({} as never);

        expect(mocks.runLlmlintScan).toHaveBeenCalledWith({
            skillRoot: "C:/app/../llmlint/skill",
            absoluteDirPath: "C:/app/workspace/p/manuscript",
            review: "all",
            minLevel: "low",
            scanAll: false,
        });
        expect(mocks.runLlmlintCheck).not.toHaveBeenCalled();
        expect(result).toMatchObject({kind: "check-scan", fileCount: 3, summary: {high: 2}});
    });

    it("scan runner 抛错时返回 502", async () => {
        statResult = {isDirectory: true, editable: false, absolutePath: "C:/app/workspace/p/manuscript"};
        mocks.runLlmlintScan.mockRejectedValueOnce(new Error("llmlint scan 未返回可解析的 JSON"));
        const handler = (await import("nbook/server/api/workspace-files/llmlint-check.post")).default;

        await expect(handler({} as never)).rejects.toMatchObject({statusCode: 502});
    });

    it("非文本文件返回 400", async () => {
        statResult = {isDirectory: false, editable: false, absolutePath: "C:/app/workspace/p/a.bin"};
        const handler = (await import("nbook/server/api/workspace-files/llmlint-check.post")).default;

        await expect(handler({} as never)).rejects.toMatchObject({statusCode: 400});
    });

    it("找不到 llmlint skill 时返回 503", async () => {
        mocks.resolveLlmlintSkillRoot.mockRejectedValueOnce(new Error("找不到 llmlint skill"));
        const handler = (await import("nbook/server/api/workspace-files/llmlint-check.post")).default;

        await expect(handler({} as never)).rejects.toMatchObject({statusCode: 503});
        expect(mocks.runLlmlintCheck).not.toHaveBeenCalled();
    });

    it("runner 抛错时返回 502", async () => {
        mocks.runLlmlintCheck.mockRejectedValueOnce(new Error("llmlint check 未返回可解析的 JSON"));
        const handler = (await import("nbook/server/api/workspace-files/llmlint-check.post")).default;

        await expect(handler({} as never)).rejects.toMatchObject({statusCode: 502});
    });
});
