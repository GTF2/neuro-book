# 交接文档（参谋部 → 前线指挥部）

> 写于 2026-09-19，由参谋部窗口（ZCode default 工作区）移交。
> 新窗口开工前**必读本文件 + 根 AGENTS.md 的"本 Fork 工作规矩"节**，即可获得全部背景，不依赖任何聊天记录。
> 上游规范（AGENTS.md 其余部分）继续生效；冲突时以定制节为准。

## 1. 项目是什么

NeuroBook：AI 长篇小说创作 IDE（Vue 3.5 + Nuxt 4 + Tailwind 4 + reka-ui + TipTap 3，Bun monorepo 12 包，SQLite+Markdown 本地优先）。本 fork 属主 GTF2（GitHub 账号 GTF2，git/gh 已配好）。定位：**纯自玩**，不联系上游作者，master 定期 rebase upstream。

用户背景：**编程小白**，借 AI 开发。沟通规矩见 AGENTS.md 定制节（大白话、结论先行、截图汇报、拿不准先问）。

## 2. 已定架构（不要再讨论，直接执行）

- **三窗口**：参谋部（只讨论）/ 前线指挥部（本窗口：架构、拆任务、审查、合并）/ 工程队（GLM-5.3-Flash 独立 3 亿额度窗口，干体力活）。
- **文件总线**：窗口间只走 `docs/tasks/`（任务板+任务书）与 git 分支；用户只传一句话指针。
- **任务协议**：中文短名+序号（任务004-环境验证）；前线写任务书时同步建好 worktree（`git worktree add .worktree/任务NNN -b 任务NNN`），工程队窗口直接打开该目录开工，交付写报告，关窗前留会话 ID。
- **质量门**：ocr Delegation 审查 / Impeccable detect（**必须在仓库外目录运行**，本仓库 npm overrides 会让 npx 报 EOVERRIDE）/ UI 三层评判（硬规则→visual-judge 截图→真人任务测试）。
- **额度纪律**：主订阅 5 小时限量很贵——批量/扫描/调研类活走工程队或 ZCode 闲时任务；前线只做判断和审查。

## 3. 当前环境状态（已验证）

| 项 | 状态 |
|---|---|
| 仓库 | `D:\MyProject\neuro-book`，master = upstream/master（4590627）+ 本批基建提交 |
| remote | origin=GTF2/neuro-book（fork），upstream=notnotype/neuro-book |
| bun | 1.4.2 在系统 PATH |
| 前任跑通记录 | dev server 起过、275 测试全绿（2026-09-15），详见 `../reference/NEXT-PLAN.md` |
| 已知坑 | ① 访问必须 `127.0.0.1:3000`（localhost→IPv6 失败）② Agent 沙箱拦子进程会让前端空白（先关沙箱再怀疑代码）③ bun --cwd 位置在 run 后 |
| 全局技能 | ponytail 系 / ocr-review / security-audit / ui-ux-pro-max / impeccable（均在 `~/.zcode/skills/`，新会话生效） |
| 实测结论 | nb-ui 组件库视觉层干净（0 发现）；主应用 251 vue 文件 17 条轻微问题；**项目复杂度病根在信息架构层，不在视觉层** |

## 4. 任务队列

见 `BOARD.md`。下一步：任务004（环境验证，前线第一个任务）→ 005/006/007（工程队·闲时）→ 008 等上游新 UI 上线后评测 → 009 用户拍板方向。

## 5. 红线

- 旧仓库（`D:\MyProject\neuro-book失败fork开发但可以学习经验\`）**只读参考，不合并不推送**。
- 不 force push；工程队不动 master；不向 upstream 推任何东西。
- 密钥不入库（上游 AGENTS.md 凭据边界条款继续生效）。
- 用户在聊天里贴大段内容/转述其他窗口输出时：提醒"走文件"。

## 6. 参考资产（docs/reference/）

- `NEXT-PLAN.md` / `MOVE-NOTES.md`：前任完整运行档案（启动命令、API 实测、坑位）——环境类问题先查这里。
- `*-redesign.html` ×6 + `ui-redesign-handoff.md`：前任做的 UI 重设计稿（工具卡/对话导航/编辑失败/提示增强/队列卡/模型设置）——将来 IA 重构的第一手参考，注意其状态是"待确认"，非已采纳方案。
