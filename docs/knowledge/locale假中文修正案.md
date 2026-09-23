# locale 假中文修正案（zh-CN.ts）

- 对象：`packages/neuro-book/app/i18n/locales/zh-CN.ts`（2782 行，2482 个键）
- 日期：2026-09-22；实扫人：假中文修正案员（工程队）
- 方法：通读 zh-CN.ts 全文；对可疑键逐一对照 `en-US.ts` 原文判定"误译/有意保留"；跑键集 diff 确认无缺键。
- 机械检查命令与结果：
  - `grep -nP '"[A-Za-z0-9][A-Za-z0-9 ,.:;!?(){}\[\]_/@#%&*+=<>~\\|-]*"\s*,?\s*$' zh-CN.ts` → 仅 3 处纯英文值（`english: "English"`、`thinking: "Thinking Map"`、`htmlBlockCaption: "HTML"`，均为有意保留，见第六节）。
  - `bun -e` 对比 en-US/zh-CN 扁平键集 → 双方各 2482 键，**zh 缺键 0、en 缺键 0**，不存在回退英文的缺键。
- 红线遵守：本文档只列方案，未改动 locales 文件本身；执行由后续任务统一做。
- 结论：**主体修正 49 条 + 待产品定名 6 条**，共 55 条（此前盘点约 58 条，以本次实扫为准，多退少补）。

---

## 一、误译 / 语义错误（9 条，必改）

### 1. ide.profile.manageAuthorizations（L955）
- 现值：`检查官网授权管理`
- 应改值：`到官网检查授权`
- 理由：en 原文 "Review site authorizations"，现值"检查……管理"动宾杂糅，读不通。

### 2. decisionStack.receiptTag（L2529）
- 现值：`已入档核对`
- 应改值：`已核对`
- 理由：en 原文 "Verified"，现值"入档+核对"两个动作叠在一起，语义歧义且无出处。

### 3. agent.textBubble.retry（L2343）
- 现值：`刷新`
- 应改值：`重试`
- 理由：en 原文 "Retry"，且全文件其余十余处 `retry` 键均译"重试"，此处是孤例错译。

### 4. settings.panels.modelEdit.emptyLabel（L612）
- 现值：`要求: {value}`
- 应改值：`必填：{value}`
- 理由：en 原文 "Required: {value}"，"要求"未表达 required 的"必填"义。

### 5. settings.panels.modelEdit.costTierThreshold（L636）
- 现值：`Input tokens 严格大于`
- 应改值：`输入 tokens 需大于`
- 理由：同段 inheritedCostThreshold（L632）已用"输入 tokens"，此处英文开头属残留，且"严格大于"作界面标签过译。

### 6. agent.attachments.total（L1918）
- 现值：`全部分支共 {count} 个唯一附件`
- 应改值：`全部分支共 {count} 个附件（去重后）`
- 理由：en "unique attachments" 直译"唯一附件"不符合中文习惯，实际义为去重计数。

### 7. agent.sessionTree.profileInjection（L2284）
- 现值：`[配置注入] Profile configuration`
- 应改值：`[配置注入] Profile 配置`
- 理由：en "[Config injection] Profile configuration"，后半句整段英文未译，属占位漏翻。

### 8. ide.workspace.workspaceStage.backToNormal（L1786）
- 现值：`返回常态`
- 应改值：`返回普通视图`
- 理由：en "Back to normal"，"常态"在此界面语境生硬，按钮语义是回到普通工作区视图。

### 9. settingsWorkspace.fields.streamReplies（L1822）
- 现值：`流式输出回复`
- 应改值：`流式回复`
- 理由：动宾堆叠"输出回复"是英式语序，功能名即"流式回复"。

---

## 二、占位未译 / 英文残留（4 条，必改）

### 10. ide.chapterPanel.plotScene（L1751）
- 现值：`剧情 Scene`
- 应改值：`剧情场景`
- 理由：Scene 英文残留；同文件 referenceMenu/plotSceneSection（en "Plot Scenes"）等处 Scene 均译"场景"。

