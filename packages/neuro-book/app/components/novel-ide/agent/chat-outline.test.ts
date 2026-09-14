import {describe, expect, it} from "vitest";
import type {AgentMessage, AgentToolCall, ChatNode} from "nbook/app/components/novel-ide/agent/agent-message";
import {
    buildChatOutline,
    chatBlockAnchorId,
    chatNodeAnchorId,
    resolveActiveOutlineId,
    resolveTextOutlineKind,
} from "nbook/app/components/novel-ide/agent/chat-outline";
import {groupChatNodesIntoBlocks, type ChatFlowItem} from "nbook/app/components/novel-ide/agent/chat-work-blocks";

const resolveNodeKey = (node: ChatNode): string => node.kind === "tool"
    ? `${node.message.id}-${node.toolCall.id}`
    : `${node.message.id}-text`;

const userNode = (id: string, content: string, timestamp = "2026-09-14 10:00"): ChatNode => ({
    kind: "text",
    message: {id, type: "user", content, timestamp},
});

const aiTextNode = (id: string, content: string, status: AgentMessage["status"] = "done"): ChatNode => ({
    kind: "text",
    message: {id, type: "ai", content, status},
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
    it("一条完整对话会同时留下提问、回答与操作三类行", () => {
        const outline = buildChatOutline([
            {kind: "node", node: userNode("u1", "帮我看看第 3 章")},
            {kind: "node", node: aiTextNode("a1", "我来看一下，先读几个文件")},
            blockItem(["success", "success"]),
        ], resolveNodeKey);

        expect(outline.map((item) => item.kind)).toEqual(["prompt", "answer", "block"]);
    });

    it("摘要归一空白，并给悬停提示保留足够上下文后再截断", () => {
        const long = "第一行\n\n第二行   " + "很长".repeat(200);
        const outline = buildChatOutline([{kind: "node", node: userNode("u1", long)}], resolveNodeKey);
        const preview = outline[0]?.kind === "prompt" ? outline[0].preview : "";

        expect(preview).not.toContain("\n");
        expect(preview.endsWith("…")).toBe(true);
        // 行内截断交给 CSS，这里只保证不会长到撑爆悬停提示。
        expect(preview.length).toBeLessThanOrEqual(201);
        expect(preview.length).toBeGreaterThan(60);
    });

    it("正文为空的用户消息仍然生成锚点，摘要留空由上层兜底", () => {
        const outline = buildChatOutline([{kind: "node", node: userNode("u1", "   ")}], resolveNodeKey);

        expect(outline[0]).toEqual(expect.objectContaining({kind: "prompt", preview: ""}));
    });

    it("没有正文的 AI 节点不占大纲行：它只是工具调用的载体", () => {
        const outline = buildChatOutline([
            {kind: "node", node: aiTextNode("a1", "   ")},
        ], resolveNodeKey);

        expect(outline).toHaveLength(0);
    });

    it("回答仍在生成时标记 running", () => {
        const outline = buildChatOutline([
            {kind: "node", node: aiTextNode("a1", "正在回答", "streaming")},
            {kind: "node", node: aiTextNode("a2", "回答完毕")},
        ], resolveNodeKey);

        expect(outline[0]).toEqual(expect.objectContaining({kind: "answer", running: true}));
        expect(outline[1]).toEqual(expect.objectContaining({kind: "answer", running: false}));
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

    it("resolveTextOutlineKind 只认用户提问、有正文的 AI 回答", () => {
        expect(resolveTextOutlineKind(userNode("u1", "x"))).toBe("prompt");
        expect(resolveTextOutlineKind(aiTextNode("a1", "x"))).toBe("answer");
        expect(resolveTextOutlineKind(aiTextNode("a2", ""))).toBeNull();
        expect(resolveTextOutlineKind(toolNode("t1", "read", "success"))).toBeNull();
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
