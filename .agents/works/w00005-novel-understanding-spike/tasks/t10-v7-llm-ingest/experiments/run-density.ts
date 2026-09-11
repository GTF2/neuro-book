import assert from "node:assert/strict";
import {copyFile, mkdir, readFile, readdir, rm, symlink, writeFile} from "node:fs/promises";
import {spawn} from "node:child_process";
import {fileURLToPath} from "node:url";
import {join, resolve} from "node:path";
import {parseArgs} from "node:util";
import {createTestTmpRoot, resolveTmpRoot} from "@notnotype/neuro-book-test-support/tmp";
import {assertContained} from "@notnotype/neuro-book-test-support/paths";
import {hash} from "../compiler.ts";
import {writeJson} from "../storage.ts";

const args = parseArgs({options: {epub: {type: "string"}, "run-dir": {type: "string"}, "env-key": {type: "string"}, through: {type: "string"}, "dry-run": {type: "boolean"}}});
assert(args.values.epub && args.values["run-dir"]);
assert(args.values["dry-run"] || args.values["env-key"]);
const through = Number(args.values.through ?? 6);
assert(Number.isInteger(through) && through >= 1 && through <= 6);
const task = fileURLToPath(new URL("../", import.meta.url));
const repository = resolve(task, "../../../../.."), output = resolve(args.values["run-dir"]);
const original = await readFile(join(task, "prompts.ts"), "utf8");
const oldVersion = 'version: "v7-ingest-2026-09-11-5"';
const newVersion = 'version: "v7-ingest-2026-09-11-6-density"';
const anchor = "优先保留能回答主要人物、目标、持久属性、关键规则、关系变化和重要获知的信息。";
const selection = "按查询价值选择建模。Beat按场景、行动目标或话题的实质转换组织，一段连续对话和同一动作过程通常作为一个Beat，不按每次发言、表情和动作拆分；确保所有段落仍完整覆盖。仅当一段话的内容或来源值得独立检索，或必须作为关键身份、规则、关系、明确获知的依据时，才单独建立Disclosure，其余内容保留在Beat和原文。Fact和Episode优先主要主体、不同物品实例、持久属性/目标/关系、规则、重要事件结果以及明确获知；普通动作、重复转述和修饰不另建节点。不要为同一信息再建立无额外查询价值的泛化发言Fact和内容Fact两套。关键否定、条件、来源归属及会改变答案的实例区别必须保留；不能为了少建模而忽略重要信息。不设固定条数上限。C只按这个选择范围检查实质错误和关键漏项，不要求扩展为细节穷举。";
const counts = {version: original.split(oldVersion).length - 1, selectionAnchor: original.split(anchor).length - 1};
assert.deepEqual(counts, {version: 1, selectionAnchor: 1});
const changed = original.replace(oldVersion, newVersion).replace(anchor, selection);
console.error(JSON.stringify({status: args.values["dry-run"] ? "dry-run" : "prepared", counts, changedFiles: ["prompts.ts"], beforeHash: hash(original), afterHash: hash(changed)}));
if (!args.values["dry-run"]) {
    const temporary = await createTestTmpRoot("v7-density", "t10 isolated density experiment runtime");
    const temporaryTask = join(temporary, "t10-v7-llm-ingest");
    async function run(arguments_: string[]): Promise<void> {
        await new Promise<void>((accept, reject) => {
            const child = spawn(process.execPath, ["--import", "tsx", ...arguments_], {cwd: temporaryTask, stdio: "inherit", windowsHide: true});
            child.once("error", reject);
            child.once("exit", (code, signal) => code === 0 ? accept() : reject(new Error(`Density child exited ${code ?? signal}`)));
        });
    }
    try {
        const copied = [];
        for (const name of ["t10-v7-llm-ingest", "t07-v7-schema-gold"]) {
            const origin = resolve(task, "..", name), target = join(temporary, name);
            await mkdir(target, {recursive: true});
            for (const entry of (await readdir(origin, {withFileTypes: true})).sort((left, right) => left.name.localeCompare(right.name, "en"))) {
                if (!entry.isFile() || !(entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts") && entry.name !== "vitest.config.ts" || entry.name === "package.json" || name === "t07-v7-schema-gold" && entry.name === "sources.json")) continue;
                await copyFile(join(origin, entry.name), join(target, entry.name));
                copied.push({path: name + "/" + entry.name, sha256: hash(await readFile(join(origin, entry.name), "utf8"))});
            }
        }
        await mkdir(join(temporaryTask, "experiments"), {recursive: true});
        await copyFile(join(task, "experiments/verify-published.ts"), join(temporaryTask, "experiments/verify-published.ts"));
        await symlink(join(repository, "node_modules"), join(temporary, "node_modules"), "junction");
        await writeFile(join(temporaryTask, "prompts.ts"), changed, "utf8");
        await writeJson(join(output, "experiment.json"), {schema: "neurobook.memory.density-experiment.v1", generatedFrom: copied, generatorHash: hash(await readFile(fileURLToPath(import.meta.url), "utf8")), changedFiles: [{path: "prompts.ts", sha256: hash(changed)}], selection}, true);
        await run(["cli.ts", "--epub", resolve(args.values.epub), "--run-dir", output, "--through", String(through), "--env-key", args.values["env-key"]!]);
        await run(["experiments/verify-published.ts", "--run-dir", output, "--epub", resolve(args.values.epub), "--head", String(through), "--check-rerun"]);
    } finally {
        assert(temporary !== resolveTmpRoot());
        assertContained(resolveTmpRoot(), temporary, "density temporary runtime");
        await rm(temporary, {recursive: true, force: true});
    }
}
