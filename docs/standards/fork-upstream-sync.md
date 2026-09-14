# Fork 上游同步与防冲突规则

> 本仓库是 `GTF2/neuro-book` fork（origin），上游是 `notnotype/neuro-book`（upstream）。
> 本文件规定 fork 与上游的同步节奏、改动边界和冲突处理。写作行为相关的裁决仍以
> [`../doctrine/writing-doctrine.md`](../doctrine/writing-doctrine.md)（写作宪法）为准。

## 远程与分支

| 远程 | 用途 |
|---|---|
| `upstream`（notnotype/neuro-book） | 上游主干；持续演进，是合并来源 |
| `origin`（GTF2/neuro-book） | 本 fork；推送目标 |

- `master` 保持**上游镜像**：只接受 `git merge upstream/master`（快进或合并），不叠加 fork 自有提交。
- fork 的功能开发在 `feat/*` / `fix/*` 分支进行；周期性把上游合并进功能分支（见下）。

## 同步节奏

1. **开工前**：`git fetch upstream && git merge upstream/master`（在功能分支）。落后太多再合并会让冲突面扩大。
2. **合并后**：至少跑 `bun run docs:check`；改动过治理文件再跑 `bun run governance:check`。
3. **合并验证基准**（2026-09-14 实测）：当时落后 1 个提交、领先 31 个；双方同时改过
   `docs/testing/README.md` 与 `packages/neuro-book/package.json`，合并**零冲突**——
   证明下述"外科手术式改动"策略有效。

## 防冲突设计规则（新功能必须遵守）

1. **加法优先**：新能力＝新文件（新 service / repository / workflow 目录 / reference 文档 / DTO 段）。
   修改上游共享文件是最后手段，不是第一手段。
2. **共享文件只做外科手术**：小范围、连续、不重排格式、不做大段重写。
   典型允许：枚举加一项（如 `ChapterWriterBriefMode` 加 `slice-only`）、方向表加一行、路由加一个分支。
   典型禁止：重排章节、改文件名、全文件格式化、重写上游正文风格。
3. **上游领地永不删除**：上游仍在维护的文件与目录（见下"上游领地清单"），删除会产生
   modify/delete 冲突——这是唯一一类**难以解决**的冲突。判定为死代码的也**只记录、不删除**。
4. **fork 治理进独立目录**：写作宪法与实验记录在 `docs/doctrine/`；本文件在 `docs/standards/`。
   不移动、不重构上游的目录结构。
5. **`.nbook` 资产同样适用**：新增 workflow/skill 是加法；避免改名上游既有资产目录，
   否则每次上游更新该资产都会冲突。
6. **命名约定**：fork 新增的能力/文件使用语义化通用名，不带上游作者或 fork 品牌前缀；
   避免与上游未来可能新增的同名文件撞车。
7. **同步失败不硬推**：合并冲突无法在语义层解决时（上游重构了同块逻辑），
   保留双方行为并以最小适配层满足两侧，issue/记录说明取舍，不删除任一方的合同。

## 上游领地清单（不删除、只读引用；2026-09-14 普查）

| 类别 | 路径 | 说明 |
|---|---|---|
| 自治包（主应用未接线但上游/CI 仍在维护） | `packages/nb-memory`、`packages/nb-ui`、`packages/neuro-agent-harness` | nb-memory/nb-ui 是收编项目；harness 是 llmlint 依赖 + 上游独立仓 |
| 桌面双壳 | `desktop/tauri/` | 契约层仍承认 tauri envelope（contracts/manager/security-audit），但无构建路径；删除会让上游契约变死码 |
| 下线但保留的写作资产 | `profiles/builtin/` 的 `rp.*`、`simulator.*`、`director`；`skills/RP模式`；`reference/agent/rp-tick/` | 上游有意保留（旧会话可解码、可手动恢复）；勿删 |
| Legacy 任务档案 | `.agents/tasks/`（约 84 目录）、`packages/neuro-book/.agents/tasks/`（91 目录）、各包 `.agents/tasks/` | 已封存为 provenance；PROJECT-STATUS 有证据链接 |
| 历史文档 | `packages/neuro-book/docs/{archived,research}/`、`vitepress/**/changelog/` | 归档区；不改写、不删除 |
| 上游脚本 | `scripts/**` 中被 CI/release 引用的全部；`packages/neuro-book/scripts/{build,cli,db,deploy,seed,smoke}` | 按外科手术规则修改 |

## 死代码观察清单（已判定不用；按规则**不删除**，记录待上游处理）

判定标准：全库 0 引用（无 npm script、无 CI、无 import、无文档入口）。

| 路径 | 判定依据 |
|---|---|
| `packages/neuro-book/scripts/db/migrate-ming-ding-zhi-shi-2-embedding-text.ts` | 一次性迁移，已执行；0 引用 |
| `packages/neuro-book/scripts/db/migrate-postgres-users-to-sqlite.mjs` | 一次性迁移；0 引用 |
| `packages/neuro-book/scripts/db/migrate-project-workspaces.ts` | 一次性迁移；0 引用 |
| `packages/neuro-book/scripts/maintenance/cleanup-empty-world-subject.ts` | 一次性本地清理；0 引用 |
| `scripts/git/fix-fenced-commit-messages.mjs` | 0 引用 |
| `scripts/ci/tutorial-assets.ts` | 导出函数仅被自测引用，未接入 docs:check/CI |
| `scripts/deploy/profile-artifact-manifest.mjs` | 仅自测引用 |
| `desktop/packaging/measure.mjs`、`tree-digest.mjs` | 0 引用；measure 还引用永不存在的 tauri 构建产物 |
| 根 `assets/`、`server/`、`workspace/`、`logs/` | 本检出不存在；`.gitignore` 已标为本机运行残留 |

## 已知待改的不一致（fork 侧任务，不改上游结构）

写作宪法接线后仍按旧范式叙述的文档（全部为共享上游文件，按外科手术规则逐段改，第二波执行）：

- `README.md` / `README.en.md`：Plot 段落"信息控制＝写作时强制生效" → 切片 + 事后校验，工作链补"人定帧 → 模型补间"。
- `vitepress/{zh-Hans,en-US}/core/plot-workbench.md`：同冲突；并缺关键帧说明。
- `vitepress/{zh-Hans,en-US}/profile/writer.md`、`profile/leader.md`：brief 输入契约与三模式。
- `vitepress/{zh-Hans,en-US}/tutorials/04-first-three-chapters.md`、`tutorials/03-skills-bootstrap.md`、`agent/tools.md`、`core/world-engine.md`：主链与 phase 05 同步（中英必须对等，改完跑 `docs:check`）。
- `CONTRIBUTING.md`/`.en.md`：`.agents/tasks/` 行已过时（应为 `.agents/works/`）。
- `PROJECT-STATUS.md`：产品运行时/最新收口版本行滞后于 `RELEASE.md`（0.10.2）。
