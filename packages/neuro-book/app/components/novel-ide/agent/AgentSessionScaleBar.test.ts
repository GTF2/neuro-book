import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {describe, expect, it} from "vitest";
import enUS from "nbook/app/i18n/locales/en-US";
import zhCN from "nbook/app/i18n/locales/zh-CN";

const componentPath = fileURLToPath(new URL("./AgentSessionScaleBar.vue", import.meta.url));

describe("AgentSessionScaleBar 契约（规格包 009 单C 批次1 §3/§4.3）", () => {
    it("props/emits 与规格逐字一致：segments/activeIndex + seek(index)/expand()", async () => {
        const source = await readFile(componentPath, "utf-8");
        expect(source).toContain("segments: AgentSessionScaleSegment[]");
        expect(source).toContain("activeIndex: number");
        expect(source).toContain('(e: "seek", index: number)');
        expect(source).toContain('(e: "expand")');
        expect(source).toContain("anchorIndex: number");
        expect(source).toContain("summary: string");
    });

    it("右缘 24px 细条、格高下限可点击、hover 预览卡、拖动节流就位", async () => {
        const source = await readFile(componentPath, "utf-8");
        expect(source).toContain("w-6");
        expect(source).toContain("min-h-[4px]");
        expect(source).toContain("hoverIndex");
        expect(source).toContain("setPointerCapture");
        expect(source).toContain("SEEK_THROTTLE_MS");
    });

    it("「查看全部」i18n 键 agent.composer.scaleBarViewAll 双语齐备", () => {
        expect(zhCN.agent.composer.scaleBarViewAll).toBe("查看全部会话");
        expect(enUS.agent.composer.scaleBarViewAll).toBeTruthy();
    });
});
