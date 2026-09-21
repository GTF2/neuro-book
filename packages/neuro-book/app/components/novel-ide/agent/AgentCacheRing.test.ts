import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {describe, expect, it} from "vitest";
import enUS from "nbook/app/i18n/locales/en-US";
import zhCN from "nbook/app/i18n/locales/zh-CN";

const componentPath = fileURLToPath(new URL("./AgentCacheRing.vue", import.meta.url));

describe("AgentCacheRing 契约（009C1R2 件1：环=上下文占用/模型窗口比例）", () => {
    it("props=ringRatio(同 gauge 源)+上下文行+缓存明细五行", async () => {
        const source = await readFile(componentPath, "utf-8");
        expect(source).toContain("ringRatio: number | null");
        expect(source).toContain("contextUsageLabel: string");
        expect(source).toContain("contextPercentLabel?: string");
        expect(source).toContain("cachedLabel: string");
        expect(source).toContain("limitLabel: string");
        expect(source).toContain("inputLabel: string");
        expect(source).toContain("outputLabel: string");
        expect(source).toContain("hitRateLabel: string");
        expect(source).toContain('(e: "open-context-inspector")');
        expect(source).not.toContain("cacheRead");
    });

    it("面板首行=上下文占用、左对齐绿环不溢出（件1c）", async () => {
        const source = await readFile(componentPath, "utf-8");
        expect(source).toContain("cacheRingContext");
        expect(source).toContain("bottom-full left-0");
        expect(source).not.toContain("left-1/2");
    });

    it("i18n 键双语齐备", () => {
        expect(zhCN.agent.composer.cacheRingContext).toBe("上下文占用");
        expect(zhCN.agent.composer.cacheRingCached).toBe("已缓存");
        expect(zhCN.agent.composer.cacheRingLimit).toBe("最大缓存");
        expect(zhCN.agent.composer.cacheRingUpload).toBe("上传");
        expect(zhCN.agent.composer.cacheRingDownload).toBe("下载");
        expect(zhCN.agent.composer.cacheRingHitRate).toBe("命中率");
        expect(enUS.agent.composer.cacheRingContext).toBeTruthy();
        expect(enUS.agent.composer.cacheRingCached).toBeTruthy();
    });
});
