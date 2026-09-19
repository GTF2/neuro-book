# 任务012-llmlint中文素材

## 运行配置（开工前设置，本节由前线填写完整）

- **本会话模型**：`account:bigmodel-individual-coding-plan/GLM-5.3-Flash`，推理档位 **high**。若当前会话未在此配置，开工第一句先提醒用户切换。
- **模式**：**目标模式 + 完全访问**——仓库内素材整理+少量 web 检索，产出单一文档。
- **工作区**：`D:\MyProject\neuro-book` 主工作区（master 分支）直接执行，**无 worktree**（文档类任务豁免）。工程队不执行任何 git commit，文件写好后由前线统一提交。
- **给用户的现成命令**（直接粘贴）：
  ```
  /goal 任务012-llmlint中文素材：按任务书整理 llmlint 相关中文资料，产出 docs/knowledge/llmlint-zh-materials.md，完成后在任务书末尾写交付报告
  ```

## 目标

整理 llmlint（本仓库 `packages/llmlint/`，LLM 输出 lint 的 Skill 单一源）的相关中文资料，形成一份中文素材文档，降低后续维护/推广该包时的语言门槛。

## 开工前置

1. 读 `D:\MyProject\neuro-book\AGENTS.md` 的"本 Fork 工作规矩"节（尤其工程队分区规则）
2. 读本任务书全文，确认模式/模型已就位
3. 确认在 `D:\MyProject\neuro-book` 主工作区（master 分支）：`git rev-parse --show-toplevel` 应输出该路径

## 范围与边界

- 允许改动：仅新建 `docs/knowledge/llmlint-zh-materials.md`；本任务书疑问区与交付报告
- 禁止改动：`packages/llmlint/` 内任何文件（第三方素材只读原则）、其他源码、master 提交、BOARD
- web 检索只读公开页面，引用注明来源链接

## 执行步骤

1. 读 `packages/llmlint/` 结构与文档（README、skill 定义、registry），弄清：llmlint 是什么、解决什么问题、怎么用（产品投影关系见根 AGENTS.md"仓库结构"节）
2. 收集仓库内中文素材：中文文档段落、注释、规则名/用例的中文说明，整理成清单（标注文件路径）
3. web 检索补充：LLM 输出质量/lint 相关的中文社区资料（文章、讨论、类似工具），标注来源链接与一句话摘要；检索不到就如实写"无公开中文资料"，不编造
4. 写 `docs/knowledge/llmlint-zh-materials.md`：① llmlint 一页说明（中文）② 仓库内中文素材清单 ③ 外部中文参考资料 ④ 术语对照表（英→中）

## 产出文件

- `docs/knowledge/llmlint-zh-materials.md`（唯一交付物）

## 验收标准

- "llmlint 是什么/怎么用"与包内实际文档一致（可对照复核）
- 所有外部资料带来源链接；检索不到的部分如实标注，无编造

## 完成定义（AGENTS.md 硬标准，文档任务变体）

任务完成 = ① 产出文件已写入仓库工作区 ② 任务书交付报告已填（做了什么/为什么/自测结果/遗留问题/本窗口会话 ID）③ 任务书内声明"待审"。BOARD 状态更新与 git 提交由前线在审查通过后执行。**仅在聊天中报告结果不算完成。**

## 参考材料

- `packages/llmlint/`（包本身；`packages/llmlint/skill/` 是 Skill 单一源）
- 根 `AGENTS.md`"仓库结构与文件路由"节

## 疑问区（工程队填写）

（空）

## 交付报告（工程队填写）

（空。格式：做了什么/为什么/自测结果/遗留问题/本窗口会话 ID）
