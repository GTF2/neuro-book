import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {describe, expect, it} from "vitest";
import enUS from "nbook/app/i18n/locales/en-US";
import zhCN from "nbook/app/i18n/locales/zh-CN";

const componentPath = fileURLToPath(new URL("./AgentSessionScaleBar.vue", import.meta.url));

describe("AgentSessionScaleBar 契约（009C1R2 件2：细线视觉+点格直滚）", () => {
    it("props/emits：segments/activeIndex + seek/expand 两通道（中面板 open-outline 已删）", async () => {
        const source = await readFile(componentPath, "utf-8");
        expect(source).toContain("segments: AgentSessionScaleSegment[]");
        expect(source).toContain("activeIndex: number");
        expect(source).toContain('(e: "seek", index: number)');
        expect(source).toContain('(e: "expand")');
        expect(source).not.toContain("open-outline");
        expect(source).not.toContain("outline");
    });

    it("2px 细横线+体量分级+无底轨无边框（禁胶囊大块）", async () => {
        const source = await readFile(componentPath, "utf-8");
        expect(source).toContain("h-[2px]");
        expect(source).toContain("weight");
        expect(source).not.toContain("min-h-[4px]");
        expect(source).not.toContain("bg-[var(--accent-main)]");
    });

    it("密度映射（009C1R2 件4）：固定格高+框高 2/3 居中+隐藏滚动+指针换算含滚动偏移", async () => {
        const source = await readFile(componentPath, "utf-8");
        expect(source).toContain("h-2.5");
        expect(source).toContain("h-2/3");
        expect(source).toContain("justify-center");
        expect(source).toContain("rail-scroll");
        expect(source).toContain("SEGMENT_ROW_PX");
        expect(source).toContain("track.scrollTop");
    });

    it("点格=直接 seek、拖动节流、hover 预览跟格", async () => {
        const source = await readFile(componentPath, "utf-8");
        expect(source).toContain("handleSegmentClick");
        expect(source).toContain("seekIndex");
        expect(source).toContain("setPointerCapture");
        expect(source).toContain("SEEK_THROTTLE_MS");
        expect(source).toContain("hoverTopPx");
    });

    it("「查看全部」i18n 键双语齐备", () => {
        expect(zhCN.agent.composer.scaleBarViewAll).toBe("查看全部会话");
        expect(enUS.agent.composer.scaleBarViewAll).toBeTruthy();
    });
});
