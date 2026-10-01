---
schema: nbook.task/v2
taskId: t02-connection-identity-save-contract
---

# 连接身份未定稿的保存契约

## 目标与范围

让「复制连接 / 模板添加 → 修改连接身份 → 保存」真正落盘：客户端在保存体里为本次会话新建的 Provider 声明 `connectionIdentityDraft`，服务端据此跳过连接身份稳定性校验，并在写盘前移除声明。

t01 只解锁了界面字段。服务端 `assertProviderConnectionsStable` 仍按 `sourceIndex` 与已存配置比对，导致修改 Base URL 后保存被拒（`连接身份不可修改（Base URL 或代理已变化）`），开发者在使用中转站 Provider 时命中。

界面解锁不等于能改：`renameActiveProviderId` 在会话层同样按 `sourceIndex` 拒绝改名并弹 `providerIdentityImmutable`，开发者第二次反馈「复制的这一份里改东西还是保存不了」，因此改名守卫按同一标记一并放行。

行为合同未变：`docs/specs/` 目前没有 provider 配置保存的 capability，本 Work 不涉及已登记 Spec 覆盖的行为，合同以 `ConfiguredProviderConfigDtoSchema`、`config-service.ts` 的守卫与两端测试为准。

## 非目标

- 不放开已保存 Provider 的端点修改：未声明的条目仍然拒绝改 ID / Base URL / 代理。
- 声明只存在于会话与保存体，不进入磁盘配置。
- 不改 Provider 引用（默认模型、Agent 可见模型）的迁移规则。

## 证据

- `bun run --cwd packages/neuro-book test app/components/novel-ide/settings server/config/config-service.test.ts` → 20 文件 / 180 用例通过。
- 回退即失败两处：服务端豁免改成不生效后两条服务端用例精确失败（其余 63 条不受影响）；改名守卫改回不看标记后改名用例精确失败（其余 9 条不受影响）。
- typecheck 与 master 基线逐条一致：两侧各 30 条既有错误，规范化后 `diff` 为空。

## 未验证

- 未在浏览器里实跑「克隆 → 改 Base URL → 保存成功」；判定依据是保存体与服务端守卫的测试。
- 未验证真实中转站的连通性与模型发现。

## 执行位置

`.worktree/w00021-provider-connection-identity-edit`，分支 `fix/w00021-provider-connection-identity-edit`。
