---
schema: nbook.task/v2
taskId: t24-files-switch-performance
---

# Files 编辑器切换与受控 Lab 验收

## 目标与范围

对照 [t16 冻结基线](../t16-files-baseline/README.md)，在自建隔离 Project、真实主页面和 Chromium 上测永久标签富文本/源码单组及双组热切换，核实输入、撤销与文件请求归属；Lab 的 FilesExplorerView 只消费局部场景数据。

## 当前状态

性能样本和最后标签资源释放均完成。`EditorViewHost.vue` 对暂时 `document=null` 而标签仍开放的组保留编辑器，关闭全部标签或代际切换时释放；`app/pages/index.vue` 保持该宿主挂载，未选中正文时让 Welcome 占位。`EditorViewHost.test.ts` 10/10；本轮包含该测试的产品聚焦套件 12 个文件、109/109 通过，Nuxt typecheck、scripts:typecheck 与独立 runtime-foundation 151/151 均通过。

真实主页面：Chromium 151.0.7922.34、Source Dev、1440×1000、自建 `files-baseline-a`，两份 8 KiB Markdown A/B 双击固定永久标签，三轮各 30 次。capture 阶段点击起点到活动组可见正确正文且非 busy 终点；每轮在活动编辑器键入并撤销 `INPUT-OWNERSHIP-PROBE`。同一自建 Temp 根原始记录：`t24-rich-measure-42261.json`、`t24-rich-dual-measure-42261.json`、`t24-code-measure-42261.json`、`t24-code-dual-measure-42261.json`。未成功完成输入核验的脚本试跑（旧预览标签、错误元素定位、Dev 重载 ELOCKED）均未计入下表。

| 模式 | t16 p50/p95 (ms) | 本轮 p50/p95 (ms) | 三轮 p95 (ms) | 冻结 p95 预算 |
|---|---:|---:|---:|---:|
| 富文本单组 | 673.9 / 827.7 | 33.5 / 38.0 | 38.0 / 37.6 / 39.6 | ≤ 250 |
| 富文本双组 | 548.1 / 674.9 | 36.4 / 42.1 | 47.7 / 42.1 / 40.3 | ≤ 250 |
| 源码单组 | 57.3 / 66.8 | 43.5 / 53.8 | 48.8 / 47.6 / 56.1 | ≤ 80 |
| 源码双组 | 61.3 / 74.7 | 46.6 / 53.4 | 54.1 / 48.9 / 56.5 | ≤ 80 |

四组切换期间 `/api/workspace-files/` 请求和 pageerror 均为零；每轮正确正文可输入并撤销。单组富文本创建/保留两实例，双组主组两实例、另有一份第二组保留内容（总计 3）；源码单/双组主组均观测两个 Monaco 控件，未在切换中逐次创建。以上计数不是最后关闭后的全局释放计数。

Lab `/lab` 真实浏览器以组件搜索进入 FilesExplorerView，验证普通 `index.md`、内容模式根节点与隐藏目录正文、读取中、空目录及错误状态点击重试后恢复；未向产品 Files、Project、Storage、Config API 发请求，pageErrors=[]。1440×1000 截图位于隔离 Temp 根 `t24-lab-files.png`。另以 390×844 浏览器视口选择 Lab 手机预设（内层画布 390×844），收起组件栏并调至 50% 让整块画布进入可见区域：文件行可见，document.scrollWidth=390，画布内 scrollWidth/clientWidth=386/386；截图 `t24-lab-files-390.png`。这证明手机尺寸画布内容未水平溢出，不声称 Lab 在 100% 下整块画布已进入窄视口。fixture 只报告拖动/粘贴意图，磁盘写入由产品主页面负责。

## 终态验证与剩余边界

Project production owner 已迁至 `server/runtime/product-project.ts`：Application 子 Scope 管理精确 opening/ready generation，Service 的 grace sweep 返回精确 ready；Project child 未完整关闭时 Session Store lease 不释放，显式 recover 可完成释放；物理根替换先封新接纳，再关闭旧 Runtime 和对应 Scope。针对 startup/shutdown、Project Session/Service/Runtime、Storage scope、Project publication、Files read/write、browser runtime、Editor host 和 Files panel 的产品聚焦测试 12 文件 109/109 通过；`bun run test:runtime-foundation` 12 文件 151/151、`bun run typecheck`、`bun run scripts:typecheck` 与 `git diff --check` 通过。`subject-rag` 隔离 Project smoke 真实运行退出码 0（本地 fetch 仿真，不调用真实 Provider）。

隔离 Source Dev `http://127.0.0.1:42261/`、自建 `files-baseline-a` 的 Chromium 双窗口验收：两窗口 Files tree/read/events 共用同一有效 publicId；刷新真实请求 200，受控树请求 503 最终显示错误并可重试至 200；缺 publicId 读请求 400、过期标识 409，关闭第二窗口后第一窗口仍能刷新、读取正文；切内容模式后重载恢复模式与永久标签。无 pageerror。富文本双组最后标签关闭后捕获 Tiptap 存活数 0，源码双组最后关闭后 Monaco DOM 与 models 均为 0，且中途关一组时另一组 model 仍活。受控 503 探针须覆盖 ofetch 对 503 的再次请求；Performance Resource Timing 未记录树请求，浏览器脚本改为响应事件判定，不将前两次超时计为成功。

两项 Files Spec 继续 `planned`：`workbench.files-explorer` 明列的跨机器基础操作尚无实际证据，且全量合同尚未逐条复核。以上全部验证限自建 Temp、隔离服务；不触碰用户作品、既有服务或真实模型，不提交或执行远端写入、部署、整体清理 Temp 根。
