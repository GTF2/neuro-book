import {describe, expect, it} from "vitest";
import {
    acceptBlock,
    applyReviewToBody,
    detectHalfApplied,
    deserializeReviewState,
    rejectBlock,
    revokeAccepted,
    serializeReviewState,
    voidGroup,
    type ReviewGroup,
} from "nbook/app/components/novel-ide/review/review-blocks";

/** 合成审稿组：3 块提案（契约基线 1 的 ReviewBlock 结构）。 */
function groupFixture(): ReviewGroup {
    return {
        groupId: "grp-1",
        chapterPath: "manuscript/001-volume/ch-003.md",
        baseRevision: 7,
        blocks: [
            {blockId: "blk-1", sourceId: "grp-1", old: "夜色像一张网。", new: "夜色像一张浸了水的网。", status: "pending", impactIds: []},
            {blockId: "blk-2", sourceId: "grp-1", old: "他推门进来。", new: "他撞开虚掩的门，带进一身寒气。", status: "pending", impactIds: ["impact-9"]},
            {blockId: "blk-3", sourceId: "grp-1", old: "", new: "（新增段）铜镜在枕边发烫。", status: "pending", impactIds: []},
        ],
        createdAt: 1_700_000_000_000,
    };
}

const BODY = "第一章\n\n夜色像一张网。\n\n他推门进来。\n\n他没开灯。";

describe("review-blocks 状态机契约（任务033 阶段A，P0-02）", () => {
    it("基线2 pending→accepted：触发正文写入意图，状态落 accepted", () => {
        const {group, writeIntent} = acceptBlock(groupFixture(), "blk-1", BODY);
        expect(group.blocks.find((b) => b.blockId === "blk-1")?.status).toBe("accepted");
        expect(writeIntent.path).toBe("manuscript/001-volume/ch-003.md");
        expect(writeIntent.content).toContain("夜色像一张浸了水的网。");
        expect(writeIntent.content).not.toContain("夜色像一张网。\n");
    });

    it("基线2 pending→rejected：状态落 rejected，组仍保留（转引用气泡由 G1 侧承接）", () => {
        const group = rejectBlock(groupFixture(), "blk-2");
        expect(group.blocks.find((b) => b.blockId === "blk-2")?.status).toBe("rejected");
        expect(group.blocks).toHaveLength(3);
    });

    it("基线2 终态不可迁移：accepted/rejected/void 块再迁移必须抛错", () => {
        let group = acceptBlock(groupFixture(), "blk-1", BODY).group;
        group = rejectBlock(group, "blk-2");
        expect(() => acceptBlock(group, "blk-1", BODY)).toThrow();
        expect(() => rejectBlock(group, "blk-1")).toThrow();
        expect(() => acceptBlock(group, "blk-2", BODY)).toThrow();
    });

    it("基线2 整件拒绝：全组 void 不可复活，未决块清零", () => {
        const group = voidGroup(groupFixture());
        expect(group.blocks.every((b) => b.status === "void")).toBe(true);
        expect(() => acceptBlock(group, "blk-1", BODY)).toThrow();
        // 裁定 c：void 组的 ID 与决议记录不物理删除
        expect(group.blocks.map((b) => b.blockId)).toEqual(["blk-1", "blk-2", "blk-3"]);
    });

    it("基线验收1 部分成功混合态：10 块过 7 拒 3 共存", () => {
        const group = groupFixture();
        group.blocks = Array.from({length: 10}, (_, i) => ({
            blockId: `blk-${i + 1}`,
            sourceId: "grp-1",
            old: `旧段${i + 1}`,
            new: `新段${i + 1}`,
            status: "pending" as const,
            impactIds: [],
        }));
        let next = group;
        for (let i = 0; i < 7; i += 1) next = acceptBlock(next, `blk-${i + 1}`, BODY).group;
        for (let i = 7; i < 10; i += 1) next = rejectBlock(next, `blk-${i + 1}`);
        expect(next.blocks.filter((b) => b.status === "accepted")).toHaveLength(7);
        expect(next.blocks.filter((b) => b.status === "rejected")).toHaveLength(3);
    });

    it("基线4 撤销：accepted 块回 pending，可重新决策（撤销/恢复操作证据）", () => {
        const accepted = acceptBlock(groupFixture(), "blk-1", BODY).group;
        const revoked = revokeAccepted(accepted, "blk-1");
        expect(revoked.blocks.find((b) => b.blockId === "blk-1")?.status).toBe("pending");
        expect(() => acceptBlock(revoked, "blk-1", BODY)).not.toThrow();
    });

    it("基线11 持久化往返：serialize→deserialize 恒等（刷新重进恢复的载体）", () => {
        let group = acceptBlock(groupFixture(), "blk-1", BODY).group;
        group = rejectBlock(group, "blk-2");
        const restored = deserializeReviewState(serializeReviewState(group));
        expect(restored).toEqual(group);
    });

    it("基线11 半完成态对账：状态 accepted 但正文 hash 不符→该块 void 建议，禁静默重写", () => {
        let group = acceptBlock(groupFixture(), "blk-1", BODY).group;
        // 未回填 appliedBodyHash=写入链未完成记账 → accepted 块按半完成处理
        expect(detectHalfApplied(group, "sha-anything")).toEqual([{blockId: "blk-1", action: "void"}]);
        // 写入方回填了正文 hash：一致→无对账动作；不符→void 建议
        group.appliedBodyHash = "sha-body-at-8";
        expect(detectHalfApplied(group, "sha-body-at-8")).toEqual([]);
        expect(detectHalfApplied(group, "sha-stale-body")).toEqual([{blockId: "blk-1", action: "void"}]);
    });

    it("基线1/5 通过块写入正文：applyReviewToBody 只替换命中段，其余原样", () => {
        const content = applyReviewToBody(BODY, [
            {blockId: "blk-1", old: "夜色像一张网。", new: "夜色像一张浸了水的网。", status: "accepted"},
            {blockId: "blk-x", old: "不存在的段。", new: "不应出现。", status: "pending"},
        ]);
        expect(content).toContain("夜色像一张浸了水的网。");
        expect(content).toContain("他推门进来。");
        expect(content).not.toContain("不应出现。");
    });
});
