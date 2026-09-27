---
schema: nbook.task/v2
taskId: t15-files-explorer-design
---

# Files 与文件资源管理器重构设计

## 目标与授权

2026-09-26 开发者在 Lab 体验后经访谈确认 Files 首版意图，随后要求范围回写与设计细化；本轮以“可以，就这么做，收口”确认 F1–F9，并要求第二版草案、拆分 `application-runtime-and-plugins.md` 及相关项目文档治理。旧的“完整保留资源管理器领域功能”要求已被替换，首版行为以两项 Spec 为准。

当前授权为本地文档/规范收口、第二版草案与相关文档拆分治理；不开始产品实现、不创建后续实施 Task、不操作开发者服务或远端元数据。未来主页面真实验收要求不等于本轮浏览器/数据操作授权；去除领域 UI 不授权删除用户数据或其它独立领域模块。

## 当前状态

首版 F1–F9 已纳入两项 `planned` Spec；Files 第一版设计（`accepted`）及产品装配专题（`reviewing`）已从总提案分离，第二版草案（`draft`）独立新建。相关索引、Work/实施路径同步，历史原始证据不倒改。尚未实施或测量性能。执行位置 `.worktree/w00017-application-runtime-architecture`，分支 `refactor/w00017-runtime-foundation`；本轮 `governance:context` 核对 HEAD 为 `026ed9b2f9e6bfc6de81c1fd45320c68f9b7fe1f`。本轮为其上的未提交文档，无独立 revision；最终检查见下表。

## 设计边界

- [第一版设计](../../../../../packages/neuro-book/docs/proposals/files-explorer.md)只保存理由、接缝与性能依据；[workspace.files](../../../../../docs/specs/workspace/files.md)、[workbench.files-explorer](../../../../../docs/specs/workbench/files-explorer.md)分别拥有数据操作与呈现行为，不为版本/模式/插件另建 Spec 副本。
- [第二版草案](../../../../../packages/neuro-book/docs/proposals/files-explorer-v2.md)以快速打开/删除恢复为核心，其它候选按首版反馈选择，具体策略未批准；[产品装配设计](../../../../../packages/neuro-book/docs/proposals/application-runtime-product-integration.md)承接 B/S 启动链；[总提案](../../../../../packages/neuro-book/docs/proposals/application-runtime-and-plugins.md)只保留跨功能架构与导航。
- 第一版保留 dirty、冲突、编辑器撤销和代次保护，但不承诺回收站或文件操作全局撤销；主页面真实文件操作/编辑保存为验收，领域 UI 可退出但不删数据。
- Lab 使用产品组件与同一 Files 客户端合同的隔离依赖，真实磁盘、HTTP 与 Project 打开仍在独立隔离产品流程验证；若需要修改现有 Lab 无网络边界，先明确取舍，不能隐式放宽。

## 历史需求与研究依据

