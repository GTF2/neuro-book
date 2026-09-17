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
 * 低 chrome 档下分隔线从文字色派生的比例（百分数）。
 *
 * 数值是估计值，**没有做渲染验证**——本环境起不了 dev server。它的作用是给验证一个
 * 起点，看完实际效果再调；偏保守是因为退得不够只是没效果，退过头会让面板糊成一片，
 * 而本轮的兜底手段（底色分层）在主仓的默认主题里对比度本来就偏弱。
 */
const QUIET_BORDER_MIX = 20;

/**
 * 按档位解析变量表。
 *
 * 只收 `--border-color`，不动 `--border-strong`：后者承载 hover / focus / 可拖拽边界
 * 这类**功能性**边界，退场会让人找不到可操作区域；前者绝大多数场合只是「这里有一条缝」。
 */
export function resolveChromeVars(vars: ThemeVars, level: ChromeLevel): ThemeVars {
    if (level === "full") {
        return vars;
    }

    return {
        ...vars,
        "--border-color": `color-mix(in srgb, ${vars["--text-main"]} ${QUIET_BORDER_MIX}%, transparent)`,
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
