/**
 * 关键帧整章尺度实验 + 裁决闭环实操(写作宪法第三条,否决权条款第 2 条)。
 *
 * 上一轮实验(keyframe-experiment-2026-09-14)验证了场景内两帧补间可读;本轮验证两件悬置事项:
 * 1. **整章尺度**:同一章时间线上布 4 帧、3 个补间区间,逐区间演化并拼出整章正文,观测跨区间连续性;
 * 2. **裁决闭环**:回撞 verdict=violated 后,两条裁决路各实操一次——
 *    - 路径 A「改正文」:正文没兑现帧声明 → 修订写作任务重跑补间 → clean → 帧 confirmed;
 *    - 路径 B「推翻帧」:帧声明与世界截面矛盾 → 建创作决策记录 → 帧 overthrown + decisionRefId 留痕
 *      → 新修正帧接替 → 重跑补间 → clean。
 *
 * 埋冲突设计(保证裁决演示必然发生,不依赖 writer 偶然犯错):
 * - K3 声明里埋一条与世界截面**硬矛盾**的变化(「郭莹曾把信封放进缝里」vs 截面「两次都没有伸手」)
 *   → 回撞必报 → 走路径 B;
 * - K4 声明里埋一条 writingTask 明确排除的变化(「芥末隔门传话」vs 任务「只写派出所交接」)
 *   → 回撞报「声明未兑现」→ 走路径 A。
 *
 * 素材全部临时(name 前缀 k-scale- / d-scale-),跑完自动 DELETE 还原;补间正文落到
 * Project Workspace 内临时目录 .contrast/keyframe-scale/segment-N.md,finally 随全程删除,
 * manuscript 零污染。模型走 dev server 已配置的 Provider(脚本不碰密钥)。
 *
 * 前提:dev server 已启动(bun run dev),项目已 open(脚本会重开)。
 *
 * 用法(在应用包目录执行):
 *   bun run smoke:keyframe-scale -- --project xin-xiao-shuo
 *   bun run smoke:keyframe-scale -- --project xin-xiao-shuo --cleanup-only   # 只清理残留素材
 *   bun run smoke:keyframe-scale -- --project xin-xiao-shuo --keep           # 保留素材供检查
 *
 * 环境变量:AGENT_HTTP_BASE_URL,默认 http://127.0.0.1:3000(Windows 上 localhost 会解析到 ::1)。
 */

import {existsSync, statSync} from "node:fs";
import {mkdir, readFile, rm, writeFile} from "node:fs/promises";
import path from "node:path";
import type {JsonValue} from "nbook/server/agent/messages/types";
import type {AgentJobStatus} from "nbook/server/agent/jobs/agent-job-manager";
import {resolveStateRoot} from "nbook/server/runtime/installation-paths";
import {projectWorkspaceRef} from "nbook/server/workspace-files/project-identity";

// 与 slice-vs-told-contrast.ts 同口径:必须用 IPv4 回环,localhost 在 Windows 会解析到 ::1。
const BASE_URL = process.env.AGENT_HTTP_BASE_URL ?? "http://127.0.0.1:3000";
const POLL_INTERVAL_MS = 2_000;
/** 真实模型补间+回撞一轮实测 13-20 分钟;给足 30 分钟。 */
const POLL_TIMEOUT_MS = 30 * 60 * 1_000;
/** 补间正文在 Project Workspace 内的临时落盘目录;跑完全程删除。 */
const WORKSPACE_TMP_DIR = ".contrast/keyframe-scale";

/** 全部临时素材的 name 前缀:清理按前缀识别,不误删真实数据。 */
const KEYFRAME_PREFIX = "k-scale-";
const DECISION_NAME = "d-scale-tween-overturn";

type CliOptions = {
    projectRoot: string;
    outDir: string;
    /** 跑完不清理素材(检查用);默认跑完即删。 */
    keep: boolean;
    /** 只清理残留素材后退出,不跑实验。 */
    cleanupOnly: boolean;
};

/** 补间区间的帧声明文本;from/to 都是「声明式事实」,不是因果链(宪法第二/五条)。 */
type Segment = {
    /** 区间标识,用于报告与日志。 */
    label: string;
    /** 起点帧状态文本(世界此刻的事实)。 */
    fromKeyframe: string;
    /** 终点帧声明(name/title/instant/irreversibleChanges 逐条)。 */
    toKeyframe: string;
    /** 补间写作任务(篇幅/视角/文风;不含信息控制类意义指令)。 */
    writingTask: string;
};

