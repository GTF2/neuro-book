import fs from "node:fs/promises";
import path from "node:path";
import {assetResolver} from "nbook/server/assets/asset-resolver";
import {projectWorkspaceRef} from "nbook/server/workspace-files/project-identity";
import {
    activateReadyProjectModule,
    closeProject,
    createProject,
    listProjects,
    openProject,
    runReadyProjectOperation,
} from "nbook/server/workspace-files/project-session";
import {resolveRuntimeWorkspaceRoot} from "nbook/server/workspace-files/workspace-runtime-root";
import {PROJECT_PLOT_WORLD_MODULE_TOKEN, type ProjectPlotWorldHandle} from "nbook/server/plot";
import type {PlotFacade} from "nbook/server/plot/facade/plot.facade";
import type {PlotTreeDto} from "nbook/shared/dto/plot.dto";

/**
 * 「空态即演示」的示例书内置载体。
 *
 * 设计取舍（重要）：
 * - **资产层内置**：示例书的正文与元数据全部随应用发布，放在
 *   `assets/workspace/.nbook/templates/sample-book/`（可审计、可 diff、可版本化，不污染用户数据）。
 * - **走既有投影机制进用户 workspace**：项目目录脚手架本就由
 *   `copyNovelDirectoryTemplate` 把 `templates/project-directory-templates/` 复制进新项目；
 *   示例书作为**覆盖层**（`templates/sample-book/manuscript/**`）在创建后叠加到同一项目根，
 *   仍落在用户自己的 `workspace/<slug>/` 下，是一本**普通项目**——用户可正常编辑、删除。
 * - **伏笔走真实剧情写入口**：`StoryPromise` 不是文件，而是项目 SQLite 的行；这里通过
 *   Plot facade 的公开写路径（`bootstrapCarrierTree` → `createStoryThread` → `createStoryScene`
 *   → `createStoryPromise` → `setPromiseBeat`）写入，不是伪造孤儿数据。
 * - **删除路径**：示例书就是一个普通项目，用户在项目选择界面「删除」即可；再次点击空态入口会重建。
 */

export const SAMPLE_BOOK_TEMPLATE_RELATIVE = path.join("templates", "sample-book");
export const SAMPLE_BOOK_MANIFEST_FILE = "manifest.json";
/** 示例书落地的 Project root（单段目录名，与项目模板/剧情数据共存）。 */
export const SAMPLE_BOOK_PROJECT_ROOT = "sample-book-rust-and-echo";
const SAMPLE_BOOK_OPEN_SOURCE = "sample-book-seed";

export type SampleBookManifest = {
    schema: "sample-book/v1";
    projectRoot: string;
    projectTitle: string;
    projectSummary: string;
    manuscriptEntry: string;
    thread: {name: string; title: string; isMainThread: boolean};
    scene: {name: string; chapterName: string; note: string};
    promise: {
        name: string;
        title: string;
        importance: "low" | "medium" | "high";
        summary: string;
        payoffExpectation: string;
        deadlineChapterName: string;
        note: string;
        tags: string[];
    };
};

/** 面向前端/验证的最小结果：示例书是否可用、伏笔是否落库。 */
export type SampleBookSeedResult = {
    projectRoot: string;
    projectTitle: string;
    created: boolean;
    seeded: boolean;
    promise: {
        name: string;
        title: string;
        summary: string;
        deadlineChapterTitle: string | null;
        plantedSceneTitle: string | null;
    } | null;
};

/**
 * 确保示例书项目存在于用户 workspace（不存在则创建 + 叠加正文 + 落伏笔），返回其 Project root。
 * 幂等：已存在则只补齐缺失的剧情数据，不重复建项目、不重复建同名伏笔。
 */
export async function ensureSampleBookProject(): Promise<SampleBookSeedResult> {
    const manifest = await readSampleBookManifest();
    const workspaceRoot = resolveRuntimeWorkspaceRoot();
    await fs.mkdir(workspaceRoot, {recursive: true});

    const ref = projectWorkspaceRef(manifest.projectRoot);
    const existing = await listProjects(workspaceRoot);
    let created = false;
    if (!existing.projects.some((project) => project.projectRoot === manifest.projectRoot)) {
        await createProject({
            ref,
            title: manifest.projectTitle,
            summary: manifest.projectSummary,
        });
        created = true;
    }

    // 覆盖层：把示例书正文叠加进项目根（force，覆盖默认模板里的空章节占位）。
    await overlaySampleManuscript(path.join(workspaceRoot, manifest.projectRoot));

    const ready = await openProject(ref, {kind: "job", source: SAMPLE_BOOK_OPEN_SOURCE}, workspaceRoot);
    try {
        const promise = await runReadyProjectOperation(ready, async () =>
            seedSamplePlot(ready, manifest),
        );
        return {
            projectRoot: manifest.projectRoot,
            projectTitle: manifest.projectTitle,
            created,
            seeded: promise !== null,
            promise,
        };
    } finally {
        await closeProject(ref, "shutdown");
    }
}

