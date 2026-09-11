# 提前泄漏后续名称：最小复现

query_cli 于 2026-09-11 在已停止、只读的 formal-003 已发布第三章快照执行三次真实 CLI get，均退出 0。完整返回见 ../evidences/formal-003-text-scope-get.json。这里验证的是查询实际可见文本，不是根据源码推断。

在 t10 目录运行：

```powershell
node --import tsx ../t09-v7-query-cli/cli.ts --data evidences/formal-003/ch03/dataset-v7.json get c01:t_now --at 1:7
node --import tsx ../t09-v7-query-cli/cli.ts --data evidences/formal-003/ch03/dataset-v7.json get argument:c01:i2 --at 1:7
node --import tsx ../t09-v7-query-cli/cli.ts --data evidences/formal-003/ch03/dataset-v7.json get assessment:c01:i2:at:1:7 --at 1:7
```

三者 availableAt 都是 1:7，却分别在 time.label / time.data.description、argument.data.rationale / argument.data.review.note、assessment.data.note 中包含“墨丘利秘典”。该段原文只说“黑色古书”，argument 的显式依据也仅指向 1:7，没有后续自称的依据。其 rationale 更直接写出“后续自称墨丘利秘典”。

同一快照 entities --query 墨丘利秘典 --at 1:7 为空，search --query 墨丘利秘典 --at 1:7 返回上述三者。因此实体名称投影有效不能证明整个返回安全，去掉搜索字段也不能修好 get。原数据、候选及冻结运行代码没有改动。

smoke-007 尚未发布；发布后将用实际 ID 重做同样的文本范围检查。Parent 拥有通用修复边界和运行控制。
