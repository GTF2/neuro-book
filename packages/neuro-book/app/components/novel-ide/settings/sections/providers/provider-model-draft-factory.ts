import type {
    ConfiguredModelDto,
    DiscoveredProviderModelDto,
    ModelLibraryEntryDto,
} from "nbook/shared/dto/app-settings.dto";
import {inspectModelCapability, selectModelApi} from "@notnotype/neuro-book-contracts/provider-config";

export type ModelCandidateSource = "remote" | "model-library" | "model-library-reference" | "provider-config" | "provider-template" | "user";

export type ModelCandidateProvenance = Partial<Record<
    "name" | "api" | "reasoning" | "input" | "contextWindowTokens" | "maxTokens" | "thinkingLevelMap" | "cost" | "compat" | "headers",
    ModelCandidateSource
>>;

/** 相近模型可参考的能力字段；`api` 不属于参考资料，由 Provider 配置决定。 */
export type ModelReferenceField = "reasoning" | "input" | "contextWindowTokens" | "maxTokens" | "thinkingLevelMap";

/**
 * 参考来源描述。`fields` 是当前值确实来自该相近模型的字段，
 * 界面必须逐字段标注，用户确认前不能当作已核实的资料。
 */
export type ModelReferenceInfo = {
    modelId: string;
    name: string;
    source: string;
    fields: ModelReferenceField[];
};

export type CompleteModelCandidate = {
    status: "complete";
    model: ConfiguredModelDto;
    provenance: ModelCandidateProvenance;
};

export type IncompleteModelCandidate = {
    status: "incomplete";
    candidate: Omit<ConfiguredModelDto, "enabled">;
    provenance: ModelCandidateProvenance;
    missingFields: string[];
    /** 已按相近模型预填、但仍缺字段时的参考来源；没有参考时缺省。 */
    reference?: ModelReferenceInfo;
};

export type ReferenceModelCandidate = {
    status: "reference";
    candidate: Omit<ConfiguredModelDto, "enabled">;
    provenance: ModelCandidateProvenance;
    /** 必填字段已由相近模型参考值补齐，必须经用户确认才能保存。 */
    reference: ModelReferenceInfo;
};

export type CompletedModelCandidate = CompleteModelCandidate | IncompleteModelCandidate | ReferenceModelCandidate;

/**
 * 将远程候选按字段补全为可保存模型。
 * 远端明确字段优先，精确命中的 Model Library 资料其次，同族参考条目只补仍然缺失的字段；
 * 只靠参考值补齐的候选得到 `reference` 状态，不会自动启用。
 */
