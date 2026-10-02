---
schema: nbook.task/v2
taskId: t01-storage-context-unload-release
---

# pagehide 兜底释放访问上下文

## 目标与范围

- `packages/neuro-book/app/utils/storage/host-context-client.ts`：
  - 模块级登记本页面已签发、尚未释放的 session（签发成功即登记，`closeStorageContext` 成功后移出；失败保留，交给兜底再试）。
  - 首次签发时懒安装 `window.addEventListener("pagehide", ...)`（`typeof window` 守卫，SSR/Node 不装，只装一次）。
  - `releaseStorageContextsOnPageHide`：`event.persisted`（bfcache 暂存）时跳过；否则对每个登记中的 session 发原生 `fetch` DELETE，`keepalive: true`，失败静默（服务端 30 分钟空闲回收兜底）。
- `docs/specs/storage/persistence.md`「身份与访问上下文」补一行页面卸载释放合同。
- 单测 `host-context-client.test.ts` 追加 describe（5 例）：懒安装一次、keepalive DELETE 路径/headers/清空登记、persisted 跳过、close 成功不再兜底、close 失败仍登记。

## 非目标

- 不改 `access-context.ts` 服务端限额/回收/失败语义。
- 不改正常释放（工作台 release、工作面切换）路径的语义，只追加登记簿记。
- 不在 `visibilitychange`、`beforeunload` 上释放。

## 验证与证据

- 受影响测试（worktree 与合并后 master 各跑一遍）：`host-context-client` 23/23；`workbench-migration-e2e` + `storage-context` 19/19；7 个 import 该模块的测试文件 146/146。全部通过。
- `nuxt typecheck` 按文件与 master 基线比对：30 条错误 / 4 文件，与基线逐文件一致，零新增。
- 无头探针（`.local/w00032-probe.mjs`，合并后对 127.0.0.1:3000 实测）：两次 `page.reload()`，**服务端日志 ground truth 显示每次卸载有 5 条 DELETE 同毫秒到达**（`10:36:44.623`×5、`10:36:50.670`×5，全部 200）；boot 签发 6 份，其中 1 份经正常路径释放、5 份经 pagehide 兜底释放，覆盖完整。Playwright 页面事件只捕获到 1 条属监听随文档销毁停止，非服务端缺失。
- 旁证：开发者真实会话测试期间（18:08 本地）日志出现 6 次 `POST /api/storage/project/context` **503 = `STORAGE_CONTEXT_LIMIT`**（当时累计签发 37 份、仅释放 7 份），正是本 Work 要消除的症状；修复合并于其后。

## 未验证

- bfcache `persisted=true` 跳过路径：headless Chromium 无法稳定复现 bfcache，由单测覆盖，未做浏览器实测。
- `keepalive: true` 标志在 CDP 观测为 null（Playwright 不透出该字段），但请求在文档销毁后仍到达服务端即为其实际效果的直接证据。
- 长时段观察（30 分钟内反复刷新不再锁连接）未做：探针已证每次卸载释放，剩余风险由服务端空闲回收兜底。

## 授权与限制

- 开发者 2026-10-02 会话授权：「那个存储访问看你的意思做」。
- 推送仅限 origin（GTF2/neuro-book），不推 upstream。

## 当前状态

已交付：实现 + 单测 + typecheck + 无头探针实测通过；合并 `663ee9d6`，已推 origin。

## 执行位置

`.worktree/w00032-storage-context-unload-release`，分支 `fix/w00032-storage-context-unload-release`。
