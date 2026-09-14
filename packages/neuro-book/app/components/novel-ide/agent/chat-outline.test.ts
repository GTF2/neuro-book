import {describe, expect, it} from "vitest";
import type {AgentMessage, AgentToolCall, ChatNode} from "nbook/app/components/novel-ide/agent/agent-message";
import {
    buildChatOutline,
    chatBlockAnchorId,
    chatNodeAnchorId,
    isPromptAnchorNode,
    resolveActiveOutlineId,
} from "nbook/app/components/novel-ide/agent/chat-outline";
import {groupChatNodesIntoBlocks, type ChatFlowItem} from "nbook/app/components/novel-ide/agent/chat-work-blocks";

const resolveNodeKey = (node: ChatNode): string => node.kind === "tool"
    ? `${node.message.id}-${node.toolCall.id}`
    : `${node.message.id}-text`;

const userNode = (id: string, content: string, timestamp = "2026-09-14 10:00"): ChatNode => ({
    kind: "text",
    message: {id, type: "user", content, timestamp},
});

const aiTextNode = (id: string, content: string): ChatNode => ({
    kind: "text",
    message: {id, type: "ai", content},
});

const toolNode = (id: string, name: string, status: AgentToolCall["status"]): ChatNode => ({
    kind: "tool",
    message: {id: "assistant-1", type: "ai", content: ""} as AgentMessage,
    toolCall: {id, index: 0, name, argsText: "{}", status},
});

/** 借分组算法造一个真实的工作块，避免手写块结构掩盖字段不一致。 */
const blockItem = (statuses: Array<AgentToolCall["status"]>): Extract<ChatFlowItem, {kind: "block"}> => {
    const [first] = groupChatNodesIntoBlocks(
        statuses.map((status, index) => toolNode(`t${String(index)}`, "read", status)),
    );
    if (!first || first.kind !== "block") {
        throw new Error("期望构造出工作块");
    }
    return first;
};

describe("chat-outline", () => {
    it("只有用户消息进大纲，Agent 正文不占位", () => {
        const items: ChatFlowItem[] = [
            {kind: "node", node: userNode("u1", "帮我看看第 3 章")},
            {kind: "node", node: aiTextNode("a1", "我来看一下")},
        ];

        const outline = buildChatOutline(items, resolveNodeKey);

        expect(outline).toHaveLength(1);
        expect(outline[0]).toEqual(expect.objectContaining({
            kind: "prompt",
            messageId: "u1",
            preview: "帮我看看第 3 章",
        }));
    });

    it("提问摘要归一空白并截断，避免大纲被长段落撑开", () => {
        const long = "第一行\n\n第二行   " + "很长".repeat(60);
        const outline = buildChatOutline([{kind: "node", node: userNode("u1", long)}], resolveNodeKey);
        const first = outline[0];

        expect(first?.kind).toBe("prompt");
        expect(first?.kind === "prompt" ? first.preview : "").not.toContain("\n");
        expect(first?.kind === "prompt" ? first.preview.endsWith("…") : false).toBe(true);
        expect(first?.kind === "prompt" ? first.preview.length : 0).toBeLessThanOrEqual(61);
    });

    it("正文为空的用户消息仍然生成锚点，摘要留空由上层兜底", () => {
        const outline = buildChatOutline([{kind: "node", node: userNode("u1", "   ")}], resolveNodeKey);

        expect(outline[0]).toEqual(expect.objectContaining({kind: "prompt", preview: ""}));
    });

    it("工作块状态：全部成功为 success", () => {
        const outline = buildChatOutline([blockItem(["success", "success"])], resolveNodeKey);

        expect(outline[0]).toEqual(expect.objectContaining({
            kind: "block",
            blockKind: "explore",
            status: "success",
            count: 2,
            failedCount: 0,
        }));
    });

    it("工作块状态：含失败为 failed 并给出失败计数", () => {
        const outline = buildChatOutline([blockItem(["success", "error"])], resolveNodeKey);

        expect(outline[0]).toEqual(expect.objectContaining({status: "failed", failedCount: 1}));
    });

    it("运行中优先于失败：还在跑的时候失败不是结论", () => {
        const outline = buildChatOutline([blockItem(["error", "running"])], resolveNodeKey);

        expect(outline[0]).toEqual(expect.objectContaining({status: "running"}));
    });

    it("锚点 id 稳定，且剔除消息 id 里的特殊字符", () => {
        const outline = buildChatOutline([
            {kind: "node", node: userNode("user/1.x", "提问")},
            blockItem(["success", "success"]),
        ], resolveNodeKey);

        const prompt = outline[0];
        const block = outline[1];
        expect(prompt?.anchorId).toBe(chatNodeAnchorId("user/1.x-text"));
        expect(prompt?.anchorId).not.toContain("/");
        expect(prompt?.anchorId).not.toContain(".");
        expect(block?.kind === "block" ? block.anchorId : "").toBe(chatBlockAnchorId("t0::t1"));
    });

    it("isPromptAnchorNode 只认用户文本节点", () => {
        expect(isPromptAnchorNode(userNode("u1", "x"))).toBe(true);
        expect(isPromptAnchorNode(aiTextNode("a1", "x"))).toBe(false);
        expect(isPromptAnchorNode(toolNode("t1", "read", "success"))).toBe(false);
    });

    it("滚动联动取最后一个越过激活线的锚点", () => {
        const offsets = [
            {id: "a", top: -500},
            {id: "b", top: -100},
            {id: "c", top: 20},
            {id: "d", top: 400},
        ];

        expect(resolveActiveOutlineId(offsets, 0)).toBe("b");
        expect(resolveActiveOutlineId(offsets, 100)).toBe("c");
        expect(resolveActiveOutlineId(offsets, 10_000)).toBe("d");
    });

    it("还没滚过任何锚点时退回第一行，避免高亮丢失", () => {
        expect(resolveActiveOutlineId([{id: "a", top: 50}], 0)).toBe("a");
        expect(resolveActiveOutlineId([], 0)).toBe("");
    });
});