export function completeModelCandidate(
    discovered: DiscoveredProviderModelDto,
    knowledge: ModelLibraryEntryDto | null,
    providerModelApi: ConfiguredModelDto["api"] = null,
    reference: ModelLibraryEntryDto | null = null,
): CompletedModelCandidate {
    // 精确资料与同族参考互斥：命中精确资料时参考不再参与，避免两个来源互相覆盖。
    const effectiveReference = knowledge ? null : reference;
    const api = selectModelApi(discovered.api, providerModelApi);
    const provenance: ModelCandidateProvenance = {
        name: "remote",
        ...(discovered.api ? {api: "remote" as const} : api ? {api: "provider-config" as const} : {}),
        ...(typeof discovered.reasoning === "boolean" ? {reasoning: "remote" as const} : {}),
        ...(discovered.input?.length ? {input: "remote" as const} : {}),
        ...(discovered.contextWindowTokens ? {contextWindowTokens: "remote" as const} : {}),
        ...(discovered.maxTokens ? {maxTokens: "remote" as const} : {}),
        ...(discovered.thinkingLevelMap ? {thinkingLevelMap: "remote" as const} : {}),
        ...(discovered.cost ? {cost: "remote" as const} : {}),
        ...(discovered.compat ? {compat: "remote" as const} : {}),
        ...(discovered.headers ? {headers: "remote" as const} : {}),
    };

    const candidate: Omit<ConfiguredModelDto, "enabled"> = {
        id: discovered.id,
        name: discovered.name,
        group: discovered.group,
        api,
        reasoning: discovered.reasoning ?? knowledge?.reasoning ?? effectiveReference?.reasoning ?? null,
        input: discovered.input ?? (knowledge ? [...knowledge.input] : effectiveReference ? [...effectiveReference.input] : null),
        contextWindowTokens: discovered.contextWindowTokens ?? knowledge?.contextWindowTokens ?? effectiveReference?.contextWindowTokens ?? null,
        maxTokens: discovered.maxTokens ?? knowledge?.maxTokens ?? effectiveReference?.maxTokens ?? null,
        thinkingLevelMap: discovered.thinkingLevelMap
            ?? (knowledge?.thinkingLevelMap ? {...knowledge.thinkingLevelMap} : effectiveReference?.thinkingLevelMap ? {...effectiveReference.thinkingLevelMap} : null),
        cost: discovered.cost,
        compat: discovered.compat,
        headers: discovered.headers,
    };

    if (knowledge) {
        if (typeof discovered.reasoning !== "boolean") provenance.reasoning = "model-library";
        if (!discovered.input?.length) provenance.input = "model-library";
        if (!discovered.contextWindowTokens) provenance.contextWindowTokens = "model-library";
        if (!discovered.maxTokens) provenance.maxTokens = "model-library";
        if (!discovered.thinkingLevelMap && knowledge.thinkingLevelMap) provenance.thinkingLevelMap = "model-library";
    }

    const referenceFields: ModelReferenceField[] = [];
    if (effectiveReference) {
        if (discovered.reasoning === null && candidate.reasoning !== null) {
            provenance.reasoning = "model-library-reference";
            referenceFields.push("reasoning");
        }
        if (!discovered.input?.length && candidate.input?.length) {
            provenance.input = "model-library-reference";
            referenceFields.push("input");
        }
        if (!discovered.contextWindowTokens && candidate.contextWindowTokens !== null) {
            provenance.contextWindowTokens = "model-library-reference";
            referenceFields.push("contextWindowTokens");
        }
        if (!discovered.maxTokens && candidate.maxTokens !== null) {
            provenance.maxTokens = "model-library-reference";
            referenceFields.push("maxTokens");
        }
        if (!discovered.thinkingLevelMap && candidate.thinkingLevelMap) {
            provenance.thinkingLevelMap = "model-library-reference";
            referenceFields.push("thinkingLevelMap");
        }
    }
    const referenceInfo: ModelReferenceInfo | null = effectiveReference && referenceFields.length > 0
        ? {modelId: effectiveReference.id, name: effectiveReference.name, source: effectiveReference.source, fields: referenceFields}
        : null;

    const missingFields = requiredModelFields(candidate);
    if (missingFields.length > 0) {
        return {status: "incomplete", candidate, provenance, missingFields, ...(referenceInfo ? {reference: referenceInfo} : {})};
    }
    if (referenceInfo) {
        return {status: "reference", candidate, provenance, reference: referenceInfo};
    }
    return {status: "complete", model: {...candidate, enabled: true}, provenance};
}

/** 从 Model Library 创建需要用户明确 API 的候选。 */
export function candidateFromLibrary(
    knowledge: ModelLibraryEntryDto,
    providerModelApi: ConfiguredModelDto["api"],
): CompletedModelCandidate {
    return completeModelCandidate({
        id: knowledge.id,
        name: knowledge.name,
        group: knowledge.source,
        api: null,
        reasoning: null,
        input: null,
        contextWindowTokens: null,
        maxTokens: null,
        cost: null,
        compat: null,
        headers: null,
        thinkingLevelMap: null,
    }, knowledge, providerModelApi);
}

/** 返回模型保存前必须补齐的字段。 */
export function requiredModelFields(model: Pick<ConfiguredModelDto, "api" | "reasoning" | "input" | "contextWindowTokens" | "maxTokens">): string[] {
    const fieldByIssueCode: Readonly<Record<string, string>> = {
        missing_api: "api",
        unsupported_api: "api",
        missing_reasoning: "reasoning",
        missing_input: "input",
        missing_context_window: "contextWindowTokens",
        missing_max_tokens: "maxTokens",
        max_tokens_exceeds_context: "maxTokens<=contextWindowTokens",
    };
    return inspectModelCapability("candidate", {
        id: "model",
        enabled: true,
        api: model.api,
        reasoning: model.reasoning,
        input: model.input,
        contextWindowTokens: model.contextWindowTokens,
        maxTokens: model.maxTokens,
    }).map((issue) => fieldByIssueCode[issue.code] ?? issue.code);
}
