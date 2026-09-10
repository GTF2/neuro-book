# V7 节点颜色与展开布局修复

## 交付

本轮回应开发者对主体圆圈颜色、展开相关命题拥挤和红灰双线的反馈。产物为 [离线查看器](../viewer-v7.html)，数据、schema、查询和 EntitySummary 仍归 t07，未修改。

主体类别由 `visual-semantics.ts` 统一供图、目录和详情消费：红色人物、紫色身体、黄色物品、绿色地点、蓝色组织；灰色继续保留世界、契约、身份、类别、概念、任务等实际类别名称。局部指称改为菱形，悬停与身份链显示类型，避免与身体圆圈混淆。图例随当前节点更新。

命题联系与认知联系有独立复选框和对应线样。认知联系箭头与线身保持同色，选中后加粗且保留语义颜色。隐藏所选联系时清理高亮并恢复节点详情；返回记录保存两个开关。命题与认知仍各自回溯原始记录，听闻不能升为知晓真相。

展开相关命题每页最多 6 条，苏天晴 42 条全部可达，共 7 页。图使用为文字保留行高的分列布局，窄视口将主体移到顶部、命题置于左侧；画布可滚动、平移和缩放，不再压缩所有文字到固定视口。改变主体或节点集合自动排布；本页选中命题保留页码、展开状态及位置，重排按钮恢复布局。默认主体关系视图保留自由图。窄屏目录为固定行高的两行标题，完整内容由详情和悬停呈现。

## 验证

- Task 目录 `bun run typecheck`：退出 0。
- `bun run test`：退出 0，3 个文件、21 项测试通过。新增全部相关命题分页、知情连接当前页限定、逻辑布局间距和类别语义校验。
- `bun run browser`：退出 0，隔离 headless Microsoft Edge 15 组工作流通过，页面异常和外部网络请求均为零。
- 实际浏览器检查全部 42 条相关命题和全部 58 条命题可达；密集末页在 1440/768/390/320 下实际 SVG 标签可见、不重叠且在逻辑画布内；窄屏目录标题不超行；滚动、选中、返回、重排与两类连线独立开关有效。
- 既有原文回链、造物主听闻限定、身份主链、阅读边界、角色视角、筛选、拖拽缩放、导入导出及名称依据失效回归通过。
- 主 Agent 查看最终桌面和 320 展开截图；自动断言通过后曾根据截图修复目录文字溢出和展开首屏留白。
- 再构建与证据中首份 HTML 完整字节相同。最终 1014771 bytes，SHA-256 `713178c22d46bcf38f17b68a6621cc2ed610dd3b2339f6a1b6ede7489218773e`。
- worktree 根 `bun run docs:check` 退出 0，检查 6167 个文件，无失败；Work 差异与 Task 源文件尾部空白检查通过。

最终证据目录：`C:/Users/NOTNOT~1/AppData/Local/Temp/neuro-book/runs/t08-v7-memory-viewer/browser-70b4fc67/`。含 `browser-result.json`、24 张截图、`viewer-first-build.html`。`browser-5d171a86` 和 `browser-2fd9ce9b` 是本轮中间版本，不作为最终产物证据。

t07 SHA-256 与本轮基线一致：`dataset-v7.json` 为 `C65A94D6396FFAB6DA8C03F99AD4C71A9EB73DDA607B76B961084DA5AED6ED83`；`schema-v7.json` 为 `2FD4EAD8F3163FA6514EA2757D034399E9FCD531E944C267373FE13E2D8368BA`；`annotations.json` 为 `7350B1454035EE4EDD763EF062EC7B1ADCF4B8E193F58703F05A81BE4E5B4450`。

未运行 t07 或全仓测试、生产集成、真实模型调用或开发者人工验收；没有提交、推送和发布。窄屏采用滚动画布，关联对象可能位于当前可视区域之外，未宣称全部节点同时可见。

## 执行范围

沿用 `feat/w00005-v6-ingest-viewer` worktree、Task `t08-v7-memory-viewer`，基础 revision 为 `467d9a30251eb65d50f8270f02e52e394b64140e`。本轮修改 `knowledge-graph.ts/test`、`graph.ts`、`viewer.ts`、`viewer.template.html`、`viewer.css`、`detail.ts`、`browser-check.ts` 与生成 HTML，新增 `visual-semantics.ts` 和 `expanded-layout.ts`，同步 Task/Work 交付入口。

原有两个 Tasker 因服务余额错误中断，主 Agent 读取 Tasker 合同后接续同一 Task 的未完成实现和验证。未扩张数据所有权；未取得新的独立 Agent 复核，以上证据为主 Agent 自动与截图复核。旧版本与工作树已有无关修改保留，未暂存。
