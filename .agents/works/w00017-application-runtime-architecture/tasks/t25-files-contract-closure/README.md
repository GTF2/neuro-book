---
schema: nbook.task/v2
taskId: t25-files-contract-closure
---

# Files 首版合同逐条复核与收口

## 目标与授权

开发者于 2026-09-27 批准“接下来先对 Files 合同逐条复核、收口”。对照 [workspace.files](../../../../../docs/specs/workspace/files.md) 与 [workbench.files-explorer](../../../../../docs/specs/workbench/files-explorer.md)，修复已批准范围内缺陷并验证实际路径。仅用自建 Temp Project、隔离 loopback 服务；不提交、远端写入、调用真实模型或触碰用户数据。跨机器验证缺少隔离第二宿主，单独记录。

## 当前状态

合同逐条复核与本机修复验收已完成；追加严格排他移动实现与 Windows 单机竞争验证。两项 Spec 保持 `planned`，不将部分证据写成合同整体完成。执行分支 `refactor/w00017-runtime-foundation`，HEAD `026ed9b2f9e6bfc6de81c1fd45320c68f9b7fe1f`；既有实现为未提交 diff。恢复执行的 `governance:context` 返回 `failures: []`。

复核时先复现同目录复制无改名协商、200 SSE 正常 EOF 静默、真实鼠标拖动不触发（节点缺 `draggable`）；另从代码发现多选删除只取单项、未知结果无法核对、剪贴板缺源实体身份、目录复制未知类型被略过。当前改动修复这些可达路径；t21 误将 `2 passed / 85 skipped` 记为 85 passed 已更正。

## 服务合同矩阵

历史证据来自 t16–t24，不冒充本轮运行；各行只列已验证范围，严格排他原语已在 Windows 本地验证，但 Linux/macOS、其它文件系统与跨机器仍未实测。

| 验收 | 实现与证据 | 本轮结论 |
|---|---|---|
| 1 主页面读写与另一消费者 | t18、t19、t23 真实 HTTP、编辑输入、磁盘重读；唯一正文 Store | 本轮应用插件路由已接入，聚焦测试通过；真实正文读写沿历史证据，未重新跑写入场景 |
| 2 文件/目录操作及空 index | t20、t21、t22；tracked 操作与 Storage 边界 | 目录复制及当前文件残留的后端回归通过；空 index 沿历史证据 |
| 3 多选/去重/独立失败/停止 | t22 batch；Project exact guard、File Index mutation | 后端 batch 34/34，复制原语 3/3；主页面两项删除一次确认、双文件鼠标拖动入盘并逐项完成；独立失败沿聚焦测试 |
| 4 保存冲突与新输入 | t18、t19、t23；条件写入和正文 revision | 本轮真实磁盘冲突路由 2/2；输入保留沿历史证据 |
| 5 事件/断线 | t24 SSE 与双窗口；本轮复现正常 EOF 静默 | 客户端/窗口运行时 4/4；主页面拦截 200 SSE EOF 后显示「同步中断」；双窗口沿历史证据 |
| 6 旧代次、越界、只读 | exact publicId + physical root + Project generation；t18、t24 | 沿历史证据；新增异步操作对话冻结由面板测试覆盖，未重新跑全部旧代次浏览器场景 |
| 7 消费者释放 | t24 双窗口；Application owns Project generations | Files 插件请求作用域与 lease 借用，启动/停止 13/13；本轮隔离开发服务协作关闭，双窗口沿历史证据 |
| 8 基础链、同名、提交冲突 | t20–t24；排他 create/copy；t25 原生 no-replace move | 主页面同目录复制选择 `copy.md` 后源/目标磁盘字节一致；本轮 Windows 在最后预检后抢占文件/目录目标的回归保住源和目标，隔离 Project 批量移动实盘成功；其它平台待验 |
| 9 部分残留、取消、未知 | t22 已有目录残留与逐项结果 | 面板/后端测试通过；主页面跳过+取消未写入，batch 已写盘后丢失响应显示未知，读查两端存在仍不判成功、不重放旧意图 |

