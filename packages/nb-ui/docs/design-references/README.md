# 外部设计参照（vendored）

本目录存放第三方 DESIGN.md 审美参照，按「第三方素材保持只读」治理：文件字节原样保留，不修改、不翻译；来源、许可与取回 revision 在此登记，登记正文在对应 Work/Task。

## 条目

### notion/

- 来源：https://github.com/VoltAgent/awesome-design-md `design-md/notion/DESIGN.md`（MIT 许可，随源仓库）
- 取回：2026-10-02，上游 revision `f6961238d5cddcf8042a74a70fc400ec67181abb`
- 用途：UI 优化的审美参照——色彩角色（暖墨层级、hairline）、字阶与留白节律、控件几何（8px 矩形非胶囊）、组件样式
- 优先级：与判据冲突时以 [`../design-language.md`](../design-language.md) 为唯一真相源；营销页专属模式（hero band、定价表、装饰插画）不进产品界面
- CJK 适配：负字距与紧行高只适用于拉丁 display 字号，汉字排版按 design-language.md §四（字距为 0、行高 1.5、强调用楷体）
