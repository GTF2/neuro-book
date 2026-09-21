import type {AgentToolCall, ChatNode} from "nbook/app/components/novel-ide/agent/agent-message";

/**
 * 工作块类别：决定图标与人话标题（009单C批次1，行为规格源自旧库 44eeb913 按新库重写）。
 * 只用工具元数据分类，不依赖 AI 生成——准确、零延迟、零成本。
 */
export type ChatWorkBlockKind = "explore" | "edit" | "command" | "database" | "web";

/** 折叠节点：块内一定是工具节点，文本节点永远不进块。 */
export type ChatWorkBlockNode = Extract<ChatNode, {kind: "tool"}>;

/** 主时间线的渲染单元：要么是单个节点，要么是一个收拢的工作块。 */
export type ChatFlowItem =
    | {kind: "node"; node: ChatNode}
    | {
        kind: "block";
        /** 稳定 key：首尾工具调用 id，重新投影时保持同一块。 */
        id: string;
        blockKind: ChatWorkBlockKind;
        nodes: ChatWorkBlockNode[];
        /** 块内是否有失败：失败块必须默认展开，不能藏进一行里。 */
        hasFailure: boolean;
        /** 块内是否仍在跑：运行中的块显示转圈且不自动收起。 */
        isRunning: boolean;
        /** 块内出现过的文件路径（去重、保持顺序），用于「6 个文件」这类摘要。 */
        filePaths: string[];
        /** 块内出现过的工具名（去重），用于摘要与图标选择。 */
        toolNames: string[];
        /** 块内工具调用总数。 */
        count: number;
    };

/**
 * 这些工具不进工作块（新库 2026-09-21 实查注册表核对）：
 * - run_workflow 保留旧库条目防回潮（新库暂无此工具）；
 * - request_user_input / switch_mode 需要用户交互，必须始终可见；
 * - task_create / task_set_status 本身就是汇总清单，再折一层没有意义。
 * subject_* 与 agent 协作族（create_agent/invoke_agent 等）未登记＝不折叠，保守起见保持可见。
 */
const NON_BLOCKABLE_TOOL_NAMES: ReadonlySet<string> = new Set([
    "run_workflow",
    "request_user_input",
    "switch_mode",
    "task_create",
    "task_set_status",
]);

/** 工具名 → 工作块类别。未登记的工具返回 null，即不参与折叠。 */
const WORK_KIND_BY_TOOL_NAME: Record<string, ChatWorkBlockKind> = {
    read: "explore",
    edit: "edit",
    write: "edit",
    apply_patch: "edit",
    bash: "command",
    execute_sql: "database",
    web_search: "web",
    web_fetch: "web",
};

/** 最少两步才值得收拢：单个步骤折成一行反而多一次点击。 */
const MIN_BLOCK_SIZE = 2;

/** 解析工具所属的工作块类别；返回 null 表示该工具不参与折叠。 */
export const resolveToolWorkKind = (toolName: string): ChatWorkBlockKind | null => {
    if (NON_BLOCKABLE_TOOL_NAMES.has(toolName)) {
        return null;
    }
    return WORK_KIND_BY_TOOL_NAME[toolName] ?? null;
};

/** 失败判定：与工具卡片头部使用的语义保持一致。 */
export const isFailedToolCall = (toolCall: AgentToolCall): boolean => {
    return toolCall.status === "error" || toolCall.status === "invalid";
};

const isRunningToolCall = (toolCall: AgentToolCall): boolean => {
    return toolCall.status === "running" || toolCall.status === "streaming";
};

/** 从公开参数投影里取该次调用涉及的文件路径；非文件类工具返回空串。 */
const resolveToolFilePath = (toolCall: AgentToolCall): string => {
    const args = toolCall.publicArgs;
    if (args?.kind === "write" || args?.kind === "edit") {
        return args.path ?? "";
    }
    if (args?.kind === "apply_patch") {
        return args.touchedFiles[0] ?? "";
    }
    return "";
};

const buildBlock = (blockKind: ChatWorkBlockKind, nodes: ChatWorkBlockNode[]) => {
    const toolCalls = nodes.map((node) => node.toolCall);
    const filePaths: string[] = [];
    for (const toolCall of toolCalls) {
        const path = resolveToolFilePath(toolCall);
        if (path && !filePaths.includes(path)) {
            filePaths.push(path);
        }
    }
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    return {
        kind: "block" as const,
        // 首尾 id 已经能唯一确定这一段；用它们而不是索引，避免重新投影时整列重建。
        id: `${first?.toolCall.id ?? ""}::${last?.toolCall.id ?? ""}`,
        blockKind,
        nodes,
        hasFailure: toolCalls.some(isFailedToolCall),
        isRunning: toolCalls.some(isRunningToolCall),
        filePaths,
        toolNames: [...new Set(toolCalls.map((toolCall) => toolCall.name))],
        count: toolCalls.length,
    };
};

/**
 * 把扁平的渲染节点列表聚成「连续同类步骤」的工作块。
 *
 * 只合并相邻的同类工具节点：中间隔了文本或别的类别就断开，
 * 这样块与用户实际看到的执行顺序一致，不会把不相关的步骤混在一起。
 */
export const groupChatNodesIntoBlocks = (nodes: ChatNode[]): ChatFlowItem[] => {
    const items: ChatFlowItem[] = [];
    let cursor = 0;
    while (cursor < nodes.length) {
        const node = nodes[cursor];
        if (!node) {
            cursor += 1;
            continue;
        }
        const workKind = node.kind === "tool" ? resolveToolWorkKind(node.toolCall.name) : null;
        if (node.kind !== "tool" || !workKind) {
            items.push({kind: "node", node});
            cursor += 1;
            continue;
        }
        const group: ChatWorkBlockNode[] = [];
        let probe = cursor;
        while (probe < nodes.length) {
            const candidate = nodes[probe];
            if (candidate?.kind !== "tool" || resolveToolWorkKind(candidate.toolCall.name) !== workKind) {
                break;
            }
            group.push(candidate);
            probe += 1;
        }
        if (group.length < MIN_BLOCK_SIZE) {
            for (const item of group) {
                items.push({kind: "node", node: item});
            }
        } else {
            items.push(buildBlock(workKind, group));
        }
        cursor = probe;
    }
    return items;
};

/** 工作块的图标与人话标题 key；标题文案由 i18n 提供，这里只做映射。 */
export const CHAT_WORK_BLOCK_META: Record<ChatWorkBlockKind, {icon: string; labelKey: string}> = {
    explore: {icon: "i-lucide-book-open-text", labelKey: "agent.workBlock.explore"},
    edit: {icon: "i-lucide-pencil", labelKey: "agent.workBlock.edit"},
    command: {icon: "i-lucide-terminal", labelKey: "agent.workBlock.command"},
    database: {icon: "i-lucide-database", labelKey: "agent.workBlock.database"},
    web: {icon: "i-lucide-globe", labelKey: "agent.workBlock.web"},
};