- 2026-09-26 只读核对 [Issue #128](https://github.com/notnotype/neuro-book/issues/128)，原始需求为“打开文件有一秒左右的延迟，需要优化”；问题是树点击到正文稳定可交互，不是单独的磁盘读取慢。验收包括冷开/热开基线、消除普通 Markdown 热开的约一秒空等、快速切换不串正文或丢编辑状态。
- Issue 当前 `OPEN`、`status: needs-triage`；`priority: high` 标签与保留的人工片段“优先级不高”不一致。本轮不改远端元数据、不据此裁定新优先级；#128 是本片相关需求，不把整个运行时 Work 改挂到它名下。
- 已有 [VS Code 编辑器研究](../../../../../packages/neuro-book/docs/research/vscode/06-editor-architecture.md) 与固定提交 `a5b500951314efd502d07465bd138dfbd714a960` 的 [TextResourceEditorInput](https://github.com/microsoft/vscode/blob/a5b500951314efd502d07465bd138dfbd714a960/src/vs/workbench/common/editor/textResourceEditorInput.ts)、[TextResourceEditor](https://github.com/microsoft/vscode/blob/a5b500951314efd502d07465bd138dfbd714a960/src/vs/workbench/browser/parts/editor/textResourceEditor.ts) 已核对：输入对象保留模型引用，释放时归还；控件在解析后检查取消，再 `setModel` 与恢复视图。借鉴这种寿命分离，不复制整套框架，也不据此宣称 NeuroBook 已提速。
- 本地正文缓存已存在，但跨文档的视图/模型仍会重建（下表）；这是采样候选，不是主因结论。Tiptap 的富文本状态/撤销保留需独立验证，不能用 Monaco 结论替代。

## 当前源码依据

路径相对 `packages/neuro-book/`；均为只读源码/合同核对，不是运行耗时报告。

| 位置 | 事实与设计影响 |
|---|---|
| `app/stores/novel-ide.ts:912-1029` | 已有树元信息与正文缓存快速路径、工作面代次及逐组激活序号；不是每次切换都重新读取正文 |
| `app/stores/novel-ide.ts:1034-1103` | 保存携带 `baseContent` / `expectedMtimeMs`，确认只更新已提交基线；性能改造不得取消冲突与保存中继续输入的保护 |
| `app/components/editor-workbench/EditorViewHost.vue:97-116` | 切文档 target 清空视图实例；同文档内切编辑类型可以保留，跨文档控件复用仍缺口 |
| `app/components/editor-workbench/MonacoCodeEditor.md:24-30` | 模型目前归各视图实例独占，跨组不共用撤销；首期推荐保留该语义并将模型寿命与控件分离 |
| `app/components/novel-ide/workspace/WorkspaceFilePanel.md:81-98` | 全局 store、默认 Storage 和剪贴板阻断完整面板 Lab 接入；设计必须处理实际子树依赖，不能只调整标签 |
| `app/utils/workbench/product-catalog.ts:65-100`、`files-view-session.ts` | 保留现有 View/命令/记录身份与 user/local 展开语义；不新建第二套布局/展开存储 |
| `server/workspace-files/project-file-index.ts`、`project-workspace-index.ts` | 已有完整树快照缓存和精确 Project 代次句柄；不把业务 Files 做成新的重复 watcher/cache owner |
| `app/composables/useWorkspaceFileEvents.ts`、`server/api/workspace-files/{tree.get,read.get,events.get}.ts` | 当前读写是 HTTP，变更是 SSE；服务端沿既有 Project/File Index 接线，不因提供插件服务就自动生成网络路由 |
| `runtime/plugins/contracts.ts`、`runtime/diagnostics/plugin.ts` | 服务提供/依赖消费机制已存在；动态 API 接收者不在当前交付内，浏览器只取得协议代理 |
| `docs/specs/README.md` 与 Content Reference | 原注册表无业务 Files/资源管理器行为正文，新增两个互不重叠 capability；内容文件格式保持冻结入口，文档会话/Project 完整规范未被本次补齐 |

组件伴生文档有历史漂移：`WorkspaceFilePanel.md` 仍称编辑器未迁入、不可移动，而当前 `product-catalog.ts` 已声明 `canMoveView: true`；实施时须以真实代码/批准合同同步修正文档，不据旧描述设计功能降级。

## 本轮验证

命令均在本 Work 的实现 checkout 根运行，覆盖本轮未提交文档；没有独立实现 revision。

| 检查 | 2026-09-26 实际结果 |
|---|---|
| `bun run governance:context --work w00017-application-runtime-architecture --task t15-files-explorer-design` | exit 0；`failures: []`；确认 Work/Task 路径、分支与上述 HEAD |
| `bun run docs:check` | exit 0；`failures: []`；检查 6,529 个文件，覆盖当前新增专题、两项 Spec、索引与 Work 链接 |
| 临时只读章节锚点核对 | 对本轮 12 份文档的 21 个仓库内 Markdown 章节链接逐一匹配标题，零失败；未留下脚本。另检索旧 Files/B/S 专题锚点，零残留；`docs:check` 本身只查路径，不覆盖章节锚点 |
| 语义核对 | 第一版 F1–F9 已有明确批准并收口；第二版仍 draft，未改 implemented quick-open。修正二版操作中故障不能假称源完整保留；创建空白正文是独立于内容格式诊断的行为。专题、Spec、Work 各守职责，历史原始证据不倒改 |
| 文档治理结果 | 总提案由 682 行减为 463 行；迁出产品装配设计 127 行、首版设计 152 行，新建二版草案 75 行。Proposal 入口补专题拆分规则；根文档入口删除过时的正式 role 要求，Work 列表消除基础 Spec 仍 planned 的失效表述 |

本轮未运行产品测试、typecheck、构建、浏览器或性能采样；纯文档范围不需要这些检查。未提交、push、创建 PR 或改写远端 Issue；没有操作开发者已打开的服务或数据。

## 下一步

第一版产品策略无剩余审批项；未来实施仍需按已批准合同安排真实链路、编辑器适配与隔离性能基线。本轮不创建实施 Task。第二版下一次评审重点是快速打开交互/最近文件寿命，以及回收项保留、容量、恢复冲突与版本兼容；草案已列选项与风险，不默认扩大首版。
