import {requireAgentSessionId, resumeAgentFollowUps} from "nbook/server/agent/http";

/**
 * 解除队列暂停，并按时间顺序继续投递全部积压。
 */
export default defineEventHandler(async (event) => {
    const sessionId = requireAgentSessionId(event);
    return resumeAgentFollowUps(sessionId);
});
