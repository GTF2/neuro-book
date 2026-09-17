# Stable 准入清单（canary → stable 的放行条件）

状态：draft（待开发者 GTF 拍板）

> 本文件是**尚未生效的待决策提案**（依据 [`./README.md`](./README.md)：Proposal 把原始需求整理成问题、目标、备选方案和影响，用来决定「应该采用什么长期行为」；`draft`/`reviewing` 只供讨论，不能被代码、测试或 Agent 当作当前行文依据）。
>
> 本提案不改任何代码、不改任何已有文档、不改任何 Spec。文中的准入条件一旦被 GTF 采纳，才可据此创建 Spec / Work / Task 并在发布流程中强制执行。

---

## 一句话结论

产品从没发过 stable：`RELEASE.md:5` 当前是 `0.10.3-canary`，`vitepress/locales/zh-Hans/changelog/index.md:14` 明确「所有版本目前都带 `-canary` 后缀」。**发布工艺的「骨架」其实已经基本备好**（Draft-first 候选、五平台 Product + Windows Portable 构建与真机验收、跨清单版本升级、Manager 公开发布、版本号与 changelog 规则），但**三个「能不能发」的硬门槛**——**公开代码签名、macOS 签名公证 .app、后台 updater**——**完全没做**，而且**没有人证明过作者能用真实模型在真实浏览器里走完主流程**。所以这份清单的结论是：**机制层大多已就位，放行层还差得远；缺的不是「再加几个测试」，而是签名证书、macOS 环境、真实凭据和一轮真人验收。**

---

## 问题

1. **「什么条件才能从 canary 转 stable」没有文档回答**。全仓搜索 `stable` / `准入` / `转正`，`docs/` 下只有 `docs/testing/manual-eval/README.md`（人工评测体系）和 `docs/proposals/writing-experience-journey-metrics.md`（体验指标）沾边，**没有任何一份 stable 放行清单**。`docs/specs/README.md:148` 也把「Manager 与发布资产」列为 P1 规范缺口（「安装身份、manifest、资产、健康检查和发布门禁分散」）。于是每次讨论「能不能转 stable」都只能凭感觉。
2. **canary 与 stable 的差别没有定义**。`scripts/release/release.ts` 里 `stable` 子命令只比 canary 多做两件事：`prerelease: false`（`release-container.yml:1267-1276`）和额外绑定 `latest` tag（`release-container.yml:1324-1327`）。也就是说，**发布工具已经允许在「只差这条」的情况下把当前代码打上正式版**——这正说明必须有一份独立清单来补上「工具不检查、但人必须确认」的条件。
3. **验收缺口是已知且具体的**。`PROJECT-STATUS.md:87-90` 已经点明：stable / 公开签名 / 后台 updater / 正式 Desktop 未完成（:87）；聚焦测试、typecheck 和构建**不能代替**浏览器、真实 Project Workspace、真实 Provider/Model 与作者视角写作 smoke（:88）；原生 Snap、完整 SSE/WebSocket 断连矩阵、macOS 实包仍缺（:89）；下一阶段才是 dogfooding（:90）。本提案把这些散落的缺口**收敛成一份可逐条判定的放行清单**，不新造事实。

## 目标与非目标

### 目标

1. 给出一份**逐条可判定**的 stable 准入清单：每条写清「准入项 / 为什么是必要条件 / 现状 / 证据」四项。
2. 给出**分组**与**诚实的三态统计**（已满足 / 未满足 / 无法判定），让「离 stable 还有多远」有一个可对话的数字。
3. 明确区分**本机可验证**与**必须有外部条件**，并说明缺条件时本提案能推进到什么程度。
4. 给 `scripts/release/AGENTS.md` 与 `docs/standards/repository-workflow.md` 未来承接这份清单提供**待批的落点建议**（只建议，不修改）。

### 非目标

- **不定义「什么叫好小说」**，不裁决写作流程形态（写作宪法范畴，只有 GTF 能定）。
- **不把清单当成已生效规范**：它是提案，gate 条件需 GTF 拍板才算数。
- **不改代码、不改已有文档、不改 Spec**；本机不跑全量测试 / e2e（同仓有在途改动）。
- **不承诺日期、不写「建议尽快发布」**。
- 不重复 `docs/testing/manual-eval/`（人工评测）与 [`writing-experience-journey-metrics.md`](./writing-experience-journey-metrics.md)（体验指标）的正文，只引用。

