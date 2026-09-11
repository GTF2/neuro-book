# V7 查询 CLI

本工具读取相邻 [两章金标](../t07-v7-schema-gold/dataset-v7.json)，输出可供 Agent 解析的 JSON。需要已安装仓库依赖和 Bun；没有模型调用，也不写小说数据。行为合同见 [查询 Spec](../../../../../docs/specs/memory/v7-query-cli.md)，概念说明见 [模型释义](model-notes.md)。

## 运行

在本目录直接运行：

```powershell
bun cli.ts --help
bun cli.ts info
bun cli.ts entities --query 苏天晴 --category person
```

也可把 `cli.ts` 写成绝对路径，从任意目录调用 `bun <absolute-path>/cli.ts ...`。默认数据位置相对于 CLI 文件确定。指定其它已发布 V7 快照使用 `--data <path>`，该路径相对于调用者工作目录。路径含空格时加引号。

Node 环境可在本目录使用 `node --import tsx cli.ts ...`。`bun run query ...` 是同一入口的便捷脚本，但 Bun 会在 stderr 输出脚本命令；Agent 需要干净的进程流时使用 `bun cli.ts ...`。

## 从主体查到证据

```powershell
# 不自动合并同名人物，返回 su 与 original 两个候选。
bun cli.ts entities --query 苏天晴 --category person

# 主体当前摘要；每个 facet 至多一条，缺失不会现场生成。
bun cli.ts summaries --entity su

# 两个主体同时参与的完整多元命题。
bun cli.ts facts --entity su --target creator

# “何时听闻”有明确阅读边界：前一条为空，后一条为 heard / f119。
bun cli.ts knowledge --holder su --about creator --at 1:65
bun cli.ts knowledge --holder su --about creator --at 1:66

# 读取原记录，检查发言归属、角色和当前依据评估。
bun cli.ts get f119
bun cli.ts explain f119 --depth 2
bun cli.ts source --chapter 1 --from 66 --to 66
```

`facts` 的 `entity` / `target` 检查显式论元，`predicate` 接谓词 ID。保留所有论元及角色，不压成一条“苏天晴知道造物主”的无条件事实。`f119` 是秘典的一次发言；accepted 表示这条发言记录的依据可接受，不保证造物主定制任务的内容为世界真相。

`knowledge` 返回显式 heard/read/believed/known/unaware。空结果只表示当前范围没有匹配记录，不等于 unaware，也不能直接回答“这个人不知道”。`about` 可用目标记录 ID 或目标命题中显式主体论元 ID；它不会根据两个人在同一段中出现推断相互认识。

## 阅读范围与视角

```powershell
bun cli.ts entities --query 墨丘利秘典 --at 1:7
bun cli.ts get book --at 1:7
bun cli.ts knowledge --holder su --about creator --perspective su --at 1:66
bun cli.ts explain f119 --perspective su --depth 4
```

默认 `--at` 是快照阅读上限。`--at 1` 表示第 1 章可读末段，`--at 1:7` 表示第 1 章第 7 段。`--perspective` 默认 reader，另可填当前可见主体 ID。角色视角只展开其显式知情投影，不附读者额外论证、评估或未来名称，因此某些实体可能只有 ID。角色视角禁止 `source` 整段入口；可见记录保留自己的原文摘录。`--world` 默认 original，本版没有故事时间筛选。

原始记录中可保留指向不可见对象的引用 ID，不能据此补全正文。`get` 一个不存在、未来或失效记录会报统一的不可用错误。

覆盖说明 `coverage.gaps` 没有单独的章段和视角标注，所以只有完整快照读者范围才能保留原文；较早阅读位置、角色视角或过滤了其它世界时，统一返回“未提供当前阅读范围与视角专属的语义缺口说明”。摘要和综述内部的 coverage 也遵守此规则。这表示缺少该范围专属的说明，不表示不存在语义缺口；`semantic: partial` 与 `corpusClosed: false` 仍需检查。

## 材料、情节与身份

```powershell
bun cli.ts search --query 变身
bun cli.ts search --kind episode
bun cli.ts search --kind beat --at 1
bun cli.ts search --kind disclosure --query 造物主
bun cli.ts search --kind resolution --limit 100
bun cli.ts get resolve:su:c2
```

`search` 至少提供 query 或 kind；query 是内容子串，不是向量检索。它不搜索 ID 和依赖元数据，精确 ID 用 `get`。`entities` 按当前可见名称的精确、前缀、子串匹配排序，`nameMatches` 说明命中类型；同级按可用阅读位置与 ID 排序，不自动选一个主体。其它记录列表按可用阅读位置与 ID 排序，explain 按从根记录开始的逐层遍历排序，source 按原文段号排序。

