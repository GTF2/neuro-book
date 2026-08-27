# Task 00162 Context

生成时间：2026-08-27T01:37:30Z

- 基线 revision: `9e54e5d3863d3505ce26db149164e95d60950df6`

## 当前事实

- Issue #191是唯一聚合根；本Task与其它扁平Task共享`actionIssueId: 191`，无父Task。
- 基线包含PR #217最新治理合同；该PR未合并，本Task依赖revision `9e54e5d3`。
- p-006当前不存在；nb-ui元数据仍为PolyForm；nbook colorways仍含冷暖差异。

## 开发者决策

批准方案固定显式nb-ui接入、单一nbook主题/配色authority、仅开发态Lab、14个preview场景迁移后清退；Workbench/View Host、Editor Split和插件运行时排除。

## 依赖与边界

本Task可与00163基线Task并行，文件零重叠。两份UI planned Spec等待p-006 accepted后由Leader另建。本Task不得实现产品或修改远端。

## 授权边界

已授权本地可逆设计文档编辑、验证和本地commit。未授权push、PR、Issue/Project远端写入、合并、发布、部署、数据库迁移、真实Provider/Model、浏览器人工验收和数据删除。
