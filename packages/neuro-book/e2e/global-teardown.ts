import {spawn} from "node:child_process";
import {existsSync, readFileSync, rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {dirname, join} from "node:path";
import {setTimeout as sleep} from "node:timers/promises";
import {fileURLToPath} from "node:url";
import {E2E_BASE_URL, E2E_ROOT, E2E_RUN_MARKER_PATH, E2E_STATE_ROOT} from "./e2e-env";

/**
 * 跑完删除隔离根（红线收尾：临时 State Root 必须清掉）。
 *
 * 时序陷阱：Playwright 在**停止 webServer 之前**就执行 globalTeardown，而且它只停得到
 * `serve-e2e.ts` 本进程；应用的子进程会晚很多才释放 `.nbook` 下的 SQLite 句柄。实测两种症状：
 * - 同步删除撞上句柄：`EBUSY: history.sqlite`；
 * - 就算侥幸删掉了，应用还会把 `logs/server-current.jsonl`、`agent/profiles/.compiled/manifest.json`
 *   写回来（删完又出现）。
 *
 * 因此：
 * 1) 先做一次有界退避的同步删除（应用已退出时立刻生效，零成本）；
 * 2) 再派一个 detached 清理进程（`e2e/support/cleanup-deferred.mjs`）：它等端口释放
 *    （= 应用真的停了）后在稳定窗口内持续删除，直到隔离根真的消失。**独立自测通过**。
 *
 * 参数走环境变量、脚本走独立文件：本进程由 `bun run` 拉起，`process.execPath` 可能是 bun，
 * 而不同运行时对 `node -e` 的 argv 处理不一致（实测会静默不删），文件 + 环境变量才稳。
 *
 * ⚠️ 已知局限（实测，不隐瞒）：Windows 上 `bun run` 退出时会连带终止整棵进程树，
 * 这个 detached 子进程在真实 e2e 收尾路径上会被一起带走，于是延迟清理常常来不及执行。
 * 因此「跑完即清空隔离根」**不保证**：可能残留本次运行的隔离根（位于 `%TEMP%\neuro-book-e2e`）。
 * 这不会污染真实数据，也不会累积——`serve-e2e.ts` 每次启动都会先整体清空再重建。
 * 需要立刻清掉时执行：`rm -rf "$TEMP/neuro-book-e2e"`。
 *
 * 防误删：清理进程每次动手前核对隔离根**之外**的「本次运行」标记，只删属于自己的那次运行。
 * 全程只告警不抛错：残留位于系统临时目录（不是真实 State Root）。
 */

/** 派一个 detached 清理进程，等应用退出后把隔离根删干净；返回是否成功派发。 */
function spawnDeferredCleanup(expectedRunId: string): boolean {
    const scriptPath = join(dirname(fileURLToPath(import.meta.url)), "support", "cleanup-deferred.mjs");
    const logPath = join(tmpdir(), "neuro-book-e2e-cleanup.log");

    try {
        const child = spawn(process.execPath, [scriptPath], {
            detached: true,
            stdio: "ignore",
            windowsHide: true,
            env: {
                ...process.env,
                NEURO_E2E_CLEANUP_ROOT: E2E_ROOT,
                NEURO_E2E_CLEANUP_URL: `${E2E_BASE_URL}/api/auth/me`,
                NEURO_E2E_CLEANUP_MARKER: E2E_RUN_MARKER_PATH,
                NEURO_E2E_CLEANUP_RUN_ID: expectedRunId,
                NEURO_E2E_CLEANUP_LOG: logPath,
            },
        });
        child.unref();
        return true;
    } catch (error) {
        process.stderr.write(`[e2e] 延迟清理进程未能启动：${String(error)}\n`);
        return false;
    }
}

/** 有界退避的同步删除；返回是否已经删净。 */
async function removeIsolatedRootNow(): Promise<boolean> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
        try {
            rmSync(E2E_ROOT, {recursive: true, force: true});
            return true;
        } catch {
            await sleep(500);
        }
    }
    return false;
}

export default async function globalTeardown(): Promise<void> {
    // 标记在隔离根之外，正常不会被同步删除带走；先读出来备用。
    let runId = "";
    try {
        runId = readFileSync(E2E_RUN_MARKER_PATH, "utf8").trim();
    } catch {
        runId = "";
    }

    const removedNow = await removeIsolatedRootNow();

    if (!runId) {
        process.stderr.write(
            `[e2e] 找不到本次运行标记（${E2E_RUN_MARKER_PATH}）：同步删除${removedNow ? "已完成" : "未完成"}，跳过延迟清理以免误删。\n`,
        );
        return;
    }

    // 无条件派延迟清理：应用此刻通常还活着，删掉的东西会被它写回来。
    const spawned = spawnDeferredCleanup(runId);
    process.stdout.write(
        `[e2e] 收尾：同步删除${removedNow ? "已成功" : "未完成"}；延迟清理${spawned ? "已安排（等应用退出后继续删）" : "未安排"}：${E2E_ROOT}\n`,
    );
    if (existsSync(E2E_STATE_ROOT)) {
        process.stdout.write(`[e2e] 提示：此刻隔离根仍在 ${E2E_STATE_ROOT}（临时目录，下次启动也会重建）\n`);
    }
}
