---
name: capability-gap-audit
description: 审计「已实现能力 ↔ 消费点接线」的缺口——找无人调用的工具、无人引用的 workflow、Skill 承诺但工具不存在的落差；发版前或大改动后使用。
---

# 能力面接线审计

「能力已实现」和「用户用得上」是两件事：工具注册了但没人调用、workflow 存在但 Skill 不提、Skill 教模型用某条纪律却没有对应工具——这三类缺口都不会让测试失败，只在真实使用时才暴露（w00026 的承诺账本即如此：`save_promise_beat` 早已实现，但整个 skills 目录零命中）。

本 Skill 给出可复现的检索与判定。**能力清单以运行时为准**，Skill 路由以 [`novel-guide`](../../../packages/neuro-book/assets/workspace/.nbook/agent/skills/novel-guide/SKILL.md) 为准；两者不一致即缺口信号。

## 三个检索方向

在 `packages/neuro-book/` 下跑（Agent 资产根：`assets/workspace/.nbook/agent/`）。

### 1. 工具 → 消费点

**工具清单用运行时枚举**——源码里工具有三种定义形态（`key: "..."`、`tool("...", ...)`、多行参数），正则解析会漏（实测漏掉 15/46）；运行时清单零歧义：

```bash
bun -e 'import {createBuiltinTools} from "./server/agent/tools/index.ts";
console.log(createBuiltinTools().map((t) => t.key ?? t.name).sort().join("\n"))' > /tmp/tools.txt

# 三条路由路径一起统计（缺一条会把已接线的工具误报成缺口）
while read -r t; do
  printf "%-26s ref=%s skill=%s profile=%s\n" "$t" \
    "$(grep -rl "$t" assets/reference/ 2>/dev/null | wc -l)" \
    "$(grep -rl "$t" assets/workspace/.nbook/agent/skills/ 2>/dev/null | wc -l)" \
    "$(grep -rl "$t" assets/workspace/.nbook/agent/profiles/ 2>/dev/null | wc -l)"
done < /tmp/tools.txt | sort -t= -k2 -n
```

**判定**（**三条路径全 0 才是缺口候选**；任一非 0 即为已接线）：

| reference | Skill | profile | 判定 |
|---|---|---|---|
| 任意非 0 | — | — | **已接线**。reference 由 profile 注入即进 Agent 上下文（见下「路由的三条路径」） |
| 0 | 0 | 0 | **缺口候选**：核对是否有意未接线（如 `variable_*` 在 rp-mode 声明「第一版不实现完整变量系统」），确无登记则补接线或登记 |

### 路由的三条路径（判定前必读）

Agent 拿到工具用法的路径有三条，**缺任何一条都会误判**：

1. **Skill**：`assets/workspace/.nbook/agent/skills/`——模型按 `when_to_use` 自选读取，是可触发路径。
2. **profile 注入的 reference**：`profiles/builtin/*.tsx` 的 `<Import path="reference/..."/>`——**随 profile 直接进上下文**，不需要模型主动读。实测 `reference/plot/system.md` 被 4 个 profile 注入，其「Agent Tools」章节列出全部 plot 工具与用法，因此 `get_story_tree` / `save_story_scene` 等即使 Skill 零引用也已接线。
3. **profile 自身**：`profiles/builtin/*.tsx` 正文里直接写工具名与协作纪律。

**验证某工具确实进了上下文**：读最近会话的 JSONL，搜索注入内容——`<State Root>/workspace/.nbook/agent/sessions/<id>.jsonl` 的 `custom_message` 里能找到 reference 原文即证明生效。

### 2. workflow → 消费点

```bash
for w in $(ls assets/workspace/.nbook/agent/workflows/); do
  echo "$(grep -rl "$w" assets/workspace/.nbook/agent/skills/ | wc -l)  $w"
done
grep -n "<workflow-key>" assets/workspace/.nbook/agent/skills/novel-guide/SKILL.md
```

**判定**：Skill 0 引用 **且** 不在 `novel-guide` 的 workflow 表 = 用户到不了（除内部步骤）；表里有而 Skill 不引用 = 弱接线。

