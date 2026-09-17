import {readFileSync} from "node:fs";
import {join} from "node:path";
import {afterEach, describe, expect, it} from "vitest";
import nbookTheme from "../nbook";
import type {NbColorwayVars} from "../../src/colorway/colorway-contract";
import {installTheme, resetInstalledThemes} from "../../src/theme/theme-loader";
import sepiaPaperTheme from "./index";

/**
 * sepia-paper 的自证。
 *
 * 为什么不能只靠 `src/theme/theme-packages.test.ts`：那个文件里的 `THEMES` 是**硬编码的四套**
 * （editorial / macos / aurora / nbook），新主题包不在其中，所以平台的通用闸门扫不到它。
 * 缺了这一份，「装得上 / 不许有字面色 / 三条不变量」这些约束对本主题就全是空话。
 *
 * 判据与那四套**逐条对齐**，不另立标准——一方主题和第三方主题走同一条装载路径，
 * 检查标准也就该是同一条。
 */

const THEME_DIR = import.meta.dirname;

function readVarsCss(): string {
    return readFileSync(join(THEME_DIR, "vars.css"), "utf-8");
}

/*
 * 只留声明、剥掉注释。
 *
 * 本仓在这上面踩过两次：扫 vars.css 找「有没有出现 X」若不剥注释，扫的是散文不是代码。
 * 第一次是「不许出现字面色」被注释里引用的原件取值绊倒；第二次是「用了就必须声明」
 * 被一段解释「某变量已删」的注释绊倒。本文件里注释写得很密（取值来源与偏离理由都在里面），
 * 所以这条更是必须的。
 */
