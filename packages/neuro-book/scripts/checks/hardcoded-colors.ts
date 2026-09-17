import {readdirSync, readFileSync, statSync, writeFileSync} from "node:fs";
import {join, relative, resolve} from "node:path";
import {fileURLToPath} from "node:url";

/**
 * UI token 护栏：扫描 app/** 下的硬编码颜色，禁止**新增**。
 *
 * 依据 `app/utils/theme/README.md`（Novel IDE 主题变量规范 v2.1）的「禁止事项」与
 * 「分类与内容色板例外」两节，本模块把规则落成可执行检查：
 *   - 业务组件里的固定 hex / rgb(a) / hsl(a) 等颜色 → 违规；
 *   - Tailwind / UnoCSS 调色板类（bg-gray-100、text-amber-700、bg-black/5 …）→ 违规；
 *   - 文档显式登记为例外的路径（主题事实源、分类色板、语法高亮、取色器、预览脚手架）→ 放行；
 *   - `*.test.ts` 测试断言 → 放行（文档：「测试断言 … 除外」）。
 *
 * 「禁止新增」靠 baseline 棘轮实现：baseline 记录当前每个文件的存量计数，只允许下降或持平，
 * 一旦某文件超过基线（或在基线外的新文件里出现）即失败。
 *
 * 本文件不在 `app/` 下：`app/utils/**` 是 Nuxt 自动导入目录，任何导出都会被塞进客户端包，
 * 而检查逻辑依赖 node:fs，只能待在 `scripts/` 里。
 */

const here = fileURLToPath(new URL(".", import.meta.url));

/** 被扫描的根：packages/neuro-book/app。 */
export const APP_ROOT = resolve(here, "..", "..", "app");

/** baseline 文件（相对 app 的文件路径 → 允许的存量计数）。 */
export const BASELINE_PATH = resolve(here, "hardcoded-colors.baseline.json");

/**
 * 文档 `app/utils/theme/README.md` 显式登记的例外（相对 `app/` 的 POSIX 路径）。
 * 以 `/` 结尾表示整目录放行。
 *
 * 每条都对应 README「分类与内容色板例外」或「阴影与选区」里的原话，改动前先改文档。
 *
 * 注意：README「恒亮元件例外」（开关滑块 `bg-white`、按钮扫光 `bg-white/20`）**不在这里放行**——
 * 它们是文件内的少数固定色，靠 baseline 计数锁定、不允许新增，而不是整文件豁免。
 */
export const EXCEPTION_PATHS: readonly string[] = [
    // 主题系统自身：36 变量的唯一事实源 + 派生 / 编辑器 / 导入导出。
    "utils/theme/",
    // SSR / IDE fallback，必须与 themeTokens.sepia 保持一致。
    "styles/theme-vars.css",
    // Reference chip 的唯一外观源。
    "styles/reference-chips.css",
    // 备用 Markdown 内容主题。
    "styles/markdown-themes.css",
    // JsonViewer / Monaco 语法高亮。
    "components/common/JsonViewer.vue",
    "components/common/diff/monaco-diff-theme.ts",
    "components/markdown-studio/monaco-theme.ts",
    "components/markdown-studio/MarkdownSourceEditor.vue",
    // Markdown 文字 / 背景颜色选择器。
    "components/markdown-studio/MarkdownSelectionMenu.vue",
    // 颜色选择器本身的色板。
    "components/common/form/FormColorField.vue",
    // Profile template 节点类型 accent。
    "components/profile-template-editor/",
    // 分类色板定义文件（类别识别色，不是主题状态色）。
    "components/novel-ide/workspace/workspace-entry-meta.ts",
    "components/novel-ide/plot/tree/plot-tree.types.ts",
    "components/novel-ide/plot/plot-preview.types.ts",
    "components/novel-ide/plot/thread-panel/plot-thread-panel.types.ts",
];