## 当前行为与证据

发布流程与门禁的当前事实（全部来自只读调研）：

- **发布入口**：`bun run release -- <stable|canary|...>`，见 `scripts/release/release.ts:73-89`；`stable` 主流程 `scripts/release/release.ts:151-214`。
- **发布合同**：`scripts/release/AGENTS.md:8-13`（发布/推送/建 Release/删历史数据需 H3 批准）、`:11`（RELEASE.md 内容规则）、`:17-29`（RELEASE.md 段落格式）；授权总则在 `docs/standards/repository-workflow.md:72-74`。
- **候选与激活**：`packages/neuro-book/docs/adr/0012-release-candidate-activation.md:15-24`；实现于 `.github/workflows/release-container.yml`（assemble `:376-447`、公开上传 `:844-878`、公开校验 `:880-931`、publish-index `:1228-1276`、OCI alias 激活 `:1278-1331`）。
- **常规 CI 门禁**：`.github/workflows/code-baseline.yml`——治理合同 `:83-105`、typecheck `:107-127`、全量测试（Bun 运行时）`:129-159`、主应用 E2E `:161-202`。
- **跨平台 Product**：`.github/workflows/product-platforms.yml:74-151`；五平台构建与原生验收 `release-container.yml:198-374`、`:449-836`。
- **Manager 公开发布**：`.github/workflows/release-manager.yml:36-60`。
- **数据迁移**：`packages/neuro-book/docs/migrations/README.md:3-11`（policy `none` / `automatic` / `manual`）；合同校验 `packages/neuro-book-contracts/src/release.ts:61,104,151-174`。
- **真实模型 smoke**：`docs/testing/README.md:80-91`（`test:real-model`，需凭据，CI 默认不跑）。
- **人工评测体系**：`docs/testing/manual-eval/README.md:3`（「已转正……尚未经过真实评测轮次验证」）。

**三态口径（本文件统一口径）**：

- **已满足**：有可直接核对的证据（文件:行号，或命令与输出）。
- **未满足**：有明确的「尚未实现 / 尚未执行」证据。
- **无法判定**：缺执行条件或结果证据，判不了；必须写明为什么判不了。

> 注意：**「门禁已实现并被 CI 强制执行」= 已满足；「门禁在当前修订上全绿」是另一件事**，单列为 A6（2026-09-17 已实测，结论「未满足」，证据见 A6 行）。两者不能混为一谈。

---

## 准入清单

### A. 技术门禁