后端 Files 插件原先未注册，路由直接构造 service factory。本轮注册 `workspace.files` 内置 provider 到 `product-startup`，读写/CRUD/stat/batch/SSE 请求显式借用 provider 和 Session Store lease；保留原 Project ready/Index/History owner，基础操作继续复用 tracked 原语。应用停止先终止并等待真实在途请求，不因等待方取消提前释放 lease。模块重载使用 Application 保存的精确 service key，不重新按名字伪造身份。

## 视图合同矩阵

| 验收 | 实现与已有证据 | 本轮结论 |
|---|---|---|
| 1 双模式/标题/根 | t20 投影与主页面磁盘；t24 Lab 五态 | 沿历史证据 |
| 2 目录展开/创建空正文 | t20、t21 | 沿历史证据 |
| 3 键盘/选择/preview/permanent | t22 真实手势与组件测试 | 节点补原生 `draggable`；本轮真实鼠标拖动选中两文件，逐项移动与磁盘位置一致；其它沿历史证据 |
| 4 偏好/焦点/dirty | t20 模式恢复、t23 dirty；真实节点投影 | 沿历史证据 |
| 5 剪贴板与源身份 | t22 窗口内 Ctrl+C/X/V | 本轮主页面同路径实体替换后 0 次 batch POST，反馈「来源已被替换」；服务端来源预期身份回归通过 |
| 6 目标/去重/目录范围 | t22 批量与隐藏正文/附件 | 父子归一化由后端/面板测试覆盖，多选拖动在主页面实测；隐藏正文沿历史证据 |
| 7 改名/跳过/取消 | 本轮原先同目录复制浏览器失败证据 | 显式 targetNames 协商后，同目录 copy 改名为 `copy.md` 实盘成功；两项碰撞下跳过第一项、取消后续，逐项明确反馈 |
| 8 部分完成/取消/未知 | t22 原有残留 | 浏览器路由先提交再断开响应，目标文件实际存在仍显示「结果未知」；核对两端存在后旧意图不重试，显式放弃后才可新选 |
| 9 dirty/移动/删除 | t23 手动输入与磁盘验证 | 多选删除一次确认展示两项影响范围，逐项删除完成且磁盘仅保留未选文件；dirty 沿历史证据 |
| 10 空/加载/失败/换代 | t24 REST 400/409、503→retry | 旧对话晚回调由组件测试覆盖，空/加载/失败沿历史浏览器证据 |
| 11 领域 UI 退出不改数据 | t20 受控文件面板、真实目录保留 | 沿历史证据 |
| 12 冷开/热切换/资源 | t16 基线、t24 四组 3×30 与最后标签释放 | 不重复测量；本轮未改编辑器热切换路径 |
| 13 Lab/主页面/跨机器 | t24 五态与 390 px 画布、双窗口 | 本机历史证据有效；第二隔离宿主缺失 |

## 已运行与剩余边界

