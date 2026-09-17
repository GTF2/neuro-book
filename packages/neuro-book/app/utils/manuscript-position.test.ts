import type {WorkspaceFileNode} from "nbook/app/stores/novel-ide";
import {resolveManuscriptPositionSummary} from "nbook/app/utils/manuscript-position";
import {describe, expect, it} from "vitest";

function file(path: string, words: number, overrides: Partial<WorkspaceFileNode> = {}): WorkspaceFileNode {
    return {
        mode: "644",
        entryType: null,
        icon: null,
        status: null,
        words,
        refs: [],
        path,
        absolutePath: `/ws/${path}`,
        isDirectory: false,
        hasIndex: false,
        contentNode: true,
        summary: "",
        title: path.split("/").pop() ?? path,
        frontmatter: {},
        frontmatterError: null,
        state: null,
        size: words * 3,
        mtimeMs: 0,
        editable: true,
        ...overrides,
    };
}

function dir(path: string, title: string, overrides: Partial<WorkspaceFileNode> = {}): WorkspaceFileNode {
    // 真实数据里目录节点的 path 带尾斜杠（store 的 normalizeWorkspaceMovedPath 如此），
    // 这里按真实形态构造，锁住「尾斜杠导致卷名/全书字数查不到」的回归。
    return file(`${path}/`, 0, {isDirectory: true, contentNode: false, title, ...overrides});
}

const TREE: WorkspaceFileNode[] = [
    dir("manuscript", "正文"),
    dir("manuscript/000-opening", "开篇：蓝梓与芥末"),
    file("manuscript/000-opening/index.md", 1200),
    dir("manuscript/001-vol-xiaxianyue", "第一卷 夏弦月"),
    file("manuscript/001-vol-xiaxianyue/index.md", 60),
    dir("manuscript/001-vol-xiaxianyue/001-chapter", "第一章"),
    file("manuscript/001-vol-xiaxianyue/001-chapter/index.md", 900),
    file("manuscript/001-vol-xiaxianyue/001-chapter/notes.md", 40),
    dir("manuscript/001-vol-xiaxianyue/002-chapter", "第二章"),
    file("manuscript/001-vol-xiaxianyue/002-chapter/index.md", 1500),
    dir("manuscript/002-vol-zai-lushang", "第二卷 再路上"),
    dir("manuscript/002-vol-zai-lushang/001-chapter", "第一章"),
    file("manuscript/002-vol-zai-lushang/001-chapter/index.md", 700),
    dir("参考材料", "参考材料"),
    file("参考材料/备忘.md", 500),
];

describe("resolveManuscriptPositionSummary", () => {
    it("有卷的章节：卷名 + 卷内位置 + 本章字数 + 全书字数（正文根下全部文件）", () => {
        const s = resolveManuscriptPositionSummary(TREE, "manuscript/001-vol-xiaxianyue/002-chapter/index.md");

        expect(s).not.toBeNull();
        expect(s?.volumeTitle).toBe("第一卷 夏弦月");
        expect(s?.chapterCurrent).toBe(2);
        expect(s?.chapterTotal).toBe(2);
        expect(s?.chapterWords).toBe(1500);
        expect(s?.scopeTitle).toBe("正文");
        // 正文下全部文件（含卷 index 的 60 与 notes 的 40），不含参考材料
        expect(s?.scopeWords).toBe(1200 + 60 + 900 + 40 + 1500 + 700);
    });

    it("直接挂在根下的章节（无卷形态）：卷名为 null，位置在根分组的章节之间", () => {
        const s = resolveManuscriptPositionSummary(TREE, "manuscript/000-opening/index.md");

        expect(s?.volumeTitle).toBeNull();
        // 根分组的章节目录只有 000-opening 自己（卷 index 不算根分组的章节）
        expect(s?.chapterCurrent).toBe(1);
        expect(s?.chapterTotal).toBe(1);
        expect(s?.chapterWords).toBe(1200);
    });

    it("章节内的非 index 文件：位置跟它的章节目录走，本章字数取章节 index 的", () => {
        const s = resolveManuscriptPositionSummary(TREE, "manuscript/001-vol-xiaxianyue/001-chapter/notes.md");

        expect(s?.volumeTitle).toBe("第一卷 夏弦月");
        expect(s?.chapterCurrent).toBe(1);
        expect(s?.chapterWords).toBe(900);
    });

    it("卷自己的 index：不算章节位置，卷名为 null（它的分组是根）", () => {
        const s = resolveManuscriptPositionSummary(TREE, "manuscript/001-vol-xiaxianyue/index.md");

        expect(s?.volumeTitle).toBeNull();
        expect(s?.chapterCurrent).toBeNull();
        expect(s?.chapterTotal).toBe(1);
    });

    it("选中的是目录或路径不存在：返回 null（状态行隐藏）", () => {
        expect(resolveManuscriptPositionSummary(TREE, "manuscript/001-vol-xiaxianyue")).toBeNull();
        expect(resolveManuscriptPositionSummary(TREE, "manuscript/ghost/index.md")).toBeNull();
        expect(resolveManuscriptPositionSummary(TREE, null)).toBeNull();
    });

    it("全书字数为 0 或树为空时不显示误导性的 0：scopeWords 为 null", () => {
        expect(resolveManuscriptPositionSummary([], "a/index.md")).toBeNull();

        const s = resolveManuscriptPositionSummary([dir("manuscript", "正文"), file("manuscript/index.md", 0)], "manuscript/index.md");
        expect(s?.scopeWords).toBeNull();
    });
});
