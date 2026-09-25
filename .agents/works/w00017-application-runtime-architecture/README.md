---
schema: nbook.work/v1
workId: w00017-application-runtime-architecture
issueId: null
---

# 应用运行时与内置插件架构

## 当前结论与授权

2026-09-20 开发者接受基础架构与分段推进方向，并要求先完成规范与实施规划：

1. 第一实现切片止于**环境适配入口 + 小内核**，必须可验证、代码规范、能适配不同宿主与作用域。
2. 第二切片以内置服务插件检验地基；当前最小真实集合为**诊断、平台文件、SQLite**。其它应用服务随首次真实功能消费接入，不先搬完所有后台。
3. 后续按**外部插件开发者视角**推进 Lab → Files → Settings → World/Plot，不把第三方市场/SDK/沙箱引入当前范围。
4. 开发者要求先等 w00003 合并 master 再创建 w00017 worktree；该条件已于 `bb688931`（Merge branch `refactor/w00003-nb-ui-adoption` into master）满足，实现 worktree 已创建，t05–t09 已按批准的实施计划执行。

规范、Work、整体路径、Task 与审查证据在主线提交 `bc144b2d`。当前实现分支完成第一片（t05–t09）与第二片（t10–t13）：七项 Spec 均已晋升 `implemented`；第三片 [t14 Lab 宿主边界](tasks/t14-lab-host-boundary/README.md) 将 LabShell 常驻产品命令宿主收回命令场景，直接打开 `/lab` 跳过产品配色与旧桶迁移，保持 Lab 自有检视和偏好。产品启动链、产品日志器与既有数据库仍走旧入口；未执行产品接线、push、PR、合并、人工浏览器／真实模型验收。开发者 2026-09-23 决定首两片一起合；第三片按方案 B 继续本地实施，本地原子提交自主进行，push、PR、合并仍需授权。

## 规范与实施入口

- [总体提案](../../../packages/neuro-book/docs/proposals/application-runtime-and-plugins.md)：`accepted` 为基础架构与分段方向；任意热卸载/代码升级仍仅评估，未纳入当前实施。
- 第一片 `implemented`：[runtime.lifecycle](../../../docs/specs/runtime/lifecycle.md)、[runtime.services](../../../docs/specs/runtime/services.md)、[runtime.plugins](../../../docs/specs/runtime/plugins.md)、[runtime.application](../../../docs/specs/runtime/application.md)（受控装配入口；产品启动链尚未迁入）。
- 第二片 `implemented`：[runtime.diagnostics](../../../docs/specs/runtime/diagnostics.md)、[platform.files](../../../docs/specs/platform/files.md)、[platform.sqlite](../../../docs/specs/platform/sqlite.md)（真实服务插件；产品日志器与既有数据库尚未迁入）。
- [整体实施路径](implementation-plan.md)：各切片模块、文件边界、依赖、实际smoke、旧入口退出与worktree前提；是工程计划，不复制行为合同。
- 既有命令、Storage、Lab、Workbench等能力沿同一Spec修订，不建“插件版”副本。

## 当前 Task 与继续条件

| Task | 当前范围 |
|---|---|
| [t01](tasks/t01-architecture-proposal/README.md) | 已完成架构提案与 B/S 追加设计的历史交付 |
| [t02](tasks/t02-runtime-contract-review/README.md) | 独立运行时／资源合同复核；各轮报告分开 |
| [t03](tasks/t03-document-governance-review/README.md) | 独立读者／治理与计划可执行性复核 |
| [t04](tasks/t04-foundation-spec-plan/README.md) | 当前规范、整体实施方案与治理集成 |
| [t05](tasks/t05-runtime-lifecycle/README.md) | 首个实现单元：资源生命周期机制与独立验证入口；已提交 `a03c7169`、`3defd3dc`，`runtime.lifecycle` 保持 `planned` |
| [t06](tasks/t06-runtime-services/README.md) | 第二实现单元：服务装配与依赖解析；已提交 `c8d7000e`、`b7e7b41c`，`runtime.services` 保持 `planned` |
| [t07](tasks/t07-runtime-plugins/README.md) | 第三实现单元：插件描述、激活与贡献事务；机制、合同测试、smoke 已通过并提交，`runtime.plugins` 保持 `planned` |
| [t08](tasks/t08-runtime-application/README.md) | 第一片收口单元：`runtime.application` 内核、后端／浏览器适配器与 `smoke:runtime-foundation`；测试、typecheck、真实子进程与真实 Chromium smoke 已通过并提交 |
| [t09](tasks/t09-foundation-integration-review/README.md) | 首片集成复核：逐条对照四项 Spec，修复有界停止、实例身份退役等缺口（`4d0b3c84`、`728acd40`、`b53753b9`），经独立 Reviewer 复核后四项 Spec 晋升 `implemented` |
| [t10](tasks/t10-runtime-diagnostics/README.md) | 第二片：诊断记录能力与插件、JSONL/console 出口；产品日志器共用 JSONL 写入与脱敏 |
| [t11](tasks/t11-platform-files/README.md) | 第二片：受根约束的文件能力插件（授予、包含校验、watch、锁、关闭门禁） |
| [t12](tasks/t12-platform-sqlite/README.md) | 第二片：受管 SQLite 机制插件（具名资源 owner、借用、事务、代次） |
| [t13](tasks/t13-services-integration-review/README.md) | 第二片集成复核：`--services` 组合 smoke、逐条对照三项 Spec、修复插件释放重试等缺口后晋升 `implemented` |
| [t14](tasks/t14-lab-host-boundary/README.md) | 第三片：Lab 文档启动边界、命令场景局部宿主、四个检视 tab、core 浏览器 smoke 与 w00016 交接 |

