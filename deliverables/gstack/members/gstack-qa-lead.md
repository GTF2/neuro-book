# NeuroBook 质量保障与发布体系评估

> 作者：gstack-qa-lead（软件工坊 QA 与发布负责人）
> 日期：2026-09-17　方式：**只读取证**（未修改任何源码/配置），实跑全量测试 + 交叉复核文档
> 证据格式：`文件路径:行号` 或实跑数字。无证据的判断一律标注「推断」。

---

## 0. 结论先行

**一句话判断：NeuroBook 现在不是"没有测试"，而是"测试很多但都不敢信"——3605 条通过、0 条真实失败，但主应用零 E2E、零组件渲染测试、零性能预算，所以"绿灯"证明不了"能用"。**

三条最关键的修正（与上一轮只读扫描的基线不同，请注意）：

| 上一轮基线 | 本次实跑复核 | 判断 |
|---|---|---|
| 测试文件 476 个 | **474 个被 vitest 收集**（`packages/neuro-book`），3630 条用例 | ✅ 基本准确 |
| Full tests **24 文件 / 78 失败** | 本次实跑：**7 个文件 / 21 条失败**（`bun run test`，Node 运行时） | ⚠️ 数字已变（78→21），**归因错了** |
| 失败来自「POSIX `C:/...` 伪路径门禁」 | 实跑失败里 **0 条**是 `C:/...` 伪路径。21 条全部是「vitest 跑在 Node 而不是 Bun 上」+「Git Bash 的 MSYS 路径改写」造成的**调用方式假阳性** | ❌ 归因过期 |
| typecheck 长期带残留错误 | **实跑 `bun run typecheck` → exit 0、0 条 `error TS`（30 秒）**。HANDOFF §3.19 说的"剩 1 处（他人未提交在途代码）"已被 `67d8cf18` 收编后归零 | ✅ 已归零，文档滞后 |

**最重要的一条新发现（本次独有，之前的文档里没有）**：

> `packages/neuro-book/server/agent/test/setup.ts:15` 用 `fileURLToPath(new URL("../../../../", import.meta.url))` 推导仓库根。
> 在 jsdom 环境下 `import.meta.url` 是 `http://…` 而非 `file://`，`fileURLToPath` 直接抛 `TypeError: The URL must be of scheme file`。
> **后果：主应用里任何一个写 `// @vitest-environment jsdom` 的测试都会整套崩掉，连加载都加载不了。**
> 现有 2 个文件已经踩死：`app/components/markdown-studio/tiptap/dialect-fallback-dom.test.ts`、`empty-document-default.test.ts`（均为 0 条用例可跑）。
> **这条不修，主应用就永远补不上组件渲染测试**——它是"往上一层测试能力"的硬门槛。

---

## 1. 主应用 E2E 最小可行方案

### 1.1 现状取证

| 事实 | 证据 |
|---|---|
| `playwright.config.ts` 全仓库只有 1 个，在 `packages/nb-ui` | `Glob **/playwright.config.*` → 仅 `packages/nb-ui/playwright.config.ts`（+ `node_modules/cytoscape` 的第三方文件） |
| 主应用 `packages/neuro-book` 只有 `vitest.config.ts`，**无 `test:e2e` 脚本、无 `e2e/` 目录** | `packages/neuro-book/package.json:29-76` 全量 scripts 无 e2e；`Glob packages/neuro-book/**/*.spec.ts` → 0 |
| **但主应用并不是"完全没接浏览器"**——已有 3 个 `playwright-core` 手写 smoke 脚本，接在根 `package.json` | 根 `package.json:54-56`：`product:browser-smoke` / `desktop:workbench-browser-smoke` / `desktop:native-acceptance` |
| 这些 smoke 只验证"首页 mount 成功 + 版本号对"，**不跑任何业务流** | `scripts/deploy/product-browser-smoke.ts:44` 只 `waitFor .novel-ide-page` + `:47` 校验 `/api/app/version` |
| dev server 已有就绪探针和预热清单 | `packages/neuro-book/scripts/cli/warmup-dev-server.mjs:4-16`（探 `/api/hello`，预热 8 个端点） |
| CI 里主应用只在 **PR 阶段跑 linux-x64 一个平台**，且只有"首页 smoke" | `scripts/build/product-platform-matrix.ts:14-22`（唯一 `prGate: true`）+ `product-platforms.yml:122-136` |

**修正上一轮的措辞**：不是"playwright-core 装了没接线"，而是**接了线但只接了一根最细的线（首页能开），业务流一根都没有**。

### 1.2 建在哪：三个文件 + 一个脚本

```
packages/neuro-book/playwright.config.ts          ← 新建（照抄 nb-ui 写法）
packages/neuro-book/e2e/fixtures.ts               ← 新建（照抄 nb-ui/e2e/fixtures.ts，console/pageerror 归零）
packages/neuro-book/e2e/smoke.spec.ts             ← 新建（3 条主链路，本期只要这 1 个 spec）
packages/neuro-book/package.json                  ← 加 1 行 "test:e2e"
```

`playwright.config.ts` 照抄 `packages/nb-ui/playwright.config.ts:8-26` 的骨架，只改四处：

