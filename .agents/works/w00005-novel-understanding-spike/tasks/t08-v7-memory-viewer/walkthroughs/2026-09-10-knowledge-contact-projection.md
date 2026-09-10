# 知情联系投影验证

2026-09-10。所属 [t08 查看器 Task](../README.md)。本记录覆盖本轮 projection owner 的实现与聚焦验证；图形、交互、浏览器和最终 HTML 由 interaction owner 继续验证。

## 修改与行为

本轮源码仅修改 [knowledge-graph.ts](../knowledge-graph.ts) 和 [knowledge-graph.test.ts](../knowledge-graph.test.ts)。t07 数据、schema、查询与 EntitySummary 均只读。

`knowledgeAccessEdges(nodes)` 消费已经过阅读范围、身份有效性和证据闭包检查的查询结果。它只从显式 `knowledgeAccess` 取得持有者与目标命题，再导航到该命题直接引用的 Entity；不沿 Referent 做额外身份推断，不从共现生成知情关系，也不将 opaque 发言内容提升为世界事实。

返回边按有向 `holder -> entity` 聚合，`kind` 保持 `semantic`，`id` 使用 `knowledge:` 前缀，`accesses` 逐项保留 `{accessId,factId,mode}`。认知边不填普通命题分组使用的 `factId/factIds`，两种计数与详情不会混用。相同模式分别显示“听闻相关说法”“读到相关记载”“相信相关说法”“知晓相关信息”；混合模式显示“相关认知”，仍保留各项原模式供详情追溯。上述边表示对有关命题的认知，不表示认识或相信该实体本身。

`unaware` 不形成正向认知边。目标命题被当前筛选移除、目标或持有者不可见时也不出边。`knowledgeGraph` 将这些导航加入全体主体图；主体周边按两端主体筛选，并纳入相应端点。

## 样本结果

当前末章读者快照的默认图为 24 个主体、11 组普通命题联系、16 组认知联系。认知联系聚合前有 52 个目标导航项；这是同一认知记录可指向命题中的多个显式实体所致，**不代表 52 条独立认知源**。底层仍有 33 条 `knowledgeAccess`，其中 1 条为 `unaware`。

苏天晴与造物主的导航边为 `knowledge:["su","creator"]`，标签“听闻相关说法”，唯一来源项是 `{accessId:"access:su:f119",factId:"f119",mode:"heard"}`。第 1 章第 65 段无此边，第 66 段开始可见。事实仍是秘典发言，认知仍是苏天晴听闻。

## 实际验证

先增加 2 项回归并运行 `bun run test -- knowledge-graph.test.ts`，得到 6 通过、2 失败，失败是缺少新投影 helper。实现后继续补齐边界验证，最终新增 7 项测试，投影测试共 13 项通过。

测试覆盖：第 1 章第 65/66 段切换；撤回 `d119`、`access:su:f119`、`resolve:creator:c1`；筛除 `f119`；持有者缺失；明确不知情；苏天晴视角；四种正向模式及混合模式聚合；造物主局部图；不通过 Referent 追加身份替换；旧有命题分页、角色保留与阅读边界。

完成 helper 内部类型收紧后运行 `bun run test`：2 个测试文件、16 项测试全部通过，退出码 0。独立执行统计命令得到上述 24/11/16 及 52 项结果。

执行 `bun run typecheck` 时，交互 owner 正在修改图形接口；当时唯一错误为 `viewer.ts(152,111)` 的 `renderGraph` 第 8 个参数尚未加入函数签名。投影模块没有类型错误；这次命令退出码 1，不能记为全体类型检查通过。完整 typecheck、浏览器及最终构建由 interaction owner 完成后补充最终交付记录。

`git diff --check` 对本轮路径退出码 0，但这两个文件在既有工作树中仍是未跟踪文件，因此该命令不构成其内容验证。未提交、未推送、未运行模型或生产接入。