type TweenRunOutcome = {
    label: string;
    jobId: string;
    status: AgentJobStatus;
    verdict: "clean" | "violated" | "unknown";
    overall: string;
    violations: Array<{keyframeName?: string; change?: string; problem?: string; suggestion?: string}>;
    tweenSummary: string;
    prose: string;
    durationMs: number;
};

type KeyframeDto = {id: string; name: string; status: string; decisionRefId?: string | null};

async function main(): Promise<void> {
    const options = parseArgs(process.argv.slice(2));
    await assertDevServerAlive();
    await ensureProjectOpen(options.projectRoot);
    const projectDir = resolveProjectDir(options.projectRoot);
    const outDir = path.join(projectDir, options.outDir);
    await mkdir(outDir, {recursive: true});

    if (options.cleanupOnly) {
        const removed = await cleanupFixtures(options.projectRoot);
        console.log(`清理完成:删除 ${removed.keyframes} 帧 / ${removed.decisions} 决策。`);
        return;
    }

    const operations: string[] = [];
    // plot 路由的 projectRoot 必须走 query(CRUD 一律携带,与前端 plot-keyframe-api 同口径)。
    const plotPath = (pathname: string) => `${pathname}?projectRoot=${encodeURIComponent(options.projectRoot)}`;
    try {
        // ── 1) 造素材:决策记录 + 4 帧 ──
        const decision = await requestJson(plotPath("/api/projects/plot/decisions"), {
            method: "POST",
            body: {
                name: DECISION_NAME,
                title: "推翻 k-scale-3:帧声明与世界截面矛盾(实验)",
                question: "补间正文与终点帧 k-scale-3 的声明冲突——声明要求「郭莹曾把信封放进缝里」,与世界截面「两次都只观察没有伸手」矛盾;裁决帧错还是正文错?",
                options: [{option: "推翻帧,以修正帧重跑补间", note: "帧声明与世界状态截面硬矛盾,改正文无法两全"}],
                note: "整章尺度实验的临时裁决留痕;实验结束删除。",
            },
        }) as KeyframeDto;
        operations.push(`POST decisions → ${decision.name}(id=${decision.id})`);
        console.log(`决策记录已建:${decision.name}(id=${decision.id})`);

        const created = new Map<string, KeyframeDto>();
        for (const frame of FRAME_DEFINITIONS) {
            const dto = await requestJson(plotPath("/api/projects/plot/keyframes"), {
                method: "POST",
                body: {
                    name: frame.name,
                    title: frame.title,
                    instant: frame.instant,
                    irreversibleChanges: frame.irreversibleChanges,
                    source: "author",
                    note: frame.note ?? null,
                },
            }) as KeyframeDto;
            created.set(frame.name, dto);
            operations.push(`POST keyframes → ${frame.name}(id=${dto.id}, instant=${frame.instant})`);
            console.log(`帧已建:${frame.name}(id=${dto.id})`);
        }

        // ── 2) 区间1:clean 预期 → 正向流转 confirmed ──
        const seg1 = await runTweenWithRetry(options.projectRoot, projectDir, SEGMENT_1, 1);
        operations.push(`RUN ${SEGMENT_1.label} → ${seg1.verdict}(${seg1.durationMs / 1000}s)`);
        await settleConfirmed(options.projectRoot, ["k-scale-1", "k-scale-2"], created, operations);

        // ── 3) 区间2:K3 埋矛盾 → violated → 裁决 B「推翻帧」→ 修正帧接替重跑 ──
        const seg2First = await runTweenWithRetry(options.projectRoot, projectDir, SEGMENT_2, 2);
        operations.push(`RUN ${SEGMENT_2.label}(埋矛盾)→ ${seg2First.verdict}(${seg2First.durationMs / 1000}s)`);
        if (seg2First.verdict !== "violated") {
            throw new Error(`区间2 预期 violated 实得 ${seg2First.verdict}:埋冲突失效,实验设计需要复核`);
        }
        // 裁决 B:建决策已备 → k3 置 overthrown + decisionRefId 留痕(宪法第六条:推翻必须留痕)
        const k3 = created.get("k-scale-3")!;
        const overthrown = await requestJson(plotPath(`/api/projects/plot/keyframes/${k3.id}`), {
            method: "PATCH",
            body: {status: "overthrown", decisionRefId: decision.id},
        }) as KeyframeDto;
        operations.push(`PATCH keyframes/${k3.id} → status=${overthrown.status}, decisionRefId=${overthrown.decisionRefId ?? decision.id}`);
        console.log(`k-scale-3 已推翻并留痕(decisionRefId=${decision.id})`);
        // 修正帧接替:去掉矛盾条后重跑区间2
        const k3v2 = await requestJson(plotPath("/api/projects/plot/keyframes"), {
            method: "POST",
            body: {
                name: "k-scale-3-rev",
                title: "名单易主(修正帧)",
                instant: "63172954800",
                irreversibleChanges: [
                    "郭莹拿到了缝里的名单原件——但那是芥末安排人放的假名单",
                    "郭莹与芥末在十米内共处过,郭莹认不出对方,芥末确认了这一点",
                    "这条缝从此不能再用了",
                ],
                source: "author",
                note: "实验用修正帧:替代被推翻的 k-scale-3(去掉与世界截面矛盾的条目)。",
            },
        }) as KeyframeDto;
        created.set("k-scale-3-rev", k3v2);
        operations.push(`POST keyframes → k-scale-3-rev(id=${k3v2.id})`);
        const seg2Retry = await runTweenWithRetry(options.projectRoot, projectDir, SEGMENT_2_RETRY, 3);
        operations.push(`RUN ${SEGMENT_2_RETRY.label}(修正帧重跑)→ ${seg2Retry.verdict}(${seg2Retry.durationMs / 1000}s)`);
        await settleConfirmed(options.projectRoot, ["k-scale-3-rev"], created, operations);

        // ── 4) 区间3:K4 埋「任务排除的变化」→ violated → 裁决 A「改正文」→ 修订任务重跑 ──
        const seg3First = await runTweenWithRetry(options.projectRoot, projectDir, SEGMENT_3, 4);
        operations.push(`RUN ${SEGMENT_3.label}(埋未兑现)→ ${seg3First.verdict}(${seg3First.durationMs / 1000}s)`);
        if (seg3First.verdict !== "violated") {
            throw new Error(`区间3 预期 violated 实得 ${seg3First.verdict}:埋冲突失效,实验设计需要复核`);
        }
        // 裁决 A:正文没兑现帧声明 → 修订写作任务重跑(改正文),帧不动
        const seg3Retry = await runTweenWithRetry(options.projectRoot, projectDir, SEGMENT_3_RETRY, 5);
        operations.push(`RUN ${SEGMENT_3_RETRY.label}(修订任务重跑)→ ${seg3Retry.verdict}(${seg3Retry.durationMs / 1000}s)`);
        if (seg3Retry.verdict !== "clean") {
            throw new Error(`区间3 修正重跑预期 clean 实得 ${seg3Retry.verdict}`);
        }
        await settleConfirmed(options.projectRoot, ["k-scale-4"], created, operations);

        // ── 5) 报告 ──
        const reportPath = path.join(outDir, "keyframe-scale-report.md");
        await writeFile(reportPath, renderReport({operations, seg1, seg2First, seg2Retry, seg3First, seg3Retry}), "utf-8");
        console.log(`实验完成,报告:${reportPath}`);
        for (const seg of [seg1, seg2First, seg2Retry, seg3First, seg3Retry]) {
            console.log(`- ${seg.label}: ${seg.verdict},正文 ${seg.prose.length} 字符,${seg.durationMs / 1000}s`);
        }
    } finally {
        if (!options.keep) {
            const removed = await cleanupFixtures(options.projectRoot);
            operations.push(`CLEANUP → 删除 ${removed.keyframes} 帧 / ${removed.decisions} 决策`);
            console.log(`素材已清理:${removed.keyframes} 帧 / ${removed.decisions} 决策。`);
        } else {
            console.log("--keep:素材保留,请手动清理(再次运行 --cleanup-only)。");
        }
        // 补间正文是临时落盘,无论成败都从 Project Workspace 删除。
        await rm(path.join(projectDir, WORKSPACE_TMP_DIR), {recursive: true, force: true}).catch(() => undefined);
        const opsPath = path.join(outDir, "keyframe-scale-operations.log");
        await writeFile(opsPath, operations.join("\n") + "\n", "utf-8");
    }
}

