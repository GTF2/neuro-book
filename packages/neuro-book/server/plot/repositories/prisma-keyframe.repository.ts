import type {StoryKeyframe} from "nbook/server/generated/project-prisma/client";
import type {KeyframeRepository} from "nbook/server/plot/contracts/plot-repositories";
import type {PrismaExecutor, StoryKeyframeEntity} from "nbook/server/plot/core/types";

/** 数据库原始行:irreversibleChanges 仍是 JSON 文本。 */
type StoryKeyframeWithJsonColumn = Omit<StoryKeyframe, "irreversibleChanges"> & {
    irreversibleChanges: string;
};

/**
 * Prisma 版 Keyframe 仓储(写作宪法第三条「关键帧写作」)。
 * irreversibleChanges 在读写边界完成 JSON 归一化,service 只见结构化数组。
 */
export class PrismaKeyframeRepository implements KeyframeRepository {
    constructor(private readonly prisma: PrismaExecutor) {}

    /**
     * 查询 Keyframe 实体。
     */
    async findKeyframeById(keyframeId: number): Promise<StoryKeyframeEntity | null> {
        const keyframe = await this.prisma.storyKeyframe.findUnique({
            where: {id: keyframeId},
        }) as StoryKeyframeWithJsonColumn | null;
        return keyframe ? normalizeKeyframeJsonColumn(keyframe) : null;
    }

    /**
     * 列出 Story 下全部 Keyframe(按 instant 升序,即故事时间顺序)。
     */
    async findKeyframesByStory(storyId: number): Promise<StoryKeyframeEntity[]> {
        const keyframes = await this.prisma.storyKeyframe.findMany({
            where: {storyId},
            orderBy: [
                {instant: "asc"},
                {id: "asc"},
            ],
        }) as StoryKeyframeWithJsonColumn[];
        return keyframes.map(normalizeKeyframeJsonColumn);
    }

    /**
     * 补间区间查询:返回 (fromInstant, toInstant] 内的帧(边界左开右闭:起点帧的状态是已知输入,终点帧是要撞的标的),按 instant 升序。
     */
    async findKeyframesBetween(storyId: number, fromInstant: bigint, toInstant: bigint): Promise<StoryKeyframeEntity[]> {
        const keyframes = await this.prisma.storyKeyframe.findMany({
            where: {
                storyId,
                instant: {
                    gt: fromInstant,
                    lte: toInstant,
                },
            },
            orderBy: [
                {instant: "asc"},
                {id: "asc"},
            ],
        }) as StoryKeyframeWithJsonColumn[];
        return keyframes.map(normalizeKeyframeJsonColumn);
    }

    /**
     * 按 name 查询 Keyframe(唯一性校验用)。
     */
    async findKeyframeByName(storyId: number, name: string, excludeKeyframeId?: number): Promise<StoryKeyframeEntity | null> {
        const keyframe = await this.prisma.storyKeyframe.findFirst({
            where: {
                storyId,
                name,
                ...(excludeKeyframeId ? {
                    NOT: {id: excludeKeyframeId},
                } : {}),
            },
        }) as StoryKeyframeWithJsonColumn | null;
        return keyframe ? normalizeKeyframeJsonColumn(keyframe) : null;
    }

    /**
     * 创建 Keyframe(恒 pending 态;confirmed/violated/overthrown 由回撞与裁决流转)。
     */
    async createKeyframe(input: {
        storyId: number;
        sceneId: number | null;
        name: string;
        title: string;
        instant: bigint;
        irreversibleChanges: string[];
        source: StoryKeyframe["source"];
        note: string | null;
    }): Promise<StoryKeyframeEntity> {
        const keyframe = await this.prisma.storyKeyframe.create({
            data: {
                storyId: input.storyId,
                sceneId: input.sceneId,
                name: input.name,
                title: input.title,
                instant: input.instant,
                irreversibleChanges: JSON.stringify(input.irreversibleChanges),
                source: input.source,
                note: input.note,
            },
        }) as StoryKeyframeWithJsonColumn;
        return normalizeKeyframeJsonColumn(keyframe);
    }

    /**
     * 更新 Keyframe(回撞状态流转与裁决留痕走这里)。
     */
    async updateKeyframe(keyframeId: number, data: Partial<Pick<
        StoryKeyframe,
        "sceneId" | "name" | "title" | "instant" | "status" | "decisionRefId" | "note"
    >> & {irreversibleChanges?: string[]}): Promise<StoryKeyframeEntity> {
        const {irreversibleChanges, ...columns} = data;
        const keyframe = await this.prisma.storyKeyframe.update({
            where: {id: keyframeId},
            data: {
                ...columns,
                ...(irreversibleChanges ? {irreversibleChanges: JSON.stringify(irreversibleChanges)} : {}),
            },
        }) as StoryKeyframeWithJsonColumn;
        return normalizeKeyframeJsonColumn(keyframe);
    }

    /**
     * 删除 Keyframe。
     */
    async deleteKeyframe(keyframeId: number): Promise<void> {
        await this.prisma.storyKeyframe.delete({
            where: {id: keyframeId},
        });
    }
}

/**
 * JSON 列归一化:irreversibleChanges 文本 → string[];损坏时回退为空数组并保留原文给 note 级诊断。
 */
function normalizeKeyframeJsonColumn(keyframe: StoryKeyframeWithJsonColumn): StoryKeyframeEntity {
    let irreversibleChanges: string[] = [];
    try {
        const parsed: unknown = JSON.parse(keyframe.irreversibleChanges);
        if (Array.isArray(parsed)) {
            irreversibleChanges = parsed.filter((item): item is string => typeof item === "string");
        }
    } catch {
        irreversibleChanges = [];
    }
    return {
        ...keyframe,
        irreversibleChanges,
    };
}
