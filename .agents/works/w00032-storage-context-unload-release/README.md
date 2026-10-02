---
schema: nbook.work/v1
workId: w00032-storage-context-unload-release
issueId: null
---

# 页面卸载兜底释放 Storage 访问上下文

给浏览器侧 Storage 访问上下文补上页面卸载释放路径：`pagehide`（非 bfcache）时对本页面仍持有的上下文发 keepalive DELETE，消除「反复刷新把单客户端 32 份签发额度占满 → 页面整体失去存储连接」。

## 来源与授权

2026-10-02 开发者授权执行（会话原话「给你授权，那个存储访问看你的意思做」），对应 `.local/PLAN.md` 待办 4 的存储访问上限缓解项。背景：服务端 `STORAGE_ACCESS_CONTEXT_CLIENT_LIMIT = 32`、空闲 30 分钟才回收，而客户端 `closeStorageContext` 只在工作台释放 / 工作面切换时调用，页面刷新不释放——每个页面加载会签发多份上下文（layout / editor-session / world-engine / user-record 各自独立签发 user 上下文，进入 Project 再各自签发 project 上下文），几轮刷新即撞上限，页面出现「暂时无法建立新的存储连接」。

## 范围与非目标

- 只改客户端：`app/utils/storage/host-context-client.ts`（签发登记 + pagehide 兜底释放）与 `docs/specs/storage/persistence.md`（行为合同补一行）。
- 不改服务端限额、空闲回收与失败语义（上游设计，本改动保持附加式）；不改正常释放路径的语义，只追加「成功后移出待释放登记」。
- 不做 `visibilitychange` 释放（标签页切换时页面仍活着）；bfcache 暂存的页面保留其上下文（`persisted` 时跳过），避免恢复后的页面失去存储访问。
- 不动 workbench 各 session 模块的上下文数量结构（共享签发是上游架构问题，另行评估）。

## 当前 Task

| Task | 当前范围 |
|---|---|
| [t01](tasks/t01-storage-context-unload-release/README.md) | 已交付并验证：pagehide keepalive 释放 + 单测 + spec 一行 + 无头探针实测 |

已收尾：663ee9d6；待清理：`.worktree/w00032-storage-context-unload-release`、`fix/w00032-storage-context-unload-release`。
