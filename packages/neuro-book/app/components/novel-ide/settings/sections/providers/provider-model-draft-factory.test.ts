import {describe, expect, it} from "vitest";
import {completeModelCandidate} from "nbook/app/components/novel-ide/settings/sections/providers/provider-model-draft-factory";
import type {DiscoveredProviderModelDto, ModelLibraryEntryDto} from "nbook/shared/dto/app-settings.dto";

describe("Model Candidate Completion", () => {
    it("完整远程字段保持优先", () => {
        const result = completeModelCandidate(discovered({
            reasoning: false,
            input: ["text"],
            contextWindowTokens: 32_000,
            maxTokens: 4_000,
        }), knowledge());

        expect(result).toMatchObject({
            status: "complete",
            model: {enabled: true, contextWindowTokens: 32_000, maxTokens: 4_000, reasoning: false},
            provenance: {contextWindowTokens: "remote", maxTokens: "remote"},
        });
    });

    it("Model Library 只补远端缺失字段", () => {
        const result = completeModelCandidate(discovered({contextWindowTokens: 64_000}), knowledge());
        expect(result).toMatchObject({
            status: "complete",
            model: {contextWindowTokens: 64_000, maxTokens: 8_000, reasoning: true, input: ["text"]},
            provenance: {contextWindowTokens: "remote", maxTokens: "model-library", reasoning: "model-library"},
        });
    });

    it("OpenAI 发现无法判断接口时使用 Provider Config 的 Responses 格式", () => {
        const result = completeModelCandidate(discovered({api: null}), knowledge(), "openai-responses");
        expect(result).toMatchObject({
            status: "complete",
            model: {api: "openai-responses"},
            provenance: {api: "provider-config"},
        });
    });

    it("未补全候选不产生可持久化 model", () => {
        const result = completeModelCandidate(discovered({api: null}), null);
        expect(result).toMatchObject({status: "incomplete"});
        expect(result).not.toHaveProperty("model");
        if (result.status === "incomplete") {
            expect(result.missingFields).toEqual(expect.arrayContaining(["api", "reasoning", "input", "contextWindowTokens", "maxTokens"]));
        }
    });

    it("同族参考值补齐缺失字段并声明来源", () => {
        const result = completeModelCandidate(discovered({api: null}), null, "openai-completions", reference());
        if (result.status !== "reference") {
            throw new Error("期望参考候选");
        }
        expect(result.candidate).toMatchObject({
            api: "openai-completions",
            contextWindowTokens: 1_000_000,
            maxTokens: 384_000,
            reasoning: true,
            input: ["text"],
            thinkingLevelMap: {high: "high"},
        });
        expect(result.reference).toEqual({
            modelId: "deepseek-v4-flash",
            name: "DeepSeek V4 Flash",
            source: "deepseek",
            fields: ["reasoning", "input", "contextWindowTokens", "maxTokens", "thinkingLevelMap"],
        });
        expect(result.provenance).toMatchObject({
            reasoning: "model-library-reference",
            input: "model-library-reference",
            contextWindowTokens: "model-library-reference",
            maxTokens: "model-library-reference",
            thinkingLevelMap: "model-library-reference",
        });
    });

    it("参考值不覆盖远端字段，且不参与 api 判定", () => {
        const result = completeModelCandidate(discovered({api: null, reasoning: false}), null, null, reference());
        if (result.status !== "incomplete") {
            throw new Error("期望不完整候选");
        }
        expect(result.missingFields).toEqual(["api"]);
        expect(result.candidate.contextWindowTokens).toBe(1_000_000);
        expect(result.provenance.reasoning).toBe("remote");
        expect(result.reference?.fields).toEqual(["input", "contextWindowTokens", "maxTokens", "thinkingLevelMap"]);
    });

    it("精确资料优先于同族参考", () => {
        const result = completeModelCandidate(discovered({api: null}), knowledge(), "openai-completions", reference());
        expect(result).toMatchObject({status: "complete", provenance: {maxTokens: "model-library"}});
    });

    it("参考条目没有的字段不声明来源", () => {
        const result = completeModelCandidate(discovered({api: null}), null, null, {...reference(), thinkingLevelMap: null, input: []});
        if (result.status !== "incomplete") {
            throw new Error("期望不完整候选");
        }
        expect(result.reference?.fields).toEqual(["reasoning", "contextWindowTokens", "maxTokens"]);
        expect(result.missingFields).toContain("input");
    });
});

function discovered(overrides: Partial<DiscoveredProviderModelDto> = {}): DiscoveredProviderModelDto {
    return {
        id: "model",
        name: "Remote Model",
        group: null,
        api: "openai-completions",
        reasoning: null,
        input: null,
        contextWindowTokens: null,
        maxTokens: null,
        cost: null,
        compat: null,
        headers: null,
        thinkingLevelMap: null,
        ...overrides,
    };
}

function knowledge(): ModelLibraryEntryDto {
    return {
        id: "model",
        name: "Library Model",
        source: "vendor",
        reasoning: true,
        thinkingLevelMap: null,
        input: ["text"],
        contextWindowTokens: 128_000,
        maxTokens: 8_000,
    };
}

/** 同族参考条目：ID 与目标不同，能力资料比精确资料更宽松。 */
function reference(): ModelLibraryEntryDto {
    return {
        id: "deepseek-v4-flash",
        name: "DeepSeek V4 Flash",
        source: "deepseek",
        reasoning: true,
        thinkingLevelMap: {high: "high"},
        input: ["text"],
        contextWindowTokens: 1_000_000,
        maxTokens: 384_000,
    };
}
