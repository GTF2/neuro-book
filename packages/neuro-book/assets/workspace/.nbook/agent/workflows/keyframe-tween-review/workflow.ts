/**
 * 内置 workflow:关键帧补间-回撞(写作宪法第三条)。
 *
 * 人只写关键帧——不可逆的状态变化锚点;帧与帧之间的补间由 writer 演化(图生视频:人定帧,模型补间)。
 * 本 workflow 的输入是两帧(或多帧)之间的「声明式事实」,不是因果链:
 * - tween 阶段:writer 只拿到起点帧状态、终点帧声明、世界状态截面,演化帧间正文;
 * - check 阶段:回撞校验员拿正文对终点帧的每条 irreversibleChanges 逐条撞,只报告有正文证据的冲突;
 * - 撞错的帧由 leader/作者裁决(confirmed/overthrown + decisionRefId 留痕),workflow 本身不裁决。
 *
 * `Type` 由 WorkflowCatalog 求值作用域注入,源码禁止 import。
 */

/** 回撞校验结构化输出:逐条撞 irreversibleChanges,只报告有正文证据的冲突。 */
const TweenCheckSchema = Type.Object({
    overall: Type.String({description: "回撞结论,一到三句话。"}),
    violations: Type.Array(Type.Object({
        keyframeName: Type.String({description: "被撞的关键帧 name。"}),
        change: Type.String({description: "被撞的不可逆变化声明原文。"}),
        problem: Type.String({description: "冲突点,引用正文证据,不泛泛而谈。"}),
        suggestion: Type.String({description: "可直接执行的修订建议。"}),
    }, {additionalProperties: false}), {description: "正文与帧声明/世界状态的冲突清单;无冲突返回空数组。"}),
}, {additionalProperties: false});

/** 每次贴给参与方的正文/事实截断长度。 */
const SLICE = 12000;

