---
schema: nbook.work/v1
workId: w00031-skill-creator-zh-alignment
issueId: null
---

# skill-creator-zh 对齐 canonical 合同

把 `skill-creator-zh` 的校验器、生成器与规则文档对齐到 `assets/reference/agent/skill-package.md` 合同，消除与 `skill-creator` 的相反结论。

## 来源与授权

2026-10-02 开发者授权执行计划（`.local/PLAN.md` 待办 2）中选定的最小改法：对齐 `skill-creator-zh` 的 `quick_validate.py`，而不是归档该 skill（归档要动 `leader.assets` profile、重编 artifact、改测试与文档，且会撤掉中文 skill）。实施中发现生成器与 SKILL.md 的规则文本同样停留在旧合同（放行中文 id、只认 name/description、默认输出到旧路径），只改校验器会让 skill 自相矛盾，因此本 Work 的落地范围含同一条规则面上的三处。

## 范围与非目标

- 只改 `packages/neuro-book/assets/workspace/.nbook/agent/skills/skill-creator-zh/` 内的 `scripts/quick_validate.py`、`scripts/init_skill.py`、`SKILL.md` 的规则段落。
- 对齐的是**接受/拒绝规则与生成语义**（id 字符集与长度、name 必须等于目录名、允许的 frontmatter 字段与约束、固定入口 `SKILL.md`、默认输出到脚本所在 skills 根、中文名走 `metadata.displayName`），不要求逐行同构实现；中文输出与中文模板保留。
- 不改 `skill-creator`（canonical 侧）；不改 `assets/reference/agent/skill-package.md`；不归档 zh skill。

## 当前 Task

| Task | 当前范围 |
|---|---|
| [t01](tasks/t01-skill-creator-zh-alignment/README.md) | 已交付并验证：校验器/生成器/SKILL.md 规则对齐（双校验器 16/16 判定一致） |

已收尾：8d2b64d6；待清理：`.worktree/w00031-skill-creator-zh-alignment`、`fix/w00031-skill-creator-zh-alignment`。
