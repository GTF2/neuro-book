/**
 * 对照实验:事前告知 vs 事后校验(写作宪法第五条终审实验,否决权条款第 2 条)。
 *
 * 同一章、同一份事实简报,**只改一个变量**——意图清单给不给 writer:
 * - A「事前告知」:writer 提示 = 事实简报 + 评审清单全文(目标与落点 / 信息控制 / 禁写 /
 *   场景目的 / 写作提示 / 线索脉络 / Promise 任务 / 未决决策);评审核对清单为空。
 * - B「事后校验」:writer 提示 = 纯事实简报;信息控制四字段只作 reviewChecklist 注入一致性评审。
 *
 * 两组都经 `contrast-write-review` workflow(实验专用)写正文 + 三维评审一轮,**不修订**——
 * 修订会把两组样本的差异洗掉。产出两份正文与评审问题清单,供人工评定现场感与报告味,
 * 判定词写入 docs/doctrine/ 的实验记录。
 *
 * 为什么不用 `chapter-write-review-revise`:宪法第二条/第五条落地后,生产链路只把事实简报交给
 * writer(`brief` 参数只注入评审),已无法构造「事前告知」组。实验需要一个由调用方**显式给定**
 * writer 提示的受控通道——这是 `contrast-write-review` 存在的唯一理由,它不接入普通写作主链。
 *
 * 前提:
 * - dev server 已启动(bun run dev),Provider apiKey 已配置;
 * - 用户提供一个已经 open 的现成测试项目,脚本不自建、不 open 项目;
 * - 目标章已关联 Scene、World Anchor,且 ChapterBrief 的意图字段与信息控制已填写
 *   (否则 A 组没有可告知的意图、B 组没有核对单,对照失去意义——脚本会给出警告)。
 *
 * 用法(在应用包目录执行):
 *   bun run smoke:contrast -- --project <projectRoot> --chapter-id <storyChapterId> \
 *     --out-dir .contrast
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
/** 真实模型写正文+三维评审一轮实测 13 分钟+;给足 20 分钟。 */
const POLL_TIMEOUT_MS = 20 * 60 * 1_000;

type CliOptions = {
    projectRoot: string;
    chapterId: string;
    outDir: string;
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
    reviewChecklistMarkdown: string;
    chapter: {brief: ChapterBriefFields};
};

type RunOutcome = {
    mode: "told" | "slice-only";
    jobId: string;
    status: AgentJobStatus;
    outputPath: string;
    prose: string;
    reviews: JsonValue;
    writerBriefLength: number;
    reviewChecklistLength: number;
    durationMs: number;
};

await main();