| # | 准入项 | 为什么是 stable 的必要条件（不满足的后果） | 现状 | 证据 |
| --- | --- | --- | --- | --- |
| A1 | 治理与仓库合同门禁在 CI 自动执行 | 治理规则（Task/Spec 归属、workflow 与 Docker 合同）漂移不会被拦截；stable 会带着已失效的协作合同对外 | **已满足** | `.github/workflows/code-baseline.yml:83-105` |
| A2 | 应用包 typecheck 门禁在 CI 自动执行 | 类型不闭合意味着公开接口/内部契约可能已不一致；stable 承诺接口稳定，类型错误不能带出去 | **已满足** | `code-baseline.yml:107-127` |
| A3 | 全量测试门禁（Bun 运行时）在 CI 自动执行 | 全量回归是「改动不再破坏既有行为」的最低保证；stable 面向所有用户，不能像 canary 那样携带已知回归 | **已满足**（仅指门禁已实现并被强制执行） | `code-baseline.yml:129-159`（`:154-159` 用 `bun --bun` 跑 vitest） |
| A4 | 主应用 E2E 冒烟门禁（Chromium）在 CI 自动执行 | 编辑器/关键帧/Agent/主题跟随/示例书等主链路坏掉时，单测仍可能全绿而浏览器里不可用 | **已满足** | `code-baseline.yml:161-202`；`packages/neuro-book/e2e/`（`01-editor` / `02-keyframe` / `03-agent` / `04-theme-follow` / `05-sample-book` / `06-perf-baseline` / `07-agent-behavior` 共 **7 条 spec**：主链路 5 条 + 性能基线 + Agent 行为锁） |
| A5 | 跨平台 Product 构建 + 原生验收门禁 | stable 承诺支持的平台必须在各自原生 runner 上真机产出并验收；只在本机构建等于没验证其它平台 | **已满足** | `product-platforms.yml:74-151`；`release-container.yml:198-374`、`:449-836` |
| A6 | 目标 stable 修订上 A1–A5 实跑全绿 | 「门禁存在」≠「门禁通过」。stable 放行必须绑定一次具体、可复现的全绿运行，否则「有门禁」只是摆设 | **未满足**（2026-09-17 已实测，结论：部分红 + 2 条本机挂起；非「无法判定」） | 实测快照：`deliverables/stable-admission-a6/acceptance-snapshot-2026-09-17-rev-eeb18d8.md`（钉在修订 `eeb18d8`）。**绿**：治理契约 182 用例、`governance:check`、scripts typecheck、主应用 typecheck、E2E 12 用例、`docs:check`、`docs:build`、manager 全组、nb-history / nb-workflow / nb-memory / nb-ui / llmlint、desktop-contract、product:policy。**2 条真红**：① 硬编码色护栏对 `design-tokens.css` 误报——**根因在护栏自身**（注释内色值与 `var()` 兜底值被误判），已修 `d1a2420a`；② `product-start.test.ts` 的 `@vue/shared` 版本分裂——**根因已查明，且不是 `bun.lock` 自相矛盾**：Vue 全家桶（`@vue/compiler-*` / `reactivity` / `runtime-*` / `server-renderer`）在 lock 里全部 pin 精确版本 `3.5.39`（其 `@vue/shared` 依赖也写精确 `"3.5.39"`），而 **Nuxt 4.5.1 自身的依赖**（`@nuxt/nitro-server` / `@nuxt/schema`）要求 `@vue/shared: ^3.5.40`——`^3.5.40` 与 `3.5.39` 不兼容，于是实际装出两个版本（根 `3.5.39` + 嵌套 `3.5.42`），Product 打包时无法扁平化。**本质是 Vue 版本落后于 Nuxt 期望**；修法为把 Vue 升到 ≥3.5.40 后跑一次干净的 `bun install --frozen-lockfile`——而本机 `bun install` 会卡死（见 `HANDOFF.md`），故本机不可确认。**2 条本机挂起**：harness `verify` / `pack:smoke`——已定位为 Bun 1.4.x 下 `expect().rejects` 与「同步 abort + 宏任务轮询落定」的运行时交互问题（有纯 `bun:test` 最小复现），**非产品缺陷**，已修 `79ba7569`。**环境性假红**（本机缺件，CI 不触发）：`test:install` 缺 pwsh 7、`release-assets` 的 GNU tar 把 `C:` 当远程主机。**本机不可跑**的门禁另有清单（五平台 Product 构建、容器 build/publish、npm 公开发布、macOS 桌面合同、`test:real-model` 等），见快照 §5 |
| A7 | 应用状态迁移声明与回滚路径 | 有状态升级若未声明迁移策略与回滚，用户升级可能丢数据且无法退回；stable 升级必须可回滚 | **已满足** | `packages/neuro-book/docs/migrations/README.md:3-11`；`packages/neuro-book-contracts/src/release.ts:61,104,151-174`（`none`/`automatic`/`manual` 语义校验） |

### B. 发布工艺

