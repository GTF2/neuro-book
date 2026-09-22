import type {AgentToolCall, ChatNode} from "nbook/app/components/novel-ide/agent/agent-message";

/**
 * 工作块类别：决定图标与人话标题。world 为 009C1R2 件6 新增类别。
 * 只用工具元数据分类，不依赖 AI 生成——准确、零延迟、零成本。
 */
export type ChatWorkBlockKind = "explore" | "edit" | "command" | "database" | "web" | "world" | "agent";

/** 折叠节点：块内一定是工具节点，文本节点永远不进块。 */
export type ChatWorkBlockNode = Extract<ChatNode, {kind: "tool"}>;

/** 类别内按工具细分的计数项（件6 计数摘要数据）。 */
export type WorkToolCount = {
    toolName: string;
    count: number;
};

/**
 * 一轮 assistant 响应整体（009C1R2 件3）：聚合边界=相邻 user 消息之间的全部节点
 * （多段 assistant 正文+思考行+全部工具调用+非折叠交互卡），收进一个轮次块。
 */
export type ChatRoundItem = {
    kind: "round";
    /** 稳定 key：首尾节点 id。 */
    id: string;
    nodes: ChatNode[];
    /** 轮内是否有失败：失败轮默认展开。 */
    hasFailure: boolean;
    /** 轮内是否仍在跑：运行中不自动收起。 */
    isRunning: boolean;
    /** 首尾时间差（毫秒）；单条消息轮为 0（已开始但跨度未知），全缺时间戳为 null。 */
    durationMs: number | null;
    /** 轮内最早消息时间戳（毫秒）；运行中块头用它做「已工作」动态计时。 */
    startedAtMs: number | null;
    /** 轮内 AI 消息的模型名（块头身份信息）。 */
    modelLabel: string | null;
    /** 按类别汇总的工作量（收起态块头摘要用，≤3 类+等 N 次）。 */
    workByKind: Array<{kind: ChatWorkBlockKind; count: number}>;
    /** 当前类别下按工具细分计数（块头摘要/title 用）。 */
    toolCounts: WorkToolCount[];
    /** 轮内出现过的文件路径（去重有序）。 */
    filePaths: string[];
    /** 轮内文件路径计数。 */
    fileCount: number;
    /** 轮内工具调用总数。 */
    toolCount: number;
    /** save/write 族的首个目标资源名（title/path），摘要尾部展示。 */
    firstTarget: string | null;
};

/** 连续 system 注入收拢（009C1R2 件3g）：一行灰小字「系统上下文注入 ×N」。 */
export type ChatInjectionsItem = {
    kind: "injections";
    id: string;
    nodes: Extract<ChatNode, {kind: "text"}>[];
};

/** 主时间线渲染单元：user 节点 / system 收拢行 / 一轮工作块。 */
export type ChatFlowItem =
    | {kind: "node"; node: ChatNode}
    | ChatInjectionsItem
    | ChatRoundItem;

/**
 * 不折叠工具（009C1R2 件6 对照 buildAgentTools 46 工具全量核定；R5f 用户裁定调整）：
 * 交互与汇总类必须始终可见；取消类不参与过程行收拢。
 * create/invoke/detach_agent 原在代理生命周期白名单（R5f 移出）——拆书会话一次创建
 * 5 个子代理把消息流刷成噪音，用户要求与普通工具一样按轮聚合。
 */
const NON_BLOCKABLE_TOOL_NAMES: ReadonlySet<string> = new Set([
    "run_workflow",
    "request_user_input",
    "switch_mode",
    "report_result",
    "task_create",
    "task_set_status",
    "cancel_job",
]);

