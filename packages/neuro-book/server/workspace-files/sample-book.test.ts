import {readFile, stat} from "node:fs/promises";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";
import {describe, expect, it} from "vitest";
import {
    SAMPLE_BOOK_PROJECT_ROOT,
    validateSampleBookManifest,
} from "nbook/server/workspace-files/sample-book";

/**
 * 示例书资产层（「空态即演示」）的静态守卫。
 *
 * 这些断言只触碰**随应用发布的资产**（`assets/workspace/.nbook/templates/sample-book/**`），
 * 不需要起 Project / 数据库，因此是纯静态门禁：manifest 结构、章节文件是否齐全、
 * 常量与 manifest 是否漂移。链路本身（建项目 → 叠加正文 → 落伏笔 → 扫 AI 味）由
 * 端到端用例 `e2e/05-sample-book.spec.ts` 覆盖。
 */

const SAMPLE_BOOK_ROOT = join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
    "assets",
    "workspace",
    ".nbook",
    "templates",
    "sample-book",
);

async function readShippedManifest(): Promise<ReturnType<typeof validateSampleBookManifest>> {
    const raw = await readFile(join(SAMPLE_BOOK_ROOT, "manifest.json"), "utf-8");
    return validateSampleBookManifest(JSON.parse(raw));
}

describe("示例书资产（空态即演示）", () => {
    it("随应用发布的 manifest 通过校验，且 projectRoot 与导出常量一致", async () => {
        const manifest = await readShippedManifest();
        expect(manifest.projectRoot).toBe(SAMPLE_BOOK_PROJECT_ROOT);
        expect(manifest.promise.name).toBe("p-rusty-gun");
        // 伏笔埋在第 1 章、兑现期限在第 3 章——这是「未兑现伏笔」演示的关键结构。
        expect(manifest.scene.chapterName).toBe("001-volume-001-chapter");
        expect(manifest.promise.deadlineChapterName).toBe("001-volume-003-chapter");
    });

    it("三章正文与卷 index 都在资产层，且都真的存在", async () => {
        const manifest = await readShippedManifest();
        const volume = "001-volume";
        const expected = [
            join(SAMPLE_BOOK_ROOT, "manuscript", volume, "index.md"),
            join(SAMPLE_BOOK_ROOT, "manuscript", volume, "001-chapter", "index.md"),
            join(SAMPLE_BOOK_ROOT, "manuscript", volume, "002-chapter", "index.md"),
            join(SAMPLE_BOOK_ROOT, "manuscript", volume, "003-chapter", "index.md"),
        ];
        for (const file of expected) {
            await expect(stat(file), `示例书资产缺少 ${file}`).resolves.toBeTruthy();
        }
        // 埋设章与期限章被 manifest 引用的名字必须都落在同一卷里。
        for (const chapterName of [manifest.scene.chapterName, manifest.promise.deadlineChapterName]) {
            expect(chapterName.startsWith(`${volume}-`)).toBe(true);
        }
    });

    it("manifest 校验 fail-closed：schema 非法或字段缺失一律抛错", () => {
        expect(() => validateSampleBookManifest(null)).toThrow();
        expect(() => validateSampleBookManifest({schema: "other/v1"})).toThrow();
        expect(() => validateSampleBookManifest({schema: "sample-book/v1"})).toThrow();
        expect(() => validateSampleBookManifest({
            schema: "sample-book/v1",
            projectRoot: "x",
            projectTitle: "t",
            projectSummary: "s",
            manuscriptEntry: "m",
            thread: {name: "a", title: "b", isMainThread: true},
            scene: {name: "s", chapterName: "c", note: "n"},
            promise: {
                name: "p",
                title: "t",
                importance: "extreme",
                summary: "s",
                payoffExpectation: "e",
                deadlineChapterName: "d",
                note: "n",
                tags: [],
            },
        })).toThrow();
    });
});