- SSE EOF 回归修复前 `promise resolved undefined instead of rejecting`；修复后客户端与 browser runtime 2 files / 4 tests passed，隔离主页面 200 EOF 显示同步中断。
- 插件初接入的租约早释放回归失败，补作用域 operation 和 service/lease 借用后通过。模块重载回归曾报 `undeclared-dependency`，改为捕获 Application 原 service keys 后通过；startup 13/13。write route 2/2、events 6/6（含 provider 拒绝后的 operation completion 归还）。
- 后续严格排他收口：新增 `rename-no-replace.ts`，Windows 用 `MoveFileExW` flags=0，Linux 用 `renameat2(RENAME_NOREPLACE)`，macOS 用 `renamex_np(RENAME_EXCL)`；未知平台、原语缺失或文件系统不支持时拒绝，不能退回普通 rename 或跨卷复制。`koffi@3.3.1` 与当前平台预编译包纳入 Product native island。
- Windows 本机 `workspace-files.test.ts` 基础操作与最后预检后外部目标抢占 3/3（77 skipped）；文件和目录竞争失败后逐字节确认源/目标。未知平台隔离进程返回不支持；模拟 Linux `ENOSYS` 返回不支持，源/目标内容不变。隔离 Project 批量移动及目录 History 2/2；批量路由/History/Storage 边界 31/31；镜像 island 和 module-closure 2 files / 11 tests，独立 bundle 测试复制并加载 Koffi 实际拒绝已占用目标。Nuxt typecheck 通过，`git diff --check` 无空白错误。
- 首次完整 `nuxt:build` 在 Authoring Kit 声明投影遇到 `server/utils/auth.ts` 的 Nuxt 自动注入符号；定位为 `world-engine-tool-description.ts` 的仅两值类型引用引入整个 facade，改成相同字面量合同后投影测试 1/1 通过。下一次构建的模块闭包门禁发现 Worker 第三处动态 import；核查为 `app-sqlite-migrations.ts` 仅在 `bun:sqlite` / `node:sqlite` 内建模块间选择，更新精确计数后门禁 11/11。最终完整 `nuxt:build` 成功：Product Runtime Image 发布在本地 `.output`，imageId `sha256:4751107cc84cfa8ad40117d450b9d9cccd3fadb98a84e44d81983462e60c8ee1`，3405 files / 141021672 bytes，native islands 54 packages 含 `koffi` 和 `@koromix/koffi-win32-x64`。`product-runtime-bundle.test.ts` 既存重复 `testHostPath` 导入已去重；未改认证代码，未运行完整测试套件或 Linux/macOS 本机验证。
- 隔离主页面用自建 `files-baseline-a/t25-1790475641317/` 测同目录改名复制、两项删除、多选鼠标拖动、跳过/取消、替换源身份拒绝和已写盘响应丢失的未知结果；盘上字节/路径逐项核实。浏览器仅被拦截的请求报预期网络错误；无关页面 Vue 未解析组件警告并非本轮 Files 通过依据。一次连续验收复用旧拖动结果导致 404 假象；新浏览器会话完成两项移动，未据旧会话宣称通过。验收服务和浏览器均已关闭，Temp 根保留。
- 原先 `fs.rename` 的最后竞态改为平台原子 no-replace 提交，Windows 文件/目录抢占已实测；预检仍提供及时 UX，但不作为提交保护。Linux/macOS 原语与各文件系统支持由运行时 fail-closed 判断，尚未在相应宿主实测，不能用 Windows 结果推断跨平台通过。文件转目录的独立转换流程不是本次路径 move 原语，未声称被覆盖。
- 第二隔离宿主不可用，跨机器基础操作仍未验证。内置浏览器不可用，按测试规范用独立 Playwright 浏览器；未连接用户浏览器。Temp 根 `files-v1-OfeVX1` 保留，无整体清理授权。
- 人工验收反馈追加：`index.vue` 显式导入 `UserProfileWorkbenchDialog`，修复 Nuxt 自动注册的目录前缀与模板短名不一致；隔离主页面实际打开 TSX Profile 工作台，该标签控制台 0 errors / 0 warnings。Nuxt typecheck 通过。
- `project/action` 连续请求定位为四条固定 500ms 只读订阅，非循环写入：修复前静止 6 秒 45 次 read；退出项目后 2.2 秒 0 次 Project action。现改为无变化时有界退避、发现变化恢复快速观察；稳定期实测每条约 8.03 秒，17 秒共 12 次 read。外部变化发现延迟最多一个 8 秒间隔加请求耗时，同句柄提交仍立即刷新；33 项 owner-handle 测试通过，新增回归修复前失败、修复后通过。未改 Storage 传输协议，用户 localhost:3000 的具体请求体未采集。
- 本次浏览器验证使用临时 `qing-qiu-xun-huan-yan-shou` 项目和独立构建目录；首次启动遇到租约冲突，正常关闭后隔离构建目录重启通过，未删除租约。创建临时项目时另观察到 `ProjectCreateForm.vue` 的 `titleInputRef.value?.focus is not a function`，创建成功但自动聚焦失败，未纳入本轮两项修复。Profile 弹窗旧组件缺少 `role=dialog` 与同名伴生文档，未声称完成其无障碍或视觉全面验收。
