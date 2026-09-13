import type {JsonValue} from "nbook/server/agent/messages/types";

/**
 * 携带结构化 details 的工具错误。
 *
 * Harness 在 `executeTool` 的 catch 中识别该类型，把 `details` 一并投影为工具结果的
 * `details`，让专用工具卡无需解析错误文案即可拿到失败原因码与命中行号。
 * 普通 `Error` 行为不变（details 仍为空对象）。
 */
export class ToolResultError extends Error {
    readonly details: JsonValue;

    constructor(message: string, details: JsonValue) {
        super(message);
        this.name = "ToolResultError";
        this.details = details;
    }
}

export function isToolResultError(value: unknown): value is ToolResultError {
    return value instanceof ToolResultError;
}
