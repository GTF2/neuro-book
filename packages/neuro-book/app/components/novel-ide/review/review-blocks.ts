/**
 * G2/G3 审稿态与块级 diff 状态机（任务033，P0-02）。
 *
 * 契约基线见 `docs/tasks/任务033-G2G3审稿态契约.md`：
 * - 块状态机 pending/accepted/rejected/void，终态不可迁移，整件拒绝=全组 void；
 * - 通过块立即写正文（writeIntent 交调用方走 WorkspaceHistory.performWrite）；
 * - 撤销=accepted 回 pending（正文回滚由调用方 revertAtRevision）；
 * - 持久化=章节伴随状态文件（serializeReviewState），读写全走 WorkspaceHistory 管道；
 * - 半完成态对账（detectHalfApplied）：状态 accepted 但正文 hash 不符→void 建议，禁静默重写。
 */

export type ReviewBlockStatus = "pending" | "accepted" | "rejected" | "void";

export type ReviewBlock = {
    blockId: string;
    sourceId: string;
    /** 原文段；空串=新增块（锚点插入策略归 UI 轮）。 */
    old: string;
    new: string;
    status: ReviewBlockStatus;
    impactIds: string[];
};

export type ReviewGroup = {
    groupId: string;
    chapterPath: string;
    baseRevision: number;
    /** accepted 块已应用正文的 hash；写入方落盘后回填，半完成态对账依据。 */
    appliedBodyHash?: string;
    blocks: ReviewBlock[];
    createdAt: number;
};

const TERMINAL: readonly ReviewBlockStatus[] = ["accepted", "rejected", "void"];

function assertMigratable(block: ReviewBlock): void {
    if (TERMINAL.includes(block.status)) {
        throw new Error(`块 ${block.blockId} 已是终态 ${block.status}，不可再迁移`);
    }
}

function mapBlock(group: ReviewGroup, blockId: string, status: ReviewBlockStatus): ReviewGroup {
    return {
        ...group,
        blocks: group.blocks.map((block) => (block.blockId === blockId ? {...block, status} : block)),
    };
}

/** pending→accepted：返回新组与正文写入意图（content=全部 accepted 块应用到当前正文）。 */
export function acceptBlock(group: ReviewGroup, blockId: string, currentBody: string): {group: ReviewGroup; writeIntent: {path: string; content: string}} {
    const block = group.blocks.find((b) => b.blockId === blockId);
    if (!block) {
        throw new Error(`未找到块 ${blockId}`);
    }
    assertMigratable(block);
    const next = mapBlock(group, blockId, "accepted");
    return {
        group: next,
        writeIntent: {path: group.chapterPath, content: applyReviewToBody(currentBody, next.blocks)},
    };
}

/** pending→rejected：组保留（转引用气泡与重新提案由 G1 侧承接）。 */
export function rejectBlock(group: ReviewGroup, blockId: string): ReviewGroup {
    const block = group.blocks.find((b) => b.blockId === blockId);
    if (!block) {
        throw new Error(`未找到块 ${blockId}`);
    }
    assertMigratable(block);
    return mapBlock(group, blockId, "rejected");
}

/** 整件拒绝：全组 void（终态不可复活）；ID 与决议记录不物理删除（可溯，防历史断链）。 */
export function voidGroup(group: ReviewGroup): ReviewGroup {
    return {
        ...group,
        blocks: group.blocks.map((block) => ({...block, status: "void" as const})),
    };
}

/** 撤销：accepted 回 pending（正文回滚由调用方 revertAtRevision），可重新决策。 */
export function revokeAccepted(group: ReviewGroup, blockId: string): ReviewGroup {
    const block = group.blocks.find((b) => b.blockId === blockId);
    if (!block || block.status !== "accepted") {
        throw new Error(`块 ${blockId} 不是 accepted 态，无法撤销`);
    }
    return mapBlock(group, blockId, "pending");
}

/** 把 accepted 块应用到正文（old 按出现顺序逐段替换，游标推进防同文多块错位）；未 accepted 不碰正文。 */
export function applyReviewToBody(body: string, blocks: Array<Pick<ReviewBlock, "blockId" | "old" | "new" | "status">>): string {
    let content = body;
    let cursor = 0;
    for (const block of blocks) {
        if (block.status !== "accepted" || !block.old) {
            continue;
        }
        const index = content.indexOf(block.old, cursor);
        if (index < 0) {
            continue;
        }
        content = content.slice(0, index) + block.new + content.slice(index + block.old.length);
        cursor = index + block.new.length;
    }
    return content;
}

/** 序列化为章节伴随状态文件内容（基线 11 载体；读写走 WorkspaceHistory 管道）。 */
export function serializeReviewState(group: ReviewGroup): string {
    return JSON.stringify(group, null, 2);
}

export function deserializeReviewState(text: string): ReviewGroup {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== "object" || parsed === null || !("blocks" in parsed)) {
        throw new Error("审稿状态文件格式无效");
    }
    return parsed as ReviewGroup;
}

/** 章节伴随状态文件路径（基线 11）：`<章节>.review.json` 与正文同目录。 */
export function reviewStatePathFor(chapterPath: string): string {
    return chapterPath.replace(/\.md$/i, ".review.json");
}

/** 半完成态对账：状态 accepted 但正文 hash 记账缺失或不符→该块 void 建议（禁静默重写）。 */
export function detectHalfApplied(group: ReviewGroup, currentBodyHash: string): Array<{blockId: string; action: "void"}> {
    if (group.appliedBodyHash === currentBodyHash) {
        return [];
    }
    return group.blocks
        .filter((block) => block.status === "accepted")
        .map((block) => ({blockId: block.blockId, action: "void" as const}));
}
