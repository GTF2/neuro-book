import {describe, expect, it} from "vitest";
import {themeTokens} from "nbook/app/utils/theme/theme-tokens";
import {
    DEFAULT_CHROME_LEVEL,
    chromeLevels,
    parseStoredChromeLevel,
    readChromeLevelFromSearch,
    resolveChromeVars,
    serializeChromeLevel,
} from "nbook/app/utils/theme/chrome-level";

const sepia = themeTokens.sepia;

describe("观感档位", () => {
    it("默认档与未引入档位时完全一致", () => {
        expect(DEFAULT_CHROME_LEVEL).toBe("full");
        expect(resolveChromeVars(sepia, "full")).toEqual(sepia);
    });

    it("低 chrome 档只收装饰性分隔线，不动功能性边界", () => {
        const resolved = resolveChromeVars(sepia, "quiet");

        expect(resolved["--border-color"]).not.toBe(sepia["--border-color"]);
        // --border-strong 承载 hover / focus / 可拖拽边界，退场会让人找不到可操作区域
        expect(resolved["--border-strong"]).toBe(sepia["--border-strong"]);
        expect(resolved["--border-accent"]).toBe(sepia["--border-accent"]);
    });

    it("低 chrome 档的分隔线从文字色派生，明暗主题各自跟对方向", () => {
        for (const themeId of ["sepia", "dark"] as const) {
            const vars = themeTokens[themeId];
            const derived = resolveChromeVars(vars, "quiet")["--border-color"];

            expect(derived).toContain(vars["--text-main"]);
            expect(derived).toContain("color-mix(in srgb");
            expect(derived).toContain("transparent");
        }
    });

    it("除分隔线外，其余变量逐字保留", () => {
        const resolved = resolveChromeVars(sepia, "quiet");
        const changed = (Object.keys(sepia) as Array<keyof typeof sepia>).filter((key) => resolved[key] !== sepia[key]);

        expect(changed).toEqual(["--border-color"]);
    });

    it("不修改传入的变量表", () => {
        const snapshot = {...sepia};
        resolveChromeVars(sepia, "quiet");

        expect(sepia).toEqual(snapshot);
    });
});

describe("档位持久化与查询串", () => {
    it("未知或缺失的存储值一律回退默认档", () => {
        expect(parseStoredChromeLevel(null)).toBe("full");
        expect(parseStoredChromeLevel("")).toBe("full");
        expect(parseStoredChromeLevel("QUIET")).toBe("full");
        expect(parseStoredChromeLevel("low")).toBe("full");
        expect(parseStoredChromeLevel("quiet")).toBe("quiet");
    });

    it("每个档位都能往返一次", () => {
        for (const level of chromeLevels) {
            expect(parseStoredChromeLevel(serializeChromeLevel(level))).toBe(level);
        }
    });

    it("从查询串读档位，认不出的值当作没给", () => {
        expect(readChromeLevelFromSearch("?chrome=quiet")).toBe("quiet");
        expect(readChromeLevelFromSearch("?chrome=full")).toBe("full");
        expect(readChromeLevelFromSearch("?chrome=loud")).toBeNull();
        expect(readChromeLevelFromSearch("?other=1")).toBeNull();
        expect(readChromeLevelFromSearch("")).toBeNull();
    });
});
