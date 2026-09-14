import {tracedCompleteSimple} from "nbook/server/agent/observability/traced-provider";
import type {Models} from "@earendil-works/pi-ai";
import type {JsonValue, Model} from "nbook/server/agent/messages/types";
import {createUserMessage} from "nbook/server/agent/messages/message-utils";
import {sanitizeProviderErrorMessage} from "nbook/server/agent/observability/provider-error-sanitizer";
import {mergePiRequestHeaders, parsePiSimpleRequestOptions, piRequestAuthOptions} from "nbook/server/agent/harness/pi-request-options";

/** 单次解释请求携带的调用事实；全部来自公开投影，不含文件正文。 */
export type ToolExplanationInput = {
    toolName: string;
    argsText?: string | null;
    resultText?: string | null;
    errorText?: string | null;
    locale: "zh-CN" | "en-US";
    models: Models;
    model: Model<any>;
    apiKey?: string;
    timeoutMs?: number | null;
    requestOptions?: Record<string, JsonValue>;
    signal?: AbortSignal;
};

/**
 * 解释任务的系统提示。
 * 明确禁止推测与「建议下一步」：解释只负责讲清这一步，不替 Agent 决策。
 */
const EXPLANATION_SYSTEM_PROMPT = [
    "You explain a single AI agent tool call to a non-technical user.",
    "Rules:",
    "- Explain what this step was trying to do, and what actually happened.",
    "- Two or three short sentences. No preamble, no headings, no bullet lists.",
    "- Only state what the given arguments and result actually show. Never speculate.",
    "- Do not suggest next steps and do not claim the overall task is finished.",
].join("\n");

/** 解释上限：这是给人扫一眼的说明，不是第二篇正文。 */
const EXPLANATION_MAX_TOKENS = 600;

const localeInstruction = (locale: ToolExplanationInput["locale"]): string => locale === "en-US"
    ? "Reply in English."
    : "Reply in Simplified Chinese.";

/** 把一次工具调用拼成一次性上下文；旁路调用不读取也不写入任何会话历史。 */
const buildExplanationPrompt = (input: ToolExplanationInput): string => {
    const blocks = [
        localeInstruction(input.locale),
        `<tool name="${input.toolName}"/>`,
        input.argsText ? `<arguments>\n${input.argsText}\n</arguments>` : "",
        input.resultText ? `<result>\n${input.resultText}\n</result>` : "",
        input.errorText ? `<error>\n${input.errorText}\n</error>` : "",
    ];
    return blocks.filter(Boolean).join("\n\n");
};

/**
 * 生成「这一步在干什么」的解释。
 *
 * 与 compaction 摘要同一套姿势：构造一次性 Context 直接调 provider，
 * **不创建 session、不写任何历史**，所以解释正文不会回流进主对话、也不会影响后续 Agent 决策。
 */
export async function generateToolExplanation(input: ToolExplanationInput): Promise<string> {
    const requestOptions = parsePiSimpleRequestOptions(input.requestOptions);
    const completeContext = {
        systemPrompt: EXPLANATION_SYSTEM_PROMPT,
        messages: [createUserMessage({text: buildExplanationPrompt(input)})],
    };
    const completeOptions = {
        ...requestOptions,
        ...piRequestAuthOptions({
            api: input.model.api,
            apiKey: input.apiKey,
            env: requestOptions.env,
        }),
        headers: mergePiRequestHeaders(input.model.headers, requestOptions.headers),
        timeoutMs: input.timeoutMs ?? undefined,
        maxTokens: Math.min(EXPLANATION_MAX_TOKENS, input.model.maxTokens),
        signal: input.signal,
    };
    input.signal?.throwIfAborted();
    // 统一入口：trace 缺省时 tracedCompleteSimple 等同于裸 completeSimple，不落记录、零开销。
    const response = await tracedCompleteSimple(input.models, input.model, completeContext, completeOptions);
    input.signal?.throwIfAborted();
    if (response.stopReason === "error" || response.stopReason === "aborted") {
        throw new Error(sanitizeProviderErrorMessage(response.errorMessage || "工具解释生成失败"));
    }
    const text = response.content
        .filter((block) => block.type === "text")
        .map((block) => block.text.trim())
        .filter(Boolean)
        .join("\n")
        .trim();
    if (!text) {
        throw new Error("工具解释为空");
    }
    return text;
}
