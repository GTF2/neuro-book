import type {KeyframeRepository} from "nbook/server/plot/contracts/plot-repositories";
import {throwPlotBadRequest} from "nbook/server/plot/core/errors";
import {PlotDtoAssembler} from "nbook/server/plot/assemblers/plot-dto.assembler";
import {PlotScopeGuard} from "nbook/server/plot/services/plot-scope.guard";
import {StoryService} from "nbook/server/plot/services/story.service";
import {parseEntityId} from "nbook/server/utils/novel-chapter";
import type {
    CreateStoryKeyframeRequestDto,
    StoryKeyframeDto,
    StoryKeyframeStatusDto,
    UpdateStoryKeyframeRequestDto,
} from "nbook/shared/dto/plot.dto";

/**
 * Keyframe 服务(写作宪法第三条「关键帧写作」)。
 *
 * 人只写关键帧——不可逆的状态变化锚点;帧与帧之间的补间交给 writer 演化(keyframe-tween-review workflow)。
 * 数据面只有帧本身:instant 锚 World Engine 时刻,irreversibleChanges 是回撞校验的标的。
 * 状态流转:
 * - 创建恒 pending;
 * - 回撞 workflow 把未发现冲突的帧置 confirmed、发现冲突的帧置 violated;
 * - 裁决(violated → confirmed/overthrown)由作者或 leader 发起,overthrown 必须挂 decisionRefId 留痕(宪法第六条)。
 *
 * 补间区间计算(findTweenKeyframes)只查 (fromInstant, toInstant] 时间窗,不新增全量遍历。
 */
export class KeyframeService {
    constructor(
        private readonly keyframeRepository: KeyframeRepository,
        private readonly storyService: StoryService,
        private readonly scopeGuard: PlotScopeGuard,
        private readonly assembler: PlotDtoAssembler,
    ) {}

    /**
     * 列出 Story 下全部 Keyframe(按 instant 升序,即故事时间顺序)。
     */
    async listStoryKeyframes(): Promise<StoryKeyframeDto[]> {
        const story = await this.storyService.ensureStory();
        const keyframes = await this.keyframeRepository.findKeyframesByStory(story.id);
        return keyframes.map((keyframe) => this.assembler.toStoryKeyframeDto(keyframe));
    }

    /**
     * 读取单个 Keyframe DTO。
     */
    async getStoryKeyframeDto(keyframeId: number): Promise<StoryKeyframeDto> {
        const story = await this.storyService.ensureStory();
        const keyframe = await this.scopeGuard.assertKeyframe(story.id, keyframeId);
        return this.assembler.toStoryKeyframeDto(keyframe);
    }

    /**
     * 创建 Keyframe(恒 pending 态)。
     */
    async createStoryKeyframe(input: CreateStoryKeyframeRequestDto): Promise<StoryKeyframeDto> {
        const story = await this.storyService.ensureStory();
        await this.scopeGuard.assertKeyframeNameUnique(story.id, input.name);
        const sceneId = await this.resolveSceneId(story.id, input.sceneId ?? null);
        const keyframe = await this.keyframeRepository.createKeyframe({
            storyId: story.id,
            sceneId,
            name: input.name,
            title: input.title,
            instant: BigInt(input.instant),
            irreversibleChanges: input.irreversibleChanges,
            source: input.source ?? "author",
            note: input.note ?? null,
        });
        return this.assembler.toStoryKeyframeDto(keyframe);
    }

    /**
     * 更新 Keyframe。状态流转不变式:
     * - overthrown 必须挂 decisionRefId(推翻留痕,宪法第六条);
     * - violated/confirmed/overthrown 不得直接改回 pending(回撞单向);
     * - 回撞 workflow 写 violated/confirmed 时不强制 decisionRefId(未裁决),overthrown 必须由裁决产生。
     */
    async updateStoryKeyframe(keyframeId: number, input: UpdateStoryKeyframeRequestDto): Promise<StoryKeyframeDto> {
        const story = await this.storyService.ensureStory();
        const existing = await this.scopeGuard.assertKeyframe(story.id, keyframeId);
        if (input.name !== undefined && input.name !== existing.name) {
            await this.scopeGuard.assertKeyframeNameUnique(story.id, input.name, keyframeId);
        }
        const sceneId = input.sceneId === undefined ? undefined : await this.resolveSceneId(story.id, input.sceneId);
        const finalStatus: StoryKeyframeStatusDto = input.status ?? existing.status;
        if (finalStatus === "overthrown" && (input.decisionRefId ?? null) === null && existing.decisionRefId === null) {
            throwPlotBadRequest("置为 overthrown 失败:需要 decisionRefId 指向裁决用的创作决策记录(宪法第六条推翻留痕)");
        }
        if (existing.status !== "pending" && finalStatus === "pending") {
            throwPlotBadRequest("Keyframe 状态不可回退到 pending:回撞流转是单向的");
        }
        const decisionRefId = input.decisionRefId === undefined || input.decisionRefId === null
            ? input.decisionRefId
            : (await this.scopeGuard.assertDecision(story.id, parseEntityId("decisionRefId", input.decisionRefId))).id;
        const keyframe = await this.keyframeRepository.updateKeyframe(keyframeId, {
            ...(sceneId === undefined ? {} : {sceneId}),
            ...(input.name === undefined ? {} : {name: input.name}),
            ...(input.title === undefined ? {} : {title: input.title}),
            ...(input.instant === undefined ? {} : {instant: BigInt(input.instant)}),
            ...(input.irreversibleChanges === undefined ? {} : {irreversibleChanges: input.irreversibleChanges}),
            ...(input.status === undefined ? {} : {status: input.status}),
            ...(input.decisionRefId === undefined ? {} : {decisionRefId: decisionRefId ?? null}),
            ...(input.note === undefined ? {} : {note: input.note}),
        });
        return this.assembler.toStoryKeyframeDto(keyframe);
    }

    /**
     * 删除 Keyframe。
     */
    async deleteStoryKeyframe(keyframeId: number): Promise<void> {
        const story = await this.storyService.ensureStory();
        await this.scopeGuard.assertKeyframe(story.id, keyframeId);
        await this.keyframeRepository.deleteKeyframe(keyframeId);
    }

    /**
     * 补间区间查询(写作宪法第三条):返回 (fromKeyframe, toKeyframe] 时间窗内的帧,
     * 即补间演化的"路标"——起点帧状态是已知输入,终点帧(含)是要回撞的标的。
     */
    async findTweenKeyframes(fromKeyframeId: number, toKeyframeId: number): Promise<StoryKeyframeDto[]> {
        const story = await this.storyService.ensureStory();
        const from = await this.scopeGuard.assertKeyframe(story.id, fromKeyframeId);
        const to = await this.scopeGuard.assertKeyframe(story.id, toKeyframeId);
        if (to.instant <= from.instant) {
            throwPlotBadRequest("补间区间无效:终点帧的 instant 必须晚于起点帧");
        }
        const keyframes = await this.keyframeRepository.findKeyframesBetween(story.id, from.instant, to.instant);
        return keyframes.map((keyframe) => this.assembler.toStoryKeyframeDto(keyframe));
    }

    /**
     * 解析 sceneId 锚定:null 直接透传;非空校验同 story 后返回数字 id。
     */
    private async resolveSceneId(storyId: number, sceneId: string | null): Promise<number | null> {
        if (sceneId === null) {
            return null;
        }
        const scene = await this.scopeGuard.assertScene(storyId, parseEntityId("sceneId", sceneId));
        return scene.id;
    }
}
