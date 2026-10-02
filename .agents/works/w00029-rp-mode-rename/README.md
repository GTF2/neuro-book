---
schema: nbook.work/v1
workId: w00029-rp-mode-rename
issueId: null
---

# RP模式 改名为 rp-mode（最小改动）

把产品 Skill 里唯一违反 id 合同的 `RP模式` 改成 kebab-case id，并清掉存量机器上的旧目录。

## 来源与授权

2026-10-02 开发者确认改名路线并要求最小改动（「上游如果要更新，那咱们这个就应该做最小改动，改名应该是对的吧」），随后授权执行全部待办。id 合同见 `assets/reference/agent/skill-package.md`（`name` 必须等于父目录名、小写字母数字连字符）；Task 135 Open Item 4 记录的 `RP模式` 改名即本项。

## 范围与非目标

- canonical 源目录改名 + frontmatter 合规 + vitepress 中英引用同步 + 墓碑条目与存量迁移。
- 不改 Skill 内容语义（RP 入口已下线，本项只解决 id 合同）。
- 不归档 `skill-creator-zh`（另项）。

## 当前 Task

| Task | 当前范围 |
|---|---|
| [t01](tasks/t01-rp-mode-rename/README.md) | 改名 + 引用同步 + 墓碑迁移 + 验证 |

已收尾：28144b1f；待清理：无（2026-10-02 清理完成：worktree 与分支均已删除）。
