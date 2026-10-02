---
schema: nbook.task/v2
taskId: t01-rp-mode-rename
---

# RP模式 → rp-mode

## 目标与范围

- canonical 源：`packages/neuro-book/assets/workspace/.nbook/agent/skills/RP模式/` → `rp-mode/`；`SKILL.md` frontmatter `name: rp-mode`，补 `metadata.displayName: RP 模式`（正文标题可保留中文）。
- 引用同步：`vitepress/locales/zh-Hans/agent/skills.md` 与 `en-US/agent/skills.md` 的「历史」段（现文为「保留但当前不可用」）。
- 存量副本：`packages/neuro-book/server/workspace-files/legacy-agent-asset-tombstones.ts` 补 `agent/skills/RP模式/` 条目；按前置条件跑 `scripts/cli/migrate-legacy-agent-assets.ts --preflight` 再 `--apply`（依赖 `.system-assets-sync-state.json` 的 `lastSyncedUserHash` 与磁盘一致；不可证明未手改的进 preservedOrphans）。
- 验证：skill 相关聚焦测试；`skill-creator/scripts/quick_validate.py rp-mode` 通过；重启 dev server 装机后确认 State Root 里 `rp-mode/` 已安装、旧 `RP模式/` 目录已被迁移清理（SkillCatalog 只读目录、不读账本墓碑）。

## 已知影响面（2026-10-02 调查）

- 测试零引用（`grep RP模式 --include=*.test.ts` 无命中）；profile 白名单不含它（全仓唯一 `skills.include` 在 `leader.assets`）；`leader.default.profile.tsx:389` 明确「本 leader 不提供 Roleplay（RP）模式」。
- 上游自 2026-08-22 未动产品 Skill 资产；本项安排在 2026-10-02 的空操作同步（0 behind / 51 ahead）之后立即执行，冲突窗口最小。

## 证据

- 已提交（worktree 分支）：`cfb0dc4b` —— 目录改名 `RP模式` → `rp-mode`（git 识别为 rename，99% 相似）、frontmatter `name: rp-mode` + `metadata.displayName: RP 模式`、vitepress 中英「历史」段引用同步、`legacy-agent-asset-tombstones.ts` 的 `LEGACY_TOMBSTONED_ASSET_PREFIXES` 补 `agent/skills/RP模式/`（带 2026-10-02 改名说明）。
- 结构校验：`skill-creator/scripts/quick_validate.py rp-mode` → `Skill is valid.`（exit 0）；canonical 源里旧目录已不存在。
- 聚焦测试（worktree，`bun run --cwd packages/neuro-book test server/agent/skills server/agent/profiles/{leader-assets-profile,profile-dsl,rp-profiles,writer-profile-contract}.test.ts server/workspace-files/system-asset-installation.test.ts`）：9 文件 / 175 测试，173 通过；`rp-profiles.test.ts` 2 条失败（`NEURO_BOOK_REPOSITORY_ROOT` 缺失）在未改动 master 上同样失败，属既有基线。

## 未验证

- 存量迁移未执行：`scripts/cli/migrate-legacy-agent-assets.ts` 的 `--preflight` / `--apply` 尚未跑；State Root 里旧的 `agent/skills/RP模式/` 目录是否被清理（取决于 `.system-assets-sync-state.json` 的同步证明；证明不了会进 preservedOrphans 保留并报 dirty）待确认。
- 装机验证未做：需要从 worktree 起 dev server 触发 `seedSystemAssets`（安装 `rp-mode`、账本标记旧条目 removed），再确认 SkillCatalog 只剩新 id。
- 未合并 master、未推送。

## 执行位置

`.worktree/w00029-rp-mode-rename`，分支 `feat/w00029-rp-mode-rename`。