async function main(): Promise<void> {
    const options = parseArgs(process.argv.slice(2));
    await assertDevServerAlive();
    await ensureProjectOpen(options.projectRoot);
    const projectDir = resolveProjectDir(options.projectRoot);

    // 1) 只编译一次事实简报(slice-only:展开状态截面,两组共用,保证只有一个变量),
    //    并取评审清单全文供 A 组拼接「事前告知」提示。
    const brief = await fetchWriterBrief(options, "slice-only");
    if (brief.mode !== "slice-only") {
        throw new Error(`事实简报编译失败:mode=${brief.mode}`);
    }
    const facts = brief.suggestedBriefMarkdown;
    const checklist = brief.reviewChecklistMarkdown;
    const infoControl = compileInfoControlChecklist(brief.chapter.brief);
    if (!checklist.trim()) {
        console.warn("⚠ 评审清单为空:A 组没有可告知的意图,对照会失去意义。请先补齐 ChapterBrief 的意图字段。");
    }
    if (!infoControl) {
        console.warn("⚠ 信息控制四字段全空:B 组没有事后核对单,对照会失去意义。");
    }
    console.log(`事实简报 ${facts.length} 字符;评审清单 ${checklist.length} 字符;信息控制核对单 ${infoControl.length} 字符`);

    // 2) 只改一个变量:意图清单是否随 writer 提示下发。
    const outcomes: RunOutcome[] = [];
    outcomes.push(await runScenario(projectDir, options, {
        mode: "told",
        writerBrief: `${facts}\n\n${checklist}\n`,
        reviewChecklist: "",
        outputName: "told.md",
    }));
    outcomes.push(await runScenario(projectDir, options, {
        mode: "slice-only",
        writerBrief: facts,
        reviewChecklist: infoControl,
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

/** A 组:事实 + 意图清单原文下发 writer;B 组:纯事实,核对单只进一致性评审。 */
async function runScenario(
    projectDir: string,
    options: CliOptions,
    scenario: {mode: "told" | "slice-only"; writerBrief: string; reviewChecklist: string; outputName: string},
): Promise<RunOutcome> {
    const chapterPath = path.posix.join(options.outDir, scenario.outputName);
    const args: Record<string, JsonValue> = {
        chapterPath,
        writerBrief: scenario.writerBrief,
    };
    if (scenario.reviewChecklist) {
        args.reviewChecklist = scenario.reviewChecklist;
    }
    const started = await startWorkflowRun(options.projectRoot, "contrast-write-review", args);
    const startedAt = Date.now();
    const job = await pollJob(started.jobId, options.projectRoot);
    const outputPath = path.join(projectDir, chapterPath);
    const prose = existsSync(outputPath) ? await readFile(outputPath, "utf-8") : "";
    const result = job.result && typeof job.result === "object" ? job.result as {reviews?: JsonValue} : {};
    return {
        mode: scenario.mode,
        jobId: started.jobId,
        status: job.status,
        outputPath: chapterPath,
        prose,
        reviews: result.reviews ?? [],
        writerBriefLength: scenario.writerBrief.length,
        reviewChecklistLength: scenario.reviewChecklist.length,
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
        "> 唯一变量:意图清单是否随 writer 提示下发。A=told(事实 + 意图清单);B=slice-only(纯事实)。",
        "> 人工评定口径:现场感(是否被迫写现场)、报告味(是否保守平滑总结腔)。",
        "> 评审问题清单:两组各自的三维评审结构化输出(B 组的一致性评审带上信息控制核对单)。",
        "",
    ];
    for (const outcome of outcomes) {
        lines.push(
            `## 模式 ${outcome.mode}`,
            "",
            `- 状态:${outcome.status};耗时:${outcome.durationMs / 1000}s;正文:${outcome.outputPath}(${outcome.prose.length} 字符)`,
            `- writer 提示:${outcome.writerBriefLength} 字符;评审核对单:${outcome.reviewChecklistLength} 字符`,
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
            JSON.stringify(outcome.reviews, null, 2),
            "```",
            "",
        );
    }
    return lines.join("\n");
}

// ── HTTP + 轮询 ──

async function fetchWriterBrief(options: CliOptions, mode: "autonomous" | "slice-only"): Promise<WriterBriefResponse> {
    const pathname = `/api/projects/plot/chapter-writer-brief?projectRoot=${encodeURIComponent(options.projectRoot)}&chapterId=${encodeURIComponent(options.chapterId)}&mode=${mode}`;
    // 项目会话可能被 UI 关闭;409 PROJECT_NOT_OPEN 时重新打开后重试一次。
    try {
        return await requestJson(pathname, {method: "GET"}) as WriterBriefResponse;
    } catch (error) {
        if (!isProjectNotOpen(error)) throw error;
        await ensureProjectOpen(options.projectRoot);
        return await requestJson(pathname, {method: "GET"}) as WriterBriefResponse;
    }
}

/** 项目会话被关闭(409 PROJECT_NOT_OPEN)时重新打开;自身失败则原样抛出。 */
async function ensureProjectOpen(projectRoot: string): Promise<void> {
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            await requestJson("/api/projects/open", {method: "POST", body: {projectRoot}});
            console.log(`项目 ${projectRoot} 已重新打开`);
            return;
        } catch (error) {
            if (attempt === 3) throw error;
            await sleep(1_000);
        }
    }
}

function isProjectNotOpen(error: unknown): boolean {
    return error instanceof Error && error.message.includes("PROJECT_NOT_OPEN");
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

async function pollJob(jobId: string, projectRoot: string): Promise<JobDetail> {
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    let reopened = false;
    for (;;) {
        let job: JobDetail;
        try {
            job = await requestJson(`/api/agent/jobs/${encodeURIComponent(jobId)}`, {method: "GET"}) as JobDetail;
        } catch (error) {
            // 长轮询期间项目会话可能掉线:重开一次后继续等 job(写盘 workflow 以 Project 模块运行)。
            if (!isProjectNotOpen(error) || reopened) throw error;
            await ensureProjectOpen(projectRoot);
            reopened = true;
            continue;
        }
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
    };
}

function printUsageAndExit(code: number): never {
    console.log([
        "用法:bun run smoke:contrast -- --project <projectRoot> --chapter-id <storyChapterId> [--out-dir .contrast]",
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
