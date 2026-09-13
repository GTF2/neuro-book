/**
 * 对照实验:事前告知模式 vs 事后校验模式(写作宪法第五条终审实验)。
 *
 * 同一章、同一写作任务,跑两遍 chapter-write-review-revise:
 * - A「事前告知」:brief 用 autonomous 模式编译(含信息控制四字段 + 禁写项,写作前置输入);
 * - B「事后校验」:brief 用 slice-only 模式编译(纯事实切片,不含意义指令),
 *   信息控制四字段改传 infoControl 入参,只注入一致性评审做事后核对。
 *
 * 两遍都只写+评审一轮(revise=false),产出两份正文与各自的评审问题清单,
 * 供人工评定现场感与报告味(docs/doctrine/writing-doctrine.md 否决权条款第 2 条)。
 *
 * 前提:
 * - dev server 已启动(bun run dev),Provider apiKey 已配置;
 * - 用户提供一个已经 open 的现成测试项目,脚本不自建、不 open 项目;
 * - 项目里目标章已关联 Scene、World Anchor 与信息控制已填写(autonomous 编译需要)。
 *
 * 用法(在应用包目录执行):
 *   bun run smoke:contrast -- --project <projectRoot> --chapter-id <storyChapterId> \
 *     --out-dir .contrast --review-rounds 1
 *
 * 环境变量:AGENT_HTTP_BASE_URL,默认 http://localhost:3000。
 */

import {existsSync, statSync} from "node:fs";
import {mkdir, readFile, writeFile} from "node:fs/promises";
import path from "node:path";
import type {JsonValue} from "nbook/server/agent/messages/types";
import type {AgentJobStatus} from "nbook/server/agent/jobs/agent-job-manager";
import {resolveStateRoot} from "nbook/server/runtime/installation-paths";
import {projectWorkspaceRef} from "nbook/server/workspace-files/project-identity";

const BASE_URL = process.env.AGENT_HTTP_BASE_URL ?? "http://localhost:3000";
const POLL_INTERVAL_MS = 2_000;
const POLL_TIMEOUT_MS = 10 * 60 * 1_000;

type CliOptions = {
    projectRoot: string;
    chapterId: string;
    outDir: string;
    reviewRounds: string;
};

type ChapterBriefFields = {
    readerKnows: string | null;
    protagonistKnows: string | null;
    mustHide: string | null;
    hintOnly: string | null;
};

type WriterBriefResponse = {
    mode: string;
    suggestedBriefMarkdown: string;
    chapter: {brief: ChapterBriefFields};
};

type RunOutcome = {
    mode: "told" | "slice-only";
    jobId: string;
    status: AgentJobStatus;
    outputPath: string;
    prose: string;
    reviewRounds: JsonValue;
    durationMs: number;
};

await main();

async function main(): Promise<void> {
    const options = parseArgs(process.argv.slice(2));
    await assertDevServerAlive();
    const projectDir = resolveProjectDir(options.projectRoot);

    // 1) 编译两种 brief:told=autonomous(含信息控制),slice=slice-only(纯事实)。
    const toldBrief = await fetchWriterBrief(options, "autonomous");
    const sliceBrief = await fetchWriterBrief(options, "slice-only");
    if (sliceBrief.mode !== "slice-only") {
        throw new Error(`slice-only brief 编译失败:mode=${sliceBrief.mode}`);
    }
    const infoControl = compileInfoControlChecklist(toldBrief.chapter.brief);
    console.log(`brief 编译完成:told(${toldBrief.suggestedBriefMarkdown.length} 字符,含信息控制) slice-only(${sliceBrief.suggestedBriefMarkdown.length} 字符,纯事实)`);
    console.log(`infoControl 核对单:${infoControl ? `${infoControl.length} 字符` : "四字段全空,核对单为空"}`);

    // 2) 两种模式各跑一遍写+评审(revise=false,只留评审问题清单)。
    const outcomes: RunOutcome[] = [];
    outcomes.push(await runScenario(projectDir, options, {
        mode: "told",
        briefMarkdown: toldBrief.suggestedBriefMarkdown,
        infoControl: "",
        outputName: "told.md",
    }));
    outcomes.push(await runScenario(projectDir, options, {
        mode: "slice-only",
        briefMarkdown: sliceBrief.suggestedBriefMarkdown,
        infoControl,
        outputName: "slice-only.md",
    }));

    // 3) 汇总报告:两份正文 + 评审问题,供人工评定。
    const reportPath = path.join(projectDir, options.outDir, "contrast-report.md");
    await mkdir(path.dirname(reportPath), {recursive: true});
    await writeFile(reportPath, renderReport(outcomes), "utf-8");
    console.log(`对照实验完成,报告:${reportPath}`);
    for (const outcome of outcomes) {
        console.log(`- ${outcome.mode}: ${outcome.status},正文 ${outcome.prose.length} 字符,${outcome.durationMs / 1000}s`);
    }
}

