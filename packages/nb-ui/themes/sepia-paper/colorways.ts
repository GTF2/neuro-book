import type {NbColorwayVars} from "../../src/colorway/colorway-contract";
import type {ColorwayMeta} from "../../src/colorway/colorway-store";

/**
 * sepia-paper 自带的两套配色。两套都写全 33 色，不从内置 dark spread。
 *
 * 亮色档的取值来自 NeuroBook 主仓 `app/utils/theme/theme-tokens.ts` 的 `themeTokens.sepia`
 * ——那是主应用的默认主题，也是 Solarized Light 的变体（`#fdf6e3`=base3 / `#eee8d5`≈base2 /
 * `#586e75`=base01）。Solarized 本来就是为**长时间阅读**设计的配色，与写作工具的需求同向，
 * 所以这一套不是随手挑的暖色，是有出处的。
 *
 * 暗色档从 `themeTokens.dark` 派生但**整体调暖**：本主题的身份是「整套一个色温，靠明度分层」，
 * 如果暗色档沿用冷灰（`#18181b` 一系），同一个界面在明暗切换时会从暖纸变成冷玻璃，
 * 读起来像换了个产品。所以暗色档是「夜里的暖纸」：深棕底 + 暖白墨。
 *
 * ── 三条不变量（本主题必须成立，测试里有对应用例）──────────────────────────
 *
 * ① **--bg-panel 亮于 --bg-main**（纸比桌亮）。稿面经 --page-surface 消费 panel，
 *    反过来就退回成普通 IDE。
 * ② **--bg-input 不低于 --bg-panel**。输入框必须从面上抬起，不许挖成坑。
 * ③ **--accent-main 与 --status-warning 不同色**。「当前章节」和「草稿状态」同色，
 *    余光里就分不开——而写作工具里满屏都是草稿。
 *
 * ── 两处刻意偏离主仓 sepia（都不改主仓，只在本主题里生效）────────────────
 *
 * Ⅰ. **--bg-input**：主仓 sepia 给 `#ebe0c8`，比 --bg-panel（`#fdf6e3`）**暗**，违反不变量 ②。
 *    这正是 nb-ui `docs/design-language.md` 坑 #6 记录的形态——「输入框比窗体底还暗，
 *    看起来像没上样式的原生控件」。这里改为与 panel 同值，输入框的身份交给
 *    `--control-surface`（从面上抬起）与 `--border-color` 承担。暗色档同理修正。
 *
 * Ⅱ. **--shadow-color**：主仓 sepia 用 `#0f172a`（冷蓝黑）。暖米底的纸上压冷阴影会发灰发紫，
 *    这是 nbook 已经记过同款道理的镜像（它写的是「暖阴影压在冷底上会发紫」，反过来一样）。
 *    这里改为从墨色派生（`#433422`），暗色档仍用纯黑——暗底上阴影只承担「压暗」，
 *    不需要色相。
 */

/** 昼：米色的纸，赭石的墨。器械与纸同色系，只差明度 */
const SEPIA_PAPER_LIGHT: NbColorwayVars = {
    "--color-scheme": "light",
    // 桌面。整套里最暗的一层底，纸从它上面浮起来
    "--bg-main": "#f4ecd8",
    // 纸。稿面经 --page-surface 消费它。-bg-input 与它同值（见偏离 Ⅰ）
    "--bg-panel": "#fdf6e3",
    // 器械。比桌面略暗，读作「凹槽」而不是「浮起」——低 chrome 主题里器械不该抢戏
    "--bg-sidebar": "#ebe0c8",
    "--bg-subtle": "color-mix(in srgb, #ebe0c8 78%, #fdf6e3)",
    // 不变量 ②：与 panel 同值，不低于它。输入框靠 --control-surface 从面上抬起
    "--bg-input": "#fdf6e3",
    "--bg-hover": "#e3d5b8",
    // 墨色，不是纯黑：纯中性黑落在暖纸上会显得发青
    "--text-main": "#433422",
    "--text-secondary": "#786450",
    "--text-muted": "#b8a896",
    "--text-inverse": "#ffffff",
    "--border-color": "#d6c7a9",
    "--border-strong": "#cfbc96",
    "--border-accent": "color-mix(in srgb, #d97743 46%, #d6c7a9)",
    // 赭石橙。定「当前项 / 主操作」；状态色全部让它，避免同一个橙在同屏里做两件事
    "--accent-main": "#d97743",
    "--accent-bg": "rgba(217, 119, 67, 0.15)",
    "--accent-text": "#b85a2a",
    "--selection-bg": "rgba(217, 119, 67, 0.28)",
    // 青而不是蓝：冷色在暖纸上本来就跳，一个就够
    "--status-info": "#4f6f73",
    "--status-info-bg": "rgba(79, 111, 115, 0.14)",
    "--status-info-border": "rgba(79, 111, 115, 0.35)",
    // 不变量 ③：与 accent 的赭石橙明显不同——这里是偏黄的橄榄绿，色相差 60° 以上
    "--status-success": "#6f7f35",
    "--status-success-bg": "rgba(111, 127, 53, 0.16)",
    "--status-success-border": "rgba(111, 127, 53, 0.38)",
    // 深琥珀，比 accent 暗两档。与 accent 同属暖色系但不撞脸
    "--status-warning": "#b86b00",
    "--status-warning-bg": "rgba(184, 107, 0, 0.15)",
    "--status-warning-border": "rgba(184, 107, 0, 0.34)",
    // 砖红，不是正红：正红在暖纸上会有荧光感
    "--status-danger": "#a34d3f",
    "--status-danger-bg": "rgba(163, 77, 63, 0.13)",
    "--status-danger-border": "rgba(163, 77, 63, 0.34)",
    // 偏离 Ⅱ：暖墨色而不是冷蓝黑，否则纸上的影子发灰
    "--shadow-color": "#433422",
    "--shadow-panel": "0 1px 2px rgba(67, 52, 34, 0.10), 0 18px 44px rgba(67, 52, 34, 0.16)",
    /*
     * 遮罩 0.28。
     *
     * 本主题不是玻璃主题，所以不存在「遮罩把玻璃能采的东西压没」那个约束；
     * 0.28 是照 nbook 的口径取的——它读起来清楚地表示「后面那层被挡住了」，
     * 又不至于把暖纸压成一块灰。
     */
    "--overlay-bg": "rgba(67, 52, 34, 0.28)",
};

