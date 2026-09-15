import type {
    CreateStoryKeyframeRequestDto,
    StoryKeyframeDto,
    UpdateStoryKeyframeRequestDto,
} from "nbook/shared/dto/plot.dto";

/**
 * 关键帧(写作宪法第三条)HTTP typed client。
 * 只覆盖本轮 UI 消费的端点,与 `server/api/projects/plot/[...segments].ts` 的 keyframes 路由族一一对应;
 * 请求 query 携带 projectRoot。补间区间查询(`keyframes/tween`)本轮不做可视化,故不在此暴露。
 */

/** 组装带 projectRoot 的请求选项。 */
function keyframeQuery(projectRoot: string): {query: {projectRoot: string}} {
    return {query: {projectRoot}};
}

/** 拉取帧列表(服务按 instant 升序返回)。 */
export async function listStoryKeyframes(projectRoot: string): Promise<StoryKeyframeDto[]> {
    return await $fetch<StoryKeyframeDto[]>(`/api/projects/plot/keyframes`, keyframeQuery(projectRoot));
}

/** 创建帧;创建恒为 `pending` 态,来源由 body.source 决定(界面固定 author)。 */
export async function createStoryKeyframe(projectRoot: string, body: CreateStoryKeyframeRequestDto): Promise<StoryKeyframeDto> {
    return await $fetch<StoryKeyframeDto>(`/api/projects/plot/keyframes`, {...keyframeQuery(projectRoot), method: "POST", body});
}

/** 更新帧(PATCH 语义:undefined=不修改,null=显式清空);状态流转与推翻留痕不变式由服务层校验。 */
export async function updateStoryKeyframe(projectRoot: string, keyframeId: string, body: UpdateStoryKeyframeRequestDto): Promise<StoryKeyframeDto> {
    return await $fetch<StoryKeyframeDto>(`/api/projects/plot/keyframes/${keyframeId}`, {...keyframeQuery(projectRoot), method: "PATCH", body});
}
