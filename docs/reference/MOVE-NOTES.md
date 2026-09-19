# 搬家说明（2026-09-15）

从 CodeBuddy 工作区搬到 D 盘，交给新的 Agent 继续开发。

## 从哪来

源：`C:\Users\Administrator\CodeBuddy\NeuroBook\`（**已保留，未删除**）

## 这里有什么

```
D:\MyProject\
├── neuro-book\     仓库本体（排除 node_modules，依赖需重装）
├── .codebuddy\     10 条项目规则 + 执行计划 + neurobook-verify 技能
│                   ↑ 注意：这些不在 git 里，只 clone 仓库拿不到
└── _archive\       老工作区根目录的散落产物（未落地的东西）
                    ├─ 5 份 *-redesign.html + ui-redesign-handoff.md（UI 重设计，各带"待确认"）
                    ├─ PROJECT-HEALTH-CHECK.md / -FIX-REPORT.md
                    ├─ agent-rules-audit.md、CODEBUDDY.md、serve.js
```

## 没搬的

- 所有 `node_modules`（含 `packages/*` 各包），约 1.3G → 到新家重装
- 垃圾：5 张 `debug-*.png`、`dev-server.log` / `.err.log`、`debug-*.mjs`、`tmp-test-out.txt`、`out/`

## 恢复到可运行（已完成，2026-09-15 02:55 验证通过）

**新 Agent 不用重跑这几步。** 环境已经装好并验证过了：

```bash
cd D:\MyProject\neuro-book
bun install                                       # 已装，1.4G
bun run --cwd packages/neuro-book nuxt:prepare    # 已跑，exit 0，.nuxt 类型已生成
bun run --cwd packages/neuro-book generate        # 已跑，两个 Prisma Client (7.8.0) 生成成功
```

冒烟测试：`bun run --cwd packages/neuro-book test -- server/config`
→ **5 文件 / 80 测试全绿**（57.58s）

## ⚠️ 别重装依赖

node_modules（1.4G）是从**老工作区复制**过来的，不是 `bun install` 装的。

原因：`bun install` 在这台机器上跑了 49 分钟卡死（node_modules 停在 1.2G、进程活着但不再写文件，网络挂了）。改用 robocopy 从源目录增量复制，12 分半搞定。

**如果你觉得依赖有问题，先试复制，别急着 `bun install`。** 源目录还在：
`C:\Users\Administrator\CodeBuddy\NeuroBook\neuro-book\node_modules`

判断 install 是否卡死：`find node_modules -newermt "-3 minutes" | wc -l`，等于 0 且进程还在 = 卡住了。

## 接手先读（按顺序）

1. `neuro-book/HANDOFF.md` —— **唯一入口**。老 Agent 写的，含七条宪法、已完成 17 项、待办表、七条铁律、一张"本机环境怪癖"表（很值钱）
2. `neuro-book/PROJECT-STATUS.md` —— 现状与未收口项
3. `.codebuddy/rules/` —— 10 条规则，`working-agreement/` 是常驻的，其余按需加载

## 仓库快照（搬运时的状态，原样保留）

- 分支 `feat/writing-doctrine-alignment`，HEAD `0cd2ebdc`
- **有大量未提交改动**：260 staged / 12 unstaged / 7 untracked
- 其中 15 个属「Agent session follow-up 队列投递」在途工作，`HANDOFF.md` 第 56 行标记为"并行执行者在途，当前不可触碰"
- 落后 upstream 11 个提交

## 几条硬规矩（从 HANDOFF 抄的）

- 提交必须带身份：`git -c user.name=GTF2 -c user.email=GTF2@users.noreply.github.com commit ...`
- **永不 `git add -A`**，只 add 自己的文件（同仓可能有别的 AI 在并行）
- 上游领地永不删除（清单见 `docs/standards/fork-seams.md`）
- 应用跑在 `http://127.0.0.1:3000`，**别用 localhost**（Windows 会解析到 ::1，应用只监听 IPv4）
- 搜仓库用 `git grep --no-index`，别用 IDE 搜索（`assets/workspace` 被 gitignore 会被整棵跳过）
