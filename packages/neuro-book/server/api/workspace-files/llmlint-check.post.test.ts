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
};

let requestBody: unknown = {path: "manuscript/chapter.md", projectRoot: "p"};

describe("POST /api/workspace-files/llmlint-check", () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        requestBody = {path: "manuscript/chapter.md", projectRoot: "p"};
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
            statWorkspacePath: vi.fn(async () => ({
                isDirectory: false,
                editable: true,
                absolutePath: "C:/app/workspace/p/manuscript/chapter.md",
            })),
        }));
        vi.doMock("nbook/server/workspace-files/llmlint-check", () => ({
            resolveLlmlintSkillRoot: mocks.resolveLlmlintSkillRoot,
            runLlmlintCheck: mocks.runLlmlintCheck,
        }));
    });

    it("解析文件绝对路径并在默认过滤器下调用 runner", async () => {
        const handler = (await import("nbook/server/api/workspace-files/llmlint-check.post")).default;
        const result = await handler({} as never);

        expect(mocks.runLlmlintCheck).toHaveBeenCalledWith({
            skillRoot: "C:/app/../llmlint/skill",
            absoluteFilePath: "C:/app/workspace/p/manuscript/chapter.md",
            review: "agent",
            minLevel: "low",
            scanAll: false,
        });
        expect(result).toMatchObject({kind: "check", summary: {high: 1}});
    });

    it("目录目标返回 400，不调用 runner", async () => {
        vi.doMock("nbook/server/workspace-files/workspace-files", () => ({
            statWorkspacePath: vi.fn(async () => ({isDirectory: true, editable: false, absolutePath: "C:/app/workspace/p/manuscript"})),
        }));
        const handler = (await import("nbook/server/api/workspace-files/llmlint-check.post")).default;

        await expect(handler({} as never)).rejects.toMatchObject({statusCode: 400});
        expect(mocks.runLlmlintCheck).not.toHaveBeenCalled();
    });

    it("非文本文件返回 400", async () => {
        vi.doMock("nbook/server/workspace-files/workspace-files", () => ({
            statWorkspacePath: vi.fn(async () => ({isDirectory: false, editable: false, absolutePath: "C:/app/workspace/p/a.bin"})),
        }));
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
