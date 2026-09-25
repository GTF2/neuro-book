import type {AgentJobSnapshot} from "nbook/shared/dto/agent-job.dto";
import type {AgentPendingUserInputSession} from "nbook/app/components/novel-ide/agent/agent-message";

/**
 * G1 统一待办库（任务031）：六类待办的聚合层契约。
 *
 * 聚合层是三处计数（驾驶舱/徽标/堆叠卡）的唯一真源（断头路 A8）；三源各自机制不推倒，
 * 这里只做读侧聚合与协议锚点（契约基线①）。⑤正文变更审/⑥计划确认仅枚举与路由占位：
 * 界面归 G2/G3 融合审稿与堆叠卡一族（核销表 §9-6 拍板）。
 */
export type UnifiedTodoKind =
    | "tool_approval"
    | "setting_decision"
    | "story_promise"
    | "workflow_answer"
    | "content_review"
    | "plan_confirm";

export type UnifiedTodoSource = "agent_pending" | "workflow_waiting" | "story_promise" | "setting_proposal";

/**
 * 统一应答协议（G1 契约基线⑤）：每件待办声明应答回传通道。
 * 阻塞型走 agent_resolution（会话 resolution 提交链），后台型走 workflow_ask（PendingAsk 回传链）；
 * UI 舞台分工（输入框上方阻塞卡 vs 后台面板行）保留，仅在协议层统一表达。
 */
export type TodoReplyChannel =
    | {kind: "agent_resolution"; sessionId: number; toolCallId: string}
    | {kind: "workflow_ask"; runId: string};

export type UnifiedTodoItem = {
    /** 全局唯一：`<source>:<源内 ID>`（或 question 级 toolCallId）。 */
    id: string;
    kind: UnifiedTodoKind;
    source: UnifiedTodoSource;
    /** 人话标题（渲染层可直接展示）。 */
    title: string;
    /** 设定拍板族：提案 ID；影响项与提案绑定（K4 整组销号的依据）。 */
    proposalId?: string;
    /** 应答回传通道（store 组装时填；纯聚合函数不掌握会话上下文故可缺省）。 */
    replyChannel?: TodoReplyChannel;
    /** 源原始载荷（渲染层按 kind 取用）。 */
    raw: unknown;
};

/** 主会话阻塞/审批源之外的最小源形状（C 段接入时由各源适配转换）。 */
export type WorkflowWaitingRef = {
    runId: string;
    workflowKey: string;
};

/**
 * jobs feed → Workflow 源的共享适配（原 AgentWorkflowPendingPanel 内部过滤逻辑提升）：
 * 只收当前 Session、kind=workflow、status=waiting、带正式 run 引用的后台作业。
 * Panel 徽标与统一待办库必须共用此判定，两处数字才可能同源（A8）。
 */
export function toWorkflowWaitingRefs(jobs: readonly AgentJobSnapshot[], sessionId: number | null): WorkflowWaitingRef[] {
    if (sessionId === null) {
        return [];
    }
    const refs: WorkflowWaitingRef[] = [];
    for (const job of jobs) {
        if (job.kind !== "workflow" || job.ownerSessionId !== sessionId || job.status !== "waiting") {
            continue;
        }
        const ref = job.ref;
        if (!ref || typeof ref !== "object" || Array.isArray(ref)) {
            continue;
        }
        const {runId, workflowKey} = ref as {runId?: unknown; workflowKey?: unknown};
        if (typeof runId !== "string" || !runId || typeof workflowKey !== "string" || !workflowKey) {
            continue;
        }
        refs.push({runId, workflowKey});
    }
    return refs;
}

export type SettingProposalInput = {
    proposalId: string;
    title: string;
    /** 与提案绑定生成的影响项（K4：拒绝=整组销号，断头路 A4/B3）。 */
    impacts: Array<{id: string; label: string}>;
};

export type StoryPromiseInput = {
    promiseId: string;
    title: string;
    dueChapter?: string;
};

export type TodoSources = {
    agentPending?: AgentPendingUserInputSession[];
    workflowWaiting?: WorkflowWaitingRef[];
    settingProposals?: SettingProposalInput[];
    storyPromises?: StoryPromiseInput[];
};

type AgentPendingUserInputQuestionOf = AgentPendingUserInputSession["questions"][number];

function questionItemId(session: AgentPendingUserInputSession, question: AgentPendingUserInputQuestionOf): string {
    const key = question.toolCallId ?? `${session.assistantMessageId}:${question.toolNodeId}:${question.questionIndex}`;
    return `agent_pending:${key}`;
}

function questionItemTitle(question: AgentPendingUserInputQuestionOf): string {
    return question.approvalAction === "switch_mode"
        ? `切换模式审批：${question.switchTargetMode ?? ""}`.trim()
        : question.question;
}

