import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {describe, expect, it} from "vitest";
import enUS from "nbook/app/i18n/locales/en-US";
import zhCN from "nbook/app/i18n/locales/zh-CN";

const componentPath = fileURLToPath(new URL("./AgentScaleOutlinePanel.vue", import.meta.url));

describe("AgentScaleOutlinePanel 契约（009C1R 必修B 三形态之二）", () => {
    it("行类型 prompt/answer/work + seek/view-all/close 三通道 + 65% 宽右缘滑入", async () => {
        const source = await readFile(componentPath, "utf-8");
        expect(source).toContain('kind: "prompt" | "answer" | "work"');
        expect(source).toContain("flowIndex: number");
        expect(source).toContain('(e: "seek", flowIndex: number)');
        expect(source).toContain('(e: "view-all")');
        expect(source).toContain('(e: "close")');
        expect(source).toContain("w-[65%]");
        expect(source).toContain("right-7");
    });

    it("i18n 键 agent.composer.scaleOutlineTitle 双语齐备", () => {
        expect(zhCN.agent.composer.scaleOutlineTitle).toBe("对话大纲");
        expect(enUS.agent.composer.scaleOutlineTitle).toBeTruthy();
    });
});
