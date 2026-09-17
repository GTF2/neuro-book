import type {ThemeVars} from "./theme-tokens";

/**
 * 界面观感档位。
 *
 * 解决的问题：界面里「线」和「面」是两种分层手段。默认档两者都开着，于是每个面板都是
 * 「底色 + 描边」，面板一多界面就只剩下线——这是「繁杂」最直接的来源。低 chrome 档
 * 把装饰性的线收掉，改由底色分层，观感立刻安静下来。
 *
 * **覆盖必须做在变量解析阶段，不能写成 CSS 规则。** 主题的 36 个颜色变量由
 * `apply-theme.ts` 写在宿主元素的 **inline style** 上，优先级高于任何选择器；
 * 写 `.novel-ide-theme[data-chrome="quiet"] { --border-color: … }` 会被静默压掉，
 * 现象是「档位切了但界面没变」。
 */

export const chromeLevels = ["full", "quiet"] as const;
export type ChromeLevel = typeof chromeLevels[number];

/** 默认档：与未引入档位时完全一致。 */
export const DEFAULT_CHROME_LEVEL: ChromeLevel = "full";

export const CHROME_LEVEL_STORAGE_KEY = "neurobook.chrome-level";

/**
 * 低 chrome 档保留的原线色比例（百分数），其余部分透出底色。
 *
 * 两处都是实测出来的，不是估计：
 * 1. **必须基于该主题自己的 --border-color**，不能「从文字色取固定比例」。各主题线色相对
 *    文字色的深浅本来就不一样（sepia 的 #d6c7a9 约在文字色 20% 处，light 的 #e5e7eb 更浅），
 *    固定比例会让一部分主题的线**变深**，与「退场」相反——实测 light 下取 20% 把线从
 *    #e5e7eb 加重到了 #cfd1d4。
 * 2. **退向 transparent，不要退向某个具体底色**。线分布在活动栏、面板、主区各种底上，
 *    写死一个底色就会在别的底上跑偏：试过退向 --bg-panel（白），结果线在灰色活动栏上
 *    距底色只剩 1，等于消失。半透明交给合成器，任何底色上都自动变淡。
 *
 * 55% 下实测 light 主题的线距底色从 18 降到约 10——退了一半，仍可辨。
 */
const QUIET_BORDER_KEEP = 55;

/**
 * 按档位解析变量表。
 *
 * 只收 `--border-color`，不动 `--border-strong`：后者承载 hover / focus / 可拖拽边界
 * 这类**功能性**边界，退场会让人找不到可操作区域；前者绝大多数场合只是「这里有一条缝」。
 *
 * 注意这里是**在 JS 里算出字面值**而不是生成 `var()` 引用：主题变量写在宿主的 inline style 上，
 * 生成的 var() 引用会在宿主上下文解析、拿到的可能是覆盖后的值。算出字面值还顺带避开了
 * 自定义属性的自引用循环（`--border-color: color-mix(… var(--border-color) …)` 是无效的）。
 */
export function resolveChromeVars(vars: ThemeVars, level: ChromeLevel): ThemeVars {
    if (level === "full") {
        return vars;
    }

    return {
        ...vars,
        "--border-color": `color-mix(in srgb, ${vars["--border-color"]} ${QUIET_BORDER_KEEP}%, transparent)`,
    };
}

/**
 * 解析持久化的档位值。未知值一律回退默认档——存储里的脏数据不该让界面变形。
 */
export function parseStoredChromeLevel(raw: string | null): ChromeLevel {
    return raw === "quiet" ? "quiet" : DEFAULT_CHROME_LEVEL;
}

export function serializeChromeLevel(level: ChromeLevel): string {
    return level;
}

/**
 * 从查询串读档位，供人眼验证用。
 *
 * 存在的理由是当前的验证局限：本环境起不了 dev server，档位的实际观感无法由改代码的人确认。
 * 一个 `?chrome=quiet` 就让 GTF 能在自己浏览器里直接看，不必先有设置界面。
 * 它**不写回存储**，是临时覆盖。
 */
export function readChromeLevelFromSearch(search: string): ChromeLevel | null {
    const value = new URLSearchParams(search).get("chrome");
    return value === "quiet" || value === "full" ? value : null;
}