```ts
export default defineConfig({
    testDir: "./e2e",
    timeout: 120_000,                 // 比 nb-ui 的 60s 放宽：Nuxt dev 首屏编译慢
    expect: {timeout: 20_000},
    retries: process.env.CI ? 1 : 0,  // 本地 0（红灯要刺眼），CI 1（抗 dev server 抖动）
    workers: 1,                       // 与主应用共享 State Root，2 个实例会租约冲突（HANDOFF §5）
    reporter: [["list"], ["html", {open: "never"}]],
    use: {
        baseURL: "http://127.0.0.1:3000",   // ← 必须 127.0.0.1，不用 localhost（Windows 解析到 ::1，HANDOFF §5）
        trace: "retain-on-failure",
        video: "retain-on-failure",
    },
    projects: [{name: "chromium", use: {...devices["Desktop Chrome"]}}],
    webServer: {
        command: "bun run dev",             // = scripts/cli/source-dev.ts
        url: "http://127.0.0.1:3000/api/hello",   // ← 用现成探针，别用 "/"
        reuseExistingServer: !process.env.CI,     // 本地复用 GTF 已开的实例（但要注意租约）
        timeout: 180_000,                   // Nuxt dev 冷启动 + 首编译
    },
});
```

`e2e/fixtures.ts` 直接复制 `packages/nb-ui/e2e/fixtures.ts:5-20` 的 `consoleGuard`（auto fixture，用例结束断言 `console.error` 与 `pageerror` 均为 0）。**这一条是整个方案里性价比最高的**：它一条断言就等价于"这一路没有 JS 报错"，比写 20 条 DOM 断言有用。

### 1.3 跑什么：3 条主链路 + 断言点

> 前置 fixture 见 §1.4。所有用例统一走 **API 开项目**（`POST /api/projects/open {projectRoot}`，`server/api/projects/open.post.ts`），不走 UI 点击选项目——点击路径的 CSS 选择器一改就红，而我们要测的是业务不是选择器。

#### 链路 A：打开应用 → 选项目 → 写一段章节

| # | 断言点 | 为什么这条能拦住真问题 |
|---|---|---|
| A1 | `await page.goto("/")`，`.novel-ide-page` visible | 兜底（现有 smoke 只到这） |
| A2 | `POST /api/projects/open` 返回 200；页面 Activity Bar 出现项目名 | 项目会话真的建立了。HANDOFF §5 记载 UI 关闭会让会话变 409 `PROJECT_NOT_OPEN`——这条能拦回归 |
| A3 | 进入章节正文编辑器，`.tiptap` / ProseMirror 容器 visible 且可 focus | 编辑器真的挂载（tiptap 相关，见 §2 的 jsdom 坑） |
| A4 | 用键盘 `page.keyboard.type()` 输入 200 字，**断言编辑器内文本长度 = 200** | 拦截输入丢字 / IME / 受控组件回弹 |
| A5 | 等 autosave（或触发保存）后，`GET` 章节 Markdown 文件内容包含刚输入的唯一字符串（如 `QA-E2E-<uuid>`） | **端到端落盘**：UI → server → workspace 文件。这是"能写"和"写了不丢"的分界 |
| A6 | 刷新页面，重新打开同一章节，正文仍含该字符串 | 落盘是真的持久化，不是内存态 |

#### 链路 B：关键帧面板 tab 切换与新建

依据：`app/components/novel-ide/plot/workbench/PlotWorkbenchDialog.vue:94`（四个真 tab：`thread`/`promises`/`decisions`/`keyframes`）、`:439`（关键帧 tab 自含数据加载）。

| # | 断言点 |
|---|---|
| B1 | 打开「剧情 → 剧本工作台」，4 个 tab 标签均可见（线程规划 / 承诺账本 / 决策记录 / 关键帧） |
| B2 | 点「关键帧」tab，store `plotWorkbenchTab === "keyframes"`，`PlotKeyframeLedgerTab` 挂载（断言 tab 面板里有帧列表容器，不含其它 tab 的主体） |
| B3 | 点「新建」→ `PlotKeyframeEditorDialog.vue` 弹出；填必填项（instant 锚 + 不可逆变化声明）后保存 |
| B4 | 保存后关闭对话框，断言列表出现该帧（`GET /api/projects/plot/keyframes` 或等价端点能查到） |
| B5 | **切到别的 tab 再切回「关键帧」，帧还在**（自含数据加载的重入正确性） |
| B6 | 全程 `console.error` / `pageerror` 为 0（fixtures 自动断言） |

> B 链路的价值：**它正是 HANDOFF 待办表里挂了 2 天的 P1「关键帧面板的浏览器人工验证」**（`HANDOFF.md:106`）。做成 E2E 后，这条"人工点一眼"就永久不用再做了。

#### 链路 C：Agent 会话发起与中断

依据：`server/api/agent/sessions/index.post.ts`、`server/api/agent/sessions/[sessionId]/invocations.post.ts`、`server/api/agent/sessions/[sessionId]/abort.post.ts`（已存在）。

| # | 断言点 |
|---|---|
| C1 | 起一个会话，发一条消息，断言出现 streaming 中的状态（打字/运行指示） |
| C2 | 点「停止」→ 断言 `POST .../abort` 被调用（用 `page.waitForRequest` 兜） |
| C3 | **Task 139 的核心合同**：取消显示中性状态、**保留已生成的半截正文**、**不弹重复错误气泡**（`PROJECT-STATUS.md:69`）→ 断言正文区仍有非空内容，且错误提示数量为 0 |
| C4 | 中断后 UI 回到可输入态（composer 可再次发送） |

> ⚠️ **C 链路最大的现实约束**：它需要真实 Provider。如果 Provider 没配好，断言会假红。
> **建议**：C 链路默认 `test.skip(!!process.env.NEURO_BOOK_E2E_REAL_PROVIDER)`**，先落地但不上 CI 门禁**；用一个"假 Provider"（把 Provider base URL 指向本地 stub）跑 C1–C4 的纯中断语义。等 `test:real-model` 有稳定凭据再开真 Provider 版。

