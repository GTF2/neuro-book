import {mkdtempSync} from "node:fs";
import {rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join, resolve} from "node:path";
import {afterAll} from "vitest";

/** Agent测试进程的日志必须隔离，不能通过默认cwd写入仓库Workspace Root。 */
const testLogRoot = mkdtempSync(join(tmpdir(), "neuro-book-vitest-logs-"));
const previousLogRoot = process.env.NEURO_BOOK_LOG_DIR;
process.env.NEURO_BOOK_LOG_DIR = testLogRoot;

/**
 * `Import.path` 的仓库根必须显式给出，Product Runtime 不允许从 checkout 推断。
 *
 * 此前只有 `leader-assets-profile.test.ts` 在 `beforeAll` 里设它，而依赖它的 profile 测试
 * （`rp-profiles`、`simulation-director-profiles`、`world-engine-profile` 等）各自不设——
 * 谁先跑谁决定结果，全量运行会随文件顺序随机失败。这里全局设一次，与 `NEURO_BOOK_LOG_DIR` 同口径。
 */
const previousRepositoryRoot = process.env.NEURO_BOOK_REPOSITORY_ROOT;
process.env.NEURO_BOOK_REPOSITORY_ROOT = resolve(import.meta.dirname, "../../../..");

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
