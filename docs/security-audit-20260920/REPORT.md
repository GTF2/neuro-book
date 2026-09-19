# NeuroBook 全仓安全审计总报告

- **日期**：2026-09-20（夜间，临时工程队执行）
- **对象**：`D:\MyProject\neuro-book` @ `550ec838`（master，含 upstream 0.10.3-canary 快照 45906272 + fork 文档提交）
- **方式**：源码级只读审计。4 个独立搜索代理分主题猎取 + 父代理对关键证据逐行复核 + 结构化去重验证（findings.json 通过 report-schema 结构校验，9 confirmed + 5 needs_validation）。
- **明确不做**（任务铁律）：不执行目标代码、不安装依赖、不启动服务、不跑动态复现。因此所有 confirmed 记录都是**源码级确认**（复现步骤已给出，未实跑）；依赖漏洞审计因环境断网未完成（见 [05](05-依赖与供应链.md)）。
- **档位**：quick（单轮猎手 + 父代理批判复核），**部分覆盖**声明见文末。

## 发现汇总

### 严重（建议本周处理）

| # | 发现 | 位置 | 一句话 |
| --- | --- | --- | --- |
| S1 | 项目 workspace 文件即代码 | `server/agent/workflow/workflow-catalog.ts:123` 等 | 打开/导入含恶意 `.nbook/agent/workflows/*/workflow.ts` 的项目 = 静默任意代码执行；写端点未把 `.nbook` 列为保留路径。同类通路：`runtime-artifact-import.ts:49`（world-engine 配置/profile 编译产物动态 import） |
| S2 | CodeAct 假沙箱 | `server/world-engine/codeact-sandbox.ts:77-103` | `checkAccess` 是死代码、`Function` 未遮蔽，一行逃逸到 `process`/`fetch`；`execute_world` 工具无审批。文件头作者自认限制 |
| S3 | bash 工具无门 | `server/agent/tools/file-tools.ts:367,664,717` + `harness:5549` | 任意命令 `bash -lc` 无白名单无审批；未标 `mutatesWorkspace` 导致**只读模式写审批被绕过**；宿主全量 env 下传 |

三者的共同主题：**不可信输入（workspace 文件、LLM 输出）可以到达代码/命令执行，且审批门不齐**。对"导入别人分享的项目""把网上小说贴给 Agent"这两个场景要当真。

### 要紧（安排时间修）

| # | 发现 | 位置 | 一句话 |
| --- | --- | --- | --- |
| M1 | 鉴权关=全站放行 + 可改绑定 | `middleware/auth.ts:53`、`source-dev.ts:85` | 开发默认无鉴权；非回环绑定组合无告警。默认形态安全，别把端口开局域网 |
| M2 | markdown 渲染消毒窗口与旁路 | `render.ts:266`、`AgentMarkdownContent.vue:25` | DOMPurify 异步后挂载有窗口期；props.html 分支直通。renderer 有 sandbox，后果限于页面内 |
| M3 | provider baseURL SSRF 面 | `provider-check/discover.post.ts` | 用户可控出站 URL（已有 saved-credential 校验等缓解），残余内网探测 |
| M4 | llmlint 无入站限速 | `llmlint/web/server/api/texts.post.ts:53` | 公网站点登录用户可无节制消耗存储/LLM 配额 |
| M5 | discover 错误回传未消毒 | `provider-discover.post.ts:523-529` | 上游错误原文可能携带含 key 的 URL（needs_validation，待定） |

### 可缓（记录在案）

- 公网服务器 IP/部署拓扑写入 4 个文档 66 行（rg 实测）。
- CI 一次性冒烟口令明文（非共享凭据，机制暴露）。
- provider key 明文存 `.nbook/config.json`（设计取舍，防护链完整；备份/同步时注意）。
- `.gitignore` 缺 `.env.*` 变体；llmlint cookie Secure 依赖 X-Forwarded-Proto（待验证）；Tauri CSP 偏弱；`NotificationViewport` v-html 休眠注入点；mermaid 未显式 strict；desktop settings merge 未定位；owned-process env 剔除式而非白名单式。

### 干净的部分（值得肯定）

SQL 注入全参数化；路径穿越/zip-slip 防护完善且有测试；服务端无用户输入到命令行的通路；密钥出站全掩码 + 日志统一脱敏；Electron/Tauri 壳配置规范（nodeIntegration 关、IPC origin 校验、Tauri 零能力）；git 历史无密钥文件；原型污染有意识防御；nb-workflow 无动态执行。

## 待验证清单（needs_validation，均给出验证计划）

1. **依赖漏洞审计**——网络断，自跑 `bun audit`（见 [05](05-依赖与供应链.md)）。
2. discover 错误回传是否泄漏 key（取决于 adapter URL 构造）。
3. llmlint cookie Secure 与反代 X-Forwarded-Proto 剥离。
4. 只读模式工具集是否剔除 bash（若是，S3 的只读绕过仅限 readwrite 场景）。
5. `patchDesktopSettings` 合并实现 + mermaid 默认 securityLevel。

## 修复优先级建议（最小改动优先）

1. 一行级：bash 工具补 `mutatesWorkspace: true`；`execute_world` 补 `approvalRequired: true`。
2. 小改动：文件写端点/zip 导入把 `.nbook/` 列为保留路径；dompurify 改静态导入；非回环绑定 + auth 关闭 → 启动告警。
3. 结构性（给上游提 issue 的好素材）：workflow/config 求值移出宿主进程；命令策略层；子进程环境白名单。

## 覆盖声明（诚实边界）

quick 档单轮覆盖，**不构成完整审计**。未深扫：`packages/neuro-book-manager`、`file-snapshot-cache`、`test-support`、server/agent 工具内核与 profiles 编译链全量、server/rag、CORS 全局配置、生产 Dockerfile/compose 运行面、git 历史内容级回溯、`patches/` 内容复核。所有执行类结论均为源码级推断，未动态复现；每条 finding 的复现步骤已写入 `findings.json` 供后续验证。

## 文件索引

- [01-代码执行面.md](01-代码执行面.md) —— S1/S2/S3 详版
- [02-服务端与访问控制.md](02-服务端与访问控制.md) —— M1/M3/M5 详版
- [03-敏感信息与密钥.md](03-敏感信息与密钥.md) —— 密钥与信息暴露详版
- [04-前端与桌面.md](04-前端与桌面.md) —— M2 与 Electron/Tauri 详版
- [05-依赖与供应链.md](05-依赖与供应链.md) —— 依赖审计阻断与自跑命令
- [findings.json](findings.json) —— 结构化记录（9 confirmed + 5 needs_validation，已过结构校验）
- [run-metadata.json](run-metadata.json) —— 运行元数据与覆盖口径
- [SUMMARY.md](SUMMARY.md) —— 给非技术读者的三档大白话版
