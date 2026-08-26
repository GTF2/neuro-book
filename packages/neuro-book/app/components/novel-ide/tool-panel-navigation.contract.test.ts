import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {describe, expect, it} from "vitest";

const toolPanelPath = fileURLToPath(new URL("./NovelIdeToolPanel.vue", import.meta.url));
const indexPagePath = fileURLToPath(new URL("../../pages/index.vue", import.meta.url));

describe("Tool panel navigation contract", () => {
    it("上传项目按钮保持 Dropdown 包裹 Tooltip 包裹按钮，Tooltip 触发器必须是真实 DOM", async () => {
        const toolPanel = await readFile(toolPanelPath, "utf8");

        const dropdownIndex = toolPanel.indexOf('<Dropdown root-class="relative inline-flex items-center"');
        const tooltipIndex = toolPanel.indexOf("<Tooltip :text=\"t('ide.toolPanel.uploadProjectTitle')\"");
        expect(dropdownIndex).toBeGreaterThan(-1);
        expect(tooltipIndex).toBeGreaterThan(dropdownIndex);
    });

    it("用户资产模式保留工作区标题行且不再渲染重复书架入口", async () => {
        const toolPanel = await readFile(toolPanelPath, "utf8");

        expect(toolPanel).toContain('{{ props.workspaceTitle }}</div>');
        expect(toolPanel).not.toContain('v-if="!props.userAssetsMode" class="flex h-9');
        expect(toolPanel).not.toContain("openHome");
    });
    it("离开用户资产回到书架必须经过统一 route worker 与未保存检查", async () => {
        // Windows checkout 是 CRLF：先归一化换行，多行断言才能稳定匹配源码结构。
        const page = (await readFile(indexPagePath, "utf8")).replace(/\r\n/g, "\n");

        expect(page).toContain('const openProjectPicker = async (): Promise<void> => {\n    await router.push("/");\n};');
        expect(page).not.toContain("await releaseProjectSurface();\n    }\n    await router.push(\"/\");");
        expect(page).toContain("return !route.query.project && !currentProjectRoot.value && !isUserAssetsWorkspace.value;");
        expect(page).toContain("const decision = await resolveUnsavedWorkspaceChanges();");
    });
});
