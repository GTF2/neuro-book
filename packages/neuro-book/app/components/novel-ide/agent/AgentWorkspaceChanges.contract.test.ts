import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {describe, expect, it} from "vitest";

const componentPath = fileURLToPath(new URL("./AgentWorkspaceChanges.vue", import.meta.url));

describe("AgentWorkspaceChanges 契约", () => {
    it("R5c：loading 不参与显示条件——保存文件触发的 inbox 刷新不再在输入框上方闪现检查条", async () => {
        const source = await readFile(componentPath, "utf-8");
        expect(source).toContain("groups.value.length > 0 || error.value");
        expect(source).not.toContain("loading.value ||");
        expect(source).not.toContain("workspaceChanges.checking");
    });
});
