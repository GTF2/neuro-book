---
schema: nbook.task/v2
taskId: t22-multi-select-clipboard-batch
---

# 多选、剪贴板与批量反馈

## 目标与范围

在同一窗口、同一有效工作区绑定内提供真实路径多选、复制/剪切意图和粘贴目标固定；后端批量复制/移动返回逐项结果，前端如实呈现部分成功、失败、跳过和未执行。父子重叠源去重，复制不携带 dirty 正文，系统剪贴板与编辑器正文剪贴板不混用。

## 当前状态

已完成。Store/Panel 与受控树已接线；两项 Files Spec 仍 `planned`。目录复制/移动、父子去重、独立失败继续、逐项绑定复核、History、成功移动文档引用迁移、复制残留记账和产品逐项反馈已实现。不包含回收站、跨项目剪贴板或跨文件原子事务。

## 验收

已验证：

- 隔离 HTTP 复制/移动含 `index.md` 与二进制附件的目录，目标字节一致；父子源只执行外层；同名目标失败后独立项继续；绑定失效后后续项 `not-executed`；部分复制失败返回残留路径并保留 History。
- 真实 Chromium 快速普通单击+Ctrl/Meta、Shift、Space、Ctrl+A、右键保留和内容模式目录身份；全选集合等于全部可见行，`pageErrors=[]`。
- 产品 Ctrl+C/Ctrl+V 与 Ctrl+X/Ctrl+V 确认、逐项反馈、目标磁盘读回、成功后源目录消失和剪贴板清空；内容模式仍操作真实目录，`pageErrors=[]`。页面截图已观察到完成通知与逐项结果。

定向测试：批量/History/guard/Panel 4 文件 20 tests 通过；Storage 边界/Panel/树 3 文件 22 tests 通过；复制原语链接/残留 3 tests 通过；最新 Nuxt typecheck 通过。Project canonical 根修复消除了 Windows 8.3 短路径造成的 `open 200/tree 409`，现为 `open 200/tree 200`。

## 边界

仅使用此前隔离 Temp State/Cache/Project 和自建 loopback 服务；不触碰用户作品、既有服务或真实模型；不提交、push、部署或整体清理 Temp 根。