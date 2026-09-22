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
const sourcePath = fileURLToPath(new URL("./WorkspaceStage.vue", import.meta.url));

/** 组件源码引用的全部 i18n 键（五个重内容页名 + 返回常态/导航标签/占位正文）。 */
const referencedKeys = [
    "ide.workspaceStage.page.plotOutline",
    "ide.workspaceStage.page.characters",
    "ide.workspaceStage.page.worldbook",
    "ide.workspaceStage.page.worldEngine",
    "ide.workspaceStage.page.settings",
    "ide.workspaceStage.backToNormal",
    "ide.workspaceStage.navLabel",
    "ide.workspaceStage.placeholderBody",
];

const optionalProps = ["page", "error"];

const emitNames = ["close", "navigate"];

/** 按点路径从 locale 对象取值；键缺失返回 undefined，由断言兜住。 */
function readLocaleKey(locale: unknown, key: string): unknown {
    return key.split(".").reduce<unknown>(
        (node, part) => (node !== null && typeof node === "object" ? (node as Record<string, unknown>)[part] : undefined),
        locale,
    );
}

describe("WorkspaceStage 骨架契约（009 prefab）", () => {
    it("props 契约：page/error 可选带默认（默认 plot-outline，错误态仍可返回常态）", async () => {
        const source = await readFile(sourcePath, "utf-8");
        expect(source).toContain("withDefaults(");
        expect(source).toContain("defineProps<");
        for (const prop of optionalProps) {
            expect(source).toContain(`${prop}?:`);
        }
        expect(source).toContain('page: "plot-outline"');
    });

    it("emits 契约：close（逃生口）/navigate（左分区导航）两事件", async () => {
        const source = await readFile(sourcePath, "utf-8");
        expect(source).toContain("defineEmits<");
        for (const emitName of emitNames) {
            expect(source).toContain(`(e: "${emitName}"`);
        }
    });

    it("L-1 反向约束：只登记五个重内容页，页名 i18n 键双语齐备且非空", async () => {
        const source = await readFile(sourcePath, "utf-8");
        // 历史对话/收件箱/待拍板队列走左栏面板，禁入本容器（出现即打回）
        expect(source).not.toMatch(/labelKey:\s*"ide\.workspace(?!Stage)/);
        expect(source).toContain("plot-outline");
        expect(source).toContain("world-engine");
        for (const key of referencedKeys) {
            expect(source).toContain(key);
            expect(readLocaleKey(zhCN, key), `zh-CN 缺键 ${key}`).toBeTruthy();
            expect(readLocaleKey(enUS, key), `en-US 缺键 ${key}`).toBeTruthy();
        }
    });

    it("骨架纪律：不接 store/API/运行时服务（数据为组件内占位常量）", async () => {
        const source = await readFile(sourcePath, "utf-8");
        expect(source).not.toMatch(/use\w+Store/);
        expect(source).not.toContain("$fetch");
    });
});
