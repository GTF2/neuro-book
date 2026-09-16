import {mkdirSync} from "node:fs";
import {E2E_PROJECT_ROOT, E2E_PROJECT_TITLE, E2E_STATE_ROOT} from "./e2e-env";
import {closeProject, createProject, listProjects, openProject} from "nbook/server/workspace-files/project-session";
import {projectWorkspaceRef} from "nbook/server/workspace-files/project-identity";
import {resolveRuntimeWorkspaceRoot} from "nbook/server/workspace-files/workspace-runtime-root";

/**
 * 在隔离 State Root 里播种一个最小可用项目（默认模板已含 `manuscript/.../001-chapter/index.md`）。
 *
 * 必须在应用启动前调用：项目选择界面依赖 workspace 目录里真实存在的一级项目目录。
 * 本函数不使用 `process.exit`，以便被 `serve-e2e.ts` 在起服务的同一进程内调用。
 */
export async function seedE2eProject(): Promise<void> {
    process.env.NEURO_BOOK_STATE_ROOT = E2E_STATE_ROOT;
    const workspaceRoot = resolveRuntimeWorkspaceRoot();
    // openProject/createProject 都假设 Workspace Root 已存在（真实启动由 boot 流程创建）。
    mkdirSync(workspaceRoot, {recursive: true});

    const ref = projectWorkspaceRef(E2E_PROJECT_ROOT);
    const existing = await listProjects(workspaceRoot);
    const alreadyPresent = existing.projects.some((project) => project.projectRoot === E2E_PROJECT_ROOT);
    if (!alreadyPresent) {
        await createProject({ref, title: E2E_PROJECT_TITLE});
    }
    // 打开一次让 Lifecycle 完成发布与模板物化，随后立即关闭，避免占用状态影响应用启动。
    await openProject(ref, {kind: "job", source: "e2e-seed"}, workspaceRoot);
    await closeProject(ref, "shutdown");

    process.stdout.write(`[e2e] 已播种隔离项目 ${E2E_PROJECT_ROOT} @ ${workspaceRoot}\n`);
}
