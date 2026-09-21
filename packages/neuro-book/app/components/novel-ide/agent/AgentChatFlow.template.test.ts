import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {describe, expect, it} from "vitest";

const componentPath = fileURLToPath(new URL("./AgentChatFlow.vue", import.meta.url));

describe("AgentChatFlow 挂载结构（009C1R 必修B 回归锚）", () => {
    it("刻度条与中面板在滚动容器外：空状态闭合后、外层容器闭合前", async () => {
        const source = await readFile(componentPath, "utf-8");
        const emptyState = source.indexOf('v-else class="flex h-full flex-col items-center justify-center');
        const scaleBar = source.indexOf("<AgentSessionScaleBar");
        const outlinePanel = source.indexOf("<AgentScaleOutlinePanel");
        const templateEnd = source.lastIndexOf("</template>");
        expect(emptyState).toBeGreaterThan(0);
        expect(scaleBar).toBeGreaterThan(emptyState);
        expect(outlinePanel).toBeGreaterThan(scaleBar);
        expect(outlinePanel).toBeLessThan(templateEnd);
        // 滚动容器闭合夹在空状态与刻度条之间（修复前刻度条被嵌进滚动容器内随内容滚动）
        const closings = [...source.matchAll(/<\/div>/g)].map((m) => m.index ?? -1);
        const between = closings.filter((index) => index > emptyState && index < scaleBar);
        expect(between.length).toBeGreaterThanOrEqual(2);
    });

    it("50 格封顶聚合与中面板行投影就位", () => {
        return readFile(componentPath, "utf-8").then((source) => {
            expect(source).toContain("SCALE_SEGMENT_LIMIT = 50");
            expect(source).toContain("Math.ceil(items.length / SCALE_SEGMENT_LIMIT)");
            expect(source).toContain("outlineRows");
            expect(source).toContain("openOutline");
            expect(source).toContain("seekFromOutline");
        });
    });
});
