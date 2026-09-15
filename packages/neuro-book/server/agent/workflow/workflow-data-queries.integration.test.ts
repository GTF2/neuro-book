import fs from "node:fs/promises";
import path from "node:path";
import {afterAll, afterEach, beforeAll, describe, expect, test} from "vitest";
import {PROJECT_PLOT_WORLD_MODULE_TOKEN} from "nbook/server/plot";
import {resolveRuntimeWorkspaceRoot} from "nbook/server/workspace-files/workspace-runtime-root";
import {activateReadyProjectModule, requireActiveReadyProject} from "nbook/server/workspace-files/project-session";
import {
    openProjectForTest,
    removeProjectWorkspaceForTest,
} from "nbook/server/workspace-files/project-session-test-utils";
import {projectWorkspaceRef} from "nbook/server/workspace-files/project-identity";
import {
    createIsolatedWorkspaceAssets,
    type IsolatedWorkspaceAssets,
} from "nbook/server/workspace-files/test-workspace-fixture";
import {readChapterInfoControlFromPlot} from "nbook/server/agent/workflow/workflow-data-queries";

/**
 * 宿主只读查询 `plot.chapter-info-control@1` 的**真实读取集成测试**：
 * 打开真实 Project Workspace + 真实 SQLite，经真实 Plot 模块读 `StoryChapter.brief`。
 *
 * 本文件刻意不 mock `nbook/server/workspace-files/project-session` 与 `nbook/server/plot`，
 * 与同目录的合同测试 `workflow-data-queries.test.ts`（注入 reader / mock facade 边界）互补，
 * 覆盖 Spec「查询触及真实 Project 数据库的端到端路径尚无独立集成测试」这一缺口。
 */

const createdProjects: string[] = [];

describe("workflow 只读查询 plot.chapter-info-control@1（真实 Project 集成）", {timeout: 30_000}, () => {
    let assets: IsolatedWorkspaceAssets;

    beforeAll(async () => {
        assets = await createIsolatedWorkspaceAssets({purpose: "workflow-data-queries-integration"});
    });

    afterEach(async () => {
        for (const projectRootName of createdProjects.splice(0)) {
            await removeProjectWorkspaceForTest(projectRootName);
        }
    });

    afterAll(async () => {
        await assets.dispose();
    });

    test("成功路径：只填部分字段的章节按原值返回，未填字段归一化为 null", async () => {
        const projectRootName = await createProject();
        const ready = requireActiveReadyProject(projectWorkspaceRef(projectRootName));
        const {plot} = await activateReadyProjectModule(ready, PROJECT_PLOT_WORLD_MODULE_TOKEN);

        const chapter = await plot.createStoryChapter({
            name: "001-opening",
            title: "开篇",
            // 只填两项：readerKnows / hintOnly；protagonistKnows / mustHide 留空。
            brief: {readerKnows: "读者已知项链存在", hintOnly: "遗物来历只可暗示不可明说"},
        });
        const chapterId = Number(chapter.id);

        await expect(readChapterInfoControlFromPlot(ready, chapterId)).resolves.toEqual({
            chapterId,
            readerKnows: "读者已知项链存在",
            protagonistKnows: null,
            mustHide: null,
            hintOnly: "遗物来历只可暗示不可明说",
        });
    });

    test("fail-closed：章节不存在时抛错，绝不降级为空清单", async () => {
        const projectRootName = await createProject();
        const ready = requireActiveReadyProject(projectWorkspaceRef(projectRootName));
        const {plot} = await activateReadyProjectModule(ready, PROJECT_PLOT_WORLD_MODULE_TOKEN);
        await plot.createStoryChapter({name: "001-opening", title: "开篇"});

        await expect(readChapterInfoControlFromPlot(ready, 999_999)).rejects.toThrow();
    });
});

/** 在隔离 Workspace Root 下手写一个最小可用 Project 目录并打开会话。 */
async function createProject(): Promise<string> {
    const projectRootName = `workflow-data-queries-test-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const root = projectDirectory(projectRootName);
    await fs.mkdir(path.join(root, "world-engine", "schema"), {recursive: true});
    await fs.mkdir(path.join(root, "manuscript", "001", "001-opening"), {recursive: true});
    await fs.writeFile(path.join(root, "project.yaml"), "kind: novel\ntitle: Workflow Data Queries Test\nsummary: ''\n", "utf-8");
    await fs.writeFile(path.join(root, "manuscript", "001", "001-opening", "index.md"), "---\ntitle: 开篇\n---\n", "utf-8");
    await fs.writeFile(path.join(root, "world-engine", "schema", "index.ts"), schemaSource(), "utf-8");
    await fs.writeFile(path.join(root, "world-engine", "calendar.ts"), calendarSource(), "utf-8");
    createdProjects.push(projectRootName);
    await openProjectForTest(projectRootName);
    return projectRootName;
}

function projectDirectory(projectRootName: string): string {
    return path.join(resolveRuntimeWorkspaceRoot(), projectRootName);
}

function schemaSource(): string {
    return [
        'import {z} from "zod";',
        "",
        'declare module "zod" {',
        '    interface ZodArray<T extends z.ZodTypeAny, Cardinality extends z.ArrayCardinality = "many"> {',
        "        unique(): this;",
        "    }",
        "}",
        "z.ZodArray.prototype.unique = function() {",
        "    (this as any)._def.unique = true;",
        "    return this;",
        "};",
        "export const WorldSchema = {",
        "    character: z.object({",
        "        hp: z.number().int().default(10).describe('生命值'),",
        "    }),",
        "    location: z.object({",
        "        light: z.string().default('normal').describe('光线'),",
        "    }),",
        "} as const;",
        "",
    ].join("\n");
}

function calendarSource(): string {
    return [
        "export default {",
        "  type: 'simple',",
        "  eraBefore: '复兴纪元',",
        "  eraAfter: '复兴纪元',",
        "  baseUnit: 'second',",
        "  units: [",
        "    {name: 'minute', parent: 'second', ratio: 60},",
        "    {name: 'hour', parent: 'minute', ratio: 60},",
        "    {name: 'day', parent: 'hour', ratio: 24},",
        "  ],",
        "  format: '{eraName}{day}日 {hour:02}:{minute:02}:{second:02}',",
        "};",
        "",
    ].join("\n");
}
