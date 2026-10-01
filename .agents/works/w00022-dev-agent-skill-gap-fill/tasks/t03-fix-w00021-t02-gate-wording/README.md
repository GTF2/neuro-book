---
schema: nbook.task/v2
taskId: t03-fix-w00021-t02-gate-wording
---

# 修复 w00021 t02 快照的门禁合规措辞

## 目标与范围

开发者要求顺手修掉 w00021 t02 的 `docs:check` 警告。该警告的原因是措辞而非缺失声明：[t02 README](../../../w00021-provider-connection-identity-edit/tasks/t02-connection-identity-save-contract/README.md) 已写明「本 Work 不涉及已登记 Spec 覆盖的行为」并核实 `docs/specs/` 没有 provider 配置保存的 capability，但门禁按字面匹配「行为合同未变」（`check-documentation.ts` 的 `text.includes`）。本次只把该句改写为以「行为合同未变」开头，保留原判断依据，不改语义、不动其它内容。

## 行为合同

行为合同未变：只调整一个 Task 快照句子的措辞以通过机器门禁，不改产品行为、Spec 合同与门禁脚本。

## 非目标

不修其余 73 条存量警告（含 w00021 t01 的同类警告），它们仍按 Work README 非目标留给后续清理 Task。

## 证据

- `bun run docs:check` → `failures: []`；warnings 从 74 条降回 73 条，w00021 t02 的警告消失，其余与基线一致。
- `bun run governance:check` → `failures: []`、`warnings: []`。

## 执行位置

主工作区（master），不建 worktree。
