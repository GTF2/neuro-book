<script setup lang="ts">
import type { AgentMessage, AgentMessageSwitcherState, AgentToolCall, ChatNode } from "nbook/app/components/novel-ide/agent/agent-message";
import { toChatNodes } from "nbook/app/components/novel-ide/agent/agent-message";
import AgentTextBubble from "nbook/app/components/novel-ide/agent/AgentTextBubble.vue";
import AgentToolBubble from "nbook/app/components/novel-ide/agent/AgentToolBubble.vue";
import AgentWorkBlock from "nbook/app/components/novel-ide/agent/AgentWorkBlock.vue";
import AgentSessionScaleBar, {type AgentSessionScaleSegment} from "nbook/app/components/novel-ide/agent/AgentSessionScaleBar.vue";
import {buildRoundEntries, groupChatNodesIntoBlocks, isFoldableToolNode, toolShortLabelKey, type ChatFlowItem, type ChatRoundItem, type RoundEntry} from "nbook/app/components/novel-ide/agent/chat-work-blocks";
import type {CostDisplayOptions} from "nbook/app/utils/cost-format";
import type {AgentSessionAttachmentItemDto} from "nbook/shared/dto/agent-session.dto";
import type {
    AgentTriggerMenuContext,
    AgentTriggerMenuState,
} from "nbook/app/components/novel-ide/agent/trigger-menu";
import {
    prependAnchoredScrollTop,
    shouldAutoScrollChat,
    shouldLoadPreviousHistory,
} from "nbook/app/components/novel-ide/agent/agent-chat-history-ui";

const AUTO_SCROLL_RELEASE_THRESHOLD_PX = 12;

const props = defineProps<{
    /** 消息列表。 */
    messages: AgentMessage[];
    /** 当前 session ID；变化时认为是整段历史切换，需要立即定位到底部。 */
    sessionId?: number | null;
    /** 有可用对话但尚未选择时，显示选择提示而不是伪装成空历史。 */
    unselected?: boolean;
    /** 是否正在执行中。 */
    running: boolean;
    /** 模式区分。main 显示空状态引导，compact 显示简洁空状态。 */
    mode: "main" | "compact";
    /** 当前处于编辑态的消息 ID。 */
    editingMessageId?: string | null;
    /** 当前编辑消息的完整 Markdown；可能来自按需 user-content 请求。 */
    editingMessageText?: string;
    /** 是否禁用消息工具栏动作。 */
    messageActionDisabled?: boolean;
    /** 是否禁用会重新触发运行的消息动作。 */
    runActionDisabled?: boolean;
    /** 当前是否正在提交编辑。 */
    savingEdit?: boolean;
    sessionAttachments: AgentSessionAttachmentItemDto[];
    canRegisterAttachments: boolean;
    canInsertAttachments: boolean;
    projectRoot: string | null;
    modelSupportsImages: boolean;
    attachmentInsertRequest?: {id: number; item: AgentSessionAttachmentItemDto} | null;
    /** 消息级分支切换状态，按承载切换器的气泡 id 建索引。 */
    branchSwitcherStateByMessageId?: Record<string, AgentMessageSwitcherState>;
    /** 编辑器触发菜单刷新 key。 */
    menuRefreshKey?: string | number;
    /** 编辑器触发菜单解析器。 */
    resolveEditorMenu?: (context: AgentTriggerMenuContext) => AgentTriggerMenuState;
    /** 编辑器触发技能菜单时的刷新钩子。 */
    onEditorSkillTriggerStart?: () => void;
    /** 打开消息 Markdown 中的 workspace 引用。 */
    openReference?: (target: string) => void;
    /** 费用显示币种与汇率。 */
    costDisplayOptions: CostDisplayOptions;
    /** 费用 tooltip 汇率说明。 */
    costExchangeRateSuffix?: string;
    /** 当前 durable history 是否还有更早一页。 */
    historyHasPrevious?: boolean;
    /** 是否正在加载更早历史。 */
    historyLoading?: boolean;
    /** 更早历史的局部加载错误。 */
    historyError?: string;
}>();

const emit = defineEmits<{
    (e: "copy", message: AgentMessage): void;
    (e: "copy-tool", toolCall: AgentToolCall): void;
    (e: "start-edit", message: AgentMessage): void;
    (e: "cancel-edit", message: AgentMessage): void;
    (e: "save-edit", payload: {message: AgentMessage; content: string}): void;
    (e: "retry", message: AgentMessage): void;
    /** 从这条消息新开一条分支；只移动 active leaf，不删除任何历史。 */
    (e: "branch-from-here", message: AgentMessage): void;
    (e: "cycle-branch", payload: {messageId: string; direction: -1 | 1}): void;
    (e: "load-previous"): void;
    (e: "attachment-registered", item: AgentSessionAttachmentItemDto): void;
    (e: "resend-unknown", message: AgentMessage): void;
    (e: "dismiss-unknown", message: AgentMessage): void;
    /** 刻度条「查看全部」：宿主打开完整会话树。 */
    (e: "expand-session-tree"): void;
}>();

