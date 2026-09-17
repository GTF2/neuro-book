/**
 * 稿面专注模式（Focus Mode）—— 纯逻辑层。
 *
 * 论点来自 iA Writer：**它最大的特色就是没有多少功能**（官方原话 "The main feature of
 * iA Writer is not having many features"）。它的 Focus Mode 把「视觉引导」做成了零控件方案——
 * 当前正在写的段落保持全色，其余段落变灰。用户不需要在一堆 chrome 里找路，因为路被点亮了。
 *
 * 本模块只放**可单测的纯逻辑**：持久化编解码、快捷键判定、宿主属性生成。
 * 与编辑器耦合的部分（哪一段是「当前段」）在 TipTap 装饰里，见
 * `app/components/markdown-studio/tiptap/FocusMode.ts`；外观在 `app/styles/focus-mode.css`。
 *
 * 三条刻意的设计决定：
 *
 * ① **默认关闭。** 它会改变正文的呈现，不能替用户做这个决定。开启后按 localStorage 记住。
 * ② **只做块级（段落）不做句级。** iA Writer 是句级高亮，但那是纯文本编辑器；
 *    这里的正文是 ProseMirror 文档，句级要高亮就得做文本边界分析，成本与收益不成比例。
 *    段落级已经能回答「我写到哪了」这个问题。
 * ③ **纯静态。** 不做过渡动画。降透明度本身是一个「区域提示」而不是「状态变化」，
 *    给它加动画只会让每次移动光标都闪一下。
 */

/**
 * 持久化键。带 `v1` 后缀是本仓惯例——将来语义变了可以直接换键，不必写迁移。
 */
export const FOCUS_MODE_STORAGE_KEY = "novelfocus.markdown.focusMode.v1";

/**
 * 当前块拿到的类名。由 TipTap 装饰写入，**只在 CSS 侧消费**——
 * 组件不要读它，也不要手工加它。
 */
export const FOCUS_CURRENT_BLOCK_CLASS = "nb-focus-current";

/**
 * 稿面宿主上的开关属性。
 *
 * 开关走宿主属性而不是「随时重算装饰」的理由：装饰只负责标出当前块（移动光标时才变），
 * 开关只负责决定这份标记**要不要显形**。两者分开之后，开关切换是零成本的——
 * 不需要 dispatch 事务，也不需要编辑器重算。
 */
export const FOCUS_MODE_ATTRIBUTE = "data-focus-mode";

/** 属性取值的两个合法值 */
export const FOCUS_MODE_ON = "on";
export const FOCUS_MODE_OFF = "off";

/**
 * 从持久化字符串解析开关。
 *
 * 只认 `"1"`：其它一切（`null`、`undefined`、旧格式、被手改坏的值）一律回落到关闭。
 * **失败方向必须是「关」**——猜成开启会让用户莫名其妙地看到一份变灰的正文。
 */
export function parseStoredFocusMode(raw: string | null | undefined): boolean {
    return raw === "1";
}

/** 把开关序列化成持久化字符串。 */
export function serializeFocusMode(enabled: boolean): string {
    return enabled ? "1" : "0";
}

/**
 * 生成稿面宿主要挂的属性。
 *
 * 返回一个对象而不是单个字符串，是为了让宿主可以直接 `v-bind`，
 * 也为了在测试里断言「关的时候写的是 off 而不是不写」——
 * 不写属性与写 off 在 CSS 上都成立，但显式写出让 DOM 可自证，排查时不用猜。
 */
export function focusModeHostAttributes(enabled: boolean): Record<string, string> {
    return {[FOCUS_MODE_ATTRIBUTE]: enabled ? FOCUS_MODE_ON : FOCUS_MODE_OFF};
}

/**
 * 键盘事件里本模块用到的字段。
 *
 * 用最小形状而不是 `KeyboardEvent`，是为了单测不必构造 DOM 事件。
 */
export type FocusModeShortcutEvent = {
    key: string;
    shiftKey: boolean;
    metaKey: boolean;
    ctrlKey: boolean;
    altKey: boolean;
};

/**
 * 判定是否命中开关快捷键：`Cmd/Ctrl + Shift + F`。
 *
 * 选这个组合前检索过本仓已用的键盘组合，当时只占用了 `Cmd/Ctrl + S`（保存）。
 * 带 Shift 是刻意的：不带 Shift 的 `Cmd+F` 是「查找」，那是浏览器的地盘。
 * 带 Alt 的一律放过（macOS 上 Alt 会产出特殊字符，这类组合不该被抢）。
 */
export function isFocusModeShortcut(event: FocusModeShortcutEvent): boolean {
    if (event.altKey) {
        return false;
    }
    if (!event.shiftKey) {
        return false;
    }
    if (!event.metaKey && !event.ctrlKey) {
        return false;
    }
    return event.key.toLowerCase() === "f";
}
