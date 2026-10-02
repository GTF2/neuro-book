import type {NbThemeModule} from "../../src/theme/theme-manifest";
import {notionColorwayMeta, notionColorways} from "./colorways";
import {manifest} from "./manifest";

import "./vars.css";

export const notionTheme: NbThemeModule = {
    manifest,
    colorways: notionColorways,
    colorwayMeta: notionColorwayMeta,
};

export default notionTheme;
