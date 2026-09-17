import {defineConfig, presetUno, presetIcons, type Rule} from "unocss";
import {icons as lucideIcons} from "@iconify-json/lucide";

/**
 * var() 任意值的透明度后缀兜底。
 *
 * presetUno 对 `bg-[var(--x)]/50` 这类「var() 任意值 + 透明度后缀」的处理是**不一致的坏**：
 * 多数情况把后缀静默丢掉，与不带后缀的写法合并成同一条全不透明声明；个别比例干脆不生成规则
 * （元素底色透明）。实测（浏览器里枚举生成 CSS + 探针读实算值）：`/40` `/30` `/50` 全不透明、
 * `/78` 无规则、`/95` 只拿到 0.9。全仓约 150 处这种写法（bg 115 + border 33），作者写的
 * 半透明从未按预期渲染过——满屏「全强度分隔线」有一部分正是这里来的。
 *
 * 自定义规则的优先级高于 preset：命中即生成 `color-mix(in srgb, var(--x) NN%, transparent)`。
 * var() 在运行时才解析，所以主题切换、以及简洁档下本身就是 color-mix 结果的变量（如
 * `--border-color`）嵌套进来都合法。
 *
 * 只接 bg 与 border（都是单一直接属性，声明自包含）。text- 只有 2 处且 90% 与 100% 观感
 * 无差；ring- 的颜色要进 `--un-ring-color` 再由 box-shadow 组合，简单声明接不住，均未处理，
 * 各自维持现状。
 */
function varAlphaRule(prefix: "bg" | "border", property: "background-color" | "border-color"): Rule {
    return [
        new RegExp(`^${prefix}-\\[var\\(--([a-z0-9-]+)\\)\\]\\/(\\d{1,3})$`),
        ([, name, alpha]) => ({[property]: `color-mix(in srgb, var(--${name}) ${Number(alpha)}%, transparent)`}),
    ];
}

export default defineConfig({
    presets: [
        presetUno(),
        presetIcons({
            // 显式声明图标集合：presetIcons() 的自动探测在本机取不到 @iconify-json/lucide，
            // 而它回退的 Iconify 网络 API 也不可达，结果是图标 CSS 一条都不生成、界面图标全部空白。
            collections: {
                lucide: () => lucideIcons,
            },
        }),
    ],
    rules: [varAlphaRule("bg", "background-color"), varAlphaRule("border", "border-color")],
    safelist: Object.keys(lucideIcons.icons).map((iconName) => `i-lucide-${iconName}`),
});
