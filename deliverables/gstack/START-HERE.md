# START HERE · 把 NeuroBook 交给软件工坊

> 这个文件是**交接包入口**。你要做的只有一件事：把下面第 1 节的代码块整段复制，粘贴给专家团。

---

## 1. 一键启动指令（整段复制，别改格式）

```text
接手 NeuroBook 项目的整改工作。项目根目录：D:\MyProject\neuro-book

【第一步：先读，别急着动手】
按顺序读这三份文件：
1. deliverables/gstack/START-HERE.md（本交接说明）
2. deliverables/gstack/full-review-neurobook-2026-09-17.md（全面体检报告：20 条发现 + 16 条行动清单，全部带文件路径与行号）
3. HANDOFF.md（项目唯一入口：写作宪法、铁律、并行在途改动清单）

【本轮目标：按体检报告的 Action List 执行 P0，顺序不要打乱】
① 安全三条（最急，1 周内）：
   - Portable 启动强制 HOST=NITRO_HOST=127.0.0.1，照抄 scripts/cli/source-dev.ts:86 的写法；
     并加一条 fail-closed：非 loopback 监听且鉴权关闭时拒绝启动
   - 备份剔除 .env 与 config.json 里的 apiKey（backup-archive-service.ts:14,98-101），备份端点显式 requireAdminAccess
   - Provider API Key 改用 Windows DPAPI 加密落盘（当前明文，见 config-service.ts:87-89,1305-1310,1561-1564）
② 主应用建 playwright.config.ts + 3 条主链路冒烟（参考 packages/nb-ui/playwright.config.ts）；
   同时把 Full tests 的 78 条失败基线分类处理（修 / 显式 skip + 登记 / 删）
③ llmlint 加编辑器入口（360 条规则已就绪，只缺 UI 入口，当前 app/ 里零接入）；
   剧本工作台默认 tab 从「线程规划」改为「承诺账本」
④ nb-ui 接管 3 个试点页面（ProjectPickerScreen.vue / NovelIdeSettingsDialog.vue / 关键帧面板），颜色 token 化起步

【硬约束，违反会出大问题】
- 只推 origin，禁止 git push --force，禁止推 upstream
- 这是 fork：desktop/tauri、nb-memory、nb-ui、rp.*/simulator.* profiles、RP模式 skill、legacy tasks 属「上游领地」，
  只记录不删除（删除会产生无解的 modify/delete 冲突）
- 工作区有他人未提交的在途改动（清单见 HANDOFF.md「并行在途清单」），不要动、不要提交
- 提交时只 git add 自己的文件，禁止 git add -A
- 提交者身份：git -c user.name=GTF2 -c user.email=GTF2@users.noreply.github.com commit ...
- 不通过测试不提交：至少跑一次 typecheck（bun run --cwd packages/neuro-book typecheck）+ 相关测试；
  没验证的部分必须明说「未验证」，不许含糊
- 所有产出文档用简体中文；对开发者 GTF 说话要结论先行、大白话，别用黑话

【三条不可碰的红线（写作宪法边界，只能由 GTF 决定）】
1. 什么叫好小说 —— 只有作者能判
2. 写作流程的形态选择（如事前告知 vs 事后校验这类裁决）
3. 终审实验的判词（docs/doctrine/ 里两轮实验的结论）
不要替 GTF 做这三类判断，也不要因为「工程上更合理」就去改写作方法论。

【交付要求】
每完成一项，报告：改了什么文件、跑了什么验证、结果如何。没验证的明说「未验证」。
优先做能当天见效的（如默认 tab 改动、空态示例书），再做工程量大但收益高的（如 E2E 体系）。
```

---

## 2. 怎么用（三步）

1. **新开一个会话**（重要：新会话才干净，老会话上下文会干扰）
2. 打开左侧边栏的 **「专家」**，选 **「软件工坊」**（SoftwareWorkshop）
3. 把第 1 节的代码块**整段**粘进去，发送

---

## 3. 想换任务范围？改这一句就行

删除或替换第 1 节里的【本轮目标】段落：

- **只想让它出方案、别动代码**：
  `本轮不要改任何代码。先复核体检报告的 20 条发现，逐条给出你的判断（同意 / 不同意 / 证据不足），并补一份你认为遗漏的问题清单。`

- **只做安全**：
  `本轮只做安全三条（见行动清单 1-3），做完停下来等 GTF 确认再继续。`

- **只做体验/产品**：
  `本轮只做行动清单 6-9 与 11（llmlint 入口、空态示例书、默认 tab、nb-ui 试点、Journey 看板），安全项本轮不碰。`

---

## 4. 这个包里有什么

| 文件 | 内容 | 谁写的 |
|---|---|---|
| `deliverables/gstack/START-HERE.md` | 本文件（交接说明 + 启动指令） | 主理人 |
| `deliverables/gstack/full-review-neurobook-2026-09-17.md` | **主报告**：20 条发现 + 16 条行动清单 + 不可外包边界 | 五角色合成 |
| `deliverables/gstack/members/gstack-product-reviewer.md` | 产品评审全文（含 llmlint 无入口、空态方案、5 条 Journey） | 产品评审员 |
| `deliverables/gstack/members/gstack-security-officer.md` | 安全审计全文（含完整攻击链、全部行号与复现步骤） | 安全官 |
| `.workbuddy/reviews/2026-09-17-software-workshop-review.md` | 更早的初版体检，可对照看 | 主理人 |

---

## 5. 接手前必须知道的四件事（专家团读这段就够）

1. **项目是什么**：本地优先的长篇小说写作 IDE，Bun + TypeScript monorepo，主应用 Nuxt 4 + Nitro + Prisma/SQLite，有 Electron/Tauri 桌面端。最高优先级 spec 是 `docs/doctrine/writing-doctrine.md`（写作宪法，七条信念，可否决任何功能）。
2. **最急的事**：一条完整攻击链——Portable 默认无鉴权 + 不设 HOST（Node 默认绑所有网卡）+ API Key 明文落盘 + 备份打包 `.env` → 同局域网一个 ZIP 拖走全部作品和密钥。**这条必须在做任何功能之前修掉。**
3. **最大的浪费**：四个能力都造好了，就是没送到用户手上——nb-ui（72 组件 / 4 主题 / 283 CSS 变量）主应用零引用；llmlint（360 条规则）前端零接入；承诺账本被藏在默认不可见的 tab 里。
4. **本轮已知的坑（专家团会踩）**：
   - `config.yaml` 里的 `server.host` **没有任何消费者**，改它无效（真因是没设 HOST 环境变量）
   - 「startup nonce」是桌面 IPC 握手，**不是 HTTP 防护**，别指望它
   - 「动态 loopback」只覆盖 Electron/Tauri，**不覆盖 Portable**
   - 子代理在本环境可能不可用（早前实测 `gstack-*` 与 `general-purpose` 都报工具缺失），必要时降级为主理人直调，并在报告里声明

---

## 6. 已经做过什么（避免重复劳动）

- 全面只读体检已完成，全部结论带文件路径与行号，**结论可直接用，不必重查**
- 已复核属实的硬证据：`environment.ts:33`（不传 host 就不设 HOST）、`server/` 无 `server.host` 消费者、`app/` 中 llmlint 零命中
- **未做任何代码改动**（全轮只读），所以专家团接手时工作区是干净的（除了 HANDOFF 里记录的他人在途改动）

---

> 交接包生成于 2026-09-17。若专家团发现本包内容与代码不符，以代码为准，并在报告中说明差异。
