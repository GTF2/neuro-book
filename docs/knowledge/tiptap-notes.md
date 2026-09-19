# TipTap 3 用法笔记（任务011 产出）

> 生成：2026-09-20，工程队常驻窗口。基于全仓 grep 实际引用 + 关键文件阅读，官方说法标注链接。版本基线：`@tiptap/*` **^3.23.1**（`packages/neuro-book/package.json`）。

## ① 本项目 TipTap 用法总览

主应用（`packages/neuro-book`）有 **三套编辑器装配**，外加 llmlint web 一处：

| 编辑器 | 组件（装配入口） | 扩展组工厂 | 用途 |
|---|---|---|---|
| Markdown Studio 主编辑器 | `app/components/markdown-studio/TipTapMarkdownEditor.vue`（`useEditor` @ L217） | `createMarkdownEditorExtensions` | 章节正文写作，输入输出始终是 Markdown |
| 纯文本引用输入器 | `app/components/common/form/ReferencePlainTextEditor.vue`（`useEditor` @ L158） | `createPlainReferenceTextExtensions` | Agent 输入框等纯文本 + 引用 chip 场景 |
| Agent composer 输入器 | `app/components/novel-ide/agent/`（复用 plain 组，`AgentComposerInput.vue` 等） | 同上 | Agent 聊天输入 |
| （llmlint web）审阅编辑器 | `packages/llmlint/web/app/components/ReviewEditor.vue` | 独立装配 | llmlint 子应用 |

