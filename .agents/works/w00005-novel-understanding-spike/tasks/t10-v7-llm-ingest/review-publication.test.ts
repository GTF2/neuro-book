import {describe, expect, it} from "vitest";
import {createQueryIndex, querySnapshot} from "../t07-v7-schema-gold/index.ts";
import {compileSnapshot} from "./compiler.ts";
import {fixtureBook, fixtureChapter, fixtureSources} from "./fixture.ts";
import {reviewUnits} from "./draft.ts";

function rejected(unit: string) {
    const chapter = fixtureChapter();
    const judgment = chapter.review.judgments.find(item => item.id === unit)!;
    Object.assign(judgment, {verdict: "rejected", note: "原文归属有误，待处理。"});
    return chapter;
}
function visible(dataset: ReturnType<typeof compileSnapshot>) {
    return querySnapshot(createQueryIndex(dataset), {readAt: dataset.snapshot.readAt, perspective: "reader", world: "original"}).nodes.map(node => node.id);
}

describe("publication with bounded semantic uncertainty", () => {
    it.each(["semantic:claim", "semantic:identity", "semantic:event"])("retains rejection and hides the owned record group for %s", unit => {
        const chapter = rejected(unit);
        const dataset = compileSnapshot(fixtureBook, fixtureSources, [chapter]);
        const id = "c01:" + unit.split(":")[1];
        expect(dataset.nodes.find(node => node.id === id)?.readiness).toBe("pending");
        expect(dataset.nodes.find(node => node.id === `argument:${id}`)).toMatchObject({readiness: "pending", data: {review: {verdict: "rejected"}, status: "blocked"}});
        expect(visible(dataset)).not.toContain(id);
        expect(visible(dataset)).not.toContain(`argument:${id}`);
        expect(visible(dataset)).not.toContain(`assessment:${id}:at:1:${id.endsWith("identity") ? 1 : 2}`);
        expect(visible(dataset)).toContain("c01:beat");
        expect(dataset.coverage.gaps.join(" ")).toContain("待处理");
    });

    it("hides dependent facts and names after identity rejection without erasing the entity", () => {
        const dataset = compileSnapshot(fixtureBook, fixtureSources, [rejected("semantic:identity")]);
        expect(visible(dataset)).not.toContain("c01:claim");
        expect(visible(dataset)).toContain("c01:person");
        const projection = querySnapshot(createQueryIndex(dataset), {readAt: dataset.snapshot.readAt, perspective: "reader", world: "original"});
        expect(projection.nodes.find(node => node.id === "c01:person")).toMatchObject({data: {names: []}});
    });

    it("hides referent-owned mentions and does not make a rejected summary fresh", () => {
        const dataset = compileSnapshot(fixtureBook, fixtureSources, [rejected("material:rperson")]);
        expect(dataset.nodes.filter(node => node.kind === "mention").every(node => node.readiness === "pending")).toBe(true);
        expect(visible(compileSnapshot(fixtureBook, fixtureSources, [rejected("semantic:event")]))).not.toContain("c01:summary");
    });

    it("does not resurrect rejected summary text by automatic reuse in later snapshots", () => {
        const first = rejected("semantic:summary"), second = fixtureChapter(2);
        second.integration.identities = [];
        second.integration.summaries = [];
        second.review.judgments = reviewUnits(second.material, second.integration).map(id => ({id, verdict: "passed", note: "通过"}));
        const dataset = compileSnapshot(fixtureBook, fixtureSources, [first, second]);
        expect(dataset.nodes.some(node => node.id.includes("summary-reuse-"))).toBe(false);
        expect(visible(dataset)).not.toContain("c01:summary");
    });

    it("keeps omissions auditable and excludes full-chapter review prose from early graph records", () => {
        const chapter = fixtureChapter();
        chapter.review.missing.push({stage: "integration", note: "关键关系未提取"});
        chapter.review.judgments.forEach(item => {item.note = "章节后文的新名字";});
        const dataset = compileSnapshot(fixtureBook, fixtureSources, [chapter]);
        expect(JSON.stringify(dataset.nodes)).not.toContain("章节后文的新名字");
        expect(dataset.coverage.gaps.join(" ")).toContain("关键关系未提取");
    });

    it("never uses pending to admit structurally invalid material", () => {
        const chapter = rejected("material:rperson");
        chapter.material.referents[0]!.mentions[0]!.text = "虚构原文";
        expect(() => compileSnapshot(fixtureBook, fixtureSources, [chapter])).toThrow(/absent|missing/);
    });
});
