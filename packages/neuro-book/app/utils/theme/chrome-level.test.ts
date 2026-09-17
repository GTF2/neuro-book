import {describe, expect, it} from "vitest";
import {ideThemeIds, themeTokens} from "nbook/app/utils/theme/theme-tokens";
import {
    DEFAULT_CHROME_LEVEL,
    chromeLevels,
    chromeOverriddenTokens,
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

    it("低 chrome 档基于该主题自己的线色、退向透明", () => {
        for (const themeId of ideThemeIds) {
            const vars = themeTokens[themeId];
            const derived = resolveChromeVars(vars, "quiet")["--border-color"];

            // 基于本主题线色，而不是文字色：各主题线色相对文字色的深浅本来就不一样，
            // 取固定比例会让一部分主题的线**变深**（实测 light 主题下从文字色取 20%，
            // 把线从 #e5e7eb 加重到了 #cfd1d4，与「退场」相反）。
            expect(derived).toContain(vars["--border-color"]);
            // 退向透明而不是某个具体底色：线坐在活动栏、面板、主区各种底上，
            // 写死底色会在别的底上跑偏（试过 --bg-panel，线在灰色活动栏上距底色只剩 1，等于消失）。
            expect(derived).toContain("transparent");
            expect(derived).not.toContain(vars["--text-main"]);
        }
    });

    it("低 chrome 档只动这三样，其余主题变量逐字保留", () => {
        const resolved = resolveChromeVars(sepia, "quiet");
        const changed = (Object.keys(sepia) as Array<keyof typeof sepia>).filter((key) => resolved[key] !== sepia[key]);

        // 收线一处 + 退面两处（活动栏底色、角色映射的面）。别的都不许动——
        // 尤其 --editor-bg（稿面本身）和 --bg-panel（541 处消费，弹层/卡片/对话面都在用）。
        expect(changed.sort()).toEqual(["--bg-sidebar", "--border-color"]);
    });

    it("低 chrome 档把导航 chrome 统一退到 app 底色", () => {
        for (const themeId of ideThemeIds) {
            const vars = themeTokens[themeId];
            const resolved = resolveChromeVars(vars, "quiet");

            // 活动栏与工具面板归到同一个 app 底色 → 合成一层安静的底
            expect(resolved["--bg-sidebar"]).toBe(vars["--bg-main"]);
            expect(resolved["--panel-surface"]).toBe(vars["--bg-main"]);
            // 稿面自己不许被退掉，否则「唯一的亮面」就不存在了
            expect(resolved["--editor-bg"]).toBe(vars["--editor-bg"]);
            expect(resolved["--bg-panel"]).toBe(vars["--bg-panel"]);
        }
    });

    it("档位额外覆写的 token 有登记，切回标准档时才清得掉", () => {
        // resolveChromeVars 在简洁档会写入 themeVarKeys 之外的角色映射 token。
        // 它们必须登记在 chromeOverriddenTokens 里，否则 applyThemeVars 的清理漏掉它们，
        // 从简洁切回标准时内联值会残留，侧栏一直退场且看不出原因。
        const resolved = resolveChromeVars(sepia, "quiet");
        const themeKeys = new Set<string>(Object.keys(sepia));
        const extra = Object.keys(resolved).filter((key) => !themeKeys.has(key));

        expect(extra.sort()).toEqual([...chromeOverriddenTokens].sort());
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