const scrollRef = ref<HTMLDivElement | null>(null);
const shouldStickToBottom = ref(true);
const lastScrollTop = ref(0);
let pendingImmediateScroll = true;
let autoScrollFrame: number | null = null;
let pendingPrependAnchor: {
    sessionId: number | null;
    firstMessageId: string;
    scrollHeight: number;
    scrollTop: number;
} | null = null;
const {t} = useI18n();

const chatNodes = computed(() => {
    return toChatNodes(props.messages);
});

/** 主时间线渲染单元：相邻 user 消息之间的全部节点聚成轮次块（009C1R2 件3）。 */
const flowItems = computed(() => groupChatNodesIntoBlocks(chatNodes.value));

/** 轮展开态（件3b）：历史轮默认收起过程行，运行中/失败轮默认展开；用户 toggle 后固定。 */
const roundExpandedOverrides = ref<Record<string, boolean>>({});
const isRoundExpanded = (round: ChatRoundItem): boolean => {
    const overridden = roundExpandedOverrides.value[round.id];
    if (typeof overridden === "boolean") {
        return overridden;
    }
    return round.isRunning || round.hasFailure;
};
const toggleRound = (round: ChatRoundItem): void => {
    roundExpandedOverrides.value = {...roundExpandedOverrides.value, [round.id]: !isRoundExpanded(round)};
};

/** 注入收拢行展开态（件3g）。 */
const injectionsOpenMap = ref<Record<string, boolean>>({});
const isInjectionsOpen = (item: {id: string}): boolean => Boolean(injectionsOpenMap.value[item.id]);
const toggleInjections = (item: {id: string}): void => {
    injectionsOpenMap.value = {...injectionsOpenMap.value, [item.id]: !injectionsOpenMap.value[item.id]};
};

/** 判断文本节点是否包含正文。 */
const hasTextBubbleContent = (node: ChatNode): boolean => {
    if (node.kind !== "text") {
        return false;
    }
    return Boolean(node.message.content.trim() || node.message.contentBlocks?.length || node.message.attachments?.length);
};

/** R4 件2：轮内渲染分组——连续 system 注入聚合、连续同名工具≥3 聚合；收起态过滤过程组。 */
const roundEntryOpenMap = ref<Record<string, boolean>>({});
const isRoundEntryOpen = (id: string): boolean => Boolean(roundEntryOpenMap.value[id]);
const toggleRoundEntry = (id: string): void => {
    roundEntryOpenMap.value = {...roundEntryOpenMap.value, [id]: !roundEntryOpenMap.value[id]};
};
const visibleRoundEntries = (round: ChatRoundItem): RoundEntry[] => {
    const entries = buildRoundEntries(round.nodes);
    if (isRoundExpanded(round)) {
        return entries;
    }
    return entries.filter((entry) => {
        if (entry.kind === "injectionGroup") {
            return false;
        }
        if (entry.kind === "toolGroup") {
            return false;
        }
        if (entry.node.kind === "tool") {
            return !isFoldableToolNode(entry.node);
        }
        return entry.node.message.type !== "system";
    });
};

/** R5 件7：注入条目统一灰小字行的类型前缀与单行摘要（system reminder 与 CUSTOM:USER 同款，差异仅前缀）。 */
const injectionLabelPrefix = (node: Extract<ChatNode, {kind: "text"}>): string => {
    if (node.message.systemLabel) {
        return node.message.systemLabel;
    }
    const kind = node.message.systemDisplayKind ?? "system";
    if (kind === "error") {
        return t("agent.workBlock.injectionPrefixError");
    }
    if (kind === "reminder") {
        return t("agent.workBlock.injectionPrefixReminder");
    }
    return t("agent.workBlock.injectionPrefixSystem");
};
const injectionSummary = (node: Extract<ChatNode, {kind: "text"}>): string => {
    return node.message.content.trim().replace(/\s+/gu, " ").slice(0, 60);
};

/** 悬浮按钮组只在轮尾最后一段正文后渲染一次（件3c）。 */
const isActionsHost = (round: ChatRoundItem, node: ChatNode): boolean => {
    const host = [...round.nodes].reverse().find((candidate) => candidate.kind === "text" && hasTextBubbleContent(candidate));
    return host === node;
};