const SCANNABLE_EXTENSIONS = [".vue", ".ts", ".tsx", ".css"];
/** HTML 数字实体（`&#039;` / `&#x27;`）会被误当成 hex 颜色，先剔除。 */
const HTML_ENTITY = /&#(?:x[0-9a-fA-F]+|\d+);/g;
const HEX_COLOR = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/g;
const COLOR_FUNCTION = /\b(?:rgba?|hsla?|oklch|oklab|lch|lab)\(/g;
const PALETTE_CLASS = /(?:^|[\s"'`:[(])(?:bg|text|border|ring|from|via|to|fill|stroke|shadow|decoration|outline|divide|placeholder|caret|accent)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|black|white)(?:-\d{2,3})?(?:\/\d+)?/g;

export type ColorHit = {
    /** 相对 `app/` 的 POSIX 路径。 */
    file: string;
    /** 1 起行号。 */
    line: number;
    /** 命中的原始片段。 */
    text: string;
    kind: "hex" | "function" | "palette";
};

/**
 * 判断某文件是否放行（文档登记例外 / 测试文件）。
 */
export function isExemptFile(appRelativePath: string): boolean {
    if (/\.test\.tsx?$/u.test(appRelativePath)) {
        return true;
    }
    return EXCEPTION_PATHS.some((exception) => (
        exception.endsWith("/") ? appRelativePath.startsWith(exception) : appRelativePath === exception
    ));
}

/**
 * 逐行找出一个文件里的硬编码颜色命中。
 */
export function findColorHits(text: string): Array<Omit<ColorHit, "file">> {
    const hits: Array<Omit<ColorHit, "file">> = [];
    const lines = text.replaceAll(HTML_ENTITY, "").split(/\r?\n/u);
    for (const [index, line] of lines.entries()) {
        for (const [kind, pattern] of [["hex", HEX_COLOR], ["function", COLOR_FUNCTION], ["palette", PALETTE_CLASS]] as const) {
            pattern.lastIndex = 0;
            let match = pattern.exec(line);
            while (match !== null) {
                hits.push({line: index + 1, text: match[0].trim(), kind});
                match = pattern.exec(line);
            }
        }
    }
    return hits;
}

function collectScannableFiles(root: string): string[] {
    const files: string[] = [];
    (function walk(dir: string): void {
        for (const entry of readdirSync(dir)) {
            const full = join(dir, entry);
            if (statSync(full).isDirectory()) {
                walk(full);
                continue;
            }
            if (SCANNABLE_EXTENSIONS.some((extension) => entry.endsWith(extension))) {
                files.push(full);
            }
        }
    })(root);
    return files;
}

/**
 * 扫描 app/** 下所有「未放行」文件，返回逐文件计数 + 逐条命中。
 */
export function scanHardcodedColors(root: string = APP_ROOT): {
    counts: Record<string, number>;
    hits: ColorHit[];
} {
    const counts: Record<string, number> = {};
    const hits: ColorHit[] = [];
    for (const full of collectScannableFiles(root)) {
        const appRelative = relative(root, full).replaceAll("\\", "/");
        if (isExemptFile(appRelative)) {
            continue;
        }
        const fileHits = findColorHits(readFileSync(full, "utf8"));
        if (fileHits.length === 0) {
            continue;
        }
        counts[appRelative] = fileHits.length;
        hits.push(...fileHits.map((hit) => ({...hit, file: appRelative})));
    }
    return {counts, hits};
}

/** 读取 baseline；缺失时返回空对象。 */
export function loadBaseline(path: string = BASELINE_PATH): Record<string, number> {
    try {
        return JSON.parse(readFileSync(path, "utf8")) as Record<string, number>;
    } catch {
        return {};
    }
}

/**
 * 比较当前计数与基线，返回违规清单（新增或增量的文件）。
 */
export function compareAgainstBaseline(
    current: Record<string, number>,
    baseline: Record<string, number>,
): {added: Array<{file: string; count: number}>; increased: Array<{file: string; baseline: number; count: number}>; decreased: Array<{file: string; baseline: number; count: number}>} {
    const added: Array<{file: string; count: number}> = [];
    const increased: Array<{file: string; baseline: number; count: number}> = [];
    const decreased: Array<{file: string; baseline: number; count: number}> = [];
    for (const [file, count] of Object.entries(current)) {
        const allowed = baseline[file];
        if (allowed === undefined) {
            added.push({file, count});
            continue;
        }
        if (count > allowed) {
            increased.push({file, baseline: allowed, count});
        } else if (count < allowed) {
            decreased.push({file, baseline: allowed, count});
        }
    }
    return {added, increased, decreased};
}

/** 按文件排序后写回 baseline，供人工批准后更新。 */
export function writeBaseline(counts: Record<string, number>, path: string = BASELINE_PATH): void {
    const sorted = Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
    writeFileSync(path, `${JSON.stringify(sorted, null, 4)}\n`, "utf8");
}

// `bun scripts/checks/hardcoded-colors.ts --update` 重新生成 baseline（人工核对 diff 后提交）。
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv.includes("--update")) {
    const {counts} = scanHardcodedColors();
    writeBaseline(counts);
    console.log(`已写入 baseline：${Object.keys(counts).length} 个文件，共 ${Object.values(counts).reduce((sum, n) => sum + n, 0)} 处存量。`);
}
