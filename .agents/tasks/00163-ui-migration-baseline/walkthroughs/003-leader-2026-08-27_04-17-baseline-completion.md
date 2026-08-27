---
schema: nbook.walkthrough/v1
taskId: 00163-ui-migration-baseline
sequence: 3
role: leader
status: completed
createdAt: 2026-08-27T04:17:52Z
---

# UI migration baseline 完成

## 结论

静态基线完整覆盖232个非页面SFC与14个preview源；按源码稳定key和独立触发行为冻结31个scenario。Task只产出证据，不修改产品行为合同。

## 基线结果

- SFC：glob/inventory/unique均232，缺失0、重复0；每条恰好一个`finalDispositionTask`。213条是跨owner直接依赖handoff，不是owner重复。
- Preview：14个expected/actual源逐字相等；31个scenario、31个唯一ID、14页均有场景。
- Scenario：product-behavior 5、demo-only 26。Workflow 6、Plot workspace 4、Plot timeline 3、Diff 7、DND 2，其余各1。
- World Engine：两页各一条，最终`ownerTask`均N；mock页仅以`fixtureOwnerTask: M`记录M的数据/fixture职责。
- 停止条件：源码足以静态判断kind，未命中browser/API才能分类的阻塞；运行证据未执行项逐条保留在`unverified`。

## Leader验证

- `bun run docs:check`：`failures: []`，检查5290个文件。
- `bun run governance:check`：`failures: []`、`warnings: []`。
- baseline-to-HEAD、工作树与暂存区diff checks均退出0。
- 场景结构脚本：`problems: []`，scenarios 31、pages 14、product 5、demo 26；逐项要求product有formalSurface、demo有labFixture，Workflow六个稳定ID存在，World owner均N。
- SFC结构脚本：首次误用不存在的`components`键并报TypeError；读取实际顶层键后改用`records`重跑，`problems: []`、records 232、unique 232、ownerConflicts 213。前一次失败是Leader验证脚本错误，不是证据失败。

## 审查

独立Reviewer首次给出3个P1：Workflow聚合、World M/N双owner、停止条件矛盾。返工后复核确认三项全部闭合，Plot/Timeline/Diff/DND拆分有稳定入口和证据对应，未发现新增material finding，结论“可完成”。

## 边界

未运行浏览器、产品测试、真实API或Provider/Model；本Task没有运行时行为变更。未授权也未执行push、PR、Issue/Project写入、合并、发布或部署。
