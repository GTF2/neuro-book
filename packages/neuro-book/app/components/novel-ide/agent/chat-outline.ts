import type {ChatNode} from "nbook/app/components/novel-ide/agent/agent-message";
import type {ChatFlowItem, ChatWorkBlockKind} from "nbook/app/components/novel-ide/agent/chat-work-blocks";
import {isFailedToolCall} from "nbook/app/components/novel-ide/agent/chat-work-blocks";

/** 大纲行的状态标记：成功绿、失败红、运行中蓝。 */
export type ChatOutlineStatus = "success" | "failed" | "running";

/**
 * 右侧大纲的一行。
 *
 * 一条完整对话在三类行里各留一条：用户提问（锚点）、Agent 回答、Agent 操作（工作块）。
 * 只列其中一类都会让大纲失去「目录」的意义——用户想找的是「我问了啥、他答了啥、他动了啥」。
 */
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
        kind: "answer";
        anchorId: string;
        messageId: string;
        /** 回答摘要；调用方负责在为空时兜底展示。 */
        preview: string;
        /** 仍在生成的回答：大纲上要能看出这条还没写完。 */
        running: boolean;
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

/**
 * 摘要上限。
 * 行内显示由 CSS 截断，这个上限只为防止超长正文把悬停提示撑成整屏；
 * 因此取得比「一行能显示的字数」宽松得多。
 */
const PREVIEW_MAX = 200;

/** 锚点 id 直接进 DOM，必须先剔除可能出现在消息 id 里的特殊字符。 */
const sanitizeAnchor = (value: string): string => value.replace(/[^A-Za-z0-9_-]/gu, "-");

/** 主时间线渲染节点对应的锚点 id，渲染层与大纲层共用，保证两边永远一致。 */
export const chatNodeAnchorId = (nodeKey: string): string => `chat-anchor-n-${sanitizeAnchor(nodeKey)}`;

/** 工作块对应的锚点 id。 */
export const chatBlockAnchorId = (blockId: string): string => `chat-anchor-b-${sanitizeAnchor(blockId)}`;

const toPreview = (text: string): string => {
    const normalized = text.replace(/\s+/gu, " ").trim();
    return normalized.length > PREVIEW_MAX
        ? `${normalized.slice(0, PREVIEW_MAX)}…`
        : normalized;
};

/**
 * 判断一个文本节点在大纲里扮演什么角色。
 *
 * 返回 null 的节点不占大纲行：目前只有「没有正文的 AI 节点」会命中，
 * 它们只是工具调用的载体，真正的信息由工作块那一行承担。
 */
export const resolveTextOutlineKind = (node: ChatNode): "prompt" | "answer" | null => {
    if (node.kind !== "text") {
        return null;
    }
    if (node.message.type === "user") {
        return "prompt";
    }
    if (node.message.type === "ai") {
        return node.message.content?.trim() ? "answer" : null;
    }
    return null;
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
            const textKind = resolveTextOutlineKind(item.node);
            if (!textKind) {
                continue;
            }
            const message = item.node.message;
            const anchorId = chatNodeAnchorId(resolveNodeKey(item.node));
            if (textKind === "prompt") {
                outline.push({
                    kind: "prompt",
                    anchorId,
                    messageId: message.id,
                    preview: toPreview(message.content ?? ""),
                    timestamp: message.timestamp ?? "",
                });
            } else {
                outline.push({
                    kind: "answer",
                    anchorId,
                    messageId: message.id,
                    preview: toPreview(message.content ?? ""),
                    running: message.status === "streaming",
                });
            }
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