// ── 帧声明与区间定义(事实,不是意义;世界事实复用 2026-09-14 实验已验证的截面) ──

const WORLD_FACTS = [
    "地点:江海老堤,堤下护坡齐腰高处有一道两指宽的缝,顺得进一只信封。",
    "郭莹:蒲江公安局副局长之女,20 岁,常年背相机,习惯用拍照掩护观察。",
    "芥末(郭紫莉):郭莹的妹妹,自幼被郭家收养后与家里断了往来;她认得郭莹,郭莹不认得她。",
    "这条缝此前被用过两回,郭莹两次都从头看到尾,没有伸手。",
    "时间:2002-11-15,台风刚擦过海岸,风未收。",
].join("\n");

const FRAME_DEFINITIONS = [
    {
        name: "k-scale-1",
        title: "亲自出手(出发)",
        instant: "63172922000",
        irreversibleChanges: ["郭莹决定今天不再只观察,由她自己当取货的人"],
        note: "整章尺度实验临时素材。",
    },
    {
        name: "k-scale-2",
        title: "守堤第三晨",
        instant: "63172942200",
        irreversibleChanges: [
            "郭莹已向父亲立下军令状:今天拿不到缝里的东西就停职",
            "芥末此刻在堤下十米处,郭莹完全不知道",
        ],
        note: "整章尺度实验临时素材。",
    },
    {
        name: "k-scale-3",
        title: "名单易主(含埋矛盾条)",
        instant: "63172954800",
        irreversibleChanges: [
            "郭莹拿到了缝里的名单原件——但那是芥末安排人放的假名单",
            "郭莹与芥末在十米内共处过,郭莹认不出对方,芥末确认了这一点",
            "这条缝从此不能再用了",
            "郭莹此前曾把一只信封放进缝里(埋矛盾条:与截面「两次都没有伸手」矛盾)",
        ],
        note: "整章尺度实验临时素材;含故意埋入的矛盾声明,供裁决路径 B(推翻帧)演示。",
    },
    {
        name: "k-scale-4",
        title: "名单归案(含埋未兑现条)",
        instant: "63173040000",
        irreversibleChanges: [
            "名单原件已交到父亲手里,假名单将进入官方渠道",
            "芥末以送蛤蜊的名义短暂出现在郭家门口,隔着门与郭莹说了今天唯一的一句话",
        ],
        note: "整章尺度实验临时素材;含一条被写作任务排除的变化,供裁决路径 A(改正文)演示。",
    },
] as const;