**核心设计**：
- **两层扩展组**。`markdown-dialect-extensions.ts`（schema 基座 + 全部 Markdown 方言扩展，无 UI 依赖，与 vitest 测试共用单一来源，防测试 schema 与真实 schema 分叉）+ `markdown-editor-extensions.ts`（追加表格/图片/菜单/引用 chip 等 UI 层扩展）。
- **Markdown 是第一公民**。用官方 [`@tiptap/markdown`](https://tiptap.dev/docs/editor/markdown) 做双向解析/序列化；自定义扩展实现 `markdownTokenizer`/`markdownTokenName` 接口接入方言语法（注音、双语对照、评论、对齐等）。
- **tokenizer 执行顺序陷阱**（`markdown-editor-extensions.ts` L40-48 注释）：marked 的 extension tokenizer 后注册者先执行；MarkdownManager 按 TipTap priority 降序注册，**priority 越低的 tokenizer 越先执行**。`HtmlBlock`/`RawInlineHtml` 兜底扩展持最高 priority（1390/1400，最后执行），**新增带 tokenizer 的方言扩展 priority 必须低于它们**。
- **StarterKit 深度裁剪**：方言组里关掉 code/hardBreak/link/paragraph/trailingNode，用项目自己的 `MarkdownCode`/`AgentHardBreak`/`MarkdownLink`/`MarkdownParagraph` 替换（`MarkdownParagraph` 处理 defaultType 陷阱，见该文件注释）；纯文本组裁得更狠（只留文档骨架）。

## ② 扩展清单表

### 官方扩展（grep `@tiptap/` 实际引用）

| 扩展 | 版本 | 在本项目的用法 |
|---|---|---|
| `@tiptap/vue-3` | ^3.23.1 | `useEditor`/`EditorContent`/`VueNodeViewRenderer`；`vue-3/menus` 用于选区菜单 |
| `@tiptap/core` | ^3.23.1 | `Node`/`Extension`/`mergeAttributes`/`PluginKey` 类型基础 |
| `@tiptap/starter-kit` | ^3.23.1 | 基座，两处均深度 configure 裁剪 |
| `@tiptap/markdown` | ^3.23.1 | 官方双向 Markdown（方言组基座第一项） |
| `@tiptap/extension-table` | ^3.23.1 | `TableKit` 一揽子注册（UI 层） |
| `@tiptap/extension-image` | ^3.23.1 | `inline: true, allowBase64: false` |
| `@tiptap/extension-placeholder` | ^3.23.1 | 占位符（两组均用） |
| `@tiptap/extension-link` | ^3.23.1 | 被 `MarkdownLink` 包装（openOnClick 等 configure） |
| `@tiptap/extension-code` | ^3.23.1 | 被 `MarkdownCode` 包装 |
| `@tiptap/extension-paragraph` | ^3.23.1 | 被 `MarkdownParagraph` 包装（priority 1500） |
| `@tiptap/extension-hard-break` | ^3.23.1 | 被 `AgentHardBreak` 包装（`renderMarkdown: () => "\n"`） |
| `@tiptap/suggestion` | ^3.23.1 | @ 引用与 / 命令的触发菜单（多 pluginKey 并存） |
| `@tiptap/pm/*` | ^3.23.1 | state/model/view 直接访问 ProseMirror 层 |

### 项目自定义扩展（全部在主应用内，无第三方自定义）

| 扩展 | 文件 | 类型 | 作用 | priority |
|---|---|---|---|---|
| `MarkdownParagraph` | `markdown-studio/tiptap/MarkdownParagraph.ts` | Node | 高优先级段落（defaultType 陷阱） | 1500 |
| `RawInlineHtml` / `HtmlBlock` / `HtmlBlockBridge` | `markdown-studio/tiptap/HtmlFallback.ts` | Node | 原始 HTML 兜底 tokenizer | 1390/1400（最高，最后执行） |
| `MarkdownCode` | `MarkdownCode.ts` | Mark | 行内代码方言（替换 StarterKit code） | — |
| `MarkdownLink` | `MarkdownLink.ts` | Mark | 链接方言（包装 extension-link） | — |
| `MarkdownAlign` | `MarkdownAlign.ts` | Mark/Attr | 对齐语法 | — |
| `MarkdownRuby` | `MarkdownRuby.ts` | Mark | 注音（ruby）语法 | — |
| `MarkdownBilingual` | `MarkdownBilingual.ts` | Node | 双语对照语法 | — |
| `MarkdownTextColor`/`Highlight`/`Sub`/`Sup` | `MarkdownTextMarks.ts` | Mark 组 | 文字色/高亮/上下标 | — |
| `Comment` / `CommentBlock` | `Comment.ts` | Mark+Node | 行内评论（含评论列表变化回调插件） | — |
| `HtmlEmbed` | `HtmlEmbed.ts` | Node | `<html>` 嵌入卡（iframe 数据接口由宿主注入，默认拒绝） | — |
| `WorkspaceReference` | `WorkspaceReference.ts` | Node | 工作区引用 chip（@ 触发，多 kind suggestion） | — |
| `MarkdownSlashCommand` | `MarkdownSlashCommand.ts` | Extension | / 命令菜单 | — |
| `MarkdownInlineCodeShortcut` | `MarkdownInlineCodeShortcut.ts` | Extension | 行内码快捷键 | — |
| `InlineAiReferenceHighlight` | `InlineAiReferenceHighlight.ts` | 装饰 | AI 引用高亮 | — |
| `AgentHardBreak` | `novel-ide/agent/tiptap/AgentHardBreak.ts` | Mark | 换行直接序列化 `\n`（不产生硬换行空格） | — |
| `AgentSkill` | `novel-ide/agent/tiptap/AgentSkillNode.ts` + `AgentSkillNodeView.vue` | Node+VueNodeView | `$skill` 技能节点（唯一 Vue NodeView 用例） | 1150 |
| `agent-suggestion.ts` | 同目录 | 渲染器 | 建议菜单渲染/展平/插入工具（两套输入器共用） | — |
| `PlainReference`/`PlainSelectionReference`/`PlainImage`/`PlainPendingImage`/`PlainSlashCommand` | `common/form/tiptap/plain-reference-text-extensions.ts` | Node/Extension 组 | 纯文本输入器的引用/图片/命令（含上传中重试/移除 UI） | 1190/1185/1180/1175 |

## ③ 装配位置与代码地图

```text
packages/neuro-book/app/components/
├── markdown-studio/
│   ├── TipTapMarkdownEditor.vue          # useEditor 装配点（主编辑器）；useEditorChangeDebounce 做变更防抖
│   ├── MarkdownSelectionMenu.vue         # 选区浮动菜单（vue-3/menus + pm/state/view）
│   └── tiptap/
│       ├── markdown-dialect-extensions.ts   # ★ 方言核心（测试共用单一来源）
│       ├── markdown-editor-extensions.ts    # ★ 完整编辑器扩展组（UI 层追加）
│       ├── markdown-editor-extensions.test.ts / empty-document-default.test.ts / dialect-fallback-dom.test.ts
│       └── （各自定义扩展 .ts，见②表）
├── common/form/
│   ├── ReferencePlainTextEditor.vue      # 纯文本输入器 useEditor 装配点
│   └── tiptap/plain-reference-text-extensions.ts  # ★ 纯文本扩展组工厂
└── novel-ide/agent/tiptap/               # Agent 输入器共享件（HardBreak/Skill/suggestion）
packages/neuro-book/nuxt.config.ts        # L72-76 optimizeDeps 含 @tiptap/core 等
```

## ④ 给编辑器加一个新扩展：步骤清单

以"Markdown Studio 加一个新方言扩展"为例（本项目代码依据见括号）：

1. **选类型**：语法承载 → `Node`/`Mark`；触发菜单/行为 → `Extension`（参照 `MarkdownRuby.ts`、`MarkdownSlashCommand.ts`）。
2. **建文件**：放 `app/components/markdown-studio/tiptap/`（主编辑器）或 `common/form/tiptap/`（纯文本输入器），命名与现有风格一致（`Markdown*.ts`）。
3. **若是 Markdown 方言**：实现 `markdownTokenizer`/`markdownTokenName`，**priority 必须低于 1390**（HTML 兜底最后执行，见 `markdown-editor-extensions.ts` L40-48）；段落类要注意 `MarkdownParagraph` 的 1500 defaultType 陷阱。
4. **注册到 dialect 层还是 UI 层**：带 tokenizer 的进 `createMarkdownDialectExtensions`（`markdown-dialect-extensions.ts` L30-57，测试与真实编辑器共用）；纯 UI（菜单/命令/chip）进 `createMarkdownEditorExtensions`（L50-106）。
5. **宿主回调通过 configure 注入**，扩展内不直接 import store/API（现有模式：`resolveMenu`/`onCommentsChange`/`resolveHtmlEmbedDataApi` 等全部由 `MarkdownEditorExtensionOptions` 传入）。
6. **补测试**：dialect 层扩展在 `markdown-editor-extensions.test.ts` / `dialect-fallback-dom.test.ts` 有对应验证模式（schema 共用是刻意的，新扩展不进 dialect 层会导致测试 schema 漂移——文件头注释记录过此类事故）。
7. **官方对照**：自定义扩展通用做法 Node/Mark/Extension + addAttributes/addProseMirrorPlugins 与 [TipTap 自定义扩展文档](https://tiptap.dev/docs/editor/extensions/custom-extensions/extend) 一致；Markdown 集成遵循 [integrate-markdown-in-your-extension](https://tiptap.dev/docs/editor/markdown/guides/integrate-markdown-in-your-extension)。

## ⑤ 版本与升级注意（v3 相对 v2 关键差异）

本项目锁 `^3.23.1`。升级/新写代码注意：

1. **官方 Markdown 支持是 v3 新事物**：[`@tiptap/markdown`](https://tiptap.dev/docs/editor/markdown)（双向，2025-10 发布）取代 v2 时代社区 [tiptap-markdown](https://github.com/aguingand/tiptap-markdown)；本项目方言机制（markdownTokenizer）构建在其上，升级大版本先看该包 changelog。出处：[官方发布公告](https://tiptap.dev/blog/release-notes/introducing-bidirectional-markdown-support-in-tiptap)。
2. **StarterKit 收编了 Link / Underline / ListKeymap**（[3.0 stable 发布说明](https://tiptap.dev)，2025-07-12）：再手动添加这些扩展会冲突；本项目已用 `StarterKit.configure({link: false, ...})` 裁剪后替换自有实现，升级 StarterKit 子模块时注意保持裁剪项同步。
3. **各扩展包版本不再 lockstep**（[v3 roadmap 讨论 #5793](https://github.com/ueberdosis/tiptap/discussions/5793)）：升级时逐包核对，不能假设全套同版本。
4. **v2→v3 迁移整体可控**（[Liveblocks 迁移指南](https://liveblocks.io)、[Mantine 迁移指南](https://mantine.dev)）——本项目已在 v3 上，仅需关注后续 minor 的 behavior 变化。

## 调研来源

- 代码：上表所列文件（路径均真实可点）；grep `@tiptap/|@milkdown` 全仓 30+ 文件，主应用外仅 `packages/llmlint/web/` 一处（ReviewEditor/ReviewSelectionMenu）。
- 官方：[Tiptap 3.0 stable](https://tiptap.dev)、[Markdown 文档](https://tiptap.dev/docs/editor/markdown)、[Markdown 集成指南](https://tiptap.dev/docs/editor/markdown/guides/integrate-markdown-in-your-extension)、[v3 roadmap #5793](https://github.com/ueberdosis/tiptap/discussions/5793)、[Liveblocks v2→v3](https://liveblocks.io)、[Mantine v2→v3](https://mantine.dev)
