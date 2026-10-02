---
schema: nbook.task/v2
taskId: t01-rp-mode-rename
---

# RP模式 → rp-mode

## 目标与范围

- canonical 源：`packages/neuro-book/assets/workspace/.nbook/agent/skills/RP模式/` → `rp-mode/`；`SKILL.md` frontmatter `name: rp-mode`，补 `metadata.displayName: RP 模式`（正文标题可保留中文）。
- 引用同步：`vitepress/locales/zh-Hans/agent/skills.md` 与 `en-US/agent/skills.md` 的「历史」段（现文为「保留但当前不可用」）。
- 存量副本：`packages/neuro-book/server/workspace-files/legacy-agent-asset-tombstones.ts` 补 `agent/skills/RP模式/` 条目；`SkillCatalog` 的 `DISABLED_LEGACY_SKILL_KEYS` 隔离旧 key（与 `anti-ai-slop` 下线处理同构：墓碑负责可证明的清理，catalog 负责任何残留目录不可见）。
- 验证：skill 相关聚焦测试；`skill-creator/scripts/quick_validate.py rp-mode` 通过；用 `seedSystemAssets` 装机后确认 State Root 安装 `rp-mode`、账本旧条目转 removed，且 SkillCatalog 只剩新 id。

## 已知影响面（2026-10-02 调查）

- 测试零引用（`grep RP模式 --include=*.test.ts` 无命中）；profile 白名单不含它（全仓唯一 `skills.include` 在 `leader.assets`）；`leader.default.profile.tsx:389` 明确「本 leader 不提供 Roleplay（RP）模式」。
- 上游自 2026-08-22 未动产品 Skill 资产；本项安排在 2026-10-02 的空操作同步（0 behind / 51 ahead）之后立即执行，冲突窗口最小。

## 证据

- 已提交（worktree 分支）：`cfb0dc4b` 目录改名（git 识别为 rename）+ frontmatter + vitepress 中英引用 + 墓碑前缀（带 2026-10-02 改名说明）；`3eefd3d8` 隔离旧 skill key（`skill-catalog.ts` 的 `DISABLED_LEGACY_SKILL_KEYS` 增 `RP模式` + 回归测试）；`85017047` 快照。
- 结构校验：`skill-creator/scripts/quick_validate.py rp-mode` → `Skill is valid.`（exit 0）；canonical 源里旧目录已不存在。
- 聚焦测试（worktree）：`bun run --cwd packages/neuro-book test server/agent/skills server/agent/profiles/{leader-assets-profile,profile-dsl,rp-profiles,writer-profile-contract}.test.ts server/workspace-files/system-asset-installation.test.ts` → 9 文件 / 175 测试，173 通过；`rp-profiles.test.ts` 2 条失败（`NEURO_BOOK_REPOSITORY_ROOT` 缺失）在未改动 master 上同样失败，属既有基线。`skill-catalog.test.ts` 单跑 9/9（含新增「改名后的旧 skill key 不再进入 catalog，新 key 正常可见」）。
- 存量迁移 preflight（worktree 代码，只读）：`preservedOrphans=[agent/skills/RP模式/SKILL.md]`、`removals=[]`、`bundled=39, dirty=[], local=[skill:RP模式]`——本机 `.system-assets-sync-state.json` 无 `agent/skills/` 条目，普通墓碑按合同「保留待人工处理」；**未执行 `--apply`**：它不删任何文件，只会把旧包从账本重分类为 local，与改名语义不符。
- 装机验证（worktree 代码直接调 `seedSystemAssets`，与 `source-runtime.ts` 同参）：首次 `seeded:true`、无 fail-closed，`nbookHash 371783fc→5ca0feae`、`nbookFiles 251→252`；账本 `rp-mode` installed（`bc6acbf0…`）、`RP模式` → removed（`removedAt 2026-10-02T06:45:02Z`）；State Root 的 `rp-mode/SKILL.md` 与 seed 逐字节一致（sha256 `72b17beb…`）；再次运行 `seeded:false` 幂等。
- SkillCatalog 实测（State Root 安装根）：列表只含 `rp-mode`，`get("RP模式") → null`（旧目录仍在磁盘，被 legacy key 隔离）。
- 调查发现：受管树（skills/workflows/profiles）任何带外改动都会在 `readInstallState` 触发 fail-closed（「system install root 内容已被修改」，`hashAgentTree` 覆盖整棵受管树）；手动删除旧目录后实测复现，按原字节恢复（与 master 检出逐字节一致，sha256 `a14f01d9…`）后重新幂等。旧目录按协议保留，由 catalog 隔离。

## 未验证

- legacy 投影实例上的迁移删除路径未实测（本机无 sync-state 证明）；该路径依赖 `lastSyncedUserHash` 与磁盘一致，属上游合同范围。
- 未跑真实 Agent 会话：RP 入口已下线，本项只影响 catalog 与安装账本，无会话行为可验证。
- 未合并 master、未推送。

## 执行位置

`.worktree/w00029-rp-mode-rename`，分支 `feat/w00029-rp-mode-rename`。
