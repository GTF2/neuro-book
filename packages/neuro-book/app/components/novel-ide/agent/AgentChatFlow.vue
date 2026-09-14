<script setup lang="ts">
import type { AgentMessage, AgentMessageSwitcherState, AgentToolCall, ChatNode } from "nbook/app/components/novel-ide/agent/agent-message";
import { FILE_EDIT_TOOL_NAMES, toChatNodes } from "nbook/app/components/novel-ide/agent/agent-message";
import AgentTextBubble from "nbook/app/components/novel-ide/agent/AgentTextBubble.vue";
import AgentToolBubble from "nbook/app/components/novel-ide/agent/AgentToolBubble.vue";
import AgentWorkBlock from "nbook/app/components/novel-ide/agent/AgentWorkBlock.vue";
import { groupChatNodesIntoBlocks, type ChatFlowItem } from "nbook/app/components/novel-ide/agent/chat-work-blocks";
import {
    buildChatOutline,
    chatBlockAnchorId,
    chatNodeAnchorId,
    resolveActiveOutlineId,
    type ChatOutlineItem,
} from "nbook/app/components/novel-ide/agent/chat-outline";
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
    /** 写文件类工具失败卡片上的「跳过此次编辑」：由上层把指令填进输入框。 */
    (e: "skip-edit", message: AgentMessage): void;
    /**
     * 失败卡片上的「重新尝试」：往会话末尾追加一轮新尝试，而不截断重跑。
     * 与 retry 并存而非复用，是因为两者语义相反 —— retry 原地重生成，这条往后接。
     */
    (e: "retry-append", message: AgentMessage): void;
    /** 大纲内容变化；面板由外层渲染，这里只负责投影数据。 */
    (e: "outline-change", items: ChatOutlineItem[]): void;
    /** 当前滚动位置对应的大纲行。 */
    (e: "active-anchor-change", anchorId: string): void;
}>();

const scrollRef = ref<HTMLDivElement | null>(null);
const shouldStickToBottom = ref(true);
const lastScrollTop = ref(0);
let pendingImmediateScroll = true;
let autoScrollFrame: number | null = null;
/** 大纲高亮同样按帧合并：滚动一帧可能触发多次事件，逐个查全部锚点会拖垮长对话。 */
let outlineSyncFrame: number | null = null;
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

/**
 * 写文件类失败默认只展开最后一个。
 * 全展开的初衷是「失败不折叠」，但老长对话里失败卡片可能很多，一起撑开会淹没上下文；
 * 最新那次失败才是用户当下要处理的，更早的收拢成一行，需要时自己点开。
 */
const lastFileEditFailureKey = computed(() => {
    const nodes = chatNodes.value;
    for (let index = nodes.length - 1; index >= 0; index -= 1) {
        const node = nodes[index];
        if (node?.kind !== "tool") {
            continue;
        }
        const call = node.toolCall;
        if (FILE_EDIT_TOOL_NAMES.has(call.name) && (call.status === "error" || call.status === "invalid")) {
            return getNodeKey(node);
        }
    }
    return "";
});

/**
 * 主时间线的渲染单元：连续同类的工具步骤先聚成工作块。
 * 「用户一句话 → Agent 干几十步」时，整屏卡片会让人无法定位，收拢成一行才有全局感。
 */
const flowItems = computed(() => groupChatNodesIntoBlocks(chatNodes.value));

const getItemKey = (item: ChatFlowItem): string => {
    return item.kind === "block" ? `block-${item.id}` : getNodeKey(item.node);
};

/** 右侧大纲：用户提问为锚点，工作块为内容行。 */
const outlineItems = computed(() => buildChatOutline(flowItems.value, getNodeKey));

const activeOutlineAnchor = ref("");

/** 渲染单元对应的 DOM 锚点；跳转与滚动联动都靠它定位。 */
const itemAnchorId = (item: ChatFlowItem): string => item.kind === "block"
    ? chatBlockAnchorId(item.id)
    : chatNodeAnchorId(getNodeKey(item.node));

/** 锚点顶部越过容器顶部这条线就算「当前行」；留一点余量，避免贴边时不切换。 */
const OUTLINE_ACTIVATION_LINE_PX = 8;

