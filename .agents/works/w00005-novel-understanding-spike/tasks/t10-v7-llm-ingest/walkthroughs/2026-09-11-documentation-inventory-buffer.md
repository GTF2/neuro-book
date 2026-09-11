# 大量审计路径下的文档检查修复

本Task增加真实请求审计后，常规bun run docs:check在Git清单读取阶段以ENOBUFS退出，还没执行文档校验。完整Git清单实测1,156,051字节，超过Node execFileSync默认1 MiB上限。这与小说内容或文档链接无关；提交审计资产后，常规仓库检查同样会触发，因此在本Task中附带修复既有Git执行边界。

scripts/ci/agent-governance-contract.ts的git函数将输出上限显式设为32 MiB，保持原命令、退出码、stderr及返回文本合同。没有跳过文件或改变校验规则。新建相邻agent-governance-git.test.ts，在受控系统Temp的真实Git索引中登记16,000条审计路径，核对超过1 MiB的完整NUL分隔清单；不生成16,000份文件，不写用户仓库索引，结束后清理临时根。

验证：新回归在修复前复现spawnSync git ENOBUFS；修复后与check-documentation.test.ts合跑17项通过。bun x tsc --noEmit -p scripts/tsconfig.json通过。常规bun run docs:check恢复成功，11,253文件、0失败。修复前通过同一checker的完整流式清单调用也得到0失败，原时间点证据保存在../evidences/documentation-check.json，不冒称该时点常规CLI已经通过。

自审检查了容量上限、跨平台参数数组、原错误语义、索引测试的隔离与清理。32 MiB仍是有界输出，当前修复不把这个仓库辅助函数改成无界流式进程框架。主线8份ingest策略源码、运行目录和t07/t08不受影响。