/** 夜：深棕的桌，暖白的墨。同一个色温，只是把明度反过来 */
const SEPIA_PAPER_DARK: NbColorwayVars = {
    "--color-scheme": "dark",
    // 暖黑（stone 一系），不是 #18181b 的冷黑——整套一个色温是本主题的身份
    "--bg-main": "#1c1917",
    // 纸在夜里。不变量 ①：必须亮于 --bg-main
    "--bg-panel": "#2a2521",
    "--bg-sidebar": "#211d1a",
    "--bg-subtle": "color-mix(in srgb, #211d1a 78%, #2a2521)",
    // 不变量 ②：亮于 --bg-panel。夜间输入框同样是从纸上抬起，不是挖下去
    "--bg-input": "#332d28",
    "--bg-hover": "#3a332d",
    // 暖白，不是 #fafafa：纯中性白落在暖棕上会发蓝
    "--text-main": "#f0e8de",
    "--text-secondary": "#c9bfb2",
    "--text-muted": "#948a7d",
    "--text-inverse": "#1c1917",
    "--border-color": "#3d3630",
    "--border-strong": "#4e453d",
    "--border-accent": "color-mix(in srgb, #e08a4f 46%, #3d3630)",
    // 亮色档 accent（#d97743）的夜间版：同一个赭石，提亮以适配暗底
    "--accent-main": "#e08a4f",
    "--accent-bg": "rgba(224, 138, 79, 0.16)",
    "--accent-text": "#f0a875",
    "--selection-bg": "rgba(224, 138, 79, 0.32)",
    "--status-info": "#6fb3b8",
    "--status-info-bg": "rgba(111, 179, 184, 0.14)",
    "--status-info-border": "rgba(111, 179, 184, 0.30)",
    "--status-success": "#9db85c",
    "--status-success-bg": "rgba(157, 184, 92, 0.14)",
    "--status-success-border": "rgba(157, 184, 92, 0.30)",
    // 不变量 ③：比 accent 更黄、更闷。同一个暖色系里靠色相与饱和度拉开
    "--status-warning": "#d8a13c",
    "--status-warning-bg": "rgba(216, 161, 60, 0.14)",
    "--status-warning-border": "rgba(216, 161, 60, 0.30)",
    "--status-danger": "#d9766a",
    "--status-danger-bg": "rgba(217, 118, 106, 0.14)",
    "--status-danger-border": "rgba(217, 118, 106, 0.30)",
    // 暗底上阴影只承担「压暗」，不需要色相
    "--shadow-color": "#000000",
    "--shadow-panel": "0 1px 2px rgba(0, 0, 0, 0.50), 0 20px 48px rgba(0, 0, 0, 0.60)",
    "--overlay-bg": "rgba(0, 0, 0, 0.40)",
};

export const sepiaPaperColorways: Record<string, NbColorwayVars> = {
    "sepia-paper-light": SEPIA_PAPER_LIGHT,
    "sepia-paper-dark": SEPIA_PAPER_DARK,
};

export const sepiaPaperColorwayMeta: Record<string, ColorwayMeta> = {
    "sepia-paper-light": {label: "纸墨 · 昼", appearance: "light"},
    "sepia-paper-dark": {label: "纸墨 · 夜", appearance: "dark"},
};
