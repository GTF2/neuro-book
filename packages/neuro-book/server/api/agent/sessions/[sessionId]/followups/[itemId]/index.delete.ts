import {dismissAgentFollowUpItem, requireAgentFollowUpItemId, requireAgentSessionId} from "nbook/server/agent/http";

/**
 * 忽略队列中的某一条：从队列永久移除，不再送达。
 */
export default defineEventHandler(async (event) => {
    const sessionId = requireAgentSessionId(event);
    const itemId = requireAgentFollowUpItemId(event);
    return dismissAgentFollowUpItem(sessionId, itemId);
});