function readVarsDeclarations(): string {
    return readVarsCss().replaceAll(/\/\*[\s\S]*?\*\//g, "");
}

afterEach(() => {
    resetInstalledThemes();
});

describe("sepia-paper theme package", () => {
    it("installs without throwing", () => {
        expect(() => installTheme(sepiaPaperTheme)).not.toThrow();
    });

    it("uses its directory name as the theme id", () => {
        expect(sepiaPaperTheme.manifest.id).toBe("sepia-paper");
    });

    it("declares a hostVersion the loader accepts", () => {
        // 复合范围（>=1.0.0 <2.0.0）会被拒绝且不猜结果，所以这里只确认它装得上
        expect(sepiaPaperTheme.manifest.hostVersion).toBeTruthy();
    });

    /*
     * 主题与配色正交：一旦 vars.css 里出现字面颜色，换一套配色就会露出一块与配色无关的死色，
     * 而现象是「某个主题下颜色不对」，很难定位。
     */
    it("keeps literal colours out of vars.css", () => {
        const css = readVarsDeclarations();

        expect(css.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [], "vars.css 出现了 hex 字面色").toEqual([]);

        const functional = css.match(/\b(?:rgba?|hsla?|oklch|oklab|lab|lch|color)\([^)]*\)/g) ?? [];
        // 唯一放行的是纯白 / 纯黑的低透明度叠层：镜面高光与内阴影表达的是「光」不是颜色
        const notLight = functional.filter((value) => !/^rgb\(\s*(?:255\s+255\s+255|0\s+0\s+0)\s*\//.test(value));

        expect(notLight, "这些取值既不是配色变量也不是纯白/纯黑叠层").toEqual([]);
    });

    it("gives every declared variable a value", () => {
        // 声明了却只吃 fallback = 声明本身没意义，且白占一个全局变量名
        const css = readVarsDeclarations();
        const unused = (sepiaPaperTheme.manifest.declares ?? []).filter(
            (declaration) => !css.includes(`${declaration.name}:`),
        );

        expect(unused.map((declaration) => declaration.name), "声明了这些变量却没给取值").toEqual([]);
    });

    it("never keys off a colourway id", () => {
        // 挂 [data-nb-colorway] 对用户自定义的暗色配色一律失效，且失效时不报错
        expect(readVarsDeclarations()).not.toContain("data-nb-colorway");
    });

    it("carries both an appearance split and a reduced-motion-safe motion scale", () => {
        const css = readVarsDeclarations();

        expect(css, "缺暗色分档").toContain('[data-nb-appearance="dark"]');
        // 本主题没有新增动效变量，所以只确认三档时长与缓动都在自己的块里给了值
        expect(css).toContain("--motion-fast:");
        expect(css).toContain("--motion-base:");
        expect(css).toContain("--motion-enter:");
        expect(css).toContain("--ease-standard:");
    });

    /*
     * 本主题相对 nbook 的两个论点必须**真的落在声明里**，不能只活在注释里。
     * 这两条断言的作用是：将来有人把低 chrome 调回去时，测试会告诉他这是主题身份不是随手取值。
     */
    describe("low-chrome identity", () => {
        it("drops the panel outline", () => {
            // 面板不描边，分层交给留白与底色差——低 chrome 最显性的一半
            expect(readVarsDeclarations()).toContain("--panel-outline: transparent;");
        });

        it("lets buttons carry no surface of their own", () => {
            // 按钮平时不显形，只剩一圈极淡描边；主操作由组件用 --accent-main 画实底
            expect(readVarsDeclarations()).toContain("--button-surface: transparent;");
        });

        it("turns decorative surfaces off", () => {
            const css = readVarsDeclarations();

            expect(css).toContain("--surface-raise: none;");
            expect(css).toContain("--elevation-raised: none;");
            expect(css).toContain("--overlay-sheen: none;");
        });

        it("keeps a visible focus ring even though chrome is quiet", () => {
            // 低 chrome 不能退到把无障碍一起退掉
            expect(readVarsDeclarations()).toContain("--focus-ring:");
        });
    });

    /*
     * 三条不变量。都在配色表里，不在 vars.css 里——vars.css 不许出现字面色，
     * 「纸比桌亮」只能靠 --page-surface 取 --bg-panel + 配色表保证 panel 恒亮于 main 来成立，
     * 所以必须验配色表本身，验 CSS 是验不到的。
     */
    describe("colourway invariants", () => {
        /** sRGB 加权亮度。只用来比大小，不做对比度判定，所以不做 gamma 线性化 */
        function luminance(hex: string): number {
            const value = Number.parseInt(hex.slice(1), 16);
            return (0.2126 * ((value >> 16) & 255) + 0.7152 * ((value >> 8) & 255) + 0.0722 * (value & 255)) / 255;
        }

        const CASES: [string, NbColorwayVars][] = Object.entries(sepiaPaperTheme.colorways ?? {});

        it("ships a light and a dark colourway", () => {
            expect(CASES.map(([id]) => id).sort()).toEqual(["sepia-paper-dark", "sepia-paper-light"]);
        });

        it.each(CASES)("keeps the page brighter than the desk in %s", (_id, vars) => {
            expect(luminance(vars["--bg-panel"] as string)).toBeGreaterThan(luminance(vars["--bg-main"] as string));
        });

        it.each(CASES)("never sinks the input below the panel it sits on in %s", (_id, vars) => {
            /*
             * 这一条是**本主题相对主仓 sepia 唯一一处刻意的修正**：主仓 sepia 的
             * --bg-input（#ebe0c8）比 --bg-panel（#fdf6e3）还暗，输入框成了挖在纸上的坑，
             * 正是 design-language.md 坑 #6 的形态。本主题改为不低于 panel。
             */
            expect(luminance(vars["--bg-input"] as string)).toBeGreaterThanOrEqual(
                luminance(vars["--bg-panel"] as string),
            );
        });

        it.each(CASES)("keeps the accent distinct from the warning status in %s", (_id, vars) => {
            // 写作工具里满屏都是草稿；「当前项」与「草稿」同色在余光里分不开
            expect(vars["--accent-main"]).not.toBe(vars["--status-warning"]);
        });

        it.each(CASES)("gives the two appearances different shadow recipes", () => {
            // 同一个百分比在深棕桌面上几乎看不见、在米色桌面上又太重
            const css = readVarsCss();
            const dark = css.slice(css.indexOf('[data-nb-appearance="dark"]'));

            expect(dark).toContain("--page-lift:");
        });
    });

    /*
     * 并存：市场形态下「装了 N 套、激活 1 套」是常态，本主题与产品默认主题必须能并存装载。
     */
    it("installs side by side with the shipped themes", () => {
        expect(() => {
            installTheme(nbookTheme);
            installTheme(sepiaPaperTheme);
        }).not.toThrow();
    });
});
