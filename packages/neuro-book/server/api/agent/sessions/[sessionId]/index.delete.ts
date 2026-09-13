import {requireAgentSessionId, deleteAgentSession} from "nbook/server/agent/http";

/**
 * 永久删除一个 Agent Session（不可恢复）：终止活跃调用、删除日志文件与 Composer 草稿。
 */
export default defineEventHandler(async (event) => {
    const sessionId = requireAgentSessionId(event);
    return deleteAgentSession(sessionId);
});