const syncActiveOutline = (): void => {
    const container = scrollRef.value;
    if (!container) {
        return;
    }
    const containerTop = container.getBoundingClientRect().top;
    const offsets: Array<{id: string; top: number}> = [];
    for (const item of outlineItems.value) {
        const element = container.querySelector<HTMLElement>(`[data-anchor="${CSS.escape(item.anchorId)}"]`);
        if (!element) {
            continue;
        }
        offsets.push({id: item.anchorId, top: element.getBoundingClientRect().top - containerTop});
    }
    activeOutlineAnchor.value = resolveActiveOutlineId(offsets, OUTLINE_ACTIVATION_LINE_PX);
};

/**
 * 把大纲高亮合并到下一帧。
 *
 * 与自动吸底同一套理由：滚动事件在一帧里可能来好几次，而这里每次都要遍历全部大纲条目、
 * 逐个 querySelector + getBoundingClientRect —— 全是强制布局。长对话里同步跑会明显掉帧；
 * 合并到帧末只算一次，视觉上没有任何差别。
 */
const scheduleActiveOutlineSync = (): void => {
    if (outlineSyncFrame !== null) {
        return;
    }
    if (typeof requestAnimationFrame !== "function") {
        syncActiveOutline();
        return;
    }
    outlineSyncFrame = requestAnimationFrame(() => {
        outlineSyncFrame = null;
        syncActiveOutline();
    });
};

/** 取消下一帧的大纲高亮任务。 */
const cancelScheduledActiveOutlineSync = (): void => {
    if (outlineSyncFrame !== null) {
        if (typeof cancelAnimationFrame === "function") {
            cancelAnimationFrame(outlineSyncFrame);
        }
        outlineSyncFrame = null;
    }
};

// 内容变化同样会挪动锚点，而且不一定伴随滚动（首屏渲染、流式追加后贴底都不触发 scroll），
// 所以除了 onScroll，内容变化也要重算一次。flush: "post" 保证读到的 DOM 已经更新。
watch(outlineItems, scheduleActiveOutlineSync, {flush: "post"});

/**
 * 跳到指定锚点。
 * 平滑滚动后目标会短暂闪烁：否则用户点完不知道到底跳到哪了。
 */
const scrollToAnchor = (anchorId: string): void => {
    const container = scrollRef.value;
    if (!container) {
        return;
    }
    const target = container.querySelector<HTMLElement>(`[data-anchor="${CSS.escape(anchorId)}"]`);
    if (!target) {
        return;
    }
    // 跳转是用户的显式定位，不能被「自动贴底」抢回去。
    shouldStickToBottom.value = false;
    target.scrollIntoView({behavior: "smooth", block: "start"});
    target.classList.add("chat-anchor-flash");
    window.setTimeout(() => target.classList.remove("chat-anchor-flash"), 900);
};

watch(outlineItems, (items) => emit("outline-change", items), {immediate: true});
watch(activeOutlineAnchor, (anchorId) => emit("active-anchor-change", anchorId), {immediate: true});

/** 判断文本节点是否包含正文。 */
const hasTextBubbleContent = (node: ChatNode): boolean => {
    if (node.kind !== "text") {
        return false;
    }
    return Boolean(node.message.content.trim() || node.message.contentBlocks?.length || node.message.attachments?.length);
};

/**
 * 计算渲染单元间距。
 * 块化之后不能再按「前后是否同一个 message 的工具」判断，改为按单元类型：
 * 块与独立步骤收紧，文本气泡之间保持段落间距。
 */
const itemSpacingClass = (index: number): string => {
    if (index === 0) {
        return "";
    }
    const item = flowItems.value[index];
    const previousItem = flowItems.value[index - 1];
    if (!item || !previousItem) {
        return "mt-6";
    }
    // 无内容的思维链气泡后面紧跟步骤时收紧，避免出现一段空白。
    if (
        item.kind === "node"
        && item.node.kind === "tool"
        && previousItem.kind === "node"
        && previousItem.node.kind === "text"
        && previousItem.node.message.id === item.node.message.id
        && !hasTextBubbleContent(previousItem.node)
    ) {
        return "mt-1";
    }
    if (item.kind === "node" && item.node.kind === "text") {
        return "mt-6";
    }
    return "mt-2";
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
const onScroll = (): void => {
    // 先排队大纲高亮：下面的分支里有提前 return，放在后面会漏掉贴底场景。
    // 按帧合并而不是同步跑，理由见 scheduleActiveOutlineSync。
    scheduleActiveOutlineSync();
    if (!scrollRef.value) return;
    const currentScrollTop = scrollRef.value.scrollTop;
    const userScrolledUp = currentScrollTop < lastScrollTop.value;

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
    cancelScheduledActiveOutlineSync();
});

