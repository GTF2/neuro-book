import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {describe, expect, it} from "vitest";
import enUS from "nbook/app/i18n/locales/en-US";
import zhCN from "nbook/app/i18n/locales/zh-CN";

const componentPath = fileURLToPath(new URL("./AgentThinkingLevelSelect.vue", import.meta.url));

describe("AgentThinkingLevelSelect 契约（009C1R2 件4：按模型过滤+删跟随Profile）", () => {
    it("props=请求档/生效档/thinkingLevelMap；选项按 map 过滤、空回退全量七档", async () => {
        const source = await readFile(componentPath, "utf-8");
        expect(source).toContain("modelValue: ThinkingLevelDto | null");
        expect(source).toContain("effectiveLevel?: ThinkingLevelDto | null");
        expect(source).toContain("thinkingLevelMap?: Record<string, string | null> | null");
        expect(source).toContain("supportedLevels");
        expect(source).toContain('props.modelValue ?? props.effectiveLevel');
    });

    it("无「跟随Profile」选项；档位键复用 agent.composer 既有七档", async () => {
        const source = await readFile(componentPath, "utf-8");
        expect(source).not.toContain('""');
        expect(source).not.toContain("followProfile");
        expect(source).toContain("agent.composer.off");
        expect(source).toContain("agent.composer.max");
        expect(zhCN.agent.composer.off).toBeTruthy();
        expect(enUS.agent.composer.max).toBeTruthy();
    });

    it("bare 芯片形态（件7b 去描边）", async () => {
        const source = await readFile(componentPath, "utf-8");
        expect(source).toContain("bare");
    });
});
