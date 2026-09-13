import { defineAsyncComponent, markRaw, type Component } from "vue";
import type {AgentToolCall} from "nbook/app/components/novel-ide/agent/agent-message";
import AgentEditFileBubble from "nbook/app/components/novel-ide/agent/AgentEditFileBubble.vue";
import AgentRequestUserInputBubble from "nbook/app/components/novel-ide/agent/AgentRequestUserInputBubble.vue";
import AgentSwitchModeBubble from "nbook/app/components/novel-ide/agent/AgentSwitchModeBubble.vue";
import AgentWriteFileBubble from "nbook/app/components/novel-ide/agent/AgentWriteFileBubble.vue";
import AgentApplyPatchBubble from "nbook/app/components/novel-ide/agent/AgentApplyPatchBubble.vue";
import AgentTaskBubble from "nbook/app/components/novel-ide/agent/AgentTaskBubble.vue";
import AgentWorkflowBubble from "nbook/app/components/novel-ide/agent/AgentWorkflowBubble.vue";
import AgentSqlBubble from "nbook/app/components/novel-ide/agent/AgentSqlBubble.vue";
import AgentCommandBubble from "nbook/app/components/novel-ide/agent/AgentCommandBubble.vue";
import AgentWebBubble from "nbook/app/components/novel-ide/agent/AgentWebBubble.vue";

/** Tool 节点渲染模式。 */
export type AgentToolRenderMode = "inline" | "block" | "message" | "hidden";

/** 单个 tool 的渲染配置。 */
export type AgentToolRenderConfig = {
    mode: AgentToolRenderMode;
    /** 兜底英文标签；有 typeLabelKey 时优先用 i18n 文案。 */
    typeLabel: string;
    /** 人化标题的 i18n key：「这步在干什么」，而不是工具名或内部术语。 */
    typeLabelKey?: string;
    collapsedPreview?: string;
    collapsedPreviewKey?: string;
    component?: Component;
};

const DEFAULT_TOOL_RENDER_CONFIG: AgentToolRenderConfig = {
    mode: "inline",
    typeLabel: "Tool Call",
    typeLabelKey: "agent.tool.typeToolCall",
};

const TOOL_RENDER_REGISTRY: Record<string, AgentToolRenderConfig> = {
    request_user_input: {
        mode: "block",
        typeLabel: "Question",
        typeLabelKey: "agent.tool.typeQuestion",
        collapsedPreviewKey: "agent.tool.waitingUserAnswer",
        component: markRaw(AgentRequestUserInputBubble),
    },
    switch_mode: {
        mode: "message",
        typeLabel: "Mode",
        typeLabelKey: "agent.tool.typeMode",
        collapsedPreviewKey: "agent.tool.modeSwitchApproval",
        component: markRaw(AgentSwitchModeBubble),
    },
    write: {
        mode: "block",
        typeLabel: "Write",
        typeLabelKey: "agent.tool.writeFile",
        collapsedPreviewKey: "agent.tool.writeFile",
        component: markRaw(AgentWriteFileBubble),
    },
    edit: {
        mode: "block",
        typeLabel: "Edit",
        typeLabelKey: "agent.tool.editFile",
        collapsedPreviewKey: "agent.tool.editFile",
        component: markRaw(AgentEditFileBubble),
    },
    apply_patch: {
        mode: "block",
        typeLabel: "Patch",
        typeLabelKey: "agent.tool.applyPatch",
        collapsedPreviewKey: "agent.tool.applyPatch",
        component: markRaw(AgentApplyPatchBubble),
    },
    execute_sql: {
        mode: "block",
        typeLabel: "SQL",
        typeLabelKey: "agent.tool.typeSql",
        collapsedPreviewKey: "agent.tool.typeSql",
        component: markRaw(AgentSqlBubble),
    },
    bash: {
        mode: "block",
        typeLabel: "Command",
        typeLabelKey: "agent.tool.typeCommand",
        collapsedPreviewKey: "agent.tool.typeCommand",
        component: markRaw(AgentCommandBubble),
    },
    web_search: {
        mode: "block",
        typeLabel: "Web Search",
        typeLabelKey: "agent.tool.typeWebSearch",
        collapsedPreviewKey: "agent.tool.typeWebSearch",
        component: markRaw(AgentWebBubble),
    },
    web_fetch: {
        mode: "block",
        typeLabel: "Web Fetch",
        typeLabelKey: "agent.tool.typeWebFetch",
        collapsedPreviewKey: "agent.tool.typeWebFetch",
        component: markRaw(AgentWebBubble),
    },
    run_workflow: {
        mode: "block",
        typeLabel: "Workflow",
        typeLabelKey: "agent.tool.typeWorkflow",
        collapsedPreviewKey: "agent.tool.typeWorkflow",
        component: markRaw(AgentWorkflowBubble),
    },
    task_create: {
        mode: "message",
        typeLabel: "Checklist",
        typeLabelKey: "agent.tool.taskList",
        collapsedPreviewKey: "agent.tool.taskList",
        component: markRaw(AgentTaskBubble),
    },
    task_set_status: {
        mode: "message",
        typeLabel: "Checklist",
        typeLabelKey: "agent.tool.taskStatusUpdate",
        collapsedPreviewKey: "agent.tool.taskStatusUpdate",
        component: markRaw(AgentTaskBubble),
    },
};

/**
 * 根据 tool 名字返回前端渲染配置。
 */
export const resolveToolRenderConfig = (toolCall: AgentToolCall): AgentToolRenderConfig => {
    return TOOL_RENDER_REGISTRY[toolCall.name] ?? DEFAULT_TOOL_RENDER_CONFIG;
};
