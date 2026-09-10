import {execFile} from "node:child_process";
import {readFile, rm, writeFile} from "node:fs/promises";
import {join} from "node:path";
import {fileURLToPath} from "node:url";
import {promisify} from "node:util";
import {afterEach, describe, expect, it} from "vitest";
import {createTestTmpRoot} from "@notnotype/neuro-book-test-support/tmp";
import {parseCliArguments} from "./arguments.ts";

const execute = promisify(execFile);
const cli = fileURLToPath(new URL("cli.ts", import.meta.url));
const tsx = import.meta.resolve("tsx");
const roots: string[] = [];
afterEach(async () => {
    await Promise.all(roots.splice(0).map(path => rm(path, {recursive: true, force: true})));
});

async function run(args: string[], cwd?: string) {
    try {
        const result = await execute(process.execPath, ["--import", tsx, cli, ...args], {cwd, encoding: "utf8", timeout: 20_000, maxBuffer: 4 * 1024 * 1024});
        return {...result, code: 0};
    } catch (error) {
        if (error && typeof error === "object" && "code" in error && "stdout" in error && "stderr" in error && typeof error.code === "number" && typeof error.stdout === "string" && typeof error.stderr === "string") return {code: error.code, stdout: error.stdout, stderr: error.stderr};
        throw error;
    }
}

describe("real CLI process", () => {
    it("runs outside the repository and writes one successful JSON value", async () => {
        const root = await createTestTmpRoot("v7-query-cli", "CLI cwd independence");
        roots.push(root);
        const result = await run(["knowledge", "--holder", "su", "--about", "creator", "--at", "1:66"], root);
        expect(result.code).toBe(0);
        expect(result.stderr).toBe("");
        expect(result.stdout.trim().split("\n")).toHaveLength(1);
        expect(JSON.parse(result.stdout)).toMatchObject({schema: "neurobook.memory.query.v1", ok: true, items: [{record: {data: {mode: "heard"}}}]});
    });

    it("prints help and rejects CLI syntax, unsupported options, invalid enums and unavailable records", async () => {
        const help = await run(["--help"]);
        expect(help.code).toBe(0);
        expect(help.stdout).toContain("V7 read-only memory query");
        expect(help.stderr).toBe("");
        for (const args of [["facts", "--garbage", "yes"], ["get", "su", "--limit", "2"], ["facts", "--limit", "0"], ["knowledge", "--holder", "su", "--mode", "knows"], ["facts", "--limit", "2", "--limit", "3"]]) {
            const result = await run(args);
            expect(result.code).toBe(2);
            expect(result.stdout).toBe("");
            expect(JSON.parse(result.stderr)).toMatchObject({ok: false, error: {code: "INVALID_ARGUMENT"}});
        }
        const missing = await run(["get", "f119", "--at", "1:65"]);
        expect(missing.code).toBe(4);
        expect(missing.stdout).toBe("");
        expect(JSON.parse(missing.stderr)).toMatchObject({ok: false, error: {code: "RECORD_UNAVAILABLE"}});
    });

    it("reads an explicit dataset without changing it and rejects missing, malformed and invalid files", async () => {
        const root = await createTestTmpRoot("v7-query-files", "read-only CLI input cases");
        roots.push(root);
        const path = join(root, "snapshot with spaces.json");
        const original = await readFile(new URL("../t07-v7-schema-gold/dataset-v7.json", import.meta.url), "utf8");
        await writeFile(path, original);
        const success = await run(["info", "--data", path], root);
        expect(success.code).toBe(0);
        expect(await readFile(path, "utf8")).toBe(original);
        for (const contents of ["{bad json", "{}"] ) {
            await writeFile(path, contents);
            const result = await run(["info", "--data", path], root);
            expect(result.code).toBe(3);
            expect(result.stdout).toBe("");
            expect(JSON.parse(result.stderr)).toMatchObject({ok: false, error: {code: "INVALID_DATA"}});
            expect(await readFile(path, "utf8")).toBe(contents);
        }
        const missing = await run(["info", "--data", join(root, "missing.json")]);
        expect(missing.code).toBe(3);
        expect(JSON.parse(missing.stderr)).toMatchObject({error: {code: "DATA_READ_FAILED"}});
    });
});

it("parses serializable requests and rejects missing values and stray positional arguments", () => {
    expect(parseCliArguments(["explain", "f119", "--depth=0", "--at", "1:66"])).toMatchObject({help: false, request: {command: "explain", id: "f119", depth: 0, at: {chapter: 1, paragraph: 66}}});
    for (const args of [["search", "--query"], ["info", "extra"], ["get"], ["facts", "--at", "1:0"], ["search", "--query", ""]]) expect(() => parseCliArguments(args)).toThrow();
});
