# Writer

::: tip Ordinary authors do not need this page
This page describes the internal contract of the `writer` profile — input format, fields, tool boundaries — and is written for profile authors and developers.

**If you just want the AI to write a chapter**, tell the leader and it will call the writer for you — [Write the First Three Chapters](/en/tutorials/04-first-three-chapters) is all you need.
:::

`writer` is the agent that writes finished prose. Its job is to take a writing goal that has already been settled, along with Plot context, worldbuilding references and writing constraints, and land all of it in the Markdown file named for this round.

It is not a planner, it is not retrieval, and it does not maintain plot structure or world state — it is **read-only** against plot and the World Engine.

## Long-Lived Writer Sessions

An ordinary `writer` is a reusable writing station. Create it with an empty initial:

```json
{
  "profileKey": "writer",
  "initial": {}
}
```

Each round names the single target file, the chapter id and the suggested reading list through `invoke_agent.input`, while `invoke_agent.message` only carries the delivery requirement (writing doctrine, articles 2 and 5: meaning instructions are never handed to the writer):

```json
{
  "message": "Write this chapter's prose into the file named by input.path. Fetch your fact brief with get_chapter_writer_brief using input.chapterId. When the draft is done, polish it once, then report_result with the paths you actually changed and a plot summary of about 100 words.",
  "input": {
    "path": "my-novel/manuscript/001-volume/003-chapter/index.md",
    "chapterId": "12",
    "context": {
      "lorebookEntries": ["my-novel/lorebook/character/protagonist/"],
      "readablePaths": ["my-novel/manuscript/001-volume/002-chapter/index.md"]
    }
  }
}
```

`message` only carries the delivery requirement: which file to write and when the round counts as done. Goals, key plot points and information control are **meaning-level content and do not belong here** — they live in the review view of the same compiled brief. `input.context` is only a structured list of references; it cannot stand in for the task description.

**Note**: the legacy fields `context.threadIds/sceneIds/plotIds` may optionally be kept for backward compatibility, but the writer will not use them to read Plot on its own. When Scene / World Context is needed, the writer fetches the fact brief itself with `get_chapter_writer_brief` and `input.chapterId`.

## Profile Presets

`writer` offers visual preset configuration through profile settings. You find it in the "Agent Profile Models" panel on the settings page: the `writer` card shows a "Profile Presets" section.

Current fields:

- `customTopSystemPrompt`: the highest-priority pinned prompt, inserted at the very front of the Writer system prompt. It is the custom rule with the highest precedence; leave it blank and nothing is injected.
- `writingStylePreset`: the default style requirements (written as a rule list), sourced from `agents/writer/styles/` in the current Project Workspace. In Project Config you can select, edit, add, rename and delete any resource other than the active one.
- `writingReferencePreset`: the default style reference sample (prose to imitate), sourced from `agents/writer/references/` in the current Project Workspace, with the same select / edit / add / rename / delete options in Project Config.
- `narrativePerson`: the default narrative person — first, second and third person are supported.
- `paragraphRhythm` / `wordCountControl` / `polishingWorkflow` / `adultStylePrompt`: paragraph rhythm, default word count, polishing workflow and adult style enhancement. All of them are long-term defaults; when this round's message asks for something explicit, the task wins. If `adultStylePrompt` is blank, nothing is injected at all.

These settings are saved in the `agent.profiles.writer.settings` patch in Config. Global Config can only store configuration values such as a selected key or the narrative person — it is not bound to any one Project's resource files. Project Config lets each individual field either "inherit" or "override", and commits resource content changes in the same save. They take effect on the next writer prepare / run, and existing long-lived sessions do not need to be rebuilt.

The first time you open the Project-scope Agent Profile Models panel, or before the current Project's `writer` runs, the system makes sure `agents/writer/` has been initialized. The default resources come from the built-in `writer.home`; the write only fills in missing files and never overwrites a style or reference sample you have already changed. "Reset Home" in Project scope wipes them and regenerates them from the current profile version.

Precedence:

- Style, person or narrative requirements stated explicitly in this round's `invoke_agent.message` win.
- Next come the profile presets in `ctx.settings`.
- Last is the writer profile's built-in defaults.

Do not push default preferences like style or narrative person back into `initial` or `invoke_agent.input`. `initial` is still stable creation-time data, and `input` is still the structured payload for a single task.

## What the Writer Can See

The writer prepare stage injects only:

- The single target file behind `input.path`.
- The derivable `projectPath`, `projectSlug` and optional `chapterPath`.
- The `lorebookEntries` and `readablePaths` suggested reading lists.

The writer does not automatically read Plot, the lorebook or the body of ordinary files. **Whatever Scene / World Context this round needs is fetched by the writer itself through `get_chapter_writer_brief` (keyed by `input.chapterId`), and only the fact view of that brief ever reaches the writer.**

The writer calls tools on its own as needed:

- `read`: reads the target file, a lorebook node's `index.md` / `state.md`, or `readablePaths`.
- `execute_world`: read-only queries against World Engine state (a character's location, HP, relationships and so on).

The first version enforces no hard permission limit at the file tool layer. The writer prompt requires it to write only `input.path` and to read only the material that `message` and `context` point at.

## Preparation Before Writing

Before calling the writer, the leader should have as much of this ready as it can:

- `input.path`: the single target Markdown file. It must be a path relative to the current Project Workspace, for example `manuscript/.../index.md`.
- `input.chapterId`: the id of this chapter's `StoryChapter`; the writer uses it to fetch the fact brief.
- `message`: only the delivery requirement (which file, when the round counts as done). **Not** the plot focus or prohibitions — those are meaning-level content.
- **Scene / World Context**: fetched by the writer with `get_chapter_writer_brief`; what it receives is a fact slice (`suggestedBriefMarkdown`):
  - the time range and the subjects on stage
  - World Engine query hints (autonomous: "query the protagonist's state at era 12345") or expanded state summaries (curated / slice-only)
  - this chapter's parameters (POV, tone) and the suggested reading list
- Worldbuilding references: the lorebook entries or readablePaths worth reading.

Meaning-level content — the chapter's goal and landing point, information control requirements (who knows what), things not to write, scene purpose, promise directives, open decisions — **never enters the writer's pre-writing context**: it lives in the review view (`reviewChecklistMarkdown`) of the same compiled brief and is consumed after the draft.

If the plot state has not been settled yet, run the World Engine advance flow first instead of letting the writer decide for itself how the world changes.

## How the RP Writer Differs

`rp.writer` is used only to render the visible text of an RP Tick. Its profile initial is empty and it consumes nothing but the Writer Brief injected from above. The ordinary `writer` targets finished prose files and takes on neither RP Tick hosting nor world state maintenance.

## Keep Reading

- [Novel Writing Workflow](https://github.com/notnotype/neuro-book/blob/master/packages/neuro-book/assets/reference/agent/novel-writing-workflow.md)
- [Write the First Three Chapters](/en/tutorials/04-first-three-chapters)
- [Leader Collaboration Protocol](https://github.com/notnotype/neuro-book/blob/master/packages/neuro-book/assets/reference/agent/leader-default.md)
