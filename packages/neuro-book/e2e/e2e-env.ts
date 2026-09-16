import {tmpdir} from "node:os";
import {resolve} from "node:path";

/**
 * E2E 全局常量：隔离的运行根与端口。
 *
 * 红线：e2e 绝不触碰本机真实 State Root（`%LOCALAPPDATA%\NeuroBook\data`，内含 224 章真实小说）。
 * 因此这里把 State/Cache 都指向系统临时目录下的独立根，并用独立端口避开开发者正在用的 3000。
 * 这些常量是 webServer（起应用）与测试（断言落盘）共用的唯一真相源，避免两边算出不同路径。
 */
export const E2E_PORT = 3400;
export const E2E_HOST = "127.0.0.1";
/** 应用基址；测试与 globalSetup 共用，避免各处硬编码端口。 */
export const E2E_BASE_URL = `http://${E2E_HOST}:${E2E_PORT}`;
export const E2E_ROOT = resolve(tmpdir(), "neuro-book-e2e");
export const E2E_STATE_ROOT = resolve(E2E_ROOT, "state");
export const E2E_CACHE_ROOT = resolve(E2E_ROOT, "cache");
/** 隔离根里播种出来的项目标识（同时是 workspace 相对目录名）。 */
export const E2E_PROJECT_ROOT = "e2e-smoke";
export const E2E_PROJECT_TITLE = "E2E 冒烟小说";
/** 相对项目根、包含一节正文的章节文件（默认模板已带）。 */
export const E2E_CHAPTER_RELATIVE_PATH = "manuscript/001-volume/001-chapter/index.md";

/** 隔离 Workspace Root：`<State Root>/workspace`（Runtime Paths 推导结果）。 */
export const E2E_WORKSPACE_ROOT = resolve(E2E_STATE_ROOT, "workspace");
/** 用户 `.nbook` 覆盖层：Provider/模型等全局配置的落点。 */
export const E2E_USER_NBOOK_ROOT = resolve(E2E_WORKSPACE_ROOT, ".nbook");
/** 全局配置文件名（runtime 读取 Provider 配置的真相源）。 */
export const E2E_GLOBAL_CONFIG_PATH = resolve(E2E_USER_NBOOK_ROOT, "config.json");
/** 播种项目物理目录。 */
export const E2E_PROJECT_DIR = resolve(E2E_WORKSPACE_ROOT, E2E_PROJECT_ROOT);
/** 章节文件绝对路径；测试用它验证「编辑器写下的内容真的落盘」。 */
export const E2E_CHAPTER_FILE_PATH = resolve(E2E_PROJECT_DIR, E2E_CHAPTER_RELATIVE_PATH);

/**
 * 「本次运行」标记文件：延迟清理进程据此确认自己删的是同一次运行的根，而不是下一次运行刚建好的。
 *
 * 刻意放在隔离根**之外**（临时目录里、与之同级）：同步删除会把隔离根连内容一起删掉，
 * 标记必须在那种情况下也依然能读到，清理进程才有判据。
 */
export const E2E_RUN_MARKER_PATH = resolve(tmpdir(), "neuro-book-e2e.run-id");

/**
 * 本地 Mock LLM：E2E 想验证 Agent「发起 → 中断」，就必须有一个能持续输出、
 * 且完全离线的模型端点。这里用独立端口跑一个 OpenAI 兼容的流式服务。
 */
export const E2E_MOCK_LLM_PORT = 3499;
export const E2E_MOCK_LLM_HOST = "127.0.0.1";
export const E2E_MOCK_LLM_BASE_URL = `http://${E2E_MOCK_LLM_HOST}:${E2E_MOCK_LLM_PORT}/v1`;
export const E2E_MOCK_PROVIDER_ID = "e2e-mock";
export const E2E_MOCK_MODEL_ID = "e2e-mock-model";
export const E2E_MOCK_MODEL_KEY = `${E2E_MOCK_PROVIDER_ID}/${E2E_MOCK_MODEL_ID}`;
export const E2E_MOCK_API_KEY = "e2e-mock-key";
/** 慢速流的节奏（毫秒/片）。够慢，UI 才有稳定的「运行中」窗口可中断。 */
export const E2E_MOCK_STREAM_INTERVAL_MS = 400;
export const E2E_MOCK_STREAM_CHUNKS = 60;