| # | 准入项 | 为什么是 stable 的必要条件（不满足的后果） | 现状 | 证据 |
| --- | --- | --- | --- | --- |
| B1 | 版本号语义：stable 用 `x.y.z`，且不得低于当前 `package.json` 版本 | stable 与 canary 若在版本号上不可区分，安装器/渠道无法判断「这是正式版」；版本倒退会让用户无法升级 | **已满足**（脚本已实现校验） | `scripts/release/release.ts:151-155,452-459,486-489` |
| B2 | changelog 覆盖自上次发布以来全部合并 PR，正文不得与上一版本相同 | stable 是正式对外交付，用户据此决定是否升级；漏记 PR 等于发布说明与实际变更不符 | **已满足**（规则明确） | `scripts/release/AGENTS.md:11,17-29`；`RELEASE.md:1-5` |
| B3 | 候选先 Draft、验收通过后才激活（OCI tag 激活为独立 job） | 完整资产未验收前若已对外可见，用户可能已下载「看得见但残缺」的正式版本 | **已满足** | `packages/neuro-book/docs/adr/0012-release-candidate-activation.md:15-24`；`release-container.yml:844-878,1228-1331` |
| B4 | 发布资产齐备：五平台 Product、Windows Portable、Source、容器镜像、`release-manifest.json`、`SHA256SUMS`、安装脚本 | stable 用户依赖这些资产安装；缺任一项会导致某平台用户无法安装 | **已满足**（流程已实现） | `release-container.yml:376-447` |
| B5 | 公开 Manager npm 包（含 provenance） | 安装/升级入口是 Manager；没有正式公开的 Manager 包，stable 安装链只能靠 canary 包 | **已满足** | `.github/workflows/release-manager.yml:36-60` |
| B6 | **公开代码签名（Windows 安装器 Authenticode）** | 未签名的安装器会被 SmartScreen 拦截、无法证明来源；用户与安全软件会拒装/告警。stable 对普通用户承诺「可放心安装」，签名是物理门槛 | **未满足** | `packages/neuro-book/docs/adr/0014-electron-desktop-productization.md:17,52,56`（明说首版不实现公开签名）；`PROJECT-STATUS.md:87`；`packages/neuro-book-contracts/src/` 中**无** `signature` 字段（grep 无命中） |
| B7 | **macOS 签名 + 公证 `.app` 实包** | 未签名/未公证的 `.app` 会被 Gatekeeper 直接拦下，用户无法正常打开；这是 macOS stable 的硬门槛 | **未满足**（注意：macOS **Product `tar.gz`** 已在 CI 构建并验收，但签名 `.app` 未做） | `packages/neuro-book/docs/adr/0013-desktop-envelope-distribution-and-interaction.md:92-94`；`PROJECT-STATUS.md:89`；对照 `release-container.yml:259-327` 只产出 darwin Product `tar.gz` |
| B8 | **后台 updater（自动更新）** | 无自动更新，stable 用户会长期停留在含已知缺陷的旧版本，安全修复无法下发 | **未满足**（Manager CLI 有 `update`，但那不是「后台/自动」updater） | `adr/0014-electron-desktop-productization.md:17,52`；`PROJECT-STATUS.md:87`；对照 `packages/neuro-book-manager/src/updater.test.ts`（CLI 侧 update 逻辑，非自动） |
| B9 | 跨安装清单版本的升级路径（复用完整用户数据） | 老版本用户必须能升到 stable 且不丢作品与配置；升级路径断了等于把老用户挡在门外 | **已满足**（CI 有真机验收：Manifest v3 → v5 复用完整 `data` + 登录 + 健康检查） | `release-container.yml:1103-1226` |
| B10 | stable 发布需开发者（H3/GTF）明确授权 | 发布是不可逆的公开动作，stable 会进入 `latest` 渠道，误发无法收回 | **已满足**（授权规则明确） | `scripts/release/AGENTS.md:6,10`；`docs/standards/repository-workflow.md:72-74` |

### C. 产品验收

| # | 准入项 | 为什么是 stable 的必要条件（不满足的后果） | 现状 | 证据 |
| --- | --- | --- | --- | --- |
| C1 | 主应用 E2E 冒烟覆盖主链路 | 作为产品验收的自动化底线（理由同 A4） | **已满足** | `packages/neuro-book/e2e/`；`code-baseline.yml:161-202` |
| C2 | **真实 Provider/Model 端到端验收** | 单测与 Mock 不能证明「接上真实模型能跑通」；Provider 合同、鉴权、流式、错误映射只有真调用才暴露。stable 用户第一天就会接真实 Provider | **未满足**（入口存在，但缺凭据、未跑） | `docs/testing/README.md:80-91`（`test:real-model` 需凭据，CI 默认不跑）；`PROJECT-STATUS.md:88` |
| C3 | **真实作者流程人工评测至少跑通一轮** | 自动门禁测不到「作者能不能顺利写完一章」；人工评测是 stable 前唯一能发现体验级阻塞的手段。stable 不能把未走通的体验带给所有人 | **未满足**（体系已建，尚无真实轮次） | `docs/testing/manual-eval/README.md:3` |
| C4 | 完整浏览器产品流程 + 真实 Project Workspace 验收 | 聚焦测试与构建不能替代真实浏览器里的完整产品流程；stable 的主场景就是「作者在浏览器/桌面里写作」 | **未满足** | `PROJECT-STATUS.md:88` |
| C5 | 数据安全与升级路径（备份/迁移/回滚）实跑 | 升级若会丢数据，stable 不能发 | **已满足** | `release-container.yml:1103-1226`；`packages/neuro-book/docs/migrations/README.md:3-11` |
| C6 | Desktop 完整 OS 级矩阵（原生 Snap、完整 SSE/WebSocket 断连矩阵、crash/disconnect） | 桌面 stable 在这些边界失败会表现为「点了没反应/窗口卡死」，而这恰是自动测试覆盖不到的 OS 级行为 | **未满足** | `PROJECT-STATUS.md:89`；`adr/0013-...md:103` |
| C7 | 真实文件系统行为（如 exFAT 120 秒租约） | 真实文件系统的锁/租约语义与测试临时目录不同；不一致会在多实例/可移动盘下导致数据损坏 | **无法判定**（本机无 exFAT 环境，未观测） | `RELEASE.md:40`（明说未在本机执行） |
| C8 | 持续作者试用 / dogfooding 反馈闭环 | stable 的价值取决于真实作者长期使用后的反馈；没有一轮持续试用就转 stable，等于用「没发现问题」代替「没去发现问题」 | **无法判定**（需时间与真实用户，属长期过程；`PROJECT-STATUS.md:90` 列为「下一阶段」） | `PROJECT-STATUS.md:90` |

