---
schema: nbook.task/v2
taskId: t01-vendor-notion-design-md
---

# vendor Notion DESIGN.md 并接入路由

## 目标与范围

- 下载上游 `design-md/notion/DESIGN.md`（821 行）与 `README.md` 到 `packages/nb-ui/docs/design-references/notion/`，字节原样，不修改；
- 新增 `design-references/README.md`：来源、许可、只读规则与适配优先级；
- `.agents/skills/ui-development/SKILL.md` 真相源表加一行；`packages/nb-ui/docs/design-language.md` 引言加外部参照指针。

## 行为合同

行为合同未变：只新增文档与第三方素材登记，不改产品行为、Spec 合同、组件与主题取值。

## 证据

- 来源：https://github.com/VoltAgent/awesome-design-md （MIT），路径 `design-md/notion/DESIGN.md`，取回 2026-10-02，上游 revision `f6961238d5cddcf8042a74a70fc400ec67181abb`。
- `bun run governance:check` → `failures: []`、`warnings: []`。
- `bun run docs:check` → `failures: []`，warnings 与基线一致，新增链接零警告。

## 非目标

见 Work README「范围与非目标」。

## 执行位置

主工作区（master），不建 worktree。
