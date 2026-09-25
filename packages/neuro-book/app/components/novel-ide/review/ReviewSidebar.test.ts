import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {describe, expect, it} from "vitest";
import zhCN from "nbook/app/i18n/locales/zh-CN";
import enUS from "nbook/app/i18n/locales/en-US";

const componentPath = fileURLToPath(new URL("./ReviewSidebar.vue", import.meta.url));

describe("ReviewSidebar 契约（任务033 E 段）", () => {
    it("骨架纪律：纯 props/emit，不接 store/API（决议由挂载侧走 review-decision 端点）", async () => {
        const source = await readFile(componentPath, "utf-8");
        expect(source).not.toMatch(/use\w+Store/);
        expect(source).not.toContain("$fetch");
        expect(source).not.toContain("<Teleport");
        for (const event of ["decision", "voidGroup"]) {
            expect(source).toContain(`"${event}"`);
        }
    });

    it("三态呈现：pending 块带通过/拒绝双钮，accepted 块带撤销，整件拒绝仅待审时渲染", async () => {
        const source = await readFile(componentPath, "utf-8");
        expect(source).toContain(`emit('decision', 'accept', block.blockId)`);
        expect(source).toContain(`emit('decision', 'reject', block.blockId)`);
        expect(source).toContain(`emit('decision', 'revoke', block.blockId)`);
        expect(source).toContain(`emit('voidGroup')`);
        expect(source).toContain('v-if="pendingBlocks.length"');
    });

    it("影响行呈现（K4 对称）：impactIds 非空时展示影响计数", async () => {
        const source = await readFile(componentPath, "utf-8");
        expect(source).toContain('v-if="block.impactIds.length"');
        expect(source).toContain("影响 {{ block.impactIds.length }} 项");
    });

    it("i18n 口径：本组件文案为硬编码中文时须为契约允许的骨架内联（键面检查）", async () => {
        const source = await readFile(componentPath, "utf-8");
        // E 段组件中文文案当前内联（prefab 骨架同款先例）；后续真机接线换皮时统一转 i18n——在此锁定不新增英文假中文
        expect(source).not.toMatch(/>\s*[A-Z][a-z]+\s+[a-z]+\s+[a-z]+.*</);
        expect(zhCN.cockpit.title).toBeTruthy();
        expect(enUS.cockpit.title).toBeTruthy();
    });
});
