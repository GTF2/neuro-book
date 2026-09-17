import {computed, onMounted, ref, type ComputedRef, type Ref} from "vue";
import {
    FOCUS_MODE_STORAGE_KEY,
    focusModeHostAttributes,
    isFocusModeShortcut,
    parseStoredFocusMode,
    serializeFocusMode,
    type FocusModeShortcutEvent,
} from "nbook/app/utils/focus-mode";

/**
 * 稿面专注模式的开关状态。
 *
 * **模块级单例**，不是每次调用各建一份 ref。
 *
 * 理由是同一份开关会被多个位置读：稿面宿主用它决定要不要挂 `data-focus-mode`，
 * 工具栏用它决定按钮的选中态，快捷键处理器用它翻转。若每个调用点各持一份 ref，
 * 它们会各自漂移——按了快捷键只有一处变色，是最难查的那种 bug。
 * 单例之后「状态在哪」这个问题只有一个答案。
 *
 * 持久化读进 **onMounted**，不在 setup 里同步读：同步读会让服务端渲染出的
 * `data-focus-mode="off"` 与客户端首次渲染的 `"on"` 对不上，触发 hydration 不匹配警告。
 * 代价是「上次开着」的用户会看到一帧未应用的正文，这个代价可以接受——
 * 它比一个静默的 hydration 警告便宜。
 */

const enabled = ref(false);
let restored = false;
let shortcutBound = false;

export type UseFocusModeReturn = {
    /** 当前是否开启 */
    enabled: Ref<boolean>;
    /** 直接 `v-bind` 到稿面宿主上的属性对象 */
    hostAttributes: ComputedRef<Record<string, string>>;
    setEnabled: (next: boolean) => void;
    toggle: () => void;
    /**
     * 交给宿主的按键处理器：命中快捷键则翻转并返回 true。
     * 不命中返回 false，让调用方继续走自己的键盘逻辑。
     */
    handleKeydown: (event: FocusModeShortcutEvent & {preventDefault?: () => void}) => boolean;
};

function readStored(): boolean {
    if (typeof window === "undefined") {
        return false;
    }
    try {
        return parseStoredFocusMode(window.localStorage.getItem(FOCUS_MODE_STORAGE_KEY));
    } catch {
        // 隐私模式 / 存储被禁用：读不到就是关闭，不影响功能本身
        return false;
    }
}

function persist(next: boolean): void {
    if (typeof window === "undefined") {
        return;
    }
    try {
        window.localStorage.setItem(FOCUS_MODE_STORAGE_KEY, serializeFocusMode(next));
    } catch {
        // 配额满或被拒绝：偏好存不下不该让功能不可用
    }
}

function setEnabled(next: boolean): void {
    enabled.value = next;
    persist(next);
}

function toggle(): void {
    setEnabled(!enabled.value);
}

function handleKeydown(event: FocusModeShortcutEvent & {preventDefault?: () => void}): boolean {
    if (!isFocusModeShortcut(event)) {
        return false;
    }
    event.preventDefault?.();
    toggle();
    return true;
}

/**
 * 绑定全局快捷键。**幂等**——重复调用只生效一次。
 *
 * 幂等是必须的：同一个页面上可能同时挂着多个 Markdown Studio 工作台（例如 Agent 模式里的
 * 紧凑工作台与主编辑区各一个）。若每个实例各绑一次，按一下快捷键会翻转两次，
 * 净效果是「按了没反应」——而且只在多实例时出现，单实例调试永远发现不了。
 */
function bindFocusModeShortcut(): void {
    if (shortcutBound || typeof window === "undefined") {
        return;
    }
    shortcutBound = true;
    window.addEventListener("keydown", (event) => {
        if (!isFocusModeShortcut(event)) {
            return;
        }
        event.preventDefault();
        toggle();
    });
}

export function useFocusMode(): UseFocusModeReturn {
    onMounted(() => {
        if (!restored) {
            restored = true;
            enabled.value = readStored();
        }
        bindFocusModeShortcut();
    });

    return {
        enabled,
        hostAttributes: computed(() => focusModeHostAttributes(enabled.value)),
        setEnabled,
        toggle,
        handleKeydown,
    };
}
