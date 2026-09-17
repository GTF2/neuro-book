# 验收快照：目标修订上的全门禁实跑（stable 准入 A6）

- 文档性质：**验收证据**（不是提案、不是规范、不是方案）。用途：为 `docs/proposals/stable-release-admission.md` 的准入项 **A6「目标 stable 修订上 A1–A5 实跑全绿」** 提供一次具体、可复现的运行凭证。
- 目标修订（target revision）：`eeb18d8bf121a35b28c3b60e0a69dcb6b6d335ac`
- 分支：`feat/writing-doctrine-alignment`
- 跑测环境：Windows 11（MINGW64 / Git Bash），Bun `1.4.2`，Node `v22.22.2`
- 跑测时间：2026-09-17 约 17:00–18:20（+08:00）
- 执行者：QA（Edward），受主理人派单

---

## 一句话结论

本次从 CI 配置逐条抄出并真跑了本机可跑的门禁。**核心四道（治理 / 类型检查 / 全量单测 / 主应用 E2E）里，治理、类型检查、E2E 全绿，全量单测为红（2 条失败）。** 其余可跑门禁大多绿；少数红已逐条归因（多数是「本机缺件」造成的假红，1 条是真实失败）。另有 2 条门禁（`neuro-agent-harness` 的 `verify` 与 `pack:smoke`）在本机**挂起**，未能得出绿/红结论。

**因此 A6「全绿」目前不成立**：结论是 **「部分红 + 2 条本机无法完成」**。核心阻断项是一条真实失败的单测（`hardcoded-colors` 护栏）；这条不解决，A6 拿不到全绿。

> 纪律说明：本快照**没有**为了凑绿而放宽任何断言、跳过任何用例或改配置。红就是红。

---

## 1. 修订与工作区状态

| 项目 | 值 |
| --- | --- |
| 会话开始时 `HEAD` | `30b9a9e3cb541dd3fed25a1106fa8c7699a8a0c2`（2026-09-17T09:00:21Z 记录） |
| 门禁实际跑的修订 | `eeb18d8bf121a35b28c3b60e0a69dcb6b6d335ac` |
| 结束时 `HEAD` | `eeb18d8bf121a35b28c3b60e0a69dcb6b6d335ac` |
| 期间是否变化 | **在跑任何门禁之前变过一次**（并行会话提交），之后**全程未再变化**：所有门禁记录的 `HEAD_BEFORE` 与 `HEAD_AFTER` 均为 `eeb18d8` |

**关于 `30b9a9e → eeb18d8` 的差异（影响评估）**：

- 该区间只有 **1 个提交**：`eeb18d8b docs(adr): 复核 ADR 0015 §3（shared↔server/agent 类型环）——仍存在，附精确宽度`。
- `git diff --stat` 显示：**只改了 1 个文件、+2 行**，且是 `packages/neuro-book/docs/adr/0015-architecture-boundaries-and-deferred-structure.md`（纯文档）。
- 因是纯文档改动，对**代码类门禁（typecheck / 单测 / E2E / 治理）无影响**；对**文档类门禁（`docs:check` / `docs:build`）**本快照是在 `eeb18d8` 上跑的，已包含该改动。

**工作区状态**：

- 起始快照：1 个**在途已跟踪改动** ` M packages/neuro-book/package.json`（并行会话；`git diff` 显示**只新增了一条 npm script** `smoke:keyframe-scale`，未改任何依赖或既有脚本）；外加若干未跟踪文件（`deliverables/**`、`packages/neuro-book/scripts/smoke/keyframe-scale-experiment.ts`）。**本次所有门禁都带上这些在途改动一起跑**（即：门禁结果＝`eeb18d8` + 这些未提交改动）。
- 运行期并行会话仍在活动（期间出现新的未跟踪目录 `deliverables/ui-redesign-2026-09-17/themes/`）。
- **副作用（如实记录）**：跑 nb-ui 门禁 `bun run build:css` 后，工作区 `packages/nb-ui/dist/nb-ui.css` 显示为 ` M`，但 **`git diff` 为空**——属纯 CRLF/LF 换行归一化，**无内容变化**（`git diff --stat` 无输出）。

---

## 2. 门禁清单与逐条结果

**来源**均从 `.github/workflows/` 现读抄出（文件:行号）。「本机可跑」按本机（Windows/Bun，无 Docker、无 rg、无 PowerShell 7）判定。

### 2.1 `code-baseline.yml`（A1–A4 核心，PR 门禁）