### 1.4 如何 fixture 一个 224 章的真实项目

**结论：不要复制真实作品。** 三个替代方案，按推荐度排序：

| 方案 | 做法 | 成本 | 推荐度 |
|---|---|---|---|
| **① API 生成 + 缓存快照（推荐）** | 写一个 `e2e/fixtures/seed-project.ts`：用 `POST /api/projects` + 批量 plot API 生成 **20 章 / 30 场景 / 2 线索**（够触发分页与列表渲染，跑得快）；生成一次后把整个 Project Workspace 目录打包成 zip 存 `e2e/fixtures/__cache__/project-20ch.zip`，global setup 时解压到 State Root 下的临时目录 | 中 | ★★★★★ |
| ② 真实 224 章项目做**只读**引用 | 把 `%LOCALAPPDATA%\NeuroBook\data\workspace\xin-xiao-shuo` 挂进来，但**只跑只读用例**（列表渲染、tab 切换、性能计时），写用例另用小项目 | 低 | ★★★☆☆（性能预算用它） |
| ③ 生成器脚本造 224 章 | 现成种子只有小样例：`scripts/seed/heroes-story.ts` 只造 5 角色 / 12 切面（`:293-300`），**没有 224 章生成器** | 高 | ★☆☆☆☆ |

**为什么选 20 章而不是 224 章做功能 E2E**：224 章的 E2E 每次跑要几分钟、且任何一条列表断言都会因为数据量而变得不稳定。**规模问题交给性能预算（§3）去测，功能 E2E 只要"结构相同、规模够小"**。

**必须做的隔离**（不然会污染 GTF 的真作品）：
- `NEURO_BOOK_STATE_ROOT` / `NEURO_BOOK_CACHE_ROOT` 指向 `playwright.config.ts` 的 globalSetup 里 `mkdtempSync` 出来的临时目录（`source-dev.ts:103` 支持通过 env 指定端口，roots 同理见 `resolveSourceDevUserRoots`）。
- State Root 隔离顺带解决了"两个实例租约冲突"（`HANDOFF.md:140`）。

### 1.5 怎么进 CI

**第一步（本期）**：**不进 CI 必检**，只做成可选 job。

```yaml
# .github/workflows/app-e2e.yml（新建）
on:
  workflow_dispatch:            # 手动触发
  pull_request:
    paths: ["packages/neuro-book/**"]   # 先观察稳定性
jobs:
  e2e:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    continue-on-error: true     # ← 关键：先让它"看得见但不拦人"
    steps:
      - uses: actions/checkout@v5
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile --linker hoisted
      - run: bun run --cwd packages/neuro-book nuxt:prepare
      - run: bun run --cwd packages/neuro-book generate
      - run: bunx playwright-core install --with-deps chromium   # 照抄 product-platforms.yml:124
      - run: bun run --cwd packages/neuro-book test:e2e
      - uses: actions/upload-artifact@v4
        if: always()
        with: {name: e2e-report, path: packages/neuro-book/playwright-report, if-no-files-found: ignore}
```

**第二步**：连续 10 次 PR 全绿（`continue-on-error: true` 期间观察）→ 摘掉 `continue-on-error` → 进必检。

**为什么不能一步到位进必检**：`packages/nb-ui/playwright.config.ts:12` 是 `retries: 0`、`:19` 只有 chromium 一个 project，nb-ui 是**纯组件实验室（无后端、无 DB）**，天然稳定；主应用带 SQLite + State Root + dev server，**抖动源多一个数量级**。直接进必检会立刻变成新的"常态化红灯"，把 §2 好不容易清出来的红灯语义又毁掉。

### 1.6 成本与风险

| 风险 | 严重度 | 说明与缓解 |
|---|---|---|
| **dev server 在本地被宿主回收** | 🔴 | HANDOFF §5 明确记载"dev server 在本环境会被宿主回收，未起"。**这就是"人写帧 UI 未经人眼确认"拖 2 天的真因**。缓解：E2E 必须能自己 `webServer` 拉起（不依赖 GTF 手开），且先做成"GTF 手开一次就够"的形态。 |
| State Root 租约冲突 | 🟠 | 两个实例共享 State Root 会 `ELOCKED`（HANDOFF §5）。缓解：`workers: 1` + 每 run 独立 State Root。 |
| Windows 下 `localhost` → `::1` | 🟠 | 一律 `127.0.0.1`（HANDOFF §5）。已写入配置。 |
| 首次编译慢导致 timeout | 🟡 | `webServer.timeout: 180_000` + 就绪探 `/api/hello`。 |
| 视觉快照（visual spec） | 🟡 | **本期不要做**。nb-ui 有 14 个 png 快照（`packages/nb-ui/e2e/visual.spec.ts-snapshots/`），那是纯组件库才玩得起；主应用做视觉快照会立刻变成维护灾难。 |
| 估计工作量 | — | 配置 + fixtures + 3 条 spec ≈ **1 个文件 4 处改动 + 3 个新文件**，一次性成本；CI job 一次。 |

---

## 2. 失败基线处理策略（78 → 21 → 目标 0）

### 2.1 本次实跑的硬数字

命令：`cd packages/neuro-book && bun run test -- --reporter=json`（2026-09-17，Windows，HEAD = 当前工作区）

| 指标 | 数值 |
|---|---|
| 收集测试文件 | **474** |
| 用例总数 | **3630**（通过 3605 / 失败 **21** / pending 4） |
| 失败文件 | **7** |

