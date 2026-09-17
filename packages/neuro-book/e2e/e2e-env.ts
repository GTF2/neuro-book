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

/**
 * 写后结算块 e2e（T0.1 结算表协议）：用户消息里带此标记时，
 * Mock LLM 改为流式吐固定结算样例文本（见 `E2E_SETTLEMENT_SAMPLE_TEXT`）。
 * 其它用例的消息不含此标记，行为不变。
 */
export const E2E_SETTLEMENT_MARKER = "E2E-SETTLEMENT-SAMPLE";

/**
 * 固定结算样例：模拟 writer 交付消息（report_result.result 尾部按协议附「## 本章结算」块）。
 *
 * 格式必须与两处保持一致：
 * - writer profile 的 `<chapter_settlement>` 交付约定；
 * - `server/agent/profiles/writer-settlement.ts` 的解析器。
 *
 * `e2e/08-writer-settlement.spec.ts` 用它断言「交付消息可被解析出结算块结构」。
 */
export const E2E_SETTLEMENT_SAMPLE_TEXT = `已写入 manuscript/001-volume/001-chapter/index.md；润色 2 处。
剧情总结：薇洛丝在星陨遗迹深处解开莉雅的封印，两人初次交流后结伴离开。

## 本章结算

### 新增事实
- [人物] 莉雅首次登场：被封印于星陨遗迹深处的神明，与薇洛丝初次交流
- [物品] 薇洛丝获得封印钥匙，材质不明
- [状态] 薇洛丝左手在解封时被光刃划伤
- [时间] 本章结束时为复兴纪元 1 日 19:00

### 与既有设定的冲突点
- 无

### 未确定项
- 莉雅对封印起源的说法尚未与 lorebook 核对，是否入 canon 待确认`;

/**
 * 第二个隔离根：「全新安装、空书架」场景（示例书「空态即演示」用例专用）。
 *
 * 为什么必须**独立于主根**：空态用例要看到「一本书都没有」的首次启动条件，而主根里
 * 播种的 `e2e-smoke` 会被 01~03 打开并写入内容。实测（Windows + Bun dev server）删除
 * 一个本进程内被打开写过的项目会因目录仍被句柄占用而 500（PROJECT_PUBLISH_FAILED / publish-root），
 * 因此**靠删除制造空态不可靠**。改用一个「从不播种」的独立根，空态由构造保证，
 * 与前面用例留下什么彻底无关。
 */
export const E2E_EMPTY_ROOT = resolve(tmpdir(), "neuro-book-e2e-empty");
export const E2E_EMPTY_STATE_ROOT = resolve(E2E_EMPTY_ROOT, "state");
export const E2E_EMPTY_CACHE_ROOT = resolve(E2E_EMPTY_ROOT, "cache");
export const E2E_EMPTY_PORT = 3401;
export const E2E_EMPTY_BASE_URL = `http://${E2E_HOST}:${E2E_EMPTY_PORT}`;
/** 「本次运行」标记文件（与主根同理，刻意放在隔离根之外）。 */
export const E2E_EMPTY_RUN_MARKER_PATH = resolve(tmpdir(), "neuro-book-e2e-empty.run-id");
/** 空根自己的 Workspace Root 与 `.nbook` 覆盖层（与主根同构，只是根不同）。 */
export const E2E_EMPTY_WORKSPACE_ROOT = resolve(E2E_EMPTY_STATE_ROOT, "workspace");
export const E2E_EMPTY_USER_NBOOK_ROOT = resolve(E2E_EMPTY_WORKSPACE_ROOT, ".nbook");
export const E2E_EMPTY_GLOBAL_CONFIG_PATH = resolve(E2E_EMPTY_USER_NBOOK_ROOT, "config.json");
/**
 * 空根自己的 Mock LLM 端口。
 *
 * 两个隔离根会各起一个独立的应用进程，若共用 `E2E_MOCK_LLM_PORT` 会撞端口（EADDRINUSE）
 * 拖垮第二个 webServer。给空根单独一个端口，两个根就各自自洽、互不依赖。
 */
export const E2E_EMPTY_MOCK_LLM_PORT = 3500;
export const E2E_EMPTY_MOCK_LLM_BASE_URL = `http://${E2E_MOCK_LLM_HOST}:${E2E_EMPTY_MOCK_LLM_PORT}/v1`;
