---
schema: nbook.task/v2
taskId: t01-create-high-priority-skills
---

# 创建第一批高优先 Skill

## 目标与范围

新建 `verification-evidence`、`work-registry`、`task-snapshot`、`spec-registration` 四个 Skill 并登记进 `.agents/skills/README.md`。内容为缺口分析确定的要点，真相源链接回原文档，不复制条款。

## 行为合同

行为合同未变：本 Task 只新增开发 Agent 治理层的 Skill 文档与索引登记，不改产品行为、Spec 合同与机器门禁脚本。

## 当前状态

已收尾：实现与验证完成，随 8ba96499 进入 master，Work README 已记收尾行。

## 证据

- `bun run governance:check` → `failures: []`、`warnings: []`，新 Work/Task 登记通过机器合同。
- `bun run docs:check` → `failures: []`，warnings 73 条与改动前基线一致（66 条 Spec 链接 + 7 条越仓，均为存量）；按文件过滤，w00022 与 4 个新 Skill 无任何警告。
- 本次改动均为治理文档，按 [验证门禁](../../../../../docs/testing/README.md#验证门禁) 未跑产品测试、typecheck 与构建。

## 非目标

见 Work README「范围与非目标」。

## 执行位置

主工作区（master），不建 worktree，无需 checkout 核对。