/** 外部可调用：强制滚动到底部。 */
const forceScrollToBottom = (): void => {
    shouldStickToBottom.value = true;
    pendingImmediateScroll = false;
    cancelScheduledScrollToBottom();
    scrollToBottom();
};

/** 外部可调用：按整段对话的百分比定位（右侧刻度列拖动用）。 */
const forceScrollToRatio = (ratio: number): void => {
    const container = scrollRef.value;
    if (!container) {
        return;
    }
    const max = Math.max(0, container.scrollHeight - container.clientHeight);
    container.scrollTop = Math.min(1, Math.max(0, ratio)) * max;
};

/** 外部可调用：按像素滚动（刻度列把滚轮转过来时用）。 */
const forceScrollBy = (deltaY: number): void => {
    const container = scrollRef.value;
    if (!container) {
        return;
    }
    container.scrollTop += deltaY;
};

onUnmounted(() => {
    cancelScheduledScrollToBottom();
    cancelScheduledActiveOutlineSync();
});

defineExpose({
    scrollToBottom: forceScrollToBottom,
    scrollToAnchor,
    scrollToRatio: forceScrollToRatio,
    scrollBy: forceScrollBy,
    scrollRef,
});
</script>

<style scoped>
/* 跳转目标短暂闪烁：否则用户点完大纲不知道到底跳到哪了。 */
.chat-anchor-flash {
    border-radius: 12px;
    animation: chat-anchor-flash 0.9s ease-out;
}

@keyframes chat-anchor-flash {
    0%, 100% { background-color: transparent; }
    30% { background-color: var(--accent-bg); }
}

/* 滚动条压淡：它右边紧挨着大纲刻度，两者不能被看成一回事。 */
.chat-scroll::-webkit-scrollbar-thumb {
    background-color: color-mix(in srgb, var(--text-muted) 42%, transparent);
}

/* 上下箭头按钮：同上，作用域再收一层，确保对话区这根也没有箭头。 */
.chat-scroll::-webkit-scrollbar-button {
    display: none !important;
    width: 0 !important;
    height: 0 !important;
}

.chat-scroll::-webkit-scrollbar-thumb:hover {
    background-color: var(--text-secondary);
}

/*
 * 右侧留出刻度列的位置：刻度列是绝对定位浮在滚动条左侧的（见 AgentChatOutline.vue），
 * 不再占布局宽度，所以改由这里的内边距把正文挡开，免得被刻度压住。
 * 42px = 刻度列 36px + 滚动条 6px。刻度列加宽，是为了给「选中那条更长」留出空间。
 *
 * 只在刻度列真的渲染时才留：没有可定位内容时大纲整体隐藏（见 AgentChatSurface 的 hidden），
 * 这条留白就会变成右侧一道凭空的空白。
 */
.chat-scroll-gutter {
    padding-right: 42px;
}
</style>

<template>
    <!-- 通用对话流容器 -->
    <div
        ref="scrollRef"
        class="chat-scroll flex flex-1 flex-col overflow-y-auto p-4 pb-12 bg-[var(--bg-panel)]"
        :class="{ 'chat-scroll-gutter': outlineItems.length > 0 }"
        @scroll="onScroll"
    >
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
                :key="getItemKey(item)"
                :data-anchor="itemAnchorId(item)"
                :class="itemSpacingClass(index)"
            >
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
                <AgentWorkBlock
                    v-else-if="item.kind === 'block'"
                    :block="item"
                    :session-id="props.sessionId"
                    :action-disabled="props.messageActionDisabled"
                    :run-action-disabled="props.runActionDisabled"
                    @copy="emit('copy-tool', $event)"
                    @retry="emit('retry', $event)"
                    @skip-edit="emit('skip-edit', $event)"
                />
                <AgentToolBubble
                    v-else-if="item.kind === 'node' && item.node.kind === 'tool'"
                    :tool-call="item.node.toolCall"
                    :session-id="props.sessionId"
                    :action-disabled="props.messageActionDisabled"
                    :run-action-disabled="props.runActionDisabled"
                    :auto-expand="getNodeKey(item.node) === lastFileEditFailureKey"
                    @copy="emit('copy-tool', $event)"
                    @retry="emit('retry-append', item.node.message)"
                    @skip-edit="emit('skip-edit', item.node.message)"
                />
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
                    <h3 class="text-base font-medium text-[var(--text-main)]">{{ t("agent.chat.selectSessionTitle") }}</h3>
                    <p class="text-sm leading-relaxed text-[var(--text-muted)]">{{ t("agent.chat.selectSessionBody") }}</p>
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
</template>
