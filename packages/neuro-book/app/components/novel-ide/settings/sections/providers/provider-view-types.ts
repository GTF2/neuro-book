import type {ModelSettingsModelDraft} from "nbook/app/components/novel-ide/settings/sections/providers/provider-settings-draft";
import type {ModelReferenceField, ModelReferenceInfo} from "nbook/app/components/novel-ide/settings/sections/providers/provider-model-draft-factory";
import type {ConfiguredModelDto, ModelLibraryEntryDto} from "nbook/shared/dto/app-settings.dto";
import type {DiscoveryDiagnosticsDto} from "nbook/shared/dto/app-settings.dto";
import type {ProviderConfigIssue} from "@notnotype/neuro-book-contracts/provider-config";

export type ModelCheckView = {
    success: boolean;
    latencyMs: number | null;
    message: string;
    cancelled?: boolean;
};

export type SavedModelView = {
    model: ModelSettingsModelDraft;
    apiLabel: string;
    apiSourceLabel: string;
    contextWindowLabel: string;
    issues: ProviderConfigIssue[];
    checkResult: ModelCheckView | null;
    checking: boolean;
    runnable: boolean;
};

export type SavedModelGroupView = {
    group: string;
    models: SavedModelView[];
};

export type DiscoveryListModel = {
    name: string;
    id: string;
    group: string;
    state: "enabled" | "disabled" | "remote-complete" | "remote-reference" | "remote-incomplete";
    /** 可直接启用的完整模型；仅 `remote-complete` 提供。 */
    completeModel?: ConfiguredModelDto;
    /** 需要用户确认的候选；`remote-reference` 与 `remote-incomplete` 提供。 */
    candidate?: Omit<ConfiguredModelDto, "enabled">;
    /** 候选中来自相近模型、必须标注的字段；没有参考时缺省。 */
    reference?: ModelReferenceInfo;
};

export type DiscoveryModelGroup = {
    group: string;
    models: DiscoveryListModel[];
};

/**
 * 模型编辑窗口的相近参考视图：精确未命中 Model Library 时，
 * `fillableFields` 是还能补的缺失字段，`appliedFields` 是当前值确实来自参考、必须标注的字段。
 */
export type ModelReferenceView = {
    modelId: string;
    name: string;
    source: string;
    fillableFields: ModelReferenceField[];
    appliedFields: ModelReferenceField[];
};

export type DiscoveryDiagnosticsView = DiscoveryDiagnosticsDto;

export type ModelLibraryGroup = {
    group: string;
    models: ModelLibraryEntryDto[];
};

export type ManualModelDraft = {
    name: string;
    id: string;
    api: string;
    group: string;
    contextWindowTokens: string;
    maxTokens: string;
};

/** 模型设置跨TS/Vue边界使用的下拉项；结构与FormSelect的公开props一致。 */
export type ModelApiOption = {
    value: string;
    label: string;
    description?: string;
    iconClass?: string;
    indicatorClass?: string;
};
