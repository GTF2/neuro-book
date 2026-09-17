import {describe, expect, it} from "vitest";
import {
    FOCUS_MODE_ATTRIBUTE,
    FOCUS_MODE_OFF,
    FOCUS_MODE_ON,
    FOCUS_MODE_STORAGE_KEY,
    focusModeHostAttributes,
    isFocusModeShortcut,
    parseStoredFocusMode,
    serializeFocusMode,
    type FocusModeShortcutEvent,
} from "nbook/app/utils/focus-mode";

/**
 * 专注模式的纯逻辑用例。
 *
 * 重点在两处**失败方向**，它们各自对应一个真实的坏结果：
 *
 * ① 持久化解析失败时必须回落到「关」。猜成「开」会让用户莫名其妙地看到一份变灰的正文，
 *    而且他不知道是自己什么时候开的——这比「设置没生效」难查得多。
 * ② 快捷键判定必须放过 Alt 组合。macOS 上 Alt 会产出特殊字符，抢这类组合会让
 *    输入特殊字符时误触发。
 */

/** 造一个按键事件，默认「什么都没按」 */
function keyEvent(overrides: Partial<FocusModeShortcutEvent> = {}): FocusModeShortcutEvent {
    return {
        key: "",
        shiftKey: false,
        metaKey: false,
        ctrlKey: false,
        altKey: false,
        ...overrides,
    };
}

describe("focus mode storage key", () => {
    it("is versioned so a semantic change can switch keys instead of migrating", () => {
        expect(FOCUS_MODE_STORAGE_KEY).toContain(".v1");
    });
});

describe("parseStoredFocusMode", () => {
    it("reads the enabled marker back", () => {
        expect(parseStoredFocusMode("1")).toBe(true);
    });

    it.each([
        ["missing key", null],
        ["undefined", undefined],
        ["explicit off", "0"],
        ["empty string", ""],
        ["a truthy-looking string from another format", "true"],
        ["a thrown-together value", "yes"],
        ["whitespace around the marker", " 1 "],
    ])("falls back to off for %s", (_label, raw) => {
        expect(parseStoredFocusMode(raw)).toBe(false);
    });
});

describe("serializeFocusMode", () => {
    it("writes the enabled marker", () => {
        expect(serializeFocusMode(true)).toBe("1");
        expect(serializeFocusMode(false)).toBe("0");
    });

    it("survives a round trip in both directions", () => {
        for (const enabled of [true, false]) {
            expect(parseStoredFocusMode(serializeFocusMode(enabled))).toBe(enabled);
        }
    });
});

describe("focusModeHostAttributes", () => {
    it("uses the documented attribute name", () => {
        expect(FOCUS_MODE_ATTRIBUTE).toBe("data-focus-mode");
    });

    it("writes an explicit value in both states", () => {
        /*
         * 关的时候也写出 `off` 而不是省略属性：省略与 `off` 在 CSS 上等价，
         * 但显式写出让 DOM 可自证——排查时不必猜「是没开，还是没生效」。
         */
        expect(focusModeHostAttributes(true)).toEqual({"data-focus-mode": FOCUS_MODE_ON});
        expect(focusModeHostAttributes(false)).toEqual({"data-focus-mode": FOCUS_MODE_OFF});
    });
});

describe("isFocusModeShortcut", () => {
    it("accepts cmd+shift+f", () => {
        expect(isFocusModeShortcut(keyEvent({key: "f", metaKey: true, shiftKey: true}))).toBe(true);
    });

    it("accepts ctrl+shift+f for windows and linux", () => {
        expect(isFocusModeShortcut(keyEvent({key: "F", ctrlKey: true, shiftKey: true}))).toBe(true);
    });

    it("does not care about the letter's case", () => {
        expect(isFocusModeShortcut(keyEvent({key: "F", metaKey: true, shiftKey: true}))).toBe(true);
    });

    it("leaves cmd+f alone — that belongs to find", () => {
        expect(isFocusModeShortcut(keyEvent({key: "f", metaKey: true}))).toBe(false);
    });

    it("leaves plain letters alone", () => {
        expect(isFocusModeShortcut(keyEvent({key: "f"}))).toBe(false);
        expect(isFocusModeShortcut(keyEvent({key: "f", shiftKey: true}))).toBe(false);
    });

    it("refuses alt combinations so special-character input is never stolen", () => {
        // macOS 上 Alt 会产出特殊字符，这三个都应该放过
        expect(isFocusModeShortcut(keyEvent({key: "f", metaKey: true, shiftKey: true, altKey: true}))).toBe(false);
        expect(isFocusModeShortcut(keyEvent({key: "f", metaKey: true, altKey: true}))).toBe(false);
        expect(isFocusModeShortcut(keyEvent({key: "f", altKey: true}))).toBe(false);
    });

    it("only answers for f", () => {
        for (const key of ["s", "k", "p", "Enter", "Escape", "1"]) {
            expect(isFocusModeShortcut(keyEvent({key, metaKey: true, shiftKey: true}))).toBe(false);
        }
    });
});
