import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {describe, expect, it} from "vitest";
import enUS from "nbook/app/i18n/locales/en-US";
import zhCN from "nbook/app/i18n/locales/zh-CN";

const componentPath = fileURLToPath(new URL("./AgentThinkingLevelSelect.vue", import.meta.url));

describe("AgentThinkingLevelSelect 契约（009C1R 微调4/5：八项全量+读真实当前档）", () => {
    it("props 读会话真实档与生效档，emit 还原 DTO|null 即选即生效", async () => {
        const source = await readFile(componentPath, "utf-8");
        expect(source).toContain("modelValue: ThinkingLevelDto | null");
        expect(source).toContain("effectiveLevel?: ThinkingLevelDto | null");
        expect(source).toContain('(e: "update:modelValue", value: ThinkingLevelDto | null)');
        expect(source).toContain('from "nbook/shared/dto/app-settings.dto"');
    });

    it("全量八项=跟随Profile+七档 DTO，复用 agent.composer 既有档位键", async () => {
        const source = await readFile(componentPath, "utf-8");
        expect(source).toContain("agent.composer.followProfile");
        expect(source).toContain("agent.composer.off");
        expect(source).toContain("agent.composer.minimal");
        expect(source).toContain("agent.composer.low");
        expect(source).toContain("agent.composer.medium");
        expect(source).toContain("agent.composer.high");
        expect(source).toContain("agent.composer.xhigh");
        expect(source).toContain("agent.composer.max");
        expect(source).toContain("FormSelect");

        expect(zhCN.agent.composer.followProfile).toBeTruthy();
        expect(zhCN.agent.composer.off).toBeTruthy();
        expect(zhCN.agent.composer.minimal).toBeTruthy();
        expect(zhCN.agent.composer.low).toBe("低");
        expect(zhCN.agent.composer.medium).toBeTruthy();
        expect(zhCN.agent.composer.high).toBeTruthy();
        expect(zhCN.agent.composer.xhigh).toBeTruthy();
        expect(zhCN.agent.composer.max).toBeTruthy();
        expect(enUS.agent.composer.followProfile).toBeTruthy();
        expect(enUS.agent.composer.max).toBeTruthy();
    });
});