### 2.2 21 条失败的逐条归因（这是本节的核心）

| 文件 | 条数 | 失败信息 | 真因 | 是真 bug 吗？ |
|---|---|---|---|---|
| `server/workspace-files/workspace-command.test.ts` | 7 | `ReferenceError: Bun is not defined`（`workspace-command.test.ts:193`） | 测试用 `Bun.which("bun")` 定位 bun 可执行文件；但 `bun run test` 会按 `node_modules/vitest/vitest.mjs` 的 `#!/usr/bin/env node` shebang **用 Node 跑 vitest**，Node 里没有 `Bun` 全局 | ❌ 调用方式问题 |
| `server/agent/profiles/profile-compile-worker.test.ts` | 10 | `Cannot find module '…/profile-compile-worker-runtime'`；`等待文件出现超时` | 同上：worker 用 Bun 的**无扩展名 TS 解析**，Node 下解析不了 | ❌ 调用方式问题 |
| `server/agent/profiles/profile-compile-worker-lifecycle.test.ts` | 1 | `Expected ProjectNotOpenError to be an instance of ProjectNotOpenError` | 双份模块实例（Node 下 worker 与主线程走了不同 module graph） | ❌ 调用方式问题 |
| `server/workspace-files/project-lock.test.ts` | 1 | `ReferenceError: Bun is not defined`（`:210`） | 同上 | ❌ 调用方式问题 |
| `server/agent/tools/file-tools.test.ts` | 2 | `Module not found "/d/MyProject/…/workspace-command.ts"` | **Git Bash 的 MSYS 路径改写**：`/d/...` 不是 Windows 路径，Bun 不认 | ❌ 终端环境问题 |
| `app/components/markdown-studio/tiptap/dialect-fallback-dom.test.ts` | 0（整套崩） | `TypeError: The URL must be of scheme file` @ `server/agent/test/setup.ts:15:50` | **真 bug**（见 §0） | ✅ **是** |
| `app/components/markdown-studio/tiptap/empty-document-default.test.ts` | 0（整套崩） | 同上 | **真 bug** | ✅ **是** |

### 2.3 复跑验证：19 条是假阳性，2 条是真的

我用仓库里**已有的正确调用方式**（根 `package.json:64` 的 `bun --bun node_modules/vitest/vitest.mjs`）复跑了这 5 个文件：

```
bun --bun ..\..\node_modules\vitest\vitest.mjs run \
  server/workspace-files/project-lock.test.ts \
  server/agent/tools/file-tools.test.ts \
  server/agent/profiles/profile-compile-worker.test.ts \
  server/agent/profiles/profile-compile-worker-lifecycle.test.ts \
  app/components/markdown-studio/tiptap --reporter=dot

 Test Files  2 failed | 5 passed (7)
      Tests  97 passed | 1 skipped (98)
```

| 文件 | `bun run test`（Node） | `bun --bun`（Bun） |
|---|---|---|
| `workspace-command.test.ts` | ❌ 7 failed | ✅ **7 passed**（单独复跑实跑过，2.74s） |
| `project-lock.test.ts` | ❌ 1 failed | ✅ passed |
| `file-tools.test.ts` | ❌ 2 failed | ✅ passed |
| `profile-compile-worker.test.ts` | ❌ 10 failed | ✅ passed |
| `profile-compile-worker-lifecycle.test.ts` | ❌ 1 failed | ✅ passed |
| 2 个 tiptap jsdom 文件 | ❌ 崩 | ❌ **还是崩**（`setup.ts:15`） |

**结论：21 条失败里 21 条都不是产品缺陷；真正的产品/基建缺陷是 `setup.ts:15` 那一处，它压着 2 个文件 0 条用例。**

### 2.4 分类处置建议（按优先级）

#### 🔴 P0 — 立刻修（1 处，1 行）

**修 `server/agent/test/setup.ts:15`。** 现状：

```ts
process.env.NEURO_BOOK_REPOSITORY_ROOT = resolve(fileURLToPath(new URL("../../../../", import.meta.url)));
```

在 jsdom 环境下 `import.meta.url` 是 `http://localhost:3000/...`，`fileURLToPath` 抛 `The URL must be of scheme file`。

建议改法（不改语义，只在非 file:// 时退回）：

```ts
const repoRoot = import.meta.url.startsWith("file:")
    ? fileURLToPath(new URL("../../../../", import.meta.url))
    : import.meta.dirname;          // 或 resolve(process.cwd()) —— 交给 GTF/Neo 定
process.env.NEURO_BOOK_REPOSITORY_ROOT = resolve(repoRoot);
```

> 注：`setup.ts:12-13` 的注释说"不允许从 `import.meta.dirname` 推断"，所以**不要无脑换成 `import.meta.dirname`**——要么走 `file:` 分支保原语义、非 file 时另找稳定来源，要么把 jsdom 用例排除在 setupFiles 之外（在 `vitest.config.ts` 里为 jsdom 文件单独 `environmentMatchGlobs` + 不同 setup）。**建议前者**，因为后者会让主应用永远分成两套测试世界。
> 本条只给方向，具体改法由实施者定（本次只读取证，未改代码）。

**收益**：主应用从此可以写组件渲染测试（`// @vitest-environment jsdom`），`HANDOFF.md:106` 那种"未经人眼确认"的缺口多了一条自动化的补法。

#### 🟠 P1 — 统一测试调用方式（消灭 19 条假阳性）

问题根源：同一个 vitest 配置，用 `bun run test` 和 `bun --bun node_modules/vitest/vitest.mjs` 跑，结果差 19 条。这是"红灯不可信"的头号来源。

