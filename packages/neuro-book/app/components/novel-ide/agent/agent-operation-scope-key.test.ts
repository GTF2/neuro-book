import {describe, expect, it} from "vitest";
import {inlineOperationScopeOf} from "nbook/app/components/novel-ide/agent/agent-chat-surface-state";

describe("inlineOperationScopeOf", () => {
    const scope = "project:ming-ding-zhi-shi@ready:2";

    it("剥离铸造方自铸的 inline revision 尾段", () => {
        expect(inlineOperationScopeOf(`${scope}@inline:0`)).toBe(scope);
        expect(inlineOperationScopeOf(`${scope}@inline:1`)).toBe(scope);
        expect(inlineOperationScopeOf(`${scope}@inline:137`)).toBe(scope);
    });

    it("两侧独立计数器序号不同时 scope 判定仍然一致", () => {
        // 回归：AgentChatSurface 用自己的计数器铸出 @inline:1，而
        // useInlineEditorAgentController 持有另一个独立计数器并停在 @inline:2。
        // 修复前 sendPrompt 直接比较整个 key，必然不等 → captureOperation 返回
        // null → 用户发送被判成 superseded 并静默丢弃（界面"闪一下就没了"，
        // 服务端收不到 invoke，前端也不报错）。
        expect(inlineOperationScopeOf(`${scope}@inline:1`))
            .toBe(inlineOperationScopeOf(`${scope}@inline:2`));
    });

    it("Project 身份或 ready revision 变化时仍然区分得开", () => {
        expect(inlineOperationScopeOf(`${scope}@inline:1`))
            .not.toBe(inlineOperationScopeOf("project:other-book@ready:2@inline:1"));
        expect(inlineOperationScopeOf(`${scope}@inline:1`))
            .not.toBe(inlineOperationScopeOf("project:ming-ding-zhi-shi@ready:3@inline:1"));
        expect(inlineOperationScopeOf(`${scope}@inline:1`))
            .not.toBe(inlineOperationScopeOf("workspace-root@ready:2@inline:1"));
    });

    it("没有 inline 尾段时原样返回", () => {
        expect(inlineOperationScopeOf(scope)).toBe(scope);
    });

    it("不误伤 scope 段内部的数字", () => {
        expect(inlineOperationScopeOf("project:book-2@ready:10@inline:3"))
            .toBe("project:book-2@ready:10");
    });
});
