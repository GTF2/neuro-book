---
schema: nbook.task/v2
taskId: t01-canon-read-back
role: tasker
---

# canon 回读验证：Reference 回执格式 + 主链步骤接入

## 目标

按 [Spec：canon 回读验证](../../../../docs/specs/plot/canon-read-back.md) 交付运行期 Reference 与主链接入，使 leader 在拍板落库写入之后能确定性地产出验收回执，让"写了没生效 / 写成别的事 / 该写没写"三类偏差可见。

## 开发者参与

- 已确认：开发者概括授权（"你先按你的来吧"），接受 [Proposal：回读验证](../../../../packages/neuro-book/docs/proposals/read-back-verification.md)。
- 已确认：实现形态取 skill 阶段 + Reference（**不做 workflow**）。
- 待开发者判定：真实模型下回执的准确度（需 Provider 授权，另行进行）。

## 修改步骤

1. `assets/reference/world-engine/canon-read-back.md`（新增）：回执格式合同——字段（`intent` / `readBack` / `status` / `evidence` / `suggestedAction`）、三类偏差（landed/deviated/missing）、三个真相源各自的回读手段、人读 markdown 模板、fail-closed 语义、与事后校验的分工、不做什么。
2. `assets/reference/world-engine/README.md`：文档清单补该文件。
3. `assets/workspace/.nbook/agent/skills/novel-writing/phases/02-canon-commit.md`：新增「回读验证」步骤（World Engine 与 Plot 写入之后、回报之前）；「回报当前状态」改为以回执为基础；完成标准补一条。
4. `assets/workspace/.nbook/agent/skills/novel-writing/phases/03-chapter-loop.md`：前置检查补"本章相关 canon 已回读通过"。
5. 治理：`docs/specs/plot/canon-read-back.md`（新增 `implemented` Spec）、`docs/specs/README.md`（登记）、`docs/standards/fork-seams.md`（S20）。

## 验证

- `bun run docs:check`、`bun run governance:check`。
- 结构核对：新 Reference 被索引；Spec 九节齐全、capability 唯一、证据为仓库内链接。
- 未验证项：真实模型下回执的召回与误报；运行中的应用对新 Reference 的同步（需资产同步 / 重启后在运行期可见）。
