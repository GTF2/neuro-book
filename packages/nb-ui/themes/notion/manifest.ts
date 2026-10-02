import type {NbThemeManifest} from "../../src/theme/theme-manifest";

/**
 * notion 是「纸面极简」参照主题：以 awesome-design-md 的 Notion 设计系统分析为方向
 * （vendor 副本见 `docs/design-references/notion/DESIGN.md`，只读）。
 *
 * 与 `editorial` 同级的最小格式 + 自带配色：不新增变量、不带资源、不覆盖组件，
 * 只给 token 一组取值并自带亮暗两套配色。判据冲突时以 design-language.md 为准——
 * 它的层级用「发丝轮廓 + 单条环境投影」（坑 #38），不抄 Notion 的 4px/12px 中景投影；
 * 营销页专属模式（hero、定价表、装饰插画）不进产品界面。
 */
export const manifest: NbThemeManifest = {
    id: "notion",
    name: "Notion",
    tagline: "纸面极简",
    description:
        "暖墨文字、hairline 分层、实心面板、无玻璃、克制阴影。控件 8px 矩形圆角、面板 12px，"
        + "浮层靠发丝轮廓加单条环境投影分层。亮色是 canvas 白压暖灰桌面，暗色是 Notion 暖黑。",
    version: "1.0.0",
    author: "nb-ui",
    hostVersion: "^0.2.0",
    providesColorways: ["notion-light", "notion-dark"],
    defaultColorway: {light: "notion-light", dark: "notion-dark"},
};