const SEGMENT_1: Segment = {
    label: "区间1 K1→K2",
    fromKeyframe: [
        "【起点帧状态 k-scale-1(06:30)】",
        "台风夜刚过,郭莹在江海城租屋里把三天的守堤记录整理进相机包。",
        "她已决定:今天缝要是再开口,不再只拍照,由她自己当取货的人。",
        "父亲还不知道她的决定;军令状(拿不到就停职)昨晚已在电话里立下。",
    ].join("\n"),
    toKeyframe: [
        "【终点帧声明 k-scale-2(07:30)】name=k-scale-2",
        "- 郭莹已向父亲立下军令状:今天拿不到缝里的东西就停职",
        "- 芥末此刻在堤下十米处,郭莹完全不知道",
    ].join("\n"),
    writingTask: "篇幅 1500-2200 字;第三人称限制视角(郭莹);写实、克制的犯罪剧情文风;从租屋出发写到守上堤为止,把「决定亲自出手」落成动作与细节;不写结局式总结,不预写后续剧情。",
};

const SEGMENT_2: Segment = {
    label: "区间2 K2→K3",
    fromKeyframe: [
        "【起点帧状态 k-scale-2(07:30)】",
        "郭莹在江海老堤守第三个早晨;她已向父亲立下军令状,今天拿不到缝里的东西就停职。",
        "芥末此刻在堤下十米处,郭莹完全不知道。",
        "这条缝此前被用过两回,郭莹两次都只拍照记录,没有伸手。",
    ].join("\n"),
    toKeyframe: [
        "【终点帧声明 k-scale-3(11:00)】name=k-scale-3",
        "- 郭莹拿到了缝里的名单原件——但那是芥末安排人放的假名单",
        "- 郭莹与芥末在十米内共处过,郭莹认不出对方,芥末确认了这一点",
        "- 这条缝从此不能再用了",
        "- 郭莹此前曾把一只信封放进缝里",
    ].join("\n"),
    writingTask: "篇幅 2000-3000 字;双线(郭莹守堤 / 取货人动作)推进;写实、克制的犯罪剧情文风;从守堤写到名单易主为止;不写结局式总结。",
};

