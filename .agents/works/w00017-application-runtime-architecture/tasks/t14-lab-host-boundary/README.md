---
schema: nbook.task/v2
taskId: t14-lab-host-boundary
---

# Lab 宿主边界

## 目标与范围

在 [实施路径](../../implementation-plan.md#lab) 的第三片，把 LabShell 的常驻产品命令注册表、S4 面板、确认框、键位监听与第五个「命令」tab 撤出；命令夹具建立与场景同寿的局部宿主。直接打开 `/lab` 时跳过产品配色和旧桶迁移，不发默认产品配置、Project、Storage 请求；保留认证、主题、场景、文档/元素检查器、事件/数据、Lab 界面偏好与真实 Monaco 样板。在 [ui.component-lab](../../../../../docs/specs/ui/component-lab.md)、[workbench.commands](../../../../../docs/specs/workbench/commands.md)、[workbench.quick-open](../../../../../docs/specs/workbench/quick-open.md) 原位调整合同。

非目标：将 runtime.application 接入现有产品启动、迁移 Project/Storage 的产品调用方、解决现有完整 Lab smoke 的全部漂移、人工浏览器验收、push/PR/合并。

## 当前状态

本地实现、专项验证与文档/治理门禁已完成，待本地提交。执行位置 `.worktree/w00017-application-runtime-architecture`，分支 `refactor/w00017-runtime-foundation`，开始基线 `25550660`。w00016 当时交付的命令底座与验收保留；新边界由本 Task 接手，并在 [w00016 Work](../../../w00016-workbench-commands/README.md#2026-09-25-lab-宿主边界交接) 留交接指针。

## 实现边界

- `app/pages/lab.vue` 标记 `productHost: false`；`product-host.client.ts` 在 Nuxt router 完成初始导航后记录文档身份；主题配色插件与旧桶迁移插件只在明确非产品宿主时跳过。Lab 文档锁定旧桶 writer，不创建迁移暂存库。`00.product-host.global.ts` 在 Lab 文档进入产品路由时强制整页导航；认证中间件不变，登录身份探测仍允许。
- `LabShell.vue` 只负责 Lab 页面状态和四个检视 tab。`fixtures/lab-command-scene.ts` 为 `CodeEditorViewFixture` / `WorkbenchCommandPaletteFixture` 提供局部命令注册、键位、执行审计、确认与卸载结算；命令检视经 `LabFixtureControls` 落到底部抽屉，命令事件留在 Lab 事件 tab。`activeInspectTab: commands` 旧偏好回退默认。
- smoke 用真实 Monaco 验证面板打开/关闭、受检标记、入口命令审计和切换到非命令组件后的释放；导航检查从 Lab 内调用 router，窗口标记验证确实发生整页加载。禁用守卫的负向对照报出明确失败，守卫恢复后通过。
- 修复验收暴露的两处既有问题：偏好恢复期间不再由 `selectedName` watcher 清掉已恢复的画布宽高；nb-ui `QuickInput` 没有描述节点时不留下 Reka 默认的悬空 `aria-describedby`，宿主显式 attrs 仍可覆盖。后者回归测试移除修复后因悬空 id 失败、恢复后通过。

## 验证结果（2026-09-25）

| 范围 | 结果 |
|---|---|
| `bunx vitest run app/component-lab` | 16 files / 94 passed（含场景宿主卸载、偏好回退） |
| `bunx vitest run app/component-lab app/components/workbench app/composables/useWorkbenchCommands.test.ts` | 首轮仅 1 个测试命令 id 非法；修正为有效域后单文件 `lab-command-scene.test.ts` 3/3 passed；其余 28 files 首轮通过 |
| nb-ui `bun run test src/components`、`bunx vitest run src/components/feedback/QuickInput.test.ts` | 16 files / 392 passed；QuickInput 单文件 8/8 passed；该测试负向对照确实因悬空 id 失败 |
| nb-ui `bun run typecheck`、主应用 `bun run typecheck` | 均 exit 0 |
| `node --import tsx scripts/smoke/component-lab.ts --url http://127.0.0.1:3001 --browser-executable <isolated Chromium> --suite core` | 通过；隔离 Temp State/Cache，包含 `/lab` 请求/IndexedDB、四 tab、真实 Monaco、场景释放、偏好刷新与 Lab → 产品整页导航 |
| `bun run scripts:typecheck` | 未通过：仅既有 `scripts/deploy/product-agent-state-root-smoke.ts(318,9) TS2739`，缺少 `colorwayId`、`userColorways`；此前同一基线错误已记录，非本轮脚本诊断 |
| 仓库根 `bun run docs:check`、`bun run governance:context -- --work w00017-application-runtime-architecture --task t14-lab-host-boundary` | 前者 `failures: []`、`checkedFiles: 6523`；后者身份匹配，`failures: []` |

实际隔离根为系统 Temp 下 `neuro-book/w00017-t14-lab/{state,cache}`；该空根曾先按启动门禁执行 `migrate:application-state -- --apply`（仅隔离临时数据，未接触真实用户数据）。Chromium 自动 smoke 不等于人工验收。

## 未通过与未验证

- 完整 `--suite all` smoke 未通过。`--suite workbench-shell` 在本切片与 stash 后的 `25550660` 基线各出现 **143 条归一化后完全相同**的断言；其首个失败是容器级 `data-title-actions="container"` 菜单找不到，后续面板/拖动断言级联。组合流程在 1600×1000 下还有 Panel 裁剪/拖回问题；未改工作台骨架实现。
- 单独 `--suite agent-profile` 和 `--suite project-picker` 未通过：脚本等待场景 `[role="radio"]`，现有 LabShell 在场景数大于 4 时呈现 FormSelect 下拉（阈值源自基线 `565f792d`），属于现有脚本与控件合同漂移；本片未修改相关选择器或场景目录。
- 完整包级 `bun run test`、全仓 `governance:check`、Product 构建排除核验、nb-ui 全量 E2E、人工浏览器验收和真实 Provider/Model 均未运行。场景内仍存在 pre-existing 的 `ProjectCreateDialog` → layout-session / host-context-client 与 `AgentWorkflowBubble` → novel-ide store 耦合；不发生在 `/lab` 默认启动窗口，后续按场景边界单独处理。
- 从产品文档 SPA 进入 Lab 仍可运行既有产品启动接线（已运行过，不能回退）；无默认产品请求只针对直接加载的 `/lab` 文档。临时根中的迁移不代表产品迁移授权。

## 授权与下一步

开发者批准方案 B 继续 Lab 切片；本地可逆开发与提交可自主执行。push、PR、合并、发布、真实产品数据迁移与人工浏览器验收须各自授权。下一步本地提交；Files 纵向链另立实际实施单元，产品启动链在该链迁移旧 owner。完整包级测试与远端交付的取舍仍待开发者决定。
