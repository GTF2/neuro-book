import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {describe, expect, it} from "vitest";
import {designTokens, reservedDesignTokens, themeBaselineTokens, themeDecorTokens, themeMetricTokens, themeRoleTokens} from "nbook/app/utils/theme/design-tokens";
import {themeVarNames} from "nbook/shared/theme/theme-vars";

const tokensCssPath = fileURLToPath(new URL("../../styles/design-tokens.css", import.meta.url));
const nbUiTokensPath = fileURLToPath(new URL("../../../../nb-ui/src/theme/tokens.ts", import.meta.url));
const nbUiColorwayPath = fileURLToPath(new URL("../../../../nb-ui/src/colorway/colorway-contract.ts", import.meta.url));

/**
 * 取出 CSS 里已声明的变量与取值。先剥注释，免得注释里提到的变量名被算成已声明。
 */
function readDeclaredValues(css: string): Map<string, string> {
    const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
    return new Map([...withoutComments.matchAll(/^\s*(--[a-z0-9-]+)\s*:\s*([^;]+);/gm)].map((match) => [match[1] as string, (match[2] as string).trim()]));
}

function readDeclaredTokens(css: string): Set<string> {
    return new Set(readDeclaredValues(css).keys());
}

/**
 * 取出 TS 名单文件里带引号的变量名。只认带引号的形式，注释里裸写的名字（如 `--elevation-*`）不会被算进来。
 */
function readQuotedTokens(source: string): Set<string> {
    return new Set([...source.matchAll(/"(--[a-z0-9-]+)"/g)].map((match) => match[1] as string));
}

describe("颜色契约与 nb-ui 的对齐", () => {
    it("keeps the 36-to-33 colour contract relationship locked", async () => {
        const upstream = readQuotedTokens(await readFile(nbUiColorwayPath, "utf8"));
        const ours = new Set<string>(themeVarNames.map((name) => `--${name}`));

        expect(upstream.size).toBe(33);
        expect(ours.size).toBe(36);

        // 关系：主仓 36 = nb-ui 33 − nb-ui 自有 3 + 主仓领域专用 6。
        // 两侧差集各自写死，任何一边偷偷增删变量都会在这里断掉。
        const nbUiOnly = ["--color-scheme", "--overlay-bg", "--shadow-panel"];
        const appOnly = ["--chat-ai-bg", "--editor-bg", "--source-bg", "--source-muted", "--source-text", "--toolbar-bg"];

        expect([...upstream].filter((key) => !ours.has(key)).sort()).toEqual(nbUiOnly);
        expect([...ours].filter((key) => !upstream.has(key)).sort()).toEqual(appOnly);
    });
});

/**
 * 取某个选择器块的主体文本。锚定行首，避免命中 @media 里缩进的同名选择器。
 */
function readSelectorBody(css: string, selector: string): string | null {
    const source = css.replace(/\/\*[\s\S]*?\*\//g, "");
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return source.match(new RegExp(`^${escaped}\\s*\\{([\\s\\S]*?)\\n\\}`, "m"))?.[1] ?? null;
}

describe("作用域约束：引用配色的 token 必须待在配色宿主上", () => {
    const colourVars = themeVarNames.map((name) => `--${name}`);

    it("rejects colour references inside the :root block", async () => {
        const body = readSelectorBody(await readFile(tokensCssPath, "utf8"), ":root");

        expect(body, "找不到 :root 块").toBeTruthy();

        const offenders = [...(body as string).matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)]
            .filter((match) => colourVars.some((colour) => (match[2] as string).includes(`var(${colour})`)))
            .map((match) => match[1] as string);

        // var() 在**声明它的元素**的上下文里解析。声明在 :root，computed value 就在 :root 求值，
        // 那里只有 theme-vars.css 的 sepia fallback；配色变量实际写在 .novel-ide-theme 的 inline style 上。
        // 后果是角色映射永远等于 sepia，换任何别的主题都不跟随（实测：宿主 --bg-panel 为 #ffffff 时，
        // :root 版 --panel-surface 仍返回 #fdf6e3，同一屏两套色温）。
        expect(offenders).toEqual([]);
    });

    it("keeps every colour-referencing token declared on the host", async () => {
        const body = readSelectorBody(await readFile(tokensCssPath, "utf8"), ".novel-ide-theme");

        expect(body, "找不到 .novel-ide-theme 块").toBeTruthy();

        const declaredOnHost = new Set([...(body as string).matchAll(/(--[a-z0-9-]+)\s*:/g)].map((match) => match[1] as string));
        const mustBeOnHost = ["--elevation-popover", "--elevation-dialog", "--focus-ring", "--focus-outline", ...themeRoleTokens];

        expect(mustBeOnHost).toHaveLength(18);
        for (const token of mustBeOnHost) {
            expect(declaredOnHost.has(token), `${token} 应当声明在 .novel-ide-theme 上`).toBe(true);
        }
    });
});