/**
 * 刻度条格序列：flowItems 均分聚合封顶 50 格；anchorIndex=格首 flowItem 序号；
 * summary=格内首个可读文本；weight=体量（轮内节点数），驱动刻度线长短分级（件2a）。
 */
const SCALE_SEGMENT_LIMIT = 50;
const flowItemSummary = (item: ChatFlowItem): string => {
    if (item.kind === "round") {
        const first = item.nodes.find((node) => node.kind === "text" && node.message.content.trim());
        return first ? first.message.content.trim().replace(/\s+/gu, " ").slice(0, 40) : "";
    }
    if (item.kind === "injections") {
        return t("agent.workBlock.injections", {count: item.nodes.length});
    }
    if (item.node.kind === "text") {
        return item.node.message.content.trim().replace(/\s+/gu, " ").slice(0, 40);
    }
    return "";
};
const flowItemWeight = (item: ChatFlowItem): number => {
    if (item.kind === "round" || item.kind === "injections") {
        return item.nodes.length;
    }
    return 1;
};
const scaleSegments = computed<AgentSessionScaleSegment[]>(() => {
    if (props.mode !== "main") {
        return [];
    }
    // 009C1R2 件5：刻度格只聚合对话项（user 消息与轮），系统注入/独立工具项不进格；
    // anchorIndex 保留原 flowItems 下标供 seek 直接定位。
    const dialogItems = flowItems.value
        .map((item, index) => ({item, index}))
        .filter(({item}) => item.kind === "round" || (item.kind === "node" && item.node.kind === "text" && item.node.message.type === "user"));
    if (dialogItems.length === 0) {
        return [];
    }
    const perSegment = Math.max(1, Math.ceil(dialogItems.length / SCALE_SEGMENT_LIMIT));
    const segments: AgentSessionScaleSegment[] = [];
    for (let start = 0; start < dialogItems.length; start += perSegment) {
        const first = dialogItems[start]!;
        let summary = "";
        let weight = 0;
        for (let probe = start; probe < Math.min(start + perSegment, dialogItems.length); probe += 1) {
            const entry = dialogItems[probe]!;
            weight += flowItemWeight(entry.item);
            if (!summary) {
                summary = flowItemSummary(entry.item);
            }
        }
        const anchorIndex = first.index;
        if (!summary) {
            summary = t("agent.chat.scaleSegmentFallback", {from: start + 1, to: Math.min(start + perSegment, dialogItems.length)});
        }
        segments.push({id: `scale-${anchorIndex}`, summary, anchorIndex, weight});
    }
    return segments;
});
/** 可视区首个 flowItem 序号；滚动时节流更新供刻度条高亮。 */
const visibleFlowIndex = ref(0);
let visibleAnchorScanAt = 0;

/** 轻量追踪最后一条消息的渲染尺寸变化，避免 deep watch 扫描整棵消息树。 */
const messageScrollSignature = computed(() => {
    const lastMessage = props.messages.at(-1);
    const lastToolCall = lastMessage?.toolCalls?.at(-1);
    return [
        props.messages.length,
        lastMessage?.id ?? "",
        lastMessage?.status ?? "",
        lastMessage?.content.length ?? 0,
        lastMessage?.thinking?.length ?? 0,
        lastToolCall?.id ?? "",
        lastToolCall?.status ?? "",
        lastToolCall?.argsText.length ?? 0,
        lastToolCall?.result?.length ?? 0,
    ].join(":");
});

const getNodeKey = (node: ReturnType<typeof toChatNodes>[0]) => {
    if (node.kind === 'tool') return `${node.message.id}-${node.toolCall.id}`;
    return `${node.message.id}-text`;
};

/** 渲染单元 key：轮/收拢行用首尾 id 稳定标识，节点沿用消息 id 组合。 */
const getFlowItemKey = (item: ChatFlowItem) => {
    if (item.kind === "round") {
        return `round-${item.id}`;
    }
    if (item.kind === "injections") {
        return `inj-${item.id}`;
    }
    return getNodeKey(item.node);
};

/** 渲染单元间距（件3e）：轮与轮/用户消息之间 16px，收拢行并入同档，轮内节点间距由轮体循环控制（8px）。 */
const flowItemSpacingClass = (index: number): string => {
    return index === 0 ? "" : "mt-4";
};

/** 是否接近底部。 */
const isNearBottom = (thresholdPx = AUTO_SCROLL_RELEASE_THRESHOLD_PX): boolean => {
    if (!scrollRef.value) return false;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.value;
    return scrollHeight - (scrollTop + clientHeight) <= thresholdPx;
};

