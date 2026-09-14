---
schema: nbook.task/v2
taskId: t01-future-impact-analysis
role: tasker
---

# 未来影响分析：Reference 清单格式 + 主链步骤接入

## 目标

按 [Spec：未来影响分析](../../../../docs/specs/plot/future-impact-analysis.md) 交付运行期 Reference 与主链接入，使 leader 在每章修订之后能确定性地产出一份只标记、不改动的受影响下游清单。

## 开发者参与

- 已确认：开发者概括授权（"你要做的你就做，需要我同意的我一概同意"），接受 [Proposal：未来影响分析](../../../../packages/neuro-book/docs/proposals/future-impact-analysis.md) 方向。
- 已确认：实现形态取 skill 阶段 + Reference（**不做 workflow**）——workflow 内 `adhoc` 工具面固定为 `read` + `report_result`，读不到 Plot 数据。
- 待开发者判定：真实模型下清单的命中率与噪声（需 Provider 授权，另行进行）。

## 修改步骤

1. `assets/reference/plot/future-impact-analysis.md`（新增）：清单格式合同——字段（`target` / `impactType` / `evidence` / `suggestedAction`）、三类扫描面（Promise / Scene / 帧）、判据、人读 markdown 模板、fail-closed 语义、与反向核对的分工、不做什么。
2. `assets/reference/plot/README.md`：索引补该文件。
3. `assets/workspace/.nbook/agent/skills/novel-writing/phases/03-chapter-loop.md`：新增「未来影响分析」步骤（修订之后、完成标准之前），说明触发时机、三类扫描、清单交给作者逐项裁决；修订步骤 6 与完成标准指向该步骤。
4. 治理：`docs/specs/plot/future-impact-analysis.md`（`planned` → `implemented`，补实现合同与证据）、`docs/specs/README.md`（登记）、`docs/standards/fork-seams.md`（skill 改动并入既有接缝、新增 Reference）。

## 验证

- `bun run docs:check`、`bun run governance:check`。
- 结构核对：新 Reference 被索引；Spec 九节齐全、capability 唯一、证据为仓库内链接。
- 未验证项：真实模型下受影响清单的召回与噪声；运行中的应用对新 Reference 的同步（需资产同步 / 重启后在运行期可见）。
