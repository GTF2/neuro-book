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

while read -r t; do
  echo "$(grep -rl "$t" assets/workspace/.nbook/agent/skills/ 2>/dev/null | wc -l)  $t"
done < /tmp/tools.txt | sort -n
```

**判定**（0 引用不等于缺口，必须再查 reference）：

```bash
grep -rl "<工具名>" assets/reference/
```

| Skill 引用 | reference 声明 | 判定 |
|---|---|---|
| ≥1 | 任意 | 已接线（1 = 单点，改动该路径时列为受影响面） |
| 0 | 有 | **路由缺口**：知识写了但 Skill 没给触发路径（w00026 形态） |
| 0 | 无 | 可能仅 profile 直用（合法）；读所属模块 reference 的消费方声明后再定性 |

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
| reference 有、Skill 无、工具已注册 | 路由缺口 | 按 w00026 形态补薄接线（叶子注册点 + 附加行） |
| 工具 0 引用且 reference 也无 | 待定性 | 读模块 reference 的消费方声明；确认仅 profile 直用则登记，否则补接线 |
| workflow 0 引用且不在路由表 | 用户到不了 | 补路由表行，或确认是内部步骤 |

**只报缺口与依据，不在审计里修**：修复开 Work、按改动面取证；输出是可核对清单（能力名 + 检索命令 + 命中数 + 判定）。

## 易错点

- **别用正则解析工具清单**：三种定义形态并存，`key:` 只覆盖一部分（实测漏 15/46）；用 `createBuiltinTools()` 运行时枚举。
- **别把 reference 当已接线**：reference 是给 Agent 读的知识，Skill 才是可触发路径；`assets/reference/plot/system.md` 写了 `get_story_tree`，Skill 目录仍可能零引用。
- **Git Bash 的 CRLF 会污染 `comm`**：两侧输入都要 `tr -d '\r'` 再 `LC_ALL=C sort`，否则会把已存在的项误报成差集。
- **反引号标识不都是工具名**：路径、字段名、状态值都会出现（实测 158 个标识里只有一小部分是工具）；必须先与工具清单求交集。
- **别只看文件触碰次数判断活跃**：大目录 + 偶发整批改动会虚高；缺口审计看**引用关系**。
- **审计只查 canonical 源**：`assets/workspace/.nbook/agent/skills/`；State Root 的装机副本是生成物，差异由 `asset-install-runtime` 合同管。

## 何时跑

- 产品发版前（尤其 canary 转 stable 前）。
- 一批 Skill / 工具 / workflow 改动合入后。
- 用户报告「某功能好像没生效」时的第一轮定位。

## 相关

- 接线的具体做法（薄接线、叶子注册点）：[`docs/specs/agent/asset-install-runtime.md`](../../../docs/specs/agent/asset-install-runtime.md)、`assets/reference/agent/skill-package.md`。
- 验证充分性判定：[`verification-evidence`](../verification-evidence/SKILL.md)。
