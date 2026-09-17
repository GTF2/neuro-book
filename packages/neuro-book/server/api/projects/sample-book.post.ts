import {ensureSampleBookProject, type SampleBookSeedResult} from "nbook/server/workspace-files/sample-book";
import {throwProjectHttpError} from "nbook/server/api/projects/project-http-error";

/**
 * 「空态即演示」入口：确保内置示例书存在（不存在则创建 + 叠加正文 + 落 1 个未兑现伏笔），
 * 返回其 Project root 供前端立即打开。
 *
 * 这是**显式**动作：只有用户点击空态里的「打开示例书」才会创建，绝不在启动时隐式播种；
 * 删掉示例书后再次点击会重建，删除路径即「项目选择界面 → 删除」。
 */
export default defineEventHandler(async (): Promise<SampleBookSeedResult> => {
    try {
        return await ensureSampleBookProject();
    } catch (error) {
        throwProjectHttpError(error);
    }
});
