/**
 * 内置 workflow：对照实验专用「写 → 多维评审」（实验专用，不接入普通写作主链）。
 *
 * 为什么需要单独一个 workflow：写作宪法否决权条款第 2 条要求「事前告知 vs 事后校验」能产出
 * 同题对照样本；而意图级内容按宪法第二条/第五条**不得**进入 writer 的动笔前上下文，生产链路
 * `chapter-write-review-revise` 因此只把事实简报交给 writer。实验需要一个受控的反向通道：
 * 把调用方**显式给定**的 writer 提示原样下发，用来构造「事前告知」组。
 *
 * 边界：
 * - 只给实验脚本用（`packages/neuro-book/scripts/smoke/slice-vs-told-contrast.ts`）；
 * - 任何生产写作路径都不得用它给 writer 塞意图——普通章节写作请用 `chapter-write-review-revise`；
 * - 只评审不修订：实验要的是原始样本，修订会把两组样本的差异洗掉。
 *
 * `Type` 由 WorkflowCatalog 求值作用域注入，源码禁止 import。
 */

/** 单维度评审结构化输出：整体评价 + 分级问题清单。 */
const ReviewSchema = Type.Object({
    overall: Type.String({description: "该维度的整体评价，一到三句话。"}),
    issues: Type.Array(Type.Object({
        severity: Type.Union([
            Type.Literal("major"),
            Type.Literal("minor"),
        ], {description: "major=必须修订才能交付的问题；minor=可选优化建议。"}),
        problem: Type.String({description: "具体问题，引用正文证据，不泛泛而谈。"}),
        revision: Type.String({description: "可直接执行的修改建议。"}),
    }, {additionalProperties: false})),
}, {additionalProperties: false});

/**
 * 三个评审维度，与 `chapter-write-review-revise` 保持一致，保证两组样本被同一把尺子量。
 * key 同时用作 chart node/token 后缀；messagePrefix 是 message 的固定可判别开头。
 */
const REVIEW_DIMENSIONS = [
    {
        key: "consistency",
        title: "剧情一致性与信息边界",
        messagePrefix: "你是章节评审（一致性）。",
        systemPrompt: "你只评审章节正文的剧情一致性与信息边界：关键剧情点是否全部覆盖、角色是否知道了他不该知道的信息、是否与写作任务（brief）冲突或有超出任务的自由发挥。只指出有正文证据的问题，不代写全文。完成后必须用 report_result 返回结构化 data。",
    },
    {
        key: "pacing",
        title: "节奏与钩子",
        messagePrefix: "你是章节评审（节奏）。",
        systemPrompt: "你只评审章节正文的节奏与钩子：开头是否有抓力、中段推进是否拖沓或跳脱、章末是否留下有效钩子。只指出有正文证据的问题，不代写全文。完成后必须用 report_result 返回结构化 data。",
    },
    {
        key: "style",
        title: "文风与 AI 味",
        messagePrefix: "你是章节评审（文风）。",
        systemPrompt: "你只评审章节正文的文风与 AI 痕迹：重复句式、标签化情绪描写、翻译腔、总结式收尾等明显 AI 味。只指出有正文证据的问题，不代写全文。完成后必须用 report_result 返回结构化 data。",
    },
];

/** 每次贴给评审的正文截断长度（与生产链路一致）。 */
const BODY_SLICE = 12000;