### 3. Skill → 工具（承诺是否兑现）

```bash
grep -oh '`[a-z_]\{4,\}`' assets/workspace/.nbook/agent/skills/*/SKILL.md \
  assets/workspace/.nbook/agent/skills/*/phases/*.md 2>/dev/null | tr -d '`' | sort -u > /tmp/mentioned.txt

# Git Bash 下行尾是 CRLF，comm 会误判；两侧都先归一化
tr -d '\r' < /tmp/mentioned.txt | LC_ALL=C sort -u > /tmp/m.txt
tr -d '\r' < /tmp/tools.txt | LC_ALL=C sort -u > /tmp/t.txt
comm -23 /tmp/m.txt /tmp/t.txt | grep -E '^(save|get|list|cancel|run|task|apply|subject|variable|web|execute)_'
```

**判定**：输出里逐个 grep Skill 正文确认；确认是工具名但未注册 = 悬空承诺，优先修。（实测基线：当前 master 零悬空承诺。）

## 判定口径

| 形态 | 含义 | 处理 |
|---|---|---|
| Skill 提到不存在的工具 | 悬空承诺 | 优先修（改 Skill 或补工具） |
| 三条路径全 0，且有「有意未实现」登记 | 预留能力 | 登记有效，不动 |
| 三条路径全 0，且无登记 | **真缺口** | 补接线（薄接线）或补登记说明 |
| reference 有、Skill 无 | **通常不是缺口** | 先确认 reference 是否被 profile 注入；注入了就已接线 |
| workflow 0 引用且不在路由表 | 用户到不了 | 补路由表行，或确认是内部步骤 |

**只报缺口与依据，不在审计里修**：修复开 Work、按改动面取证；输出是可核对清单（能力名 + 三条路径命中数 + 判定）。

## 易错点

- **别只看 Skill 一条路径**：实测 30 个「Skill 零引用」工具里，28 个其实已通过 profile 注入的 reference 接线（`get_story_tree` 被 16 个 profile 引用）。**三条路径一起查**，只有全 0 才是缺口候选。
- **别用正则解析工具清单**：三种定义形态并存，`key:` 只覆盖一部分（实测漏 15/46）；用 `createBuiltinTools()` 运行时枚举。
- **Skill 里的通配写法要单独识别**：`save_*`、`plot 写工具` 这类类别引用 grep 具体工具名时命中 0，但路由是通的。
- **Git Bash 的 CRLF 会污染 `comm`**：两侧输入都要 `tr -d '\r'` 再 `LC_ALL=C sort`，否则会把已存在的项误报成差集。
- **反引号标识不都是工具名**：路径、字段名、状态值都会出现（实测 158 个标识里只有一小部分是工具）；必须先与工具清单求交集。
- **别只看文件触碰次数判断活跃**：大目录 + 偶发整批改动会虚高；缺口审计看**引用关系**。
- **审计只查 canonical 源**：`assets/workspace/.nbook/agent/`；State Root 的装机副本是生成物，差异由 `asset-install-runtime` 合同管。

## 已知的有意未接线

审计时遇到这些**不要当缺口报**（有明确登记）：

| 能力 | 登记位置 | 说明 |
|---|---|---|
| `variable_schema` / `variable_read` / `variable_patch` | `assets/workspace/.nbook/agent/skills/rp-mode/SKILL.md`「边界」节 | RP 第一版明确不做持久化 session 记忆与完整变量系统；工具已实现、留给后续实现时接线 |

## 何时跑

- 产品发版前（尤其 canary 转 stable 前）。
- 一批 Skill / 工具 / workflow 改动合入后。
- 用户报告「某功能好像没生效」时的第一轮定位。

## 相关

- 接线的具体做法（薄接线、叶子注册点）：[`docs/specs/agent/asset-install-runtime.md`](../../../docs/specs/agent/asset-install-runtime.md)、`assets/reference/agent/skill-package.md`。
- 验证充分性判定：[`verification-evidence`](../verification-evidence/SKILL.md)。