| # | 门禁（命令原文） | 来源 | 本机可跑 | 退出码 | 通过/失败 | 耗时 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A1a | `bun run governance:check` | `code-baseline.yml:100-101` | 是 | **0** | `failures: []` | 3s | 绿 |
| A1b | `bun x tsc --noEmit -p scripts/tsconfig.json` | `code-baseline.yml:102-103` | 是 | **0** | — | 7s | 绿 |
| A1c | `bun x vitest run --config scripts/vitest.config.ts scripts/ci/agent-governance.test.ts scripts/ci/workspace-workflows.test.ts scripts/build/dockerfile-contract.test.ts scripts/build/nuxt-output-contract.test.ts` | `code-baseline.yml:104-105` | 是 | **0** | 182 passed / 0 failed | 29s | 绿 |
| A2a | `bun run --cwd packages/neuro-book generate` | `code-baseline.yml:124-125` | 是 | **0** | Prisma 客户端×2 | 1s | 前置，绿 |
| A2b | `bun run --cwd packages/neuro-book typecheck` | `code-baseline.yml:126-127` | 是 | **0** | — | 29s | 绿 |
| A3a | `bun run --cwd packages/neuro-book nuxt:prepare` | `code-baseline.yml:148-150` | 是 | **0** | Types generated | 2s | 前置，绿 |
| A3b | `sudo apt-get update && sudo apt-get install --yes ripgrep` | `code-baseline.yml:151-153` | **否（Linux 专用）** | — | — | — | 见 §5；本机 `rg` 缺失 |
| A3c | `bun --bun run --cwd packages/neuro-book test -- --reporter=dot` | `code-baseline.yml:154-159` | 是 | **1** | **3757 passed / 2 failed / 3 skipped**（488 文件） | 266s | **红**（详见 §4.1/§4.2） |
| A4a | `bun x playwright install --with-deps chromium` | `code-baseline.yml:186-188` | 部分（`--with-deps` 为 Linux） | — | — | — | 本机 Chromium 已装（`chromium-1234`）；`--with-deps` 不适用 |
| A4b | `bun run --cwd packages/neuro-book test:e2e` | `code-baseline.yml:189-193` | 是 | **0** | **12 passed / 0 failed** | 252s | 绿（隔离根，端口 3400/3401，Mock LLM 3499/3500） |

> A5（跨平台 Product 构建 + 原生验收，`product-platforms.yml` / `release-container.yml`）**本机不可跑**，见 §5。

### 2.2 `community-docs.yml`（社区/文档门禁）

| # | 门禁（命令原文） | 来源 | 本机可跑 | 退出码 | 通过/失败 | 耗时 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| D1 | `bun scripts/ci/validate-nitropack-patch.ts` | `community-docs.yml:86-87` | 是 | **0** | 1 份安装产物 | 1s | 绿 |
| D2 | `bun run --cwd packages/neuro-book nuxt:prepare` | `community-docs.yml:88-89` | 是 | **0** | — | （随 A3a） | 绿 |
| D3 | `bun scripts/ci/validate-community-files.ts` | `community-docs.yml:90-91` | 是 | **0** | 31 标签/5 Form/16 YAML | 0s | 绿 |
| D4 | `bun run docs:check` | `community-docs.yml:92-93` | 是 | **0** | `failures: []`，5616 文件 | 1s | 绿 |
| D5 | `bun run docs:build` | `community-docs.yml:94-95` | 是 | **0** | build complete | 4s | 绿 |

### 2.3 `workspace-packages.yml`（各工作区包门禁）

| # | 门禁（命令原文） | 来源 | 本机可跑 | 退出码 | 通过/失败 | 耗时 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| W1 | `bun run typecheck`（`packages/nb-history`） | `workspace-packages.yml:68-70` + `workspace-package-matrix.ts:14-16` | 是 | **0** | — | 1s | 绿 |
| W2 | `bun run test`（`packages/nb-history`） | 同上 | 是 | **0** | 49 passed | 19s | 绿 |
| W3 | `bun run test`（`packages/nb-workflow`） | `workspace-package-matrix.ts:18-21` | 是 | **0** | 103 passed | 2s | 绿 |
| W4 | `bun run typecheck`（`packages/nb-memory`） | `workspace-package-matrix.ts:23-26` | 是 | **0** | — | 1s | 绿 |
| W5 | `bun run test`（`packages/nb-memory`） | 同上 | 是 | **0** | 86 passed | 2s | 绿 |
| W6 | `bun run test`（`packages/nb-ui`） | `workspace-package-matrix.ts:28-31` | 是 | **0** | 264 passed | 5s | 绿 |
| W7 | `bun run typecheck`（`packages/nb-ui`） | 同上 | 是 | **0** | — | 8s | 绿 |
| W8 | `bun run build:css`（`packages/nb-ui`） | 同上 | 是 | **0** | — | 0s | 绿（有换行归一化副作用，见 §1） |
| W9 | `bun run build`（`packages/nb-ui`） | 同上 | 是 | **0** | — | 9s | 绿 |
| W10 | `bun run verify`（`packages/neuro-agent-harness`） | `workspace-package-matrix.ts:33-36` | 是（但**本机挂起**） | **未得出** | 无 | >10min（2 次） | **本机挂起**（见 §4.5） |
| W11 | `bun run pack:smoke`（`packages/neuro-agent-harness`） | 同上 | 是（但**本机挂起**） | **未得出** | 无 | >18min | **本机挂起**（见 §4.5） |
| W12 | `bun run verify`（`packages/llmlint`） | `workspace-package-matrix.ts:38-41` | 是**（须先装 web 依赖 + `nuxt prepare`）** | **0**（正确前置后） | 374 tests 全绿 | 11s | 绿（首次因缺前置而红，见 §4.3） |
| W13 | llmlint web island：`bun run typecheck` / `typecheck:server` / `build` | `workspace-packages.yml:72-104` | 部分 | **未单跑** | — | — | 见 §5（需要 web 依赖安装 + `nuxt prepare`，属另一 job） |

