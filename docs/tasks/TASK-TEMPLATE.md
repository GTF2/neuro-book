# 任务书模板

> 前线指挥部创建新任务时复制本文件为 `docs/tasks/任务NNN-短名.md` 并填写。
> 任务书必须**自包含**：工程队只读这一个文件（加仓库根 AGENTS.md 定制节）就应能开工，不依赖任何聊天记录。

```markdown
# 任务NNN-短名

## 运行配置（开工前设置，本节由前线填写完整）

- **本会话模型**：（完整 ID，如 `account:bigmodel-individual-coding-plan/GLM-5.3-Flash`）+ 推理档位（如 high）。若当前会话未在此配置，开工第一句先提醒用户切换。
- **模式**：（目标模式/计划模式/工作流模式/普通+完全访问 之一 + 一句理由）
- **给用户的现成命令**（让用户直接粘贴，省得他想）：
  - 目标模式示例：`/goal 任务NNN-短名：完成 <一句话目标>，按任务书验收标准交付`
  - 工作流示例：`/workflow 按 docs/tasks/任务NNN-短名.md 并行执行，子代理用 GLM-5.3-Flash$high`
- **工作流子代理模型**（仅工作流模式需要，写全）：`subagent_model: "GLM-5.3-Flash$<档位>"`——完整 ID + $档位后缀，缺一不可，简写"Flash+high"无法直接设置。
- **工作流发布纪律**（2026-09-22 参谋部立规，凡工作流模式必写进脚本；复盘见 `docs/design/009-单D-阶段复盘.md` 第五节）：
  1. 施工类子代理的 ask 必须以「写完用 ls 验证文件存在且非空，返回绝对路径」收尾——落盘验证压进子代理职责，脚本不得信任裸返回；
  2. artifact 发布前脚本先预检 `world.run("ls", ["-la", path])`，exitCode 非零先打回施工员重写，不进发布（win32 下 ls 若无法直接 spawn，改用 `world.run("node", ["-e", "const fs=require('fs');const s=fs.statSync(process.argv[1]);process.exit(s.isFile()&&s.size>0?0:1)", path])` 同义预检）；
  3. catch 兜底发布也要 try 包裹，最终失败降级为 log + 把文件路径写进 return——发布失败不得判整个 run 死刑（活儿完成即完成）。
  - 顺带两规：脚本中文文本内引号一律全角「」防嵌套编译错；DOM/文案断言词表必须先核对 i18n 真实用词（R2「4 项档位」误教案）。
- **对口技能与命令**（必填；没有合适的写"无"）：列出本任务用得上的已装技能名 + 触发时机，让工程队直接调用而不是手工摸索。常用对照：
  - 代码/diff 审查 → `ocr-review`；过度工程检查 → `ponytail-review`
  - UI 设计/评审/打磨 → `impeccable`（detect 命令在仓库外跑）；UI/UX 方案检索 → `ui-ux-pro-max`
  - 安全相关 → `security-audit`
  - dev server 页面验证/截图 → `browser-use:control-browser` 或 `web-gui-tester`
  - GitHub 操作（PR/issue/release/Actions）→ `github:pr` / `github:issue` / `github:release` / `github:workflow-run`
  - 长任务自主跑 → `/goal`；多路并行编排 → `/workflow`

## 目标
（一句话：要达成什么，为什么）

## 开工前置
1. 读 `D:\MyProject\neuro-book\AGENTS.md` 的"本 Fork 工作规矩"节（绝对路径，worktree 内向上搜索可能读不到）
2. 读本任务书全文（含运行配置，确认模式/模型已就位）
3. 确认工作位置正确（按任务书指定模式二选一）：worktree 模式→在 `D:\MyProject\worktrees\task-NNN` 目录内（`git rev-parse --show-toplevel` 验证，仅多窗口并行场景）；主仓库分支模式→`git branch --show-current` 输出任务书指定分支（串行默认）；无 worktree 的文档任务跳过本条

## 范围与边界
- 允许改动：（文件/目录清单，尽量精确）
- 禁止改动：（如：master、其他包、.agents/ 治理文件、上游 AGENTS.md 正文）
- 不确定时：停下，在任务书"疑问区"登记，待前线答复

## 步骤建议
（可选。按需给出执行顺序，但允许工程队在边界内自主调整）

## 验收标准
- （可客观验证的条件：命令+预期输出、截图、测试通过数）
- **UI 截图规范**：默认视口 1920×1080（16:9 桌面）；涉及响应式/移动端另加 390×844 一张；同类页面每次用相同视口，保证可比。
- 交付报告必须包含：改动文件清单、每个关键决策的理由、自测证据、遗留问题

## 参考材料
- （路径引用：docs/reference/、相关 spec、上游文档）

## 疑问区（工程队填写）
（空）

## 交付报告（工程队填写）
（空。格式：做了什么/为什么/自测结果/遗留问题/本窗口会话 ID）
```
