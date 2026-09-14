import {describe, expect, it} from "vitest";
import type {AgentMessage, AgentToolCall, ChatNode} from "nbook/app/components/novel-ide/agent/agent-message";
import {groupChatNodesIntoBlocks, resolveToolWorkKind} from "nbook/app/components/novel-ide/agent/chat-work-blocks";

/** 测试只关心节点形状，正文留空以避免被当成有内容的文本气泡。 */
const aiMessage = (id: string): AgentMessage => ({id, type: "ai", content: ""});

const toolNode = (
    id: string,
    name: string,
    options: {
        status?: AgentToolCall["status"];
        publicArgs?: AgentToolCall["publicArgs"];
    } = {},
): ChatNode => ({
    kind: "tool",
    message: aiMessage("assistant-1"),
    toolCall: {
        id,
        index: 0,
        name,
        argsText: "{}",
        status: options.status ?? "success",
        ...(options.publicArgs ? {publicArgs: options.publicArgs} : {}),
    },
});

const textNode = (id: string): ChatNode => ({kind: "text", message: aiMessage(id)});

const editFileArgs = (path: string): AgentToolCall["publicArgs"] => ({
    kind: "edit",
    path,
    edits: [],
    omittedEdits: 0,
});

describe("chat-work-blocks", () => {
    it("连续同类步骤聚成一个工作块", () => {
        const items = groupChatNodesIntoBlocks([
            toolNode("a", "read"),
            toolNode("b", "read"),
            toolNode("c", "read"),
        ]);

        expect(items).toHaveLength(1);
        expect(items[0]).toEqual(expect.objectContaining({
            kind: "block",
            blockKind: "explore",
            count: 3,
            hasFailure: false,
            isRunning: false,
        }));
    });

    it("单步不成块：折成一行反而多一次点击", () => {
        const items = groupChatNodesIntoBlocks([toolNode("a", "read")]);

        expect(items).toHaveLength(1);
        expect(items[0]?.kind).toBe("node");
    });

    it("块 id 由首尾工具调用决定，重新投影时保持稳定", () => {
        const build = () => groupChatNodesIntoBlocks([
            toolNode("a", "read"),
            toolNode("b", "read"),
        ]);
        const first = build()[0];

        expect(first).toEqual(expect.objectContaining({kind: "block", id: "a::b"}));
        expect(build()[0]).toEqual(first);
    });

    it("类别不同则各自成块，不跨类别合并", () => {
        const items = groupChatNodesIntoBlocks([
            toolNode("a", "read"),
            toolNode("b", "read"),
            toolNode("c", "edit"),
            toolNode("d", "edit"),
        ]);

        expect(items.map((item) => item.kind === "block" ? item.blockKind : item.node.kind)).toEqual([
            "explore",
            "edit",
        ]);
    });

    it("文本节点打断分组，块不会跨越用户可见的输出", () => {
        const items = groupChatNodesIntoBlocks([
            toolNode("a", "read"),
            textNode("t"),
            toolNode("b", "read"),
        ]);

        expect(items.map((item) => item.kind)).toEqual(["node", "node", "node"]);
    });

    it("块内出现失败时标记 hasFailure，供上层默认展开", () => {
        const items = groupChatNodesIntoBlocks([
            toolNode("a", "edit", {publicArgs: editFileArgs("a.md")}),
            toolNode("b", "edit", {status: "error"}),
        ]);

        expect(items[0]).toEqual(expect.objectContaining({kind: "block", hasFailure: true}));
    });

    it("块内仍在运行时标记 isRunning", () => {
        const items = groupChatNodesIntoBlocks([
            toolNode("a", "bash", {status: "success"}),
            toolNode("b", "bash", {status: "running"}),
        ]);

        expect(items[0]).toEqual(expect.objectContaining({kind: "block", isRunning: true}));
    });

    it("交互工具与 workflow 永不进块：收起来会让进度或提问消失", () => {
        for (const name of ["run_workflow", "request_user_input", "switch_mode", "task_create", "task_set_status"]) {
            expect(resolveToolWorkKind(name)).toBeNull();
        }
        const items = groupChatNodesIntoBlocks([
            toolNode("a", "run_workflow"),
            toolNode("b", "run_workflow"),
        ]);

        expect(items.map((item) => item.kind)).toEqual(["node", "node"]);
    });

    it("未登记的工具不折叠，避免未知行为被藏进一行", () => {
        expect(resolveToolWorkKind("some_new_tool")).toBeNull();
        const items = groupChatNodesIntoBlocks([
            toolNode("a", "some_new_tool"),
            toolNode("b", "some_new_tool"),
        ]);

        expect(items.map((item) => item.kind)).toEqual(["node", "node"]);
    });

    it("文件路径去重并保持出现顺序，供摘要复用", () => {
        const items = groupChatNodesIntoBlocks([
            toolNode("a", "edit", {publicArgs: editFileArgs("a.md")}),
            toolNode("b", "edit", {publicArgs: editFileArgs("b.md")}),
            toolNode("c", "edit", {publicArgs: editFileArgs("a.md")}),
        ]);

        expect(items[0]).toEqual(expect.objectContaining({
            kind: "block",
            filePaths: ["a.md", "b.md"],
        }));
    });
});
