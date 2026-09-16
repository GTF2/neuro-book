import {deliverAgentFollowUpItem, requireAgentFollowUpItemId, requireAgentSessionId} from "nbook/server/agent/http";

/**
 * 送达队列中的某一条待投递消息。
 *
 * 会话空闲时立即投递；运行中则置顶排到本轮结束后第一个送出，不打断当前 invocation。
 */
export default defineEventHandler(async (event) => {
    const sessionId = requireAgentSessionId(event);
    const itemId = requireAgentFollowUpItemId(event);
    return deliverAgentFollowUpItem(sessionId, itemId);
});
