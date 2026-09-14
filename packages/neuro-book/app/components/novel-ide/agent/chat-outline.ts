import type {AgentToolCall, ChatNode} from "nbook/app/components/novel-ide/agent/agent-message";
import type {ChatFlowItem, ChatWorkBlockKind, ChatWorkBlockNode} from "nbook/app/components/novel-ide/agent/chat-work-blocks";
import type {PublicValuePreviewDto} from "nbook/shared/dto/agent-public-event.dto";
import {
    isFailedToolCall,
    resolveToolFilePath,
    resolveToolWorkKind,
} from "nbook/app/components/novel-ide/agent/chat-work-blocks";

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
        /**
         * 这一步「大概在干什么」：文件名、命令、SQL 或 URL。
         * 放大镜只有两三行位置，只报「操作」两个字看不出内容。
         */
        detail: string;
    };

/**
 * 摘要上限。
 * 行内显示由 CSS 截断，这个上限只为防止超长正文把悬停提示撑成整屏；
 * 因此取得比「一行能显示的字数」宽松得多。
 */
const PREVIEW_MAX = 200;

/** 操作详情上限：够说清「动了哪个文件 / 跑了什么命令 / 为什么失败」即可。 */
const DETAIL_MAX = 120;

/**
 * generic 参数里最像「这一步在干什么」的键，按可信度排序。
 * 未知工具的公开参数只有有界结构预览，所以先按键名挑，都不匹配再退回第一个字符串字段。
 */
const DETAIL_KEYS = [
    "command",
    "sql",
    "query",
    "url",
    "path",
    "filePath",
    "file_path",
    "pattern",
    "goal",
    "prompt",
    "summary",
    "title",
    "name",
    "text",
];

const shortenDetail = (text: string): string => {
    const normalized = text.replace(/\s+/gu, " ").trim();
    return normalized.length > DETAIL_MAX ? `${normalized.slice(0, DETAIL_MAX)}…` : normalized;
};

/**
 * 从有界结构预览里挑一句能说明内容的话。
 *
 * 顺序：可信键名的字符串 → 任意字符串 → 数字标量。
 * 最后一档是必需的：有些工具的公开参数**全是数字或布尔**（例如 get_session 的
 * sessionId / tokenBudget / recentMessageLimit），只认字符串会让这类条目在放大镜里一片空白。
 */
const pickGenericDetail = (value: PublicValuePreviewDto): string => {
    if (value.kind === "string") {
        return value.preview;
    }
    if (value.kind !== "object") {
        return "";
    }
    for (const key of DETAIL_KEYS) {
        const entry = value.entries.find((item) => item.key === key);
        if (entry?.value.kind === "string" && entry.value.preview.trim()) {
            return entry.value.preview;
        }
    }
    for (const entry of value.entries) {
        if (entry.value.kind === "string" && entry.value.preview.trim()) {
            return entry.value.preview;
        }
    }
    // 数字带上键名：光一个「2」看不出是什么，`sessionId=23` 才知道这一步在查谁。
    // 布尔直接跳过 —— `includeRecentMessages=true` 这类说不清在干什么，加键名也救不回来。
    for (const entry of value.entries) {
        if (entry.value.kind === "number") {
            return `${entry.key}=${String(entry.value.value)}`;
        }
    }
    return "";
};

/**
 * 一步操作最能说明内容的那句话。
 *
 * 失败的一步先亮失败原因 —— 这时候「动了哪个文件」不是重点，为什么没成功才是。
 * 这段刻意放在 publicArgs 判空之前：错误信息与公开参数无关，
 * 有些失败调用根本没走到参数投影那一步。
 *
 * 其余情况只挑一个字段：文件名优先，其次是命令 / SQL / URL。
 * 完整内容仍在主时间线的工具卡片里，这里只负责「让人认得出这一步」。
 */
export const resolveToolDetail = (toolCall: AgentToolCall): string => {
    if (isFailedToolCall(toolCall) && toolCall.error) {
        return shortenDetail(toolCall.error);
    }
    const args = toolCall.publicArgs;
    if (!args) {
        return "";
    }
    if (args.kind === "write" || args.kind === "edit") {
        return shortenDetail(args.path ?? "");
    }
    if (args.kind === "apply_patch") {
        const [first] = args.touchedFiles;
        return shortenDetail(first ?? "");
    }
    return shortenDetail(pickGenericDetail(args.value));
};

/**
 * 一个工作块最能说明内容的那一步。
 *
 * 优先取失败的那一步：错误信息最该被看到，而按顺序取第一个会把失败原因
 * 压在成功步骤的文件名后面。只有失败那步什么都说不出时，才退回顺序找第一个。
 */
const resolveBlockDetail = (nodes: ChatWorkBlockNode[]): string => {
    const failed = nodes.find((node) => isFailedToolCall(node.toolCall));
    if (failed) {
        const detail = resolveToolDetail(failed.toolCall);
        if (detail) {
            return detail;
        }
    }
    for (const node of nodes) {
        const detail = resolveToolDetail(node.toolCall);
        if (detail) {
            return detail;
        }
    }
    return "";
};

/** 锚点 id 直接进 DOM，必须先剔除可能出现在消息 id 里的特殊字符。 */
const sanitizeAnchor = (value: string): string => value.replace(/[^A-Za-z0-9_-]/gu, "-");

/** 主时间线渲染节点对应的锚点 id，渲染层与大纲层共用，保证两边永远一致。 */
export const chatNodeAnchorId = (nodeKey: string): string => `chat-anchor-n-${sanitizeAnchor(nodeKey)}`;

