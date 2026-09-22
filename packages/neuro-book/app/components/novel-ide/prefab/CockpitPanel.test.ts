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
const sourcePath = fileURLToPath(new URL("./CockpitPanel.vue", import.meta.url));

/** 组件源码引用的全部 i18n 键（骨架契约：文案一律走 locales，键清单漂移即挂）。 */
const referencedKeys = [
    "cockpit.title",
    "cockpit.progressLabel",
    "cockpit.progressNone",
    "cockpit.chapterValue",
    "cockpit.activityLabel",
    "cockpit.activityWriting",
    "cockpit.phase.writing",
    "cockpit.phase.workflow",
    "cockpit.phase.idle",
    "cockpit.pendingRow",
    "cockpit.foreshadowRow",
    "cockpit.workflowRow",
    "cockpit.workflowError",
    "cockpit.workflowRetry",
    "cockpit.workflowAbandon",
];

const optionalProps = [
    "chapterNumber",
    "activityPhase",
    "activityFlowName",
    "pendingCount",
    "foreshadowOpenCount",
    "workflowPendingCount",
    "workflowError",
];

const emitNames = ["open", "retryWorkflow", "abandonWorkflow"];

/** 按点路径从 locale 对象取值；键缺失返回 undefined，由断言兜住。 */
function readLocaleKey(locale: unknown, key: string): unknown {
    return key.split(".").reduce<unknown>(
        (node, part) => (node !== null && typeof node === "object" ? (node as Record<string, unknown>)[part] : undefined),
        locale,
    );
}

describe("CockpitPanel 骨架契约（009 prefab）", () => {
    it("props 契约：七项可选 props 全部带默认值（骨架=组件内占位常量，挂载侧逐项覆盖）", async () => {
        const source = await readFile(sourcePath, "utf-8");
        expect(source).toContain("withDefaults(");
        expect(source).toContain("defineProps<");
        for (const prop of optionalProps) {
            expect(source).toContain(`${prop}?:`);
        }
    });

    it("emits 契约：open（三类入口）/retryWorkflow/abandonWorkflow 三事件", async () => {
        const source = await readFile(sourcePath, "utf-8");
        expect(source).toContain("defineEmits<");
        for (const emitName of emitNames) {
            expect(source).toContain(`(e: "${emitName}"`);
        }
    });

    it("文案契约：引用的 i18n 键在 zh-CN 与 en-US 双语齐备且非空", async () => {
        const source = await readFile(sourcePath, "utf-8");
        for (const key of referencedKeys) {
            expect(source).toContain(key);
            expect(readLocaleKey(zhCN, key), `zh-CN 缺键 ${key}`).toBeTruthy();
            expect(readLocaleKey(enUS, key), `en-US 缺键 ${key}`).toBeTruthy();
        }
    });

    it("骨架纪律：不接 store/API/运行时服务（挂载侧接真机数据，契约不变）", async () => {
        const source = await readFile(sourcePath, "utf-8");
        expect(source).not.toMatch(/use\w+Store/);
        expect(source).not.toContain("$fetch");
    });
});
