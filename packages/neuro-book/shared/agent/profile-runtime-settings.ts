import {z} from "zod";
import {MAX_AGENT_DIFF_MAX_CHARS} from "nbook/shared/agent/file-change-policy";

export const SummarizerIntervalSchema = z.object({
    kind: z.enum(["sourceInvocation", "dialogueContentTokens"]),
    value: z.number().positive(),
}).strict();

export const CompactionTriggerSchema = z.discriminatedUnion("kind", [
    z.object({kind: z.literal("autoReserve")}).strict(),
    z.object({kind: z.literal("percent"), value: z.number().gt(0).max(1)}).strict(),
    z.object({kind: z.literal("tokens"), value: z.number().int().positive()}).strict(),
]);

export const CompactionKeepRecentSchema = z.discriminatedUnion("kind", [
    z.object({kind: z.literal("percent"), value: z.number().gt(0).max(1)}).strict(),
    z.object({kind: z.literal("tokens"), value: z.number().int().positive()}).strict(),
]);

export const ProfileSummarizerRuntimePatchSchema = z.object({
    enabled: z.boolean().optional(),
    profileKey: z.string().trim().min(1).optional(),
    trigger: z.literal("afterInvocation").optional(),
    interval: SummarizerIntervalSchema.optional(),
    maxDialogueContentTokens: z.number().positive().optional(),
}).strict();

export const ProfileCompactionRuntimePatchSchema = z.object({
    enabled: z.boolean().optional(),
    trigger: CompactionTriggerSchema.optional(),
    reserveTokens: z.number().int().positive().optional(),
    keepRecent: CompactionKeepRecentSchema.optional(),
    prompt: z.string().trim().min(1).optional(),
    summaryPrefix: z.string().trim().min(1).optional(),
}).strict();

export const ProfileFileChangeNoticeRuntimePatchSchema = z.object({
    diffMaxChars: z.number().int().min(0).max(MAX_AGENT_DIFF_MAX_CHARS).optional(),
}).strict();

/** 辅助任务（解释这一步 / 增强提示词）的模型覆盖；`null` 表示显式跟随所属 Profile 的模型。 */
export const ProfileAuxiliaryRuntimePatchSchema = z.object({
    modelKey: z.string().trim().min(1).nullable().optional(),
}).strict();

export const ProfileRuntimeSettingsPatchSchema = z.object({
    summarizer: ProfileSummarizerRuntimePatchSchema.optional(),
    compaction: ProfileCompactionRuntimePatchSchema.optional(),
    fileChangeNotice: ProfileFileChangeNoticeRuntimePatchSchema.optional(),
    auxiliary: ProfileAuxiliaryRuntimePatchSchema.optional(),
}).strict();

export type SummarizerInterval = {
    kind: "sourceInvocation" | "dialogueContentTokens";
    value: number;
};

export type ProfileSummarizerRuntimePatch = {
    enabled?: boolean;
    profileKey?: string;
    trigger?: "afterInvocation";
    interval?: SummarizerInterval;
    maxDialogueContentTokens?: number;
};

export type CompactionTrigger =
    | {kind: "autoReserve"}
    | {kind: "percent"; value: number}
    | {kind: "tokens"; value: number};

export type CompactionKeepRecent =
    | {kind: "percent"; value: number}
    | {kind: "tokens"; value: number};

export type ProfileCompactionRuntimePatch = {
    enabled?: boolean;
    trigger?: CompactionTrigger;
    reserveTokens?: number;
    keepRecent?: CompactionKeepRecent;
    prompt?: string;
    summaryPrefix?: string;
};

export type ProfileFileChangeNoticeRuntimePatch = {
    diffMaxChars?: number;
};

export type ProfileAuxiliaryRuntimePatch = {
    /** `null` 与省略的区别只在语义上：前者是「显式跟随 Profile 模型」，后者是「本层不表态」。 */
    modelKey?: string | null;
};

/** Profile 通用运行策略 patch；每个子字段独立继承，判别联合对象整体替换。 */
export type ProfileRuntimeSettingsPatch = {
    summarizer?: ProfileSummarizerRuntimePatch;
    compaction?: ProfileCompactionRuntimePatch;
    fileChangeNotice?: ProfileFileChangeNoticeRuntimePatch;
    auxiliary?: ProfileAuxiliaryRuntimePatch;
};

export type ProfileRuntimeSettings = {
    summarizer: {
        enabled: boolean;
        profileKey: string;
        trigger: "afterInvocation";
        interval: SummarizerInterval;
        maxDialogueContentTokens: number;
    };
    compaction: {
        enabled: boolean;
        trigger: CompactionTrigger;
        reserveTokens: number;
        keepRecent: CompactionKeepRecent;
        prompt: string;
        summaryPrefix: string;
    };
    fileChangeNotice: {
        diffMaxChars: number;
    };
    auxiliary: {
        /**
         * 辅助任务（解释这一步 / 增强提示词）使用的模型 key。
         *
         * `null` 表示跟随所属 Profile 的模型，与未配置时的行为完全一致；
         * 指定值不可用时由调用方回退到 Profile 模型，不允许让辅助功能整体不可用。
         */
        modelKey: string | null;
    };
};

/** Profile 默认值允许携带 summarizer 自定义 initial 扩展字段。 */
export type ProfileRuntimeDefaults = ProfileRuntimeSettingsPatch;
