import {PLANNING_TONE_CLASSES, type PlanningTone} from "nbook/app/components/novel-ide/plot/planning/plot-planning.types";
import {
    MAX_STORY_NAME_LENGTH,
    MAX_STORY_NOTE_LENGTH,
    MAX_STORY_TITLE_LENGTH,
} from "nbook/shared/dto/plot.dto";
import type {
    CreateStoryKeyframeRequestDto,
    StoryKeyframeDto,
    StoryKeyframeSourceDto,
    StoryKeyframeStatusDto,
    UpdateStoryKeyframeRequestDto,
} from "nbook/shared/dto/plot.dto";

/**
 * 关键帧(写作宪法第三条)UI 纯逻辑:排序、草稿校验、状态流转不变式。
 *
 * 与 `docs/specs/plot/keyframe.md` 的「关键不变量」逐条对应:
 * - 创建恒 `pending`(创建载荷不接受 `status` / `decisionRefId`);
 * - 非 `pending` 帧不可改回 `pending`(回撞流转单向);
 * - `overthrown` 必须挂 `decisionRefId`(宪法第六条推翻留痕);
 * - `instant` 必须是非负整数字符串;
 * - `name` 同 Story 唯一。
 *
 * 这里只放视觉元数据与文案键,标签文案一律走 i18n(`plotKeyframe.*`),不硬编码中文。
 */

/** 帧状态视觉元数据;标签文案键为 `plotKeyframe.status.<status>`。 */
export const KEYFRAME_STATUS_META: Record<StoryKeyframeStatusDto, {tone: PlanningTone; iconClass: string}> = {
    // 已声明未回撞:待办语义用 warning。
    pending: {tone: "warning", iconClass: "i-lucide-clock"},
    // 回撞通过或裁决维持:可用事实用 success。
    confirmed: {tone: "success", iconClass: "i-lucide-shield-check"},
    // 回撞发现冲突待裁决:需要作者介入用 danger。
    violated: {tone: "danger", iconClass: "i-lucide-triangle-alert"},
    // 裁决推翻:已定案存档用 muted。
    overthrown: {tone: "muted", iconClass: "i-lucide-gavel"},
};

/** 帧来源视觉元数据;标签文案键为 `plotKeyframe.source.<source>`。 */
export const KEYFRAME_SOURCE_META: Record<StoryKeyframeSourceDto, {tone: PlanningTone; iconClass: string}> = {
    author: {tone: "info", iconClass: "i-lucide-user-pen"},
    derived: {tone: "muted", iconClass: "i-lucide-wand-sparkles"},
};

/** 色调 → 主题变量 class 串(与规划层账本共用同一套状态语义)。 */
export const KEYFRAME_TONE_CLASSES = PLANNING_TONE_CLASSES;

/** 不可逆变化条数上限,与 `CreateStoryKeyframeRequestDtoSchema` 的 `.max(50)` 一致。 */
export const MAX_IRREVERSIBLE_CHANGES = 50;

/** `name` 允许的形态,与 `StoryNameSchema` 正则一致(小写字母/数字/中划线分段)。 */
const KEYFRAME_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

/** `instant` 允许的形态:非负整数字符串(bigint 的字符串形式)。 */
const INSTANT_PATTERN = /^\d+$/u;

/** 编辑器草稿:一行一条不可逆变化,提交时按行拆成声明式事实列表。 */
export type KeyframeDraft = {
    name: string;
    title: string;
    instant: string;
    irreversibleChangesText: string;
    note: string;
};

/** 校验失败的定位字段,供对话框做字段级标红。 */
export type KeyframeField = "name" | "title" | "instant" | "irreversibleChanges" | "note" | "status" | "decisionRefId";

/** 校验失败原因;文案键为 `plotKeyframe.editor.errors.<code>`。 */
export type KeyframeDraftErrorCode =
    | "nameRequired"
    | "nameFormat"
    | "nameTooLong"
    | "nameDuplicate"
    | "titleRequired"
    | "titleTooLong"
    | "instantRequired"
    | "instantFormat"
    | "changesRequired"
    | "changesTooMany"
    | "noteTooLong"
    | "statusRevertToPending"
    | "decisionRefRequired";

export type KeyframeDraftValidation =
    | {ok: true; body: CreateStoryKeyframeRequestDto | UpdateStoryKeyframeRequestDto}
    | {ok: false; field: KeyframeField; code: KeyframeDraftErrorCode};

/**
 * 把多行文本解析成不可逆变化列表:按行切分,逐条 trim,丢弃空行。
 * 与仓储层的列表语义一致:数组即声明式事实列表,不做去重(去重会改变作者的声明意图)。
 */
export function parseIrreversibleChanges(text: string): string[] {
    return text
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
}

/** 不可逆变化列表回填多行文本(编辑态草稿)。 */
export function joinIrreversibleChanges(changes: readonly string[]): string {
    return changes.join("\n");
}

/**
 * 帧在界面上的时刻文案。
 *
 * 决策:显示原始 instant 数字,不做日历换算——日历格式化在 server 侧由项目 `world-engine/calendar.ts`
 * 驱动的 `WorldCalendar.format(instant)` 提供(支持自定义 strategy,配置本身是可执行 TS),
 * 前端既无配置也没有格式化实现;`StoryKeyframeDto` 也不带日历时间字段(对比 Scene 的 `startTime`
 * 是服务端 `scene-world-anchor-resolution.service.ts` 用 `formatTime` 补出的)。
 */
export function formatKeyframeInstant(instant: string): string {
    return instant.trim();
}

