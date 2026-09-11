import {execFileSync} from "node:child_process";
import {rm} from "node:fs/promises";
import {afterEach, expect, it} from "vitest";
import {createTestTmpRoot, resolveTmpRoot} from "@notnotype/neuro-book-test-support/tmp";
import {assertContained} from "@notnotype/neuro-book-test-support/paths";
import {git} from "#scripts/ci/agent-governance-contract";

const roots: string[] = [];
afterEach(async () => {
    for (const root of roots.splice(0)) {
        assertContained(resolveTmpRoot(), root, "Git inventory test root");
        await rm(root, {recursive: true, force: true});
    }
});

it("returns the complete Git inventory when audit paths exceed the default process buffer", async () => {
    const root = await createTestTmpRoot("git-inventory", "large repository inventory regression");
    roots.push(root);
    execFileSync("git", ["init", "--quiet"], {cwd: root, windowsHide: true});
    const blob = execFileSync("git", ["hash-object", "-w", "--stdin"], {cwd: root, input: "", encoding: "utf8", windowsHide: true}).trim();
    const paths = Array.from({length: 16000}, (_, index) => `.agents/works/w12345-ingest/tasks/t01-run/evidences/${String(index).padStart(5, "0")}/integration/response.json`);
    execFileSync("git", ["update-index", "--index-info"], {cwd: root, input: paths.map(path => `100644 ${blob}\t${path}\n`).join(""), windowsHide: true});
    const expected = paths.join("\0") + "\0";
    expect(Buffer.byteLength(expected)).toBeGreaterThan(1024 * 1024);
    expect(git(root, ["ls-files", "-z"])).toBe(expected);
});