/** 修正帧接替后的区间2:K3 换成 k-scale-3-rev(去掉矛盾条),其余同 SEGMENT_2。 */
const SEGMENT_2_RETRY: Segment = {
    label: "区间2重跑 K2→K3-rev",
    fromKeyframe: SEGMENT_2.fromKeyframe,
    toKeyframe: [
        "【终点帧声明 k-scale-3-rev(11:00)】name=k-scale-3-rev",
        "- 郭莹拿到了缝里的名单原件——但那是芥末安排人放的假名单",
        "- 郭莹与芥末在十米内共处过,郭莹认不出对方,芥末确认了这一点",
        "- 这条缝从此不能再用了",
    ].join("\n"),
    writingTask: SEGMENT_2.writingTask,
};

const SEGMENT_3: Segment = {
    label: "区间3 K3-rev→K4",
    fromKeyframe: [
        "【起点帧状态 k-scale-3-rev(11:00)】",
        "名单原件已到郭莹手里(假名单,她不知道),收进物证袋贴身收藏。",
        "她给父亲报了平安,正沿公路往城里走;那条缝已经作废。",
        "芥末已确认姐姐取走了她安排的假名单,此刻提着蛤蜊往北头坡道去。",
    ].join("\n"),
    toKeyframe: [
        "【终点帧声明 k-scale-4(14:00)】name=k-scale-4",
        "- 名单原件已交到父亲手里,假名单将进入官方渠道",
        "- 芥末以送蛤蜊的名义短暂出现在郭家门口,隔着门与郭莹说了今天唯一的一句话",
    ].join("\n"),
    // 埋「任务排除的变化」:任务明确不写家门口,回撞应报第二条声明未兑现 → 裁决路径 A。
    writingTask: "篇幅 2000-3000 字;全程只写郭莹在蒲江公安局里与父亲交接名单的戏;不写郭家门口的任何场景,不写芥末出场;写实、克制的犯罪剧情文风;不写结局式总结。",
};

/** 裁决路径 A 的修正任务:解除视角限制,并按回撞建议把缺的变化补写进正文。 */
const SEGMENT_3_RETRY: Segment = {
    label: "区间3重跑 K3-rev→K4(修订任务)",
    fromKeyframe: SEGMENT_3.fromKeyframe,
    toKeyframe: SEGMENT_3.toKeyframe,
    writingTask: [
        "篇幅 2200-3200 字;两场戏:先写郭莹在蒲江公安局与父亲交接名单(细节、克制、不写破案结论);",
        "再补一段郭家门口的短戏——芥末以送蛤蜊的名义短暂出现,隔着门与郭莹说了今天唯一的一句话,",
        "郭莹不知道她是谁,芥末知道。写实、克制的犯罪剧情文风;不写结局式总结。",
    ].join("\n"),
};

// ── 补间执行 ──

/**
 * 带重试的补间:writer 未满足 output contract(如未返回 data.summary)时,
 * 自动重跑同一区间,最多 2 次;两次都失败才向上抛。
 */
async function runTweenWithRetry(projectRoot: string, projectDir: string, segment: Segment, segIndex: number): Promise<TweenRunOutcome> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            return await runTween(projectRoot, projectDir, segment, segIndex);
        } catch (error) {
            lastError = error;
            console.warn(`区间「${segment.label}」第 ${attempt} 次失败:${error instanceof Error ? error.message : String(error)}${attempt < 2 ? ",重试" : ""}`);
        }
    }
    throw lastError;
}

