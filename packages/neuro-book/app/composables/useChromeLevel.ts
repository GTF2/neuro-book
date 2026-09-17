import {onMounted, ref, type Ref} from "vue";
import {
    CHROME_LEVEL_STORAGE_KEY,
    DEFAULT_CHROME_LEVEL,
    parseStoredChromeLevel,
    readChromeLevelFromSearch,
    serializeChromeLevel,
    type ChromeLevel,
} from "nbook/app/utils/theme/chrome-level";

/**
 * 界面观感档位的开关状态。
 *
 * **模块级单例**，理由与 `useFocusMode` 相同：同一个档位会被多处读——主题宿主用它决定
 * 写入哪套变量，将来的设置界面用它显示当前档位。若各调用点各持一份 ref，它们会各自漂移，
 * 出现「改了档位只有一处变样」这类最难查的 bug。
 *
 * 持久化在 **onMounted** 读，不在 setup 里同步读：同步读会让服务端渲染出的默认档与
 * 客户端首次渲染的档位对不上，触发 hydration 不匹配警告。
 */

const level = ref<ChromeLevel>(DEFAULT_CHROME_LEVEL);
let restored = false;

/** 供 `useIdeTheme` 直接读，不必走 composable——它可能在 setup 之外被调用。 */
export const chromeLevel = level;

export type UseChromeLevelReturn = {
    /** 当前档位 */
    level: Ref<ChromeLevel>;
    setLevel: (next: ChromeLevel) => void;
    toggle: () => void;
};

export function useChromeLevel(): UseChromeLevelReturn {
    onMounted(restoreChromeLevel);

    return {level, setLevel, toggle};
}

/**
 * 恢复档位。查询串优先于存储——它是看效果用的临时覆盖，不该被持久化的值盖住。
 *
 * **必须由页面级入口调用**（`useIdeTheme` 里已接），不能只靠 `useChromeLevel()`：
 * 后者只在设置界面被调用，用户设置过档位却从没打开设置的话，档位就永远恢复不了。
 * 幂等，多处调用无副作用。
 */
export function restoreChromeLevel(): void {
    if (restored || typeof window === "undefined") {
        return;
    }
    restored = true;

    const fromSearch = readChromeLevelFromSearch(window.location.search);
    if (fromSearch) {
        level.value = fromSearch;
        return;
    }

    try {
        level.value = parseStoredChromeLevel(window.localStorage.getItem(CHROME_LEVEL_STORAGE_KEY));
    } catch {
        // 隐私模式 / 存储被禁用：读不到就是默认档，不影响功能本身
    }
}

function setLevel(next: ChromeLevel): void {
    level.value = next;
    persist(next);
}

function toggle(): void {
    setLevel(level.value === "quiet" ? "full" : "quiet");
}

function persist(next: ChromeLevel): void {
    if (typeof window === "undefined") {
        return;
    }

    try {
        window.localStorage.setItem(CHROME_LEVEL_STORAGE_KEY, serializeChromeLevel(next));
    } catch {
        // 配额满或被拒绝：偏好存不下不该让功能不可用
    }
}
