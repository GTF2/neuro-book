import {spawn} from "node:child_process";
import {randomUUID} from "node:crypto";
import {mkdirSync, rmSync, writeFileSync} from "node:fs";
import {resolve} from "node:path";
import {
    E2E_CACHE_ROOT,
    E2E_EMPTY_CACHE_ROOT,
    E2E_EMPTY_GLOBAL_CONFIG_PATH,
    E2E_EMPTY_MOCK_LLM_BASE_URL,
    E2E_EMPTY_MOCK_LLM_PORT,
    E2E_EMPTY_PORT,
    E2E_EMPTY_ROOT,
    E2E_EMPTY_RUN_MARKER_PATH,
    E2E_EMPTY_STATE_ROOT,
    E2E_GLOBAL_CONFIG_PATH,
    E2E_MOCK_LLM_BASE_URL,
    E2E_MOCK_LLM_PORT,
    E2E_PORT,
    E2E_ROOT,
    E2E_RUN_MARKER_PATH,
    E2E_STATE_ROOT,
} from "./e2e-env";
import {seedE2eProject} from "./seed";
import {startMockLlmServer, writeE2eGlobalConfig} from "./mock-llm";
import {runSourceDev} from "../scripts/cli/source-dev.ts";

const packageRoot = resolve(import.meta.dirname, "..");

/**
 * 服务模式（由 Playwright `webServer.env` 传入）：
 * - `seed`（默认）：主根，启动前播种 `e2e-smoke`，供 01~04 主链路用。
 * - `empty`：第二个隔离根，**从不播种**——书架上天然「一本书都没有」，供「空态即演示」用例用。
 *
 * 为什么要第二个根：那个用例要看到真实空态，而主根里 `e2e-smoke` 会被前面用例打开并写入；
 * 实测删除「本进程内被打开写过」的项目会因目录句柄未释放而 500，因此不能靠删除制造空态。
 */
const SERVE_MODE = process.env.NEURO_BOOK_E2E_SERVE_MODE === "empty" ? "empty" : "seed";
const isEmptyMode = SERVE_MODE === "empty";

const root = isEmptyMode ? E2E_EMPTY_ROOT : E2E_ROOT;
const stateRoot = isEmptyMode ? E2E_EMPTY_STATE_ROOT : E2E_STATE_ROOT;
const cacheRoot = isEmptyMode ? E2E_EMPTY_CACHE_ROOT : E2E_CACHE_ROOT;
const port = isEmptyMode ? E2E_EMPTY_PORT : E2E_PORT;
const runMarkerPath = isEmptyMode ? E2E_EMPTY_RUN_MARKER_PATH : E2E_RUN_MARKER_PATH;
const mockLlmPort = isEmptyMode ? E2E_EMPTY_MOCK_LLM_PORT : E2E_MOCK_LLM_PORT;
const mockLlmBaseUrl = isEmptyMode ? E2E_EMPTY_MOCK_LLM_BASE_URL : E2E_MOCK_LLM_BASE_URL;
const globalConfigPath = isEmptyMode ? E2E_EMPTY_GLOBAL_CONFIG_PATH : E2E_GLOBAL_CONFIG_PATH;
/**
 * 每个 dev server 各自的 Nuxt buildDir（放在**包根之内**，模式区分子目录）。
 *
 * 两个 dev server 若共用默认的 `<rootDir>/.nuxt`，后启动的那台跑 `nuxt prepare` 会清掉 `.nuxt/dist`，
 * 迫使先启动、正在运行的那台「Restarting Nuxt」并重新优化依赖，先启动那台正在跑的用例随即吃 504
 * （实测日志：`.nuxt/dist directory has been removed. Restarting Nuxt...`）。
 *
 * 关键约束：buildDir **必须落在包根之内**。放在隔离根（系统临时目录）下时，Nuxt 生成的
 * `dev/index.mjs` 会向上找不到 `node_modules`，报 `Cannot find module 'typescript'`，应用起不来
 * （实测踩过）。放在包根内，Node 逐级上溯即可命中 `node_modules`。两个模式各用一个子目录，仍互不干扰。
 */
