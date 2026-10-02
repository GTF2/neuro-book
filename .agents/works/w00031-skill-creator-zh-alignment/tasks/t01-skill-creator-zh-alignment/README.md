---
schema: nbook.task/v2
taskId: t01-skill-creator-zh-alignment
---

# skill-creator-zh 规则对齐

## 目标与范围

- `scripts/quick_validate.py`：按合同重写校验规则——顶层字段白名单（name/description/when_to_use/license/compatibility/metadata/allowed-tools）、`name` 必须小写字母数字连字符且等于父目录名、description ≤1024、compatibility ≤500、`metadata.version`/`metadata.minAppVersion` 为 canonical SemVer、固定入口 `SKILL.md`、禁用词与 canonical 同步（含 `~/.codex/skills`）。
- `scripts/init_skill.py`：id 必须 ASCII kebab（≤64）；中文名走 `--display-name` → `metadata.displayName`；默认输出根改为脚本所在 skills 根（`Path(__file__).resolve().parents[2]`），替换失效的 `assets/agent/skills`。
- `SKILL.md`：规则段落同步（frontmatter 字段表、id 规则、catalog 读取 name/description/when_to_use、固定入口 SKILL.md、init 的 `--display-name`）。

## 证据

- 修复提交：`3d1ac5df`（3 文件，+228/-191）。
- 判定对照（`python .local/w00031-verify.py`，worktree 内）：seed 的 16 个内置 Skill 逐个跑 canonical 与 zh 两个校验器，**16/16 退出码一致（全通过）、mismatches=0**。
- 失败注入 8 例，两校验器判定一致且符合预期：name 与目录名不符、大写 id、连续连字符、非 SemVer `metadata.version`、未知顶层字段、空 description、内联 `metadata` 全部拒绝；含 `when_to_use` 列表 + `license` + `compatibility` + `metadata.displayName/version/minAppVersion` 的合法用例通过。
- 端到端：`init_skill.py plot-helper --display-name 爽文风格` 生成 `name: plot-helper` + `metadata.displayName: 爽文风格`，两个校验器均通过；`init_skill.py 我的技能` 被 init 自身拒绝（exit 1，未创建目录）。
- 装机验证：合并后从 master 跑 `seedSystemAssets`，State Root 的 `skill-creator-zh` 三个文件与 seed 逐字节一致（见下方补记）。

## 未验证

- 未跑真实 Agent 会话验证「用 zh skill 的 agent 会按新规则创建 skill」——规则一致性由脚本判定对照覆盖，会话行为属模型侧。
- 未改 `skill-creator`（canonical）与 `reference/agent/skill-package.md`；若上游更新合同，两边仍需同步。

## 执行位置

`.worktree/w00031-skill-creator-zh-alignment`，分支 `fix/w00031-skill-creator-zh-alignment`。
