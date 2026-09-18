import {parseChapterSettlement} from "nbook/server/agent/profiles/writer-settlement";
import type {StoryPromiseDto} from "nbook/shared/dto/plot.dto";
import type {ProseLintIssue} from "nbook/server/workspace-files/llmlint-check";

export type ConsistencyAuditAvailability = "ok" | "unknown" | "unavailable";

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
    listPromises(): Promise<StoryPromiseDto[]>;
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
    const chapter = await ports.getChapter({chapterId: input.chapterId});
    const settlement = parseChapterSettlement(input.settlementText);
    const [promises, lint] = await Promise.all([
        ports.listPromises(),
        ports.runLint({prosePath: input.prosePath}),
    ]);

    const promiseIssues = promises
        .filter((promise) => (
            promise.status === "open"
            && promise.deadlineChapterId === chapter.id
            && !promise.beatStats.factual
        ))
        .map((promise) => `《${promise.title}》到了该兑现的时候，这章没兑现。`);

    const world = await buildWorldSection(ports, settlement, input.finalizedWorldSliceIds);
    const highIssues = lint.issues
        .filter((issue) => issue.level === "high")
        .sort((left, right) => left.line - right.line || left.column - right.column)
        .map((issue) => ({
            line: issue.line,
            excerpt: truncateExcerpt(issue.match),
            ruleName: issue.ruleTitle || issue.ruleId,
        }));

    const hasHardIssue = promiseIssues.length > 0;
    const hasMinorIssue = highIssues.length > 0 || !world.ok;
    return {
        chapterId: chapter.id,
        title: `第 ${chapter.sortOrder + 1} 章 · 定稿审计`,
        subtitle: "我核对了三样东西：答应读者的、世界该有的、文字本身的。",
        promise: {
            title: "承诺对照",
            availability: "ok",
            ok: promiseIssues.length === 0,
            issues: promiseIssues,
        },
        world,
        text: {
            title: "文字体检",
            availability: "ok",
            ok: highIssues.length === 0,
            issues: highIssues,
            summary: highIssues.length === 0 ? null : `扫出 ${highIssues.length} 处比较扎眼的，都列在下面。`,
        },
        advice: hasHardIssue
            ? "这章先别定。把上面的硬伤处理了，我们再来一遍。"
            : hasMinorIssue
                ? "问题不大，改不改你定：改完再定，或者先定、下次一起收拾。"
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
        };
    }
    if (settlement.settlement.newFacts.length === 0) {
        return {title: "状态对照", availability: "ok", ok: true, issues: []};
    }
    if (finalizedWorldSliceIds.length === 0) {
        return {
            title: "状态对照",
            availability: "unknown",
            ok: false,
            issues: ["结算列出了新增事实，但本次没有提供可核对的 World 切面凭据。"],
        };
    }
    const existing = await ports.readWorldSliceIds({sliceIds: finalizedWorldSliceIds});
    if (existing.size !== finalizedWorldSliceIds.length) {
        return {
            title: "状态对照",
            availability: "unknown",
            ok: false,
            issues: ["本次 finalize 的部分 World 切面凭据无法读取，无法核对结算事实。"],
        };
    }
    return {
        title: "状态对照",
        availability: "unknown",
        ok: false,
        issues: ["已找到本次 World 切面凭据；结算是自由文本，缺少事实到 patch 的结构化映射，无法逐条核对。"],
    };
}

function truncateExcerpt(value: string): string {
    return [...value].slice(0, 20).join("");
}