const buildDir = resolve(packageRoot, ".nuxt-e2e", isEmptyMode ? "empty" : "seed");

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
 * 顺序很关键：先清空并重建隔离根（`empty` 模式下不播种）→ 再交给 Source Dev 起应用。
 * 这样项目选择界面第一次加载时状态就是确定的——主根能看到种子项目，空根看到真正的空态，
 * 都不存在「数据还没写好」的竞态。
 *
 * 隔离是红线：State/Cache 全部指向临时目录，监听端口换成独立端口，绝不触碰真实 State Root。
 */

// 1) 清掉上一次（可能被中断）的隔离根，保证每次 e2e 从干净状态开始。
rmSync(root, {recursive: true, force: true, maxRetries: 10, retryDelay: 200});
mkdirSync(stateRoot, {recursive: true});
mkdirSync(cacheRoot, {recursive: true});

// 1b) 写「本次运行」标记（放在隔离根之外）。Playwright 停 webServer 只停得到本进程，应用子进程
//     可能晚一步才释放 SQLite 句柄（甚至在被删之后又把日志写回来），所以收尾要靠一个延迟清理进程；
//     那个进程会先核对这个标记，确认自己删的是**这一次**运行的根，避免误删下一次运行刚建好的数据。
writeFileSync(runMarkerPath, randomUUID(), "utf8");

// 2) 把隔离配置写进环境：Source Dev 与它派生的 dev:runtime 都会继承。
process.env.NEURO_BOOK_STATE_ROOT = stateRoot;
process.env.NEURO_BOOK_CACHE_ROOT = cacheRoot;
process.env.NEURO_BOOK_BUILD_DIR = buildDir;
process.env.PORT = String(port);
process.env.NUXT_PORT = String(port);
// 即使被当作 CLI 直接执行也不自动开浏览器（这里通常是被 Playwright 拉起）。
process.env.NEURO_BOOK_DEV_NO_OPEN = "1";

// 3) 首次启动的应用数据状态迁移。全新隔离根里 App SQLite 尚无 schema、Application State 也未初始化，
//    Source Dev 的 migration gate 会 fail-closed（实测：`dev:runtime exited with code 1`）。
//    这里用与产品同一条迁移命令（含 App SQLite step）完成初始化，之后 gate 才会放行。
await runBunStep(["scripts/db/migrate-application-state.ts", "--apply"]);

// 4) 主根：播种项目（在应用起来之前）。空根刻意不播种，保持「零项目」真实空态。
if (!isEmptyMode) {
    await seedE2eProject();
}

// 5) 起本地 Mock LLM 并把它的 Provider 写进本根自己的隔离全局配置。
//    顺序在播种之后、起应用之前：应用启动时就能解析到模型。
//    两个隔离根各起各的 Mock（不同端口），互不依赖。
const mockLlm = startMockLlmServer({port: mockLlmPort});
writeE2eGlobalConfig({configPath: globalConfigPath, baseUrl: mockLlmBaseUrl});
process.stdout.write(`[e2e] Mock LLM 已就绪: http://127.0.0.1:${String(mockLlm.port)}/v1\n`);

// 6) 交给 Source Dev 起应用（复用产品既有的安装/准备/启动与信号处理链路）。
process.exitCode = await runSourceDev({env: process.env});

// 7) 应用退出后收尾：先停 Mock LLM，再删隔离根（此刻 SQLite 句柄已释放）。
//    Playwright 会在 teardown 之后才停应用，所以 globalTeardown 的删除可能撞上占用；
//    这里是「应用自然收尾」这条路径上的兜底清理。
mockLlm.stop();
try {
    rmSync(root, {recursive: true, force: true, maxRetries: 5, retryDelay: 300});
    rmSync(runMarkerPath, {force: true});
} catch (error) {
    process.stderr.write(`[e2e] 退出后清理隔离根失败（下次启动会重建）：${String(error)}\n`);
}