---

## 本机可验证 vs 必须有外部条件

**本机已用只读证据核实（不依赖外部条件）**：A1–A5、A7、B1–B5、B9、B10、C1、C5 的**机制存在性**。

**必须有外部条件才能推进**（缺条件时本清单能推进到「确认未实现 + 排期」，但**不能**完成该项验收）：

| 准入项 | 需要什么条件 | 本机（Windows + 无签名凭据）能到哪一步 |
| --- | --- | --- |
| B6 签名 | Windows 代码签名证书 + CI 签名凭证 | 只能确认「未实现」，无法产出可信签名的安装器 |
| B7 macOS `.app` | Apple Developer 帐号 + macOS 签名/公证环境 | 只能确认未实现；本机无法构建或公证 `.app` |
| B8 updater | 依赖 B6/B7 的签名与分发链 | 无法提供可信更新源 |
| C2 真实 Provider | 真实 API Key（`.env` 白名单注入，见 `docs/testing/README.md:86`） | 可跑 Mock/链路，但真实调用结果无法验证 |
| C3 人工评测 | GTF 触发 + 人判定 | 体系就绪，但无结论 |
| C7 exFAT | 真实 exFAT 卷/设备 | 无环境，无法观测 |
| C8 dogfooding | 时间 + 真实用户量 | 无法在本机产生 |
| A6 全绿实跑 | 无干扰的干净窗口，或直接看 CI | 本机可跑，但派单要求不跑（同仓在途改动）；可在 CI 或空窗取得 |

**结论**：本清单可以用只读证据把「机制层」判完（15 项已满足），但**在当前条件下无法执行 canary → stable 的发布**——B6/B7/B8 是硬缺，C2/C3 未验证。

---

## 当前差距总览

| 分组 | 已满足 | 未满足 | 无法判定 | 小计 |
| --- | --- | --- | --- | --- |
| A. 技术门禁 | 6 | 1 | 0 | 7 |
| B. 发布工艺 | 7 | 3 | 0 | 10 |
| C. 产品验收 | 2 | 4 | 2 | 8 |
| **合计** | **15** | **8** | **2** | **25** |

**未满足的 8 项**：A6 全门禁实跑（2026-09-17 已有实测快照，见上）、B6 签名、B7 macOS 公证包、B8 后台 updater、C2 真实 Provider、C3 人工评测、C4 完整浏览器流程、C6 Desktop OS 级矩阵。
**无法判定的 2 项**：C7 真实文件系统、C8 dogfooding。
**A6 本轮的变化**：从「无法判定」推进到「**未满足、但有实测证据**」——快照在固定修订上真跑了全部可跑门禁，并把 2 条真红中的 1 条（护栏误报，根因在护栏自身）与 2 条本机挂起（Bun 运行时交互）当场修掉；剩余 1 条真红（`@vue/shared` 版本分裂）需一次干净的 `bun install --frozen-lockfile` 才能确认，本机不可做。
**结论**：机制层（A/B 的大头）基本就位；**放行层的 7 项缺口全部集中在「签名与平台实包」「真实模型与真人验收」**，没有一项是「再加几个单测」能补的。

---

## 方案、备选方案和取舍

**方案（建议）**：把上面的 25 项作为 stable 放行的**唯一检查清单**；发布前由发布执行者逐项核对并留证；**A6 与 B6/B7/B8 未满足时，禁止把 `prerelease` 置为 `false`**（即禁止走 `stable` 分支）。

