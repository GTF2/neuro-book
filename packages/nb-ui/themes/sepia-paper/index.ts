import type {NbThemeModule} from "../../src/theme/theme-manifest";
import {sepiaPaperColorwayMeta, sepiaPaperColorways} from "./colorways";
import {manifest} from "./manifest";

import "./vars.css";

/**
 * 第一档主题（声明式）：变量声明 + 取值 + 自带配色，没有组件覆盖、没有 SVG 资源。
 *
 * 低 chrome 全靠角色映射表达，一行组件代码都不用改——这正是主题层存在的理由。
 * 走的是和第三方主题**完全相同**的装载路径，不享受任何特殊待遇。
 */
export const sepiaPaperTheme: NbThemeModule = {
    manifest,
    colorways: sepiaPaperColorways,
    colorwayMeta: sepiaPaperColorwayMeta,
};

export default sepiaPaperTheme;
