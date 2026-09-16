import {spawn} from "node:child_process";
import {randomUUID} from "node:crypto";
import {mkdirSync, rmSync, writeFileSync} from "node:fs";
import {resolve} from "node:path";
import {E2E_CACHE_ROOT, E2E_PORT, E2E_ROOT, E2E_RUN_MARKER_PATH, E2E_STATE_ROOT} from "./e2e-env";
import {seedE2eProject} from "./seed";
import {startMockLlmServer, writeE2eGlobalConfig} from "./mock-llm";
import {runSourceDev} from "../scripts/cli/source-dev.ts";

const packageRoot = resolve(import.meta.dirname, "..");

/** 顺序执行一个 bun 步骤；非零退出即整体失败（宁可 e2e 起不来，也不许带病启动）。 */
function runBunStep(args: readonly string[]): Promise<void> {
    return new Promise((resolvePromise, rejectPromise) => {
        const child = spawn(process.execPath, [...args], {
            cwd: packageRoot,
            env: process.env,
            stdio: "inherit",
            windowsHide: false,
        });
        child.once("error", rejectPromise);
        child.once("exit", (code, signal) => {
            if (signal) {
                rejectPromise(new Error(`步骤被信号终止：${args.join(" ")}`));
                return;
            }
            if (code === 0) {
                resolvePromise();
                return;
            }
            rejectPromise(new Error(`步骤退出码 ${String(code)}：${args.join(" ")}`));
        });
    });
}

/**
 * e2e 专用启动入口（Playwright `webServer.command`）。
 *
 * 顺序很关键：先清空并重建隔离根 → 播种项目 → 再交给 Source Dev 起应用。
 * 这样项目选择界面第一次加载时就一定能看到种子项目，不存在「数据还没写好」的竞态。
 *
 * 隔离是红线：State/Cache 全部指向临时目录，监听端口也换成独立端口，绝不触碰真实 State Root。
 */

// 1) 清掉上一次（可能被中断）的隔离根，保证每次 e2e 从干净状态开始。
rmSync(E2E_ROOT, {recursive: true, force: true, maxRetries: 10, retryDelay: 200});
mkdirSync(E2E_STATE_ROOT, {recursive: true});
mkdirSync(E2E_CACHE_ROOT, {recursive: true});

// 1b) 写「本次运行」标记（放在隔离根之外）。Playwright 停 webServer 只停得到本进程，应用子进程
//     可能晚一步才释放 SQLite 句柄（甚至在被删之后又把日志写回来），所以收尾要靠一个延迟清理进程；
//     那个进程会先核对这个标记，确认自己删的是**这一次**运行的根，避免误删下一次运行刚建好的数据。
writeFileSync(E2E_RUN_MARKER_PATH, randomUUID(), "utf8");

// 2) 把隔离配置写进环境：Source Dev 与它派生的 dev:runtime 都会继承。
process.env.NEURO_BOOK_STATE_ROOT = E2E_STATE_ROOT;
process.env.NEURO_BOOK_CACHE_ROOT = E2E_CACHE_ROOT;
process.env.PORT = String(E2E_PORT);
process.env.NUXT_PORT = String(E2E_PORT);
// 即使被当作 CLI 直接执行也不自动开浏览器（这里通常是被 Playwright 拉起）。
process.env.NEURO_BOOK_DEV_NO_OPEN = "1";

// 3) 首次启动的应用数据状态迁移。全新隔离根里 App SQLite 尚无 schema、Application State 也未初始化，
//    Source Dev 的 migration gate 会 fail-closed（实测：`dev:runtime exited with code 1`）。
//    这里用与产品同一条迁移命令（含 App SQLite step）完成初始化，之后 gate 才会放行。
await runBunStep(["scripts/db/migrate-application-state.ts", "--apply"]);

// 4) 播种项目（在应用起来之前）。
await seedE2eProject();

// 5) 起本地 Mock LLM 并把它的 Provider 写进隔离全局配置。
//    顺序在播种之后、起应用之前：应用启动时就能解析到模型，Agent 链路才有「运行中」可点。
const mockLlm = startMockLlmServer();
writeE2eGlobalConfig();
process.stdout.write(`[e2e] Mock LLM 已就绪: http://127.0.0.1:${String(mockLlm.port)}/v1\n`);

// 6) 交给 Source Dev 起应用（复用产品既有的安装/准备/启动与信号处理链路）。
process.exitCode = await runSourceDev({env: process.env});

// 7) 应用退出后收尾：先停 Mock LLM，再删隔离根（此刻 SQLite 句柄已释放）。
//    Playwright 会在 teardown 之后才停应用，所以 globalTeardown 的删除可能撞上占用；
//    这里是「应用自然收尾」这条路径上的兜底清理。
mockLlm.stop();
try {
    rmSync(E2E_ROOT, {recursive: true, force: true, maxRetries: 5, retryDelay: 300});
    rmSync(E2E_RUN_MARKER_PATH, {force: true});
} catch (error) {
    process.stderr.write(`[e2e] 退出后清理隔离根失败（下次启动会重建）：${String(error)}\n`);
}
