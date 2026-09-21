import {createError} from "h3";
import {prepareSystemAssets} from "nbook/server/workspace-files/system-assets-preflight";
import {useAgentHarness} from "nbook/server/agent/http";

/**
 * 准备最新系统 assets 后同步到用户 assets。
 */
export default defineEventHandler(async () => {
    const harness = useAgentHarness();
    try {
        const result = await prepareSystemAssets({
            syncUserAssets: true,
            profileRelease: {
                mode: "in_process",
                registry: harness.profiles,
            },
        });
        return result.userAssetsSync;
    } catch (error) {
        // 用户资产同步失败是可恢复的运营态（如受管资产被手改），必须留在响应层；
        // 冒泡出去曾与 dev 进程异常退出（exited code 5）同时段出现，不允许再向上逃逸。
        throw createError({
            statusCode: 500,
            message: "用户资产同步失败，请检查系统资产是否被手动修改后重试",
            data: {reason: error instanceof Error ? error.message : String(error)},
        });
    }
});