### 2.4 `desktop-envelope-contract.yml` / `product-platforms.yml` / `release-container.yml` / `release-manager.yml`（Microsoft 生态与发布门禁，本机可跑子集）

| # | 门禁（命令原文） | 来源 | 本机可跑 | 退出码 | 通过/失败 | 耗时 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R1 | `bun run manager:typecheck` | `desktop-envelope-contract.yml:61-62`、`release-manager.yml:47` | 是 | **0** | — | 3s | 绿 |
| R2 | `bun run manager:test` | `product-platforms.yml:107-109`、`release-container.yml:58-62` | 是 | **0** | 345 passed（+ release contract 4 passed） | 15s | 绿 |
| R3 | `bun run manager:pack` | `release-manager.yml:49` | 是 | **0** | tarball 生成 + 安装 smoke | 3s | 绿 |
| R4 | `bun run test:desktop-contract` | `desktop-envelope-contract.yml:59-60` | 是 | **0** | 61 passed | 1s | 绿 |
| R5 | `bun run --cwd packages/owned-process test` | `product-platforms.yml:110-112`、`desktop-envelope-contract.yml:74-76` | 是（Windows 腿） | **0** | 15 passed / 3 skipped(POSIX) | 2s | 绿 |
| R6 | `bun run product:policy:check` | `release-container.yml:54-55` | 是 | **0** | 5 平台 approved | 0s | 绿 |
| R7 | `bun run --cwd packages/neuro-book runtime:typecheck` | `release-manager.yml:45` | 是 | **0** | — | 10s | 绿 |
| R8 | `bun x tsc --noEmit -p scripts/tsconfig.json` + `bun run --cwd packages/owned-process typecheck` | `release-container.yml:50-53` | 部分 | **0**（scripts 部分）/ owned-process typecheck 未单跑 | — | — | scripts 部分见 A1b |
| R9 | `bun run test:install` | `release-container.yml:58-62`、`product-platforms.yml:104-106` | 是（但**本机缺件**） | **1** | 9 passed / **4 failed** / 9 skipped | 2s | **假红（本机缺 PowerShell 7）**，见 §4.4 |
| R10 | `bun test scripts/deploy/product-start.test.ts` | `release-container.yml:58-62` | 是 | **1** | 0 passed / **2 failed** / 1 skipped | 88s | **红（真实）**，见 §4.6 |
| R11 | `bun node_modules/vitest/vitest.mjs run --config scripts/release/release-assets-vitest.config.ts` | `release-container.yml:73-74` | 是（但**本机缺件**） | **1** | 31 passed / **1 failed** | 5s | **假红（GNU tar 不认 Windows `C:` 路径）**，见 §4.7 |
| R12 | Product start 生命周期 · Agent state root smoke（`product-agent-state-root-smoke.ts`） | `release-container.yml:63-72` | 是 | **未单跑** | — | — | 见 §5 |
| R13 | `manager:verify-public` | `release-container.yml:56-57` | 否（需 npm registry 网络） | — | — | — | 见 §5 |

---

## 3. 汇总

| 状态 | 条数 | 说明 |
| --- | --- | --- |
| ✅ 全绿 | **27** | A1a/A1b/A1c、A2b、A4b、D1–D5、W1–W9、W12、R1–R7 |
| ❌ 真实红 | **2** | A3c 全量单测（内含 1 条真实失败 `hardcoded-colors`）、R10 `product-start-test` |
| 🟡 假红（本机环境/缺件） | **2** | R9（缺 PowerShell 7）、R11（GNU tar 不认 Windows `C:` 路径）；另有 llmlint 首次红（缺 web 前置）已重跑转绿 → 见 §4.3 |
| ⛔ 本机挂起（未完成） | **2** | W10 `harness verify`、W11 `harness pack:smoke` |
| ⛔ 本机不可跑 | **1 组** | A5 跨平台 Product + 容器/发布类（多平台 runner / Docker / 凭证），见 §5 |

**A6 判定：不满足**（存在真实红，另有 2 条本机无法完成的门禁）。

---

## 4. 失败项详情与归因

> 归因口径：**真实红**＝代码/配置本身问题；**假红**＝本机环境缺件或平台差异；**假红-顺序敏感**＝整套跑红、隔离重跑绿（测试隔离问题）。每条都注明是否经重跑确认。

### 4.1 ❌ 全量单测 A3c — 失败 1：`scripts/checks/hardcoded-colors.test.ts`（真实红，确定性）

- 用例：`UI token 护栏：app/** 禁止新增硬编码颜色 > 存量不超过 baseline（禁止新增）`
- 现象原文（节选）：

  ```
  AssertionError: app/** 出现新增硬编码颜色（违反 app/utils/theme/README.md v2.1「禁止事项」）。
  新增文件出现硬编码颜色：
    styles/design-tokens.css → 4 处
        99: #ffffff
       100: #fdf6e3
       114: #000
  ```

