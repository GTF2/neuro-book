<script setup lang="ts">
/** 驾驶舱待办行的三类入口（T-1：待拍板/伏笔未还/Workflow 待应答，发现入口唯一=驾驶舱）。 */
export type CockpitEntryKind = "pending" | "foreshadow" | "workflow";

/** 「正在做」行相位；workflow 相位时该行改显流程名（场景 6 加载中）。 */
export type CockpitActivityPhase = "idle" | "writing" | "workflow";

/**
 * 骨架件：不 import store/API/运行时服务，默认值即组件内占位常量；
 * 挂载侧接真机数据时逐项传 props 覆盖（契约不变）。
 */
const props = withDefaults(
    defineProps<{
        /** 写到第几章；null=未开卷（场景 2 空态） */
        chapterNumber?: number | null;
        /** AI 正在干啥（「第 3 章·写作中」） */
        activityPhase?: CockpitActivityPhase;
        /** 流程在跑但无需应答时「正在做」行显流程名（场景 6 加载中） */
        activityFlowName?: string | null;
        /** N 件待拍板（0=行转纯状态不可点，场景 5 空态归零） */
        pendingCount?: number;
        /** 伏笔未还数（0=行转纯状态不可点） */
        foreshadowOpenCount?: number;
        /** N 个流程等应答；0=该行不渲染（场景 6 空态不留灰行） */
        workflowPendingCount?: number;
        /** 流程卡住/超时：行转警示色+人话+行内「重试/放弃」横条（场景 6 错误） */
        workflowError?: boolean;
    }>(),
    {
        chapterNumber: 3,
        activityPhase: "writing",
        activityFlowName: null,
        pendingCount: 2,
        foreshadowOpenCount: 1,
        workflowPendingCount: 0,
        workflowError: false,
    },
);

const emit = defineEmits<{
    /** 点待办行→该类待办全部弹为输入框上方堆叠卡（T-2），本件只上报 */
    (e: "open", kind: CockpitEntryKind): void;
    /** 错误行行内「重试」（场景 6 错误） */
    (e: "retryWorkflow"): void;
    /** 错误行行内「放弃」（场景 6 错误） */
    (e: "abandonWorkflow"): void;
}>();

const {t} = useI18n();

/** 「正在做」行文案：写作中=「第 N 章 · 写作中」；workflow=流程名兜底通用文案；否则待命。 */
const activityText = computed(() => {
    if (props.activityPhase === "writing") {
        return props.chapterNumber === null
            ? t("cockpit.phase.writing")
            : t("cockpit.activityWriting", {n: props.chapterNumber});
    }
    if (props.activityPhase === "workflow") {
        return props.activityFlowName ?? t("cockpit.phase.workflow");
    }
    return t("cockpit.phase.idle");
});

/** 绿呼吸点只在有活干时呼吸（场景 1 正常态「正在做」绿呼吸点）。 */
const activityDotClass = computed(() =>
    props.activityPhase === "idle" ? "cockpit-dot--idle" : "cockpit-dot--live animate-pulse",
);
</script>