/** 工具名 → 工作块类别；未登记=不折叠。覆盖 buildAgentTools 除不折叠清单外的全部 36 个工具。 */
const WORK_KIND_BY_TOOL_NAME: Record<string, ChatWorkBlockKind> = {
    // explore 查阅（18）
    read: "explore",
    get_story_tree: "explore",
    get_story_thread: "explore",
    get_story_scene_context: "explore",
    get_scene_world_context: "explore",
    get_story_chapter: "explore",
    get_chapter_writer_brief: "explore",
    get_story_promise: "explore",
    get_story_decision: "explore",
    subject_rag_search: "explore",
    variable_read: "explore",
    variable_schema: "explore",
    list_jobs: "explore",
    get_job: "explore",
    list_workflows: "explore",
    get_agent: "explore",
    get_agent_profile: "explore",
    get_session: "explore",
    // edit 改稿（13）
    write: "edit",
    edit: "edit",
    apply_patch: "edit",
    save_story_act: "edit",
    save_story_chapter: "edit",
    save_story_thread: "edit",
    save_story_scene: "edit",
    save_story_promise: "edit",
    save_promise_beat: "edit",
    save_story_decision: "edit",
    variable_patch: "edit",
    subject_event_append: "edit",
    subject_memory_update: "edit",
    // command / database / web / world / agent
    bash: "command",
    execute_sql: "database",
    web_search: "web",
    web_fetch: "web",
    execute_world: "world",
    // [i18n-add] R5f 代理生命周期并入 agent 类别（拆书会话一次 5 个须聚合，用户裁定）
    create_agent: "agent",
    invoke_agent: "agent",
    detach_agent: "agent",
};

/** 最少两步才值得在摘要里单列细分；单步直接并入类别人话。 */
const MIN_DETAIL_COUNT = 2;

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

/** save/write 族目标资源名：强类型投影无 path 时从完整参数 JSON 取 title/name 兜底。 */
const resolveToolTargetName = (toolCall: AgentToolCall): string => {
    const path = resolveToolFilePath(toolCall);
    if (path) {
        return path;
    }
    if (resolveToolWorkKind(toolCall.name) !== "edit") {
        return "";
    }
    try {
        const raw = toolCall.argsJson ?? toolCall.argsText;
        if (!raw) {
            return "";
        }
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        for (const key of ["title", "name", "path", "chapterTitle", "threadTitle", "sceneTitle"]) {
            const value = parsed[key];
            if (typeof value === "string" && value.trim()) {
                return value.trim().slice(0, 24);
            }
        }
    } catch {
        // 参数非 JSON（流式半包）时无目标名，摘要省略。
    }
    return "";
};

const parseTimestampMs = (value: string | undefined): number | null => {
    if (!value) {
        return null;
    }
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
};

/** 轮内可折叠工具节点（供过程行渲染与展开态控制）。 */
export const isFoldableToolNode = (node: ChatNode): node is ChatWorkBlockNode => {
    return node.kind === "tool" && resolveToolWorkKind(node.toolCall.name) !== null;
};

const buildRound = (nodes: ChatNode[]): ChatRoundItem => {
    const toolNodes = nodes.filter(isFoldableToolNode);
    const toolCalls = toolNodes.map((node) => node.toolCall);
    const filePaths: string[] = [];
    let firstTarget = "";
    for (const toolCall of toolCalls) {
        const target = resolveToolTargetName(toolCall);
        if (target) {
            if (!firstTarget) {
                firstTarget = target;
            }
            if (target.includes("/") && !filePaths.includes(target)) {
                filePaths.push(target);
            }
        }
    }
    const kindCounts = new Map<ChatWorkBlockKind, number>();
    const toolCounts = new Map<string, number>();
    for (const toolCall of toolCalls) {
        const kind = resolveToolWorkKind(toolCall.name);
        if (kind) {
            kindCounts.set(kind, (kindCounts.get(kind) ?? 0) + 1);
        }
        toolCounts.set(toolCall.name, (toolCounts.get(toolCall.name) ?? 0) + 1);
    }
    const timestamps = nodes
        .map((node) => parseTimestampMs(node.message.timestamp))
        .filter((value): value is number => value !== null);
    const modelLabel = nodes.find((node) => node.kind === "text" && node.message.type === "ai" && node.message.model)?.message.model ?? null;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    return {
        kind: "round",
        id: `${first?.message.id ?? ""}::${last?.message.id ?? ""}`,
        nodes,
        hasFailure: toolCalls.some(isFailedToolCall),
        isRunning: nodes.some((node) => node.kind === "text" && node.message.status === "streaming")
            || toolCalls.some(isRunningToolCall),
        durationMs: timestamps.length > 0 ? Math.max(...timestamps) - Math.min(...timestamps) : null,
        startedAtMs: timestamps.length > 0 ? Math.min(...timestamps) : null,
        modelLabel,
        workByKind: [...kindCounts.entries()]
            .map(([kind, count]) => ({kind, count}))
            .sort((a, b) => b.count - a.count),
        toolCounts: [...toolCounts.entries()]
            .map(([toolName, count]) => ({toolName, count}))
            .sort((a, b) => b.count - a.count),
        filePaths,
        fileCount: filePaths.length,
        toolCount: toolCalls.length,
        firstTarget: firstTarget || null,
    };
};