- **归因**：**真实红、确定性**。`packages/neuro-book/app/styles/design-tokens.css` 是**已提交**（tracked）文件，由主题提交 `98517860 feat(theme): 补设计 token 层（刻度 + 角色映射）` 引入；而硬编码色护栏的放行清单 `scripts/checks/hardcoded-colors.ts` 的 `EXCEPTION_PATHS` 与基线 `hardcoded-colors.baseline.json` **都没有登记它**（`grep design-tokens` 在两个文件里均为 0 命中）。`design-tokens.css` 作为「设计 token 层」，本应与已放行的 `styles/theme-vars.css` 同类（token 定义处天然写死 hex）。
- **重跑确认**：**是**。隔离单跑 `bun --bun run --cwd packages/neuro-book test -- scripts/checks/hardcoded-colors.test.ts` → **退出码 1，稳定复现**（1 failed / 4 passed）。与并发写盘无关。
- 影响：A6 全绿的**直接阻断项**；属「新增门禁后，后续新文件未同步登记」的收口缺口。

### 4.2 🟡 全量单测 A3c — 失败 2：`server/api/workspace-files/llmlint-check.post.test.ts`（假红，顺序/污染敏感）

- 用例：`POST /api/workspace-files/llmlint-check > 目录目标返回 400，不调用 runner`
- 现象原文：`AssertionError: promise resolved "{ kind: 'check', … }" instead of rejecting`（期望 handler 对「目录目标」抛 400，实际返回了一次成功的 check 结果）。
- **归因**：**假红（整套顺序/模块 mock 污染）**，非源码缺陷。源码 `llmlint-check.post.ts:100-102` 明确 `if (node.isDirectory) throw createError({statusCode:400})`，逻辑正确；该用例用 `vi.doMock` **二次覆盖** `workspace-files`（`isDirectory:true`），在整套运行下覆盖未生效（拿到的是 `beforeEach` 的 `isDirectory:false`），故 handler 正常运行 runner 并返回结果。
- **重跑确认**：**是**。隔离单跑 `bun --bun run --cwd packages/neuro-book test -- server/api/workspace-files/llmlint-check.post.test.ts` → **退出码 0，5/5 全绿**（「首次红、重跑绿」）。属**测试自身隔离问题**（同文件重复 `doMock` 同一模块），不是产品行为回归。
- 备注：这正是 A6 的价值所在——「全量一起跑」才暴露的用例间耦合。

### 4.3 🟡 `packages/llmlint` verify — 首次红（缺前置），已重跑转绿

- 首轮命令：`bun run verify`（`packages/llmlint`），**退出码 2**，错误原文：
  `web/app/utils/llm-merge.ts(12,28): error TS2307: Cannot find module 'diff-match-patch' or its corresponding type declarations.`
- **归因**：**假红（本机缺前置）**。CI 的 `workspace-packages.yml:72-104`（llmlint-web job）在 verify 前会先在 `packages/llmlint/web` 里 `bun install --frozen-lockfile` + `bunx nuxt prepare`；首轮漏做。
- **重跑确认**：**是**。补齐前置（`bun install --frozen-lockfile` → 818 包；`bun x nuxt prepare`）后重跑 `bun run verify` → **退出码 0，374 tests 全绿**。
- ⚠️ 过程提示：脚本里我第一次误用 `bunx`（本机 PATH 无 `bunx`，仅 `bun x`），导致 `nuxt prepare` 返回 127、llmlint 测试出现 7 条 `Cannot find module '#shared/…'` 类失败；**改用 `bun x` 后即全绿**。这同样是「缺前置 → 假红」，与代码无关。

### 4.4 🟡 `bun run test:install`（R9）— 假红（本机缺 PowerShell 7）

- 现象：`4 failed / 9 passed / 9 skipped`，错误原文：`Error: spawn pwsh.exe ENOENT`。
- 失败 4 条均为 `Windows Stage 0 合同`（PowerShell 脚本语法有效 / Desktop 安装向导语法 / 离线 Bootstrap / 本机 Bun 授权）。
- **归因**：**假红（本机缺件）**。CI 的 `windows-latest` runner 自带 PowerShell 7（`pwsh`）；本机只有 Windows PowerShell 5.1，无 `pwsh.exe`。用例要求 `pwsh`。
- **重跑确认**：未重跑（缺件未变）；判定依据为 `ENOENT` 明确指向可执行文件缺失。

### 4.5 ⛔ `neuro-agent-harness` 的 `verify` 与 `pack:smoke` — 本机挂起（未完成）

- `bun run verify`（=`bun run typecheck && bun test --parallel=1`，见该包 `package.json`）：**两次**运行都在**同一位置**停住——日志停在 `tests/wait-follow-up-drain.test.ts` 最后一条 `(pass) … FollowUpDrainTimeoutError`（650 行）后**不再推进**；首轮截图 15 分钟无进展，重跑仍卡在同处（>10 分钟 650 行不变）。
- `bun run pack:smoke`（=`bun scripts/pack-smoke.ts`）：单独重跑 **>18 分钟无结果**，同样疑似挂起。
- **归因（已定位）**：**本机环境挂起（测试进程不退出）**，不是「有测试断言失败」。用单文件探针（每个 `timeout 150`）定位到：
  - `tests/wait-follow-up-drain.test.ts`：4 条用例**全部 pass**，但进程**不打印汇总、不退出** → 被 `timeout` 杀掉（**挂起**）。
  - `tests/wait-for-invocation.test.ts`：同样**超时被杀**（**挂起**）。
  - `tests/waiting-control-process.test.ts`：`2 pass / 0 fail`，进程**正常退出**（exit 0）。
  - `tests/waiting-resume-process.test.ts`：`1 pass / 0 fail`，进程**正常退出**（exit 0）。
