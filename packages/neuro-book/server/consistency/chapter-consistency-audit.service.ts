import {parseChapterSettlement} from "nbook/server/agent/profiles/writer-settlement";
import type {StoryPromiseDetailDto} from "nbook/shared/dto/plot.dto";
import type {ProseLintIssue} from "nbook/server/workspace-files/llmlint-check";

export type ConsistencyAuditAvailability = "ok" | "unknown" | "unavailable";

type PortResult<T> =
    | {ok: true; value: T}
    | {ok: false; reason: string};

export type ChapterConsistencyAuditReport = {
    chapterId: string;
    title: string;
    subtitle: string;
    promise: {
        title: string;
        availability: ConsistencyAuditAvailability;
        ok: boolean;
        issues: string[];
    };
    world: {
        title: string;
        availability: ConsistencyAuditAvailability;
        ok: boolean;
        issues: string[];
        pendingItems: string[];
    };
    text: {
        title: string;
        availability: ConsistencyAuditAvailability;
        ok: boolean;
        issues: Array<{line: number; excerpt: string; ruleName: string}>;
        summary: string | null;
    };
    advice: string;
};

export type ChapterConsistencyAuditPorts = {
    getChapter(input: {chapterId: number}): Promise<{id: string; title: string; sortOrder: number}>;
    listPromises(): Promise<StoryPromiseDetailDto[]>;
    readWorldSliceIds(input: {sliceIds: string[]}): Promise<Set<string>>;
    runLint(input: {prosePath: string}): Promise<{issues: ProseLintIssue[]}>;
};

export type ChapterConsistencyAuditInput = {
    chapterId: number;
    settlementText: string;
    prosePath: string;
    finalizedWorldSliceIds: string[];
};

/**
 * T0.7 的确定性、只读审计。结算表是自由文本，无法与 World Patch 做语义等价判断；
 * 因此状态对照只报告结构化 World 写入证据是否可读取，绝不声称自然语言事实已入账或漏记。
 */
export async function auditChapterConsistency(
    ports: ChapterConsistencyAuditPorts,
    input: ChapterConsistencyAuditInput,
): Promise<ChapterConsistencyAuditReport> {
    // 章节是本次审计的主体，找不到章节仍应按原 HTTP 语义失败。
    const chapter = await ports.getChapter({chapterId: input.chapterId});
    const settlement = parseChapterSettlement(input.settlementText);
    const [promiseResult, lintResult] = await Promise.all([
        readPort(() => ports.listPromises(), "承诺账本暂时无法读取，无法核对本章是否有到期承诺。"),
        readPort(() => ports.runLint({prosePath: input.prosePath}), "文字体检暂时无法运行，无法核对正文问题。"),
    ]);

    const promiseIssues = promiseResult.ok
        ? promiseResult.value
            .filter((promise) => (
                promise.status === "open"
                && promise.deadlineChapterId === chapter.id
                && !promise.beats.some((beat) => (
                    beat.kind === "payoff"
                    && beat.state === "factual"
                    && beat.scene.chapterId === chapter.id
                ))
            ))
            .map((promise) => `《${promise.title}》到了该兑现的时候，这章没兑现。`)
        : [promiseResult.reason];
    const world = await buildWorldSection(ports, settlement, input.finalizedWorldSliceIds);
    const highIssues = lintResult.ok
        ? lintResult.value.issues
            .filter((issue) => issue.level === "high")
            .sort((left, right) => left.line - right.line || left.column - right.column)
            .map((issue) => ({
                line: issue.line,
                excerpt: truncateExcerpt(issue.match),
                ruleName: issue.ruleTitle || issue.ruleId,
            }))
        : [];

    const hasPromiseWarning = promiseResult.ok && promiseIssues.length > 0;
    const hasWarning = hasPromiseWarning || highIssues.length > 0 || world.issues.some((issue) => issue.startsWith("结算自述与既有设定冲突："));
    const hasUnavailableItem = !promiseResult.ok || !lintResult.ok || world.availability !== "ok";
    return {
        chapterId: chapter.id,
        title: `第 ${chapter.sortOrder + 1} 章 · 定稿审计`,
        subtitle: "我核对了三样东西：答应读者的、世界该有的、文字本身的。",
        promise: {
            title: "承诺对照",
            availability: promiseResult.ok ? "ok" : "unavailable",
            ok: promiseResult.ok && promiseIssues.length === 0,
            issues: promiseIssues,
        },
        world,
        text: {
            title: "文字体检",
            availability: lintResult.ok ? "ok" : "unavailable",
            ok: lintResult.ok && highIssues.length === 0,
            issues: highIssues,
            summary: !lintResult.ok
                ? lintResult.reason
                : highIssues.length === 0 ? null : `扫出 ${highIssues.length} 处比较扎眼的，都列在下面。`,
        },
        advice: hasWarning
            ? "问题不大，改不改你定：改完再定，或者先定、下次一起收拾。"
            : hasUnavailableItem
                ? "还有无法核对的项，确认后再决定要不要定稿。"
                : "三样都过关。就差你一句话——定，还是再看看？",
    };
}

