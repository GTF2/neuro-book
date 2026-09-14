# Plot Reference

本目录保存 NeuroBook Plot / Story 系统的稳定参考。

- [system.md](system.md)：Project SQLite 剧情系统合同，包含 Story、StoryPhase、StoryThread、StoryScene、StorySceneRef、Scene World Anchor 和 Agent 消费方式。
- [writer-brief.md](writer-brief.md)：`get_chapter_writer_brief` 的双视图格式契约（事实进 writer、意图进评审）。
- [keyframe.md](keyframe.md)：关键帧合同（写作宪法第三条）：帧字段、状态流转、补间区间语义与 agent 工具面。
- [agent-spec.md](agent-spec.md)：Agent 使用 Thread / Scene 的提示词规范，包含摘要密度、Scene 粒度和 World Engine 连接规则。
- [frontend.md](frontend.md)：剧情模块前端 UI / UX 规范。

Plot 是作者视角的剧情结构系统；Scene 是最小剧情单位，关键帧是时间轴上的不可逆变化锚点。动态世界状态和时间线真相源属于 World Engine，不属于 Plot System。
