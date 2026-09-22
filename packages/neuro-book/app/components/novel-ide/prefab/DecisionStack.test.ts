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
const sourcePath = fileURLToPath(new URL("./DecisionStack.vue", import.meta.url));

/** 组件源码引用的全部 i18n 键（含三条占位演示卡的意图/影响行）。 */
const referencedKeys = [
    "decisionStack.demo.first.intent",
    "decisionStack.demo.first.impact",
    "decisionStack.demo.second.intent",
    "decisionStack.demo.second.impact",
    "decisionStack.demo.third.intent",
    "decisionStack.demo.third.impact",
    "decisionStack.receiptTag",
    "decisionStack.empty",
    "decisionStack.expandRaw",
    "decisionStack.collapseRaw",
    "decisionStack.accept",
    "decisionStack.reject",
    "decisionStack.swipeHint",
    "decisionStack.rejectAsk",
    "decisionStack.retry",
    "decisionStack.rejectOnly",
    "decisionStack.cancel",
];

const optionalProps = ["items", "receipt"];

const emitNames = ["approve", "reject", "exhausted"];

/** 按点路径从 locale 对象取值；键缺失返回 undefined，由断言兜住。 */
function readLocaleKey(locale: unknown, key: string): unknown {
    return key.split(".").reduce<unknown>(
        (node, part) => (node !== null && typeof node === "object" ? (node as Record<string, unknown>)[part] : undefined),
        locale,
    );
}

describe("DecisionStack 骨架契约（009 prefab）", () => {
    it("props 契约：items/receipt 可选带默认（空队列=内置占位演示数据）", async () => {
        const source = await readFile(sourcePath, "utf-8");
        expect(source).toContain("withDefaults(defineProps<");
        for (const prop of optionalProps) {
            expect(source).toContain(`${prop}?:`);
        }
        expect(source).toContain('items: () => []');
        expect(source).toContain("receipt: null");
    });

    it("emits 契约：approve/reject/exhausted 三事件（id 原样回传，清空即报 exhausted）", async () => {
        const source = await readFile(sourcePath, "utf-8");
        expect(source).toContain("defineEmits<");
        for (const emitName of emitNames) {
            expect(source).toContain(`(e: "${emitName}"`);
        }
    });

    it("文案契约：引用的 i18n 键在 zh-CN 与 en-US 双语齐备且非空（本件不落硬编码文案）", async () => {
        const source = await readFile(sourcePath, "utf-8");
        for (const key of referencedKeys) {
            expect(source).toContain(key);
            expect(readLocaleKey(zhCN, key), `zh-CN 缺键 ${key}`).toBeTruthy();
            expect(readLocaleKey(enUS, key), `en-US 缺键 ${key}`).toBeTruthy();
        }
    });

    it("T-6 人话规格：占位卡意图/影响分行走 i18n，raw 仅存原始 JSON 文本", async () => {
        const source = await readFile(sourcePath, "utf-8");
        expect(source).toContain("intent: t(");
        expect(source).toContain("impact: t(");
        expect(source).toContain('raw: "{\\"kind\\"');
    });

    it("骨架纪律：不接 store/API/运行时服务（聚合归挂载侧）", async () => {
        const source = await readFile(sourcePath, "utf-8");
        expect(source).not.toMatch(/use\w+Store/);
        expect(source).not.toContain("$fetch");
    });
});
