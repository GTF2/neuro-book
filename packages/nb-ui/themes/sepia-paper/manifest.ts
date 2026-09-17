import type {NbThemeManifest} from "../../src/theme/theme-manifest";

/**
 * sepia-paper —— 纸墨。暖纸 + 赭石墨的写作主题，**低 chrome** 取向。
 *
 * 论点一句话：**把器械退场，让纸说话。**
 *
 * 与 nbook 的关系：**同级，不是继承**（同 nbook 与 macos 的关系，两套各自自包含）。
 * 差异只在两处，其余原样跟随：
 *
 * ① **整套偏暖，且冷暖分界被抹掉**。nbook 的器械是冷玻璃、只有稿面是暖纸，
 *    冷暖对比就是它的身份。本主题反过来：器械与纸同在暖色系里，靠**明度**分层而不是靠色相。
 *    理由是长时间写作时窗口几乎全屏被稿面占据，一块冷灰侧栏在暖纸旁边读起来像「另一个软件」。
 *    代价写在明处：失去了 nbook 那种「材质二分」的戏剧性，换来的是整屏只有一个色温。
 *
 * ② **低 chrome**。面板不描边、按钮平时不显形、面上不加渐变，分层改由留白与底色承担。
 *    `--panel-outline` 与 `--button-surface` 那两条是本主题与 nbook 最直观的分界。
 *
 * 取值的来源不是目测：**亮色档逐字沿用 NeuroBook 主仓 `app/utils/theme/theme-tokens.ts`
 * 的 `themeTokens.sepia`**——那是主应用默认主题、已被长期使用验证过的 36 个变量，
 * 本主题把它投影到 nb-ui 的 33 变量契约上（去掉 `--editor-bg` / `--source-bg` /
 * `--source-text` / `--source-muted` / `--toolbar-bg` / `--chat-ai-bg` 六个领域专用变量，
 * 补上 `--color-scheme` / `--shadow-panel` / `--overlay-bg` 三个 nb-ui 自有变量）。
 * **两处刻意偏离**（都不改主仓，只在本主题里生效）：
 *
 * Ⅰ. **`--bg-input`**。主仓 sepia 给的是 `#ebe0c8`，比 `--bg-panel`（`#fdf6e3`）还暗，
 *    违反「输入框不许挖成坑」的不变量——那正是 `design-language.md` 坑 #6 记录的形态。
 *    这里改成与 panel 同值，输入框改用 `--control-surface` 从面上抬起。
 * Ⅱ. **`--shadow-color`**。主仓 sepia 用 `#0f172a`（冷蓝黑）。暖米底的纸上压冷阴影会发灰发紫，
 *    而 nbook 已经记过同款道理的镜像（「暖阴影压在冷底上会发紫」，反过来同理）。
 *    这里改为从墨色派生（`#433422`）。
 *
 * 它不是「星炉主题」：星炉（NovelForge）只提供了**范式参考**（暖纸墨的取值关系、
 * 面向写作的信息架构），没有任何取值被复制——星炉的变量是扁平的 `--nf-*` 表，
 * 与 nb-ui 的分层 token 不是一回事。详见交付文档 `deliverables/ui-redesign-2026-09-17/DESIGN.md`。
 */
export const manifest: NbThemeManifest = {
    id: "sepia-paper",
    name: "纸墨 Sepia Paper",
    tagline: "暖纸 + 赭石墨 · 低 chrome",
    description: "整套暖色，靠明度而非色相分层。面板不描边、按钮平时不显形，分层交给留白与底色。适合长时间连续写作。",
    version: "1.0.0",
    author: "nb-ui",
    /*
     * 兼容范围与 nb-ui 当前版本对齐。写复合范围（`>=1.0.0 <2.0.0`）会被装载器以
     * `host-version` 拒绝并说明不支持——它不猜结果。
     */
    hostVersion: "^0.2.0",
    /*
     * 稿面那 7 个变量是 nbook 建立的约定，本主题跟随（一套写作工具的稿面角色是共通的），
     * 全部是「派生型」：fallback 能从配色契约算出来，所以别的主题激活时引用它们不会塌。
     *
     * 本主题**不做玻璃**，因此不声明任何 `--glass-*` / `--window-backdrop`：
     * 那些是玻璃主题的自带资源，纸墨主题没有玻璃面可谈。
     */
    declares: [
        {
            name: "--page-surface",
            /*
             * fallback 取 --bg-panel 而不是 --bg-main：配色表保证 panel 恒亮于 main，
             * 所以「纸比桌亮」用一条派生式就能同时在明暗下成立，不必按 data-nb-appearance 分档。
             */
            fallback: "var(--bg-panel)",
            description: "稿面的面色。必须比窗体底（--bg-main）亮，明暗两档都是——这是内容层做成纸的支点。",
        },
        {
            name: "--page-ink",
            fallback: "var(--text-main)",
            description: "正文墨色。与界面文字分开：稿面可以用比界面更高的对比。",
        },
        {
            name: "--page-rule",
            fallback: "var(--divider)",
            description: "稿面上的细线：版心边界、页边栏分界。比界面分隔线更淡。",
        },
        {
            name: "--page-lift",
            // 正确的兜底不是「淡一点的阴影」而是「没有阴影」——纸浮起来是本主题的说法，不是通则
            fallback: "none",
            description: "稿面的投影。内容层唯一一处阴影：器械靠底色分层，纸靠影子。",
        },
        {
            name: "--font-emphasis",
            /*
             * 中文没有斜体。浏览器的 italic 是把字形做剪切变形，看起来像渲染故障，
             * 所以正文强调必须换字面（楷体），不能换字形。这条对中文写作工具是硬需求。
             */
            fallback: "var(--font-display)",
            description: "正文强调用的字面。中文以楷体表强调，不用 font-style: italic。",
        },
        {
            name: "--reading-size",
            fallback: "17px",
            description: "稿面正文字号。与界面字号分开，两个区的密度本来就不该一样。",
        },
        {
            name: "--reading-measure",
            /*
             * 用 em 不用 rem：CJK 下 1em 恰好是一个汉字宽，所以 34em ≈ 每行 34 个字，
             * 行宽口径能直接说人话。rem 只能靠猜，而且改了字号行宽就错。
             */
            fallback: "34em",
            description: "稿面行宽，单位 em。CJK 下 1em 是一个汉字宽，所以这个数就是「每行多少字」。",
        },
    ],
    providesColorways: ["sepia-paper-light", "sepia-paper-dark"],
    defaultColorway: {light: "sepia-paper-light", dark: "sepia-paper-dark"},
    /*
     * 第一档（声明式）：变量声明 + 取值 + 自带配色，没有组件覆盖、没有 SVG 资源。
     * 低 chrome 全靠角色映射表达，一行组件代码都不用改——这正是主题层存在的理由。
     */
};
