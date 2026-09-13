import type {KeyframeRepository} from "nbook/server/plot/contracts/plot-repositories";
import type {StoryKeyframeEntity} from "nbook/server/plot/core/types";
import {PlotDtoAssembler} from "nbook/server/plot/assemblers/plot-dto.assembler";
import {KeyframeService} from "nbook/server/plot/services/keyframe.service";
import {PlotScopeGuard} from "nbook/server/plot/services/plot-scope.guard";
import type {StoryService} from "nbook/server/plot/services/story.service";
import {afterAll, beforeAll, describe, expect, it, vi} from "vitest";

type CreateErrorInput = {statusCode: number; message: string};
type TestGlobal = typeof globalThis & {
    createError?: (input: CreateErrorInput) => Error & CreateErrorInput;
};

/** 构造 Keyframe 实体夹具(默认 pending、author 来源)。 */
function keyframeEntity(overrides: Partial<StoryKeyframeEntity> = {}): StoryKeyframeEntity {
    return {
        id: 21,
        storyId: 10,
        sceneId: 20,
        name: "k-necklace-lost",
        title: "薇洛丝失去项链",
        instant: 500n,
        irreversibleChanges: ["薇洛丝失去项链", "格里沙目睹一切"],
        source: "author",
        status: "pending",
        decisionRefId: null,
        note: null,
        createdAt: new Date("2026-07-01T00:00:00Z"),
        updatedAt: new Date("2026-07-01T00:00:00Z"),
        ...overrides,
    } as StoryKeyframeEntity;
}

type ServiceFixture = {
    service: KeyframeService;
    repository: {
        findKeyframesBetween: ReturnType<typeof vi.fn>;
        createKeyframe: ReturnType<typeof vi.fn>;
        updateKeyframe: ReturnType<typeof vi.fn>;
    };
};

/** 构造被测服务:仓储/守卫用 mock,组装器用真实实现。 */
function createService(options: {
    keyframe: StoryKeyframeEntity;
    between?: StoryKeyframeEntity[];
}): ServiceFixture {
    const repository = {
        findKeyframeById: vi.fn(async () => options.keyframe),
        findKeyframesByStory: vi.fn(async () => [options.keyframe]),
        findKeyframesBetween: vi.fn(async () => options.between ?? []),
        findKeyframeByName: vi.fn(async () => null),
        createKeyframe: vi.fn(async () => options.keyframe),
        updateKeyframe: vi.fn(async (_keyframeId: number, data: Partial<StoryKeyframeEntity>) => ({...options.keyframe, ...data})),
        deleteKeyframe: vi.fn(async () => undefined),
    };
    const storyService = {
        ensureStory: vi.fn(async () => ({id: 10})),
    } as unknown as StoryService;
    const scopeGuard = {
        assertKeyframe: vi.fn(async (_storyId: number, keyframeId: number) => {
            if (keyframeId === options.keyframe.id) {
                return options.keyframe;
            }
            if (options.between?.some((keyframe) => keyframe.id === keyframeId)) {
                return options.between.find((keyframe) => keyframe.id === keyframeId)!;
            }
            throw Object.assign(new Error("Keyframe 不存在"), {statusCode: 404});
        }),
        assertKeyframeNameUnique: vi.fn(async () => undefined),
        assertScene: vi.fn(async () => ({id: 20, storyId: 10})),
        assertDecision: vi.fn(async () => ({id: 8, storyId: 10})),
    } as unknown as PlotScopeGuard;
    const service = new KeyframeService(
        repository as unknown as KeyframeRepository,
        storyService,
        scopeGuard,
        new PlotDtoAssembler(),
    );
    return {service, repository};
}

describe("KeyframeService", () => {
    const testGlobal = globalThis as TestGlobal;
    const previousCreateError = testGlobal.createError;

    beforeAll(() => {
        testGlobal.createError = (input: CreateErrorInput) => Object.assign(new Error(input.message), input);
    });

    afterAll(() => {
        testGlobal.createError = previousCreateError;
    });

    it("创建 Keyframe:恒 pending 态,instant 字符串转 bigint,changes 透传", async () => {
        const {service, repository} = createService({keyframe: keyframeEntity()});

        const dto = await service.createStoryKeyframe({
            sceneId: "20",
            name: "k-necklace-lost",
            title: "薇洛丝失去项链",
            instant: "500",
            irreversibleChanges: ["薇洛丝失去项链", "格里沙目睹一切"],
        });

        expect(repository.createKeyframe).toHaveBeenCalledWith(expect.objectContaining({
            storyId: 10,
            sceneId: 20,
            instant: 500n,
            source: "author",
        }));
        expect(dto).toMatchObject({
            id: "21",
            sceneId: "20",
            instant: "500",
            irreversibleChanges: ["薇洛丝失去项链", "格里沙目睹一切"],
            status: "pending",
            source: "author",
        });
    });

    it("补间区间:返回 (起点, 终点] 时间窗内的帧", async () => {
        const between = [
            keyframeEntity({id: 22, name: "k-oath-broken", instant: 700n}),
            keyframeEntity({id: 23, name: "k-grisha-dead", instant: 900n}),
        ];
        const {service, repository} = createService({keyframe: keyframeEntity(), between});

        const dtos = await service.findTweenKeyframes(21, 23);

        expect(repository.findKeyframesBetween).toHaveBeenCalledWith(10, 500n, 900n);
        expect(dtos.map((dto) => dto.name)).toEqual(["k-oath-broken", "k-grisha-dead"]);
    });

    it("补间区间:终点帧 instant 不晚于起点帧时拒绝", async () => {
        const {service} = createService({keyframe: keyframeEntity()});

        await expect(service.findTweenKeyframes(21, 21)).rejects.toMatchObject({
            statusCode: 400,
            message: expect.stringContaining("补间区间无效"),
        });
    });

    it("裁决推翻:overthrown 必须挂 decisionRefId 留痕(宪法第六条)", async () => {
        const {service} = createService({keyframe: keyframeEntity()});

        await expect(service.updateStoryKeyframe(21, {status: "overthrown"})).rejects.toMatchObject({
            statusCode: 400,
            message: expect.stringContaining("decisionRefId"),
        });
    });

    it("裁决推翻:overthrown 带 decisionRefId 时通过并校验决策属于同 story", async () => {
        const {service, repository} = createService({keyframe: keyframeEntity()});

        const dto = await service.updateStoryKeyframe(21, {status: "overthrown", decisionRefId: "8"});

        expect(repository.updateKeyframe).toHaveBeenCalledWith(21, expect.objectContaining({
            status: "overthrown",
            decisionRefId: 8,
        }));
        expect(dto.status).toBe("overthrown");
    });

    it("状态回撞单向:confirmed 不可回退到 pending", async () => {
        const {service} = createService({keyframe: keyframeEntity({status: "confirmed"})});

        await expect(service.updateStoryKeyframe(21, {status: "pending"})).rejects.toMatchObject({
            statusCode: 400,
            message: expect.stringContaining("不可回退"),
        });
    });

    it("回撞置 violated 不需要 decisionRefId(未裁决)", async () => {
        const {service, repository} = createService({keyframe: keyframeEntity()});

        await service.updateStoryKeyframe(21, {status: "violated"});

        expect(repository.updateKeyframe).toHaveBeenCalledWith(21, expect.objectContaining({status: "violated"}));
    });
});