**备选方案**：

1. **继续只发 canary**——取舍：无风险，但永远不满足 `PROJECT-STATUS.md:87` 的 stable 缺口，用户始终拿不到「正式版」承诺。
2. **直接发 stable，把签名/updater 留到之后**——取舍：会被本清单判为违规；未签名安装器会被 SmartScreen 拦截，等于把安装失败风险推给用户。**不推荐**。
3. **只做「本机可验证」的 15 项就放行**——取舍：会跳过 B6/B7/B8/C2/C3/C6 这四个「用户第一时间就会撞上」的缺口；省事但把风险外推。**不推荐**。
4. **把本清单降级为「建议清单」而不作硬门禁**——取舍：回到问题 1 的起点，等于没有放行标准。**不推荐**。

**取舍**：本提案选择「先定清单、再补缺口」——因为清单本身不需要外部条件即可产出（本文已完成），而缺口项需要证书/机器/真人才可补，先把标准定下来，补缺才有验收依据。

## 影响（数据、接口、安全、迁移、发布与回滚）

- **数据/迁移**：清单复用既有 `stateMigration` 声明（A7）与跨清单升级验收（B9/C5），不新增迁移格式。
- **接口**：不新增公开接口；`release.ts` 的 `stable` 子命令行为不变（本提案只约束「何时允许调用它」）。
- **安全**：B6/B7（签名）与 C2（真实 Provider 凭据处理，见 `docs/testing/README.md:86` 的隔离与 `0600` 收紧）是安全相关硬门槛。
- **发布与回滚**：把 A6/B6/B7/B8 设为「禁止置 `prerelease=false`」的阻断条件；若误发，按 `release.ts:12-13` 的既有判断流程处理（检查工作区/最近提交/package 版本，用 `gh release view` 判断是否已完成），不新增回滚机制。

## 对 Spec 的预期改动

本提案**本身不写成 Spec**（它是待决策的放行标准，不是产品可观察行为）。若 GTF 采纳，建议：

1. 在 `docs/standards/` 下新增/扩展**发布门禁**正文（承接 `docs/standards/repository-workflow.md:72-74` 的「发布授权」），把本清单固化为官方门禁；
2. 同步 `scripts/release/AGENTS.md:8-13` 的发布流程，把 A6/B6/B7/B8 写成脚本层前置校验（若可自动化）；
3. 对应 `docs/specs/README.md:148` 的 P1 规范缺口「Manager 与发布资产」，把「安装身份、manifest、资产、健康检查」的当前合同补成 `implemented` Spec（本提案只提清单，不替它写正文）。

## 决策记录

| 日期 | 决策者 | 结论 |
| --- | --- | --- |
| 2026-09-17 | （待填）GTF | **待决策**：本清单能否作为 stable 放行的正式门禁；25 项取舍是否接受；是否授权据此创建 Spec / Work / Task |

---

## 附：本次调研读取的文件

`RELEASE.md`、`PROJECT-STATUS.md`、`docs/README.md`、`docs/AGENTS.md`、`docs/proposals/README.md`、`docs/proposals/writing-experience-journey-metrics.md`、`docs/proposals/p-005-development-workflow-governance.md`、`docs/standards/README.md`、`docs/standards/repository-workflow.md`、`docs/specs/README.md`、`docs/testing/README.md`、`docs/testing/manual-eval/README.md`、`docs/modules/monorepo-boundaries.md`、`scripts/release/AGENTS.md`、`scripts/release/release.ts`、`scripts/ci/check-documentation.ts`、`package.json`、`.github/workflows/code-baseline.yml`、`.github/workflows/release-container.yml`、`.github/workflows/release-manager.yml`、`.github/workflows/product-platforms.yml`、`.github/workflows/product-runtime-baselines.yml`、`packages/neuro-book/package.json`、`packages/neuro-book-manager/README.md`、`packages/neuro-book-manager/src/updater.test.ts`、`packages/neuro-book-contracts/src/release.ts`、`packages/neuro-book/docs/adr/0012/0013/0014`、`packages/neuro-book/docs/migrations/README.md`、`vitepress/locales/zh-Hans/changelog/index.md`、`vitepress/locales/zh-Hans/changelog/v0.9.md`、`vitepress/locales/zh-Hans/changelog/v0.8.md`、`.agents/tasks/105-unified-installation-manager/README.md`、`.agents/tasks/145-electron-desktop-productization/README.md`。