### 11. ide.chapterPanel.noScene（L1752）
- 现值：`本章尚未编排剧情 Scene`
- 应改值：`本章尚未编排剧情场景`
- 理由：同上。

### 12. ide.chapterPanel.noPlotSummary（L1755）
- 现值：`暂无 Plot 摘要`
- 应改值：`暂无情节点摘要`
- 理由：Plot 英文残留；同文件 plotNodeSection 已定译"情节点"。

### 13. ide.chapterPanel.noPlot（L1757）
- 现值：`暂无 Plot`
- 应改值：`暂无情节点`
- 理由：同上。

---

## 三、机翻腔 / 直译腔 / 标点（30 条，建议改）

### 14. agent.composer.steerQueue（L1880）
- 现值：`引导；Ctrl+Enter / Ctrl+点击 队列`
- 应改值：`引导；Ctrl+Enter / Ctrl+点击入队`
- 理由：en "Steer; Ctrl+Enter / Ctrl+click queues"，"队列"被当动词用，中文应为"入队"。

### 15. agent.composer.steerQueueExpanded（L1879）
- 现值：`引导；Ctrl+点击 队列`
- 应改值：`引导；Ctrl+点击入队`
- 理由：同上。

### 16. agent.composer.waitingBlocked（L1873）
- 现值：`当前等待输入状态不可回答`
- 应改值：`当前处于等待输入状态，暂不能回答`
- 理由：en "This waiting state cannot accept an answer"，现值名词串直译缺谓语。

### 17. settings.panels.models.oneClickRepairResult（L791）
- 现值：`…删除 {removed} 个不完整已停用模型；仍有…`
- 应改值：`…删除 {removed} 个信息不完整的已停用模型；仍有…`
- 理由："不完整已停用模型"三层定语直译堆叠，需补"的"并补出"信息"。

### 18. settings.panels.models.enabledModelsDescription（L868）
- 现值：`按 Group 分组展示。右侧管理可查询更多。`
- 应改值：`按 Group 分组展示；更多模型可在右侧管理区查询。`
- 理由：en "Manage more models on the right."，"右侧管理可查询更多"压缩失义。

### 19. settings.panels.models.agentVisibleModelsOverLimit（L823）
- 现值：`…建议保留最常用的 5 条以内。`
- 应改值：`…建议保留 5 条以内最常用的。`
- 理由："保留最常用的 5 条以内"数量词位置英式，中文习惯数量词在前。

### 20. settings.panels.models.discovering（L843）
- 现值：`抓取中...`
- 应改值：`查询中...`
- 理由：动作是发现/查询模型（discoverModels 已译"查询可用模型"），"抓取"易误解为网页抓取。

### 21. settings.panels.defaultProfile.workspaceUserAssetsDefault（L545）
- 现值：`Workspace Root 用户资产默认`
- 应改值：`Workspace Root 用户资产默认值`
- 理由：en "…user assets default"，缺"值"字读作半句。

### 22. settings.panels.defaultProfile.workspaceNovelDefault（L546）
- 现值：`Workspace Root 小说默认`
- 应改值：`Workspace Root 小说默认值`
- 理由：同上。

### 23. agent.chatSurface.followProfileDefault（L2094）
- 现值：`跟随 Profile 默认`
- 应改值：`跟随 Profile 默认值`
- 理由：同上，补"值"字成完整名词短语。

### 24. agent.composer.resetProfileDefault（L1892）
- 现值：`回到 profile 默认`
- 应改值：`恢复 Profile 默认值`
- 理由：口语+小写 profile（全站统一大写 Profile），按钮语义是恢复默认值。

### 25. agent.chatSurface.contextUnknown（L2097）
- 现值：`Context 估算 - / -`
- 应改值：`上下文估算 - / -`
- 理由：同文件 contextInspector 等处 Context 均译"上下文"，此处英文残留。

### 26. agent.chatSurface.contextEstimate（L2098）
- 现值：`Context 估算 {used} / {limit} tokens{percent}`
- 应改值：`上下文估算 {used} / {limit} tokens{percent}`
- 理由：同上。

