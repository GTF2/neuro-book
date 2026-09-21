import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {describe, expect, it} from "vitest";
import {
    joinWorkspaceMarkdownDocument,
    normalizeWorkspaceMarkdownDocument,
    parseWorkspaceFrontmatterText,
    splitWorkspaceMarkdownDocument,
} from "nbook/app/components/novel-ide/workspace/workspace-frontmatter-profile";
import {getWorkspaceTreeTypeLabelKey} from "nbook/app/components/novel-ide/workspace/workspace-entry-meta";
import enUS from "nbook/app/i18n/locales/en-US";
import zhCN from "nbook/app/i18n/locales/zh-CN";

/**
 * 详情面板 dirty 判定的等价模拟：编辑态 renderedContent 与磁盘态 normalize 各过同一管道。
 * 两侧相等即"无变更"，对应面板不显示"未保存"徽章。
 */
function renderedFrom(content: string): string {
    const sections = splitWorkspaceMarkdownDocument(content);
    return joinWorkspaceMarkdownDocument(sections.frontmatterText, sections.body);
}

describe("workspace frontmatter dirty 规范化管道", () => {
    it("CRLF 文档打开即视为无变更（编辑态与磁盘态同管道后相等）", () => {
        const crlfDocument = "---\r\ntitle: 第一章\r\nstatus: draft\r\n---\r\n\r\n正文内容。\r\n";
        expect(renderedFrom(crlfDocument)).toBe(normalizeWorkspaceMarkdownDocument(crlfDocument));
    });

    it("围栏后空行数不同的 LF 文档同样不误报 dirty", () => {
        const noBlankLine = "---\ntitle: 123\n---\n正文";
        const twoBlankLines = "---\ntitle: 123\n---\n\n\n正文";
        expect(renderedFrom(noBlankLine)).toBe(normalizeWorkspaceMarkdownDocument(noBlankLine));
        expect(renderedFrom(twoBlankLines)).toBe(normalizeWorkspaceMarkdownDocument(twoBlankLines));
    });

    it("真实编辑 frontmatter 后 dirty 判定为真", () => {
        const document = "---\ntitle: 旧标题\n---\n\n正文";
        const edited = joinWorkspaceMarkdownDocument("title: 新标题", splitWorkspaceMarkdownDocument(document).body);
        expect(edited).not.toBe(normalizeWorkspaceMarkdownDocument(document));
    });

    it("规范化幂等：保存落盘的内容再比较不再误报 dirty", () => {
        const crlfDocument = "---\r\ntitle: 第一章\r\n---\r\n\r\n正文\r\n";
        const saved = normalizeWorkspaceMarkdownDocument(crlfDocument);
        expect(normalizeWorkspaceMarkdownDocument(saved)).toBe(saved);
        expect(renderedFrom(saved)).toBe(saved);
    });

    it("无围栏文档原样往返", () => {
        const plain = "# 纯正文\n\n没有 frontmatter。";
        expect(normalizeWorkspaceMarkdownDocument(plain)).toBe(plain);
        expect(splitWorkspaceMarkdownDocument(plain).frontmatterText).toBe("");
    });

    it("非对象 frontmatter 时重组只返回正文且带解析错误", () => {
        const sections = splitWorkspaceMarkdownDocument("---\n- a\n- b\n---\n\n正文");
        expect(sections.error).not.toBeNull();
        expect(joinWorkspaceMarkdownDocument(sections.frontmatterText, sections.body)).toBe(sections.body);
    });

    it("parseWorkspaceFrontmatterText 空段视为空对象", () => {
        expect(parseWorkspaceFrontmatterText("")).toEqual({frontmatter: {}, error: null});
        expect(parseWorkspaceFrontmatterText("   \n  ")).toEqual({frontmatter: {}, error: null});
        expect(parseWorkspaceFrontmatterText("title: abc").frontmatter).toEqual({title: "abc"});
    });
});

