import type {ChatNode} from "nbook/app/components/novel-ide/agent/agent-message";
import type {ChatFlowItem, ChatWorkBlockKind} from "nbook/app/components/novel-ide/agent/chat-work-blocks";
import {isFailedToolCall} from "nbook/app/components/novel-ide/agent/chat-work-blocks";

/** 大纲行的状态标记：成功绿、失败红、运行中蓝。 */
export type ChatOutlineStatus = "success" | "failed" | "running";

/** 右侧大纲的一行：用户提问是锚点，工作块是内容。 */
export type ChatOutlineItem =
    | {
        kind: "prompt";
        /** 与主时间线 DOM 对应的稳定锚点 id。 */
        anchorId: string;
        messageId: string;
        /** 提问摘要，已归一空白并按字符数截断；正文为空时是空串。 */
        preview: string;
        timestamp: string;
    }
    | {
        kind: "block";
        anchorId: string;
        blockId: string;
        blockKind: ChatWorkBlockKind;
        status: ChatOutlineStatus;
        /** 摘要所需的结构化计数，具体文案由 i18n 拼装。 */
        fileCount: number;
        count: number;
        failedCount: number;
    };

/** 提问摘要的最大字符数：大纲只用来定位，不承担阅读全文的职责。 */
const PROMPT_PREVIEW_MAX = 60;

/** 锚点 id 直接进 DOM，必须先剔除可能出现在消息 id 里的特殊字符。 */
const sanitizeAnchor = (value: string): string => value.replace(/[^A-Za-z0-9_-]/gu, "-");

/** 主时间线渲染节点对应的锚点 id，渲染层与大纲层共用，保证两边永远一致。 */
export const chatNodeAnchorId = (nodeKey: string): string => `chat-anchor-n-${sanitizeAnchor(nodeKey)}`;

/** 工作块对应的锚点 id。 */
export const chatBlockAnchorId = (blockId: string): string => `chat-anchor-b-${sanitizeAnchor(blockId)}`;

const toPreview = (text: string): string => {
    const normalized = text.replace(/\s+/gu, " ").trim();
    return normalized.length > PROMPT_PREVIEW_MAX
        ? `${normalized.slice(0, PROMPT_PREVIEW_MAX)}…`
        : normalized;
};

/**
 * 判断一个渲染节点是否是大纲里的「用户提问锚点」。
 * 只有用户消息才成锚点：Agent 的正文气泡太碎，全列进大纲等于没有目录。
 */
export const isPromptAnchorNode = (node: ChatNode): boolean => {
    return node.kind === "text" && node.message.type === "user";
};

/**
 * 把主时间线的渲染单元投影成大纲条目。
 *
 * `resolveNodeKey` 由渲染层注入（复用它的节点 key 规则），
 * 避免这里再维护一套 id 算法导致锚点对不上。
 */
export const buildChatOutline = (
    items: ChatFlowItem[],
    resolveNodeKey: (node: ChatNode) => string,
): ChatOutlineItem[] => {
    const outline: ChatOutlineItem[] = [];
    for (const item of items) {
        if (item.kind === "node") {
            if (!isPromptAnchorNode(item.node)) {
                continue;
            }
            const message = item.node.message;
            outline.push({
                kind: "prompt",
                anchorId: chatNodeAnchorId(resolveNodeKey(item.node)),
                messageId: message.id,
                preview: toPreview(message.content ?? ""),
                timestamp: message.timestamp ?? "",
            });
            continue;
        }
        outline.push({
            kind: "block",
            anchorId: chatBlockAnchorId(item.id),
            blockId: item.id,
            blockKind: item.blockKind,
            status: resolveBlockStatus(item),
            fileCount: item.filePaths.length,
            count: item.count,
            failedCount: item.nodes.filter((node) => isFailedToolCall(node.toolCall)).length,
        });
    }
    return outline;
};

/** 运行中优先于失败：还在跑的时候「失败」并不是结论。 */
const resolveBlockStatus = (block: Extract<ChatFlowItem, {kind: "block"}>): ChatOutlineStatus => {
    if (block.isRunning) {
        return "running";
    }
    if (block.hasFailure) {
        return "failed";
    }
    return "success";
};

/**
 * 找出当前应高亮的大纲行：以「最后一个已越过顶部的锚点」为准。
 *
 * 传入的是各锚点相对滚动容器的偏移量（已按 DOM 顺序排列），
 * 之所以不让调用方直接传 DOM，是为了让这段判定可以脱离浏览器单测。
 */
export const resolveActiveOutlineId = (
    offsets: Array<{id: string; top: number}>,
    activationLine: number,
): string => {
    let active = "";
    for (const entry of offsets) {
        if (entry.top <= activationLine) {
            active = entry.id;
        } else {
            break;
        }
    }
    return active || offsets[0]?.id || "";
};