/** 单个帧排序键:instant 升序,同 instant 时按 id 升序(与服务的返回顺序一致)。 */
function compareKeyframeOrder(left: StoryKeyframeDto, right: StoryKeyframeDto): number {
    return compareNumericString(left.instant, right.instant) || compareNumericString(left.id, right.id);
}

/** 非负整数字符串按数值比较(实体 id 与 instant 都是字符串承载的 bigint)。 */
function compareNumericString(left: string, right: string): number {
    const leftValue = BigInt(left);
    const rightValue = BigInt(right);
    if (leftValue === rightValue) {
        return 0;
    }
    return leftValue < rightValue ? -1 : 1;
}

/**
 * 按故事时间升序排序(不改动入参)。
 * 服务已按 instant 升序返回,这里再排一次是为了让界面顺序不依赖后端字段顺序,排序空转不会改变结果。
 */
export function sortKeyframesByInstant(keyframes: readonly StoryKeyframeDto[]): StoryKeyframeDto[] {
    return [...keyframes].sort(compareKeyframeOrder);
}

/**
 * 校验并组装写请求载荷。
 *
 * 校验规则与 `shared/dto/plot.dto.ts` 的 Create/Update schema 保持一致(同一套正则与长度上限),
 * 这里手写而非复用 zod schema:前端现状不 import DTO schema(避免把 zod 拉进客户端产物),
 * 服务端仍是最终裁决者,此处只做提交前的前置拦截。
 *
 * create:恒为 `author` 来源、恒 `pending`——载荷不含 `status` / `decisionRefId`。
 * edit:PATCH 语义,`status` 仅在变化时提交;`decisionRefId` 只在置为 `overthrown` 时提交(其余不动原值)。
 */
export function validateKeyframeDraft(input: {
    mode: "create" | "edit";
    draft: KeyframeDraft;
    // 同 Story 已有帧的 name,用于唯一性前置检查。
    existingNames: readonly string[];
    // 编辑态当前帧;create 时为 null。
    current: StoryKeyframeDto | null;
    // 编辑态提交的目标状态;create 恒 pending,该字段被忽略。
    nextStatus: StoryKeyframeStatusDto;
    // 编辑态裁决留痕(创作决策记录 id);create 忽略。
    decisionRefId: string;
}): KeyframeDraftValidation {
    const {draft, mode, current} = input;
    const name = draft.name.trim();
    if (!name) {
        return {ok: false, field: "name", code: "nameRequired"};
    }
    if (!KEYFRAME_NAME_PATTERN.test(name)) {
        return {ok: false, field: "name", code: "nameFormat"};
    }
    if (name.length > MAX_STORY_NAME_LENGTH) {
        return {ok: false, field: "name", code: "nameTooLong"};
    }
    // 编辑态排除自身 name,重名只对其它帧成立。
    const takenNames = mode === "edit" && current
        ? input.existingNames.filter((item) => item !== current.name)
        : input.existingNames;
    if (takenNames.includes(name)) {
        return {ok: false, field: "name", code: "nameDuplicate"};
    }

    const title = draft.title.trim();
    if (!title) {
        return {ok: false, field: "title", code: "titleRequired"};
    }
    if (title.length > MAX_STORY_TITLE_LENGTH) {
        return {ok: false, field: "title", code: "titleTooLong"};
    }

    const instant = draft.instant.trim();
    if (!instant) {
        return {ok: false, field: "instant", code: "instantRequired"};
    }
    if (!INSTANT_PATTERN.test(instant)) {
        return {ok: false, field: "instant", code: "instantFormat"};
    }

    const irreversibleChanges = parseIrreversibleChanges(draft.irreversibleChangesText);
    if (irreversibleChanges.length === 0) {
        return {ok: false, field: "irreversibleChanges", code: "changesRequired"};
    }
    if (irreversibleChanges.length > MAX_IRREVERSIBLE_CHANGES) {
        return {ok: false, field: "irreversibleChanges", code: "changesTooMany"};
    }

    const note = draft.note.trim();
    if (note.length > MAX_STORY_NOTE_LENGTH) {
        return {ok: false, field: "note", code: "noteTooLong"};
    }

    if (mode === "create") {
        return {
            ok: true,
            body: {
                name,
                title,
                instant,
                irreversibleChanges,
                // 人写帧:来源恒为 author(服务端缺省同值,这里显式声明意图)。
                source: "author",
                // 空备注映射 null;创建恒 pending,不提交 status。
                note: note.length > 0 ? note : null,
            },
        };
    }

    const nextStatus = input.nextStatus;
    if (current && current.status !== "pending" && nextStatus === "pending") {
        return {ok: false, field: "status", code: "statusRevertToPending"};
    }
    const decisionRefId = input.decisionRefId.trim();
    if (nextStatus === "overthrown" && decisionRefId.length === 0 && (current?.decisionRefId ?? null) === null) {
        return {ok: false, field: "decisionRefId", code: "decisionRefRequired"};
    }

    const body: UpdateStoryKeyframeRequestDto = {
        name,
        title,
        instant,
        irreversibleChanges,
        note: note.length > 0 ? note : null,
    };
    // status 仅在变化时提交;decisionRefId 只在置为 overthrown 时提交,避免误清已有留痕。
    if (current && nextStatus !== current.status) {
        body.status = nextStatus;
    }
    if (nextStatus === "overthrown" && decisionRefId.length > 0) {
        body.decisionRefId = decisionRefId;
    }
    return {ok: true, body};
}
