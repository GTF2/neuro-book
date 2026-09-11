import {aggregateAssessment, parseDataset, type MemoryDataset} from "../t07-v7-schema-gold/index.ts";
import {validateReviewCoverage, type AcceptedChapter} from "./draft.ts";

/** Apply review only after the complete candidate has passed structural compilation. */
export function applyPublicationReview(dataset: MemoryDataset, chapters: AcceptedChapter[]): MemoryDataset {
    const byId = new Map(dataset.nodes.map(node => [node.id, node]));
    const gaps: string[] = [];
    for (const chapter of chapters) {
        validateReviewCoverage(chapter.material, chapter.integration, chapter.review);
        const prefix = `c${String(chapter.chapter).padStart(2, "0")}:`;
        for (const judgment of chapter.review.judgments) {
            const id = prefix + judgment.id.slice(judgment.id.indexOf(":") + 1);
            const node = byId.get(id);
            if (!node) throw new Error(`Reviewed unit has no compiled record: ${id}`);
            const rejected = judgment.verdict === "rejected";
            const argument = node.kind === "argument" ? node : byId.get(`argument:${id}`);
            if (argument?.kind === "argument") {
                argument.data.review = {
                    verdict: judgment.verdict, reviewer: "deepseek-flash-independent-review",
                    note: rejected ? "独立复核报告实质问题，保留原判定并待处理；详情见章级审计。" : "逐项独立复核未报告实质问题；这不是正确性保证。",
                };
                if (rejected) argument.data.status = "blocked";
            }
            if (!rejected) continue;
            node.readiness = "pending";
            if (argument) argument.readiness = "pending";
            if (node.kind === "referent") for (const mention of node.data.mentions) byId.get(mention.id)!.readiness = "pending";
            for (const assessment of dataset.nodes) if (assessment.kind === "assessment" && assessment.data.target.id === id) assessment.readiness = "pending";
            gaps.push(`第${chapter.chapter}章 ${judgment.id} 待处理：${judgment.note}`);
        }
        gaps.push(...chapter.review.missing.map(item => `第${chapter.chapter}章 ${item.stage} 漏项：${item.note}`));
    }
    for (const node of dataset.nodes) if (node.kind === "assessment") {
        const arguments_ = node.data.arguments.map(ref => byId.get(ref.id)!).filter(node => node.kind === "argument");
        node.data.epistemic = aggregateAssessment(arguments_.map(node => node.data));
        node.data.note = arguments_.map(node => node.data.review.note).join("；");
    }
    dataset.coverage.gaps.push(...gaps);
    // Summary text was compiled against the candidate. Existing dependency/freshness checks
    // must hide it when review removes its basis; never rewrite that basis to make it visible.
    return parseDataset(dataset);
}
