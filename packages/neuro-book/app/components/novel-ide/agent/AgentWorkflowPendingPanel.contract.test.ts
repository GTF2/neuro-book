import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {describe, expect, it} from "vitest";
import enUS from "nbook/app/i18n/locales/en-US";
import zhCN from "nbook/app/i18n/locales/zh-CN";

const componentPath = fileURLToPath(new URL("./AgentWorkflowPendingPanel.vue", import.meta.url));

describe("AgentWorkflowPendingPanel 契约（R4 件10：计数同源+三路关闭）", () => {
    it("徽标计数与统一待办库同源（G1：waitingCount 由 workflowAnswerCount props 供给，面板不再本地数数）", async () => {
        const source = await readFile(componentPath, "utf-8");
        // G1 任务031 D 段：徽标计数唯一真源=统一待办库（AgentChatSurface 的 unifiedTodo 供给），
        // 面板内 waitingJobs 只承载渲染队列，禁止回退为本地计数源。
        expect(source).toContain("const waitingCount = computed(() => props.workflowAnswerCount);");
        expect(source).not.toContain("computed(() => waitingJobs.value.length)");
        // 面板内队列/关闭/渲染条件仍用 waitingCount，不得另起数据源
        expect(source.match(/waitingCount/g)?.length).toBeGreaterThanOrEqual(3);
    });

    it("关闭路径（R5 裁剪）：徽标 toggle+Esc 两路；点外收起已移除（无 onClickOutside）", async () => {
        const source = await readFile(componentPath, "utf-8");
        expect(source).toContain("@click=\"pendingPanelOpen = !pendingPanelOpen\"");
        expect(source).toContain("@keydown.esc=\"pendingPanelOpen = false\"");
        expect(source).not.toContain("onClickOutside");
        expect(source).not.toContain("badgeRef");
    });

    it("面板渲染条件=waitingCount 或 feed.error（无等待且无错时整节不渲染）", async () => {
        const source = await readFile(componentPath, "utf-8");
        expect(source).toContain('v-if="waitingCount || feed.error"');
    });

    it("owner 过滤=当前 sessionId（API 直建的 run 不误入本会话徽标；判定与统一待办库共享）", async () => {
        const source = await readFile(componentPath, "utf-8");
        // G1 任务031：过滤判定提升到 toWorkflowWaitingRefs（Panel 与统一待办库共用同一实现），防徽标与库计数漂移。
        expect(source).toContain("toWorkflowWaitingRefs");
        const sharedPath = fileURLToPath(new URL("./unified-todo.ts", import.meta.url));
        const sharedSource = await readFile(sharedPath, "utf-8");
        expect(sharedSource).toContain("job.ownerSessionId !== sessionId");
    });

    it("i18n 键双语齐备（面板文案）", () => {
        expect(zhCN.agent.userInput?.pendingBlockedTitle).toBe("待处理 · 当前不可回答");
        expect(enUS.agent.userInput?.pendingBlockedTitle).toBe("Pending · not answerable now");
        expect(zhCN.agent.workBlock?.groupErrorSuffix).toContain("异常");
        expect(enUS.agent.workBlock?.groupErrorSuffix).toContain("errors");
    });
});
