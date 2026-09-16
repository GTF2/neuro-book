/**
 * 延迟清理：等应用真正退出后，把 e2e 的隔离 State Root 删干净。
 *
 * 为什么要独立进程：Playwright 在停 webServer **之前**执行 globalTeardown，而且它只停得到
 * `serve-e2e.ts` 本进程；应用的子进程会晚很多才释放 `.nbook` 下的 SQLite 句柄，甚至在被删之后
 * 还把收尾日志写回来。所以收尾必须发生在「端口真的没人监听」之后。
 *
 * 参数一律走环境变量（不用 argv）：本进程由 globalTeardown 用 `process.execPath` 拉起，
 * 而 `bun run` 下 execPath 可能是 bun —— 不同运行时对 `-e` 的 argv 处理不一致，环境变量才稳。
 *
 * 防误删：每次动手前都核对隔离根**之外**的「本次运行」标记；标记不属于自己就立刻退出，
 * 这样即使本进程拖得较久、下一次 e2e 已在同一路径重建了根，也不会删掉别人的数据。
 */
import {appendFileSync, existsSync, readFileSync, rmSync} from "node:fs";

const root = process.env.NEURO_E2E_CLEANUP_ROOT ?? "";
const url = process.env.NEURO_E2E_CLEANUP_URL ?? "";
const markerPath = process.env.NEURO_E2E_CLEANUP_MARKER ?? "";
const expectedRunId = process.env.NEURO_E2E_CLEANUP_RUN_ID ?? "";
const logPath = process.env.NEURO_E2E_CLEANUP_LOG ?? "";

function log(message) {
    try {
        if (logPath) appendFileSync(logPath, `${new Date().toISOString()} ${message}\n`, "utf8");
    } catch {
        // 日志失败不影响清理。
    }
}

const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

async function reachable() {
    try {
        await fetch(url, {signal: AbortSignal.timeout(1500)});
        return true;
    } catch {
        return false;
    }
}

/** 只有标记仍是本次运行的值时才动手。 */
function stillOurs() {
    try {
        return readFileSync(markerPath, "utf8").trim() === expectedRunId;
    } catch {
        return false;
    }
}

if (!root || !url || !markerPath || !expectedRunId) {
    log(`参数不完整，放弃清理 root=${root} marker=${markerPath}`);
    process.exit(0);
}

log(`启动清理 root=${root}`);

const portDeadline = Date.now() + 120_000;
while (Date.now() < portDeadline && await reachable()) {
    await sleep(500);
}
log("端口已释放（或等待超时），开始删除");
await sleep(1500);

// 应用在收到退出信号后仍可能补写收尾日志（实测 server-current.jsonl 会在删完后再出现），
// 所以在整个稳定窗口内持续删除，任何迟到的写入都会被带走。
const settleDeadline = Date.now() + 60_000;
while (Date.now() < settleDeadline) {
    if (!stillOurs()) {
        log("标记已不属于本次运行，停止清理");
        process.exit(0);
    }
    try {
        rmSync(root, {recursive: true, force: true, maxRetries: 5, retryDelay: 300});
    } catch {
        // 句柄还没释放，下一轮再试。
    }
    await sleep(1000);
}

if (!stillOurs()) {
    log("标记已不属于本次运行，停止清理");
    process.exit(0);
}
try {
    rmSync(root, {recursive: true, force: true, maxRetries: 5, retryDelay: 300});
} catch {
    // 交给下一轮 e2e 启动时重建。
}

if (existsSync(root)) {
    log(`隔离根仍存在（下次启动会重建）：${root}`);
} else {
    log("隔离根已清理");
    try {
        rmSync(markerPath, {force: true});
    } catch {
        // 标记残留无害。
    }
}
process.exit(0);
