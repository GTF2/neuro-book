# 任务011-tiptap笔记

## 运行配置（开工前设置，本节由前线填写完整）

- **本会话模型**：`account:bigmodel-individual-coding-plan/GLM-5.3-Flash`，推理档位 **high**。若当前会话未在此配置，开工第一句先提醒用户切换。
- **模式**：**目标模式 + 完全访问**——代码调研+归纳成单一文档。
- **工作区**：`D:\MyProject\neuro-book` 主工作区（master 分支）直接执行，**无 worktree**（文档类任务豁免）。工程队不执行任何 git commit，文件写好后由前线统一提交。
- **给用户的现成命令**（直接粘贴）：
  ```
  /goal 任务011-tiptap笔记：按任务书整理 TipTap 3 在本项目的用法与扩展点，产出 docs/knowledge/tiptap-notes.md，完成后在任务书末尾写交付报告
  ```

## 目标

整理 TipTap 3（富文本编辑器框架）在本项目的实际用法、装配位置与扩展方法，产出开发笔记，为将来编辑器功能开发省掉重新摸索的成本。

## 开工前置

1. 读 `D:\MyProject\neuro-book\AGENTS.md` 的"本 Fork 工作规矩"节（尤其工程队分区规则）
2. 读本任务书全文，确认模式/模型已就位
3. 确认在 `D:\MyProject\neuro-book` 主工作区（master 分支）：`git rev-parse --show-toplevel` 应输出该路径

## 范围与边界

- 允许改动：仅新建 `docs/knowledge/tiptap-notes.md`；本任务书疑问区与交付报告
- 禁止改动：任何源码、配置、master 分支提交、BOARD、其他任务书
- 只读代码调研；可以 web 查 TipTap 3 官方文档补官方说法（标注链接），不改任何代码

## 执行步骤

1. 全仓 grep `@tiptap/` 与 `@milkdown` 的引用点，列出本项目启用的全部 TipTap 扩展（starter-kit、markdown、table、image、placeholder、code、link、hard-break、extension-suggestion 等，以实际 grep 结果为准）及版本（package.json）
2. 定位编辑器封装组件（在 `packages/neuro-book` 内，找装配 `extensions` 数组的文件），记录：文件路径、装配了哪些扩展、每个扩展的作用一句话
3. 找出项目内的自定义扩展/节点视图（如果有），说明其结构与挂载方式
4. 从现有代码归纳"给编辑器加一个新扩展"的步骤清单（改哪些文件、注意什么），并与 TipTap 3 官方文档对照，标官方链接
5. 写 `docs/knowledge/tiptap-notes.md`：① 本项目 TipTap 用法总览 ② 扩展清单表 ③ 装配位置与代码地图 ④ 新增扩展步骤 ⑤ 版本与升级注意（TipTap 3 相对 2 的关键差异，官方出处）

## 产出文件

- `docs/knowledge/tiptap-notes.md`（唯一交付物）

## 验收标准

- 扩展清单与 grep 结果一一对应，装配文件路径真实可点
- "新增扩展步骤"有本项目代码依据（引用真实文件），官方对照标注链接

## 完成定义（AGENTS.md 硬标准，文档任务变体）

任务完成 = ① 产出文件已写入仓库工作区 ② 任务书交付报告已填（做了什么/为什么/自测结果/遗留问题/本窗口会话 ID）③ 任务书内声明"待审"。BOARD 状态更新与 git 提交由前线在审查通过后执行。**仅在聊天中报告结果不算完成。**

## 参考材料

- `packages/neuro-book/package.json`（TipTap 版本）
- TipTap 3 官方文档 https://tiptap.dev/docs（外链，按需查证）

## 疑问区（工程队填写）

（空）

## 交付报告（工程队填写）

**做了什么**：产出 `docs/knowledge/tiptap-notes.md`：三套编辑器装配总览（Markdown Studio 主编辑器/纯文本引用输入器/Agent composer + llmlint web 一处）、官方扩展 13 项与自定义扩展 18 项清单表（含 priority 与文件路径）、装配代码地图、"新增扩展"7 步清单（含本项目特有的 tokenizer priority<1390 约束与 dialect/UI 两层扩展组的选择规则）、v3 升级注意 4 条（官方 @tiptap/markdown、StarterKit 收编 Link/Underline、去 lockstep 版本，均注官方链接）。

**为什么**：为将来编辑器功能开发省掉重新摸索成本；本项目 TipTap 用法相当深度（Markdown 方言 tokenizer + 双层扩展组 + 测试 schema 共用），不做记录极易踩坑。

**自测结果**：扩展清单与 grep `@tiptap/` 结果一一对应（主应用 30+ 文件全部归类）；装配文件路径均真实存在且已打开核对（markdown-editor-extensions.ts 全文、markdown-dialect-extensions.ts 全文、plain-reference-text-extensions.ts 全文、AgentHardBreak/AgentSkillNode 开头）；priority 数字（1500/1390/1400/1190/1185/1180/1175/1150）摘自源码；官方说法 4 条标注来源链接。全程只读。

**遗留问题**：`InlineAiReferenceHighlight.ts` 与 `Comment.ts` 的插件细节未逐行读（清单层面已覆盖，深度开发时再读）。

**状态**：**待审**。

**本窗口会话 ID**：sess_f7630ad3-9078-4e74-b751-945479569d6e