建议（三选一，按侵入性递增）：
1. **最轻**：把 `packages/neuro-book/package.json:44` 的 `"test": "vitest run"` 改成 `"test": "bun --bun ../../node_modules/vitest/vitest.mjs run"`（与根 `package.json:64` 的 `test:desktop-contract` 写法一致）。**一行改动**，且 CI（`.github/workflows/code-baseline.yml:155` 的 `bun run --cwd packages/neuro-book test`）自动跟着变对。
2. 或者：给这 19 条用例加 `describe.skipIf(typeof Bun === "undefined")`，并登记 Issue 说明"真实 Bun 门禁在哪"。
3. 最重：把 Bun-only 用例搬到独立 config（RELEASE 0.9.6 就干过一次，`RELEASE.md` "将只在 Bun 运行时可执行的部署测试移出 Node 根测试套件"）。

**推荐 1**：一行、零风险、立刻让"红灯=真问题"。

> ⚠️ 推断（需要 GTF 复核一条命令）：CI 现在跑的是 `bun run --cwd packages/neuro-book test`（`code-baseline.yml:155`），而 `vitest.mjs` 的 shebang 是 `#!/usr/bin/env node`——**推断 Linux CI 上同样是 Node 跑 vitest，同样会 `Bun is not defined`**。也就是说 CI 大概率现在就是红的。
> **请 GTF 跑一次确认**：打开最近一次 Code Baseline 的 "Full tests" job 日志，grep `Bun is not defined`。如果是，`code-baseline.yml` 里没有 `continue-on-error`（全仓库 workflow 里 0 处，已 grep 确认），那它现在是**硬拦 PR**的。这一条优先级会被拉到最高。

#### 🟡 P2 — 显式 skip 并登记 Issue（0 条，当前无需）

本次实跑**没有任何一条**需要走"skip + 登记"这条路。所以"24 文件 / 78 失败要逐条 triage"这个预设工作量**不存在**——实际只有 1 个真 bug。

#### 🟢 P3 — 直接删（0 条，不建议）

没有建议删除的测试。反而要注意：`git grep` 显示全仓库 793 个测试文件、`packages/neuro-book` 478 个，但 vitest **只收集 474 个**——有约 4 个文件在 `include` 之外（推测是 `scripts/smoke/real-model/**` 被 `vitest.config.ts:64` 显式 exclude，属预期）。**不需要动**。

### 2.5 关于"红灯常态化"这个诊断本身

我要修正一下这个判断的适用范围：

- **CI 侧的红灯**：如果 P1 的推断成立，CI 现在是红的，且红的全是"调用方式"，**确实是"红灯≠真问题"**。修法就是 P1 的那一行。
- **本地侧的红灯**：HANDOFF/PROJECT-STATUS 里记的"78 失败"是**旧数字**（Task 143 时期，2026-08-14），本次实跑已经降到 21 且 21 条全假。**文档里的数字已经过期，建议同步更新 `PROJECT-STATUS.md:76`**。
- **真正的"红灯不可信"不在红灯，在绿灯**：3605 条绿灯里，**0 条是组件渲染测试、0 条是 E2E**。绿灯证明"这些纯逻辑函数是对的"，证明不了"界面能开、能写、写了不丢"。**这才是 §1 要解决的**。

---

## 3. 性能预算建议（224 章 / 322 场景规模）

### 3.1 现状取证

- 全仓库 **0 处** 性能预算：`.github/**` 与 `scripts/**` 里 grep `lcp|performance budget|fcp|tti|lighthouse` 无任何命中（只匹配到无关的 `setTimeout`/DLL）。
- CI 里没有 perf job（9 个 workflow 全查过）。
- 现有最近似的东西：`scripts/cli/warmup-dev-server.mjs`（只探活，不计时）、`scripts/build/measure-product-runtime-image.ts`（测**产物体积**，不是运行时性能）。
- 真实规模：224 章 / 322 场景 / 9 线索（`HANDOFF.md:144`；`PROJECT-STATUS.md:33` 记 294 场景，两处不一致，请以实际库为准）。

### 3.2 关键指标清单与预算数值

> 全部按**本地优先应用**定位：磁盘在本地、无网络 RTT，所以预算应比 Web 应用严格得多——用户对本地软件的"卡"零容忍。
> 单位 ms，**P95**，测量机 = GTF 的日常机（Windows，消费级 SSD）。

