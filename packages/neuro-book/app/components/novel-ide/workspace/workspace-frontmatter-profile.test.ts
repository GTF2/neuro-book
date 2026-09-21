import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {describe, expect, it} from "vitest";
import {
    parseMarkdownDocument,
    renderMarkdownDocument,
} from "nbook/app/components/novel-ide/workspace/workspace-frontmatter-profile";
import {getWorkspaceTreeTypeLabelKey} from "nbook/app/components/novel-ide/workspace/workspace-entry-meta";
import enUS from "nbook/app/i18n/locales/en-US";
import zhCN from "nbook/app/i18n/locales/zh-CN";

const workspaceDir = "nbook/app/components/novel-ide/workspace";
const panelPaths = {
    fileDetail: fileURLToPath(new URL("./WorkspaceFileDetailPanel.vue", import.meta.url)),
    lorebook: fileURLToPath(new URL("./WorkspaceLorebookDetailPanel.vue", import.meta.url)),
    character: fileURLToPath(new URL("./WorkspaceCharacterDetailPanel.vue", import.meta.url)),
};

/** FileDetail 面板的对称管道等价模拟：rest 保留 + 表单字段覆盖。 */
function simulateFileDetailRoundTrip(content: string, title: string): string {
    const parsed = parseMarkdownDocument(content);
    const rest = {...parsed.frontmatter};
    delete rest.title;
    delete rest.status;
    delete rest.aliases;
    delete rest.tags;
    delete rest.summary;
    delete rest.icon;
    return renderMarkdownDocument({
        ...rest,
        title,
        status: null,
        aliases: [],
        tags: [],
        summary: "",
        icon: null,
    }, parsed.body);
}

describe("workspace frontmatter 对象版管道（028 幂等化）", () => {
    it("round-trip 幂等：render∘parse 的输出再 parse 再 render 不再变化", () => {
        const document = "---\ntitle: 第一章\nstatus: draft\n---\n\n正文内容。";
        const once = renderMarkdownDocument(parseMarkdownDocument(document).frontmatter, parseMarkdownDocument(document).body);
        const twice = renderMarkdownDocument(parseMarkdownDocument(once).frontmatter, parseMarkdownDocument(once).body);
        expect(twice).toBe(once);
    });

    it("CRLF 文档 round-trip 稳定；围栏后空行差异被吸收", () => {
        const crlf = "---\r\ntitle: 第一章\r\nstatus: draft\r\n---\r\n\r\n正文内容。\r\n";
        const noBlank = "---\ntitle: 第一章\nstatus: draft\n---\n正文内容。";
        const twoBlanks = "---\ntitle: 第一章\nstatus: draft\n---\n\n\n正文内容。";
        const rendered = (content: string): string => {
            const parsed = parseMarkdownDocument(content);
            return renderMarkdownDocument(parsed.frontmatter, parsed.body);
        };
        // CRLF 的正文尾部换行随正文保留（面板不动正文），但 frontmatter 侧规范化后自身 round-trip 稳定
        expect(rendered(rendered(crlf))).toBe(rendered(crlf));
        // 围栏后空行数属于格式差异，被剥/补平衡吸收
        expect(rendered(twoBlanks)).toBe(rendered(noBlank));
    });

    it("正文前导空行不再轮进：parse 剥掉、render 补回恰好一个", () => {
        const document = "---\ntitle: a\n---\n\n\n\n正文";
        const parsed = parseMarkdownDocument(document);
        expect(parsed.body).toBe("正文");
        expect(renderMarkdownDocument(parsed.frontmatter, parsed.body)).toBe("---\ntitle: a\n---\n\n正文");
    });

    it("真实编辑 frontmatter 后对称管道判定为 dirty", () => {
        const document = "---\ntitle: 旧标题\nstatus: draft\n---\n\n正文";
        expect(simulateFileDetailRoundTrip(document, "新标题")).not.toBe(simulateFileDetailRoundTrip(document, "旧标题"));
        // 无改动（仅标题来源回落重排）时不误报
        expect(simulateFileDetailRoundTrip(document, "旧标题")).toBe(simulateFileDetailRoundTrip(document, "旧标题"));
    });

    it("表单未覆盖字段（rest）round-trip 原样保留", () => {
        const document = "---\ntitle: a\ncustomField: keep-me\nnumeric: 3\n---\n\n正文";
        const rendered = simulateFileDetailRoundTrip(document, "a");
        expect(rendered).toContain("customField: keep-me");
        expect(rendered).toContain("numeric: 3");
    });

    it("无围栏文档原样解析、非对象 frontmatter 带错误", () => {
        const plain = "# 纯正文\n\n没有 frontmatter。";
        expect(parseMarkdownDocument(plain)).toEqual({frontmatter: {}, body: plain, error: null});
        const arrayFm = parseMarkdownDocument("---\n- a\n- b\n---\n\n正文");
        expect(arrayFm.error).not.toBeNull();
        expect(arrayFm.body).toBe("正文");
    });
});

