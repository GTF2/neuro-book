---
schema: nbook.task/v2
taskId: t01-skill-creator-zh-alignment
---

# skill-creator-zh 规则对齐

## 目标与范围

- `scripts/quick_validate.py`：按合同重写校验规则——顶层字段白名单（name/description/when_to_use/license/compatibility/metadata/allowed-tools）、`name` 必须小写字母数字连字符且等于父目录名、description ≤1024、compatibility ≤500、`metadata.version`/`metadata.minAppVersion` 为 canonical SemVer、固定入口 `SKILL.md`、禁用词与 canonical 同步（含 `~/.codex/skills`）。
- `scripts/init_skill.py`：id 必须 ASCII kebab（≤64）；中文名走 `--display-name` → `metadata.displayName`；默认输出根改为脚本所在 skills 根（`Path(__file__).resolve().parents[2]`），替换失效的 `assets/agent/skills`。
- `SKILL.md`：规则段落同步（frontmatter 字段表、id 规则、catalog 读取 name/description/when_to_use、固定入口 SKILL.md、init 的 `--display-name`）。

## 验证

- 双校验器判定对照：对 seed 里全部内置 Skill 逐个跑 canonical 与 zh 两个 `quick_validate.py`，退出码必须一致（预期全部通过）。
- 失败注入（对齐 Task 135 的用例）：name 与目录名不符、大写 id、连续连字符、非 SemVer `metadata.version`、未知顶层 key、空 description、`metadata` 写成内联值——zh 校验器必须按对应原因拒绝；含 `metadata` / `when_to_use` 列表 / `license` / `minAppVersion` 的合法用例必须通过。
- 端到端：`init_skill.py` 生成（纯 ASCII id + 中文 `--display-name`）→ 两个校验器均通过；中文 id 被 init 拒绝。
- 装机验证：合并后从 master 跑一次 `seedSystemAssets`，确认 State Root 里的 `skill-creator-zh` 更新为对齐后的版本。

## 证据

（待填）

## 未验证

（待填）

## 执行位置

`.worktree/w00031-skill-creator-zh-alignment`，分支 `fix/w00031-skill-creator-zh-alignment`。
