import {randomUUID} from "node:crypto";
import fs from "node:fs/promises";
import { testHostPath } from "@notnotype/neuro-book-test-support/test-path"
import path from "node:path";
import {createClient} from "@libsql/client";
import {describe, expect, it} from "vitest";
import {
    assertProjectWorkspaceDirectory,
    initProjectDatabaseAtRoot,
    toSqliteFileUrl,
} from "nbook/server/workspace-files/project-workspace";
import {collectReleasedSqliteHandles} from "nbook/server/workspace-files/sqlite-handle-release";
import {absoluteFsPath} from "nbook/server/runtime/paths/file-path";
import {projectWorkspaceRef} from "nbook/server/workspace-files/project-identity";

describe("assertProjectWorkspaceDirectory", () => {
    it("Project root 指向不存在目录时返回稳定 404", async () => {
        const workspaceRoot = await fs.mkdtemp(testHostPath("nbook-project-workspace-root-"));
        const projectRoot = `missing-${randomUUID()}`;
        try {
            await expect(assertProjectWorkspaceDirectory(
                absoluteFsPath(workspaceRoot),
                projectWorkspaceRef(projectRoot),
            )).rejects.toMatchObject({
                statusCode: 404,
                message: "Project Workspace 不存在",
            });
        } finally {
            await fs.rm(workspaceRoot, {recursive: true, force: true});
        }
    });
});

describe("initProjectDatabaseAtRoot", () => {
    it("会把旧 StoryPlot 备份并合并到 Scene，同时清理 plot ref", async () => {
        const projectRoot = await fs.mkdtemp(testHostPath("nbook-project-migration-"));
        try {
            const databasePath = path.join(projectRoot, ".nbook", "project.sqlite");
            await fs.mkdir(path.dirname(databasePath), {recursive: true});
            const client = createClient({url: toSqliteFileUrl(databasePath)});
            try {
                await createLegacyPlotSchema(client);
            } finally {
                client.close();
            }

            await initProjectDatabaseAtRoot(projectRoot);

            const migratedClient = createClient({url: toSqliteFileUrl(databasePath)});
            try {
                const sceneColumns = await migratedClient.execute(`PRAGMA table_info("StoryScene")`);
                expect(sceneColumns.rows.map((row) => String(row.name))).toEqual(expect.arrayContaining([
                    "startInstant",
                    "endInstant",
                    "subjectIdsJson",
                    "locationSubjectId",
                ]));

                const plotTable = await migratedClient.execute(`SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = 'StoryPlot'`);
                expect(plotTable.rows).toHaveLength(0);

                const scene = (await migratedClient.execute(`SELECT "summary", "purpose", "writingTip" FROM "StoryScene" WHERE "id" = 1`)).rows[0];
                expect(String(scene.summary)).toContain("## 原 Plot 摘要");
                expect(String(scene.summary)).toContain("- #0 conflict：旧 Plot 摘要");
                expect(String(scene.purpose)).toContain("## 原 Plot 效果");
                expect(String(scene.purpose)).toContain("- #0：旧 Plot 效果");
                expect(String(scene.writingTip)).toContain("## 原 Plot 写作提示");
                expect(String(scene.writingTip)).toContain("- #0：旧 Plot 提示");

                const refs = await migratedClient.execute(`SELECT "rawTarget", "targetKind" FROM "StorySceneRef" ORDER BY "id"`);
                expect(refs.rows).toEqual([
                    expect.objectContaining({rawTarget: "scene://2", targetKind: "scene"}),
                ]);
            } finally {
                migratedClient.close();
            }

            const backupText = await fs.readFile(path.join(projectRoot, ".nbook", "story-plot-backup.json"), "utf-8");
            expect(backupText).toContain("\"sourceTable\": \"StoryPlot\"");
            expect(backupText).toContain("旧 Plot 摘要");
        } finally {
            await removeTempProject(projectRoot);
        }
    });

    it("创作层三列：新库建表即带列，且连续两次初始化不报错（幂等）", async () => {
        const projectRoot = await fs.mkdtemp(testHostPath("nbook-project-constraint-columns-"));
        try {
            await initProjectDatabaseAtRoot(projectRoot);
            // 连续启动两次：补列逻辑不得重复报错。
            await initProjectDatabaseAtRoot(projectRoot);

            const client = createClient({url: toSqliteFileUrl(path.join(projectRoot, ".nbook", "project.sqlite"))});
            try {
                const columns = await client.execute(`PRAGMA table_info("StoryChapter")`);
                expect(columns.rows.map((row) => String(row.name))).toEqual(expect.arrayContaining([
                    "briefConstraintNegative",
                    "briefStateShift",
                    "authorOnly",
                ]));
            } finally {
                client.close();
            }
        } finally {
            await removeTempProject(projectRoot);
        }
    });

    it("创作层三列：老库(缺列)打开后被幂等补齐，已有章节数据不丢", async () => {
        const projectRoot = await fs.mkdtemp(testHostPath("nbook-project-constraint-legacy-"));
        try {
            const databasePath = path.join(projectRoot, ".nbook", "project.sqlite");
            await fs.mkdir(path.dirname(databasePath), {recursive: true});
            const client = createClient({url: toSqliteFileUrl(databasePath)});
            try {
                await createLegacyChapterSchema(client);
            } finally {
                client.close();
                collectReleasedSqliteHandles({force: true});
            }

            await initProjectDatabaseAtRoot(projectRoot);

            const migratedClient = createClient({url: toSqliteFileUrl(databasePath)});
            try {
                const columns = await migratedClient.execute(`PRAGMA table_info("StoryChapter")`);
                expect(columns.rows.map((row) => String(row.name))).toEqual(expect.arrayContaining([
                    "briefConstraintNegative",
                    "briefStateShift",
                    "authorOnly",
                ]));

                const chapter = (await migratedClient.execute(`SELECT "title", "briefMustHide", "briefConstraintNegative" FROM "StoryChapter" WHERE "id" = 1`)).rows[0];
                expect(String(chapter.title)).toBe("老章节");
                expect(String(chapter.briefMustHide)).toBe("不能提前说");
                expect(chapter.briefConstraintNegative).toBeNull();
            } finally {
                migratedClient.close();
            }
        } finally {
            await removeTempProject(projectRoot);
        }
    });
});

