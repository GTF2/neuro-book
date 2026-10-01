---
schema: nbook.work/v1
workId: w00024-ui-design-reference-adoption
issueId: null
---

# UI 设计参照引入（awesome-design-md 选型）

从 VoltAgent/awesome-design-md 中选定一份 DESIGN.md 作为 UI 优化的审美参照，vendor 进仓库并接入文档路由。本 Work 先做引入与文档登记，UI 优化本身是后续 Task。

## 来源与授权

2026-10-02 开发者指定 https://github.com/VoltAgent/awesome-design-md ，要求挑出对项目设计帮助最大的一份，只动 UI 做适配兼容（预期与上游冲突大，故 UI 层独立演进），并更新文档让并行开发窗口知晓。

选型为 **Notion**（`design-md/notion/DESIGN.md`），理由：

- 文档型工作区的组件词汇（文档树、页面、callout、表格、侧栏、弹层）与小说工作台的稿面/设定/剧情界面同构；
- 「暖墨色阶 + hairline 优先 + 克制的控件几何（8px 矩形按钮非胶囊）」与 nb-ui 现行判据同向：paper 暖轴（`design-language.md` §一）、线优先于框（§二）、状态色分工固定（§五），适配成本低；
- 补足现行 `design-language.md` 的薄弱面：内容页审美（文字层级、留白节律、强调的克制），该文档在材料/几何/动效纪律上极强，但内容页审美着墨少。

对比候选：Linear 偏冷色精密工具向，与 paper 暖轴相抵；Apple 与现行体系同源（`nbook` 主题即 macOS 衍生，判据大量引自 Apple 实测），增量最小；Mintlify 偏文档站，应用组件词汇不足。

## 范围与非目标

- 新增 `packages/nb-ui/docs/design-references/notion/`（DESIGN.md 与 README.md 字节原样 vendor）与目录 README（来源登记）；
- 接入 `.agents/skills/ui-development/SKILL.md` 真相源路由与 `design-language.md` 引言指针；
- 不改组件、主题与任何取值；
- DESIGN.md 从营销页提取：hero band、定价表、装饰插画等营销专属模式不进产品界面；
- 判据冲突时以 `design-language.md` 为唯一真相源：可证伪判据优先于审美参照；CJK 排版按其 §四修正（负字距与紧行高不适用于汉字）。

## 收尾

[t01](tasks/t01-vendor-notion-design-md/README.md) 已实现并验证。

已收尾：451071f8；待清理：无
