import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {describe, expect, it} from "vitest";
import enUS from "nbook/app/i18n/locales/en-US";
import zhCN from "nbook/app/i18n/locales/zh-CN";

/**
 * 骨架契约桩：neuro-book 包内暂不可挂载 .vue（vitest 为 node 环境且无 @vitejs/plugin-vue，
 * 实测 import .vue 报 "Install @vitejs/plugin-vue"），按退化口径做纯契约断言：
 * 读组件源码 + 从 locale 对象按键取值，断言文案不落中文字面量。
 */
const sourcePath = fileURLToPath(new URL("./TierDropDown.vue", import.meta.url));

/** 组件源码引用的全部 i18n 键（触发器/占位/空态 + 占位七档 labelKey）。 */
const referencedKeys = [
    "prefab.tierDropDown.label",
    "prefab.tierDropDown.placeholder",
    "prefab.tierDropDown.empty",
    "prefab.tierDropDown.levelOff",
    "prefab.tierDropDown.levelMinimal",
    "prefab.tierDropDown.levelLow",
    "prefab.tierDropDown.levelMedium",
    "prefab.tierDropDown.levelHigh",
    "prefab.tierDropDown.levelXhigh",
    "prefab.tierDropDown.levelMax",
];

const requiredProps = ["modelValue"];
const optionalProps = ["options", "labelKey", "placeholderKey", "variant", "dropdownDirection", "disabled"];

const emitNames = ["update:modelValue"];

/** 按点路径从 locale 对象取值；键缺失返回 undefined，由断言兜住。 */
function readLocaleKey(locale: unknown, key: string): unknown {
    return key.split(".").reduce<unknown>(
        (node, part) => (node !== null && typeof node === "object" ? (node as Record<string, unknown>)[part] : undefined),
        locale,
    );
}

describe("TierDropDown 骨架契约（009 prefab）", () => {
    it("props 契约：modelValue 必填，六项可选 props 带默认（占位七档/outline/auto）", async () => {
        const source = await readFile(sourcePath, "utf-8");
        expect(source).toContain("withDefaults(defineProps<");
        for (const prop of requiredProps) {
            expect(source).toContain(`${prop}:`);
            expect(source).not.toContain(`${prop}?:`);
        }
        for (const prop of optionalProps) {
            expect(source).toContain(`${prop}?:`);
        }
    });

    it("emits 契约：仅 v-model 双向 update:modelValue", async () => {
        const source = await readFile(sourcePath, "utf-8");
        expect(source).toContain("defineEmits<");
        for (const emitName of emitNames) {
            expect(source).toContain(`(e: "${emitName}"`);
        }
    });

    it("文案契约：i18n 键统一走 labelKey/placeholderKey 注入，键在 zh-CN 与 en-US 双语齐备且非空", async () => {
        const source = await readFile(sourcePath, "utf-8");
        for (const key of referencedKeys) {
            expect(source).toContain(key);
            expect(readLocaleKey(zhCN, key), `zh-CN 缺键 ${key}`).toBeTruthy();
            expect(readLocaleKey(enUS, key), `en-US 缺键 ${key}`).toBeTruthy();
        }
        // 组件不传成品文案：模板只 t(键)，不出现含中文的选项字面量
        expect(source).toContain("t(opt.labelKey)");
        expect(source).toContain("t(props.placeholderKey)");
    });

    it("骨架纪律：不接 store/thinkingLevelMap（接入方传 options 即替换占位七档）", async () => {
        const source = await readFile(sourcePath, "utf-8");
        expect(source).not.toMatch(/use\w+Store/);
        expect(source).not.toContain("$fetch");
        // thinkingLevelMap 仅允许出现在注释自述里，不允许 import/取值使用
        expect(source).not.toMatch(/import\s+\{?[^;]*thinkingLevelMap/);
        expect(source).not.toMatch(/thinkingLevelMap\s*[.\[]/);
    });
});