/** 滚动到底部。 */
const scrollToBottom = (): void => {
    if (!scrollRef.value) return;
    scrollRef.value.scrollTop = scrollRef.value.scrollHeight;
    lastScrollTop.value = scrollRef.value.scrollTop;
};

/** 取消下一帧的自动吸底任务。 */
const cancelScheduledScrollToBottom = (): void => {
    if (autoScrollFrame !== null) {
        if (typeof cancelAnimationFrame === "function") {
            cancelAnimationFrame(autoScrollFrame);
        }
        autoScrollFrame = null;
    }
};

/** 把自动吸底合并到下一帧，减少流式输出时的布局读取/写入抖动。 */
const scheduleScrollToBottom = (): void => {
    if (autoScrollFrame !== null) {
        return;
    }
    if (typeof requestAnimationFrame !== "function") {
        if (shouldStickToBottom.value) {
            scrollToBottom();
        }
        return;
    }
    autoScrollFrame = requestAnimationFrame(() => {
        autoScrollFrame = null;
        if (shouldStickToBottom.value) {
            scrollToBottom();
        }
    });
};

/**
 * 记录 prepend 前的滚动快照，并请求更早 durable history。
 * cursor 去重与 revision 校验由 session state 统一负责。
 */
const requestPreviousHistory = (): void => {
    if (!scrollRef.value || !props.historyHasPrevious || props.historyLoading) {
        return;
    }
    const firstMessageId = props.messages[0]?.id;
    if (!firstMessageId) {
        return;
    }
    pendingPrependAnchor = {
        sessionId: props.sessionId ?? null,
        firstMessageId,
        scrollHeight: scrollRef.value.scrollHeight,
        scrollTop: scrollRef.value.scrollTop,
    };
    cancelScheduledScrollToBottom();
    emit("load-previous");
};

/** 滚动事件处理。 */
/** 滚动时节流扫描可视区第一个渲染单元元素，更新刻度条高亮锚。 */
function updateVisibleFlowIndex(): void {
    const now = Date.now();
    if (now - visibleAnchorScanAt < 200) {
        return;
    }
    visibleAnchorScanAt = now;
    const container = scrollRef.value;
    if (!container) {
        return;
    }
    const containerTop = container.getBoundingClientRect().top;
    const nodes = container.querySelectorAll<HTMLElement>("[data-flow-index]");
    for (const node of nodes) {
        if (node.getBoundingClientRect().bottom > containerTop) {
            const parsed = Number.parseInt(node.dataset.flowIndex ?? "", 10);
            if (Number.isFinite(parsed)) {
                visibleFlowIndex.value = parsed;
            }
            return;
        }
    }
}

/** 刻度条 seek 定位：滚动到指定 flowItem（点击格=直接定位，件2b 无中间层）。 */
function scrollToFlowItem(flowIndex: number): void {
    const container = scrollRef.value;
    if (!container) {
        return;
    }
    const target = container.querySelector<HTMLElement>(`[data-flow-index="${String(flowIndex)}"]`);
    target?.scrollIntoView({block: "start"});
}

const onScroll = (): void => {
    if (!scrollRef.value) return;
    const currentScrollTop = scrollRef.value.scrollTop;
    const userScrolledUp = currentScrollTop < lastScrollTop.value;

    updateVisibleFlowIndex();

    if (isNearBottom()) {
        shouldStickToBottom.value = true;
        lastScrollTop.value = currentScrollTop;
        return;
    }

    if (userScrolledUp && !isNearBottom(AUTO_SCROLL_RELEASE_THRESHOLD_PX)) {
        shouldStickToBottom.value = false;
    }

    lastScrollTop.value = currentScrollTop;

    if (!pendingImmediateScroll && shouldLoadPreviousHistory({
        scrollTop: currentScrollTop,
        hasPrevious: props.historyHasPrevious ?? false,
        loading: props.historyLoading ?? false,
    })) {
        requestPreviousHistory();
    }
};

/** prepend 完成后恢复原有可见内容的位置。 */
watch(() => props.messages[0]?.id, async () => {
    const anchor = pendingPrependAnchor;
    if (!anchor || anchor.sessionId !== (props.sessionId ?? null)) {
        return;
    }
    const oldFirstIndex = props.messages.findIndex((message) => message.id === anchor.firstMessageId);
    if (oldFirstIndex <= 0) {
        return;
    }
    await nextTick();
    if (!scrollRef.value || pendingPrependAnchor !== anchor) {
        return;
    }
    scrollRef.value.scrollTop = prependAnchoredScrollTop({
        previousScrollTop: anchor.scrollTop,
        previousScrollHeight: anchor.scrollHeight,
        nextScrollHeight: scrollRef.value.scrollHeight,
    });
    lastScrollTop.value = scrollRef.value.scrollTop;
    pendingPrependAnchor = null;
});