async function runTween(projectRoot: string, projectDir: string, segment: Segment, segIndex: number): Promise<TweenRunOutcome> {
    // 正文落到 Project Workspace 内的临时目录:writer 用 input.path 写文件,workflow 从文件读正文,
    // 不依赖 report_result 携带全文(实测 writer 在无落盘路径时可能只回 summary,正文丢失)。
    const chapterPath = `${WORKSPACE_TMP_DIR}/segment-${segIndex}.md`;
    const args: Record<string, JsonValue> = {
        fromKeyframe: segment.fromKeyframe,
        toKeyframe: segment.toKeyframe,
        worldFacts: WORLD_FACTS,
        writingTask: segment.writingTask,
        chapterPath,
    };
    const startedAt = Date.now();
    const started = await startWorkflowRun(projectRoot, "keyframe-tween-review", args);
    const job = await pollJob(started.jobId, projectRoot);
    // jobs API 的 result 是 {runId, workflowKey, status, result: <workflow 返回值>, sessions, usage} 包装层；
    // workflow 返回值在 result.result，兼容扁平旧形状防止包装层再变（2026-09-18 实测确认嵌套形状）。
    const wrapper = (job.result && typeof job.result === "object" && !Array.isArray(job.result) ? job.result : {}) as {result?: unknown};
    const inner = wrapper.result !== undefined && typeof wrapper.result === "object" && !Array.isArray(wrapper.result)
        ? wrapper.result
        : wrapper;
    const result = inner as {
        verdict?: string;
        overall?: string;
        violations?: Array<{keyframeName?: string; change?: string; problem?: string; suggestion?: string}>;
        tweenSummary?: string;
        tweenLength?: number;
    };
    const verdict = result.verdict === "clean" || result.verdict === "violated" ? result.verdict : "unknown";
    const prose = await readFile(path.join(projectDir, chapterPath), "utf-8").catch(() => "");
    return {
        label: segment.label,
        jobId: started.jobId,
        status: job.status,
        verdict,
        overall: result.overall ?? "",
        violations: Array.isArray(result.violations) ? result.violations : [],
        tweenSummary: typeof result.tweenSummary === "string" ? result.tweenSummary : "",
        prose,
        durationMs: Date.now() - startedAt,
    };
}

/** 正向流转演示:把兑现成功的帧 PATCH 成 confirmed(裁决=维持帧)。 */
async function settleConfirmed(
    projectRoot: string,
    names: string[],
    created: Map<string, KeyframeDto>,
    operations: string[],
): Promise<void> {
    for (const name of names) {
        const dto = created.get(name);
        if (!dto) throw new Error(`内部错误:找不到已建帧 ${name}`);
        const patched = await requestJson(`/api/projects/plot/keyframes/${dto.id}?projectRoot=${encodeURIComponent(projectRoot)}`, {
            method: "PATCH",
            body: {status: "confirmed"},
        }) as KeyframeDto;
        operations.push(`PATCH keyframes/${dto.id}(${name}) → status=${patched.status}`);
    }
}

/** 按前缀清理实验素材:先删帧再删决策;返回删除数量。 */
async function cleanupFixtures(projectRoot: string): Promise<{keyframes: number; decisions: number}> {
    let keyframeCount = 0;
    let decisionCount = 0;
    const keyframes = await requestJson(`/api/projects/plot/keyframes?projectRoot=${encodeURIComponent(projectRoot)}`, {method: "GET"}) as KeyframeDto[];
    for (const keyframe of Array.isArray(keyframes) ? keyframes : []) {
        if (!keyframe.name?.startsWith(KEYFRAME_PREFIX)) continue;
        try {
            await requestJson(`/api/projects/plot/keyframes/${keyframe.id}?projectRoot=${encodeURIComponent(projectRoot)}`, {method: "DELETE"});
            keyframeCount++;
        } catch (error) {
            console.warn(`删除帧 ${keyframe.name} 失败:${error instanceof Error ? error.message : String(error)}`);
        }
    }
    const decisions = await requestJson(`/api/projects/plot/decisions?projectRoot=${encodeURIComponent(projectRoot)}`, {method: "GET"}) as Array<{id: string; name?: string}>;
    for (const decision of Array.isArray(decisions) ? decisions : []) {
        if (decision.name !== DECISION_NAME) continue;
        try {
            await requestJson(`/api/projects/plot/decisions/${decision.id}?projectRoot=${encodeURIComponent(projectRoot)}`, {method: "DELETE"});
            decisionCount++;
        } catch (error) {
            console.warn(`删除决策 ${decision.id} 失败:${error instanceof Error ? error.message : String(error)}`);
        }
    }
    return {keyframes: keyframeCount, decisions: decisionCount};
}

