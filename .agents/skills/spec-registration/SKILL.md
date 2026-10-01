---
name: spec-registration
description: 新增或修改 Spec、晋升成熟度、起草 Proposal 或维护规范路由表时使用；审查文档可读性用 doc-review。
---

# Spec 与 Proposal 登记

流程正文在 [Spec 指令](../../../docs/specs/AGENTS.md)、[Spec 注册表](../../../docs/specs/README.md) 与 [Proposal 流程](../../../docs/proposals/README.md)。本 Skill 只列登记纪律和易错点。

## Spec

- `capability` 全仓唯一且文件移动不变；新增前先查注册表，行为相近时并入既有 capability，不开新条目。
- 黑盒合同用固定九段结构；`implemented` 必须在读过实现、调用方和相关测试后核实，并带实现入口、合同测试、Smoke 三条标签行。
- `planned` → `implemented` 需开发者明确接受，不由实现者自行晋升。
- 冲突归因：代码偏离 `implemented` 合同是 bug；规范失真则修规范并记录依据；原 Spec 已被对外承诺或测试锁定时，须 Reviewer 复核加开发者确认，不由实现者单方改写。

## Proposal

五态生命周期 draft/reviewing/accepted/rejected/superseded：draft 与 reviewing 不构成当前行为依据，accepted 才可落成 `planned` Spec；Proposal 本身不是执行授权。

## 规范路由表

- `docs/standards/code/README.md` 按「改动路径 → 规范」增行；只加领域级路径，不混入单个 Work 或 Task 的专属路径。
- 保持 Markdown 表完整：不插入空行切断表体，新行沿用既有表头列序；改完以 `docs:check` 收口。

## 完成条件

capability 唯一、成熟度与批准依据如实，机器结构检查与语义审查各有结论，路由表按改动路径可命中。
