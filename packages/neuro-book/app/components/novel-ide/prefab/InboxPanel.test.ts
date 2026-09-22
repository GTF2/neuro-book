import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {describe, expect, it} from "vitest";
import enUS from "nbook/app/i18n/locales/en-US";
import zhCN from "nbook/app/i18n/locales/zh-CN";

const componentPath = fileURLToPath(new URL("./InboxPanel.vue", import.meta.url));

/** 在 locale 对象上按点分键路径取值；任一层缺失返回 undefined。 */
function pick(root: unknown, path: string): unknown {
    return path.split(".").reduce<unknown>((node, key) => (
        node !== null && typeof node === "object" && key in (node as Record<string, unknown>)
            ? (node as Record<string, unknown>)[key]
            : undefined
    ), root);
}

describe("InboxPanel 骨架契约（009 prefab）", () => {
    it("props 入口与 emits 出口定义存在：items/activeItemId 进，open/close 出", async () => {
        const source = await readFile(componentPath, "utf-8");
        expect(source).toContain("defineProps<{");
        expect(source).toContain("items?:");
        expect(source).toContain("activeItemId?:");
        expect(source).toContain("defineEmits<{");
        expect(source).toContain('(e: "open"');
        expect(source).toContain('(e: "close"');
        // U4 未决（3+ 条待办去向归宿主）：点行带 itemId 发 open，收起发 close，组件不自行路由
        expect(source).toContain("emit('open', item.id)");
        expect(source).toContain("emit('close')");
    });

    it("源码引用的每个 prefab.inbox.* 键在双语 locale 中均非空，文案一律按键取值", async () => {
        const source = await readFile(componentPath, "utf-8");
        const keys = [...new Set([...source.matchAll(/["'](prefab\.inbox\.[A-Za-z0-9.]+)["']/g)].map((match) => match[1]))];
        expect(keys.length).toBeGreaterThan(0);
        for (const key of keys) {
            const zh = pick(zhCN, key);
            const en = pick(enUS, key);
            expect(zh, `zh-CN 缺键 ${key}`).toBeTypeOf("string");
            expect((zh as string).length, `${key} zh-CN 为空串`).toBeGreaterThan(0);
            expect(en, `en-US 缺键 ${key}`).toBeTypeOf("string");
            expect((en as string).length, `${key} en-US 为空串`).toBeGreaterThan(0);
        }
        // 抽取器确实覆盖到了真实键（而非零匹配空跑），含空态与占位样例文案键
        expect(keys).toContain("prefab.inbox.title");
        expect(keys).toContain("prefab.inbox.empty");
        expect(keys).toContain("prefab.inbox.demoTitle1");
        expect(keys).toContain("prefab.inbox.demoDetail3");
    });
});