/** 请求结束但没有 prepend（错误或 cursor 失效）时释放旧锚点。 */
watch(() => props.historyLoading, (loading, previousLoading) => {
    if (previousLoading && !loading && props.messages[0]?.id === pendingPrependAnchor?.firstMessageId) {
        pendingPrependAnchor = null;
    }
});

/** 消息变化时自动吸底。 */
watch(messageScrollSignature, async () => {
    await nextTick();
    if (shouldAutoScrollChat({
        stickToBottom: shouldStickToBottom.value,
        prependPending: pendingPrependAnchor !== null,
    })) {
        if (pendingImmediateScroll && props.messages.length > 0) {
            pendingImmediateScroll = false;
            cancelScheduledScrollToBottom();
            scrollToBottom();
            return;
        }
        scheduleScrollToBottom();
    }
});

/** 切换 session 时，下一次消息渲染后直接定位到底部，避免长历史从顶部滚到底。 */
watch(() => props.sessionId, () => {
    pendingPrependAnchor = null;
    pendingImmediateScroll = true;
    shouldStickToBottom.value = true;
    lastScrollTop.value = 0;
    cancelScheduledScrollToBottom();
});

/** 外部可调用：强制滚动到底部。 */
const forceScrollToBottom = (): void => {
    shouldStickToBottom.value = true;
    pendingImmediateScroll = false;
    cancelScheduledScrollToBottom();
    scrollToBottom();
};

onUnmounted(() => {
    cancelScheduledScrollToBottom();
});

defineExpose({ scrollToBottom: forceScrollToBottom, scrollRef });
</script>

