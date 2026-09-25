import {createHash} from "node:crypto";
import {createError, readBody} from "h3";
import {z} from "zod";
import {withProjectHandlesOperation} from "nbook/server/workspace-files/project-open-guard";
import {LOCAL_USER_ID} from "nbook/server/workspace-history/project-history";
import {
    acceptBlock,
    applyReviewToBody,
    detectHalfApplied,
    deserializeReviewState,
    rejectBlock,
    reviewStatePathFor,
    revokeAccepted,
    serializeReviewState,
    voidGroup,
    type ReviewGroup,
} from "nbook/app/components/novel-ide/review/review-blocks";

function bodyHash(content: string): string {
    return createHash("sha256").update(content, "utf8").digest("hex");
}

const BodySchema = z.object({
    projectRoot: z.string().trim().min(1),
    chapterPath: z.string().trim().min(1).regex(/\.md$/i, "chapterPath 必须指向章节 .md 文件"),
    action: z.enum(["accept", "reject", "void", "revoke"]),
    blockId: z.string().trim().min(1).optional(),
    currentBody: z.string(),
    stateFileContent: z.string(),
}).superRefine((value, ctx) => {
    if (value.action !== "void" && !value.blockId) {
        ctx.addIssue({code: "custom", path: ["blockId"], message: "action=accept/reject/revoke 时必须提供 blockId"});
    }
});

/**
 * 审稿决议端点（任务033 C 段）：唯一写入通道。
 * 正文写入与状态文件登记都走 WorkspaceHistory.performWrite（进时间线/快照，基线 8 由管道满足）；
 * appliedBodyHash 由本端点计算回填（前端不可伪造，对账可信）。
 */
export default defineEventHandler(async (event) => {
    const body = BodySchema.parse(await readBody(event));
    let group: ReviewGroup;
    try {
        group = deserializeReviewState(body.stateFileContent);
    } catch (error) {
        throw createError({statusCode: 400, statusMessage: error instanceof Error ? error.message : "审稿状态文件无效"});
    }
    if (group.chapterPath !== body.chapterPath) {
        throw createError({statusCode: 400, statusMessage: "状态文件与章节路径不匹配"});
    }
    // 半完成态对账（基线 11）：状态记录的正文 hash 与提交正文不符→拒绝执行，返回 void 建议
    const stale = detectHalfApplied(group, bodyHash(body.currentBody));
    if (stale.length > 0 && group.appliedBodyHash !== undefined) {
        throw createError({statusCode: 409, statusMessage: "正文与审稿状态不一致（半完成态）", data: {halfApplied: stale}});
    }

    return withProjectHandlesOperation(body.projectRoot, async (handles) => {
        const history = (await handles.history.history) as unknown as {
            performWrite: (actor: string, path: string, content: string) => Promise<unknown>;
        };
        if (!history?.performWrite) {
            throw createError({statusCode: 503, statusMessage: "history_disabled"});
        }

        let next = group;
        let newBody: string | null = null;
        if (body.action === "accept") {
            const result = acceptBlock(next, body.blockId!, body.currentBody);
            next = result.group;
            newBody = result.writeIntent.content;
        } else if (body.action === "reject") {
            next = rejectBlock(next, body.blockId!);
        } else if (body.action === "revoke") {
            next = revokeAccepted(next, body.blockId!);
        } else {
            next = voidGroup(next);
        }

        // ① 正文写入（accept：通过块立即写正文）
        if (newBody !== null) {
            await history.performWrite(LOCAL_USER_ID, body.chapterPath, newBody);
            next = {...next, appliedBodyHash: bodyHash(newBody)};
        }
        // ② 状态文件登记（同一通道，决议记录=状态文件历史快照链）
        const stateContent = serializeReviewState(next);
        await history.performWrite(LOCAL_USER_ID, reviewStatePathFor(body.chapterPath), stateContent);

        return {stateFileContent: stateContent, ...(newBody === null ? {} : {newBody})};
    });
});
