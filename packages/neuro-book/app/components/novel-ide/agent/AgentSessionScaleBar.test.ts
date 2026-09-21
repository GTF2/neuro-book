import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {describe, expect, it} from "vitest";
import enUS from "nbook/app/i18n/locales/en-US";
import zhCN from "nbook/app/i18n/locales/zh-CN";

const componentPath = fileURLToPath(new URL("./AgentSessionScaleBar.vue", import.meta.url));

describe("AgentSessionScaleBar 契约（009C1R 必修B：右缘固定+三形态）", () => {
    it("props/emits：segments/activeIndex + seek/open-outline/expand 三通道", async () => {
        const source = await readFile(componentPath, "utf-8");
        expect(source).toContain("segments: AgentSessionScaleSegment[]");
        expect(source).toContain("activeIndex: number");
        expect(source).toContain('(e: "seek", index: number)');
        expect(source).toContain('(e: "open-outline", gridIndex: number)');
        expect(source).toContain('(e: "expand")');
        expect(source).toContain("anchorIndex: number");
        expect(source).toContain("summary: string");
    });

    it("点击格开中面板、拖动 seek 节流、点击拖动区分就位", async () => {
        const source = await readFile(componentPath, "utf-8");
        expect(source).toContain("DRAG_THRESHOLD_PX");
        expect(source).toContain("suppressClickAt");
        expect(source).toContain("setPointerCapture");
        expect(source).toContain("SEEK_THROTTLE_MS");
        expect(source).toContain("emit(\"open-outline\"");
    });

    it("右缘 24px 细条、格高下限可点击、hover 预览卡跟格移动", async () => {
        const source = await readFile(componentPath, "utf-8");
        expect(source).toContain("w-6");
        expect(source).toContain("min-h-[4px]");
        expect(source).toContain("hoverTopPx");
    });

    it("「查看全部」i18n 键 agent.composer.scaleBarViewAll 双语齐备", () => {
        expect(zhCN.agent.composer.scaleBarViewAll).toBe("查看全部会话");
        expect(enUS.agent.composer.scaleBarViewAll).toBeTruthy();
    });
});
