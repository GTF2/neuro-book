import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {describe, expect, it} from "vitest";
import enUS from "nbook/app/i18n/locales/en-US";
import zhCN from "nbook/app/i18n/locales/zh-CN";

const componentPath = fileURLToPath(new URL("./AgentSessionScaleBar.vue", import.meta.url));

describe("AgentSessionScaleBar 契约（R4 件3：波浪格高+fixed 预览+命中回归修复）", () => {
    it("props/emits：segments/activeIndex + seek/expand 两通道（中面板 open-outline 已删）", async () => {
        const source = await readFile(componentPath, "utf-8");
        expect(source).toContain("segments: AgentSessionScaleSegment[]");
        expect(source).toContain("activeIndex: number");
        expect(source).toContain('(e: "seek", index: number)');
        expect(source).toContain('(e: "expand")');
        expect(source).not.toContain("open-outline");
    });

    it("R4 件3③：格高两轨合一——非选中波浪 6-14px+3 格滑动平均，选中强调格 20px 显著更高", async () => {
        const source = await readFile(componentPath, "utf-8");
        expect(source).toContain("WAVE_MIN_PX = 6");
        expect(source).toContain("WAVE_MAX_PX = 14");
        expect(source).toContain("ACTIVE_BAR_PX = 20");
        expect(source).toContain("smoothWeight");
        expect(source).not.toContain("h-[2px]");
        // 密度另用颜色深浅辅助（opacity 0.45-0.85），高度波浪为主
        expect(source).toContain("0.45 + ratio * 0.4");
    });

    it("R4 件3④：整体与单格加宽——容器 w-9、格条 w-2（8px 量级）", async () => {
        const source = await readFile(componentPath, "utf-8");
        expect(source).toContain("w-9");
        expect(source).toContain("w-2 ");
    });

    it("R4 件3①回归修复：justify-center 布局下按格元素命中取下标，禁坐标均分换算", async () => {
        const source = await readFile(componentPath, "utf-8");
        expect(source).toContain("justify-center");
        expect(source).toContain("y >= rect.top && y < rect.bottom");
        expect(source).not.toContain("SEGMENT_ROW_PX");
        expect(source).not.toContain("track.scrollTop");
    });

    it("R4 件3②：hover 预览卡 fixed 贴鼠标（12,12 偏移+近缘翻面），不再随格 translateY", async () => {
        const source = await readFile(componentPath, "utf-8");
        expect(source).toContain("pointer-events-none fixed");
        expect(source).toContain("event.clientX + 12");
        expect(source).toContain("event.clientY + 12");
        expect(source).toContain("PREVIEW_W_PX");
        expect(source).not.toContain("hoverTopPx");
        expect(source).not.toContain("right-full");
    });

    it("密度承载（009C1R2 件4 沿革）：框高 2/3 居中+轨道隐藏滚动条", async () => {
        const source = await readFile(componentPath, "utf-8");
        expect(source).toContain("h-2/3");
        expect(source).toContain("rail-scroll");
    });

    it("点格=直接 seek、拖动节流（R2 实测 8259→4774 点击直滚链路的组件侧保障）", async () => {
        const source = await readFile(componentPath, "utf-8");
        expect(source).toContain("handleSegmentClick");
        expect(source).toContain("seekIndex");
        expect(source).toContain("setPointerCapture");
        expect(source).toContain("SEEK_THROTTLE_MS");
    });

    it("「查看全部」i18n 键双语齐备", () => {
        expect(zhCN.agent.composer.scaleBarViewAll).toBe("查看全部会话");
        expect(enUS.agent.composer.scaleBarViewAll).toBeTruthy();
    });
});