| # | 指标 | 预算（P95） | 红线（超过即 fail） | 为什么是这条 |
|---|---|---|---|---|
| P1 | **应用首屏可交互**（`goto` → `.novel-ide-page` 可见 + Activity Bar 可点） | **3,000 ms**（dev）；**1,500 ms**（Product） | dev 6,000 / Product 3,000 | dev 含编译，Product 不含；分开定，否则永远达不成 |
| P2 | **打开项目**（`POST /api/projects/open` → 章节列表渲染完成） | **2,000 ms** @224 章 | 4,000 ms | 224 章全量列表是最重的一次渲染 |
| P3 | **编辑器输入延迟**（单次 `keyboard.type` → DOM 文本更新） | **50 ms** | 120 ms | 打字是写作软件的命根子。>100ms 人手就能感觉到"黏" |
| P4 | **连续输入 200 字的主线程阻塞**（Longest Task） | **200 ms** | 500 ms | 抓"打快了整段卡住"——比 P3 更能暴露批量重排/autosave 抖动 |
| P5 | **剧情工作台渲染**（打开 `PlotWorkbenchDialog` → 4 个 tab 可点） | **2,500 ms** @322 场景 | 5,000 ms | 场景卡片 + 排序 + refs 解析都在这一屏 |
| P6 | **关键帧 tab 切换**（点「关键帧」→ 列表渲染完成） | **800 ms** | 1,500 ms | 自含数据加载（`PlotWorkbenchDialog.vue:439`），最容易写成"每次切 tab 都重新拉全量" |
| P7 | **World Engine 切片查询**（`execute_world` 读模式 / slice list） | **500 ms** | 1,000 ms | Agent 主链每次写作循环都要撞世界引擎，慢了整条链都慢 |
| P8 | **Agent SSE 首字节**（发起 → 收到第一个 event frame） | **3,000 ms**（不含 Provider 首 token） | 8,000 ms | 见 §4 的断连矩阵；首字节慢 + 无心跳 = 用户以为挂了 |
| P9 | **常驻内存**（首屏 + 打开 224 章项目后，稳定 60s） | **800 MB** | 1,200 MB | `vitest.config.ts:30-32` 承认"单 worker 内存显著抬高"，且 artifact 单体 27.3 MiB（`:34`）——主应用内存是有前科的 |
| P10 | **autosave 单次落盘**（正文变更 → 文件写完成） | **300 ms** | 800 ms | 直接决定"会不会丢字" |

### 3.3 最轻量的回归测量方式

**原则：不要上 Lighthouse / 不要上 Grafana / 不要建 perf 平台。GTF 是编程小白，维护不动。**

推荐做法：**一个 Playwright spec + 一个 JSON 基线文件 + 一个对比脚本**，全部塞进 §1 已建的 `e2e/` 目录。

```
packages/neuro-book/e2e/perf.spec.ts            ← 用 page.evaluate 读 Performance API
packages/neuro-book/e2e/perf-baseline.json      ← 基线（手工生成一次，之后人工确认才更新）
scripts/ci/compare-perf.ts                      ← 对比：超红线 = exit 1
```

`perf.spec.ts` 关键实现（约 40 行，全部用浏览器原生 API，零新依赖）：

```ts
// P1 首屏：用 Navigation Timing
const nav = await page.evaluate(() => {
    const e = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
    return {domContentLoaded: e.domContentLoadedEventEnd - e.startTime, load: e.loadEventEnd - e.startTime};
});

// P3/P4 输入延迟：打字前后打点 + Long Tasks API
await page.evaluate(() => {
    (window as any).__long = [];
    new PerformanceObserver((l) => (window as any).__long.push(...l.getEntries().map((e: any) => e.duration)))
        .observe({entryTypes: ["longtask"]});
});
const t0 = Date.now();
await page.keyboard.type(TEXT_200, {delay: 0});
const typeMs = Date.now() - t0;
const longest = await page.evaluate(() => Math.max(0, ...(window as any).__long));

// 结果写进 perf-current.json
```

`compare-perf.ts` 的逻辑只有三条：
1. 每个指标取 **5 次运行的 P95**（单次运行噪声太大，5 次是平民方案）。
2. 超「红线」→ `exit 1`（CI 红）。
3. 超「预算」但没超红线 → 打印警告，`exit 0`（不拦人，但看得见）。

**跑的频率**：**不要进 PR 必检**。建议：
- `workflow_dispatch` 手动跑（每周一次，或发版前一次）；
- 挂在 `product-platforms.yml` 的 **push to master** 分支上（该 workflow 只在 master 跑全平台，`product-platforms.yml:4-5`），这样不会拖慢 PR。

**为什么这个方案对 GTF 友好**：基线漂移时，他只需要看一条输出 `P3 编辑器输入延迟 62ms > 预算 50ms（红线 120ms，未拦截）`，然后决定"接受，更新基线"或"这是个 bug"。不需要理解 P95 怎么算的。

### 3.4 一个必须提醒的陷阱

`PROJECT-STATUS.md:34` 记载 `StoryKeyframe` 与 `StoryDecision` **当前都是 0 条**。也就是说：
- **关键帧相关的性能预算（P6）现在测不出真实值**——空列表永远 50ms。
- **必须先造帧素材**（`HANDOFF.md:107` 的 P1「真实模型尺度验证」已经把这条列为前置），否则 P6 的预算是自欺欺人。

---

## 4. canary → stable 发布准入清单（Go / No-Go）

### 4.1 现状取证

| 事实 | 证据 |
|---|---|
| 最新公开版本 `0.10.3-canary`（2026-09-14），**从未发过 stable** | `RELEASE.md:5`；`PROJECT-STATUS.md:87` |
| 每个 canary 都自带"限量 canary，升级前备份 State Root，先在可丢弃 Project 上测"的免责 | `RELEASE.md:24-25`、`45-46` 等多处 |
| 无代码签名 | `git grep -iE "code ?sign\|signtool"` 在 `scripts/`、`.github/workflows/` 下 **0 命中** |
| 无桌面自动更新器 | Manager 的 `updater.ts` 是**安装更新**（`updateInstallation`，Stage→Switch 安装新版本），不是 Electron/Tauri 应用内 updater；`PROJECT-STATUS.md:54` 明列"updater 未完成" |
| macOS 无实包（只有 Product tar.gz，无 .app/.dmg） | `PROJECT-STATUS.md:54`；`product-platform-matrix.ts:31-46` 有 darwin 构建但 PROJECT-STATUS 说"macOS 实包未完成" |
| SSE **无 `Last-Event-ID` / 无 `retry:` / 无心跳** | `server/agent/events/agent-sse-writer.ts:40-80` 全文件 grep 无命中；只设了 `cache-control: no-cache` 与 `x-accel-buffering: no` |
| 服务端**无 WebSocket upgrade 处理** | `git grep -i "upgrade"` + `websocket\|ws` 在 `server/` 下 **0 命中**（所以"WebSocket 断连矩阵"实际是 Desktop Bridge 侧议题） |
| 原生 Snap / 托盘 / 完整 crash 断连矩阵未完成 | `PROJECT-STATUS.md:73` |
| 真实 Provider / 真实外部模型未验收 | `PROJECT-STATUS.md:50` |
| 事务边界：FS / Project SQLite / History SQLite / Session JSONL / Job JSON **不承诺全局原子事务** | `PROJECT-STATUS.md:92`（明确"当前不引入分布式事务框架"） |

