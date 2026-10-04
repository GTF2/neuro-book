---
schema: nbook.task/v2
taskId: t01-capability-gap-audit-skill
---

# 能力面接线审计 Skill

行为合同未变：本 Task 只新增开发 Agent 治理层的 Skill 文档、索引登记与路由表行，不改产品行为、Spec 合同与机器门禁脚本。

## 目标与范围

新增 `.agents/skills/capability-gap-audit/SKILL.md`：把「功能面 ↔ 消费点接线」的缺口分析方法沉淀成可触发 Skill，覆盖三个检索方向（工具 → 消费点、workflow → 消费点、Skill → 工具的反向悬空承诺检查），并给出判定口径与易错点。同时登记进 `.agents/skills/README.md` 与根 `AGENTS.md` 路由表。

方法来源：w00022 的缺口分析（两路调查 → 候选 → 按证据强度挑选）与 w00026 的接线实测（`save_promise_beat` 曾零命中，是真实缺口）。

## 非目标

- 不新增机器门禁、不改 `governance:check` 脚本、不改产品资产（`assets/workspace/.nbook/agent/**`）。
- 不做自动修复：审计只出清单与依据，修复另开 Work。
- 不复制 Spec 条款；真相源留在原文档。

## 证据

- 新增：`.agents/skills/capability-gap-audit/SKILL.md`。
- 改动：`.agents/skills/README.md`（索引加行）、`AGENTS.md`（路由表加「能力接线审计」行）。
- **Skill 内三条命令均在真实仓库实测可跑**（2026-10-04）：
  - 工具清单：运行时枚举 `createBuiltinTools()` → 46 个工具（对比：正则解析只命中 15/46，三种定义形态并存会漏）。
  - workflow 引用：9 个 workflow 全部有 Skill 引用（`split-book` 1 个，其余 ≥2）。
  - 悬空承诺：`comm -23` 差集**零命中**（当前 master 无悬空承诺）。
- 实测踩到并写进 Skill 的两个坑：① Git Bash 的 CRLF 会让 `comm` 误判（需 `tr -d '\r'` + `LC_ALL=C sort`）；② 工具定义有三种形态，必须用运行时清单而非正则。

## 验证

- `bun run docs:check`：0 failures；本 Work 与 Skill 零警告。
- `bun run governance:check`：failures/warnings 均为空。
- 三条检索命令逐条实跑通过（见「证据」）。
- 纯治理文档改动，按验证门禁未跑产品测试、typecheck 与构建。

## 执行位置

主工作区（master），不建 worktree——纯治理文档，与 w00022 同型。