describe("design token 层", () => {
    it("五组设计 token 与三组主题层基线的分组齐备且无重名", () => {
        expect(designTokens).toHaveLength(33);
        expect(themeBaselineTokens).toHaveLength(30);
        expect(themeMetricTokens).toHaveLength(11);
        expect(themeDecorTokens).toHaveLength(5);
        expect(themeRoleTokens).toHaveLength(14);
        expect(new Set(reservedDesignTokens).size).toBe(reservedDesignTokens.length);
    });

    it("keeps design-tokens.css declaring exactly the registered tokens", async () => {
        const declared = readDeclaredTokens(await readFile(tokensCssPath, "utf8"));

        expect([...declared].sort()).toEqual([...reservedDesignTokens].sort());
    });

    it("keeps the token list aligned with nb-ui", async () => {
        const upstream = readQuotedTokens(await readFile(nbUiTokensPath, "utf8"));

        // nb-ui 的 nbReservedTokens 是 63 个：设计 token 33 + 主题层基线 30。
        // 数量先单独断言一次，避免上游把数组拆散后本用例静默变成「空集合也相等」。
        expect(upstream.size).toBe(63);
        expect([...reservedDesignTokens].sort()).toEqual([...upstream].sort());
    });

    it("keeps every role token defaulting to the colour variable it replaces", async () => {
        const declared = readDeclaredValues(await readFile(tokensCssPath, "utf8"));

        // 角色映射的默认值必须逐字指向它替代的那个配色变量。
        // 这是「消费方从 var(--bg-panel) 换成 var(--panel-surface) 时观感零变化」这个承诺的保证，
        // 也是后续调观感时能确认「动的只是角色，不是配色」的前提。
        // 只有 --overlay-blur / --overlay-sheen 不在此列：它们是 none，不对应任何配色变量。
        const expectedRoleDefaults: Array<[string, string]> = [
            ["--control-surface", "var(--bg-input)"],
            ["--control-outline", "var(--border-color)"],
            ["--button-surface", "var(--bg-input)"],
            ["--button-outline", "var(--border-color)"],
            ["--panel-surface", "var(--bg-panel)"],
            ["--panel-outline", "var(--border-color)"],
            ["--sidebar-surface", "var(--bg-sidebar)"],
            ["--toolbar-surface", "var(--bg-panel)"],
            ["--overlay-surface", "var(--bg-panel)"],
            ["--overlay-item-active", "var(--bg-hover)"],
            ["--strip-surface", "var(--bg-subtle)"],
            ["--divider", "var(--border-color)"],
        ];

        expect(expectedRoleDefaults).toHaveLength(themeRoleTokens.length - 2);
        for (const [token, value] of expectedRoleDefaults) {
            expect(declared.get(token), `${token} 的默认取值应当留在配色层`).toBe(value);
        }
    });

    it("keeps reduced-motion collapsing every duration token", async () => {
        const css = await readFile(tokensCssPath, "utf8");
        const block = css.match(/@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/);

        expect(block?.[1], "缺少 prefers-reduced-motion 兜底").toBeTruthy();
        for (const token of ["--motion-fast", "--motion-base", "--motion-enter"]) {
            expect(block?.[1]).toContain(`${token}: 0ms !important`);
        }
    });
});
