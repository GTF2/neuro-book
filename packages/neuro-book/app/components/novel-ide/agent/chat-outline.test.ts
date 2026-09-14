import {describe, expect, it} from "vitest";
import type {AgentMessage, AgentToolCall, ChatNode} from "nbook/app/components/novel-ide/agent/agent-message";
import {
    buildChatOutline,
    chatBlockAnchorId,
    chatNodeAnchorId,
    resolveActiveOutlineId,
    resolveOutlineLensTop,
    resolveOutlineRailPadTop,
    resolveOutlineScrubRatio,
    resolveOutlineWaveBoost,
    resolveTextOutlineKind,
    resolveToolDetail,
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
    it("大纲只留对话：跑完的自动化步骤不进目录", () => {
        const outline = buildChatOutline([
            {kind: "node", node: userNode("u1", "帮我看看第 3 章")},
            {kind: "node", node: aiTextNode("a1", "我来看一下，先读几个文件")},
            blockItem(["success", "success"]),
        ], resolveNodeKey);

        expect(outline.map((item) => item.kind)).toEqual(["prompt", "answer"]);
    });

    it("出错的工作块留在目录里：红色的那一步得让人点得到", () => {
        const outline = buildChatOutline([
            {kind: "node", node: userNode("u1", "帮我看看第 3 章")},
            blockItem(["success", "error"]),
        ], resolveNodeKey);

        expect(outline.map((item) => item.kind)).toEqual(["prompt", "block"]);
        expect(outline[1]).toEqual(expect.objectContaining({status: "failed"}));
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

    it("成功的单步操作不进目录，否则整屏都是自动化步骤", () => {
        const outline = buildChatOutline([
            {kind: "node", node: toolNode("t1", "task_set_status", "success")},
        ], resolveNodeKey);

        expect(outline).toHaveLength(0);
    });

    it("失败的单步操作进目录：task_set_status 这类永不进块的工具出错时不能消失", () => {
        const outline = buildChatOutline([
            {kind: "node", node: toolNode("t1", "task_set_status", "error")},
        ], resolveNodeKey);

        expect(outline).toHaveLength(1);
        expect(outline[0]).toEqual(expect.objectContaining({
            kind: "block",
            blockKind: "other",
            status: "failed",
            count: 1,
            failedCount: 1,
        }));
    });

    it("单步操作出错时仍保留自己的类别与文件数", () => {
        const editNode: ChatNode = {
            kind: "tool",
            message: {id: "assistant-1", type: "ai", content: ""} as AgentMessage,
            toolCall: {
                id: "t1",
                index: 0,
                name: "edit",
                argsText: "{}",
                status: "error",
                publicArgs: {kind: "edit", path: "a.md", edits: [], omittedEdits: 0},
            },
        };

        const outline = buildChatOutline([{kind: "node", node: editNode}], resolveNodeKey);

        expect(outline[0]).toEqual(expect.objectContaining({
            blockKind: "edit",
            fileCount: 1,
            count: 1,
            status: "failed",
        }));
    });

    it("摘要剥掉 Markdown 标记，只留内容", () => {
        const outline = buildChatOutline([
            {kind: "node", node: userNode("u1", "## 进度更新：**193/224** —— 第 1、3、4、5 章")},
        ], resolveNodeKey);
        const preview = outline[0]?.kind === "prompt" ? outline[0].preview : "";

        expect(preview).toBe("进度更新：193/224 —— 第 1、3、4、5 章");
        expect(preview).not.toContain("*");
        expect(preview).not.toContain("#");
    });

    it("列表、引用与行内代码符号也从摘要里去掉", () => {
        const outline = buildChatOutline([
            {kind: "node", node: userNode("u1", "- 第一项\n- `第二项`\n> 引用")},
        ], resolveNodeKey);
        const preview = outline[0]?.kind === "prompt" ? outline[0].preview : "";

        expect(preview).toBe("第一项 第二项 引用");
    });

    it("回答仍在生成时标记 running", () => {
        const outline = buildChatOutline([
            {kind: "node", node: aiTextNode("a1", "正在回答", "streaming")},
            {kind: "node", node: aiTextNode("a2", "回答完毕")},
        ], resolveNodeKey);

        expect(outline[0]).toEqual(expect.objectContaining({kind: "answer", running: true}));
        expect(outline[1]).toEqual(expect.objectContaining({kind: "answer", running: false}));
    });

    it("跑完的工作块不进目录，目录里才剩下对话与报错", () => {
        const outline = buildChatOutline([blockItem(["success", "success"])], resolveNodeKey);

        expect(outline).toHaveLength(0);
    });

    it("含失败的工作块进目录，并给出失败计数与块内类别", () => {
        const outline = buildChatOutline([blockItem(["success", "error"])], resolveNodeKey);

        expect(outline[0]).toEqual(expect.objectContaining({
            kind: "block",
            blockKind: "explore",
            status: "failed",
            count: 2,
            failedCount: 1,
        }));
    });

    it("还在跑的工作块不进目录：结论还没出来", () => {
        const outline = buildChatOutline([blockItem(["error", "running"])], resolveNodeKey);

        expect(outline).toHaveLength(0);
    });

    it("锚点 id 稳定，且剔除消息 id 里的特殊字符", () => {
        const outline = buildChatOutline([
            {kind: "node", node: userNode("user/1.x", "提问")},
            blockItem(["success", "error"]),
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

    it("放大镜窗口中心对齐鼠标", () => {
        expect(resolveOutlineLensTop(300, 800, 60)).toBe(270);
    });

    it("鼠标贴到指示条两端时窗口不越界", () => {
        expect(resolveOutlineLensTop(10, 800, 60)).toBe(0);
        expect(resolveOutlineLensTop(790, 800, 60)).toBe(740);
    });

    it("指示条比窗口还矮时窗口固定在顶端", () => {
        expect(resolveOutlineLensTop(20, 40, 60)).toBe(0);
    });

    it("刻度塞不满就居中留白，塞满或塞不下都不留白", () => {
        expect(resolveOutlineRailPadTop(700, 20, 9)).toBe(260);
        expect(resolveOutlineRailPadTop(700, 100, 7)).toBe(0);
        expect(resolveOutlineRailPadTop(700, 400, 3)).toBe(0);
    });

    it("波浪加成：鼠标所指最长，两侧依次回落，再远就不受影响", () => {
        const center = resolveOutlineWaveBoost(10, 10);
        const near = resolveOutlineWaveBoost(11, 10);
        const far = resolveOutlineWaveBoost(12, 10);

        // 只断言「中间最长、向两侧递减」，具体数值可调，测试不该因为调参就红。
        expect(center).toBeGreaterThan(near);
        expect(near).toBeGreaterThan(far);
        expect(far).toBeGreaterThan(0);
        // 距离取绝对值，所以鼠标所指左右相邻的两条加成相同。
        expect(resolveOutlineWaveBoost(9, 10)).toBe(near);
        expect(resolveOutlineWaveBoost(8, 10)).toBe(far);
        // 超出波浪范围就不再加成。
        expect(resolveOutlineWaveBoost(13, 10)).toBe(0);
        expect(resolveOutlineWaveBoost(6, 10)).toBe(0);
    });

    it("鼠标不在刻度上时没有波浪", () => {
        expect(resolveOutlineWaveBoost(10, -1)).toBe(0);
    });

    it("刻度列拖动换算进度：顶部是 0、底部是 1，拖出范围会被夹住", () => {
        expect(resolveOutlineScrubRatio(100, 100, 400)).toBe(0);
        expect(resolveOutlineScrubRatio(300, 100, 400)).toBe(0.5);
        expect(resolveOutlineScrubRatio(700, 100, 400)).toBe(1);
        expect(resolveOutlineScrubRatio(50, 100, 400)).toBe(0);
    });

    it("刻度列高度为零时不产生进度", () => {
        expect(resolveOutlineScrubRatio(300, 100, 0)).toBe(0);
    });

    it("报错的操作行带上文件名：放大镜里不能只剩「编辑」两个字", () => {
        const editNode: ChatNode = {
            kind: "tool",
            message: {id: "assistant-1", type: "ai", content: ""} as AgentMessage,
            toolCall: {
                id: "t1",
                index: 0,
                name: "edit",
                argsText: "{}",
                status: "error",
                publicArgs: {kind: "edit", path: "manuscript/第03章.md", edits: [], omittedEdits: 0},
            },
        };

        const outline = buildChatOutline([{kind: "node", node: editNode}], resolveNodeKey);

        expect(outline[0]).toEqual(expect.objectContaining({
            status: "failed",
            detail: "manuscript/第03章.md",
        }));
    });

    it("apply_patch 用第一个被改的文件名当详情", () => {
        const detail = resolveToolDetail({
            id: "t1",
            index: 0,
            name: "apply_patch",
            argsText: "{}",
            status: "success",
            publicArgs: {
                kind: "apply_patch",
                patchPreview: "*** Begin Patch",
                patchBytes: 14,
                patchOmitted: false,
                touchedFiles: ["manuscript/第01章.md", "manuscript/第02章.md"],
                touchedFilesOmitted: false,
            },
        });

        expect(detail).toBe("manuscript/第01章.md");
    });

    it("未知工具从公开参数里挑出命令行", () => {
        const detail = resolveToolDetail({
            id: "t1",
            index: 0,
            name: "bash",
            argsText: "{}",
            status: "success",
            publicArgs: {
                kind: "generic",
                value: {
                    kind: "object",
                    entries: [{
                        key: "command",
                        value: {kind: "string", preview: "bun run typecheck", bytes: 17, omitted: false},
                    }],
                    omittedEntries: 0,
                },
            },
        });

        expect(detail).toBe("bun run typecheck");
    });

    it("没有可信键名时退回任意字符串字段，仍然有东西可显示", () => {
        const detail = resolveToolDetail({
            id: "t1",
            index: 0,
            name: "task_set_status",
            argsText: "{}",
            status: "success",
            publicArgs: {
                kind: "generic",
                value: {
                    kind: "object",
                    entries: [
                        {key: "task_id", value: {kind: "number", value: 3}},
                        {key: "note", value: {kind: "string", preview: "已建完第 10 集", bytes: 24, omitted: false}},
                    ],
                    omittedEntries: 0,
                },
            },
        });

        expect(detail).toBe("已建完第 10 集");
    });

    it("详情过长时截断，不会把放大镜撑爆", () => {
        const detail = resolveToolDetail({
            id: "t1",
            index: 0,
            name: "bash",
            argsText: "{}",
            status: "success",
            publicArgs: {
                kind: "generic",
                value: {kind: "string", preview: "很长".repeat(80), bytes: 480, omitted: false},
            },
        });

        expect(detail.endsWith("…")).toBe(true);
        expect(detail.length).toBe(121);
    });

    it("没有公开参数时详情留空，由渲染层决定不显示第二行", () => {
        expect(resolveToolDetail({
            id: "t1",
            index: 0,
            name: "bash",
            argsText: "{}",
            status: "running",
        })).toBe("");
    });

    it("失败的操作先显示失败原因：这时「动了哪个文件」不是重点", () => {
        const detail = resolveToolDetail({
            id: "t1",
            index: 0,
            name: "get_session",
            argsText: "{}",
            status: "error",
            error: "get_session recentMessages 超出 tokenBudget：估算 320 > 300。",
            publicArgs: {
                kind: "generic",
                value: {
                    kind: "object",
                    entries: [
                        {key: "includeRecentMessages", value: {kind: "boolean", value: true}},
                        {key: "recentMessageLimit", value: {kind: "number", value: 2}},
                        {key: "sessionId", value: {kind: "number", value: 23}},
                        {key: "tokenBudget", value: {kind: "number", value: 300}},
                    ],
                    omittedEntries: 0,
                },
            },
        });

        expect(detail).toBe("get_session recentMessages 超出 tokenBudget：估算 320 > 300。");
    });

    it("失败的编辑同样先说失败原因，文件名让位", () => {
        const detail = resolveToolDetail({
            id: "t1",
            index: 0,
            name: "edit",
            argsText: "{}",
            status: "error",
            error: "文件已被外部修改，请重新读取。",
            publicArgs: {kind: "edit", path: "manuscript/第03章.md", edits: [], omittedEdits: 0},
        });

        expect(detail).toBe("文件已被外部修改，请重新读取。");
    });

    it("失败但没有 error 文本时退回参数详情，不至于空白", () => {
        const detail = resolveToolDetail({
            id: "t1",
            index: 0,
            name: "edit",
            argsText: "{}",
            status: "invalid",
            publicArgs: {kind: "edit", path: "manuscript/第03章.md", edits: [], omittedEdits: 0},
        });

        expect(detail).toBe("manuscript/第03章.md");
    });

    it("参数全是数字时用「键=值」兜底：布尔说不出内容，跳过", () => {
        const detail = resolveToolDetail({
            id: "t1",
            index: 0,
            name: "get_session",
            argsText: "{}",
            status: "running",
            publicArgs: {
                kind: "generic",
                value: {
                    kind: "object",
                    entries: [
                        {key: "includeRecentMessages", value: {kind: "boolean", value: true}},
                        {key: "recentMessageLimit", value: {kind: "number", value: 2}},
                        {key: "sessionId", value: {kind: "number", value: 23}},
                    ],
                    omittedEntries: 0,
                },
            },
        });

        expect(detail).toBe("recentMessageLimit=2");
    });

    it("块内优先取失败那一步，不被排在它前面的成功步骤挡住", () => {
        const nodeOf = (nodeKey: string, toolCall: Omit<AgentToolCall, "id">) => ({
            kind: "tool" as const,
            message: {id: "assistant-1", type: "ai", content: ""} as AgentMessage,
            toolCall: {...toolCall, id: nodeKey},
        });
        const succeed = nodeOf("t1", {
            index: 0,
            name: "edit",
            argsText: "{}",
            status: "success",
            publicArgs: {kind: "edit", path: "manuscript/第01章.md", edits: [], omittedEdits: 0},
        });
        const fail = nodeOf("t2", {
            index: 1,
            name: "edit",
            argsText: "{}",
            status: "error",
            error: "文件未写入。",
            publicArgs: {kind: "edit", path: "manuscript/第02章.md", edits: [], omittedEdits: 0},
        });

        const outline = buildChatOutline([{
            kind: "block",
            id: "b1",
            blockKind: "edit",
            nodes: [succeed, fail],
            hasFailure: true,
            isRunning: false,
            filePaths: [],
            toolNames: ["edit"],
            count: 2,
        }], resolveNodeKey);

        expect(outline[0]).toEqual(expect.objectContaining({detail: "文件未写入。"}));
    });
});