### 27. settings.security.runtimeStatusDescription（L248）
- 现值：`当前进程启动时加载的状态，不代表磁盘文件的未重启修改。`
- 应改值：`当前进程启动时加载的状态，不代表磁盘文件中尚未重启生效的修改。`
- 理由："未重启修改"动名词关系拧巴，需补"尚未……生效"。

### 28. settings.frontend.simplifiedChineseDescription（L259）
- 现值：`中文源语言与默认回退语言。`
- 应改值：`界面源语言与默认回退语言。`
- 理由：en "Chinese source locale"，"中文源语言"读似语言学概念，实指界面文案源语言。

### 29. settings.panels.cost.exchangeRateMissing（L452）
- 现值：`尚未刷新；没有可用汇率时…`
- 应改值：`汇率尚未刷新；没有可用汇率时…`
- 理由：开头缺主语，"尚未刷新"突兀（en "Not refreshed yet." 指汇率）。

### 30. settings.themeEditor.themeVars.bgSubtle（L360）
- 现值：`轻微底色`
- 应改值：`淡色背景`
- 理由：en "Subtle Background" 直译"轻微"不符合配色名习惯。

### 31. settings.themeEditor.themeVars.borderStrong / borderAccent（L368-369）
- 现值：`强调边框` / `强调边框色`
- 应改值：`加重边框` / `强调色边框`
- 理由：en "Strong Border" / "Accent Border"，现值两键几乎同名无法区分。

### 32. agent.linkedAgents.linkedBy（L2253）
- 现值：`绑定当前 session 的 Agent`
- 应改值：`绑定到当前 session 的 Agent`
- 理由：与 owned（"当前绑定的 Agent"）方向相反，现值缺"到"字分不清绑定方向。

### 33. ide.workspace.lorebookDetail.category（L1304）
- 现值：`设置类别`
- 应改值：`设定类别`
- 理由：lorebook 是小说"设定"集（同段 settingSummary 译"设定摘要"），"设置"在此读作动词产生歧义。

### 34. markdownStudio.tutorial.reservedContract（L2759）
- 现值：`预留合同`
- 应改值：`预留契约`
- 理由：contract 技术语境中文惯用"契约"，"合同"是商业语境误植。

### 35. admin.displayName（L144）
- 现值：`显示名`
- 应改值：`显示名称`
- 理由：en "Display Name"，"显示名"是截断式直译，补全更自然。

### 36. ide.workspace.common.targetPath（L1164）
- 现值：`目标 path`
- 应改值：`目标路径`
- 理由：path 小写英文残留，此处非必须保留的代码字面量。

### 37. ide.workspace.lorebookDetail.targetOrPending（L1312）
- 现值：`目标 path 或 pending`
- 应改值：`目标路径或待定`
- 理由：同上；pending 同文件 workspace.common.statusPending 已译"待定"。

### 38. ide.workspace.filePanel/fileDetail convert 系列（6 键）
- 键与现值：convertDirectoryFailed（L1212）`转化目录节点失败`、convertFileFailed（L1213）`文件转目录节点失败`描述同源、convertDirectoryNode（L1245）`转化为目录节点`、convertFileToDirectoryNode（L1246）`文件转目录节点`、fileDetail.convert（L1262）`转化`、fileDetail.contentDirectoryWithoutIndex（L1266，文案内"点击'转化'"）
- 应改值：统一"转化"→"转换"（如 `转换`、`转换为目录节点`、`转换目录节点失败`，L1266 同步）
- 理由：计算机语境 convert 规范译法是"转换"，"转化"是化学/生物语境用词。

### 39. ide.chapterPanel.charactersLabel（L1765）
- 现值：`角色 (使用逗号分隔)`
- 应改值：`角色（使用逗号分隔）`
- 理由：全文件 UI 文案统一全角括号（如"备注（可选）"），此处半角为孤例风格。

### 40. ide.chapterPanel.todosLabel（L1767）
- 现值：`待办 (使用逗号分隔)`
- 应改值：`待办（使用逗号分隔）`
- 理由：同上。

