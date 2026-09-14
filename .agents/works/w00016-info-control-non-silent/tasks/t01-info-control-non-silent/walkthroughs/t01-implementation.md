# t01 实施记录：漏传 infoControl 必定显形

日期：2026-09-14。分支：feat/writing-doctrine-alignment。

## 调研结论（决定了本轮做法）

1. `chapter-write-review-revise` 的 `infoControl` 是**调用方传入的可选字符串**；缺失时一致性评审的核对段整段消失，评审照常通过——这是「静默失去事后校验」的确切位置。
2. workflow 内核确实有 `wf.query` / `wf.callAction`（`packages/nb-workflow/src/types.ts:244-260`），但**产品宿主未接线**：整个 `packages/neuro-book` 只有一份 proposal 提到 `ActivityExecutor`，没有任何实现。因此 workflow 今天无法确定性读取 Plot / 项目数据。
3. `adhoc` 评审员的工具面固定为 `read` + `report_result`（V1 没有 `initial.tools`），所以「让评审自己去查 ChapterBrief」这条路也不通。
4. 因此自动编译不是"改几行"，而是需要一项独立能力；本轮做的是零成本、确定性的「显形」保证。

## 实际改动

- `assets/workspace/.nbook/agent/workflows/chapter-write-review-revise/workflow.ts`：
  - 新增 `infoControlChecked = infoControl.length > 0`；
  - 一致性评审的核对段抽成 `infoControlBlock`：有清单＝清单原文 + 逐条核对要求（原行为）；无清单＝显式标注「调用方未提供本章信息控制清单：本轮不做信息边界判定……请在 overall 里明确写明「信息边界未核对」」；
  - 缺失时 `wf.log("警告：未提供 infoControl 清单……")`；
  - 返回值新增 `infoControlChecked`；
  - `argsHint` 写明清单来源（leader 从 StoryChapter 四字段编译）与漏传后果。
- `server/agent/workflow/chapter-write-review-revise.workflow.test.ts`：新增「漏传必显形」用例（评审含标注、返回值 `false`、事件流含警告、writer 消息仍不含信息控制）；已有 infoControl 用例补 `infoControlChecked=true`。
- `skills/novel-writing/phases/03-chapter-loop.md`：`infoControl` 从「可选」改为「每次都要传」，写清编译来源（`get_story_chapter` 的 `readerKnows` / `protagonistKnows` / `mustHide` / `hintOnly`）与漏传后果。
- `assets/reference/plot/writer-brief.md`：第 3 段分工表补「由 leader 编译传入；漏传时一致性评审显式标注未核对，不静默跳过」。
- `docs/specs/plot/chapter-writer-brief.md`：非目标补「漏传不再静默」；验收补两条场景（漏传 / 传入）。
- `docs/specs/README.md`：新增 P1 规范缺口「Workflow 侧读取项目数据（infoControl 自动编译）」。
- `docs/standards/fork-seams.md`：S9 补记本轮行为（约 25 行）。

## 验证

- `bun run --cwd packages/neuro-book test -- chapter-write-review-revise`：1 file / 5 tests passed。
- `bun run --cwd packages/neuro-book test -- server/agent/workflow`：见末尾补充。
- `bun run --cwd packages/neuro-book typecheck`、`bun run docs:check`、`bun run governance:check`：见末尾补充。

## 偏差与说明

- 未采纳「在 workflow 里加一次 leader 模型调用来读四字段」的替代方案：那是用不确定性 + 每章一次额外模型调用，去换一次数据库字段读取；正确解法是让 workflow 能确定性读项目数据（已登记缺口）。
- 未把 `infoControl` 改成必填：workflow 无法区分「本章确实没有信息控制」与「忘了传」，必填会误杀前者。

## 未验证

- 真实模型下漏传 / 传错清单时的评审表现（需 Provider 运行）。
- 运行中的应用要资产同步 / 重启后才装载新的 workflow 文本。