- 即：挂起是**特定 "wait" 系列测试文件在跑完后进程不退出**（疑似未清理的 timer/handle/子进程），拖住 `bun test --parallel=1` 与 `pack:smoke`。**未能确认**是否在 CI（Linux）也会挂起；如实记为「本机未完成」。
- 建议：在 CI（Linux）或修复这两个文件的进程清理后重跑，再补进本快照。

### 4.6 ❌ `bun test scripts/deploy/product-start.test.ts`（R10）— 真实红（runtime 包扁平化断言）

- 现象：`2 failed / 0 passed / 1 skipped`；构建期报错原文：

  ```
  error: Nitro runtime package 无法扁平化：@vue/shared
      at assertRuntimePackageIdentity (scripts/build/nitro-runtime-module-specifier.mjs:124:19)
      at async normalizeRawRuntimeImports (scripts/build/product-runtime-bundle.ts:173:19)
  error: bun ../../scripts/build/patch-nitro-runtime-deps.mjs 退出码 1
  ```

- **归因**：**真实红（修订级依赖条件）**。该断言是仓库自有的发布前护栏（`nitro-runtime-module-specifier.mjs:107-127`）：要求 Product vendor 里的物理包版本 == 根 hoisted 版本，**不允许静默降级成错误版本**。本机 `node_modules` 出现：根 `@vue/shared@3.5.39` vs 嵌套（`@nuxt/nitro-server/node_modules`）`@vue/shared@3.5.42`。
- **关键证据**：`bun.lock` **同时**登记了 `@vue/shared@3.5.39`（1 处）与 `@vue/shared@3.5.42`（4 处），以及 `vue@3.5.39` 与 `vue@3.5.42`。即这是 lockfile 里的版本分裂，**不像是本机脏装**，**很可能在干净 `bun install --frozen-lockfile` 后与 CI 上同样复现**。
- **重跑确认**：未单独重跑（两次整套里均以同一断言失败，且与 lockfile 一致）。**待确认项**：建议在干净 `bun install --frozen-lockfile --linker hoisted` 后复跑，以排除本机 `node_modules` 陈旧因素。
- 影响：这是**发布前**门禁（A5/B 类），不阻断 A1–A4，但会阻断发布流水线；且它指向一个真实的依赖版本冲突。

### 4.7 🟡 `release-assets-vitest`（R11）— 假红（GNU tar 不认 Windows `C:` 路径）

- 现象：`31 passed / 1 failed`，失败用例：
  `Product Release宿主合同 > Release Manifest 从五平台归档写入 Runtime Image 身份，并把 manifest 最后发布`
- 错误原文：

  ```
  tar -czf C:\Users\…\artifacts\manifest\neuro-book-product-linux-x64-glibc.tar.gz -C C:\Users\…\metadata-linux-x64-glibc product-build.json，退出码 2
  tar (child): Cannot connect to C: resolve failed
  ```

- **归因**：**假红（平台/工具差异）**。本机 `tar` 是 **GNU tar 1.35**，会把 `C:\...` 当远程主机名（`Cannot connect to C:`）。CI 在 Ubuntu 上用 POSIX 路径，不触发。属 Windows + GNU tar 组合的已知陷阱，非代码缺陷。
- **重跑确认**：未重跑（缺件/差异未变）；判定依据为报错明确指向 tar 路径语义。

---

## 5. 未做与不可做的门禁（及所需条件）

| 门禁 | 来源 | 为什么本机跑不了 | 需要什么条件 |
| --- | --- | --- | --- |
| A5 五平台 Product 构建 + 原生验收 | `product-platforms.yml:74-151`、`release-container.yml:198-374`、`:449-836` | 需在**各自原生 runner**（windows-latest / ubuntu / ubuntu-24.04-arm / macos-15-intel / macos-15）上真机构建与浏览器验收 | 对应平台 runner + 浏览器 |
| 容器镜像构建 / 合并 / 发布 | `release-container.yml:76-181`、`:1228-1331` | 本机 **无 Docker**（`docker`/`podman` 均不可用），且需 ghcr 凭据 | Docker/Buildx + `GITHUB_TOKEN` + 仓库写权限 |
| 公开 payload / ghcr-podman 校验 | `release-container.yml:880-1101` | 需 ghcr 网络与 podman | ghcr 访问 + podman |
| npm 公开发布 Manager | `release-manager.yml:52-60` | 需 npm Trusted Publishing / OIDC 与 `manager-v*` tag | npm 凭据 + tag（且不可逆） |
| 五平台 Product runtime 测量 | `product-runtime-baselines.yml:13-54` | 跨平台 matrix + registration-gated | 各平台 runner |
| desktop macOS 合同腿 | `desktop-envelope-contract.yml:34-42` | 需 macos-15-intel / macos-15 | macOS runner |
| 文档部署 | `deploy-docs.yml:84-94` | 需 GitHub Pages 环境 | Pages 部署权限 |
| 真实模型端到端 | `docs/testing/README.md:80-91`（`test:real-model`） | 需真实 Provider 凭据（`DEEPSEEK_API_KEY`），CI 默认不跑 | 真实 API Key + 可选 dev server |
| `manager:verify-public` | `release-container.yml:56-57` | 需访问 npm registry 网络 | 网络（本机未验证是否可达） |
| Product agent state root smoke | `release-container.yml:63-72` | 未单跑（时间/优先级权衡） | 可随时补跑（本机可跑） |
| llmlint web island `typecheck/typecheck:server/build` | `workspace-packages.yml:72-104` | 未单跑（需 web 依赖 + `nuxt prepare`，属另一 job） | `bun install --frozen-lockfile`（web）+ `bun x nuxt prepare` |

