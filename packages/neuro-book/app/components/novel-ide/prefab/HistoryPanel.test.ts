import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {describe, expect, it} from "vitest";
import enUS from "nbook/app/i18n/locales/en-US";
import zhCN from "nbook/app/i18n/locales/zh-CN";

const componentPath = fileURLToPath(new URL("./HistoryPanel.vue", import.meta.url));

/** 在 locale 对象上按点分键路径取值；任一层缺失返回 undefined。 */
function pick(root: unknown, path: string): unknown {
    return path.split(".").reduce<unknown>((node, key) => (
        node !== null && typeof node === "object" && key in (node as Record<string, unknown>)
            ? (node as Record<string, unknown>)[key]
            : undefined
    ), root);
}

describe("HistoryPanel 骨架契约（009 prefab）", () => {
    it("props 入口与 emits 出口定义存在：activeId/sessions 进，select/new 出", async () => {
        const source = await readFile(componentPath, "utf-8");
        expect(source).toContain("defineProps<{");
        expect(source).toContain("activeId?:");
        expect(source).toContain("sessions?:");
        expect(source).toContain("defineEmits<{");
        expect(source).toContain('(e: "select"');
        expect(source).toContain('(e: "new"');
        // 点会话行带 id 发 select，「新会话」发 new
        expect(source).toContain("emit('select', session.id)");
        expect(source).toContain("emit('new')");
    });

    it("源码引用的每个 prefab.historyPanel.* 键在双语 locale 中均非空，文案一律按键取值", async () => {
        const source = await readFile(componentPath, "utf-8");
        const keys = [...new Set([...source.matchAll(/["'](prefab\.historyPanel\.[A-Za-z0-9.]+)["']/g)].map((match) => match[1]).filter((key): key is string => key !== undefined))];
        expect(keys.length).toBeGreaterThan(0);
        for (const key of keys) {
            const zh = pick(zhCN, key);
            const en = pick(enUS, key);
            expect(zh, `zh-CN 缺键 ${key}`).toBeTypeOf("string");
            expect((zh as string).length, `${key} zh-CN 为空串`).toBeGreaterThan(0);
            expect(en, `en-US 缺键 ${key}`).toBeTypeOf("string");
            expect((en as string).length, `${key} en-US 为空串`).toBeGreaterThan(0);
        }
        // 抽取器确实覆盖到了真实键（而非零匹配空跑），含标题、新会话按钮与占位样例
        expect(keys).toContain("prefab.historyPanel.title");
        expect(keys).toContain("prefab.historyPanel.newChat");
        expect(keys).toContain("prefab.historyPanel.empty");
        expect(keys).toContain("prefab.historyPanel.samplePreview3");
    });

    it("时间文案跟随 locale 走 Intl.DateTimeFormat，不硬编码时文案", async () => {
        const source = await readFile(componentPath, "utf-8");
        // formatTime 两个分支都以当前 locale 构造格式化器（24h 内显时刻、更早显月日）
        expect(source).toContain('Intl.DateTimeFormat(locale.value, {hour: "2-digit", minute: "2-digit"})');
        expect(source).toContain('Intl.DateTimeFormat(locale.value, {month: "numeric", day: "numeric"})');
        // <time> 元素带机器可读 datetime 属性
        expect(source).toContain(':datetime="new Date(session.updatedAt).toISOString()"');
    });
});
