---
schema: nbook.task/v2
taskId: t20-controlled-files-explorer
---

# 受控文件资源管理器与双模式

## 目标与范围

同一真实文件树在普通/内容节点两模式呈现：普通显示真实文件名及 `index.md`；内容模式隐藏 `index.md` 文件行，从所在目录或根入口打开同一正文。文件树基础呈现接收显式节点、模式、展开、选择和动作，不隐式取得产品 store/Project/Storage；产品适配复用现有 `nbook.files` View、展开记录与文件正文 owner。领域专用模板和明细退出文件面板，不删除任何作品或独立领域能力。

## 当前状态

已完成本单元。新增受控 `FilesExplorerView`、普通/内容投影、`workbench.files/view-mode` user/local 记录和产品 `WorkspaceFilePanel` 适配；组件不访问 store、Storage 或请求，产品宿主负责真实数据与副作用。服务端产品 Storage 定义已注册模式记录，修复了模式切换只能留在当前窗口的问题。后续独立交付安全文件操作、多选剪贴板、dirty 协调和 Lab 受控 fixture；不能把当前局部面板视为 Files V1 整体完成，两项 Spec 仍 `planned`。

## 验证证据

- `bunx vitest run app/components/novel-ide/workspace/WorkspaceFilePanel.test.ts app/components/novel-ide/workspace/workspace-file-tree.test.ts app/utils/workbench/files-view-session.test.ts shared/storage/workbench-files.test.ts`：3 files / 28 tests passed。
- `bun run typecheck`：Nuxt typecheck 0 diagnostics。
- 隔离服务 `http://127.0.0.1:42257/?project=files-baseline-a` + Chromium：普通模式显示真实 `index.md` 行，内容模式隐藏所有 `index.md` 并显示根入口；根入口双击打开 `Root content fixture`；切回普通模式成功且无 Storage 诊断；`pageErrors=[]`。
- 同一隔离项目 390px 视口重开：恢复内容模式，内容树仍无 `index.md`，资源管理器宽度 `308px <= 390px`，无横向文档溢出，`pageErrors=[]`。

## 未验证边界

- 真实磁盘创建、重命名、复制、移动、删除、多选/剪贴板、dirty 与在途保存协调仍未实现或未验收。
- Lab 独立注入 fixture、跨访问方式和完整主页面贡献生命周期留到最终装配阶段。

## 原计划验收与实际边界

原计划包含缺失标题、空目录、dirty 与文件字节不变的完整产品验收；本单元已验证双模式、根入口、真实目录内容、模式恢复和窄屏布局，缺失标题/空目录的显示由组件逻辑与投影测试覆盖。dirty/字节不变需等文件操作与编辑协调单元，Lab 跨访问方式需等最终装配，不能在本单元提前宣称完成。

## 边界

仅触碰本次隔离 State/Cache/Project 和自建 loopback 服务；不触碰用户作品、既有服务、真实 Provider，不执行提交、远端写入、部署或整体回收临时根。第二版快速打开与删除恢复不纳入。
