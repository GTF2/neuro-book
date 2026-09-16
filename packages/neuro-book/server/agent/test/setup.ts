import {mkdtempSync} from "node:fs";
import {rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {afterAll} from "vitest";

/** Agent测试进程的日志必须隔离，不能通过默认cwd写入仓库Workspace Root。 */
const testLogRoot = mkdtempSync(join(tmpdir(), "neuro-book-vitest-logs-"));
const previousLogRoot = process.env.NEURO_BOOK_LOG_DIR;
process.env.NEURO_BOOK_LOG_DIR = testLogRoot;
// Profile DSL 的 Product Runtime 语义要求显式 repository root（不允许从 checkout 或
// import.meta.dirname 推断）。测试进程显式注入，否则 portable 逻辑根映射类用例会抛错。
const previousRepositoryRoot = process.env.NEURO_BOOK_REPOSITORY_ROOT;
// 该解析只服务 node 环境的 portable / root-mapping 用例。jsdom 环境下全局 URL 由 jsdom 提供,
// 对 file: base 的相对解析会落到 document base(实测得到 http://localhost:3000/...),fileURLToPath
// 随即抛 "The URL must be of scheme file" —— 整个 setup 崩溃会连带所有 jsdom 套件跑不到用例。
// 故用「是否存在 window」判定非 node 环境并跳过;真正的解析再用 try/catch 兜底。
if (typeof window === "undefined") {
    try {
        process.env.NEURO_BOOK_REPOSITORY_ROOT = resolve(fileURLToPath(new URL("../../../../", import.meta.url)));
    } catch {
        // 拿不到 file:// URL 时跳过:仓库根仅被 node 环境用例消费,缺失不会影响 jsdom 套件。
    }
}
// 在测试文件注册局部 mock 前绑定真实实例，teardown 不能再次经过 mocked module graph。
const {appLogger: testAppLogger} = await import("nbook/server/app-logs/logger");

afterAll(async () => {
    await testAppLogger.flush();
    await rm(testLogRoot, {recursive: true, force: true});
    if (previousLogRoot === undefined) {
        delete process.env.NEURO_BOOK_LOG_DIR;
    } else {
        process.env.NEURO_BOOK_LOG_DIR = previousLogRoot;
    }
    if (previousRepositoryRoot === undefined) {
        delete process.env.NEURO_BOOK_REPOSITORY_ROOT;
    } else {
        process.env.NEURO_BOOK_REPOSITORY_ROOT = previousRepositoryRoot;
    }
});
