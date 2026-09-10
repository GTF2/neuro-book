# V7 查看器可读性与交互修复

## 结果

本轮回应开发者对提及/依据混淆、同名造物主节点、情节/命题同色、四个混合控制、知情联系缺失和弧线的反馈。主体关系、命题图、记录溯源为互斥表示；全部与主体周边是独立范围。展开相关命题和完整引用使用复选框，图设置收纳标签、缩放与结构边筛选。

图边全部为直线，同一主体对的不同联系以平行偏移保留。边支持键盘选中和高亮，增大点击区域，标签避让节点和其它标签。命题为蓝色方形，情节为绿色旗形，原文词语、局部指称、身份判断等具有类型文字和独立标记。造物主默认溯源为四节点三条连接的主链；完整引用仍可查看，候选/未定判断不标为确定归属。

原文出现位置展示主体所对应的 Mention；本记录的原文摘录与建模依赖分别展开。返回保存选中联系、主体焦点、范围、图表示、筛选和页码，可从知情记录到原文再返回。手机端筛选折叠，目录保留 144px 滚动区域。浏览器发现目录计数覆盖返回按钮，已修成独立网格列并通过真实点击回归。

显式认知导航见 [投影报告](2026-09-10-knowledge-contact-projection.md)。默认 24 主体、11 组命题联系、16 组认知联系；52 个派生导航项聚合后不增加任何领域记录。苏天晴到造物主显示听闻相关说法，保持 `access:su:f119`、`f119` 和 `d119` 来源。不是生产自然语言问答或自动认知推断，也不以听闻证明发言内容为世界真相。

## 验证

- t08 `bun run test`：3 个文件、19 项测试通过，包含认知边界、失效、筛选、未知身份和溯源链。
- t08 `bun run typecheck`：strict TypeScript 通过。
- t08 `bun run browser`：隔离 headless Microsoft Edge 通过；页面异常和外部网络请求均为零。
- 实际浏览器覆盖知情联系键盘选择、高亮、命题及知情记录回链、原文第 66 段、三步返回、四节点身份链、完整引用筛选后回主链、全部命题范围恢复、命题与情节不同颜色及形状、全部 58 命题分页、搜索、拖拽缩放、导入导出、阅读边界、角色视角和名称依据撤回。
- 1440/1024/768/390/320 与往返 resize、320 直接载入无横向溢出和主体圆碰撞；320 命题、身份链与造物主知情周边均有截图。主 Agent 实际查看了桌面身份链、世界命题、320 身份链和知情周边截图。
- 连续构建两次，以完整字节编码相等及 SHA-256 相等确认确定性；首次 HTML 保存在本轮证据目录。

最终证据目录：`C:/Users/NOTNOT~1/AppData/Local/Temp/neuro-book/runs/t08-v7-memory-viewer/browser-e888fa44/`，报告 `browser-result.json`。最终 HTML 1007611 bytes，SHA-256 `c5d600480f40f8ce0aba1c000b9ff647aa6e75df4355dfeed4d817d18f44a783`。先前 `browser-36117b5b`、`browser-a3ecc720` 是未完成验收的中间版本，不作为最终通过证据。

t07 `dataset-v7.json`、`annotations.json`、`schema-v7.json` 的 SHA-256 与本轮开始相同，EntitySummary 数据和语义未修改。未重跑 t07/全仓测试，未运行真实模型调用、生产集成或开发者人工验收；无提交、推送、发布。

## 范围与执行

Work 为 `w00005-novel-understanding-spike`，Task 为 `t08-v7-memory-viewer`，role 为 tasker，Issue 为 null，提案仍为本地 spike。基础 revision `467d9a30251eb65d50f8270f02e52e394b64140e`，沿用 `feat/w00005-v6-ingest-viewer` worktree。修改 `knowledge-graph.ts/test`、`structure-graph.ts/test`、`view-model.ts`、`viewer.ts`、`detail.ts`、`graph.ts`、`viewer.template.html`、`viewer.css`、`build.ts`、`browser-check.ts` 和生成 HTML；同步 Task/Work 入口与 knowledge-model 浏览投影说明。所有旧版及无关用户改动保留。

投影与交互由两位 Tasker 分工完成；交互执行者工具中断后，主 Agent 接续同一 Task 的剩余浏览器路径、点击修复和验收，没有改变目标与数据所有权。当前文件含前轮未提交/未跟踪资产；`git diff --check` 不能替代这些文件的类型、测试和浏览器验证。