const isSystemNode = (node: ChatNode): node is Extract<ChatNode, {kind: "text"}> => node.kind === "text" && node.message.type === "system";

/**
 * 把扁平渲染节点列表聚成「一轮工作块」序列（009C1R2 件3）。
 *
 * 聚合边界=相邻 user 消息之间的全部节点；user 消息本身与连续 system 注入
 * （件3g，≥2 条才收拢）作为独立渲染单元。开头无 user 前导的 AI/system 节点
 * 归入隐式轮，保证任意序列都有归属。
 */
export const groupChatNodesIntoBlocks = (nodes: ChatNode[]): ChatFlowItem[] => {
    const items: ChatFlowItem[] = [];
    let roundNodes: ChatNode[] = [];
    let systemRun: Extract<ChatNode, {kind: "text"}>[] = [];

    const flushSystemRun = () => {
        if (systemRun.length === 0) {
            return;
        }
        // 009C1R2 件3：开头批量注入与单条统一收拢（中途注入归轮，见循环内）。
        const first = systemRun[0]!;
        const last = systemRun[systemRun.length - 1]!;
        items.push({kind: "injections", id: `inj:${first.message.id}::${last.message.id}`, nodes: systemRun});
        systemRun = [];
    };

    const flushRound = () => {
        flushSystemRun();
        if (roundNodes.length === 0) {
            return;
        }
        items.push(buildRound(roundNodes));
        roundNodes = [];
    };

    for (const node of nodes) {
        if (node.kind === "text" && node.message.type === "user") {
            flushRound();
            items.push({kind: "node", node});
            continue;
        }
        if (isSystemNode(node)) {
            // 009C1R2 件3：中途补传的 system/CUSTOM 注入归入当前轮（不切断轮），
            // 渲染为轮内灰小字注入行；轮未开启时（会话开头）才走独立收拢行。
            if (roundNodes.length === 0) {
                systemRun.push(node);
                continue;
            }
            roundNodes.push(node);
            continue;
        }
        flushSystemRun();
        roundNodes.push(node);
    }
    flushRound();
    return items;
};

/** 工作块的图标与人话标题 key；标题文案由 i18n 提供，这里只做映射。 */
export const CHAT_WORK_BLOCK_META: Record<ChatWorkBlockKind, {icon: string; labelKey: string}> = {
    explore: {icon: "i-lucide-book-open-text", labelKey: "agent.workBlock.explore"},
    edit: {icon: "i-lucide-pencil", labelKey: "agent.workBlock.edit"},
    command: {icon: "i-lucide-terminal", labelKey: "agent.workBlock.command"},
    database: {icon: "i-lucide-database", labelKey: "agent.workBlock.database"},
    web: {icon: "i-lucide-globe", labelKey: "agent.workBlock.web"},
    world: {icon: "i-lucide-orbit", labelKey: "agent.workBlock.world"},
    agent: {icon: "i-lucide-bot", labelKey: "agent.workBlock.agent"},
};

/** 细分摘要里单列的工具短名（其余工具并入类别人话计数）；i18n 键 agent.workBlock.tool.*。 */
export const toolShortLabelKey = (toolName: string): string => `agent.workBlock.tool.${toolName}`;