/** 工作块对应的锚点 id。 */
export const chatBlockAnchorId = (blockId: string): string => `chat-anchor-b-${sanitizeAnchor(blockId)}`;

/**
 * 大纲只显示内容本身，不显示 Markdown 标记。
 * 直接把 `**粗体**`、`##` 这类语法摆进目录，整列会变成一堆星号和井号。
 */
const stripMarkdown = (text: string): string => text
    // 代码围栏与行内代码：留内容去标记
    .replace(/```[^\n]*\n?/gu, "")
    .replace(/`([^`]*)`/gu, "$1")
    // 图片与链接：只留可读文本
    .replace(/!\[([^\]]*)\]\([^)]*\)/gu, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/gu, "$1")
    // 强调标记
    .replace(/\*\*([^*]*)\*\*/gu, "$1")
    .replace(/__([^_]*)__/gu, "$1")
    .replace(/(^|[^*])\*([^*\n]+)\*/gu, "$1$2")
    // 行首的标题、列表、引用、有序列表符号
    .replace(/^[ \t]{0,3}#{1,6}[ \t]+/gmu, "")
    .replace(/^[ \t]{0,3}[-*+][ \t]+/gmu, "")
    .replace(/^[ \t]{0,3}>[ \t]?/gmu, "")
    .replace(/^[ \t]{0,3}\d+[.)][ \t]+/gmu, "");

const toPreview = (text: string): string => {
    const normalized = stripMarkdown(text).replace(/\s+/gu, " ").trim();
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
            if (textKind) {
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
            // 单步操作同样只有失败才进大纲。
            if (item.node.kind === "tool") {
                const action = buildActionOutlineItem(item.node.toolCall, resolveNodeKey(item.node));
                if (action.status === "failed") {
                    outline.push(action);
                }
            }
            continue;
        }
        // 跑完的自动化步骤不进目录：大纲要回答的是「我问了啥、他答了啥、哪一步出问题了」。
        // 正常步骤在主时间线里本来就已经收拢成一行，再列一遍只会把对话本身淹掉。
        const blockStatus = resolveBlockStatus(item);
        if (blockStatus !== "failed") {
            continue;
        }
        outline.push({
            kind: "block",
            anchorId: chatBlockAnchorId(item.id),
            blockId: item.id,
            blockKind: item.blockKind,
            status: blockStatus,
            fileCount: item.filePaths.length,
            count: item.count,
            failedCount: item.nodes.filter((node) => isFailedToolCall(node.toolCall)).length,
            detail: resolveBlockDetail(item.nodes),
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
 * 单个工具调用的大纲行。
 *
 * 复用了 block 的形状（计数恒为 1），这样列表侧不需要为「单步操作」写第二套渲染；
 * 未登记类别的工具归到 other，避免失败的那一步因为认不出类别而漏出目录。
 */
const buildActionOutlineItem = (
    toolCall: AgentToolCall,
    nodeKey: string,
): Extract<ChatOutlineItem, {kind: "block"}> => {
    const failed = isFailedToolCall(toolCall);
    const running = toolCall.status === "running" || toolCall.status === "streaming";
    return {
        kind: "block",
        anchorId: chatNodeAnchorId(nodeKey),
        blockId: nodeKey,
        blockKind: resolveToolWorkKind(toolCall.name) ?? "other",
        status: running ? "running" : failed ? "failed" : "success",
        fileCount: resolveToolFilePath(toolCall) ? 1 : 0,
        count: 1,
        failedCount: failed ? 1 : 0,
        detail: resolveToolDetail(toolCall),
    };
};


/**
 * 刻度列上的位置换算成整段对话的进度：顶部 0、底部 1。
 *
 * 拖动刻度列时用它按比例滚动——这才是「整段对话的抓手」，
 * 比内容极长时那几像素高的滚动条滑块好抓得多。
 */
export const resolveOutlineScrubRatio = (
    pointerY: number,
    railTop: number,
    railHeight: number,
): number => {
    if (railHeight <= 0) {
        return 0;
    }
    return Math.min(1, Math.max(0, (pointerY - railTop) / railHeight));
};

/**
 * 鼠标所指那一条两侧的长度加成，按距离递减。
 *
 * 只把鼠标正对的那一条拉长会显得很跳；按距离做一档一档的回落，
 * 扫过去时看到的是一道波峰经过，而不是某一条突然弹出来。
 */
export const OUTLINE_WAVE_BOOST: readonly number[] = [10, 5, 2];

/** 某一条当前的波浪加成：距离鼠标所指越远越小，超出范围就不加成。 */
export const resolveOutlineWaveBoost = (index: number, hoveredIndex: number): number => {
    if (hoveredIndex < 0) {
        return 0;
    }
    return OUTLINE_WAVE_BOOST[Math.abs(index - hoveredIndex)] ?? 0;
};

/** 刻度总高塞不满容器时上下留白居中；塞满或塞不下时不再留白。 */
export const resolveOutlineRailPadTop = (railHeight: number, count: number, step: number): number =>
    Math.max(0, Math.round((railHeight - count * step) / 2));

/**
 * 放大镜窗口的纵向位置：让窗口中心对齐鼠标，再整体限制在指示条范围内。
 *
 * 单独抽出来是因为「跟手但不越界」是这个交互唯一需要算准的地方：
 * 少了 clamp，鼠标滑到上下两端时窗口会贴着边缘跳。
 */
export const resolveOutlineLensTop = (
    pointerOffset: number,
    railHeight: number,
    lensHeight: number,
): number => {
    const maxTop = Math.max(0, railHeight - lensHeight);
    return Math.min(Math.max(pointerOffset - lensHeight / 2, 0), maxTop);
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