/** 把三源输入聚合成统一待办项。纯函数：同一输入永远得到同一结果（A9 重进恢复的依据）。 */
export function aggregateTodoItems(sources: TodoSources): UnifiedTodoItem[] {
    const items: UnifiedTodoItem[] = [];
    for (const session of sources.agentPending ?? []) {
        session.questions.forEach((question, questionIndex) => {
            if (!question) {
                return;
            }
            items.push({
                id: questionItemId(session, question),
                kind: question.kind === "tool_approval" ? "tool_approval" : "setting_decision",
                source: "agent_pending",
                title: questionItemTitle(question),
                raw: {session, questionIndex},
            });
        });
    }
    for (const waiting of sources.workflowWaiting ?? []) {
        items.push({
            id: `workflow:${waiting.runId}`,
            kind: "workflow_answer",
            source: "workflow_waiting",
            title: waiting.workflowKey,
            raw: waiting,
        });
    }
    for (const proposal of sources.settingProposals ?? []) {
        items.push({
            id: `setting:${proposal.proposalId}`,
            kind: "setting_decision",
            source: "setting_proposal",
            title: proposal.title,
            proposalId: proposal.proposalId,
            raw: proposal,
        });
        for (const impact of proposal.impacts) {
            items.push({
                id: `setting:impact:${impact.id}`,
                kind: "setting_decision",
                source: "setting_proposal",
                title: impact.label,
                proposalId: proposal.proposalId,
                raw: impact,
            });
        }
    }
    for (const promise of sources.storyPromises ?? []) {
        items.push({
            id: `promise:${promise.promiseId}`,
            kind: "story_promise",
            source: "story_promise",
            title: promise.title,
            raw: promise,
        });
    }
    return items;
}

/** K4：拒绝提案=整组销号（提案+绑定影响项同步移除，不留幽灵待办；断头路 A4）。 */
export function rejectProposalGroup(items: UnifiedTodoItem[], proposalId: string): UnifiedTodoItem[] {
    return items.filter((item) => item.proposalId !== proposalId);
}

/** 计划步骤（K5 结构化 diff 的比较单位；允许扩展字段，比较按完整 JSON）。 */
export type PlanStep = {
    id: string;
    title: string;
} & Record<string, unknown>;

export type PlanRevision = {
    proposalId: string;
    steps: PlanStep[];
};

export type PlanRevisionDiff = {
    kind: "plan_revision";
    proposalId: string;
    addedSteps: PlanStep[];
    removedStepIds: string[];
    changedSteps: Array<{before: PlanStep; after: PlanStep}>;
    /** 用户随修订附带的文字反馈。 */
    note?: string;
};

/** K5（断头路 A12）：计划修订以结构化 diff 回传，AI 拿到的是机器可比对的变更集。 */
export function computePlanRevisionDiff(before: PlanRevision, after: PlanRevision, note?: string): PlanRevisionDiff {
    const beforeById = new Map(before.steps.map((step) => [step.id, step]));
    const afterById = new Map(after.steps.map((step) => [step.id, step]));
    const addedSteps = after.steps.filter((step) => !beforeById.has(step.id));
    const removedStepIds = before.steps.filter((step) => !afterById.has(step.id)).map((step) => step.id);
    const changedSteps = before.steps.flatMap((step) => {
        const next = afterById.get(step.id);
        if (!next || JSON.stringify(step) === JSON.stringify(next)) {
            return [];
        }
        return [{before: step, after: next}];
    });
    return {
        kind: "plan_revision",
        proposalId: after.proposalId,
        addedSteps,
        removedStepIds,
        changedSteps,
        ...(note === undefined ? {} : {note}),
    };
}

export type PlanRevisionReply =
    | {decision: "accepted"}
    | {decision: "conflict"; conflicts: string[]};

/**
 * AI 对修订回传的一次性终态应答：认可或冲突，不存在第三种往返（防无限循环，断头路 A12）。
 */
export function resolvePlanRevisionReply(reply: PlanRevisionReply): PlanRevisionReply {
    return reply;
}

/**
 * K2（用户拍板=writer 协议扩展）：解析 writer 输出的 confidence 字段。
 * 旧输出缺字段/非法值一律返回 null（向后兼容，不报错、不降级展示）。
 */
export function parseWriterConfidence(raw: unknown): number | null {
    if (typeof raw !== "object" || raw === null || !("confidence" in raw)) {
        return null;
    }
    const value = (raw as {confidence: unknown}).confidence;
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
        return null;
    }
    return value;
}

/** 低置信自动变选择题的阈值（蓝图:54「低置信自动变选择题」）。 */
export const CONFIDENCE_CHOICE_THRESHOLD = 0.6;

export type ConfidenceRoute = "choice" | "direct";

/** 低置信给选择题路由建议；无置信信息（旧输出）不降级，走直接展示。 */
export function confidenceToRoute(confidence: number | null): ConfidenceRoute {
    if (confidence !== null && confidence < CONFIDENCE_CHOICE_THRESHOLD) {
        return "choice";
    }
    return "direct";
}