export default {
    key: "keyframe-tween-review",
    title: "关键帧补间-回撞",
    description: "按写作宪法第三条做关键帧补间:writer 只拿起点帧状态/终点帧声明/世界状态截面演化帧间正文,回撞校验员逐条撞 irreversibleChanges,输出冲突清单供裁决。",
    whenToUse: "两个关键帧之间的正文需要演化且帧声明已确认时使用;因果链设计、剧情讨论(应在拍板前完成)、或章节级常规写作(用 chapter-write-review-revise)时不要使用。",
    argsHint: [
        {name: "fromKeyframe", label: "起点帧声明(含 instant 前的状态事实;事实,不是意义)", defaultValue: ""},
        {name: "toKeyframe", label: "终点帧声明(name/title/instant/irreversibleChanges,逐条列出)", defaultValue: ""},
        {name: "chapterPath", label: "补间正文写入路径(Project Workspace 相对路径,可选;缺省只返回不落盘)", defaultValue: ""},
        {name: "worldFacts", label: "世界状态截面(leader 用 execute_world 预查,事实清单,可选)", defaultValue: ""},
        {name: "betweenKeyframes", label: "区间中间帧声明(逗关键帧逐条;可选)", defaultValue: ""},
        {name: "writingTask", label: "补间写作任务(篇幅/视角/文风要求;不含信息控制类意义指令)", defaultValue: ""},
    ],
    phases: [
        {key: "tween", title: "补间演化"},
        {key: "check", title: "回撞校验"},
        {key: "report", title: "输出裁决清单"},
    ],
    run: async (wf, args) => {
        // —— args 归一化:全部按字符串防御性解析 ——
        const fromKeyframe = typeof args?.fromKeyframe === "string" ? args.fromKeyframe.trim() : "";
        const toKeyframe = typeof args?.toKeyframe === "string" ? args.toKeyframe.trim() : "";
        if (!fromKeyframe || !toKeyframe) {
            throw new Error("缺少关键帧声明:fromKeyframe 与 toKeyframe 必填(leader 先从 Plot API 取帧文本)");
        }
        const chapterPath = typeof args?.chapterPath === "string" ? args.chapterPath.trim() : "";
        const worldFacts = typeof args?.worldFacts === "string" ? args.worldFacts.trim() : "";
        const betweenKeyframes = typeof args?.betweenKeyframes === "string" ? args.betweenKeyframes.trim() : "";
        const writingTask = typeof args?.writingTask === "string" ? args.writingTask.trim() : "";

        // —— tween:writer 演化帧间正文(只给事实切片,不给因果链) ——
        wf.progress({phase: "tween"});
        const writer = await wf.agents.create("writer", {
            initial: {},
            tags: ["workflow:keyframe-tween-review", "role:writer"],
            ephemeral: false,
        });
        wf.chart.node("tween", "补间演化");
        wf.chart.enter("tween", {sessionId: writer.id});

        // writer profile 的默认交付协议是「data 不填，除非调用方明确需要结构化结果」；
        // 调用方必须在消息里显式索要 data.summary，否则真实模型按 profile 只回 result 文本，
        // 下面的严格校验必然失败（2026-09-18 整章尺度 smoke 实测两次复现）。
        const tweenMessage = [
            "请完成关键帧补间写作任务(写作宪法第三条:人定帧,模型补间)。",
            "你拿到的只有起点帧状态、终点帧声明与世界状态截面——全部是此刻的事实,没有因果链,也没有信息控制或禁写指令。",
            "放开写帧与帧之间的现场,让终点帧的不可逆变化自然地发生。",
            fromKeyframe ? `【起点帧状态】\n${fromKeyframe.slice(0, SLICE)}` : "",
            betweenKeyframes ? `【区间中间帧】\n${betweenKeyframes.slice(0, SLICE)}` : "",
            `【终点帧声明】\n${toKeyframe.slice(0, SLICE)}`,
            worldFacts ? `【世界状态截面】\n${worldFacts.slice(0, SLICE)}` : "",
            writingTask ? `【写作任务】\n${writingTask.slice(0, SLICE)}` : "",
            chapterPath
                ? [
                    `补间正文写入 ${chapterPath}。`,
                    "完成后用 report_result 提交:result 按你的默认交付协议(写入路径+润色说明+剧情总结+结算块);",
                    "并在 report_result.data 附 {\"summary\": \"2-3 句补间摘要,说明区间内发生的关键变化\"}——调用方明确需要该结构化字段,不要把正文全文放进 data。",
                ].join("\n")
                : [
                    "补间正文不写入文件。",
                    "完成后用 report_result 提交:report_result.data 必须是 {\"summary\": \"2-3 句补间摘要\", \"text\": \"补间正文全文\"}——调用方明确需要这两个结构化字段。",
                ].join("\n"),
        ].filter(Boolean).join("\n\n");
        const tweenRun = await writer.invoke({
            message: tweenMessage,
            ...(chapterPath ? {input: {path: chapterPath}} : {}),
        });
        if (tweenRun.status !== "completed") throw new Error(`writer 未完成补间演化:${tweenRun.result.message}`);
        const tweenData = tweenRun.result.data;
        if (!tweenData || typeof tweenData !== "object" || Array.isArray(tweenData) || typeof tweenData.summary !== "string") {
            throw new Error("writer 未按 output contract 返回 summary");
        }
        const tweenText = typeof tweenData.text === "string" && tweenData.text.trim()
            ? tweenData.text
            : chapterPath
                ? await wf.workspace.read(chapterPath).catch(() => "")
                : "";
        wf.log(`补间演化完成:${chapterPath || "(未落盘)"}`);
        if (!tweenText.trim()) {
            throw new Error("拿不到补间正文:writer 未返回 text 且目标文件不可读");
        }

        // —— check:回撞校验(逐条撞终点帧的 irreversibleChanges) ——
        // 2026-09-18 真实运行发现:校验员把全部声明合并成一句总评时,会把叙事内部自洽
        // 误判为「与截面一致」,漏报计数级硬矛盾;提示词必须强制逐条作业并以截面为事实基准。
        wf.progress({phase: "check"});
        const checker = await wf.agents.create("adhoc", {
            initial: {
                name: "关键帧回撞校验员",
                systemPrompt: [
                    "你是关键帧回撞校验员,只做事后校验,不事前约束写作。必须逐条作业,不许把多条声明合并成总评:",
                    "1) 把终点帧声明的每一条 irreversibleChanges 单独列为一项;",
                    "2) 对每一项,先在补间正文找兑现证据(引用原文);找不到兑现证据就作为「声明未兑现」上报;",
                    "3) 对每一项已兑现的,把兑现后的事实与世界状态截面逐项对照:直接矛盾、数量/次数对不上、时间线对不上都算冲突;",
                    "4) 世界截面是事实基准:叙事内部圆得自洽不等于无冲突,判定对象是声明与正文对照截面的事实一致性;",
                    "5) 只上报有正文证据的冲突与未兑现,不代写全文,不把写作偏好当冲突。",
                    "完成后必须用 report_result 返回结构化 data。",
                ].join("\n"),
                outputSchema: TweenCheckSchema,
            },
            tags: ["workflow:keyframe-tween-review", "review:tween-check"],
            ephemeral: true,
        });
        wf.chart.node("check", "回撞校验");
        wf.chart.edge("tween", "check", "交稿");
        wf.chart.enter("check", {sessionId: checker.id});
        const checkRun = await checker.invoke({
            message: [
                "回撞校验补间正文,按已声明 schema 汇报。先逐条枚举终点帧声明的每一条 irreversibleChanges,对每一条独立完成「正文兑现证据 → 与世界状态截面对照」两步再汇总;不要合并成一句总评。",
                `【终点帧声明】\n${toKeyframe.slice(0, SLICE)}`,
                worldFacts ? `【世界状态截面】\n${worldFacts.slice(0, SLICE)}` : "",
                `【补间正文】\n${tweenText.slice(0, SLICE)}`,
            ].filter(Boolean).join("\n\n"),
        });
        if (checkRun.status !== "completed") throw new Error(`回撞校验未完成:${checkRun.result.message}`);
        const check = checkRun.result.data;
        if (!check || typeof check !== "object" || Array.isArray(check)
            || typeof check.overall !== "string" || !Array.isArray(check.violations)) {
            throw new Error("回撞校验未按 outputSchema 返回 data");
        }
        for (const violation of check.violations) {
            if (!violation || typeof violation !== "object" || Array.isArray(violation)
                || typeof violation.keyframeName !== "string" || typeof violation.change !== "string"
                || typeof violation.problem !== "string" || typeof violation.suggestion !== "string") {
                throw new Error("回撞校验 violations 结构不符合 outputSchema");
            }
        }
        wf.chart.leave("check");
        wf.chart.move("tween", "check", {label: `冲突 ${check.violations.length} 条`});

        // —— report:输出裁决清单(裁决本身由 leader/作者做,帧状态与决策留痕走 Plot API) ——
        wf.progress({phase: "report"});
        const verdict = check.violations.length === 0 ? "clean" : "violated";
        wf.log(`关键帧回撞完成:${verdict === "clean" ? "无冲突" : `${check.violations.length} 条冲突待裁决`}`);
        return {
            chapterPath: chapterPath || null,
            tweenSummary: tweenData.summary,
            tweenLength: tweenText.length,
            violations: check.violations,
            verdict,
            overall: check.overall,
        };
    },
};