function renderReport(context: {
    operations: string[];
    seg1: TweenRunOutcome;
    seg2First: TweenRunOutcome;
    seg2Retry: TweenRunOutcome;
    seg3First: TweenRunOutcome;
    seg3Retry: TweenRunOutcome;
}): string {
    const {operations, seg1, seg2First, seg2Retry, seg3First, seg3Retry} = context;
    const lines: string[] = [
        "# 关键帧整章尺度实验 + 裁决闭环实操(2026-09-16)",
        "",
        "> 目的:①帧驱动在整章尺度(4 帧 / 3 区间)的表现;②裁决闭环两路实操(改正文 / 推翻帧 + decisionRefId)。",
        "> 全部素材临时(前缀 k-scale- / d-scale-),实验结束已删除;正文不落盘,manuscript 零污染。",
        "",
        "## 裁决操作流水",
        "",
        "```",
        ...operations,
        "```",
        "",
    ];
    for (const seg of [seg1, seg2First, seg2Retry, seg3First, seg3Retry]) {
        lines.push(
            `## ${seg.label}`,
            "",
            `- verdict:**${seg.verdict}**;耗时:${seg.durationMs / 1000}s;job:${seg.jobId}`,
            `- summary:${seg.tweenSummary || "(无)"}`,
            "",
            "### 回撞结论",
            "",
            seg.overall || "(无)",
            "",
            "### 冲突清单",
            "",
            "```json",
            JSON.stringify(seg.violations, null, 2),
            "```",
            "",
            "### 补间正文",
            "",
            "```markdown",
            seg.prose || "(空)",
            "```",
            "",
        );
    }
    return lines.join("\n");
}

// ── HTTP + 轮询(与 slice-vs-told-contrast.ts 同骨架,扩展 PATCH/DELETE) ──

async function ensureProjectOpen(projectRoot: string): Promise<void> {
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            await requestJson("/api/projects/open", {method: "POST", body: {projectRoot}});
            console.log(`项目 ${projectRoot} 已打开`);
            return;
        } catch (error) {
            if (attempt === 3) throw error;
            await sleep(1_000);
        }
    }
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
            const response = await requestJson(`/api/agent/jobs/${encodeURIComponent(jobId)}`, {method: "GET"});
            // jobs API 响应带 {"job": {...}} 包装层;兼容两种形状。
            const wrapped = response as {job?: JobDetail};
            job = (wrapped.job && typeof wrapped.job === "object" ? wrapped.job : response) as JobDetail;
        } catch (error) {
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

function isProjectNotOpen(error: unknown): boolean {
    return error instanceof Error && error.message.includes("PROJECT_NOT_OPEN");
}

async function requestJson(pathname: string, input: {method: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown}): Promise<unknown> {
    const response = await fetch(`${BASE_URL}${pathname}`, {
        method: input.method,
        headers: input.body ? {"content-type": "application/json"} : undefined,
        body: input.body ? JSON.stringify(input.body) : undefined,
    });
    if (!response.ok) {
        throw new Error(`${input.method} ${pathname} 失败:HTTP ${response.status} ${await response.text()}`);
    }
    // 204/空 body(DELETE 成功):无 JSON 可解析。
    const text = await response.text();
    return text.trim() ? JSON.parse(text) : null;
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

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
    // 简单解析:成对取值 + 布尔开关。
    const values = new Map<string, string>();
    const flags = new Set<string>();
    for (let index = 0; index < argv.length; index++) {
        const token = argv[index]!;
        if (token === "--keep" || token === "--cleanup-only") {
            flags.add(token);
            continue;
        }
        if (token === "--help") {
            printUsageAndExit(0);
        }
        if (!token.startsWith("--")) {
            throw new Error(`无法解析的参数:${token}`);
        }
        const value = argv[index + 1];
        if (value === undefined || value.startsWith("--")) {
            throw new Error(`参数 ${token} 缺少值`);
        }
        values.set(token.slice(2), value);
        index++;
    }
    const project = values.get("project");
    if (!project) {
        printUsageAndExit(1);
    }
    return {
        projectRoot: project!,
        outDir: values.get("out-dir") ?? ".contrast",
        keep: flags.has("--keep"),
        cleanupOnly: flags.has("--cleanup-only"),
    };
}

function printUsageAndExit(code: number): never {
    console.log([
        "用法:bun run smoke:keyframe-scale -- --project <projectRoot> [--out-dir .contrast] [--keep] [--cleanup-only]",
        "",
        "前提:dev server 已启动(bun run dev),Provider 已配置。素材自动清理;--keep 保留;--cleanup-only 只清理。",
    ].join("\n"));
    process.exit(code);
}

function expectObject(value: JsonValue, label: string): Record<string, JsonValue> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error(`${label}不是对象:${JSON.stringify(value)}`);
    }
    return value as Record<string, JsonValue>;
}

// 帧定义与区间常量声明在 main 之后,入口调用必须放在模块末尾(const TDZ)。
await main();
