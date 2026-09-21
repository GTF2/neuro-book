import {describe, expect, it} from "vitest";
import type {AgentMessage, AgentToolCall, ChatNode} from "nbook/app/components/novel-ide/agent/agent-message";
import {
    groupChatNodesIntoBlocks,
    isFoldableToolNode,
    resolveToolWorkKind,
    type ChatFlowItem,
} from "nbook/app/components/novel-ide/agent/chat-work-blocks";
import enUS from "nbook/app/i18n/locales/en-US";
import zhCN from "nbook/app/i18n/locales/zh-CN";

const message = (overrides: Partial<AgentMessage> & {id: string; type: AgentMessage["type"]}): AgentMessage => ({
    content: "",
    timestamp: undefined,
    ...overrides,
} as AgentMessage);

const textNode = (id: string, type: AgentMessage["type"], content = "正文", timestamp?: string): ChatNode => ({
    kind: "text",
    message: message({id, type, content, timestamp}),
});

const toolNode = (id: string, name: string, messageId = "m1"): ChatNode => ({
    kind: "tool",
    message: message({id: messageId, type: "ai"}),
    toolCall: {id, name, status: "success", argsText: "", result: ""} as AgentToolCall,
});

describe("工具类别映射全覆盖（009C1R2 件6，对照 buildAgentTools 46 工具）", () => {
    const KIND_EXPECTATIONS: Array<[string, string | null]> = [
        // explore 18
        ["read", "explore"], ["get_story_tree", "explore"], ["get_story_thread", "explore"], ["get_story_scene_context", "explore"],
        ["get_scene_world_context", "explore"], ["get_story_chapter", "explore"], ["get_chapter_writer_brief", "explore"],
        ["get_story_promise", "explore"], ["get_story_decision", "explore"], ["subject_rag_search", "explore"],
        ["variable_read", "explore"], ["variable_schema", "explore"], ["list_jobs", "explore"], ["get_job", "explore"],
        ["list_workflows", "explore"], ["get_agent", "explore"], ["get_agent_profile", "explore"], ["get_session", "explore"],
        // edit 13
        ["write", "edit"], ["edit", "edit"], ["apply_patch", "edit"], ["save_story_act", "edit"], ["save_story_chapter", "edit"],
        ["save_story_thread", "edit"], ["save_story_scene", "edit"], ["save_story_promise", "edit"], ["save_promise_beat", "edit"],
        ["save_story_decision", "edit"], ["variable_patch", "edit"], ["subject_event_append", "edit"], ["subject_memory_update", "edit"],
        // 单类
        ["bash", "command"], ["execute_sql", "database"], ["web_search", "web"], ["web_fetch", "web"], ["execute_world", "world"],
        // 不折叠 10
        ["request_user_input", null], ["switch_mode", null], ["report_result", null], ["task_create", null], ["task_set_status", null],
        ["run_workflow", null], ["cancel_job", null], ["create_agent", null], ["invoke_agent", null], ["detach_agent", null],
    ];

    it("46 工具逐个归类断言（36 折叠+10 不折叠）", () => {
        expect(KIND_EXPECTATIONS).toHaveLength(46);
        for (const [name, expected] of KIND_EXPECTATIONS) {
            expect(resolveToolWorkKind(name), `工具 ${name}`).toBe(expected);
        }
    });

    it("world 新类别与工具短名 i18n 双语齐备", () => {
        expect(zhCN.agent.workBlock.world).toBe("世界引擎");
        expect(enUS.agent.workBlock.world).toBe("World engine");
        for (const [name] of KIND_EXPECTATIONS.filter(([, kind]) => kind !== null)) {
            const entry = (zhCN.agent.workBlock.tool as Record<string, string>)[name];
            expect(Boolean(entry), `zh 工具短名 ${name}`).toBe(true);
            const entryEn = (enUS.agent.workBlock.tool as Record<string, string>)[name];
            expect(Boolean(entryEn), `en 工具短名 ${name}`).toBe(true);
        }
    });
});