**另：A3b `ripgrep` 与 A4a `playwright --with-deps`** 是 Linux CI 的**环境准备步骤**；本机 `rg` 缺失导致全量单测中 **1 条用例被 `skipIf` 跳过**（`file-tools.test.ts:966` 的 `it.skipIf(!hasRipgrep())`），这是**覆盖度差异**（CI 上会跑），**不是失败**。

---

## 6. 可复现说明（别人怎么照着重跑）

**前提**：

- Bun `1.4.x`、Node **24**（CI 用 24；本机实测 22 亦可跑，但建议对齐）。
- 干净安装：`bun install --frozen-lockfile --linker hoisted`（与 CI 一致）。
- 端口 **3400 / 3401 / 3499 / 3500 空闲**（e2e 两个隔离根 + 两个本地 Mock LLM）。
- **Chromium 已装**：`bun x playwright install chromium`（本机已有 `chromium-1234`；CI 用 `--with-deps`）。
- 若要跑 `test:install`：需要 **PowerShell 7（`pwsh`）**。
- 若要跑包含 `rg` 的用例：安装 **ripgrep**。
- 若要跑 llmlint：先在 `packages/llmlint/web` 执行 `bun install --frozen-lockfile` + `bun x nuxt prepare`。
- e2e 会自建隔离根（系统 Temp 下的 `neuro-book-e2e*`），**不碰真实 State Root**。

**建议顺序**（与 CI 的 job 依赖一致）：

1. `bun install --frozen-lockfile --linker hoisted`
2. `bun run --cwd packages/neuro-book generate`
3. `bun run --cwd packages/neuro-book nuxt:prepare`
4. 治理合同：`bun run governance:check` → `bun x tsc --noEmit -p scripts/tsconfig.json` → 工作流/Docker 合同 vitest（§2.1 A1c）
5. 类型检查：`bun run --cwd packages/neuro-book typecheck`
6. 全量单测：`bun --bun run --cwd packages/neuro-book test -- --reporter=dot`
7. 主应用 E2E：`bun run --cwd packages/neuro-book test:e2e`
8. 文档/社区：`bun scripts/ci/validate-nitropack-patch.ts`、`bun scripts/ci/validate-community-files.ts`、`bun run docs:check`、`bun run docs:build`
9. 工作区包：见 §2.3 各命令（llmlint 需先按上面前置）
10. Manager/发布前置子集：`manager:typecheck` / `manager:test` / `manager:pack` / `test:desktop-contract` / `owned-process test` / `product:policy:check`

**本快照的原始日志**：`%LOCALAPPDATA%\Temp\nbook-qa-a6\logs\*.out` 与 `results.tsv`（本机临时目录，不随仓库分发）。

---

## 7. 放置位置说明（为什么放这里）

本文件放在 **`deliverables/stable-admission-a6/`**，理由（依治理规范逐条比对）：

- `docs/proposals/README.md` 明确 Proposal 是「尚未生效的方案」，且**「不是过程日志」**——本快照是验收证据，放这里不合适。
- `docs/README.md` 的真相源分层里，`docs/testing/` 持有的是**「证据合同」**（规则），不是**证据本身**；把一次运行的原始证据塞进去会混淆「合同」与「产物」。
- `.agents/works/<work>/tasks/<task>/evidences/` 才是仓库**规范意义上的原始证据落点**（见 `.agents/works/README.md:42`），但它要求先按编号分配规则**登记一个 Work + Task**（需要唯一编号分配者串行登记与授权）——超出本次「只新建一份快照」的范围，也会动到治理身份。
- `deliverables/` 是本仓库实际使用的**交付物/证据桶**（同目录下已有 `gstack/full-review-…`、`theme-follow-token-pilot/`、`ui-redesign-…/` 等评审与验收产物）。它是未跟踪目录，新建子目录**不会**影响 `docs:check` / `governance:check`，也不会动他在途文件。

若后续 GTF 认可，建议把这份快照（或后续同类快照）迁移到对应 Work 的 `tasks/<task>/evidences/`，与 A6 的 Spec/Work 落点对齐。

---

## 8. 执行过程中的意外发现

