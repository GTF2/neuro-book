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

    it("R5c 单条跟随版：唯一满宽条=hover??active（focusIndex），灰色 hover 条已删，容器收窄 w-5", async () => {
        const source = await readFile(componentPath, "utf-8");
        expect(source).toContain("BASE_RATIO = 0.55");
        expect(source).toContain("ACTIVE_RATIO = 1");
        expect(source).toContain("HOVER_WAVE_RADIUS = 4");
        expect(source).toContain("hoverIndex.value !== null");
        expect(source).toContain("justify-end");
        expect(source).toContain("w-5");
        expect(source).toContain("width: `${Math.round(segmentBarRatio(index) * 100)}%`");
        expect(source).not.toContain("HOVER_PEAK_RATIO");
        expect(source).not.toContain("bg-[var(--text-secondary)]");
        expect(source).not.toContain("w-9");
        expect(source).not.toContain("spindleRatio");
        expect(source).not.toContain("WAVE_MIN_PX");
    });

    it("R5c：pointer capture 拖动期间预览卡与波浪由 track 侧维护（格子 enter 失效场景）", async () => {
        const source = await readFile(componentPath, "utf-8");
        expect(source).toContain("updateHoverFromPointer(event, gridIndex)");
        expect(source).toContain('@pointerleave="hoverIndex = null"');
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
        // R5c 修复：面板祖先 contain:paint 使 fixed 退化为相对面板（卡被顶出视口 1200px），
        // Teleport 到 .novel-ide-theme 宿主（contain 外+主题变量作用域内，ReferencePlainTextEditor 先例）
        expect(source).toContain('<Teleport :to="previewTeleportTarget">');
        expect(source).toContain('closest(".novel-ide-theme")');
        expect(source).toContain("z-50");
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