### 41. 半角冒号批量（5 键）
- 键与现值：modelEdit.defaultDerived（L605）`默认推导: {group}`、modelEdit.currentLabel（L618）`当前: {value}`、toolPanel.conflictProfileTitle（L1588）`Profile 覆盖冲突: {label}`、toolPanel.conflictAssetTitle（L1589）`Asset 覆盖冲突: {label}`、bookshelf.lastUpdatedTitle（L1635）`最后更新: {time}`
- 应改值：冒号统一为全角"："（如 `默认推导：{group}`、`最后更新：{time}`）
- 理由：中文文案冒号应全角；sessionTree.toolCallsSummary（L2283，`调用工具: {names} ({count}次)`）可一并改为"调用工具：{names}（{count} 次）"。

### 42. common.saveSettings（L9）
- 现值：`保存设定`
- 应改值：`保存设置`
- 理由：settingsWorkspace.title 为"设置"、models.editSettings 为"编辑设置"，"设定"在小说产品里留给世界观设定义，配置保存按钮应用"设置"。

### 43. ide.header.accountMenu（L934）
- 现值：`账户菜单`
- 应改值：`账号菜单`
- 理由：同文件 auth/ide.profile 全部用"账号"（官网账号、账号密码），"账户"为孤立异写。

---

## 四、同一概念多种译法（7 条，需统一）

### 44. observability：`可观测` → `可观测性`
- 键：settings.section.observability.label（L221）；联动 agent.contextInspector.disabled（L2196）内"设置 → 可观测"
- 应改值：`可观测性`（L2196 同步"设置 → 可观测性"）
- 理由：observability 规范译名"可观测性"，"可观测"是截断；两处需同步。

### 45. disable：`弃用` → `停用`
- 键：settings.panels.models.disableModel（L876）
- 现值：`弃用/移除`
- 应改值：`停用/移除`
- 理由：同段 disabledModels（L878）已译"已停用模型"，"弃用"为第三种译法；provider 级"禁用"（providerDisabled）语义不同可保留。

### 46. check：`检查/检测` 混用 → 统一 `检测`
- 键与现值：checkProvider（L842）`检查 Provider`、checkModel（L874）`检查模型`、cancelModelCheck（L872）`取消检查`
- 应改值：`检测 Provider`、`检测模型`、`取消检测`
- 理由：同段 checkAllModels（L870）`检测全部`、checkingAllModels（L871）`检测中...`、cancelModelChecks（L873）`取消检测`已用"检测"；"模型健康检查失败"（L803）是固定搭配可不动。

### 47. Model Library：`模型管理库` → `Model Library`
- 键：settings.panels.models.modelLibrary（L888）
- 应改值：`Model Library`
- 理由：同段 libraryMatched/loadModelLibraryFailed/addFromLibrary 等 5 处均保留英文 "Model Library"，此 tab 名为孤例中译，二选一需统一（倾向保留英文）。

### 48. Profile：`配置档` → `Profile`
- 键：agent.session.profile（L2041）
- 应改值：`Profile`
- 理由：全站 Profile 一律不译（跟随 Profile、Profile 设置、Profile Home），筛选标签"配置档"为孤例。

### 49. summarizer：`摘要器` → `自动摘要`
- 键：agent.chatSurface.summarizerLabel（L2071）
- 应改值：`自动摘要`
- 理由：settings.panels.profileModels.summarizer（L683）定为"自动摘要"，"摘要器"是第二种译法；agent.profiles.summarizer（L2019）`会话摘要` 是 Profile 展示名（en 有意作 "Session Summarizer"），建议一并复核是否统一。

---

## 五、待产品定名（6 条，只记录，不建议硬改）

### 50. session：`会话` vs `对话` 大面积混用
- 代表键：agent.composer.createSession `新建对话`（L1878）vs agent.session.title `会话列表`（L2026）vs agent.session.newChat `新建对话`（L2030）vs prefab.historyPanel.title `历史对话`（L2557）/newChat `新会话`（L2558）
- 说明：同一英文词 session 在聊天 UI 译"对话"、在列表/技术语境译"会话"，混用超 10 键。聊天语境"对话"更自然，全量统一工程量大，需产品定名后批量替换。

