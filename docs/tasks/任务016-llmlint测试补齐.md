# 任务016-llmlint测试补齐

## 运行配置（开工前设置，本节由前线填写完整）

- **本会话模型**：`account:bigmodel-individual-coding-plan/GLM-5.3-Flash`，推理档位 **high**。若当前会话未在此配置，开工第一句先提醒用户切换。
- **模式**：**目标模式 + 完全访问**——缺口明确（web/ 缺 tsconfig 致 24 个测试文件无法收集）、验收客观（测试可收集且通过），小任务自主连跑。
- **工作区**：worktree `D:\MyProject\worktrees\task-016`（分支 `task-016`，涉码任务不豁免）。
- **给用户的现成命令**（直接粘贴）：
  ```
  /goal 任务016-llmlint测试补齐：按任务书补齐 web tsconfig 使 24 个测试文件可收集并通过，写交付报告
  ```

## 目标

修复任务005（测试基线）登记的遗留缺口：`packages/llmlint/web/` 缺 tsconfig 导致 `bun run --cwd packages/llmlint test` 的 vitest 阶段 24 个测试文件 TSCONFIG_ERROR 无法收集。补齐后 llmlint 包测试全量可跑，测试基线完整。

## 开工前置

1. 读 `D:\MyProject\neuro-book\AGENTS.md` 的"本 Fork 工作规矩"节（绝对路径，worktree 内向上搜索可能读不到）
2. 读本任务书全文；确认在 `D:\MyProject\worktrees\task-016`（`git rev-parse --show-toplevel` 验证）
3. worktree 环境三步：`bun install` → `bun run --cwd packages/neuro-book nuxt:prepare` → `bun run --cwd packages/neuro-book generate`（llmlint test 链路可能依赖主应用生成物，按需执行）

## 范围与边界

- 允许改动：`packages/llmlint/web/` 下新增 tsconfig 相关文件；`packages/llmlint/` 内与测试收集直接相关的最小配置调整
- 禁止改动：`packages/llmlint/skill/`（Skill 单一源，第三方素材只读）、其他包、源码逻辑（本任务只补配置，不修测试本身暴露的代码问题）
- 若补齐 tsconfig 后测试暴露真实失败：**不修产品代码**，如实记录失败清单进交付报告（那是新基线信息，等前线定夺）

## 执行步骤

1. 复现缺口：`bun run --cwd packages/llmlint test`，确认 24 文件 TSCONFIG_ERROR 现象与任务005 基线报告记载一致
2. 查看 llmlint 包内其他子目录（如根、web 之外的 tsconfig）与 vitest 配置，按项目既有模式补 `web/` 的 tsconfig（extends 根配置或按 vitest 约定，**优先复用包内已有模式，不发明新配置**）
3. 重跑 `bun run --cwd packages/llmlint test`：确认 24 个文件全部可收集；统计通过/失败/跳过
4. 有失败则按边界条款记录不修；全绿则记录数字
5. 交付报告：改动文件、选择的 tsconfig 模式与理由、前后对比（收集数/通过数）、遗留问题、会话 ID

## 产出与交付

- 分支 `task-016` 上的配置改动（不合并，等前线审）
- 任务书末尾交付报告

## 验收标准

- 24 个测试文件全部可收集（vitest 无 TSCONFIG_ERROR）
- 改动仅限边界内文件；skill/ 目录零改动（`git diff --stat` 佐证）

## 完成定义（AGENTS.md 硬标准）

任务完成 = ① 分支已提交（涉码任务）② 交付报告已填 ③ 任务书声明"待审"。BOARD 更新与合并由前线执行。

## 参考材料

- `docs/tasks/evidence/任务005/测试基线.md`（llmlint 段：24 文件收集失败的原始记录）
- `docs/tasks/任务005-测试基线.md` 疑问区第 2 条（本任务来历）

## 疑问区（工程队填写）

1. **根因与任务书预期不符**：`web/tsconfig.json` 一直存在且正确（extends `.nuxt/tsconfig.json` 是 Nuxt 标准模式）；TSCONFIG_ERROR 的根因是 web 子项目的两个**本机生成步骤**缺失——`cd web && bun install`（web 有独立 bun.lock，装 diff-match-patch 等 818 包）与 `bun x nuxt prepare`（生成 `.nuxt/tsconfig.json`）。两者均为 gitignore 生成物，**本任务 repo 零文件改动**。
2. **持久化建议（请前线定夺）**：新 clone/CI 直接跑 `bun run --cwd packages/llmlint test` 仍会复现收集失败。如需固化，最小改法是把 `cd web && bun install && bun x nuxt prepare` 挂进 llmlint test 链或 README 开发前置节——因涉及 test script 与第三方包安装行为，超出"零配置改动"的实测结论，未擅自落地。

## 交付报告（工程队填写）

**做了什么**：诊断 24 文件 TSCONFIG_ERROR 的真实根因（web/tsconfig.json extends 生成物 `.nuxt/tsconfig.json` 断链 + web/node_modules 缺失致 diff-match-patch 找不到），在本机补齐两个生成步骤（`cd web && bun install` 818 包、`bun x nuxt prepare` 生成类型），验证全部测试恢复。**repo 零文件改动**（skill/ 零改动佐证边界遵守；web/bun.lock 无变化）。

**为什么**：修复任务005 登记的 llmlint 测试收集缺口。

**自测结果（前后对比）**：
- 前（任务005 基线）：36 文件中 24 个 TSCONFIG_ERROR 收集失败，仅 12 文件 119 条可跑。
- 后：`bun run --cwd packages/llmlint test` 完整链（registry:build → test:vitest → test:bun）全通——**vitest 36/36 文件、346 条全绿；bun test 80 条全绿**；无 TSCONFIG_ERROR、无 FAIL。

**遗留问题**：疑问区 2（持久化固化方案待前线定夺）；新基线数字（346+80）建议前线更新任务005 基线报告口径。

**状态**：**待审**。

**本窗口会话 ID**：sess_f7630ad3-9078-4e74-b751-945479569d6e
