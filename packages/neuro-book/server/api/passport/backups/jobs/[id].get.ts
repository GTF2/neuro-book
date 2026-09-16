import type {PassportJobDto} from "nbook/shared/dto/passport.dto";
import {requireAdminAccess} from "nbook/server/utils/auth";
import {usePassportJobManager} from "nbook/server/backup/backup-job-manager";

/**
 * 查询备份/恢复后台任务状态。
 */
export default defineEventHandler(async (event): Promise<PassportJobDto> => {
    await requireAdminAccess(event);
    const jobId = getRouterParam(event, "id") ?? "";
    const job = usePassportJobManager().job(jobId);
    if (!job) {
        throw createError({statusCode: 404, message: "任务不存在或已被清理"});
    }
    return job;
});
