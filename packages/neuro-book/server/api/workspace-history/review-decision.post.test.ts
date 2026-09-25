import {beforeEach, describe, expect, it, vi} from "vitest";
import {reviewStatePathFor} from "nbook/app/components/novel-ide/review/review-blocks";

const GROUP_PENDING = JSON.stringify({
    groupId: "grp-1",
    chapterPath: "manuscript/001-volume/ch-003.md",
    baseRevision: 7,
    blocks: [
        {blockId: "blk-1", sourceId: "grp-1", old: "旧段一。", new: "新段一。", status: "pending", impactIds: []},
        {blockId: "blk-2", sourceId: "grp-1", old: "旧段二。", new: "新段二。", status: "pending", impactIds: []},
    ],
    createdAt: 1_700_000_000_000,
});
const BODY = "旧段一。\n\n旧段二。\n\n结尾。";

type MockHistoryDependencies = {
    readonly performWrite: ReturnType<typeof vi.fn>;
    readonly requireProjectHandles: ReturnType<typeof vi.fn>;
};

function mockHistory(history: object): MockHistoryDependencies {
    const requireProjectHandles = vi.fn(() => ({
        fileIndex: {mutate: vi.fn()},
        history: {history: Promise.resolve(history), waitForWarmup: vi.fn(async () => undefined)},
    }));
    const withProjectHandlesOperation = vi.fn((projectPath: string, handler: (handles: unknown) => unknown) => handler(requireProjectHandles(projectPath)));
    vi.doMock("nbook/server/workspace-files/project-open-guard", () => ({requireProjectHandles, withProjectHandlesOperation}));
    vi.doMock("nbook/server/workspace-history/project-history", () => ({LOCAL_USER_ID: "local"}));
    return {performWrite: history.performWrite as ReturnType<typeof vi.fn>, requireProjectHandles};
}

function mockReadBody(body: unknown): void {
    vi.doMock("h3", async () => {
        const actual = await vi.importActual<typeof import("h3")>("h3");
        return {...actual, readBody: () => body};
    });
}

describe("review-decision 端点契约（任务033 C 段）", () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        vi.unstubAllGlobals();
        vi.stubGlobal("defineEventHandler", (handler: unknown) => handler);
        vi.stubGlobal("createError", (input: {statusCode: number; statusMessage: string; data?: unknown}) => Object.assign(new Error(input.statusMessage), input));
    });

    it("accept：正文写入+状态文件登记各一次 performWrite，appliedBodyHash 由端点计算回填", async () => {
        const performWrite = vi.fn(async (_actor: string, _path: string, content: string) => ({path: content}));
        mockReadBody({
            projectRoot: "book",
            chapterPath: "manuscript/001-volume/ch-003.md",
            action: "accept",
            blockId: "blk-1",
            currentBody: BODY,
            stateFileContent: GROUP_PENDING,
        });
        mockHistory({performWrite});

        const handler = (await import("nbook/server/api/workspace-history/review-decision.post")).default;
        const result = await handler({} as never);

        expect(performWrite).toHaveBeenCalledTimes(2);
        expect(performWrite).toHaveBeenNthCalledWith(1, "local", "manuscript/001-volume/ch-003.md", expect.stringContaining("新段一。"));
        expect(performWrite).toHaveBeenNthCalledWith(2, "local", reviewStatePathFor("manuscript/001-volume/ch-003.md"), expect.any(String));
        expect(result.newBody).toContain("新段一。");
        expect(result.newBody).toContain("旧段二。");
        const restored = JSON.parse(result.stateFileContent);
        expect(restored.blocks[0].status).toBe("accepted");
        expect(restored.appliedBodyHash).toBeTypeOf("string");
    });

    it("reject：不写正文，只登记状态文件", async () => {
        const performWrite = vi.fn(async () => ({}));
        mockReadBody({projectRoot: "book", chapterPath: "manuscript/001-volume/ch-003.md", action: "reject", blockId: "blk-2", currentBody: BODY, stateFileContent: GROUP_PENDING});
        mockHistory({performWrite});

        const handler = (await import("nbook/server/api/workspace-history/review-decision.post")).default;
        const result = await handler({} as never);

        expect(performWrite).toHaveBeenCalledTimes(1);
        expect(performWrite).toHaveBeenCalledWith("local", reviewStatePathFor("manuscript/001-volume/ch-003.md"), expect.any(String));
        expect(result.newBody).toBeUndefined();
        expect(JSON.parse(result.stateFileContent).blocks[1].status).toBe("rejected");
    });

    it("void：整件拒绝全组 void 且不物理删除", async () => {
        const performWrite = vi.fn(async () => ({}));
        mockReadBody({projectRoot: "book", chapterPath: "manuscript/001-volume/ch-003.md", action: "void", currentBody: BODY, stateFileContent: GROUP_PENDING});
        mockHistory({performWrite});

        const handler = (await import("nbook/server/api/workspace-history/review-decision.post")).default;
        const result = await handler({} as never);

        const restored = JSON.parse(result.stateFileContent);
        expect(restored.blocks.every((b: {status: string}) => b.status === "void")).toBe(true);
        expect(restored.blocks).toHaveLength(2);
        expect(performWrite).toHaveBeenCalledTimes(1);
    });

    it("半完成态：状态 hash 与提交正文不符返回 409+void 建议，不执行写入", async () => {
        const performWrite = vi.fn(async () => ({}));
        mockReadBody({
            projectRoot: "book",
            chapterPath: "manuscript/001-volume/ch-003.md",
            action: "accept",
            blockId: "blk-2",
            currentBody: "正文被外部改过。",
            stateFileContent: JSON.stringify({
                ...JSON.parse(GROUP_PENDING),
                appliedBodyHash: "sha-of-previous-body",
                blocks: [{blockId: "blk-1", sourceId: "grp-1", old: "旧段一。", new: "新段一。", status: "accepted", impactIds: []}],
            }),
        });
        mockHistory({performWrite});

        const handler = (await import("nbook/server/api/workspace-history/review-decision.post")).default;
        await expect(handler({} as never)).rejects.toMatchObject({statusCode: 409});
        expect(performWrite).not.toHaveBeenCalled();
    });

    it("状态文件与章节路径不匹配返回 400；状态文件无效返回 400", async () => {
        mockReadBody({projectRoot: "book", chapterPath: "manuscript/001-volume/ch-003.md", action: "reject", blockId: "blk-1", currentBody: BODY, stateFileContent: JSON.stringify({...JSON.parse(GROUP_PENDING), chapterPath: "manuscript/other.md"})});
        mockHistory({performWrite: vi.fn(async () => ({}))});
        const handler = (await import("nbook/server/api/workspace-history/review-decision.post")).default;
        await expect(handler({} as never)).rejects.toMatchObject({statusCode: 400});

        vi.resetModules();
        mockReadBody({projectRoot: "book", chapterPath: "manuscript/001-volume/ch-003.md", action: "reject", blockId: "blk-1", currentBody: BODY, stateFileContent: "not-json"});
        mockHistory({performWrite: vi.fn(async () => ({}))});
        const handler2 = (await import("nbook/server/api/workspace-history/review-decision.post")).default;
        await expect(handler2({} as never)).rejects.toMatchObject({statusCode: 400});
    });
});
