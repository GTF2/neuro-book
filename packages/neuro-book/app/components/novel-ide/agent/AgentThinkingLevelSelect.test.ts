import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {describe, expect, it} from "vitest";
import enUS from "nbook/app/i18n/locales/en-US";
import zhCN from "nbook/app/i18n/locales/zh-CN";

const componentPath = fileURLToPath(new URL("./AgentThinkingLevelSelect.vue", import.meta.url));

describe("AgentThinkingLevelSelect 契约（规格包 009 单C 批次1 §4.2）", () => {
    it("props/emits 与规格一致，modelValue 用真实 ThinkingLevelDto", async () => {
        const source = await readFile(componentPath, "utf-8");
        expect(source).toContain('modelValue: ThinkingLevelDto | null');
        expect(source).toContain("disabled?: boolean");
        expect(source).toContain('(e: "update:modelValue", value: ThinkingLevelDto)');
        expect(source).toContain('from "nbook/shared/dto/app-settings.dto"');
    });

    it("快捷件只露低/中/高三档，i18n 键 thinkingLevel.low/mid/high 双语齐备", async () => {
        const source = await readFile(componentPath, "utf-8");
        expect(source).toContain('"low" | "medium" | "high"');
        expect(source).toContain("agent.composer.thinkingLevel.low");
        expect(source).toContain("agent.composer.thinkingLevel.mid");
        expect(source).toContain("agent.composer.thinkingLevel.high");

        expect(zhCN.agent.composer.thinkingLevel.low).toBe("低");
        expect(zhCN.agent.composer.thinkingLevel.mid).toBe("中");
        expect(zhCN.agent.composer.thinkingLevel.high).toBe("高");
        expect(enUS.agent.composer.thinkingLevel.low).toBeTruthy();
        expect(enUS.agent.composer.thinkingLevel.mid).toBeTruthy();
        expect(enUS.agent.composer.thinkingLevel.high).toBeTruthy();
    });
});
