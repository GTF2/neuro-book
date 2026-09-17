import { chromeOverriddenTokens } from "./chrome-level";
import type { ThemeVars } from "./theme-tokens";
import { themeVarKeys } from "./theme-tokens";

/**
 * 清理宿主节点上的所有主题变量。
 *
 * 除主题自带的 36 个，还要清掉观感档位额外写入的角色映射 token：它们不在 `themeVarKeys` 里，
 * 漏清的话从「简洁」切回「标准」时内联覆写值会留下，侧栏一直保持退场状态，且看不出原因。
 */
export const clearThemeVars = (host: HTMLElement): void => {
    for (const key of themeVarKeys) {
        host.style.removeProperty(key);
    }
    for (const key of chromeOverriddenTokens) {
        host.style.removeProperty(key);
    }
};

/**
 * 将主题变量显式写入宿主节点。
 *
 * 接受 `ThemeVars` 之外的键是有意的：观感档位会在主题变量基础上追加角色映射 token。
 */
export const applyThemeVars = (host: HTMLElement, vars: Record<`--${string}`, string>): void => {
    clearThemeVars(host);

    for (const [key, value] of Object.entries(vars)) {
        host.style.setProperty(key, value);
    }
};
