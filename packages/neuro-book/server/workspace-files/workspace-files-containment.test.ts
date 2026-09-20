import {access, mkdir, mkdtemp, rm, symlink, writeFile} from "node:fs/promises";
import { testHostPath } from "@notnotype/neuro-book-test-support/test-path"
import path from "node:path";
import {afterEach, describe, expect, it} from "vitest";
import {absoluteFsPath} from "nbook/server/runtime/paths/file-path";
import {createRuntimePaths} from "nbook/server/runtime/paths/runtime-paths";
import {resolveNovelWorkspaceTarget} from "nbook/server/workspace-files/novel-workspace";
import {
    createWorkspaceContentState,
    createWorkspaceDirectory,
    createWorkspaceFile,
    deleteWorkspacePath,
    readWorkspaceTextFile,
    renameWorkspacePath,
    scanWorkspaceTree,
    writeWorkspaceTextFile,
} from "nbook/server/workspace-files/workspace-files";

const roots: string[] = [];

afterEach(async () => {
    await Promise.all(roots.splice(0).map((root) => rm(root, {recursive: true, force: true})));
});

describe("Workspace文件操作真实路径范围", () => {
    it("读取、写入和扫描拒绝链接逃逸，但删除可清理链接目录项", async () => {
        const fixture = await fixtureRoot();
        const stateRoot = path.join(fixture, "state");
        const projectRoot = path.join(stateRoot, "workspace", "project-a");
        const outsideRoot = path.join(stateRoot, "workspace", "outside-project");
        const marker = path.join(outsideRoot, "marker.md");
        await Promise.all([mkdir(projectRoot, {recursive: true}), mkdir(outsideRoot, {recursive: true})]);
        await writeFile(marker, "outside", "utf8");
        await symlink(outsideRoot, path.join(projectRoot, "escape"), process.platform === "win32" ? "junction" : "dir");
        const root = absoluteFsPath(projectRoot);

        await expect(readWorkspaceTextFile(root, "escape/marker.md"))
            .rejects.toThrow("真实路径越过文件系统根");
        await expect(writeWorkspaceTextFile(root, "escape/new.md", "bad"))
            .rejects.toThrow("真实路径越过文件系统根");
        await expect(scanWorkspaceTree({root, targets: ["escape"]}))
            .rejects.toThrow("真实路径越过文件系统根");

        await deleteWorkspacePath(root, "escape", true);
        await access(marker);
        await expect(access(path.join(projectRoot, "escape"))).rejects.toMatchObject({code: "ENOENT"});
    });

    it("写入拒绝 .nbook 保留路径段，正常路径不受影响", async () => {
        const fixture = await fixtureRoot();
        const projectRoot = path.join(fixture, "state", "workspace", "project-a");
        await mkdir(projectRoot, {recursive: true});
        const root = absoluteFsPath(projectRoot);

        await expect(writeWorkspaceTextFile(root, ".nbook/agent/workflows/evil/workflow.ts", "malicious"))
            .rejects.toThrow("系统保留目录 .nbook");
        await expect(writeWorkspaceTextFile(root, "manuscript/.NBOOK/config.ts", "malicious"))
            .rejects.toThrow("系统保留目录 .nbook");
        await expect(access(path.join(projectRoot, ".nbook"))).rejects.toMatchObject({code: "ENOENT"});

        await writeWorkspaceTextFile(root, "manuscript/001/chapter.md", "# 正文\n");
        await expect(readWorkspaceTextFile(root, "manuscript/001/chapter.md")).resolves.toBe("# 正文\n");
    });

    it("创建、移动、删除拒绝 .nbook 保留路径段", async () => {
        const fixture = await fixtureRoot();
        const projectRoot = path.join(fixture, "state", "workspace", "project-a");
        await mkdir(path.join(projectRoot, ".nbook"), {recursive: true});
        await writeFile(path.join(projectRoot, ".nbook", "system.md"), "system", "utf8");
        const root = absoluteFsPath(projectRoot);

        await expect(deleteWorkspacePath(root, ".nbook/system.md", false))
            .rejects.toThrow("系统保留目录 .nbook");
        // Bun on Windows 的 access 成功时 resolve null 而非 undefined，裸 await 断言"文件还在"
        await access(path.join(projectRoot, ".nbook", "system.md"));

        await expect(renameWorkspacePath(root, ".nbook/system.md", "stolen.md"))
            .rejects.toThrow("系统保留目录 .nbook");
        await expect(renameWorkspacePath(root, "notes.md", ".nbook/evil.md"))
            .rejects.toThrow("系统保留目录 .nbook");
        await expect(createWorkspaceFile({root, filePath: ".nbook/agent/workflows/evil/workflow.ts", content: "malicious"}))
            .rejects.toThrow("系统保留目录 .nbook");
        await expect(createWorkspaceDirectory({root, dirPath: ".nbook/agent/workflows/evil"}))
            .rejects.toThrow("系统保留目录 .nbook");
        await expect(createWorkspaceContentState({root, dirPath: ".nbook/evil", stateContent: "---\nstatus: draft\n---\n"}))
            .rejects.toThrow("系统保留目录 .nbook");

        await expect(access(path.join(projectRoot, ".nbook", "agent"))).rejects.toMatchObject({code: "ENOENT"});
        await expect(access(path.join(projectRoot, "stolen.md"))).rejects.toMatchObject({code: "ENOENT"});

        await createWorkspaceFile({root, filePath: "notes.md", content: "# ok\n"});
        await renameWorkspacePath(root, "notes.md", "renamed.md");
        await deleteWorkspacePath(root, "renamed.md", false);
        await expect(access(path.join(projectRoot, "renamed.md"))).rejects.toMatchObject({code: "ENOENT"});
    });

    it("保留路径比对剥掉段尾点与空格，挡住 Win32 规约变体", async () => {
        const fixture = await fixtureRoot();
        const projectRoot = path.join(fixture, "state", "workspace", "project-a");
        await mkdir(projectRoot, {recursive: true});
        const root = absoluteFsPath(projectRoot);

        // Win32 打开 ".nbook./x.md" 时实际命中 ".nbook/x.md"，字符串层必须同样规约后再比对。
        await expect(writeWorkspaceTextFile(root, ".nbook./x.md", "malicious"))
            .rejects.toThrow("系统保留目录 .nbook");
        await expect(writeWorkspaceTextFile(root, ".NBOOK./x.md", "malicious"))
            .rejects.toThrow("系统保留目录 .nbook");
        await expect(writeWorkspaceTextFile(root, ".nbook ./x.md", "malicious"))
            .rejects.toThrow("系统保留目录 .nbook");
        await expect(deleteWorkspacePath(root, ".nbook./x.md", false))
            .rejects.toThrow("系统保留目录 .nbook");
        await expect(createWorkspaceDirectory({root, dirPath: ".nbook./agent"}))
            .rejects.toThrow("系统保留目录 .nbook");

        await expect(access(path.join(projectRoot, ".nbook"))).rejects.toMatchObject({code: "ENOENT"});
    });

    it("Project Workspace根链接到State Root外时Target Adapter拒绝授权", async () => {
        const fixture = await fixtureRoot();
        const stateRoot = path.join(fixture, "state");
        const outsideRoot = path.join(fixture, "outside-state");
        await Promise.all([mkdir(path.join(stateRoot, "workspace"), {recursive: true}), mkdir(outsideRoot, {recursive: true})]);
        const projectRoot = path.join(stateRoot, "workspace", "project-a");
        await symlink(outsideRoot, projectRoot, process.platform === "win32" ? "junction" : "dir");
        const runtimePaths = createRuntimePaths({
            applicationRoot: absoluteFsPath(fixture),
            stateRoot: absoluteFsPath(stateRoot),
        });

        await expect(resolveNovelWorkspaceTarget(runtimePaths, "project-a"))
            .rejects.toThrow("不能是symlink或junction");
        await expect(access(path.join(outsideRoot, "new.md"))).rejects.toMatchObject({code: "ENOENT"});
    });

    it("Project Workspace根链接到Workspace Root内部时仍拒绝别名身份", async () => {
        const fixture = await fixtureRoot();
        const stateRoot = path.join(fixture, "state");
        const workspaceRoot = path.join(stateRoot, "workspace");
        const targetRoot = path.join(workspaceRoot, "project-target");
        await mkdir(targetRoot, {recursive: true});
        await symlink(targetRoot, path.join(workspaceRoot, "project-alias"), process.platform === "win32" ? "junction" : "dir");
        const runtimePaths = createRuntimePaths({
            applicationRoot: absoluteFsPath(fixture),
            stateRoot: absoluteFsPath(stateRoot),
        });

        await expect(resolveNovelWorkspaceTarget(runtimePaths, "project-alias"))
            .rejects.toThrow("不能是symlink或junction");
    });
});

/** 创建隔离Application Root。 */
async function fixtureRoot(): Promise<string> {
    const root = await mkdtemp(testHostPath("nbook-workspace-containment-"));
    roots.push(root);
    return root;
}
