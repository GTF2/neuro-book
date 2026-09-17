/**
 * 设计 token 名单：排版 / 间距 / 圆角 / 层级 / 动效，以及主题层的形状与角色。
 *
 * 值的事实源是 `app/styles/design-tokens.css`，这里只登记名字与分组，用途有两个：
 * 给消费方一个可枚举的契约，以及给测试一条「CSS 是否声明齐全」的兜底断言。
 *
 * 与 `colorway/colorway-contract.ts`（nb-ui 侧）的分工：那边是**随配色变化的颜色**，
 * 这边是**不随配色变化的形状与节奏**。颜色走 `theme-tokens.ts` 的 36 变量表，两者正交。
 *
 * 名单与 `@notnotype/nb-ui` 的 `src/theme/tokens.ts` 逐字对应、分组同构，取值为同一份。
 * nb-ui 的口径是「主仓保持零改动，阶段 4 再合流」；本模块按同一份取值先行补齐，
 * 为的是主仓现在就能用上语义 token，且合流时两边已经一致、直接删一份即可。
 */

/** 排版：界面字体、字号刻度、行高、字重 */
export const typographyTokens = [
    "--font-ui",
    "--font-mono",
    "--text-2xs",
    "--text-xs",
    "--text-sm",
    "--text-md",
    "--text-lg",
    "--text-xl",
    "--leading-tight",
    "--leading-ui",
    "--leading-reading",
    "--weight-normal",
    "--weight-medium",
    "--weight-strong",
] as const;

/** 间距：4 的倍数，七级刻度（控制区内边距默认 --space-4/--space-5，面板间距默认 --space-6） */
export const spacingTokens = ["--space-1", "--space-2", "--space-3", "--space-4", "--space-5", "--space-6", "--space-7", "--space-8"] as const;

/** 圆角：控件、面板、菜单、胶囊四档。阅读区用 0 或 2px，不走这四档 */
export const radiusTokens = ["--radius-control", "--radius-panel", "--radius-menu", "--radius-pill"] as const;

/** 层级：阴影只给真正浮起的元素，且必须由 --shadow-color 推导 */
export const elevationTokens = ["--elevation-flat", "--elevation-popover", "--elevation-dialog"] as const;

/** 动效：prefers-reduced-motion 时时长全部降为 0 */
export const motionTokens = ["--motion-fast", "--motion-base", "--motion-enter", "--ease-standard"] as const;

/** 五组设计 token 的合集。回答的是「这个刻度叫什么」 */
export const designTokens = [...typographyTokens, ...spacingTokens, ...radiusTokens, ...elevationTokens, ...motionTokens] as const;

/*
 * ── 主题层基线 ──────────────────────────────────────────────────────────────
 * 下面三组回答的是另一个问题：「观感能改什么」。与上面的区别不是长短，是裁决规则——
 * 上面五组是全局刻度，主题若要改它得连同所有消费方一起想；下面三组就是给主题改的。
 *
 * 名字分开登记而不是合成一张表，是因为加载器要判断一个主题的声明是不是在重复登记已有变量。
 */

/** 展示字体、字距、控件与容器的尺寸刻度：观感最直观的「密度」维度 */
export const themeMetricTokens = [
    "--font-display",
    "--tracking-ui",
    "--control-h-sm",
    "--control-h-md",
    "--control-h-lg",
    "--control-px",
    "--panel-p",
    "--stack-gap",
    "--radius-control-lg",
    "--radius-dialog",
    "--border-w",
] as const;

/** 装饰：渐变面、内阴影、抬起阴影、焦点环。全关就是「低 chrome」那一档 */
export const themeDecorTokens = ["--surface-raise", "--inset-shadow", "--elevation-raised", "--focus-ring", "--focus-outline"] as const;

/**
 * 角色映射：控件的面用哪个配色变量、描边用不用色、分隔靠线还是靠底色。
 * 这是观感决策不是颜色决策——没有这一层，「低 chrome」只能靠改组件来表达。
 */
export const themeRoleTokens = [
    "--control-surface",
    "--control-outline",
    "--button-surface",
    "--button-outline",
    "--panel-surface",
    "--panel-outline",
    "--sidebar-surface",
    "--toolbar-surface",
    "--overlay-surface",
    "--overlay-blur",
    "--overlay-sheen",
    "--overlay-item-active",
    "--strip-surface",
    "--divider",
] as const;

/** 主题层基线的合集 */
export const themeBaselineTokens = [...themeMetricTokens, ...themeDecorTokens, ...themeRoleTokens] as const;

export type DesignToken = typeof designTokens[number];
export type ThemeBaselineToken = typeof themeBaselineTokens[number];

/** 本层已占用的全部变量名（设计 token + 主题层基线）。 */
export const reservedDesignTokens = [...designTokens, ...themeBaselineTokens] as const;

export type ReservedDesignToken = typeof reservedDesignTokens[number];