后续单元在整体路径中规划，不预建依赖未知实现结果的 Task 链。第一片与第二片已闭合；Lab 第三片的专项证据与完整组合 smoke 既有失败见 t14。产品装配接线随首条真实链（Files）迁移旧入口，诊断出口接管产品日志位置、workspace-files 消费 platform.files。Task completed 不等于整个产品完成。

## 执行位置与版本

实现 checkout：`.worktree/w00017-application-runtime-architecture`，分支 `refactor/w00017-runtime-foundation`，基线 `411449ec4c1fbc57cceaeb7aa9d2385132a0d3e0`（master，含 w00003 合并 `bb688931` 与本 Work 七项 Spec 提交 `bc144b2d`）。分支上依次有 t05 提交 `a03c7169`、`3defd3dc`，t06 提交 `c8d7000e`、`b7e7b41c`，规则调整 `e457375d`，t07 提交 `e6ef6f19`、`492bc849`，t08 提交 `0e938172`、`2a17e85f`，t09 提交 `4d0b3c84`、`728acd40`、`b53753b9` 与文档提交 `d8956662`、`eeeec16b`，t10–t13 第二片提交。各 Task 的 `governance:context` 在该 checkout 核实身份，原始输出见各自 evidences。

Work／Task 进度只在实现分支维护；主工作区保持 `master`，其 Work 目录副本是 `bc144b2d` 的占号记录，不回填进度、不在主树切分支。登记按 [编号合同](../README.md#编号分配与记录位置) 本地协调，不要求独立登记 PR 或非 squash 祖先关系。

## 不变的产品边界

- 必需服务可插件化，首批随产品发布，不支持任意在线卸载/替换。
- 显式关闭先协商dirty/在途工作；强制退出不保证保存；窗口离开不关闭共享后台Project/Job。
- 服务实例寿命不等于持久记录寿命；不改变现有用户格式、数据库布局或迁移策略。
- 小内核不依赖具体领域、框架、文件/数据库驱动；代理/服务发现不代替服务端授权。
- Lab只做组件展示与局部显式依赖，不形成第二产品宿主或通用插件Lab。
- 不修改产品/fixture/依赖/CI/发布，不执行远端Issue/Project/PR写入；`issueId: null`，未取得远端编号。

## 质量与证据

纯文档检查链接、结构、capability唯一性、成熟度与批准边界，并用独立Reviewer反证生命周期/资源/依赖合同和实施计划。t05、t06、t07 的机制验证为应用包 `test:runtime-foundation`、`typecheck:runtime-foundation`、各一次临时 smoke；t08 追加 `smoke:runtime-foundation` 在真实子进程与真实 Chromium 各跑一次；t09 另跑包级全量 `bun run test`（失败均为 master 既有，见 [t09 证据](tasks/t09-foundation-integration-review/evidences/full-suite.txt)）、`nuxt typecheck`，并由独立 Reviewer 复核四项 Spec 晋升；t13 追加 `smoke:runtime-foundation -- --services` 组合真实子进程 smoke 与日志器/脱敏消费方回归（见 [t13 证据](tasks/t13-services-integration-review/README.md#验证命令与结果)）。每个 Task 另有仓库根 `docs:check` 与 Task `governance:context`。build、人工浏览器验收、迁移和Provider不属于已运行项。

规划阶段 `governance:check` 的两项失败见 [原始输出](tasks/t01-architecture-proposal/evidences/governance-check-tracer.txt)：w00003/t14缺README、根AGENTS固定标记不匹配。前者已由主线 `34c3d5db` 补齐；本 Work 未重跑全仓 `governance:check`，不宣称全仓治理通过。

历史交付（不作本轮新Spec验证）：
- 首轮 [审查处理](tasks/t01-architecture-proposal/walkthroughs/review-resolution.md)、[质量基线](tasks/t01-architecture-proposal/walkthroughs/quality-baseline.md)。
- B/S追加 [源码调查](tasks/t01-architecture-proposal/walkthroughs/tracer-design.md)、[审查处理](tasks/t01-architecture-proposal/walkthroughs/tracer-resolution.md)、[文档门禁](tasks/t01-architecture-proposal/evidences/docs-check-tracer.txt)。

本轮新审查分别写 t02/t03 的 `walkthroughs/foundation-review.md`；t04 记录处理与最终质量证据，不用旧报告为新Spec背书。

本轮规范规划的处理与验证入口：[t04交付记录](tasks/t04-foundation-spec-plan/walkthroughs/foundation-resolution.md)、[身份检查](tasks/t04-foundation-spec-plan/evidences/context-checks.txt)。实现单元的公开接口、验证结果与未运行项见各自快照：[t05](tasks/t05-runtime-lifecycle/README.md)、[t06](tasks/t06-runtime-services/README.md)、[t07](tasks/t07-runtime-plugins/README.md)、[t08](tasks/t08-runtime-application/README.md)；首片复核结论见 [t09](tasks/t09-foundation-integration-review/README.md)；第二片见 [t10](tasks/t10-runtime-diagnostics/README.md)、[t11](tasks/t11-platform-files/README.md)、[t12](tasks/t12-platform-sqlite/README.md) 与复核 [t13](tasks/t13-services-integration-review/README.md)；Lab 第三片见 [t14](tasks/t14-lab-host-boundary/README.md)。
