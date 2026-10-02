import type {NbColorwayVars} from "../../src/colorway/colorway-contract";
import type {ColorwayMeta} from "../../src/colorway/colorway-store";
import {nbColorways} from "../../src/colorway/presets";

/**
 * notion 自带的两套配色，取值方向来自 docs/design-references/notion/DESIGN.md：
 * 暖墨文字（rgb(55,53,47) 家族）、canvas 白面板、hairline 分割（9% 墨）、
 * 交互蓝 #2383e2、阴影基色 rgb(15,15,15)。
 *
 * 写法与 `macos` 同构：`notion-light` 是完整 33 色（库内置亮色已下线，没有可继承的基），
 * `notion-dark` 从内置 dark spread 出来只改面 / 文字 / 强调，status 三件套沿用内置的暗色调。
 *
 * 强调色占了蓝，所以 `--status-info` 按设计语言 §五让位成青色，不与 accent 撞色；
 * 三条配色不变量（panel 恒亮于 main、input 不低于 panel、accent ≠ warning）两套都满足。
 */

export const notionColorways: Record<string, NbColorwayVars> = {
    "notion-light": {
        "--color-scheme": "light",
        "--bg-main": "#f1f1ef",
        "--bg-panel": "#ffffff",
        "--bg-sidebar": "#f7f7f5",
        "--bg-subtle": "color-mix(in srgb, #f7f7f5 78%, #ffffff)",
        "--bg-input": "#ffffff",
        "--bg-hover": "#ebebe9",
        "--text-main": "#37352f",
        "--text-secondary": "rgba(55, 53, 47, 0.65)",
        "--text-muted": "rgba(55, 53, 47, 0.45)",
        "--text-inverse": "#ffffff",
        "--border-color": "rgba(55, 53, 47, 0.09)",
        "--border-strong": "rgba(55, 53, 47, 0.16)",
        "--border-accent": "color-mix(in srgb, #2383e2 46%, rgba(55, 53, 47, 0.09))",
        "--accent-main": "#2383e2",
        "--accent-bg": "rgba(35, 131, 226, 0.12)",
        "--accent-text": "#0b6ec9",
        "--status-info": "#0f8c8c",
        "--status-info-bg": "rgba(15, 140, 140, 0.10)",
        "--status-info-border": "rgba(15, 140, 140, 0.26)",
        "--status-success": "#448361",
        "--status-success-bg": "rgba(68, 131, 97, 0.12)",
        "--status-success-border": "rgba(68, 131, 97, 0.28)",
        "--status-warning": "#d9730d",
        "--status-warning-bg": "rgba(217, 115, 13, 0.12)",
        "--status-warning-border": "rgba(217, 115, 13, 0.30)",
        "--status-danger": "#e03e3e",
        "--status-danger-bg": "rgba(224, 62, 62, 0.10)",
        "--status-danger-border": "rgba(224, 62, 62, 0.26)",
        "--shadow-color": "#0f0f0f",
        "--selection-bg": "rgba(35, 131, 226, 0.22)",
        "--shadow-panel": "0 4px 12px rgba(15, 15, 15, 0.08)",
        "--overlay-bg": "rgba(15, 15, 15, 0.28)",
    },
    "notion-dark": {
        ...nbColorways.dark,
        "--bg-main": "#191919",
        "--bg-panel": "#252525",
        "--bg-sidebar": "#202020",
        "--bg-subtle": "color-mix(in srgb, #202020 78%, #252525)",
        "--bg-input": "#2b2b2b",
        "--bg-hover": "#2f2f2f",
        "--text-main": "#d4d4d4",
        "--text-secondary": "rgba(255, 255, 255, 0.46)",
        "--text-muted": "rgba(255, 255, 255, 0.28)",
        "--text-inverse": "#191919",
        "--border-color": "rgba(255, 255, 255, 0.10)",
        "--border-strong": "rgba(255, 255, 255, 0.16)",
        "--border-accent": "color-mix(in srgb, #2383e2 46%, rgba(255, 255, 255, 0.10))",
        "--accent-main": "#2383e2",
        "--accent-bg": "rgba(35, 131, 226, 0.18)",
        "--accent-text": "#6cb2ee",
        "--selection-bg": "rgba(35, 131, 226, 0.34)",
        "--shadow-color": "#000000",
        "--shadow-panel": "0 4px 12px rgba(0, 0, 0, 0.45)",
        "--overlay-bg": "rgba(0, 0, 0, 0.5)",
    },
};

export const notionColorwayMeta: Record<string, ColorwayMeta> = {
    "notion-light": {label: "Notion Light", appearance: "light"},
    "notion-dark": {label: "Notion Dark", appearance: "dark"},
};