describe("轮次聚合（009C1R2 件3：相邻 user 消息之间全部节点收进一个工作块）", () => {
    it("一轮=块头数据+正文+工具整体；user 前后分轮", () => {
        const nodes: ChatNode[] = [
            textNode("u1", "user", "帮我查一下", "2026-09-21T10:00:00Z"),
            textNode("a1", "ai", "我先看看", "2026-09-21T10:00:05Z"),
            toolNode("t1", "read"),
            textNode("a2", "ai", "查到了", "2026-09-21T10:01:00Z"),
        ];
        const items = groupChatNodesIntoBlocks(nodes);
        expect(items).toHaveLength(2);
        expect(items[0]!.kind).toBe("node");
        const round = items[1] as Extract<ChatFlowItem, {kind: "round"}>;
        expect(round.kind).toBe("round");
        expect(round.nodes).toHaveLength(3);
        expect(round.durationMs).toBe(55_000);
        expect(round.toolCount).toBe(1);
        expect(round.workByKind[0]).toEqual({kind: "explore", count: 1});
        expect(round.filePaths).toEqual([]);
    });

    it("不折叠工具参与轮但不出现在折叠摘要计数中", () => {
        const nodes: ChatNode[] = [
            textNode("u1", "user", "问"),
            toolNode("t9", "request_user_input"),
            toolNode("t2", "bash"),
            toolNode("t3", "bash"),
        ];
        const items = groupChatNodesIntoBlocks(nodes);
        const round = items[1] as Extract<ChatFlowItem, {kind: "round"}>;
        expect(round.nodes).toHaveLength(3);
        expect(round.toolCount).toBe(2);
        expect(isFoldableToolNode(round.nodes[0]!)).toBe(false);
    });

    it("开头连续 system 注入收拢为一行（009C1R2 件3：单条也收拢）", () => {
        const nodes: ChatNode[] = [
            textNode("s1", "system", "注入1"),
            textNode("s2", "system", "注入2"),
            textNode("s3", "system", "注入3"),
            textNode("a1", "ai", "回答"),
        ];
        const items = groupChatNodesIntoBlocks(nodes);
        expect(items[0]!.kind).toBe("injections");
        expect((items[0] as {nodes: unknown[]}).nodes).toHaveLength(3);
        expect(items[1]!.kind).toBe("round");

        const single = groupChatNodesIntoBlocks([textNode("s1", "system", "注入1"), textNode("a1", "ai", "回答")]);
        expect(single[0]!.kind).toBe("injections");
        expect((single[0] as {nodes: unknown[]}).nodes).toHaveLength(1);
    });

    it("中途 system 注入归入当前轮不切断（009C1R2 件3）", () => {
        const nodes: ChatNode[] = [
            textNode("u1", "user", "问"),
            textNode("a1", "ai", "答一"),
            textNode("s1", "system", "中途注入"),
            textNode("a2", "ai", "答二"),
        ];
        const items = groupChatNodesIntoBlocks(nodes);
        expect(items).toHaveLength(2);
        expect(items[0]!.kind).toBe("node");
        const round = items[1] as Extract<ChatFlowItem, {kind: "round"}>;
        expect(round.kind).toBe("round");
        expect(round.nodes).toHaveLength(3);
        expect(round.nodes[1]!.message.type).toBe("system");
    });

    it("失败轮/运行中轮标记（默认展开依据）", () => {
        const failed = groupChatNodesIntoBlocks([textNode("u", "user", "q"), toolNode("f1", "read"), toolNode("f2", "edit")]);
        // 全 success 不算失败
        expect((failed[1] as {hasFailure: boolean}).hasFailure).toBe(false);
    });

    it("轮块头 i18n 键双语齐备（时长/摘要/收拢）", () => {
        expect(zhCN.agent.workBlock.working).toContain("工作中");
        expect(zhCN.agent.workBlock.workedSeconds).toContain("已工作");
        expect(zhCN.agent.workBlock.minutesSeconds).toContain("{minutes}");
        expect(zhCN.agent.workBlock.injections).toContain("×{count}");
        expect(zhCN.agent.workBlock.moreKinds).toContain("{count}");
        expect(enUS.agent.workBlock.worked).toBeTruthy();
        expect(enUS.agent.workBlock.injections).toContain("{count}");
    });
});
