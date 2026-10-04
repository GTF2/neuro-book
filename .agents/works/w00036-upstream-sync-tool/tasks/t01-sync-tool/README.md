---
schema: nbook.task/v2
taskId: t01-sync-tool
---

# 上游同步试算工具

行为合同未变：本 Task 只新增一个只读分析脚本与一条命令，不改产品行为；它把 [`docs/standards/repository-workflow.md`](../../../../../docs/standards/repository-workflow.md) 的「上游同步（fork）」纪律变成可执行判断，分级口径以该节为唯一真相源。

## 目标与范围

一条命令算出「上游改动 ∩ fork 改动」的真实冲突面：

- **试合并**：`git merge-tree --write-tree` 不落盘试合并，给出真实冲突文件清单（`--write-tree` 只写对象库，不动工作树与 HEAD）。
- **重叠面**：fork 改过 **且** 上游也改过的文件——即使文本能自动合并（无冲突）也列出，因为那正是语义冲突候选。这是纯「冲突文件清单」拿不到的信息。
- **分级建议**：按 fork 纪律分 `fork-only`（天然零冲突）/ `shared-leaf`（叶子注册点，核对登记行并列）/ `shared`（上游热区则逐行对照语义）。
- **热区判定**：按提交数阈值（≥8 提交/60 天），不用文件触碰次数——纪律明确要求。

## 非目标

- 不自动合并、不改工作树、不落盘、不推送（试合并只写 git 对象库）。
- 不替代人工判断：脚本给依据，合并决策由开发者做。
- 不改同步纪律正文（`repository-workflow.md` 保持唯一真相源，脚本只在其中登记命令入口）。

## 证据

- 新增：`scripts/git/upstream-sync-report.ts` + `upstream-sync-report.test.ts`（6 例）。
- 改动：`package.json`（`sync:upstream`）、`scripts/vitest.config.ts`（include 加 `scripts/git/**`，否则测试「写了但从不跑」）、`docs/standards/repository-workflow.md`（登记命令）。
- 只读保证由测试锁定：冲突场景断言 HEAD 与 `git status --porcelain` 均不变。

## 验证

- 聚焦测试：`bun x vitest run --config scripts/vitest.config.ts scripts/git/upstream-sync-report.test.ts` → **6/6 通过**。用例覆盖：干净分叉的窗口计数与分类、**重叠但不冲突**（同文件双方改不同区域：试合并干净但必须进重叠面）、真实冲突（merge-tree 报文件且不落盘）、落后为 0 时不提示合并、叶子注册点建议、热区按提交数阈值。
- 真实仓库实测：`bun run sync:upstream --no-fetch` 输出 落后 0 / 领先 105、试合并干净、重叠面 0、安全区 130 文件——与 2026-10-02 手工核实的冲突面结论一致（零同步债）。

## 执行位置

`.worktree/w00036-upstream-sync-tool`，分支 `feat/w00036-upstream-sync-tool`。
