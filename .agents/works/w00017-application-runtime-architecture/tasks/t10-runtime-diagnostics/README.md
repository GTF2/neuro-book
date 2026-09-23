---
schema: nbook.task/v2
taskId: t10-runtime-diagnostics
---

# 第二片：运行实例诊断插件

## 目标与范围

按 [runtime.diagnostics](../../../../../docs/specs/runtime/diagnostics.md) 实现平台中立的诊断记录能力与插件，以及后端 JSONL 文件出口、浏览器 console 出口；产品日志器与之共用 JSONL 写入与脱敏实现。

非目标：产品启动链接线（`AppFileLogger` 仍由旧入口创建，不参与位置授予锁）、网络遥测、日志查看 UI。

## 当前状态

已完成，Spec 由 [t13](../t13-services-integration-review/README.md) 晋升 `implemented`。

- 机制：`packages/neuro-book/runtime/diagnostics/`（`contracts.ts`、`store.ts`、`plugin.ts`、`redaction.ts`，入口 `diagnostics.ts`）。`recordingEmergency()` 让必需门禁失败在收口前进入记录；`mechanismObservers()` 经清单观察者记录 lifecycle/plugins 事件。
- 出口：`server/features/runtime-diagnostics/jsonl-exporter.ts`（目录内 `server-logs.lock` 位置授予，冲突降级，释放前核对锁目录身份不删接管者的锁）、`app/features/runtime-diagnostics/console-exporter.ts`。
- 共用：`server/app-logs/jsonl-log-writer.ts` 承担追加/轮转/保留；`server/app-logs/logger.ts` 改用它和 `runtime/diagnostics` 脱敏；`server/utils/sensitive-text.ts` 删除，两个调用方（`provider-error-sanitizer.ts`、`backup-job-manager.ts`）迁到诊断入口。
- 合同测试：`runtime/diagnostics/diagnostics.test.ts`（14）、`server/features/runtime-diagnostics/jsonl-exporter.test.ts`（8）、`app/features/runtime-diagnostics/console-exporter.test.ts`（2）。

## 授权与限制

- 开发者 2026-09-23 决定第一片与第二片「等第二片完成后一起合」；本 Task 在实现分支本地推进，本地提交自主进行，push、PR、合并各自需要明确授权，本 Task 未执行。
- 只用系统 Temp 下的隔离临时根与真实文件/SQLite；未触碰产品数据、真实 Provider、迁移或人工浏览器验收。

## 证据

合并运行见 t13：[测试](../t13-services-integration-review/evidences/test-runtime-foundation.txt)、[typecheck](../t13-services-integration-review/evidences/typecheck-runtime-foundation.txt)、[组合 smoke](../t13-services-integration-review/evidences/smoke-services.txt)、[日志器与脱敏消费方回归](../t13-services-integration-review/evidences/logger-regression.txt)（18 files / 114 passed）。

## 已知限制

`AppFileLogger` 与诊断文件出口指向同一目录时不互斥；无遥测是静态导入守卫；未知字段名下的自由文本只按已知凭据模式脱敏。

## 下一步

产品启动链随首条真实链（Files）迁入时，由诊断出口接管产品日志位置，旧 `AppFileLogger` 写入路径同时退出。
