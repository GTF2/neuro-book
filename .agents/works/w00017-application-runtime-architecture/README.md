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
4. 开发者要求先等 w00003 合并 master 再创建 w00017 worktree；该条件已于 `bb688931`（Merge branch `refactor/w00003-nb-ui-adoption` into master）满足，实现 worktree 已创建，t05 已按批准的实施计划执行。

规范、Work、整体路径、Task 与审查证据在主线提交 `bc144b2d`。当前实现分支只做 t05；未执行 services／plugins／环境适配、产品接线、push、PR、合并、迁移或浏览器／真实模型验收。提交授权限于本地实现分支上的原子提交。

## 规范与实施入口

- [总体提案](../../../packages/neuro-book/docs/proposals/application-runtime-and-plugins.md)：`accepted` 为基础架构与分段方向；任意热卸载/代码升级仍仅评估，未纳入当前实施。
- 第一片 `planned`：[runtime.lifecycle](../../../docs/specs/runtime/lifecycle.md)、[runtime.services](../../../docs/specs/runtime/services.md)、[runtime.plugins](../../../docs/specs/runtime/plugins.md)、[runtime.application](../../../docs/specs/runtime/application.md)。
- 第二片 `planned`：[runtime.diagnostics](../../../docs/specs/runtime/diagnostics.md)、[platform.files](../../../docs/specs/platform/files.md)、[platform.sqlite](../../../docs/specs/platform/sqlite.md)。
- [整体实施路径](implementation-plan.md)：各切片模块、文件边界、依赖、实际smoke、旧入口退出与worktree前提；是工程计划，不复制行为合同。
- 既有命令、Storage、Lab、Workbench等能力沿同一Spec修订，不建“插件版”副本。

## 当前 Task 与继续条件

| Task | 当前范围 |
|---|---|
| [t01](tasks/t01-architecture-proposal/README.md) | 已完成架构提案与 B/S 追加设计的历史交付 |
| [t02](tasks/t02-runtime-contract-review/README.md) | 独立运行时／资源合同复核；各轮报告分开 |
| [t03](tasks/t03-document-governance-review/README.md) | 独立读者／治理与计划可执行性复核 |
| [t04](tasks/t04-foundation-spec-plan/README.md) | 当前规范、整体实施方案与治理集成 |
| [t05](tasks/t05-runtime-lifecycle/README.md) | 首个实现单元：资源生命周期机制与独立验证入口；机制、合同测试、smoke 已通过，`runtime.lifecycle` 保持 `planned` |

后续单元在整体路径中规划，但不预建依赖未知实现结果的Task链。t05已闭合，下一步按其实际公开接口与证据创建services单元；再推进plugins、环境适配与首片验收。第二片可在公共合同稳定、文件owner独立后并行。Task completed不等于整个切片或产品完成。

## 执行位置与版本

实现 checkout：`.worktree/w00017-application-runtime-architecture`，分支 `refactor/w00017-runtime-foundation`，基线 `411449ec4c1fbc57cceaeb7aa9d2385132a0d3e0`（master，含 w00003 合并 `bb688931` 与本 Work 七项 Spec 提交 `bc144b2d`）。t05 的 `governance:context` 在该 checkout 核实身份，原始输出见 t05 evidences。

Work／Task 进度只在实现分支维护；主工作区保持 `master`，其 Work 目录副本是 `bc144b2d` 的占号记录，不回填进度、不在主树切分支。登记按 [编号合同](../README.md#编号分配与记录位置) 本地协调，不要求独立登记 PR 或非 squash 祖先关系。

## 不变的产品边界

- 必需服务可插件化，首批随产品发布，不支持任意在线卸载/替换。
- 显式关闭先协商dirty/在途工作；强制退出不保证保存；窗口离开不关闭共享后台Project/Job。
- 服务实例寿命不等于持久记录寿命；不改变现有用户格式、数据库布局或迁移策略。
- 小内核不依赖具体领域、框架、文件/数据库驱动；代理/服务发现不代替服务端授权。
- Lab只做组件展示与局部显式依赖，不形成第二产品宿主或通用插件Lab。
- 不修改产品/fixture/依赖/CI/发布，不执行远端Issue/Project/PR写入；`issueId: null`，未取得远端编号。

## 质量与证据

纯文档检查链接、结构、capability唯一性、成熟度与批准边界，并用独立Reviewer反证生命周期/资源/依赖合同和实施计划。t05 的机制验证为应用包 `test:runtime-foundation`、`typecheck:runtime-foundation`、一次临时 smoke，以及仓库根 `docs:check` 与 Task `governance:context`；全量 `bun run test`、`nuxt typecheck`、build、浏览器、迁移和Provider不属于已运行项。

规划阶段 `governance:check` 的两项失败见 [原始输出](tasks/t01-architecture-proposal/evidences/governance-check-tracer.txt)：w00003/t14缺README、根AGENTS固定标记不匹配。前者已由主线 `34c3d5db` 补齐；本 Work 未重跑全仓 `governance:check`，不宣称全仓治理通过。

历史交付（不作本轮新Spec验证）：
- 首轮 [审查处理](tasks/t01-architecture-proposal/walkthroughs/review-resolution.md)、[质量基线](tasks/t01-architecture-proposal/walkthroughs/quality-baseline.md)。
- B/S追加 [源码调查](tasks/t01-architecture-proposal/walkthroughs/tracer-design.md)、[审查处理](tasks/t01-architecture-proposal/walkthroughs/tracer-resolution.md)、[文档门禁](tasks/t01-architecture-proposal/evidences/docs-check-tracer.txt)。

本轮新审查分别写 t02/t03 的 `walkthroughs/foundation-review.md`；t04 记录处理与最终质量证据，不用旧报告为新Spec背书。

本轮规范规划的处理与验证入口：[t04交付记录](tasks/t04-foundation-spec-plan/walkthroughs/foundation-resolution.md)、[身份检查](tasks/t04-foundation-spec-plan/evidences/context-checks.txt)。t05 的公开接口、验证结果与未运行项见其 [快照](tasks/t05-runtime-lifecycle/README.md)。