/**
 * Windows 上 libsql native handle 可能延迟释放，测试清理需要短重试。
 */
async function removeTempProject(projectRoot: string): Promise<void> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
        try {
            collectReleasedSqliteHandles({force: true});
            await fs.rm(projectRoot, {recursive: true, force: true});
            return;
        } catch (error) {
            if (attempt === 4) {
                throw error;
            }
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
    }
}

/**
 * 构造 Task 78 前的最小旧 Plot schema。
 */
async function createLegacyPlotSchema(client: ReturnType<typeof createClient>): Promise<void> {
    await client.execute(`CREATE TABLE "Story" ("id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, "title" TEXT NOT NULL, "summary" TEXT NOT NULL DEFAULT '', "note" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
    await client.execute(`CREATE TABLE "StoryThread" ("id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, "storyId" INTEGER NOT NULL, "storyPhaseId" INTEGER, "sortOrder" INTEGER NOT NULL, "name" TEXT NOT NULL, "title" TEXT NOT NULL, "isMainThread" BOOLEAN NOT NULL DEFAULT false, "status" TEXT NOT NULL DEFAULT 'draft', "summary" TEXT NOT NULL DEFAULT '', "tags" TEXT NOT NULL DEFAULT '[]', "writingTip" TEXT, "note" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
    await client.execute(`CREATE TABLE "StoryScene" ("id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, "storyId" INTEGER NOT NULL, "threadId" INTEGER NOT NULL, "chapterPath" TEXT, "threadSortOrder" INTEGER NOT NULL, "chapterSortOrder" INTEGER, "title" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'draft', "summary" TEXT NOT NULL DEFAULT '', "purpose" TEXT, "writingTip" TEXT, "note" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
    await client.execute(`CREATE TABLE "StoryPlot" ("id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, "sceneId" INTEGER NOT NULL, "sortOrder" INTEGER NOT NULL, "kind" TEXT NOT NULL, "summary" TEXT NOT NULL DEFAULT '', "effect" TEXT, "writingTip" TEXT, "note" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
    await client.execute(`CREATE TABLE "StorySceneRef" ("id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, "sceneId" INTEGER NOT NULL, "sortOrder" INTEGER NOT NULL, "relation" TEXT NOT NULL, "rawTarget" TEXT NOT NULL, "targetKind" TEXT NOT NULL, "targetThreadId" INTEGER, "targetSceneId" INTEGER, "targetPlotId" INTEGER, "visibility" TEXT NOT NULL DEFAULT 'author', "note" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
    await client.execute(`INSERT INTO "Story" ("id", "title", "summary") VALUES (1, '故事', '')`);
    await client.execute(`INSERT INTO "StoryThread" ("id", "storyId", "sortOrder", "name", "title") VALUES (1, 1, 0, 'main', '主线')`);
    await client.execute(`INSERT INTO "StoryScene" ("id", "storyId", "threadId", "threadSortOrder", "title", "summary", "purpose", "writingTip") VALUES (1, 1, 1, 0, '场景一', '原 Scene 摘要', '原 Scene 目的', '原 Scene 提示')`);
    await client.execute(`INSERT INTO "StoryScene" ("id", "storyId", "threadId", "threadSortOrder", "title", "summary") VALUES (2, 1, 1, 1, '场景二', '')`);
    await client.execute(`INSERT INTO "StoryPlot" ("id", "sceneId", "sortOrder", "kind", "summary", "effect", "writingTip") VALUES (1, 1, 0, 'conflict', '旧 Plot 摘要', '旧 Plot 效果', '旧 Plot 提示')`);
    await client.execute(`INSERT INTO "StorySceneRef" ("id", "sceneId", "sortOrder", "relation", "rawTarget", "targetKind", "targetPlotId") VALUES (1, 1, 0, 'foreshadows', 'plot://1', 'plot', 1)`);
    await client.execute(`INSERT INTO "StorySceneRef" ("id", "sceneId", "sortOrder", "relation", "rawTarget", "targetKind", "targetSceneId") VALUES (2, 1, 1, 'pays_off', 'scene://2', 'scene', 2)`);
}

/**
 * 构造创作层三列落地前的老 StoryChapter 表:
 * 缺 briefConstraintNegative / briefStateShift / authorOnly,且已有一行章节数据。
 */
async function createLegacyChapterSchema(client: ReturnType<typeof createClient>): Promise<void> {
    await client.execute(`CREATE TABLE "Story" ("id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, "title" TEXT NOT NULL, "summary" TEXT NOT NULL DEFAULT '', "note" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
    await client.execute(`CREATE TABLE "StoryChapter" ("id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, "storyId" INTEGER NOT NULL, "actId" INTEGER, "sortOrder" INTEGER NOT NULL, "name" TEXT NOT NULL, "title" TEXT NOT NULL, "note" TEXT, "briefGoal" TEXT, "briefPov" TEXT, "briefTone" TEXT, "briefPacing" TEXT, "briefReaderKnows" TEXT, "briefProtagonistKnows" TEXT, "briefMustHide" TEXT, "briefHintOnly" TEXT, "briefOpening" TEXT, "briefEnding" TEXT, "briefDoNotWrite" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
    await client.execute(`INSERT INTO "Story" ("id", "title", "summary") VALUES (1, '故事', '')`);
    await client.execute(`INSERT INTO "StoryChapter" ("id", "storyId", "sortOrder", "name", "title", "briefMustHide") VALUES (1, 1, 0, '001-old', '老章节', '不能提前说')`);
}