describe("文件树类型角标 i18n 键映射（026 沿用）", () => {
    it("已知类型返回 i18n 键，未知类型回退 null 由调用方显示原值", () => {
        expect(getWorkspaceTreeTypeLabelKey("note")).toBe("ide.workspace.filePanel.lorebookNote");
        expect(getWorkspaceTreeTypeLabelKey("volume")).toBe("ide.workspace.filePanel.treeTypeVolume");
        expect(getWorkspaceTreeTypeLabelKey("chapter")).toBe("ide.workspace.filePanel.treeTypeChapter");
        expect(getWorkspaceTreeTypeLabelKey("mystery-type")).toBeNull();
    });
});

describe("属性面板统一契约（028）", () => {
    it("三个表单面板全部走模块对称管道，不再有私有 parse/render 副本", async () => {
        for (const panelPath of Object.values(panelPaths)) {
            const source = await readFile(panelPath, "utf-8");
            expect(source).toContain("workspace-frontmatter-profile");
            expect(source).not.toMatch(/FRONTMATTER_PATTERN\s*=/);
            expect(source).not.toContain("YAML.parse");
            expect(source).not.toContain("YAML.stringify");
        }
        const lorebook = await readFile(panelPaths.lorebook, "utf-8");
        const character = await readFile(panelPaths.character, "utf-8");
        const fileDetail = await readFile(panelPaths.fileDetail, "utf-8");
        expect(lorebook).toContain("renderDraft(editForm.value) !== renderDraft(storedDraft)");
        expect(character).toContain("renderDraft(editForm.value) !== renderDraft(storedDraft)");
        expect(fileDetail).toContain("const storedDraft = createDraft(props.node, stored.frontmatter, stored.body)");
        expect(fileDetail).toContain("renderDraft(draft.value) !== renderDraft(storedDraft)");
    });

    it("世界书与角色面板的常亮红点已删除（归 009 判返单⑪）", async () => {
        const lorebook = await readFile(panelPaths.lorebook, "utf-8");
        const character = await readFile(panelPaths.character, "utf-8");
        expect(lorebook).not.toContain('class="h-2 w-2 shrink-0 rounded-full bg-[var(--status-warning)]"');
        expect(character).not.toContain('class="h-2 w-2 shrink-0 rounded-full bg-[var(--status-warning)]"');
    });

    it("FileDetail 面板为世界书表单化形态：八字段布局+旧功能迁入", async () => {
        const source = await readFile(panelPaths.fileDetail, "utf-8");
        // 表单字段（复用 lorebookDetail/common 既有键）
        expect(source).toContain('t("ide.workspace.lorebookDetail.displayTitle")');
        expect(source).toContain('t("ide.workspace.lorebookDetail.slugName")');
        expect(source).toContain('t("ide.workspace.lorebookDetail.path")');
        expect(source).toContain('t("ide.workspace.fileDetail.typeLabel")');
        expect(source).toContain('t("ide.workspace.common.status")');
        expect(source).toContain('t("ide.workspace.common.aliases")');
        expect(source).toContain('t("ide.workspace.common.tags")');
        expect(source).toContain('t("ide.workspace.common.summary")');
        // 旧面板独有功能迁入
        expect(source).toContain("LucideIconPickerDialog");
        expect(source).toContain("refreshManuscriptStats");
        expect(source).toContain("emit('create-index')");
        expect(source).toContain("emit('convert-file-to-directory')");
        // 废弃项：FILE/FRONTMATTER 式面板不复活
        expect(source).not.toContain('"Directory" : "File"');
        expect(source).not.toContain("frontmatterText");
        expect(source).not.toContain("readonlyFrontmatterText");
    });

    it("i18n 新键 typeLabel 双语齐备，026 键在新面板中无悬空", () => {
        expect(zhCN.ide.workspace.fileDetail.typeLabel).toBe("类型");
        expect(enUS.ide.workspace.fileDetail.typeLabel).toBe("Type");
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
            "typeLabel",
        ];
        for (const key of fileDetailKeys) {
            expect(zhCN.ide.workspace.fileDetail[key as keyof typeof zhCN.ide.workspace.fileDetail]).toBeTruthy();
            expect(enUS.ide.workspace.fileDetail[key as keyof typeof enUS.ide.workspace.fileDetail]).toBeTruthy();
        }
    });
});