export default {
    key: "contrast-write-review",
    title: "对照实验写作评审（实验专用）",
    description: "实验专用：把调用方给定的 writer 提示原样下发写正文，再对正文做一致性/节奏/文风三维评审一轮，不做修订。用于写作宪法否决权条款第 2 条的同题对照实验。",
    whenToUse: "只在运行写作质量对照实验（如 scripts/smoke/slice-vs-told-contrast.ts）时使用；普通章节写作必须用 chapter-write-review-revise。",
    argsHint: [
        {name: "chapterPath", label: "章节 index.md 路径（Project Workspace 相对路径，必填）", defaultValue: ""},
        {name: "writerBrief", label: "实验组 writer 提示原文（必填，原样下发；由实验脚本拼接，不来自 brief 编译）", defaultValue: ""},
        {name: "reviewChecklist", label: "评审核对清单（可选；只注入一致性评审，不下发 writer）", defaultValue: ""},
        {name: "lorebookEntries", label: "建议读取的内容节点路径（逗号或换行分隔，可选）", defaultValue: ""},
    ],
    phases: [
        {key: "write", title: "写作正文"},
        {key: "review", title: "多维评审"},
        {key: "finalize", title: "定稿"},
    ],
    run: async (wf, args) => {
        const chapterPath = typeof args?.chapterPath === "string" ? args.chapterPath.trim() : "";
        if (!chapterPath) {
            throw new Error("缺少 chapterPath：请传章节 index.md 的 Project Workspace 相对路径，例如 manuscript/001-volume/001-chapter/index.md");
        }
        // 本 workflow 的 writer 提示必须由调用方显式给定：没有它就没有对照组。
        // 只 trim 首尾空白；正文一字不改（A 组的意图清单要原样送达 writer）。
        const writerBrief = typeof args?.writerBrief === "string" ? args.writerBrief.trim() : "";
        if (!writerBrief) {
            throw new Error("缺少 writerBrief：本 workflow 的 writer 提示必须由调用方显式给定（实验脚本拼接），没有它就没有对照组");
        }
        const reviewChecklist = typeof args?.reviewChecklist === "string" ? args.reviewChecklist.trim() : "";
        const rawEntries = Array.isArray(args?.lorebookEntries)
            ? args.lorebookEntries
            : typeof args?.lorebookEntries === "string"
                ? args.lorebookEntries.split(/[,，\n]/u)
                : [];
        const lorebookEntries = rawEntries
            .filter((entry) => typeof entry === "string")
            .map((entry) => entry.trim())
            .filter((entry, index, all) => entry.length > 0 && all.indexOf(entry) === index);

        // —— write：真实 writer profile 写正文（非 ephemeral，让实验会话可追溯） ——
        wf.progress({phase: "write"});
        const writer = await wf.agents.create("writer", {
            initial: {},
            tags: ["workflow:contrast-write-review", "role:writer"],
            ephemeral: false,
        });
        wf.chart.node("write", "写作正文");
        wf.chart.enter("write", {sessionId: writer.id});
        // 实验通道：message 就是调用方给定的提示（仅去掉首尾空白，不做任何其它加工）。
        // 对照组的意义全在这里——A 组的意图清单必须原样送达 writer。
        const writerInput = {path: chapterPath};
        if (lorebookEntries.length > 0) writerInput.context = {lorebookEntries};
        const writeRun = await writer.invoke({message: writerBrief, input: writerInput});
        if (writeRun.status !== "completed") throw new Error(`writer 未完成章节写作：${writeRun.result.message}`);
        const writeData = writeRun.result.data;
        if (!writeData || typeof writeData !== "object" || Array.isArray(writeData) || typeof writeData.summary !== "string") {
            throw new Error("writer 未按 output contract 返回 summary");
        }
        wf.log(`实验写作完成：${chapterPath}`);

        // —— review：三维并发评审一轮，不修订 ——
        let body;
        try {
            body = await wf.workspace.read(chapterPath);
        } catch (error) {
            throw new Error(`读取章节正文失败：${chapterPath}（${error instanceof Error ? error.message : String(error)}）`);
        }
        if (!body.trim()) {
            throw new Error(`章节正文为空：${chapterPath}，writer 可能没有写入目标文件`);
        }

        wf.progress({phase: "review"});
        const reviews = await wf.map(REVIEW_DIMENSIONS, async (dimension) => {
            const reviewer = await wf.agents.create("adhoc", {
                initial: {
                    name: `章节评审（${dimension.title}）`,
                    systemPrompt: dimension.systemPrompt,
                    outputSchema: ReviewSchema,
                },
                tags: ["workflow:contrast-write-review", `review:${dimension.key}`],
                ephemeral: true,
            });
            const nodeKey = `review-${dimension.key}`;
            wf.chart.node(nodeKey, `评审：${dimension.title}`);
            wf.chart.edge("write", nodeKey, "交稿");
            wf.chart.enter(nodeKey, {token: dimension.key, sessionId: reviewer.id});
            const reviewRun = await reviewer.invoke({
                message: [
                    `${dimension.messagePrefix}评审本章正文，按已声明 schema 汇报。`,
                    "【写作任务】\n本轮为对照实验样本，写作提示由实验脚本给定。",
                    reviewChecklist && dimension.key === "consistency"
                        ? `【信息控制事后核对】\n以下是本章信息边界清单，仅用于事后校验，不是写作任务的一部分：\n${reviewChecklist}\n逐条核对正文：角色是否知道了他不该知道的信息？「必须隐藏」项是否被直接或变相泄露？「可暗示」项是否被明说？只报告有正文证据的越界，无越界则不报告。`
                        : "",
                    `【章节正文】\n${body.slice(0, BODY_SLICE)}`,
                ].filter(Boolean).join("\n\n"),
            });
            if (reviewRun.status !== "completed") {
                throw new Error(`评审（${dimension.title}）未完成：${reviewRun.result.message}`);
            }
            const review = reviewRun.result.data;
            if (!review || typeof review !== "object" || Array.isArray(review)
                || typeof review.overall !== "string" || !Array.isArray(review.issues)) {
                throw new Error(`评审（${dimension.title}）未按 outputSchema 返回 data`);
            }
            for (const issue of review.issues) {
                if (!issue || typeof issue !== "object" || Array.isArray(issue)
                    || (issue.severity !== "major" && issue.severity !== "minor")
                    || typeof issue.problem !== "string" || typeof issue.revision !== "string") {
                    throw new Error(`评审（${dimension.title}）issues 结构不符合 outputSchema`);
                }
            }
            wf.chart.leave(nodeKey, {token: dimension.key});
            wf.chart.node("gate", "评审汇总");
            wf.chart.edge(nodeKey, "gate", "并入");
            return {dimension: dimension.key, overall: review.overall, issues: review.issues};
        }, {concurrency: 3});
        wf.chart.move("write", "gate", {label: "三维评审完成"});

        // —— finalize：不修订，直接收口 ——
        wf.progress({phase: "finalize"});
        wf.chart.node("final", "样本产出");
        wf.chart.move("gate", "final", {label: "实验样本"});
        wf.chart.leave("final");
        wf.log(`对照实验样本完成：${chapterPath}（正文 ${body.length} 字符，三维评审均已完成）`);
        return {
            chapterPath,
            writerBriefLength: writerBrief.length,
            reviewChecklistLength: reviewChecklist.length,
            reviews,
            finalSummary: writeData.summary,
            finalLength: body.length,
        };
    },
};