<template>
    <section class="cockpit">
        <h3 class="cockpit-title">{{ t("cockpit.title") }}</h3>

        <!-- 状态区：四项常驻可见（T-5），任一项需展开才能看到即打回——纯展示不可点 -->
        <div class="cockpit-status">
            <div class="cockpit-line">
                <span class="cockpit-line-label">{{ t("cockpit.progressLabel") }}</span>
                <span class="cockpit-line-value">
                    {{
                        chapterNumber === null
                            ? t("cockpit.progressNone")
                            : t("cockpit.chapterValue", {n: chapterNumber})
                    }}
                </span>
            </div>
            <div class="cockpit-line">
                <span class="cockpit-dot" :class="activityDotClass" aria-hidden="true"></span>
                <span class="cockpit-line-label">{{ t("cockpit.activityLabel") }}</span>
                <span class="cockpit-line-value">{{ activityText }}</span>
            </div>
        </div>

        <!-- 待办区（T-1）：详情常显、无「展开收起」按钮；每行按钮化，hover 灰底+可按容器（宪法 2） -->
        <div class="cockpit-entries">
            <button
                type="button"
                class="cockpit-entry"
                :disabled="pendingCount === 0"
                @click="emit('open', 'pending')"
            >
                <span class="cockpit-entry-label">{{ t("cockpit.pendingRow", {count: pendingCount}) }}</span>
            </button>

            <button
                type="button"
                class="cockpit-entry"
                :disabled="foreshadowOpenCount === 0"
                @click="emit('open', 'foreshadow')"
            >
                <span class="cockpit-entry-label">{{ t("cockpit.foreshadowRow", {count: foreshadowOpenCount}) }}</span>
            </button>

            <!-- workflow 行：仅待应答数>0 渲染（场景 6 空态不留灰行）；多流程并发单行聚合（场景 6 极端） -->
            <div
                v-if="workflowPendingCount > 0"
                class="cockpit-entry cockpit-entry--workflow"
                :class="{'cockpit-entry--error': workflowError}"
            >
                <button type="button" class="cockpit-entry-hit" @click="emit('open', 'workflow')">
                    <span class="cockpit-entry-label">
                        {{
                            workflowError
                                ? t("cockpit.workflowError")
                                : t("cockpit.workflowRow", {count: workflowPendingCount})
                        }}
                    </span>
                </button>
                <!-- 快速处理横条：左缩进 12px+左竖线（宪法 5 层级语言），无卡片框 -->
                <div v-if="workflowError" class="cockpit-quickbar">
                    <button type="button" class="cockpit-quickbar-btn" @click="emit('retryWorkflow')">
                        {{ t("cockpit.workflowRetry") }}
                    </button>
                    <button type="button" class="cockpit-quickbar-btn" @click="emit('abandonWorkflow')">
                        {{ t("cockpit.workflowAbandon") }}
                    </button>
                </div>
            </div>
        </div>
    </section>
</template>

<style scoped>
.cockpit {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    background: var(--bg-panel);
}

.cockpit-title {
    margin: 0;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
}

.cockpit-status {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.cockpit-line {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    line-height: 20px;
}

.cockpit-line-label {
    flex-shrink: 0;
    color: var(--text-muted);
}

.cockpit-line-value {
    overflow: hidden;
    color: var(--text-main);
    text-overflow: ellipsis;
    white-space: nowrap;
}

.cockpit-dot {
    width: 8px;
    height: 8px;
    border-radius: 9999px;
    flex-shrink: 0;
}

.cockpit-dot--live {
    background: var(--status-success);
}

.cockpit-dot--idle {
    background: var(--text-muted);
}

.cockpit-entries {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

/* 待办行：rest 无框，hover 灰底做可按提示（D1：hover 灰底+可按容器满足宪法 2） */
.cockpit-entry {
    padding: 6px 8px;
    border: none;
    border-radius: 6px;
    background: transparent;
    text-align: left;
}

button.cockpit-entry:not(:disabled):hover,
.cockpit-entry--workflow:hover {
    background: var(--bg-hover);
}

button.cockpit-entry:disabled {
    cursor: default;
}

button.cockpit-entry:disabled .cockpit-entry-label {
    color: var(--text-muted);
}

.cockpit-entry-label {
    font-size: 13px;
    color: var(--text-main);
}

.cockpit-entry--error .cockpit-entry-label {
    color: var(--status-warning);
}

/* 错误行内层命中区：避免按钮嵌按钮，视觉与普通待办行同款 */
.cockpit-entry-hit {
    display: block;
    width: 100%;
    padding: 0;
    border: none;
    background: transparent;
    text-align: left;
    cursor: pointer;
}

/* 快速处理横条：左缩进 12px+左竖线（宪法 5 区间内），警示色描线 */
.cockpit-quickbar {
    display: flex;
    gap: 8px;
    margin-top: 6px;
    margin-left: 12px;
    padding-left: 12px;
    border-left: 2px solid var(--status-warning);
}

/* 横条内按钮必须带框或底色（宪法 2：可按的操作一律带容器，禁纯文字钮） */
.cockpit-quickbar-btn {
    padding: 2px 10px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-input);
    font-size: 12px;
    color: var(--text-main);
    cursor: pointer;
}

.cockpit-quickbar-btn:hover {
    background: var(--bg-hover);
}
</style>
