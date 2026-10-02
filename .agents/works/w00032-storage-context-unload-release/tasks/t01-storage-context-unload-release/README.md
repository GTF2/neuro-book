---
schema: nbook.task/v2
taskId: t01-storage-context-unload-release
---

# pagehide 兜底释放访问上下文

## 目标与范围

- `packages/neuro-book/app/utils/storage/host-context-client.ts`：
  - 模块级登记本页面已签发、尚未释放的 session（签发成功即登记，`closeStorageContext` 成功后移出）。
  - 首次签发时懒安装 `window.addEventListener("pagehide", ...)`（`typeof window` 守卫，SSR/Node 不装）。
  - `pagehide` 处理：`event.persisted`（bfcache 暂存）时跳过；否则对每个登记中的 session 发原生 `fetch` DELETE，`keepalive: true`（请求在文档销毁后继续送达），失败静默（交给服务端 30 分钟空闲回收），同步异常不中断其余释放。
- `packages/neuro-book/docs/specs/storage/persistence.md`：「身份与访问上下文」补一行页面卸载释放合同。
- 单测（`host-context-client.test.ts` 追加 describe）：登记/移出生命周期、pagehide 触发释放（含 keepalive、路径、headers）、persisted 跳过、close 成功后不再兜底、close 失败仍登记、懒安装 window 监听。

## 非目标

- 不改 `access-context.ts` 服务端限额/回收/失败语义。
- 不改正常释放（工作台 release、工作面切换）路径。
- 不在 `visibilitychange`、`beforeunload` 上释放。

## 验证

- `bun run --cwd packages/neuro-book test host-context-client workbench-migration-e2e`（受影响既有测试）。
- `bun run --cwd packages/neuro-book typecheck` 按文件与 master 基线（30 条 / 4 文件）比对。
- 浏览器实测（刷新多次不再锁连接）依赖 dev server，与开发者真实会话互斥，记为未验证。

## 授权与限制

- 开发者 2026-10-02 会话授权：「那个存储访问看你的意思做」。
- 推送仅限 origin（GTF2/neuro-book），不推 upstream。

## 当前状态

实现与验证进行中。

## 执行位置

`.worktree/w00032-storage-context-unload-release`，分支 `fix/w00032-storage-context-unload-release`。
