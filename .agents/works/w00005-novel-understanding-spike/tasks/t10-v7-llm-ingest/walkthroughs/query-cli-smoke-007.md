# smoke-007 首章只读查询复验

2026-09-11 14:29，策略 -4 的 smoke 首章发布后，query_cli 对其实际发布快照做来源、结构、确定性重编译及 CLI 查询。全部原始结果保存在 ../evidences/smoke-007-query-verification.json。主 Agent 唯一控制运行；未恢复 formal-003，未改变策略或模型产物。

head=1，76 段、2036 Unicode 字符、277 节点、172 个复核单元。快照 hash 为 a2fc74a556cb33f3f703cb3a1dfaab4d9a0cda8abaac0191cbbd43800856b80a；原 EPUB/input hash、连续发布、材料和完整 C、全部 schema/引用/时间及确定性重编译均通过。未执行会调用 runner 的重复运行检查。

实际 CLI search：墨丘利秘典在 1:7、1:10、1:28 都无结果；造物主在 1:65 无结果。为避免 search 索引不含 review.note 造成假阴性，另通过同一查询服务按所有 node.kind 枚举并完整翻页，递归扫描每项返回的所有字符串字段（包含嵌入 assessment、原文摘录、review.note 等）。四个范围分别返回 26、27、105、210 条节点，均无上述目标词。此项只证明这份样本在所查词和边界上没有泄漏，不能证明旧 formal-003 的通用正文时间问题已修复。

当前苏天晴为 c01:entSu，古书为 c01:entBook，造物主为 c01:entCreator。古书名称从 1:29 依赖本段 mention 和 id_book 才可见。1:66 的 knowledge --holder c01:entSu --about c01:entCreator 返回 c01:a_su_hears_creator_tasks，mode=heard，target=c01:f_creator_tasks；命题保留 assertion=speech、holder=c01:entBook、opaque=true，没有提升为世界真值。同一查询在 Su 角色视角可返回相同听闻命题，并将读者的论证/评估保持不可见。

formal-003 的三次 get 最小泄漏复现另见 text-scope-minimal-repro.md 与 ../evidences/formal-003-text-scope-get.json。查询实现和 v4 提示词均没有为这个随机样本加入通用正文防泄漏修复，所以交付时必须分开说明“旧样本确有缺陷”和“新首章抽查通过”。20 章仍未完成。