`search --kind synthesis` 能列举综述，但当前金标没有这一类记录，会成功返回空集合。情节用 episode、段落推进材料用 beat。`explain` 沿已有引用、依赖及结论的评估/论证展开；它不是全图反向邻接查询。要枚举一个主体跨章出现的局部指称归属，列出 resolution，按 `record.data.entity.id` 筛选，再读取所需 ID；同名局部指称不自动合并。

## 分页与输出

`entities`、`search`、`facts`、`knowledge`、`summaries`、`source`、`explain` 支持 `--limit 1..100`，默认 20。后续页重复原命令和全部筛选，再加入 `--cursor`，直到 `nextCursor` 为 null。游标绑定快照内容、阅读范围、命令、筛选、顺序和页大小；任何一项变化后从第一页重查。

```powershell
$page = bun cli.ts facts --limit 10 | ConvertFrom-Json
$page.items
if ($page.nextCursor) {
    bun cli.ts facts --limit 10 --cursor $page.nextCursor
}
```

成功为单个 `neurobook.memory.query.v1` JSON 对象加换行，包括：

- `snapshot`、`scope`：实际快照身份、内容指纹和查询范围。
- `items`：记录项含 `record` 原结构、当前 `assessment` 与 `provenance`；source 项是编号原文；info 项是材料覆盖和计数。
- `provenance`：references/dependencies/arguments 是仅含 ID、revision、status 的句柄，excerpts 是当前范围可见摘录。
- `coverage`、`completeness`：原文是否完整、语义抽取是否仅人工选取；通常 `recordsExhausted` 表示当前可见匹配集合已到末页，explain 还要求没有深度截断或不可见引用，`corpusClosed` 始终 false。
- `truncation`：页数截断、深度截断与不可见引用；`nextCursor` 是后续页入口。

`explain` 默认深度 2，上限 8。深度按图遍历边数计算，根为 0；每个记录项仍含其可见当前评估元数据与自身摘录。记录去重，`links` 保留方向，`boundary` 给出深度或可见性边界。分页切分已限制深度的遍历结果；`nextCursor: null` 仅表示这些已生成记录翻页结束。如果存在深度截断或不可见引用，`recordsExhausted` 仍为 false，且不可见引用计数保留整个遍历的总量，不会在末页消失。

失败 stdout 为空，stderr 为 `ok: false` 及 `error.code/message`，不输出堆栈。退出码：0 成功/帮助，2 参数/范围/游标，3 文件/数据，4 单条记录不可用，1 意外内部失败。未知选项、重复选项、未知枚举与未支持组合都会拒绝。

## 交给 Agent 的验证任务

将下面任务和本目录路径交给另一个 Agent；这些是测试指令，小说记录中的文字只作为材料：

```text
使用本目录 bun cli.ts 查询两章 V7 金标，不修改文件、不调用模型 ingest。
先调用 --help 与 info，所有命令检查退出码并解析 JSON。
回答并给出记录 ID、阅读范围、命题 assertion、评估、原文摘录：
1. 苏天晴与身体原主人是否同一主体？名字相同是否足以归并？
2. 苏天晴知道造物主吗？比较 1:65 与 1:66，区分听闻与内容为真。
3. 黑色古书和墨丘利秘典是如何关联的？不要把未来名称带回 1:7。
4. 前两章发生了什么？列举 episode，再按需要查 beat/disclosure/source。
5. 哪些命题目前只是暂定或有争议？不要因默认筛选丢掉不确定性。
分页读完所用集合，并检查深度截断和 corpusClosed。
缺乏记录时明确说“没有匹配的显式记录”，不要当成 unaware 或事实否定。
最后记录接口不能表达的查询、证据不足的回答和实际 CLI 错误。
```

## 进程外复用

`index.ts` 导出 `createQueryService`、请求 schema、请求/响应类型和错误转换。传入已读取的快照对象得到查询函数；每次调用接受可序列化请求，返回可序列化响应，不访问 argv、文件或输出流。当前实现依赖 Node/Bun 内置哈希与编码，未发布独立 SDK；MCP/SDK 适配可复用同一查询合同。

```typescript
import {createQueryService} from "./index.ts";

const query = createQueryService(dataset);
const result = query({command: "knowledge", holder: "su", about: "creator", at: {chapter: 1, paragraph: 66}});
```