async function buildWorldSection(
    ports: ChapterConsistencyAuditPorts,
    settlement: ReturnType<typeof parseChapterSettlement>,
    finalizedWorldSliceIds: string[],
): Promise<ChapterConsistencyAuditReport["world"]> {
    if (settlement.kind === "missing") {
        return {
            title: "状态对照",
            availability: "unavailable",
            ok: false,
            issues: ["没有找到本章结算，无法核对世界状态。"],
            pendingItems: [],
        };
    }

    const conflicts = settlement.settlement.conflicts.map((item) => `结算自述与既有设定冲突：${item}`);
    const pendingItems = settlement.settlement.unresolved;
    if (settlement.settlement.newFacts.length === 0) {
        return {
            title: "状态对照",
            availability: "ok",
            ok: conflicts.length === 0,
            issues: conflicts,
            pendingItems,
        };
    }
    if (finalizedWorldSliceIds.length === 0) {
        return {
            title: "状态对照",
            availability: "unknown",
            ok: false,
            issues: [...conflicts, "结算列出了新增事实，但本次没有提供可核对的 World 切面凭据。"],
            pendingItems,
        };
    }

    const result = await readPort(
        () => ports.readWorldSliceIds({sliceIds: finalizedWorldSliceIds}),
        "本次 finalize 的 World 切面凭据暂时无法读取，无法核对结算事实。",
    );
    if (!result.ok) {
        return {
            title: "状态对照",
            availability: "unavailable",
            ok: false,
            issues: [...conflicts, result.reason],
            pendingItems,
        };
    }
    if (result.value.size !== finalizedWorldSliceIds.length) {
        return {
            title: "状态对照",
            availability: "unknown",
            ok: false,
            issues: [...conflicts, "本次 finalize 的部分 World 切面凭据无法读取，无法核对结算事实。"],
            pendingItems,
        };
    }
    return {
        title: "状态对照",
        availability: "unknown",
        ok: false,
        issues: [...conflicts, "已找到本次 World 切面凭据；结算是自由文本，缺少事实到 patch 的结构化映射，无法逐条核对。"],
        pendingItems,
    };
}

async function readPort<T>(read: () => Promise<T>, fallback: string): Promise<PortResult<T>> {
    try {
        return {ok: true, value: await read()};
    } catch (error) {
        return {ok: false, reason: `${fallback}${toDiagnosticReason(error)}`};
    }
}

function toDiagnosticReason(error: unknown): string {
    if (error instanceof Error && error.message.trim().length > 0) {
        return `（原因：${error.message.trim().slice(0, 120)}）`;
    }
    return "（原因未知）";
}

function truncateExcerpt(value: string): string {
    return [...value].slice(0, 20).join("");
}