type ReadyRef = Awaited<ReturnType<typeof openProject>>;

/**
 * 在打开的项目上，用公开剧情写入口落地「1 个未兑现伏笔」。
 * 幂等：同名伏笔已存在时复用其描述，不重复写入 Thread/Scene/Promise/Beat。
 */
async function seedSamplePlot(
    ready: ReadyRef,
    manifest: SampleBookManifest,
): Promise<SampleBookSeedResult["promise"]> {
    const handle: ProjectPlotWorldHandle = await activateReadyProjectModule(ready, PROJECT_PLOT_WORLD_MODULE_TOKEN);
    const plot = handle.plot;

    // 1) 承载树：把 manuscript 目录导入 Act/Chapter（幂等）。
    await plot.bootstrapCarrierTree();

    // 2) 已存在同名伏笔则直接复用（重入安全）。
    const existingPromises = await plot.listStoryPromises();
    const existing = existingPromises.find((promise) => promise.name === manifest.promise.name);

    const tree = await plot.getPlotTree();
    const deadlineChapter = findChapter(tree, manifest.promise.deadlineChapterName);

    if (existing) {
        return {
            name: existing.name,
            title: existing.title,
            summary: existing.summary,
            deadlineChapterTitle: deadlineChapter?.title ?? null,
            plantedSceneTitle: null,
        };
    }

    // 3) 主线 Thread（同名复用）。
    const thread = await ensureMainThread(plot, tree, manifest);

    // 4) 埋设场 Scene：挂到第 1 章（createStoryScene 返回扁平 SceneDetailDto + 可选 diagnostics）。
    const plantChapter = findChapter(tree, manifest.scene.chapterName);
    const scene = await plot.createStoryScene({
        threadId: thread.id,
        chapterId: plantChapter?.id ?? null,
        title: manifest.scene.name,
        status: "active",
        summary: manifest.scene.note,
        note: manifest.scene.note,
    });

    // 5) 伏笔：open 态 + 目标第 3 章（未兑现）。
    const promise = await plot.createStoryPromise({
        name: manifest.promise.name,
        title: manifest.promise.title,
        importance: manifest.promise.importance,
        summary: manifest.promise.summary,
        payoffExpectation: manifest.promise.payoffExpectation,
        deadlineChapterId: deadlineChapter?.id ?? null,
        tags: manifest.promise.tags,
    });

    // 6) 埋设节拍：让「未兑现伏笔」在账本里显示为「已埋设 / 未兑现」。
    //    facade 的 setPromiseBeat 入参是数值主键（DTO 里 id 是字符串），此处显式转换。
    await plot.setPromiseBeat(Number(promise.id), {
        sceneId: scene.id,
        kind: "plant",
        note: manifest.promise.note,
    });

    return {
        name: promise.name,
        title: promise.title,
        summary: promise.summary,
        deadlineChapterTitle: deadlineChapter?.title ?? null,
        plantedSceneTitle: scene.title,
    };
}

/** 同名主线 Thread 复用，避免重入时撞唯一约束。 */
async function ensureMainThread(
    plot: PlotFacade,
    tree: PlotTreeDto,
    manifest: SampleBookManifest,
): Promise<{id: string}> {
    const found = [...tree.phases.flatMap((phase) => phase.threads), ...tree.ungroupedThreads]
        .find((candidate) => candidate.name === manifest.thread.name);
    if (found) {
        return {id: found.id};
    }
    const created = await plot.createStoryThread({
        name: manifest.thread.name,
        title: manifest.thread.title,
        isMainThread: manifest.thread.isMainThread,
        status: "active",
    });
    return {id: created.id};
}

/** 在承载树里按 name 找 Chapter（卷内 + 未归卷都找）。 */
function findChapter(tree: PlotTreeDto, name: string): {id: string; title: string} | null {
    const all = [...tree.acts.flatMap((act) => act.chapters), ...tree.ungroupedChapters];
    const chapter = all.find((candidate) => candidate.name === name);
    return chapter ? {id: chapter.id, title: chapter.title} : null;
}

/**
 * 把资产层的示例书正文叠加进项目根（force 覆盖默认模板的空占位）。
 * 只触碰 `manuscript/` 子树，不碰项目 manifest 或用户其它文件。
 */
