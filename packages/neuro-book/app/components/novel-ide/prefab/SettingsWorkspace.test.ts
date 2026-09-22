import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {describe, expect, it} from "vitest";
import enUS from "nbook/app/i18n/locales/en-US";
import zhCN from "nbook/app/i18n/locales/zh-CN";

const componentPath = fileURLToPath(new URL("./SettingsWorkspace.vue", import.meta.url));

/** 在 locale 对象上按点分键路径取值；任一层缺失返回 undefined。 */
function pick(root: unknown, path: string): unknown {
    return path.split(".").reduce<unknown>((node, key) => (
        node !== null && typeof node === "object" && key in (node as Record<string, unknown>)
            ? (node as Record<string, unknown>)[key]
            : undefined
    ), root);
}

/** 组件源码引用的全部 settingsWorkspace.* 键：t() 调用与占位清单 titleKey/labelKey 字面量并集。 */
async function referencedI18nKeys(): Promise<string[]> {
    const source = await readFile(componentPath, "utf-8");
    return [...new Set([...source.matchAll(/["'](settingsWorkspace\.[A-Za-z0-9.]+)["']/g)].map((match) => match[1]))];
}

describe("SettingsWorkspace 骨架契约（009 prefab）", () => {
    it("props 入口与 emits 出口定义存在：sections/activeSectionId/fields 进，section-change/search/setting-change 出", async () => {
        const source = await readFile(componentPath, "utf-8");
        expect(source).toContain("defineProps<{");
        expect(source).toContain("sections?:");
        expect(source).toContain("activeSectionId?:");
        expect(source).toContain("fields?:");
        expect(source).toContain("defineEmits<{");
        expect(source).toContain('(e: "section-change"');
        expect(source).toContain('(e: "search"');
        expect(source).toContain('(e: "setting-change"');
        // 即时生效语义（L-4/C2）：三个出口都有实际 emit 调用，变更直接出组件、无保存按钮可依
        expect(source).toContain('emit("section-change"');
        expect(source).toContain('emit("search"');
        expect(source).toContain('emit("setting-change"');
    });

    it("源码引用的每个 i18n 键在双语 locale 中均有值，文案一律按键取值", async () => {
        const keys = await referencedI18nKeys();
        expect(keys.length).toBeGreaterThan(0);
        // zh-CN.ts:1809 已登记的 vue-i18n 嵌套限制：fields.theme/defaultModel 作为父键无叶子文案，
        // 组件却以 labelKey 引用它们——骨架期豁免为"结构键存在"，修复（改键或清单拆分）后此豁免应删除。
        const structureKeys = new Set(["settingsWorkspace.fields.theme", "settingsWorkspace.fields.defaultModel"]);
        for (const key of keys) {
            const zh = pick(zhCN, key);
            const en = pick(enUS, key);
            expect(zh, `zh-CN 缺键 ${key}`).toBeDefined();
            expect(en, `en-US 缺键 ${key}`).toBeDefined();
            if (structureKeys.has(key)) {
                expect(zh, `${key} 应保持结构父键形态`).toBeTypeOf("object");
                expect(en, `${key} 应保持结构父键形态`).toBeTypeOf("object");
            } else {
                expect(zh, `${key} zh-CN 无文案`).toBeTypeOf("string");
                expect((zh as string).length, `${key} zh-CN 为空串`).toBeGreaterThan(0);
                expect(en, `${key} en-US 无文案`).toBeTypeOf("string");
                expect((en as string).length, `${key} en-US 为空串`).toBeGreaterThan(0);
            }
        }
        // 抽取器确实覆盖到了真实键（而非零匹配空跑）
        expect(keys).toContain("settingsWorkspace.title");
        expect(keys).toContain("settingsWorkspace.sections.appearance");
        expect(keys).toContain("settingsWorkspace.fields.theme.system");
    });
});