### 4.2 准入清单

> 图例：🔴 = 拦 stable（No-Go）　🟠 = 可发"公开 beta"但不够 stable　🟡 = 建议有

| # | 准入项 | 判定 | 现状 | **为什么这条拦着 stable** |
|---|---|---|---|---|
| 1 | **数据不丢**：224 章作品在"写 → autosave → 关 → 开 → 崩溃重启"全链路下零丢失 | 🔴 | 无自动化证据；`PROJECT-STATUS.md:92` 明确不承诺跨存储原子事务 | stable 的定义就是"用户敢把唯一一份书稿放进来"。本地优先应用一旦丢稿，损失不可逆、不可补偿、且**用户没法找客服**——这是 stable 与 canary 的分水岭。 |
| 2 | **升级不炸**：旧 State Root / 旧 Project `.nbook` 能无损升到新版本，且有回滚路径 | 🔴 | 每个 canary 都让用户"先备份、先在可丢弃项目上测"（`RELEASE.md:24-25`）= 官方自己没把握 | 同上。canary 可以让用户自己备份；stable 不能。**"升级须知里写着请先备份"这句话本身就是 No-Go 的证据。** |
| 3 | **代码签名 + 公开可信安装器** | 🔴 | 全仓库 0 处签名（`git grep` 实证） | Windows 上未签名 = SmartScreen 全屏警告 + 大量杀软误报。作者是编程小白的目标用户群更不可能"点更多信息→仍要运行"。**没有签名的"stable"会死在第一道弹窗上。** |
| 4 | **真实 Provider 端到端跑通至少 2 家**（含中断/续接/失败重试） | 🔴 | `PROJECT-STATUS.md:50` "真实 Provider …仍待做"；`HANDOFF.md:85` "真实 Provider 下是否真用指定模型：未验证" | 这是**产品的核心价值主张**。Agent 写作链路在真实模型下没跑通过，等于卖一台没试过发动的车。且 Provider 的失败模式（429/超时/半截响应）只有在真模型上才暴露。 |
| 5 | **SSE 断连可恢复**（`Last-Event-ID` 续播 或 显式重放；心跳保活） | 🔴 | `agent-sse-writer.ts` 无 `Last-Event-ID` / `retry` / 心跳（实证） | 长篇写作一次 Agent 运行十几分钟（`HANDOFF.md:142`：单轮 13–20 分钟）。**网络/休眠一抖就丢事件且无法续播 = 用户白等 20 分钟还丢内容。** 这在 canary 里是"已知问题"，在 stable 里是事故。 |
| 6 | **崩溃/强杀后的可恢复性矩阵**（kill -9 / 断电 / 磁盘满 / 长路径） | 🔴 | `PROJECT-STATUS.md:73` "完整 crash/disconnect 矩阵仍未完成" | 同 #1。长路径（`\\?\`）和 MSVC Runtime 都已专门修过（`PROJECT-STATUS.md:78`），说明这类边界**真实出过事**，不能只修已知的那几个。 |
| 7 | **主应用 E2E 覆盖 3 条主链路**（§1） | 🔴 | 0 条 | 见 §0：现在的"绿灯"证明不了"能写、写了不丢"。没有 E2E 就发 stable = 每发一版都是赌。 |
| 8 | **macOS 实包（.app/.dmg）真机验收** | 🟠 | `PROJECT-STATUS.md:54` "macOS 实包仍未完成"；CI 有 darwin 构建（`product-platform-matrix.ts:31-46`）但只出 tar.gz | 若 stable 只宣布覆盖 Windows，可降级为 🟠（限定平台发布）。**但必须在发布说明里写明"stable 仅 Windows"**，否则是误导。 |
| 9 | **应用内自动更新（updater）** | 🟠 | `PROJECT-STATUS.md:54` "updater 未完成"；Manager `updater.ts` 只做安装更新 | 没有 updater，安全修复推不出去。🟠 而非 🔴 的前提：**有可靠的手动升级路径 + 版本校验 + 明确的升级提示**。若手动升级也依赖用户看 changelog，则应升 🔴。 |
| 10 | **桌面端原生能力**（Snap Layout / 托盘 / 原生拖动 / WebView2 分发） | 🟠 | `PROJECT-STATUS.md:73` 明列未完成 | 影响体验与口碑，不直接造成数据损失。**Windows Portable 为主推形态的前提下可降为 🟠**（Portable 不走完整桌面安装路径）。 |
| 11 | **性能预算达标**（§3 的 P1/P2/P3/P5/P9） | 🟠 | 0 处预算（实证） | 达不成不会丢数据，但会在 224 章规模上"越用越卡"，而长篇小说写作恰恰是**越到后面章节越多**。发布后才发现就要带病运行很久。 |
| 12 | **typecheck 归零** | ✅ | **实跑 `bun run typecheck` → exit 0、0 条 `error TS`（30s）**。HANDOFF §3.19 的"剩 1 处"已随 `67d8cf18` 收编后消失 | 已达标，无需拦。列为清单项只为每发版前复跑一次，防止回归 |
| 13 | **安全审计闭环**（同批安全官的结论） | 🔴 | 见 gstack-security-officer 的产出 | stable 面向非技术作者，鉴权默认关闭（Windows Portable，`PROJECT-STATUS.md:64`）、SSE/本地 HTTP 面暴露，都需要安全侧签字。 |
| 14 | **文档与用户可见说明**：安装/备份/恢复/卸载各一份，且中英对等 | 🟡 | 有 vitepress 中英文档 | 不发 stable 也能活，但 stable 意味着"有人会把它当正经工具用"，没有恢复说明就是坑。 |