/** 事前告知模式:brief 原文(已含信息控制与禁写)。事后校验模式:纯事实切片 + infoControl 只进评审。 */
async function runScenario(
    projectDir: string,
    options: CliOptions,
    scenario: {mode: "told" | "slice-only"; briefMarkdown: string; infoControl: string; outputName: string},
): Promise<RunOutcome> {
    const chapterPath = path.posix.join(options.outDir, scenario.outputName);
    const args: Record<string, JsonValue> = {
        chapterPath,
        brief: scenario.briefMarkdown,
        reviewRounds: options.reviewRounds,
        revise: "false",
    };
    if (scenario.infoControl) {
        args.infoControl = scenario.infoControl;
    }
    const started = await startWorkflowRun(options.projectRoot, "chapter-write-review-revise", args);
    const startedAt = Date.now();
    const job = await pollJob(started.jobId);
    const outputPath = path.join(projectDir, chapterPath);
    const prose = existsSync(outputPath) ? await readFile(outputPath, "utf-8") : "";
    const result = job.result && typeof job.result === "object" ? job.result as {rounds?: JsonValue} : {};
    return {
        mode: scenario.mode,
        jobId: started.jobId,
        status: job.status,
        outputPath: chapterPath,
        prose,
        reviewRounds: result.rounds ?? [],
        durationMs: Date.now() - startedAt,
    };
}

/** 从 ChapterBrief 四字段编译评审核对单文本(事后校验的唯一形态)。 */
function compileInfoControlChecklist(brief: ChapterBriefFields): string {
    return [
        brief.readerKnows ? `读者已知:${brief.readerKnows}` : "",
        brief.protagonistKnows ? `主角已知:${brief.protagonistKnows}` : "",
        brief.mustHide ? `必须隐藏:${brief.mustHide}` : "",
        brief.hintOnly ? `可暗示但不可明说:${brief.hintOnly}` : "",
    ].filter(Boolean).join("\n");
}

function renderReport(outcomes: RunOutcome[]): string {
    const lines: string[] = [
        "# 对照实验报告:事前告知 vs 事后校验(写作宪法第五条)",
        "",
        "> 人工评定口径:现场感(是否被迫写现场)、报告味(是否保守平滑总结腔)。",
        "> 评审问题清单:两种模式各自的 review rounds 结构化输出。",
        "",
    ];
    for (const outcome of outcomes) {
        lines.push(
            `## 模式 ${outcome.mode}`,
            "",
            `- 状态:${outcome.status};耗时:${outcome.durationMs / 1000}s;正文:${outcome.outputPath}(${outcome.prose.length} 字符)`,
            "",
            "### 正文",
            "",
            "```markdown",
            outcome.prose || "(空)",
            "```",
            "",
            "### 评审问题清单",
            "",
            "```json",
            JSON.stringify(outcome.reviewRounds, null, 2),
            "```",
            "",
        );
    }
    return lines.join("\n");
}

// ── HTTP + 轮询 ──

async function fetchWriterBrief(options: CliOptions, mode: "autonomous" | "slice-only"): Promise<WriterBriefResponse> {
    const response = await requestJson(
        `/api/projects/plot/chapter-writer-brief?projectRoot=${encodeURIComponent(options.projectRoot)}&chapterId=${encodeURIComponent(options.chapterId)}&mode=${mode}`,
        {method: "GET"},
    );
    return response as WriterBriefResponse;
}

type StartRunResponse = {jobId: string; runId: string};

