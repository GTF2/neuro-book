import {describe, expect, it} from "vitest";
import {selectModelLibraryReference} from "nbook/shared/models/model-library-reference";
import type {ModelLibraryEntryDto} from "nbook/shared/dto/app-settings.dto";

describe("Model Library 同族参考匹配", () => {
    it("同版本时选择变体后缀重合最多的条目", () => {
        const match = selectModelLibraryReference("deepseek-v4-flash-vision-exp", library());
        expect(match?.entry.id).toBe("deepseek-v4-flash");
        expect(match?.sharedQualifiers).toEqual(["flash"]);
        expect(match?.versionDistance).toBe(0);
    });

    it("版本号距离最近的同族条目优先于变体后缀", () => {
        const match = selectModelLibraryReference("glm-5.3-flash", library());
        expect(match?.entry.id).toBe("glm-5.2");
        expect(match?.versionDistance).toBeCloseTo(0.1);
    });

    it("字母前缀版本词（k3 / k2.7）按数值比较", () => {
        expect(selectModelLibraryReference("kimi-k3", library())?.entry.id).toBe("kimi-k2.7-code");
    });

    it("目标没有版本号时由变体后缀决定", () => {
        const match = selectModelLibraryReference("deepseek-flash", library());
        expect(match?.entry.id).toBe("deepseek-v4-flash");
        expect(match?.versionDistance).toBeNull();
    });

    it("没有同族条目时不猜测", () => {
        expect(selectModelLibraryReference("longcat-2.0", library())).toBeNull();
    });

    it("同族但世代差距过大且无共同变体时不猜测", () => {
        const entries = [entry("deepseek-v9-pro", 1_000_000, 384_000)];
        expect(selectModelLibraryReference("deepseek-v4-flash", entries)).toBeNull();
    });

    it("命名空间与大小写不参与族名比较", () => {
        expect(selectModelLibraryReference("MiniMax-M3.5", library())?.entry.id).toBe("MiniMax-M3");
        expect(selectModelLibraryReference("glm-5.3", library())?.entry.id).toBe("glm-5.2");
    });

    it("排除与目标完全相同的条目", () => {
        const match = selectModelLibraryReference("glm-5.2", library());
        expect(match?.entry.id).not.toBe("glm-5.2");
    });

    it("同一输入重复匹配结果稳定", () => {
        const first = selectModelLibraryReference("glm-5.3", library());
        const second = selectModelLibraryReference("glm-5.3", library());
        expect(second?.entry.id).toBe(first?.entry.id);
    });
});

function library(): ModelLibraryEntryDto[] {
    return [
        entry("glm-5.2", 1_000_000, 131_072),
        entry("glm-5.1", 200_000, 131_072),
        entry("zai/glm-5.2", 1_000_000, 131_072),
        entry("glm-4.7-flash", 200_000, 131_072),
        entry("deepseek-v4-flash", 1_000_000, 384_000),
        entry("deepseek-v4-flash-free", 1_000_000, 384_000),
        entry("deepseek-v4-pro", 1_000_000, 384_000),
        entry("kimi-k2.7-code", 262_144, 262_144),
        entry("kimi-k2.6", 262_144, 262_144),
        entry("MiniMax-M3", 512_000, 128_000),
        entry("meituan/longcat-flash-thinking-2601", 32_768, 32_768),
    ];
}

function entry(id: string, contextWindowTokens: number, maxTokens: number): ModelLibraryEntryDto {
    return {
        id,
        name: id,
        source: "test",
        reasoning: true,
        thinkingLevelMap: null,
        input: ["text"],
        contextWindowTokens,
        maxTokens,
    };
}
