# 任务016-llmlint测试补齐

## 运行配置（开工前设置，本节由前线填写完整）

- **本会话模型**：`account:bigmodel-individual-coding-plan/GLM-5.3-Flash`，推理档位 **high**。若当前会话未在此配置，开工第一句先提醒用户切换。
- **模式**：**目标模式 + 完全访问**——缺口明确（web/ 缺 tsconfig 致 24 个测试文件无法收集）、验收客观（测试可收集且通过），小任务自主连跑。
- **工作区**：主仓库 `D:\MyProject\neuro-book`，开工先 `git checkout task-016`（分支已建好；2026-09-20 起串行代码任务用主仓库普通分支，不用 worktree）。
- **给用户的现成命令**（直接粘贴）：
  ```
  /goal 任务016-llmlint测试补齐：按任务书补齐 web tsconfig 使 24 个测试文件可收集并通过，写交付报告
  ```

## 目标

修复任务005（测试基线）登记的遗留缺口：`packages/llmlint/web/` 缺 tsconfig 导致 `bun run --cwd packages/llmlint test` 的 vitest 阶段 24 个测试文件 TSCONFIG_ERROR 无法收集。补齐后 llmlint 包测试全量可跑，测试基线完整。

## 开工前置

1. 读 `D:\MyProject\neuro-book\AGENTS.md` 的"本 Fork 工作规矩"节
2. 读本任务书全文；确认当前分支为 `task-016`（`git branch --show-current` 验证；checkout 前先确认工作区干净）
3. 主仓库环境已就绪（node_modules 共享，任务004 已装；主应用生成物已生成），无需环境三步

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

（空）

## 交付报告（工程队填写）

（空。格式：做了什么/为什么/自测结果/遗留问题/本窗口会话 ID）
