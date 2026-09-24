import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {describe, expect, it} from "vitest";

const componentPath = fileURLToPath(new URL("./AgentComposer.vue", import.meta.url));

describe("AgentComposer 契约（G1 任务031 E 段：红框条目归位）", () => {
    it("阻塞卡（红框）内联挂载于 Composer 输入区上方，非独立浮层", async () => {
        const source = await readFile(componentPath, "utf-8");
        // 挂载点以现行代码为准（审计基准 AgentComposer.vue:539，行号漂移按实际）；
        // 归位语义=统一应答协议中阻塞型的入口位置=输入区上方内联，禁 Teleport 浮层化。
        expect(source).toContain("<AgentUserInputPrompt");
        expect(source).not.toContain("<Teleport");
        // 挂载条件走阻塞型待办链（pendingUserInputSessions 派生），与统一待办库同源。
        expect(source).toContain('v-if="hasPendingUserInput && !pendingDismissed"');
    });
});