1. **`HEAD` 在开跑前被并行会话推进了一格**（`30b9a9e → eeb18d8`，纯文档 +2 行）。本快照据实记录，并把目标修订钉在 `eeb18d8`；所有门禁 `HEAD_BEFORE/HEAD_AFTER` 一致，未再漂移。
2. **`neuro-agent-harness` 的测试/冒烟在本机挂起**（`verify` 卡在 `wait-follow-up-drain` 之后、`pack:smoke` >18 分钟无结果）。探针已定位：`wait-follow-up-drain.test.ts` 与 `wait-for-invocation.test.ts` **用例全过但进程不退出**（疑未清理的 timer/handle），而 `waiting-*` 两个文件能正常退出。**需在 CI 或修复后补测**——这也是「门禁存在 ≠ 能拿到结果」的又一实例。
3. **`bun.lock` 里 `@vue/shared`/`vue` 存在 3.5.39 与 3.5.42 双版本**，直接触发发布前 `product-start` 的 runtime 扁平化护栏失败。疑似真实的依赖版本分裂，**建议优先确认**。
4. **硬编码色护栏（`hardcoded-colors`）与 `design-tokens.css` 脱节**：护栏已进 CI，但后续新增的设计 token 文件未登记放行。属收口缺口。
5. **本机工具链缺件**：无 `rg`、无 `pwsh`、无 Docker/podman、无 `bunx`（仅有 `bun x`）；这会让若干门禁在**本机**呈现「红」，但在 CI 环境是绿——已在 §4 逐条区分。
6. **文档与代码略不同步**：`docs/proposals/stable-release-admission.md` 在 A4 处写「5 条 spec」，但 `packages/neuro-book/e2e/` 现有 **7 条 spec**（`01-editor … 07-agent-behavior`）。不影响结论，仅提示维护者同步。

---

## 9. 增量复验（rev `16ba8f30`）

> 本节是**追加记录**，不覆盖第 2–8 节的 `eeb18d8` 快照。目的是确认「上次红/挂起项在三个修复后是否转绿」，**只重跑这些项**，不做全量重跑。

### 9.1 复验时的修订与工作区（开跑前=收尾后，未漂移）

- `HEAD_BEFORE` = `HEAD_AFTER` = **`16ba8f304bc558ab7157914fe572f69165f8a2f8`**
- `git status --short`（复验时刻）：

```
 M packages/nb-ui/dist/nb-ui.css
 M packages/neuro-book/package.json
?? deliverables/gstack/
?? deliverables/stable-admission-a6/
?? deliverables/theme-follow-token-pilot/
?? deliverables/ui-redesign-2026-09-17/live-01-default.png
?? deliverables/ui-redesign-2026-09-17/live-02-workbench-full.png
?? deliverables/ui-redesign-2026-09-17/live-03-workbench-quiet.png
?? deliverables/ui-redesign-2026-09-17/themes/
?? packages/neuro-book/scripts/smoke/keyframe-scale-experiment.ts
```

> 相对上次快照，`HEAD` 从 `eeb18d8` 前进到 `16ba8f30`（即三个修复落地的修订）。`M packages/neuro-book/package.json` 与 `?? keyframe-scale-experiment.ts` 是并行会话在途改动（新增 `smoke:keyframe-scale` 脚本），与本批复验无关。

### 9.2 三个修复的落地提交

| 修复 | 提交 | 说明（team-lead 通报） |
| --- | --- | --- |
| 硬编码色护栏两类误报 | `d1a2420a` | CSS 注释中的颜色 + `var()` 兜底颜色；`design-tokens.css` 未改 |
| llmlint-check 测试隔离假红 | `7a8ad05c` | mock 覆盖 / 顺序隔离修正 |
| neuro-agent-harness 进程不退出 | `79ba7569` | 4 处 `.then` 收尾，令其可正常退出 |

### 9.3 逐项复验结果

| # | 复验项 | 命令 | 退出码 | 结果 | 用时 | 上次（`eeb18d8`） | 对比 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 硬编码色护栏 | `bun --bun run --cwd packages/neuro-book test -- hardcoded-colors` | **0** | 1 file / **5 passed** | 1.15s | 1 failed | ✅ 转绿 |
| 2 | llmlint（整包过滤） | `bun --bun run --cwd packages/neuro-book test -- llmlint` | **0** | 4 files / **70 passed** | 1.79s | 假红（顺序敏感） | ✅ 转绿 |
| 3 | llmlint（单文件对照） | `bun --bun run --cwd packages/neuro-book test -- server/api/workspace-files/llmlint-check.post.test.ts` | **0** | 1 file / **5 passed** | 1.32s | 5 passed | ✅ 稳定绿 |
| 4 | 主应用类型检查 | `bun run --cwd packages/neuro-book typecheck` | **0** | 无输出（`--logLevel silent`） | 32s | 绿 | ✅ 保持绿 |
| 5 | harness 自身测试 | `bun run test`（于 `packages/neuro-agent-harness`） | **0** | **529 passed / 0 failed**，94 files | **42.32s** | **挂起、无结果** | ✅ 修复确认，不再挂起 |
| 6 | 全量单测（复跑 3 次） | `bun --bun run --cwd packages/neuro-book test -- --reporter=dot` | **1** | 见 §9.4 | 277–307s | 2 failed | ⚠️ 剩 1 红（EBUSY） |