### 51. volume：`篇` vs `卷`
- 代表键：ide.workspace.filePanel.treeTypeVolume `卷`（L1255）、fileDetail.hintUpdateStats `本卷`（L1295）vs chapterPanel 全段 `篇`（createVolume L1721、editVolumeTitle L1760 等）
- 说明：章节面板与文件树对面同一实体用了两个字，需产品定名（长篇网文习惯"卷"）。

### 52. plot 入口：`剧本工作台` vs `剧情`
- 代表键：ide.header.plotWorkbench `剧本工作台`（L921）、markdownStudio.welcome.plotWorkbench（L2726）vs toolPanel.plot `剧情`（L1568）、workspaceStage.page.plotOutline `剧情大纲`（L1790）
- 说明："剧本"与"剧情"指向同一 plot 域，入口名与内容名不一致，需产品定名。

### 53. settings 入口：`配置中心` vs `设置` vs `设定`
- 代表键：settings.title `配置中心`（L165）vs settingsWorkspace.title `设置`（L1799）；settings.frontend 主题文案用"前端设定/保存设定"
- 说明：两个设置页各有一个名字是否刻意（配置中心管 config 文件、设置管 UI）需产品确认；若合并定名，"设定"仅保留世界观语境。

### 54. inspector：`检查器` vs `检视器`
- 代表键：worldEngine.workbenchPreview.inspector `检查器`（L48）vs ide.header.ragInspector `检索检视器（RAG）`（L927）
- 说明：同一英文词 inspector 两种译法，两个面板语义不同可豁免，但建议统一用字。

### 55. reasoning 档位：`推理强度` vs `思考强度` vs `思考档位`
- 代表键：settings.frontend.reasoningTitle `推理强度`（L287）、profileModels.reasoningEffort `推理强度`（L681）、traceViewer.field.reasoning `推理强度`（L2181）vs agent.composer.thinkingEffort `思考强度`（L1890）vs prefab.tierDropDown.label `思考档位`（L2534）
- 说明：en-US 原文也刻意区分 "Reasoning Effort" 与 "Thinking Effort" 两个词，中译是否跟随英文分词需产品确认；从中文用户视角统一为"推理强度"最省心。

---

## 六、核实后排除（非假中文，勿改）

- `settings.frontend.english: "English"`（L260）——语言选择器显示语言原名，国际惯例。
- `settings.panels.modelEdit.jsonFields.thinking: "Thinking Map"`（L593）——Pi 功能专名，与 en-US 一致，有意保留。
- `markdownStudio.editor.htmlBlockCaption: "HTML"`（L2609）——专有缩写。
- `settingsWorkspace.fields.defaultModel.placeholderA/B: "占位模型甲/乙"`（L1819-1820）——演示占位数据，en 同为 "Placeholder model A/B"，属功能演示非漏译。
- `markdownMenu.aiGenerateDescription` 等 5 处"占位，后续接入……"（L1483、1485、1505、1507、1511）——en 亦为 "Placeholder for future …"，两边一致的有意标注；开发口吻是否适合暴露给终端用户，归第五节产品决策，不列为假中文。
- 各类保留英文术语（Agent、Session、Provider、Model、Run、Tier、diff、token 等）为产品术语约定，不属假中文。

---

## 执行提示（给后续统一执行任务）

1. 本文 1-49 条为逐键硬改清单，改完后必须跑 `bun -e` 键集 diff 复核（改值不得增删键）。
2. 第 38 条（convert 系列 6 键）与第 41 条（半角冒号 5 键）是批量项，逐处编辑、报告实际修改的文件，禁止单点替换工具一把梭。
3. 第 50-55 条在产品定名前**不要动**，避免返工两次。
4. en-US.ts 是否同步修正不在本方案范围（zh 为源语言场景下的反向同步由执行任务评估）。
