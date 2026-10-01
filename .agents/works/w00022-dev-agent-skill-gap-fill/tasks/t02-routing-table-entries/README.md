---
schema: nbook.task/v2
taskId: t02-routing-table-entries
---

# 四个新 Skill 加入根路由表

## 目标与范围

开发者 2026-10-02 追加决定：不先观察清单自动触发效果，直接把本 Work 新建的 4 个 Skill 挂进根 `AGENTS.md` 路由表，作为不依赖模型判断的确定性加载通道：

- 「创建、推进或恢复 current 工作」行：work-registry、task-snapshot；
- 「测试、fixture、验收、缓存、临时数据」行：verification-evidence；
- 「新功能、bug 期望不明确或长期行为变化」行：spec-registration。

## 行为合同

行为合同未变：只改治理文档（根 `AGENTS.md` 路由表与本 Work 登记），不改产品行为、Spec 合同与机器门禁脚本。

## 非目标

不调整路由表其余行与 Conventions 正文；低优先候选 Skill 仍不做。

## 证据

- `bun run governance:check` → `failures: []`、`warnings: []`。
- `bun run docs:check` → `failures: []`；warnings 共 74 条，其中 73 条为本 Task 开工前的存量（66 条 Spec 链接 + 7 条越仓），新增 1 条来自并行集成的 w00021 t02（9b003ed2），均与本次改动无关；`AGENTS.md` 与 w00022 相关文件零警告。

## 执行位置

主工作区（master），不建 worktree。
