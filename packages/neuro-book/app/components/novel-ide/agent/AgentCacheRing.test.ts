import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {describe, expect, it} from "vitest";
import enUS from "nbook/app/i18n/locales/en-US";
import zhCN from "nbook/app/i18n/locales/zh-CN";

const componentPath = fileURLToPath(new URL("./AgentCacheRing.vue", import.meta.url));

describe("AgentCacheRing 契约（规格包 009 单C 批次1 §4.1）", () => {
    it("props/emits 与规格逐字一致，空串隐藏与比例描边就位", async () => {
        const source = await readFile(componentPath, "utf-8");
        expect(source).toContain("hitRateLabel: string");
        expect(source).toContain("compactLabel: string");
        expect(source).toContain('(e: "open-context-inspector")');
        expect(source).toContain('v-if="props.hitRateLabel"');
        expect(source).toContain("stroke-dasharray");
        expect(source).toContain("hover:brightness-125");
    });

    it("i18n 键 agent.composer.cacheRingTitle 双语齐备", () => {
        expect(zhCN.agent.composer.cacheRingTitle).toBe("缓存命中概览");
        expect(enUS.agent.composer.cacheRingTitle).toBeTruthy();
    });
});
