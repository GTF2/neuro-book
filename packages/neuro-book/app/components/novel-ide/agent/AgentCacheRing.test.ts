import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {describe, expect, it} from "vitest";
import enUS from "nbook/app/i18n/locales/en-US";
import zhCN from "nbook/app/i18n/locales/zh-CN";

const componentPath = fileURLToPath(new URL("./AgentCacheRing.vue", import.meta.url));

describe("AgentCacheRing 契约（009C1R 必修C：环=已缓存/上下文容量比例）", () => {
    it("props/emits 为比例+五行面板数据，空串隐藏与比例描边就位", async () => {
        const source = await readFile(componentPath, "utf-8");
        expect(source).toContain("cacheRatio: number | null");
        expect(source).toContain("cachedLabel: string");
        expect(source).toContain("limitLabel: string");
        expect(source).toContain("inputLabel: string");
        expect(source).toContain("outputLabel: string");
        expect(source).toContain("hitRateLabel: string");
        expect(source).toContain('(e: "open-context-inspector")');
        expect(source).toContain('v-if="props.cachedLabel"');
        expect(source).toContain("stroke-dasharray");
    });

    it("hover 自制面板五行 i18n 键双语齐备", () => {
        expect(zhCN.agent.composer.cacheRingCached).toBe("已缓存");
        expect(zhCN.agent.composer.cacheRingLimit).toBe("最大缓存");
        expect(zhCN.agent.composer.cacheRingUpload).toBe("上传");
        expect(zhCN.agent.composer.cacheRingDownload).toBe("下载");
        expect(zhCN.agent.composer.cacheRingHitRate).toBe("命中率");
        expect(enUS.agent.composer.cacheRingCached).toBeTruthy();
        expect(enUS.agent.composer.cacheRingLimit).toBeTruthy();
        expect(enUS.agent.composer.cacheRingUpload).toBeTruthy();
        expect(enUS.agent.composer.cacheRingDownload).toBeTruthy();
        expect(enUS.agent.composer.cacheRingHitRate).toBeTruthy();
    });
});
