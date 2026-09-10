---
schema: nbook.task/v2
taskId: t06-v7-model-design
role: leader
---

# V7 模型设计

## 目标与授权

开发者于 2026-09-09 要求直接完成 V7 模型设计，反复推敲多种情况和工程可行性，文档落盘后再由开发者审查。需求基线是 [t05 requirements](../t05-v7-requirements/requirements.md)。本 Task 交付 reviewing 提案，不将设计自行晋升为 planned Spec，不启动业务实现或真实小说模型调用。

## 范围与产物

- [V7 提案入口](../../../../../docs/proposals/novel-memory-v7.md)：问题、方案、取舍、影响和审查入口。
- 提案链接的知识模型、维护与查询、场景验收附录：分别保存相应设计正文，Task 不复制合同。
- 本 README、`walkthroughs/design-review.md`：执行范围、反例审查、验证与未验证项。
- Work README 与提案目录 README：增加当前入口。

沿用 Work `w00005-novel-understanding-spike` 的 `.worktree/w00005-novel-understanding-spike`，分支 `feat/w00005-v6-ingest-viewer`；开始 revision 为 `467d9a30251eb65d50f8270f02e52e394b64140e`。已有 V6 改动、查看器和 t05 需求全部保留。本轮不暂存、提交、推送、发布或替换现有 nb-memory。

## 执行与验证

1. 阅读需求、历代模型和真实片段，区分观察、设计假设与已接受需求。
2. 完成身份、命题、情节、依据、时间与视角的模型，再设计整理、修正、发布、查询及恢复。
3. 对身份拆分、推导链、查询边界和工程事务做独立反例审查；逐项裁决并修改正文。
4. 核对八类使用场景、真实片段、合成反例、文档链接、治理身份及 whitespace，核验受保护文件未变。

当前工作只产生设计文档；运行时质量、模型效果、成本和性能需后续实验验证。完成状态与审查记录见 [设计复核](walkthroughs/design-review.md)。

## 本轮交付

2026-09-09 已完成提案入口及三份模型正文，状态 reviewing；包含真实第 8–10 章推演、60 行反例场景和八类需求映射。两轮独立反例审查的 10 个实质发现均已修正并定向复核闭合。文档、治理、链接及 whitespace 检查通过，V6/t05 受保护文件摘要一致；未运行 V7 实现、真实模型或性能测试。

## 继续条件

开发者随后要求补齐具体 schema、实体摘要查询优化和前两章金标查看器，并授权依据实际抽取调整模型。该追加实验由 [t07](../t07-v7-schema-gold/README.md) 与 [t08](../t08-v7-memory-viewer/README.md) 承接；本 Task 保留初次文档设计记录，不将初稿交付解释为模型已完整获批。

开发者审查提案后再决定接受或修订。接受后按提案能力边界登记 planned Spec 与当前可执行实验 Task；不预建实现链，不把本次独立审查等同于开发者批准。
