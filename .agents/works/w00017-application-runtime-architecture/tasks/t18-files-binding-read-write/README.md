---
schema: nbook.task/v2
taskId: t18-files-binding-read-write
---

# Files 精确绑定与真实读写纵向链

## 目标与范围

执行首版计划第三单元：Project 文件 HTTP/API 请求绑定 open 发布的 exact `publicId`；浏览器 FilesClient 固定绑定当前 Project；Store 保持唯一正文、dirty、修订 authority，将 tree/stat/read/write/events 接到同一服务。失效代次禁止按 projectRoot 回退；user-assets 必须显式指定。创建/复制/面板/运行时装配属于后续单元。

## 当前状态

实现已完成，Task 定向验收收口。已落地严格联合绑定 DTO、Project exact guard（含 `projectRoot` 与物理 target root 检查、ready generation revalidate）、`workspace-files` tree/stat/read/write 数据面、全部 Files route 绑定迁移，以及前端 `FilesClient` 固定 binding 和 Store 的代次隔离。Project 上传 FormData、download、events、create/rename/delete/convert 等入口均携带绑定；user-assets 只接受 `{workspaceKind: "user-assets"}`。旧路由仍保留给未迁移的其它领域调用方，不作为 Files HTTP 入口。

## 已验证

- `bun run typecheck`：通过，0 diagnostics。
- `bun run test -- app/stores/novel-ide-editor.test.ts app/stores/novel-ide.test.ts app/composables/useEditorWorkbench.test.ts`：3 files / 37 tests 通过。
- `bun run test -- server/features/workspace-files/service.test.ts`：此前 1/1 通过；真实 Temp 文件读写、过期 mtime 条件保存返回 409、外部正文保持不变。
- `bun run test -- server/api/workspace-files --testTimeout 20000`：6 files / 15 tests 通过。旧 mock 已迁移；默认 5s 的读路由测试超时归因于冷导入，单例 20s 运行通过。
- 隔离 Source Dev 已使用临时 State/Cache/Project 根启动于 `http://127.0.0.1:42257`。真实浏览器 `1440×1000` 打开 `files-baseline-a`、点击 `baseline-a.md`，正文含 `BASELINE-A-CONTENT-MARKER`，`pageErrors=[]`；页面 tree/read/events 均携带相同精确 `publicId`。同一浏览器上下文执行 tree/read→条件写入→磁盘重读：tree/read/seed/write=200，缺 publicId=400，旧 publicId=409 `PROJECT_NOT_OPEN`，过期 mtime 保存=409，磁盘内容仍是上一已确认版本。首轮页面回退已定位为把 `{projectRoot,publicId,revision}` 直接传入严格 Files DTO，现于页面两处只投影 `{projectRoot,publicId}`；修复后重跑脚本通过。测试仅对本次隔离样本操作，不触碰用户作品。

## 授权与边界

仅执行开发者批准的本地可逆开发与隔离 State/Cache/Project/loopback 验收；不触碰真实作品/模型，不提交、push、PR、合并、部署或远端写入。临时根整体回收未获授权。Files 两项 Spec 仍为 `planned`，不得因本 Task 局部实现或本链证据晋升。

已转入 [t19 打开与切换输入结算](../t19-open-switch-settlement/README.md)。本单元证明主页面真实打开与 HTTP 条件读写；手动编辑器键入/保存 UI 的完整旅程留到后续主页面验收，不能用程序化写入冒称手动点击保存。