/** 计数摘要细分上限：超出合并「等 N 次」（件6）。 */
export const WORK_DETAIL_LIMIT = 3;

/** 连续工具聚合门槛（R4 件2② 立为同名≥3；R5f 用户裁定：连 2 也收、异名同收、思考隔断即断）。 */
export const TOOL_GROUP_MIN = 2;

/** 轮内渲染分组（R4 件2 立规；R5f 扩展：连续任意工具 ≥2 且全终态聚合成单行，思考/正文隔断即断开单放）。 */
export type RoundEntry =
    | {kind: "node"; node: ChatNode}
    | {kind: "injectionGroup"; id: string; nodes: Extract<ChatNode, {kind: "text"}>[]; errorCount: number}
    | {kind: "toolGroup"; id: string; toolName: string | null; kinds: Array<{kind: ChatWorkBlockKind; count: number}>; nodes: ChatWorkBlockNode[]; failedCount: number};

const isSystemErrorNode = (node: Extract<ChatNode, {kind: "text"}>): boolean =>
    Boolean(node.message.error) || (node.message.systemDisplayKind ?? "system") === "error";

export const buildRoundEntries = (nodes: ChatNode[]): RoundEntry[] => {
    const entries: RoundEntry[] = [];
    let index = 0;
    while (index < nodes.length) {
        const node = nodes[index]!;
        if (node.kind === "text" && node.message.type === "system") {
            const group: Extract<ChatNode, {kind: "text"}>[] = [];
            while (index < nodes.length && nodes[index]!.kind === "text" && nodes[index]!.message.type === "system") {
                group.push(nodes[index] as Extract<ChatNode, {kind: "text"}>);
                index += 1;
            }
            // 单条保留现有注入行形态（009C1R3 件3 已过审）；≥2 才聚合为「系统上下文注入 ×N」。
            if (group.length >= 2) {
                const first = group[0]!;
                const last = group[group.length - 1]!;
                entries.push({
                    kind: "injectionGroup",
                    id: `injg:${first.message.id}::${last.message.id}`,
                    nodes: group,
                    errorCount: group.filter(isSystemErrorNode).length,
                });
            } else {
                for (const single of group) {
                    entries.push({kind: "node", node: single});
                }
            }
            continue;
        }
        if (isFoldableToolNode(node)) {
            const group: ChatWorkBlockNode[] = [];
            while (index < nodes.length) {
                const candidate = nodes[index]!;
                // R5f：异名同收——只要还是连续 foldable 工具就进组；中间隔思考/正文/注入即断开
                if (candidate.kind !== "tool" || !isFoldableToolNode(candidate)) {
                    break;
                }
                group.push(candidate);
                index += 1;
            }
            const allTerminal = group.every((entry) => !isRunningToolCall(entry.toolCall));
            if (group.length >= TOOL_GROUP_MIN && allTerminal) {
                const kindCounts = new Map<ChatWorkBlockKind, number>();
                for (const entry of group) {
                    const kind = resolveToolWorkKind(entry.toolCall.name) ?? "explore";
                    kindCounts.set(kind, (kindCounts.get(kind) ?? 0) + 1);
                }
                const names = new Set(group.map((entry) => entry.toolCall.name));
                entries.push({
                    kind: "toolGroup",
                    id: `toolg:${names.size === 1 ? group[0]!.toolCall.name : "mixed"}::${group[0]!.toolCall.id ?? "0"}::${group.length}`,
                    toolName: names.size === 1 ? group[0]!.toolCall.name : null,
                    kinds: [...kindCounts.entries()]
                        .map(([kind, count]) => ({kind, count}))
                        .sort((a, b) => b.count - a.count),
                    nodes: group,
                    failedCount: group.filter((entry) => isFailedToolCall(entry.toolCall)).length,
                });
            } else {
                for (const single of group) {
                    entries.push({kind: "node", node: single});
                }
            }
            continue;
        }
        entries.push({kind: "node", node});
        index += 1;
    }
    return entries;
};
