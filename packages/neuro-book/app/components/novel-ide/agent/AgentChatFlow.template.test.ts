import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {describe, expect, it} from "vitest";

const componentPath = fileURLToPath(new URL("./AgentChatFlow.vue", import.meta.url));

describe("AgentChatFlow 挂载结构（009C1R2 件2/件3 回归锚）", () => {
    it("刻度条在滚动容器外右缘；点击直接 seek；无中面板残留", async () => {
        const source = await readFile(componentPath, "utf-8");
        const emptyState = source.indexOf('v-else class="flex h-full flex-col items-center justify-center');
        const scaleBar = source.indexOf("<AgentSessionScaleBar");
        const templateEnd = source.lastIndexOf("</template>");
        expect(emptyState).toBeGreaterThan(0);
        expect(scaleBar).toBeGreaterThan(emptyState);
        expect(scaleBar).toBeLessThan(templateEnd);
        expect(source).not.toContain("AgentScaleOutlinePanel");
        expect(source).not.toContain("openOutline");
        expect(source).not.toContain("outlineGridIndex");
        // 点击格=直接定位（件2b）
        expect(source).toContain('@seek="scrollToFlowItem"');
    });

    it("轮次块渲染：块头+轮体分组循环+身份/按钮组/思考行三控制位（件3+R4 件2 聚合）", async () => {
        const source = await readFile(componentPath, "utf-8");
        expect(source).toContain("<AgentWorkBlock");
        expect(source).toContain('item.kind === \'round\'');
        expect(source).toContain("visibleRoundEntries");
        expect(source).toContain("buildRoundEntries");
        expect(source).toContain("isActionsHost");
        expect(source).toContain("isRoundExpanded");
        expect(source).toContain("toggleInjections");
        expect(source).toContain("suppress-identity");
        expect(source).toContain(":suppress-actions");
        expect(source).toContain(":show-thinking");
        // R4 件2②③：注入聚合块+工具聚合行
        expect(source).toContain('entry.kind === \'injectionGroup\'');
        expect(source).toContain('entry.kind === \'toolGroup\'');
        expect(source).toContain("groupErrorSuffix");
        expect(source).toContain("groupFailedSuffix");
        // R4 件3⑤：消息区隐藏原生滚动条（回滚开关在 style 注释）
        expect(source).toContain("chat-scroll-hidden");
    });

    it("间距密度：轮间 16px、轮内节点 8px（件3e）；50 格封顶聚合保持", () => {
        return readFile(componentPath, "utf-8").then((source) => {
            expect(source).toContain("return index === 0 ? \"\" : \"mt-4\"");
            expect(source).toContain("'mt-2'");
            expect(source).toContain("SCALE_SEGMENT_LIMIT = 50");
            expect(source).toContain("weight");
        });
    });
});