三个修复项（#1、#2、#5）**全部转绿**；#3、#4 为对照/回归，均绿。harness 从「挂起、拿不到结果」变为「**42.32s 干净退出**」，是本轮最实质的改善。

### 9.4 全量单测：剩余红项分析（EBUSY）

三次复跑：

| 复跑 | 退出码 | 结果 | 用时 | 失败用例（均在 `workspace-files.test.ts` teardown） |
| --- | --- | --- | --- | --- |
| 第 1 次 | 1 | **2 failed** / 3745 passed / 3 skipped (3764) | 306.08s | ①「Project Workspace mutation 后会重新读取文件与 issues」②「…会通过同一套 index 重建缓存」 |
| 第 2 次 | 1 | **1 failed** / 3760 passed / 3 skipped (3764) | 282.97s | ①「…后会重新读取文件与 issues」 |
| 第 3 次 | 1 | **1 failed** / 3760 passed / 3 skipped (3764) | 276.46s | ①「…后会重新读取文件与 issues」 |

**失败形态**（三次一致）——`afterEach` 清理临时目录时 `EBUSY`，重试 60 次仍失败后抛出：

```
FAIL  server/workspace-files/workspace-files.test.ts > workspace-files > Project Workspace mutation 后会重新读取文件与 issues
Error: EBUSY: resource busy or locked, rm 'C:\Users\ADMINI~1\AppData\Local\Temp\neuro-book\test-paths\workspace-files-test\<uuid>'
 ❯ removeTmpRootWithRetry server/workspace-files/workspace-files.test.ts:73:26
    73|  await fs.rm(target, {recursive: true, force: true});
 ❯ server/workspace-files/workspace-files.test.ts:90:19
```

**归因**：

1. **只命中 `workspace-files.test.ts` 一个文件的 `afterEach` teardown**，用例断言本身全部通过——不是业务逻辑红，是**清理阶段红**。
2. **3/3 复现**（失败用例集合一致，数量在 1–2 之间波动）→ **本机 near-deterministic**，不是偶发 flake。
3. 该测试文件在 `eeb18d8..16ba8f30` 之间 **`git diff` 为空**（未被三个修复改动）→ **不是修复引入的回归**；属本机 Windows 上**既有的临时目录 teardown 竞态**，被本轮修复带来的测试顺序/时序变化暴露得更稳定。
4. 触发的两个用例都涉及 **index 重建/缓存**，疑与其打开的文件句柄未及时释放有关；Windows 对「占用中文件」的删除比 Linux 严格，**大概率是本机（Windows）特有**。
5. 结论：这是**需在 stable 准入中单列的已知项**，但**不应阻断**——CI 是 Linux，`EBUSY` 语义不同，很可能不触发。

**建议（交工程师处置，本次只报告不改动）**：

- 排查上述两个 mutation 用例是否遗漏了文件句柄/守卫的释放（index 缓存相关）。
- 或将 `removeTmpRootWithRetry` 的 rm 失败**降级为非致命**（warning + 保留目录，交由系统临时目录清理），避免测试结果被环境噪音污染。
- 若需确证「是否 Windows-only」：在 CI（Linux）上跑同一全量单测即可判定。

### 9.5 `product-start` 的 `@vue/shared` 版本分裂（未修，按预期仍红）

- 根因（team-lead 已通报）：Vue 被钉在 `3.5.39`，而 Nuxt `4.5.1` 要求 `@vue/shared: ^3.5.40`；`nitro-runtime-module-specifier.mjs` 的 `assertRuntimePackageIdentity` 因此失败。
- 修复方向：升级 Vue ≥ `3.5.40` + 干净重装；但本机 `bun install` 会挂起（见 `HANDOFF.md`），故**本次未重跑**。
- 状态：**预期仍红**，与上次一致，待依赖升级后复验。

### 9.6 `packages/nb-ui/dist/nb-ui.css`：确认仍是「显示 M 但 diff 为空」

- `git status`：` M packages/nb-ui/dist/nb-ui.css`（显示已修改）。
- `git diff --stat` / `git diff`：**0 字节变更**（仅 `LF will be replaced by CRLF` 警告）。
- 字节对比：`HEAD` blob **111596** vs 工作区 **111598**（差 2 字节）。
- 判定：**纯 EOL（行尾）归一化，无任何内容变更** → **可跳过，无需提交**，不构成本次验收项。

### 9.7 复验证据与小结

- 原始日志：`%LOCALAPPDATA%\Temp\nbook-qa-a6\logs2\*.out`，汇总表 `results2.tsv`（本机临时目录，不随仓库分发）。
- 本批共 8 次门禁执行（6 项 + 全量单测复跑 3 次）：**修复项 5/5 绿**；**全量单测 3/3 均因同一 EBUSY 项非零退出**。
- **一句话结论**：三个修复全部验证通过（harness 从挂起变为 42s 干净退出）；上次的两类红（硬编码色、llmlint 假红）已消除；唯一剩余红是 `workspace-files.test.ts` 的 Windows teardown `EBUSY`（本机 near-deterministic、非修复引入、CI/Linux 大概率不触发），连同已知未修的 `@vue/shared` 版本分裂一并列入 stable 准入的「已知项」。
