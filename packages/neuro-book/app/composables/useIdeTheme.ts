import type { Ref } from "vue";
import {chromeLevel, restoreChromeLevel} from "nbook/app/composables/useChromeLevel";
import { applyThemeVars } from "nbook/app/utils/theme/apply-theme";
import {resolveChromeVars} from "nbook/app/utils/theme/chrome-level";
import { IDE_THEME_HOST_CLASS, type ThemeVars } from "nbook/app/utils/theme/theme-tokens";
import {resolveTheme} from "nbook/app/utils/theme/resolve-theme";
import type {CustomThemeDto} from "nbook/shared/theme/theme-vars";

const themeHost = shallowRef<HTMLElement | null>(null);
const emptyCustomThemes = shallowRef<CustomThemeDto[]>([]);

/**
 * 把变量表应用到当前宿主节点。
 *
 * 观感档位在这里合入，必须算成写出去的**值**：这 36 个变量落在宿主的 inline style 上，
 * 优先级高于任何选择器，写成 CSS 规则的档位会被静默压掉。
 * 档位同时写成 `data-chrome` 属性，让 DevTools 里一眼能看到当前档位，排查时不必猜。
 */
const applyVarsToHost = (vars: ThemeVars): void => {
    if (!themeHost.value) {
        return;
    }

    const level = chromeLevel.value;
    themeHost.value.classList.add(IDE_THEME_HOST_CLASS);
    themeHost.value.dataset.chrome = level;
    applyThemeVars(themeHost.value, resolveChromeVars(vars, level));
};

/**
 * 把外部主题状态挂到 IDE 宿主元素上。
 */
export const useIdeTheme = (
    themeId: Ref<string>,
    customThemes: Ref<CustomThemeDto[]> = emptyCustomThemes,
    varsSnapshot?: Ref<ThemeVars | null>,
) => {
    /**
     * 解析并应用当前主题。
     */
    const applyThemeToHost = (): void => {
        applyVarsToHost(resolveTheme(themeId.value, customThemes.value).vars);
    };

    /**
     * 挂载主题宿主。
     */
    const mountThemeHost = (host: HTMLElement | null): void => {
        themeHost.value = host;
        if (varsSnapshot?.value) {
            applyVarsToHost(varsSnapshot.value);
            return;
        }
        applyThemeToHost();
    };

    /**
     * 切换主题。
     */
    const setTheme = (nextThemeId: string): void => {
        themeId.value = nextThemeId;
        applyThemeToHost();
    };

    // 档位恢复挂在这一层而不是 useChromeLevel 内部：那边是设置界面的入口，
    // 用户设置过档位却从没打开设置的话，档位就永远恢复不了。这里是所有页面的公共入口。
    onMounted(restoreChromeLevel);

    watch([themeId, customThemes], applyThemeToHost, {deep: true});
    watch(chromeLevel, applyThemeToHost);

    return {
        mountThemeHost,
        setTheme,
        applyThemeToHost,
    };
};
