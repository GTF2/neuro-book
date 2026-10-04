import {execFileSync} from "node:child_process";
import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {dirname, join} from "node:path";
import {afterEach, describe, expect, it} from "vitest";
import {buildSyncReport, upstreamHotPaths} from "./upstream-sync-report";

const scratchRoots: string[] = [];

afterEach(() => {
    for (const root of scratchRoots.splice(0)) {
        try {
            rmSync(root, {recursive: true, force: true});
        } catch {
            // Windows 上偶尔有句柄未释放；测试根由系统 Temp 兜底回收。
        }
    }
});

function git(repo: string, args: readonly string[]): string {
    return execFileSync("git", [...args], {cwd: repo, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"]}).trimEnd();
}

/**
 * 构造一个「上游 + fork」的最小仓库：upstream 分支与 master 分叉。
 * 返回仓库根；调用方用 commitFile 在两条线上各写文件。
 */
function fixture(): string {
    const root = mkdtempSync(join(tmpdir(), "sync-report-"));
    scratchRoots.push(root);
    git(root, ["init", "-q", "-b", "master"]);
    git(root, ["config", "user.email", "t@example.com"]);
    git(root, ["config", "user.name", "test"]);
    git(root, ["config", "core.autocrlf", "false"]);
    writeFileSync(join(root, "shared.txt"), "base\n");
    writeFileSync(join(root, "leaf.txt"), "base\n");
    git(root, ["add", "."]);
    git(root, ["commit", "-qm", "init"]);
    // upstream 分支从初始提交分叉
    git(root, ["branch", "upstream"]);
    return root;
}

function commitFile(repo: string, path: string, content: string, message: string): void {
    const absolute = join(repo, path);
    mkdirSync(dirname(absolute), {recursive: true});
    writeFileSync(absolute, content);
    git(repo, ["add", path]);
    git(repo, ["commit", "-qm", message]);
}

describe("上游同步试算", () => {
    it("干净分叉：窗口计数正确、试合并无冲突、重叠面按上游是否触及分类", () => {
        const repo = fixture();
        // fork 侧：改 shared.txt（上游稍后也改）、新建 fork-only 文件
        commitFile(repo, "shared.txt", "base\nfork\n", "fork: shared");
        commitFile(repo, ".agents/works/w00001/README.md", "fork only\n", "fork: agents");
        // 上游侧：改 leaf.txt（fork 未动，安全区）与 another.txt（fork 未动）；shared.txt 留空档避免文本冲突
        git(repo, ["checkout", "-q", "upstream"]);
        commitFile(repo, "leaf.txt", "base\nupstream\n", "upstream: leaf");
        commitFile(repo, "another.txt", "upstream only\n", "upstream: another");
        git(repo, ["checkout", "-q", "master"]);

        const report = buildSyncReport(repo, {upstreamRef: "upstream", localRef: "master"});
        expect(report.window.behind).toBe(2);
        expect(report.window.ahead).toBe(2);
        expect(report.merge.clean).toBe(true);
        expect(report.merge.conflictFiles).toEqual([]);

        // fork 与上游各改各的：重叠面为空，fork 改动全在安全区
        expect(report.overlap.map((entry) => entry.path)).toEqual([]);
        expect(report.forkOnly.map((entry) => entry.path)).toContain(".agents/works/w00001/README.md");
        expect(report.forkOnly.find((entry) => entry.path === ".agents/works/w00001/README.md")?.kind).toBe("fork-only");
    });

    it("重叠但不冲突：上游改了 fork 也改过的文件（不同区域）→ 试合并干净但仍进重叠面", () => {
        const repo = fixture();
        // 长文件要在**分叉点之前**建好，否则两侧各自新增会退化成 add/add 冲突。
        const lines = Array.from({length: 30}, (_, index) => `line ${String(index + 1)}`);
        writeFileSync(join(repo, "shared.txt"), `${lines.join("\n")}\n`);
        git(repo, ["add", "shared.txt"]);
        git(repo, ["commit", "-qm", "base: long file"]);
        // 分叉点同步推进：upstream 分支从这版开始
        git(repo, ["branch", "-f", "upstream"]);

        const forkLines = [...lines];
        forkLines[29] = "line 30 fork edit";
        commitFile(repo, "shared.txt", `${forkLines.join("\n")}\n`, "fork: edit tail");

        git(repo, ["checkout", "-q", "upstream"]);
        const upstreamLines = [...lines];
        upstreamLines[0] = "line 1 upstream edit";
        commitFile(repo, "shared.txt", `${upstreamLines.join("\n")}\n`, "upstream: edit head");
        git(repo, ["checkout", "-q", "master"]);

        const report = buildSyncReport(repo, {upstreamRef: "upstream", localRef: "master"});
        // 无文本冲突，但同文件被双方改过 → 必须出现在重叠面（语义冲突候选）
        expect(report.merge.clean).toBe(true);
        expect(report.overlap.map((entry) => entry.path)).toContain("shared.txt");
        expect(report.overlap.find((entry) => entry.path === "shared.txt")?.upstreamTouched).toBe(true);
    });

    it("真实冲突：merge-tree 报出冲突文件且不落盘", () => {
        const repo = fixture();
        commitFile(repo, "shared.txt", "base\nfork-wins\n", "fork: conflicting edit");
        git(repo, ["checkout", "-q", "upstream"]);
        commitFile(repo, "shared.txt", "base\nupstream-wins\n", "upstream: conflicting edit");
        git(repo, ["checkout", "-q", "master"]);

        const headBefore = git(repo, ["rev-parse", "HEAD"]);
        const statusBefore = git(repo, ["status", "--porcelain"]);
        const report = buildSyncReport(repo, {upstreamRef: "upstream", localRef: "master"});

        expect(report.merge.clean).toBe(false);
        expect(report.merge.conflictFiles).toEqual(["shared.txt"]);
        // 只读：HEAD 与工作树均未变化
        expect(git(repo, ["rev-parse", "HEAD"])).toBe(headBefore);
        expect(git(repo, ["status", "--porcelain"])).toBe(statusBefore);
    });

    it("落后为 0 时不提示合并命令", () => {
        const repo = fixture();
        const report = buildSyncReport(repo, {upstreamRef: "upstream", localRef: "master"});
        expect(report.window.behind).toBe(0);
        expect(report.nextSteps.join(" ")).toContain("无需同步");
    });

    it("叶子注册点与热区给出不同建议", () => {
        const repo = fixture();
        commitFile(repo, "packages/nb-ui/src/components/index.ts", "base\nfork line\n", "fork: leaf registration");
        git(repo, ["checkout", "-q", "upstream"]);
        commitFile(repo, "packages/nb-ui/src/components/index.ts", "base\nupstream line\n", "upstream: leaf registration");
        git(repo, ["checkout", "-q", "master"]);

        const report = buildSyncReport(repo, {upstreamRef: "upstream", localRef: "master"});
        const leaf = report.overlap.find((entry) => entry.path === "packages/nb-ui/src/components/index.ts");
        expect(leaf?.kind).toBe("shared-leaf");
        expect(leaf?.advice).toContain("叶子注册点");
    });

    it("热区判定按提交数阈值，不按文件触碰次数", () => {
        const repo = fixture();
        git(repo, ["checkout", "-q", "upstream"]);
        for (let index = 0; index < 9; index += 1) {
            commitFile(repo, "hot.txt", `hot ${String(index)}\n`, `upstream: hot ${String(index)}`);
        }
        commitFile(repo, "cold.txt", "cold\n", "upstream: cold");
        git(repo, ["checkout", "-q", "master"]);

        const hot = upstreamHotPaths(repo, "upstream", 60);
        expect(hot.has("hot.txt")).toBe(true);
        expect(hot.has("cold.txt")).toBe(false);
    });
});
