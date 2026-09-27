---
schema: nbook.task/v2
taskId: t19-open-switch-settlement
---

# 打开与切换输入结算

## 目标与范围

统一文件标签打开、组内文档切换和 Project 路由切换前的输入结算。Store 是正文与编辑器 flush 的唯一协调入口；页面 Project 切换仅负责确认策略和路由意图，不在保存失败时释放旧工作面。保存成功后才允许切换，冲突、失败、取消或待裁决输入都保留旧内容与 dirty 状态。

## 当前状态

已完成 t19。Store 在组内打开和选择文档前结算当前组输入，待裁决候选拒绝切换；批量保存返回布尔结果，失败和冲突不放行 Project 路由。Project 切换等待旧代次在途写入回执，旧写入不能清理新代次同路径的保存状态；页面在保存后复核 dirty 和输入冲突。Files 两项 Spec 仍为 `planned`。

## 验收

- `bun run test -- app/stores/novel-ide-editor.test.ts app/stores/novel-ide.test.ts app/composables/useProjectSession.test.ts`：3 files / 54 tests 通过。
- `bun run typecheck`：0 diagnostics。
- 隔离 Chromium 主页面打开 `files-baseline-a`，于 `baseline-a.md` 富文本视图实际键入 `OPEN-SWITCH-PROBE`，A→B→A 切换后 B 未出现该输入，A 仍保留，`pageErrors=[]`。验收只涉及本次隔离样本，未触碰用户作品。

## 边界

不实施资源管理器双模式、批量文件操作、编辑器模型复用或性能预算；不关闭共享 Project、不触碰真实作品/模型，不执行 commit/push/PR/部署，隔离 Temp State/Cache/Project 保留。