### 4.3 建议的发布路径（不直接跳 stable）

```
当前 0.10.3-canary
   ↓  先做 #7（E2E）+ #1/#2（数据不丢/升级不炸）+ #12（typecheck 归零）
0.11.0-beta（公开 beta，去掉"限量"，但仍要求备份）
   ↓  再做 #3（签名）+ #4（真实 Provider）+ #5（SSE 断连）+ #6（崩溃矩阵）
1.0.0-rc（发布候选，免备份，限定 Windows）
   ↓  再做 #8（macOS）+ #9（updater）+ #11（性能预算）
1.0.0 stable
```

**为什么不建议一步跳 stable**：现在离 stable 差的**不是功能，是"敢不敢让用户把唯一书稿托付给它"**。这个信任只能靠"数据不丢 / 升级不炸 / 崩溃可恢复"三类证据堆出来，没法靠功能补齐。

**如果 GTF 一定要快**，最小可行的"公开 beta"门槛是：**#1 + #2 + #7**（数据不丢、升级不炸、E2E 覆盖主链路）。这三条做完，就可以把"限量 canary"的帽子摘掉。（#12 typecheck 已经达标，不用等。）

---

## 5. 严重度汇总

| 级别 | 条数 | 内容 |
|---|---|---|
| 🔴 严重 | 4 | ① `setup.ts:15` jsdom 崩溃，压死主应用全部组件渲染测试能力（§2.4 P0）<br>② 主应用零 E2E、零组件渲染测试 —— 绿灯证明不了"能用"（§1）<br>③ 无性能预算，224 章规模的退化无法被发现（§3）<br>④ stable 准入有 7 条硬缺口，其中"数据不丢/升级不炸"无自动化证据（§4） |
| 🟠 重要 | 4 | ① 测试调用方式不统一（`bun run test` vs `bun --bun`），一次差 19 条假阳性（§2.4 P1）<br>② CI 大概率当前就是红的且硬拦 PR（推断，需 GTF 一条命令确认）<br>③ `PROJECT-STATUS.md:76` 的"24 文件 / 78 失败"数字已过期，会误导后续所有人<br>④ SSE 无 `Last-Event-ID`/心跳，长运行断连即丢事件（§4 #5） |
| 🟡 一般 | 3 | ① 无 macOS 实包、无应用内 updater（限定 Windows 发布可降级）<br>② 桌面原生能力（Snap/托盘/拖动）未完成<br>③ 关键帧性能预算当前测不出真实值（`StoryKeyframe` 为 0 条） |
| 🟢 良好 | 4 | ① 单元测试覆盖扎实：3605 条通过、474 文件，且**真实失败只有 1 处真 bug**<br>② `scripts/deploy/` 已有 3 个 playwright-core smoke 与成熟的 dev server 就绪探针，E2E 地基是现成的<br>③ `nb-ui` 的 playwright 配置 + `consoleGuard` fixture 是高质量样板，可直接照抄<br>④ **typecheck 已归零**（实跑 exit 0 / 0 错误） |

---

## 6. 本次验证的边界（跑不动的，说清楚）

| 项 | 状态 |
|---|---|
| 全量测试（474 文件 / 3630 用例） | ✅ 实跑完成，4m51s |
| 失败用例复跑（`bun --bun`） | ✅ 实跑完成，确认 19 条假阳性 + 2 条真 bug |
| typecheck | ✅ **实跑通过**：`bun run typecheck` exit 0、0 条 `error TS`、耗时 30s。HANDOFF §3.19 的"剩 1 处"已不存在 |
| CI（ubuntu）是否真的红 | ❌ 本机无 `gh`、无法查 GitHub Actions 日志，**推断为是**，需 GTF 确认 |
| 224 章真实项目 E2E / 性能实测 | ❌ 未跑——dev server 在本环境会被宿主回收（HANDOFF §5 已记载），且我无权启动长驻进程 |
| macOS / Linux 平台实际行为 | ❌ 未验证，全部为 Windows 实证 |

---

## 7. 给 GTF 的三句话

1. **你现在的测试不是不够，是"测的地方不对"**：3605 条绿灯里没有一条证明"界面能打开、能写字、写了不丢"。先补 3 条 E2E，比再写 300 条单元测试有用。
2. **"78 条失败"这个包袱可以扔掉了**：我实跑了，现在只有 21 条，而且 21 条全是你自己跑测试的方式不对（要用 `bun --bun`）造成的。真正要修的 bug 只有 1 个，在 `server/agent/test/setup.ts` 第 15 行，修完你就能写组件测试了。
3. **stable 差的不是功能，是"敢不敢让人把唯一一份书稿放进来"**。你现在每个版本都写"升级前请备份"——这句话就是答案：等哪天你敢把这句删掉，那就是 stable。