async function overlaySampleManuscript(projectRoot: string): Promise<void> {
    const sampleRoot = resolveSampleBookRoot();
    const sourceManuscript = path.join(sampleRoot, "manuscript");
    const targetManuscript = path.join(projectRoot, "manuscript");
    const stats = await fs.stat(sourceManuscript).catch(() => null);
    if (!stats?.isDirectory()) {
        throw new Error(`示例书资产缺少 manuscript 目录：${sourceManuscript}`);
    }
    await fs.cp(sourceManuscript, targetManuscript, {
        recursive: true,
        force: true,
        errorOnExist: false,
    });
}

/** 解析资产层 sample-book 目录的绝对路径（用户覆盖优先，其次随应用发布的系统资产）。 */
function resolveSampleBookRoot(): string {
    const manifestFile = assetResolver.resolveFileSync(
        path.join(SAMPLE_BOOK_TEMPLATE_RELATIVE, SAMPLE_BOOK_MANIFEST_FILE),
    );
    if (!manifestFile) {
        throw new Error(`找不到示例书资产：${SAMPLE_BOOK_TEMPLATE_RELATIVE}`);
    }
    return path.dirname(manifestFile.absolutePath);
}

/** 读取并校验示例书 manifest（严格但最小：字段缺失/非法即 fail-closed）。 */
export async function readSampleBookManifest(): Promise<SampleBookManifest> {
    const sampleRoot = resolveSampleBookRoot();
    const manifestPath = path.join(sampleRoot, SAMPLE_BOOK_MANIFEST_FILE);
    const text = await fs.readFile(manifestPath, "utf-8");
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch (error) {
        throw new Error(`示例书 manifest 不是有效 JSON：${manifestPath}`, {cause: error});
    }
    return validateSampleBookManifest(parsed, manifestPath);
}

/** 结构化校验示例书 manifest。 */
export function validateSampleBookManifest(value: unknown, source = SAMPLE_BOOK_MANIFEST_FILE): SampleBookManifest {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new Error(`示例书 manifest 结构无效：${source}`);
    }
    const record = value as Record<string, unknown>;
    const schema = record.schema;
    if (schema !== "sample-book/v1") {
        throw new Error(`示例书 manifest schema 必须是 sample-book/v1：${source}`);
    }
    const str = (key: string): string => {
        const field = record[key];
        if (typeof field !== "string" || field.trim() === "") {
            throw new Error(`示例书 manifest 字段 ${key} 必须是非空字符串：${source}`);
        }
        return field;
    };
    const thread = record.thread;
    const scene = record.scene;
    const promise = record.promise;
    if (!isRecord(thread) || !isRecord(scene) || !isRecord(promise)) {
        throw new Error(`示例书 manifest 缺少 thread/scene/promise：${source}`);
    }
    return {
        schema: "sample-book/v1",
        projectRoot: str("projectRoot"),
        projectTitle: str("projectTitle"),
        projectSummary: str("projectSummary"),
        manuscriptEntry: str("manuscriptEntry"),
        thread: {
            name: readString(thread, "name", source),
            title: readString(thread, "title", source),
            isMainThread: readBoolean(thread, "isMainThread", source),
        },
        scene: {
            name: readString(scene, "name", source),
            chapterName: readString(scene, "chapterName", source),
            note: readString(scene, "note", source),
        },
        promise: {
            name: readString(promise, "name", source),
            title: readString(promise, "title", source),
            importance: readImportance(promise, source),
            summary: readString(promise, "summary", source),
            payoffExpectation: readString(promise, "payoffExpectation", source),
            deadlineChapterName: readString(promise, "deadlineChapterName", source),
            note: readString(promise, "note", source),
            tags: readStringArray(promise, "tags", source),
        },
    };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(record: Record<string, unknown>, key: string, source: string): string {
    const field = record[key];
    if (typeof field !== "string" || field.trim() === "") {
        throw new Error(`示例书 manifest 字段 ${key} 必须是非空字符串：${source}`);
    }
    return field;
}

function readBoolean(record: Record<string, unknown>, key: string, source: string): boolean {
    const field = record[key];
    if (typeof field !== "boolean") {
        throw new Error(`示例书 manifest 字段 ${key} 必须是布尔值：${source}`);
    }
    return field;
}

function readStringArray(record: Record<string, unknown>, key: string, source: string): string[] {
    const field = record[key];
    if (!Array.isArray(field) || field.some((item) => typeof item !== "string")) {
        throw new Error(`示例书 manifest 字段 ${key} 必须是字符串数组：${source}`);
    }
    return field as string[];
}

function readImportance(record: Record<string, unknown>, source: string): "low" | "medium" | "high" {
    const field = record.importance;
    if (field === "low" || field === "medium" || field === "high") {
        return field;
    }
    throw new Error(`示例书 manifest 字段 importance 必须是 low/medium/high：${source}`);
}