<template>
    <!-- 通用对话流容器：消息列 + 右缘会话刻度条（点击格直接定位） -->
    <div class="relative flex min-h-0 flex-1">
        <div ref="scrollRef" class="chat-scroll-hidden flex min-w-0 flex-1 flex-col overflow-y-auto p-4 pb-12 bg-[var(--bg-panel)]" @scroll="onScroll">
        <!-- 更早历史局部状态；失败不会遮断当前已加载对话。 -->
        <div v-if="props.historyHasPrevious || props.historyLoading || props.historyError" class="mb-4 flex shrink-0 items-center justify-center">
            <button
                type="button"
                class="inline-flex min-h-8 items-center gap-2 rounded-md border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-1.5 text-xs text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-main)] disabled:cursor-wait disabled:opacity-60"
                :disabled="props.historyLoading"
                @click="requestPreviousHistory"
            >
                <span :class="props.historyLoading ? 'i-lucide-loader-circle animate-spin' : props.historyError ? 'i-lucide-rotate-ccw' : 'i-lucide-chevron-up'" class="h-3.5 w-3.5"></span>
                <span v-if="props.historyLoading">{{ t("agent.chat.loadingPrevious") }}</span>
                <span v-else-if="props.historyError">{{ t("agent.chat.retryPrevious") }}</span>
                <span v-else>{{ t("agent.chat.loadPrevious") }}</span>
            </button>
            <span v-if="props.historyError && !props.historyLoading" class="ml-2 max-w-[360px] truncate text-xs text-[var(--status-danger)]" :title="props.historyError">{{ props.historyError }}</span>
        </div>
        <template v-if="props.messages.length > 0">
            <div
                v-for="(item, index) in flowItems"
                :key="getFlowItemKey(item)"
                :class="flowItemSpacingClass(index)"
                :data-flow-index="index"
            >
                <!-- user / system 单条消息 -->
                <AgentTextBubble
                    v-if="item.kind === 'node' && item.node.kind === 'text'"
                    :node="item.node"
                    :session-id="props.sessionId"
                    :editing-message-id="props.editingMessageId"
                    :editing-content="props.editingMessageText"
                    :action-disabled="props.messageActionDisabled"
                    :run-action-disabled="props.runActionDisabled"
                    :saving-edit="props.savingEdit"
                    :session-attachments="props.sessionAttachments"
                    :can-register-attachments="props.canRegisterAttachments"
                    :can-insert-attachments="props.canInsertAttachments"
                    :project-root="props.projectRoot"
                    :model-supports-images="props.modelSupportsImages"
                    :attachment-insert-request="props.attachmentInsertRequest"
                    :branch-switcher="props.branchSwitcherStateByMessageId?.[item.node.message.id]"
                    :menu-refresh-key="props.menuRefreshKey"
                    :resolve-menu="props.resolveEditorMenu"
                    :on-skill-trigger-start="props.onEditorSkillTriggerStart"
                    :open-reference="props.openReference"
                    :cost-display-options="props.costDisplayOptions"
                    :cost-exchange-rate-suffix="props.costExchangeRateSuffix"
                    @copy="emit('copy', $event)"
                    @start-edit="emit('start-edit', $event)"
                    @cancel-edit="emit('cancel-edit', $event)"
                    @save-edit="emit('save-edit', $event)"
                    @retry="emit('retry', $event)"
                    @branch-from-here="emit('branch-from-here', $event)"
                    @cycle-branch="emit('cycle-branch', $event)"
                    @attachment-registered="emit('attachment-registered', $event)"
                    @resend-unknown="emit('resend-unknown', $event)"
                    @dismiss-unknown="emit('dismiss-unknown', $event)"
                />
                <!-- 注入收拢行（件3g）：连续 system 注入一行灰小字，点击展开明细 -->
                <div v-else-if="item.kind === 'injections'" class="space-y-1">
                    <button
                        type="button"
                        class="flex w-fit max-w-full items-center gap-1.5 rounded px-0.5 py-0.5 text-left text-[11px] text-[var(--text-muted)] transition-colors hover:text-[var(--text-secondary)]"
                        @click="toggleInjections(item)"
                    >
                        <span :class="isInjectionsOpen(item) ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'" class="h-3 w-3 shrink-0"></span>
                        <span class="i-lucide-file-code h-3 w-3 shrink-0"></span>
                        <span>{{ t("agent.workBlock.injections", {count: item.nodes.length}) }}</span>
                    </button>
                    <div v-if="isInjectionsOpen(item)" class="ml-3 border-l-2 border-[var(--border-color)]/50 pl-3">
                        <AgentTextBubble
                            v-for="node in item.nodes"
                            :key="node.message.id"
                            :node="node"
                            :session-id="props.sessionId"
                            :action-disabled="props.messageActionDisabled"
                            :run-action-disabled="props.runActionDisabled"
                            :session-attachments="props.sessionAttachments"
                            :can-register-attachments="props.canRegisterAttachments"
                            :can-insert-attachments="props.canInsertAttachments"
                            :project-root="props.projectRoot"
                            :model-supports-images="props.modelSupportsImages"
                            :attachment-insert-request="props.attachmentInsertRequest"
                            :menu-refresh-key="props.menuRefreshKey"
                            :resolve-menu="props.resolveEditorMenu"
                            :on-skill-trigger-start="props.onEditorSkillTriggerStart"
                            :open-reference="props.openReference"
                            :cost-display-options="props.costDisplayOptions"
                            :cost-exchange-rate-suffix="props.costExchangeRateSuffix"
                            @copy="emit('copy', $event)"
                            @attachment-registered="emit('attachment-registered', $event)"
                        />
                    </div>
                </div>
                <!-- 一轮工作块（件3）：块头=唯一身份标记；正文恒显，过程行/思考行随展开态 -->
                <template v-else-if="item.kind === 'round'">
                    <AgentWorkBlock :round="item" :expanded="isRoundExpanded(item)" @toggle="toggleRound(item)" />
                    <!-- R4 件2：轮内按分组渲染——过程行行头统一平齐块头左缘（单层对齐），展开体统一 ml-3+左竖线 -->
                    <div
                        v-for="(entry, entryIndex) in visibleRoundEntries(item)"
                        :key="entry.kind === 'node' ? getNodeKey(entry.node) : entry.id"
                        :class="entryIndex > 0 ? 'mt-2' : ''"
                    >
                        <!-- 连续系统注入聚合块（R4 件2③）：「系统上下文注入 ×N」，含异常计数 -->
                        <div v-if="entry.kind === 'injectionGroup'" class="space-y-1">
                            <button
                                type="button"
                                class="flex w-fit max-w-full items-center gap-1.5 rounded px-0.5 py-0.5 text-left text-[11px] leading-4 text-[var(--text-muted)] transition-colors hover:text-[var(--text-secondary)]"
                                @click="toggleRoundEntry(entry.id)"
                            >
                                <span :class="isRoundEntryOpen(entry.id) ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'" class="h-3 w-3 shrink-0"></span>
                                <span :class="entry.errorCount > 0 ? 'i-lucide-triangle-alert text-[var(--status-danger)]' : 'i-lucide-file-code'" class="h-3 w-3 shrink-0"></span>
                                <span>{{ t("agent.workBlock.injections", {count: entry.nodes.length}) }}</span>
                                <span v-if="entry.errorCount > 0" class="shrink-0 text-[var(--status-danger)]">{{ t("agent.workBlock.groupErrorSuffix", {count: entry.errorCount}) }}</span>
                            </button>
                            <div v-if="isRoundEntryOpen(entry.id)" class="ml-3 space-y-0.5 border-l-2 border-[var(--border-color)]/50 pl-3">
                                <!-- R5 件7：聚合块内条目统一灰小字行（前缀+单行摘要，全文进 title），不再嵌完整气泡卡 -->
                                <div
                                    v-for="injectionNode in entry.nodes"
                                    :key="injectionNode.message.id"
                                    class="flex w-full items-center gap-1.5 px-0.5 py-0.5 text-[11px] leading-4"
                                    :class="injectionNode.message.error || (injectionNode.message.systemDisplayKind ?? 'system') === 'error' ? 'text-[var(--status-danger)]' : 'text-[var(--text-muted)]'"
                                    :title="injectionNode.message.content"
                                >
                                    <span class="shrink-0 font-medium opacity-80">{{ injectionLabelPrefix(injectionNode) }}</span>
                                    <span class="min-w-0 flex-1 truncate opacity-75">{{ injectionSummary(injectionNode) }}</span>
                                </div>
                            </div>
                        </div>
                        <!-- 连续同名工具聚合行（R4 件2②）：「{中文名} ×N」，失败标红，点击展开全部子行 -->
                        <div v-else-if="entry.kind === 'toolGroup'" class="space-y-1">
                            <button
                                type="button"
                                class="flex w-fit max-w-full items-center gap-1.5 rounded px-0.5 py-0.5 text-left text-[11px] leading-4 text-[var(--text-muted)] transition-colors hover:text-[var(--text-secondary)]"
                                @click="toggleRoundEntry(entry.id)"
                            >
                                <span :class="isRoundEntryOpen(entry.id) ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'" class="h-3 w-3 shrink-0"></span>
                                <span :class="entry.failedCount > 0 ? 'text-[var(--status-danger)]' : ''" class="shrink-0 font-mono">{{ t(toolShortLabelKey(entry.toolName)) }}</span>
                                <span class="shrink-0">×{{ entry.nodes.length }}</span>
                                <span v-if="entry.failedCount > 0" class="shrink-0 text-[var(--status-danger)]">{{ t("agent.workBlock.groupFailedSuffix", {count: entry.failedCount}) }}</span>
                            </button>
                            <div v-if="isRoundEntryOpen(entry.id)" class="ml-3 space-y-2 border-l-2 border-[var(--border-color)]/50 pl-3">
                                <AgentToolBubble
                                    v-for="toolNode in entry.nodes"
                                    :key="toolNode.toolCall.id"
                                    :tool-call="toolNode.toolCall"
                                    :session-id="props.sessionId"
                                    @copy="emit('copy-tool', $event)"
                                />
                            </div>
                        </div>
                        <template v-else-if="entry.node.kind === 'text' && entry.node.message.type === 'system'">
                            <!-- 轮中途单条注入行（009C1R3 件3 已过审形态）：灰小字可展开 -->
                            <div class="space-y-1">
                                <button
                                    type="button"
                                    class="flex w-fit max-w-full items-center gap-1.5 rounded px-0.5 py-0.5 text-left text-[11px] leading-4 text-[var(--text-muted)] transition-colors hover:text-[var(--text-secondary)]"
                                    @click="toggleInjections({id: entry.node.message.id})"
                                >
                                    <span :class="isInjectionsOpen({id: entry.node.message.id}) ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'" class="h-3 w-3 shrink-0"></span>
                                    <span class="i-lucide-file-code h-3 w-3 shrink-0"></span>
                                    <span>{{ t("agent.workBlock.injectionSingle") }}</span>
                                </button>
                                <div v-if="isInjectionsOpen({id: entry.node.message.id})" class="ml-3 space-y-0.5 border-l-2 border-[var(--border-color)]/50 pl-3">
                                    <!-- R5 件7：单条注入展开体与聚合块同款灰小字行 -->
                                    <div
                                        class="flex w-full items-center gap-1.5 px-0.5 py-0.5 text-[11px] leading-4"
                                        :class="entry.node.message.error || (entry.node.message.systemDisplayKind ?? 'system') === 'error' ? 'text-[var(--status-danger)]' : 'text-[var(--text-muted)]'"
                                        :title="entry.node.message.content"
                                    >
                                        <span class="shrink-0 font-medium opacity-80">{{ injectionLabelPrefix(entry.node) }}</span>
                                        <span class="min-w-0 flex-1 truncate opacity-75">{{ injectionSummary(entry.node) }}</span>
                                    </div>
                                </div>
                            </div>
                        </template>
                        <AgentTextBubble
                            v-else-if="entry.node.kind === 'text'"
                            :node="entry.node"
                            :session-id="props.sessionId"
                            :editing-message-id="props.editingMessageId"
                            :editing-content="props.editingMessageText"
                            :action-disabled="props.messageActionDisabled"
                            :run-action-disabled="props.runActionDisabled"
                            :saving-edit="props.savingEdit"
                            :session-attachments="props.sessionAttachments"
                            :can-register-attachments="props.canRegisterAttachments"
                            :can-insert-attachments="props.canInsertAttachments"
                            :project-root="props.projectRoot"
                            :model-supports-images="props.modelSupportsImages"
                            :attachment-insert-request="props.attachmentInsertRequest"
                            :branch-switcher="props.branchSwitcherStateByMessageId?.[entry.node.message.id]"
                            :menu-refresh-key="props.menuRefreshKey"
                            :resolve-menu="props.resolveEditorMenu"
                            :on-skill-trigger-start="props.onEditorSkillTriggerStart"
                            :open-reference="props.openReference"
                            :cost-display-options="props.costDisplayOptions"
                            :cost-exchange-rate-suffix="props.costExchangeRateSuffix"
                            suppress-identity
                            :show-thinking="isRoundExpanded(item)"
                            :suppress-actions="!isActionsHost(item, entry.node)"
                            @copy="emit('copy', $event)"
                            @start-edit="emit('start-edit', $event)"
                            @cancel-edit="emit('cancel-edit', $event)"
                            @save-edit="emit('save-edit', $event)"
                            @retry="emit('retry', $event)"
                            @branch-from-here="emit('branch-from-here', $event)"
                            @cycle-branch="emit('cycle-branch', $event)"
                            @attachment-registered="emit('attachment-registered', $event)"
                            @resend-unknown="emit('resend-unknown', $event)"
                            @dismiss-unknown="emit('dismiss-unknown', $event)"
                        />
                        <AgentToolBubble
                            v-else
                            :tool-call="entry.node.toolCall"
                            :session-id="props.sessionId"
                            @copy="emit('copy-tool', $event)"
                        />
                    </div>
                </template>
            </div>
        </template>

        <!-- 空状态 -->
        <div v-else class="flex h-full flex-col items-center justify-center space-y-6 px-4 text-center">
            <!-- main 模式空状态 -->
            <template v-if="props.mode === 'main' && props.unselected">
                <div class="flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] shadow-sm">
                    <span class="i-lucide-messages-square h-6 w-6 text-[var(--status-warning)]"></span>
                </div>
                <div class="space-y-2">
                    <h3 class="text-base font-medium text-[var(--text-main)]">请选择一个对话</h3>
                    <p class="text-sm leading-relaxed text-[var(--text-muted)]">当前实例还有可用对话，但没有可靠的上次选择。请从对话列表中选择。</p>
                </div>
            </template>
            <!-- main 模式空状态 -->
            <template v-else-if="props.mode === 'main'">
                <div class="flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--border-color)] bg-[var(--bg-input)] shadow-sm">
                    <span class="i-lucide-bot h-6 w-6 text-[var(--text-muted)]"></span>
                </div>
                <div class="space-y-2">
                    <h3 class="text-base font-medium text-[var(--text-main)]">{{ t("agent.chat.startTitle") }}</h3>
                    <p class="text-sm leading-relaxed text-[var(--text-muted)]">{{ t("agent.chat.startDescription") }}</p>
                </div>
            </template>
            <!-- compact 模式空状态 -->
            <template v-else>
                <div class="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)]">
                    <span class="i-lucide-loader-circle h-4 w-4 animate-spin text-[var(--text-muted)]"></span>
                </div>
                <p class="text-xs text-[var(--text-muted)]">{{ t("agent.chat.waiting") }}</p>
            </template>
        </div>
        </div>
        <!-- 会话刻度条（009C1R2 件2）：滚动容器外右缘固定；点格直接定位、hover 预览、底部开完整树 -->
        <AgentSessionScaleBar
            v-if="scaleSegments.length > 0"
            class="h-full"
            :segments="scaleSegments"
            :active-index="visibleFlowIndex"
            @seek="scrollToFlowItem"
            @expand="emit('expand-session-tree')"
        />
    </div>
</template>

<style scoped>
/* R4 件3⑤：隐藏消息区原生滚动条（刻度条接管定位，滚轮不受影响）。
   回滚开关：删除本类的滚动条隐藏规则即可恢复原生滚动条。 */
.chat-scroll-hidden {
    scrollbar-width: none;
    -ms-overflow-style: none;
}
.chat-scroll-hidden::-webkit-scrollbar {
    display: none;
    width: 0;
    height: 0;
}
</style>
