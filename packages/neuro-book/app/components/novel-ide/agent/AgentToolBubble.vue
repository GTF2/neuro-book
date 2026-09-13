<script setup lang="ts">
import type { AgentToolCall } from "nbook/app/components/novel-ide/agent/agent-message";
import AgentToolNode from "nbook/app/components/novel-ide/agent/AgentToolNode.vue";
import AgentAttachmentGallery from "nbook/app/components/novel-ide/agent/AgentAttachmentGallery.vue";
import {resolveToolRenderConfig} from "nbook/app/components/novel-ide/agent/tool-render-registry";
import { useCollapsible } from "nbook/app/composables/useCollapsible";

const props = defineProps<{
    toolCall: AgentToolCall;
    /** 当前 durable session；live tool result 尚无 entry locator 时不会请求附件。 */
    sessionId?: number | null;
    actionDisabled?: boolean;
    runActionDisabled?: boolean;
    /**
     * 是否默认展开。写文件类失败「只展开最后一个」由上层（对话流）统一裁决，
     * 单个气泡不知道自己是不是最后一次失败。
     */
    autoExpand?: boolean;
}>();

const emit = defineEmits<{
    (e: "copy", toolCall: AgentToolCall): void;
    (e: "retry"): void;
    (e: "skip-edit"): void;
}>();

/** Workflow 运行态需要立即可见并挂载轮询；普通工具与已完成历史保持原有默认折叠。 */
const workflowDetailsStatus = props.toolCall.resultData
    && typeof props.toolCall.resultData === "object"
    && !Array.isArray(props.toolCall.resultData)
    && typeof props.toolCall.resultData.status === "string"
    ? props.toolCall.resultData.status
    : "";
/** 写文件类失败的展开与否由上层传入；workflow 运行态无条件展开。 */
const startsExpanded = computed(() => Boolean(props.autoExpand)
    || (props.toolCall.name === "run_workflow"
        && (props.toolCall.status === "streaming"
            || props.toolCall.status === "running"
            || workflowDetailsStatus === "started"
            || workflowDetailsStatus === "waiting")));
const { isCollapsed, toggle, expand } = useCollapsible(!startsExpanded.value);

// 失败详情是异步到达的（卡片先以运行态挂载），因此要在「运行中 → 失败」这一次跃迁上补展开；
// 之后不再干预，尊重用户的手动收起。
watch(() => props.autoExpand, (shouldExpand) => {
    if (shouldExpand) {
        expand();
    }
});

const renderConfig = computed(() => resolveToolRenderConfig(props.toolCall));
const resultAttachments = computed(() => (props.toolCall.publicResult?.content ?? [])
    .flatMap((item) => item.type === "attachment" && typeof item.contentIndex === "number"
        ? [{contentIndex: item.contentIndex, attachment: item.attachment}]
        : []));
</script>

<template>
    <div v-if="renderConfig.mode === 'message' && renderConfig.component" class="group flex min-w-0 w-full flex-col items-stretch pl-6">
        <component :is="renderConfig.component" :tool-call="props.toolCall" />
        <AgentAttachmentGallery
            v-if="resultAttachments.length > 0"
            :attachments="resultAttachments"
            :session-id="props.sessionId"
            :entry-id="props.toolCall.resultEntryId"
        />
    </div>
    <div v-else class="group flex min-w-0 w-full flex-col items-start pl-6">
        <AgentToolNode
            :tool-call="props.toolCall"
            :expanded="!isCollapsed"
            :action-disabled="props.actionDisabled"
            :run-action-disabled="props.runActionDisabled"
            @toggle="toggle"
            @copy="emit('copy', props.toolCall)"
            @retry="emit('retry')"
            @skip-edit="emit('skip-edit')"
        />
        <AgentAttachmentGallery
            v-if="resultAttachments.length > 0"
            class="w-full"
            :attachments="resultAttachments"
            :session-id="props.sessionId"
            :entry-id="props.toolCall.resultEntryId"
        />
    </div>
</template>
