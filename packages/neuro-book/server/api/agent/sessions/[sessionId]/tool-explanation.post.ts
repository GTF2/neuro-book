import {explainAgentToolCall, requireAgentSessionId} from "nbook/server/agent/http";
import {AgentToolExplanationRequestDtoSchema} from "nbook/shared/dto/agent-session.dto";
import {validateBody} from "nbook/server/utils/novel-chapter";

/**
 * 解释一次工具调用。
 *
 * 旁路端点：只把这次调用的参数与结果交给模型生成一段说明，
 * 不建 session、不写会话历史，所以不会成为主对话的噪音。
 */
export default defineEventHandler(async (event) => {
    const sessionId = requireAgentSessionId(event);
    const body = await validateBody(event, AgentToolExplanationRequestDtoSchema);
    return explainAgentToolCall(sessionId, body);
});
