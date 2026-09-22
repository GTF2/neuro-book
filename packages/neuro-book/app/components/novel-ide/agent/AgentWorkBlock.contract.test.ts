import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {describe, expect, it} from "vitest";
import zhCN from "nbook/app/i18n/locales/zh-CN";

const componentPath = fileURLToPath(new URL("./AgentWorkBlock.vue", import.meta.url));

describe("AgentWorkBlock 块头时长契约（R4 件1+R5 件2：三态+钳制+居中）", () => {
    it("三态：真无数据→本轮；有数据→真实跨度；<2 秒归「本轮」（不再显示假 1 秒）", async () => {
        const source = await readFile(componentPath, "utf-8");
        expect(source).toContain("MIN_DISPLAYABLE_SECONDS = 2");
        expect(source).toContain('if (totalSeconds < MIN_DISPLAYABLE_SECONDS) {\n        return t("agent.workBlock.workRound");');
        expect(source).not.toContain("Math.max(1, Math.round(props.round.durationMs / 1000))");
    });

    it("运行中动态计时（nowTick 每秒）+陈旧钳制（超 1 小时回退静态）", async () => {
        const source = await readFile(componentPath, "utf-8");
        expect(source).toContain("nowTick");
        expect(source).toContain("STALE_RUNNING_CAP_MS = 3_600_000");
    });

    it("块头行内元素同一垂直中线（items-center+leading-4）", async () => {
        const source = await readFile(componentPath, "utf-8");
        expect(source).toContain("items-center gap-1.5");
        expect(source).toContain("leading-4");
    });

    it("i18n 键齐备", () => {
        expect(zhCN.agent.workBlock?.workRound).toBe("本轮");
        expect(zhCN.agent.workBlock?.workedSeconds).toContain("{seconds}");
    });
});