async function startWorkflowRun(projectRoot: string, workflowKey: string, args: Record<string, JsonValue>): Promise<StartRunResponse> {
    const response = await requestJson("/api/agent/workflow/runs", {
        method: "POST",
        body: {projectRoot, workflowKey, args},
    });
    const record = expectObject(response as JsonValue, "runs.post 响应");
    if (typeof record.jobId !== "string" || typeof record.runId !== "string") {
        throw new Error(`runs.post 响应缺少 jobId/runId:${JSON.stringify(response)}`);
    }
    return {jobId: record.jobId, runId: record.runId};
}

type JobDetail = {
    jobId: string;
    status: AgentJobStatus;
    error?: string;
    result?: JsonValue;
};

async function pollJob(jobId: string): Promise<JobDetail> {
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    for (;;) {
        const job = await requestJson(`/api/agent/jobs/${encodeURIComponent(jobId)}`, {method: "GET"}) as JobDetail;
        if (job.status === "completed") {
            return job;
        }
        if (job.status === "failed" || job.status === "cancelled") {
            throw new Error(`workflow job ${jobId} 终态 ${job.status}:${job.error ?? ""}`);
        }
        if (Date.now() > deadline) {
            throw new Error(`workflow job ${jobId} 轮询超时(${POLL_TIMEOUT_MS / 1000}s)`);
        }
        await sleep(POLL_INTERVAL_MS);
    }
}

async function requestJson(pathname: string, input: {method: "GET" | "POST"; body?: unknown}): Promise<unknown> {
    const response = await fetch(`${BASE_URL}${pathname}`, {
        method: input.method,
        headers: input.body ? {"content-type": "application/json"} : undefined,
        body: input.body ? JSON.stringify(input.body) : undefined,
    });
    if (!response.ok) {
        throw new Error(`${input.method} ${pathname} 失败:HTTP ${response.status} ${await response.text()}`);
    }
    return response.json();
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── 本地解析 ──

/** dev server 探活(与 writing-workflow.ts 同口径):首个 HTTP 调用失败即报告。 */
async function assertDevServerAlive(): Promise<void> {
    try {
        const response = await fetch(`${BASE_URL}/api/app/version`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
    } catch (error) {
        throw new Error(
            `dev server 探活失败(GET ${BASE_URL}/api/app/version):${error instanceof Error ? error.message : String(error)}。请先 bun run dev 并配置 Provider。`,
        );
    }
}

function resolveProjectDir(projectRoot: string): string {
    const root = resolveStateRoot();
    const workspaceDir = path.join(root, "workspace");
    const directory = path.join(workspaceDir, projectWorkspaceRef(projectRoot).projectRoot);
    if (!existsSync(directory) || !statSync(directory).isDirectory()) {
        throw new Error(`Project Workspace 不存在:${directory}(脚本与 dev server 必须使用同一 State Root)`);
    }
    return directory;
}

function parseArgs(argv: string[]): CliOptions {
    const values = new Map<string, string>();
    for (let index = 0; index < argv.length; index++) {
        const token = argv[index]!;
        if (token === "--help") {
            printUsageAndExit(0);
        }
        if (!token.startsWith("--")) {
            throw new Error(`无法解析的参数:${token}`);
        }
        const key = token.slice(2);
        const value = argv[index + 1];
        if (value === undefined || value.startsWith("--")) {
            throw new Error(`参数 ${token} 缺少值`);
        }
        values.set(key, value);
        index++;
    }
    const projectRoot = values.get("project");
    const chapterId = values.get("chapter-id");
    if (!projectRoot || !chapterId) {
        printUsageAndExit(1);
    }
    return {
        projectRoot,
        chapterId,
        outDir: values.get("out-dir") ?? ".contrast",
        reviewRounds: values.get("review-rounds") ?? "1",
    };
}

function printUsageAndExit(code: number): never {
    console.log([
        "用法:bun run smoke:contrast -- --project <projectRoot> --chapter-id <storyChapterId> [--out-dir .contrast] [--review-rounds 1]",
        "",
        "前提:dev server 已启动(bun run dev),Provider 已配置,项目已 open,目标章已关联 Scene/World Anchor/信息控制。",
    ].join("\n"));
    process.exit(code);
}

function expectObject(value: JsonValue, label: string): Record<string, JsonValue> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error(`${label}不是对象:${JSON.stringify(value)}`);
    }
    return value as Record<string, JsonValue>;
}
