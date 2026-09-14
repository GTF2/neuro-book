import {beforeEach, describe, expect, it, vi} from "vitest";
import {createError} from "h3";
import type {NeuroAgentHarness} from "nbook/server/agent/harness/neuro-agent-harness";

const mocks = vi.hoisted(() => ({
    requireAgentSessionId: vi.fn(() => 12),
    explainToolCall: vi.fn(),
    validateBody: vi.fn(),
}));

vi.mock("nbook/server/agent/http", async (importOriginal) => {
    const actual = await importOriginal<typeof import("nbook/server/agent/http")>();
    return {
        ...actual,
        requireAgentSessionId: mocks.requireAgentSessionId,
        explainAgentToolCall: (
            sessionId: number,
            body: Parameters<typeof actual.explainAgentToolCall>[1],
        ) => actual.explainAgentToolCall(
            sessionId,
            body,
            {explainToolCall: mocks.explainToolCall} as unknown as NeuroAgentHarness,
        ),
    };
});

vi.mock("nbook/server/utils/novel-chapter", () => ({
    validateBody: mocks.validateBody,
}));

describe("POST /api/agent/sessions/:sessionId/tool-explanation", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal("defineEventHandler", (handler: unknown) => handler);
    });

    it("把工具名与参数结果交给旁路解释，并原样返回解释正文", async () => {
        mocks.validateBody.mockResolvedValue({
            toolName: "execute_sql",
            argsText: "{\"sql\":\"UPDATE StoryChapter SET sortOrder = 1\"}",
            resultText: "{\"mode\":\"write\",\"rowCount\":224}",
            locale: "zh-CN",
        });
        mocks.explainToolCall.mockResolvedValue({explanation: "这步把章节顺序写回了数据库。"});
        const handler = (await import("nbook/server/api/agent/sessions/[sessionId]/tool-explanation.post")).default;

        await expect(handler({} as never)).resolves.toEqual({explanation: "这步把章节顺序写回了数据库。"});
        expect(mocks.explainToolCall).toHaveBeenCalledWith(12, expect.objectContaining({toolName: "execute_sql"}));
    }, 10_000);

    it("请求体不含 toolName 时不会走到解释逻辑", async () => {
        mocks.validateBody.mockRejectedValue(createError({statusCode: 400, message: "toolName 必填"}));
        const handler = (await import("nbook/server/api/agent/sessions/[sessionId]/tool-explanation.post")).default;

        await expect(handler({} as never)).rejects.toMatchObject({statusCode: 400});
        expect(mocks.explainToolCall).not.toHaveBeenCalled();
    }, 10_000);

    it("provider 失败经统一 mapper 返回稳定错误码", async () => {
        mocks.validateBody.mockResolvedValue({toolName: "read"});
        mocks.explainToolCall.mockRejectedValue(createError({
            statusCode: 502,
            message: "工具解释生成失败",
            data: {code: "provider_unavailable"},
        }));
        const handler = (await import("nbook/server/api/agent/sessions/[sessionId]/tool-explanation.post")).default;

        await expect(handler({} as never)).rejects.toMatchObject({
            statusCode: 502,
            data: {code: "provider_unavailable"},
        });
    }, 10_000);
});
