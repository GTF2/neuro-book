---
schema: nbook.task/v2
taskId: t23-file-operation-settlement
---

# 文件操作与未保存正文及在途保存

## 目标与范围

沿 workspace.files 与 workbench.files-explorer 的既有合同：复制 dirty 文档显式选择先保存、磁盘版本或取消；移动结算输入并等待在途保存，保留 dirty 且成功后重绑定；删除显示影响范围及不可恢复风险，dirty/冲突默认取消。固定发起时的工作区绑定，失败不冒认新路径。

## 当前状态

已完成。Store 文件变更固定原 FilesClient，输入未决/保存失败/切换时拒绝；移动请求期间阻止旧路径保存，成功重绑定前再次 flush 并迁移候选输入与 buffer.node.path；失败保留新输入及原路径。拖动和菜单共用真实成功后迁移，退出旧乐观快照。Panel dirty 复制三选一、删除影响范围/不可恢复风险、dirty/冲突取消、目录明确确认后一次请求；Esc 清剪贴板，模式切换清隐藏 index 操作选择。

最新定向测试：Store/Panel/树 3 文件 37 tests 通过，Nuxt typecheck 通过。真实 Chromium dirty 复制磁盘版本保留 original disk，先保存副本与源均为 unsaved latest；dirty 目录移动时目标仍为旧磁盘基线，随后 Ctrl+S 写新路径 dirty after move，源不存在；dirty 删除未发 DELETE、盘上字节保留，Esc 后粘贴不弹框；各场景 pageErrors=[]。

## 下一步

进入性能/模型控件复用与产品运行时接线。两项 Files Spec 保持 planned。

## 授权边界

仅此前自建 Temp State/Cache/Projects 与 loopback 服务；不触碰用户作品、既有服务、真实模型，不提交、远端写入或整体清理 Temp 根。