describe("文件树类型角标 i18n 键映射", () => {
    it("已知类型返回 i18n 键，未知类型回退 null 由调用方显示原值", () => {
        expect(getWorkspaceTreeTypeLabelKey("note")).toBe("ide.workspace.filePanel.lorebookNote");
        expect(getWorkspaceTreeTypeLabelKey("volume")).toBe("ide.workspace.filePanel.treeTypeVolume");
        expect(getWorkspaceTreeTypeLabelKey("chapter")).toBe("ide.workspace.filePanel.treeTypeChapter");
        expect(getWorkspaceTreeTypeLabelKey("lore")).toBe("ide.workspace.filePanel.treeTypeLore");
        expect(getWorkspaceTreeTypeLabelKey("node")).toBe("ide.workspace.filePanel.treeTypeNode");
        expect(getWorkspaceTreeTypeLabelKey("mystery-type")).toBeNull();
    });

    it("映射目标键与详情面板新增键在双语 locale 中齐备", () => {
        const filePanelZh = zhCN.ide.workspace.filePanel;
        const filePanelEn = enUS.ide.workspace.filePanel;
        const fileDetailZh = zhCN.ide.workspace.fileDetail;
        const fileDetailEn = enUS.ide.workspace.fileDetail;
        const treeTypeKeys = [
            "treeTypeVolume",
            "treeTypeChapter",
            "treeTypeLore",
            "treeTypeNode",
        ];
        const fileDetailKeys = [
            "blockFile",
            "blockDirectory",
            "blockManuscript",
            "unitWords",
            "unitKb",
            "unitCount",
            "hintTitle",
            "hintStatus",
            "hintTags",
            "hintSummary",
            "hintUpdateStats",
            "hintEditable",
            "hintReadonly",
        ];

        for (const key of treeTypeKeys) {
            expect(filePanelZh[key as keyof typeof filePanelZh]).toBeTruthy();
            expect(filePanelEn[key as keyof typeof filePanelEn]).toBeTruthy();
        }
        for (const key of fileDetailKeys) {
            expect(fileDetailZh[key as keyof typeof fileDetailZh]).toBeTruthy();
            expect(fileDetailEn[key as keyof typeof fileDetailEn]).toBeTruthy();
        }
        expect(fileDetailZh.unitWords).toContain("{count}");
        expect(fileDetailZh.blockManuscript).toContain("正文");
    });

    it("组件模板引用的新键与 locale 键一一对应，无悬空引用", async () => {
        const fileNodePath = fileURLToPath(new URL("./WorkspaceFileNode.vue", import.meta.url));
        const detailPanelPath = fileURLToPath(new URL("./WorkspaceFileDetailPanel.vue", import.meta.url));
        const fileNodeSource = await readFile(fileNodePath, "utf-8");
        const detailPanelSource = await readFile(detailPanelPath, "utf-8");

        const treeTypeKeys = ["treeTypeVolume", "treeTypeChapter", "treeTypeLore", "treeTypeNode"];
        for (const key of treeTypeKeys) {
            if (key === "treeTypeNode") {
                expect(fileNodeSource).toContain(`ide.workspace.filePanel.${key}"`);
            } else {
                expect(fileNodeSource).not.toContain(key);
            }
        }

        const detailKeys = [
            "blockFile",
            "blockDirectory",
            "blockManuscript",
            "unitWords",
            "unitKb",
            "unitCount",
            "hintTitle",
            "hintStatus",
            "hintTags",
            "hintSummary",
            "hintUpdateStats",
            "hintEditable",
            "hintReadonly",
        ];
        for (const key of detailKeys) {
            expect(detailPanelSource).toContain(`ide.workspace.fileDetail.${key}`);
        }
        expect(fileNodeSource).not.toMatch(/>\s*\{\{\s*node\.entryType\s*\}\}/);
        expect(fileNodeSource).not.toMatch(/>\s*node\s*</);
        expect(detailPanelSource).not.toContain('"Manuscript"');
        expect(detailPanelSource).not.toContain('"Directory" : "File"');
    });
});
